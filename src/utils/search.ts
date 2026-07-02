import type { LatLngTuple, SearchResult, TileBounds } from "../types";
import { PLACE_GAZETTEER, PREFECTURE_HINTS } from "../data/placeGazetteer";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  importance?: number;
  type?: string;
  class?: string;
  boundingbox?: [string, string, string, string];
}

export async function searchPlaces(query: string, currentCenter: LatLngTuple): Promise<SearchResult[]> {
  const normalized = normalizeSearchText(query);
  const coordinate = parseCoordinate(query);
  if (coordinate) {
    return [{
      id: crypto.randomUUID(),
      label: `${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}`,
      lat: coordinate.lat,
      lng: coordinate.lng,
      source: "latlng",
      detail: coordinate.detail,
      confidence: 1
    }];
  }

  const gazetteer = searchGazetteer(normalized, currentCenter);
  const variants = buildQueryVariants(normalized);
  const nominatim = await searchNominatimVariants(variants, currentCenter);
  return dedupeResults([...gazetteer, ...nominatim])
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 10);
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[、，]/g, ",")
    .replace(/[　\s]+/g, " ")
    .replace(/^〒\s*/, "")
    .replace(/[()（）［\]【】]/g, " ")
    .replace(/\s+/g, " ");
}

function buildQueryVariants(query: string): string[] {
  const variants = new Set<string>();
  const compact = query.replace(/\s+/g, "");
  variants.add(query);
  variants.add(compact);
  variants.add(`${query} 日本`);
  variants.add(`${compact} 日本`);

  for (const pref of PREFECTURE_HINTS) {
    if (query.includes(pref.replace(/[都道府県]$/, "")) && !query.includes(pref)) {
      variants.add(query.replace(pref.replace(/[都道府県]$/, ""), pref));
    }
  }

  const aliasPairs: Array<[RegExp, string]> = [
    [/札駅/gi, "札幌駅"],
    [/新千歳(?!空港)/gi, "新千歳空港"],
    [/名駅/gi, "名古屋駅"],
    [/都庁/gi, "東京都庁"],
    [/道庁/gi, "北海道庁"],
    [/赤れんが|赤レンガ/gi, "北海道庁旧本庁舎"]
  ];
  for (const [pattern, replacement] of aliasPairs) {
    if (pattern.test(query)) variants.add(query.replace(pattern, replacement));
  }

  return [...variants].filter(Boolean).slice(0, 8);
}

function searchGazetteer(query: string, currentCenter: LatLngTuple): SearchResult[] {
  const key = searchKey(query);
  if (!key) return [];
  return PLACE_GAZETTEER
    .map<SearchResult | null>((place) => {
      const keys = [place.label, place.detail ?? "", ...place.aliases].map(searchKey);
      const match = keys.some((candidate) => candidate.includes(key) || key.includes(candidate));
      if (!match) return null;
      const distanceBoost = Math.max(0, 0.08 - distanceKm(currentCenter, [place.lat, place.lng]) / 8000);
      return {
        id: crypto.randomUUID() as string,
        label: place.label,
        lat: place.lat,
        lng: place.lng,
        source: "gazetteer" as const,
        detail: place.detail,
        confidence: Math.min(1, (place.confidence ?? 0.85) + distanceBoost)
      };
    })
    .filter((result): result is SearchResult => Boolean(result));
}

async function searchNominatimVariants(queries: string[], currentCenter: LatLngTuple): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  for (const query of queries.slice(0, 4)) {
    try {
      // Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
      // 本格運用では専用ジオコーダ、自治体住所辞書、またはサーバー側キャッシュとレート制御を推奨します。
      const params = new URLSearchParams({
        format: "jsonv2",
        limit: "5",
        addressdetails: "1",
        namedetails: "1",
        "accept-language": "ja",
        countrycodes: "jp",
        q: query
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) continue;
      const json = (await response.json()) as NominatimResult[];
      results.push(...json.map((item) => toSearchResult(item, currentCenter)));
      if (results.length >= 8) break;
    } catch {
      continue;
    }
  }
  return results;
}

function toSearchResult(item: NominatimResult, currentCenter: LatLngTuple): SearchResult {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  const importance = item.importance ?? 0.4;
  const proximity = Math.max(0, 0.15 - distanceKm(currentCenter, [lat, lng]) / 6000);
  return {
    id: crypto.randomUUID(),
    label: item.display_name,
    lat,
    lng,
    source: "nominatim",
    detail: [item.class, item.type].filter(Boolean).join(" / "),
    confidence: Math.min(0.99, importance + proximity),
    bounds: parseBounds(item.boundingbox)
  };
}

function parseCoordinate(value: string): { lat: number; lng: number; detail: string } | null {
  const normalized = normalizeSearchText(value);
  const mapsMatch = normalized.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ?? normalized.match(/[?&](?:q|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (mapsMatch) return coordFromNumbers(Number(mapsMatch[1]), Number(mapsMatch[2]), "URLから座標を抽出");

  const dms = parseDms(normalized);
  if (dms) return dms;

  const numbers = normalized.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];
  if (numbers.length >= 2) {
    const first = numbers[0];
    const second = numbers[1];
    const latLng = coordFromNumbers(first, second, "緯度,経度として解釈");
    if (latLng) return latLng;
    const lngLat = coordFromNumbers(second, first, "経度,緯度として解釈");
    if (lngLat) return lngLat;
  }
  return null;
}

function parseDms(value: string): { lat: number; lng: number; detail: string } | null {
  const pattern = /(\d{1,3})[°度]\s*(\d{1,2})?[′'分]?\s*(\d{1,2}(?:\.\d+)?)?[″"秒]?\s*([NS北南])?.*?(\d{1,3})[°度]\s*(\d{1,2})?[′'分]?\s*(\d{1,2}(?:\.\d+)?)?[″"秒]?\s*([EW東西])?/i;
  const match = value.match(pattern);
  if (!match) return null;
  const lat = dmsToDecimal(Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0), match[4]);
  const lng = dmsToDecimal(Number(match[5]), Number(match[6] ?? 0), Number(match[7] ?? 0), match[8]);
  return coordFromNumbers(lat, lng, "度分秒を緯度経度に変換");
}

function dmsToDecimal(deg: number, min: number, sec: number, direction?: string): number {
  const sign = /S|W|南|西/i.test(direction ?? "") ? -1 : 1;
  return sign * (deg + min / 60 + sec / 3600);
}

function coordFromNumbers(lat: number, lng: number, detail: string) {
  if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng, detail };
  return null;
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const output: SearchResult[] = [];
  for (const result of results) {
    const key = `${result.label.slice(0, 40)}:${result.lat.toFixed(5)}:${result.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(result);
  }
  return output;
}

function parseBounds(value?: [string, string, string, string]): TileBounds | undefined {
  if (!value) return undefined;
  const [south, north, west, east] = value.map(Number);
  if ([west, south, east, north].some((part) => !Number.isFinite(part))) return undefined;
  return { west, south, east, north };
}

function searchKey(value: string): string {
  return normalizeSearchText(value).toLowerCase().replace(/[,\s・\-_/]/g, "");
}

function distanceKm(a: LatLngTuple, b: LatLngTuple): number {
  const radius = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}
