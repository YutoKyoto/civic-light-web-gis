import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, MapPinned, TriangleAlert } from "lucide-react";
import type { ExternalTileConfig, TileBounds } from "../types";
import { useGisStore, defaultStyle } from "../store/useGisStore";
import { boundsCenter, normalizeTileTemplate, previewTile, validateTileTemplate } from "../utils/externalTiles";
import type { TilePreviewResult } from "../utils/externalTiles";
import { useMapRegistry } from "./MapContext";

const sampleUrl = "https://example.com/tiles/{z}/{x}/{y}";
const oamSampleUrl = "https://tiles.openaerialmap.org/6a374b43339a46ab3a858fe0/0/6a374b43339a46ab3a858fe1/{z}/{x}/{y}";

export function ExternalTilePanel() {
  const map = useGisStore((state) => state.map);
  const layers = useGisStore((state) => state.layers);
  const addLayer = useGisStore((state) => state.addLayer);
  const setMapCenter = useGisStore((state) => state.setMapCenter);
  const setZoom = useGisStore((state) => state.setZoom);
  const setCompareMode = useGisStore((state) => state.setCompareMode);
  const setCompareBaseMapId = useGisStore((state) => state.setCompareBaseMapId);
  const setCompareTileLayerId = useGisStore((state) => state.setCompareTileLayerId);
  const setSelectedBaseMap = useGisStore((state) => state.setSelectedBaseMap);
  const setBaseMapOpacity = useGisStore((state) => state.setBaseMapOpacity);
  const registry = useMapRegistry();

  const [name, setName] = useState("ドローンオルソ画像");
  const [urlTemplate, setUrlTemplate] = useState("");
  const [attribution, setAttribution] = useState("");
  const [minZoom, setMinZoom] = useState(0);
  const [maxZoom, setMaxZoom] = useState(22);
  const [opacity, setOpacity] = useState(0.85);
  const [scheme, setScheme] = useState<"xyz" | "tms">("xyz");
  const [flipY, setFlipY] = useState(false);
  const [centerText, setCenterText] = useState("");
  const [bboxText, setBboxText] = useState("");
  const [provider, setProvider] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [resolution, setResolution] = useState("");
  const [preview, setPreview] = useState<TilePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const config = useMemo<ExternalTileConfig>(() => {
    const bounds = parseBounds(bboxText);
    const center = parseCenter(centerText);
    return {
      urlTemplate: normalizeTileTemplate(urlTemplate),
      attribution: attribution.trim(),
      minZoom,
      maxZoom,
      scheme,
      flipY,
      bounds,
      center,
      metadata: {
        provider: provider.trim() || undefined,
        capturedAt: capturedAt.trim() || undefined,
        resolution: resolution.trim() || undefined
      }
    };
  }, [attribution, bboxText, capturedAt, centerText, flipY, maxZoom, minZoom, provider, resolution, scheme, urlTemplate]);

  const validation = useMemo(() => validateTileTemplate(config), [config]);

  async function runPreview(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await previewTile(config, map.center, map.zoom);
      if (result.discoveredBounds && !bboxText.trim()) {
        const { west, south, east, north } = result.discoveredBounds;
        setBboxText(`${west.toFixed(8)},${south.toFixed(8)},${east.toFixed(8)},${north.toFixed(8)}`);
        const center = boundsCenter(result.discoveredBounds);
        setCenterText(`${center[0].toFixed(8)},${center[1].toFixed(8)}`);
      }
      setPreview(result);
      setMessage(result.ok ? "プレビューに成功しました。このURLは画像タイルとして読み込めました。" : "プレビューに失敗しました。原因候補を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  function addExternalTile() {
    const diagnostics = preview?.diagnostics ?? validation;
    if (validation.status === "error") {
      setMessage(validation.lastError ?? "URLテンプレートを修正してください。");
      return;
    }
    const id = crypto.randomUUID();
    addLayer({
      id,
      name: name.trim() || "外部タイル",
      type: "tile",
      sourceUrl: config.urlTemplate,
      opacity,
      visible: true,
      style: defaultStyle,
      legend: `${config.scheme.toUpperCase()} tile ${config.minZoom}-${config.maxZoom}`,
      externalTile: config,
      tileDiagnostics: {
        ...diagnostics,
        status: preview?.ok ? diagnostics.status : diagnostics.status === "unchecked" ? "warning" : diagnostics.status,
        suggestions: preview?.ok
          ? diagnostics.suggestions
          : [...diagnostics.suggestions, "プレビュー未実行または未成功です。表示されない場合はプレビューURLとTMS/Y反転を確認してください。"]
      },
      order: layers.length,
      createdAt: new Date().toISOString()
    });
    setCompareTileLayerId(id);
    setBaseMapOpacity(map.selectedBaseMap, 0.55);
    const center = config.center ?? (config.bounds ? boundsCenter(config.bounds) : preview?.previewCenter);
    if (center) {
      const targetZoom = Math.min(Math.max(18, config.minZoom), config.maxZoom);
      setMapCenter(center);
      setZoom(targetZoom);
      registry.flyTo(center[0], center[1], targetZoom);
    }
    setMessage("外部タイルを追加しました。表示ON、背景を薄め、範囲中心へ移動しました。");
  }

  function zoomToTileArea() {
    const center = config.center ?? (config.bounds ? boundsCenter(config.bounds) : map.center);
    const targetZoom = Math.min(Math.max(map.zoom, config.minZoom), config.maxZoom);
    setMapCenter(center);
    setZoom(targetZoom);
    registry.flyTo(center[0], center[1], targetZoom);
  }

  function startDroneCompare() {
    setSelectedBaseMap("gsi-standard");
    setCompareBaseMapId("gsi-photo");
    const newestTile = [...layers].reverse().find((layer) => layer.type === "tile");
    if (newestTile) setCompareTileLayerId(newestTile.id);
    setCompareMode(true);
    setMessage("2画面比較を有効化しました。左は地理院地図、右は比較背景に選択ドローンタイルを重ねます。");
  }

  function useOamSample() {
    setName("OpenAerialMap オルソ画像");
    setUrlTemplate(oamSampleUrl);
    setAttribution("OpenAerialMap / HOT OAM");
    setMinZoom(0);
    setMaxZoom(22);
    setOpacity(0.9);
    setScheme("xyz");
    setFlipY(false);
    setMessage("OpenAerialMapのURLを入力しました。プレビューを押すとbboxを自動取得します。");
  }

  return (
    <section className="panel-section external-tile-section">
      <div className="panel-heading">
        <h2>外部タイル追加</h2>
      </div>
      <form className="external-tile-form" onSubmit={runPreview}>
        <label className="field">
          レイヤー名
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例: OAM drone orthophoto" />
        </label>
        <label className="field">
          XYZ/TMS URL
          <input
            value={urlTemplate}
            onChange={(event) => setUrlTemplate(event.target.value)}
            onBlur={() => setUrlTemplate((current) => normalizeTileTemplate(current))}
            placeholder={sampleUrl}
          />
        </label>
        <button type="button" className="wide-action subtle" onClick={useOamSample} title="指定されたOpenAerialMap URLを入力">
          このOAMリンクを使う
        </button>
        <label className="field">
          出典表記
          <input value={attribution} onChange={(event) => setAttribution(event.target.value)} placeholder="例: OpenAerialMap / Provider name" />
        </label>
        <div className="compact-grid">
          <label className="field">
            Min Z
            <input type="number" min={0} max={30} value={minZoom} onChange={(event) => setMinZoom(Number(event.target.value))} />
          </label>
          <label className="field">
            Max Z
            <input type="number" min={0} max={30} value={maxZoom} onChange={(event) => setMaxZoom(Number(event.target.value))} />
          </label>
          <label className="field">
            透過
            <input type="number" min={0} max={1} step={0.05} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} />
          </label>
        </div>
        <div className="segmented-row" role="group" aria-label="タイル形式">
          <button type="button" className={scheme === "xyz" ? "active" : ""} onClick={() => setScheme("xyz")}>XYZ</button>
          <button type="button" className={scheme === "tms" ? "active" : ""} onClick={() => setScheme("tms")}>TMS</button>
          <label className="toggle-inline">
            <input type="checkbox" checked={flipY} onChange={(event) => setFlipY(event.target.checked)} />
            Y反転
          </label>
        </div>
        <details className="advanced-fields">
          <summary>範囲・メタデータ</summary>
          <label className="field">
            中心座標 lat,lng
            <input value={centerText} onChange={(event) => setCenterText(event.target.value)} placeholder="例: 35.681236,139.767125" />
          </label>
          <label className="field">
            bbox west,south,east,north
            <input value={bboxText} onChange={(event) => setBboxText(event.target.value)} placeholder="例: 139.70,35.62,139.82,35.74" />
          </label>
          <div className="compact-grid">
            <label className="field">
              提供者
              <input value={provider} onChange={(event) => setProvider(event.target.value)} />
            </label>
            <label className="field">
              撮影日
              <input value={capturedAt} onChange={(event) => setCapturedAt(event.target.value)} />
            </label>
            <label className="field">
              解像度
              <input value={resolution} onChange={(event) => setResolution(event.target.value)} />
            </label>
          </div>
        </details>

        <div className="button-row">
          <button type="submit" title="現在の地図中心とズームから1枚のタイルURLを生成して読み込みテスト">
            {loading ? <Loader2 size={16} aria-hidden className="spin" /> : <ImagePlus size={16} aria-hidden />}
            プレビュー
          </button>
          <button type="button" onClick={addExternalTile} title="検証結果を保存し、表示ONでレイヤーパネルへ追加">
            <CheckCircle2 size={16} aria-hidden />
            追加
          </button>
          <button type="button" onClick={zoomToTileArea} title="中心座標またはbboxへ移動">
            <MapPinned size={16} aria-hidden />
            範囲へ移動
          </button>
        </div>
        <button type="button" className="wide-action" onClick={startDroneCompare} title="地理院標準地図と航空写真を左右にした比較モードを開始">
          地理院地図と比較
        </button>
      </form>

      <ValidationView diagnostics={validation} />
      {preview ? <PreviewView preview={preview} /> : null}
      {message ? <p className={preview?.ok ? "notice" : "notice"}>{message}</p> : null}
    </section>
  );
}

function ValidationView({ diagnostics }: { diagnostics: ReturnType<typeof validateTileTemplate> }) {
  if (diagnostics.status === "unchecked" && !diagnostics.warnings.length) return null;
  return (
    <div className={`validation-box ${diagnostics.status}`}>
      <strong>{diagnostics.status === "error" ? "URL検証エラー" : "URL検証メモ"}</strong>
      {diagnostics.lastError ? <p>{diagnostics.lastError}</p> : null}
      <ul>
        {[...diagnostics.warnings, ...diagnostics.suggestions].map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function PreviewView({ preview }: { preview: TilePreviewResult }) {
  return (
    <div className={`tile-preview ${preview.ok ? "ok" : "error"}`}>
      <div className="preview-heading">
        {preview.ok ? <CheckCircle2 size={16} aria-hidden /> : <TriangleAlert size={16} aria-hidden />}
        <strong>{preview.ok ? "プレビュー成功" : "プレビュー失敗"}</strong>
      </div>
      <dl>
        <div><dt>z/x/y</dt><dd>{preview.tile.z}/{preview.tile.x}/{preview.tile.requestedY}</dd></div>
        <div><dt>XYZ Y</dt><dd>{preview.tile.y}</dd></div>
      </dl>
      {preview.imageDataUrl ? <img src={preview.imageDataUrl} alt="外部タイルプレビュー" /> : null}
      {preview.diagnostics.lastError ? <p className="diagnostic-error">{preview.diagnostics.lastError}</p> : null}
      {preview.discoveredBounds ? (
        <p className="hint">
          OAM bbox: {preview.discoveredBounds.west.toFixed(6)}, {preview.discoveredBounds.south.toFixed(6)}, {preview.discoveredBounds.east.toFixed(6)}, {preview.discoveredBounds.north.toFixed(6)}
        </p>
      ) : null}
      <details open>
        <summary>試したURL</summary>
        <code>{preview.url}</code>
      </details>
      {preview.diagnostics.suggestions.length ? (
        <ul className="diagnostic-list">
          {preview.diagnostics.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function parseCenter(value: string) {
  const parts = value.split(/[,\s]+/).map(Number).filter(Number.isFinite);
  if (parts.length < 2) return undefined;
  const [lat, lng] = parts;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return [lat, lng] as [number, number];
}

function parseBounds(value: string): TileBounds | undefined {
  const parts = value.split(/[,\s]+/).map(Number).filter(Number.isFinite);
  if (parts.length < 4) return undefined;
  const [west, south, east, north] = parts;
  if ([west, east].some((lng) => Math.abs(lng) > 180) || [south, north].some((lat) => Math.abs(lat) > 90)) return undefined;
  if (west >= east || south >= north) return undefined;
  return { west, south, east, north };
}
