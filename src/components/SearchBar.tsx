import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, Crosshair, Home, Loader2, Search, MapPin } from "lucide-react";
import { useGisStore } from "../store/useGisStore";
import { useMapRegistry } from "./MapContext";
import type { SearchResult } from "../types";
import { searchPlaces } from "../utils/search";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);
  const searchHistory = useGisStore((state) => state.searchHistory);
  const addSearchHistory = useGisStore((state) => state.addSearchHistory);
  const map = useGisStore((state) => state.map);
  const setMapCenter = useGisStore((state) => state.setMapCenter);
  const setZoom = useGisStore((state) => state.setZoom);
  const registry = useMapRegistry();

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError("");
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void runSearch(trimmed, false);
    }, 450);
    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    await runSearch(trimmed, true);
  }

  async function runSearch(trimmed: string, jumpFirst: boolean) {
    setLoading(true);
    setError("");
    try {
      const found = await searchPlaces(trimmed, map.center);
      setResults(found);
      setOpen(true);
      if (!found.length) {
        setError("候補が見つかりませんでした。地名の一部、都道府県名、駅名、市役所名、または座標を試してください。");
        return;
      }
      if (jumpFirst) jump(found[0]);
    } finally {
      setLoading(false);
    }
  }

  function jump(result: SearchResult) {
    setQuery(result.label);
    setOpen(false);
    setMapCenter([result.lat, result.lng]);
    const zoom = result.bounds ? 14 : result.source === "latlng" ? Math.max(map.zoom, 17) : 15;
    setZoom(zoom);
    registry.flyTo(result.lat, result.lng, zoom);
    addSearchHistory({ ...result, source: result.source === "history" ? "history" : result.source });
  }

  function goHome() {
    const tokyo = { lat: 35.681236, lng: 139.767125 };
    setMapCenter([tokyo.lat, tokyo.lng]);
    setZoom(12);
    registry.flyTo(tokyo.lat, tokyo.lng, 12);
  }

  return (
    <div className="search-shell">
      <form className="search-form" onSubmit={submit}>
        {loading ? <Loader2 size={18} aria-hidden className="spin" /> : <Search size={18} aria-hidden />}
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="地名・住所の一部・駅名・座標・Google Maps URL"
          aria-label="地名・住所の一部・駅名・座標・Google Maps URLを検索"
        />
        <button type="submit" title="検索して地図を移動">
          検索
        </button>
        <button type="button" title="地理院地図が見える日本の初期位置へ戻る" onClick={goHome}>
          <Home size={16} aria-hidden />
          初期位置
        </button>
      </form>
      {open && (results.length || error) ? (
        <div className="search-results" role="listbox" aria-label="検索候補">
          {error ? (
            <div className="search-error">
              <AlertCircle size={15} aria-hidden />
              {error}
            </div>
          ) : null}
          {results.map((result) => (
            <button key={result.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => jump(result)} title={`${result.label}へ移動`}>
              <MapPin size={15} aria-hidden />
              <span>
                <strong>{result.label}</strong>
                <small>{result.detail || sourceLabel(result.source)} / {result.lat.toFixed(5)}, {result.lng.toFixed(5)}</small>
              </span>
              <em>{Math.round((result.confidence ?? 0.5) * 100)}%</em>
            </button>
          ))}
        </div>
      ) : null}
      {searchHistory.length ? (
        <div className="search-history" aria-label="検索履歴">
          {searchHistory.slice(0, 5).map((item) => (
            <button key={item.id} type="button" onClick={() => jump(item)} title={`${item.label}へ移動`}>
              <MapPin size={14} aria-hidden />
              {item.label}
            </button>
          ))}
          <button type="button" onClick={() => jump({ id: crypto.randomUUID(), label: "現在地付近", lat: map.center[0], lng: map.center[1], source: "latlng", detail: "現在の地図中心", confidence: 1 })} title="現在の地図中心を検索履歴に保存">
            <Crosshair size={14} aria-hidden />
            中心を保存
          </button>
        </div>
      ) : null}
    </div>
  );
}

function sourceLabel(source: SearchResult["source"]) {
  return {
    latlng: "座標",
    nominatim: "住所検索",
    gazetteer: "内蔵地名",
    history: "履歴"
  }[source];
}
