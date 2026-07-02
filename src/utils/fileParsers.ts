import Papa from "papaparse";
import * as toGeoJSON from "togeojson";
import type { Feature, FeatureCollection, GeoJsonProperties, Point } from "geojson";
import type { AppLayer } from "../types";
import { defaultStyle } from "../store/useGisStore";

const latKeys = ["lat", "latitude", "緯度", "y", "緯度（世界測地系）", "緯度(世界測地系)"];
const lngKeys = ["lng", "lon", "long", "longitude", "経度", "x", "経度（世界測地系）", "経度(世界測地系)"];

export async function fileToLayer(file: File, order: number): Promise<AppLayer> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const text = await file.text();
  let data: FeatureCollection;
  let type: AppLayer["type"];

  if (extension === "geojson" || extension === "json") {
    data = parseGeoJson(text);
    type = "geojson";
  } else if (extension === "csv") {
    data = parseCsv(text);
    type = "csv";
  } else if (extension === "kml") {
    data = parseKml(text);
    type = "kml";
  } else {
    throw new Error("GeoJSON、CSV、KML のみ読み込めます。");
  }

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type,
    opacity: 1,
    visible: true,
    style: defaultStyle,
    legend: `${data.features.length} features`,
    data,
    order,
    createdAt: new Date().toISOString()
  };
}

function parseGeoJson(text: string): FeatureCollection {
  const parsed = JSON.parse(text);
  if (parsed.type === "FeatureCollection") return parsed;
  if (parsed.type === "Feature") return { type: "FeatureCollection", features: [parsed] };
  throw new Error("GeoJSON FeatureCollection または Feature を指定してください。");
}

function parseKml(text: string): FeatureCollection {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const converted = toGeoJSON.kml(doc) as FeatureCollection;
  return converted;
}

function parseCsv(text: string): FeatureCollection {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0].message);
  }

  const features: Feature<Point, GeoJsonProperties>[] = [];
  for (const row of parsed.data) {
    const latKey = Object.keys(row).find((key) => latKeys.includes(key.trim().toLowerCase()) || latKeys.includes(key.trim()));
    const lngKey = Object.keys(row).find((key) => lngKeys.includes(key.trim().toLowerCase()) || lngKeys.includes(key.trim()));
    if (!latKey || !lngKey) continue;
    const lat = Number(row[latKey]);
    const lng = Number(row[lngKey]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: row
    });
  }

  if (!features.length) {
    throw new Error("CSVから緯度経度列を検出できませんでした。lat/lng、latitude/longitude、緯度/経度などの列名に対応しています。");
  }

  return { type: "FeatureCollection", features };
}
