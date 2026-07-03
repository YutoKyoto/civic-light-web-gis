import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Focus, GripVertical, Layers, ScanSearch, SplitSquareHorizontal, Trash2 } from "lucide-react";
import { useGisStore } from "../store/useGisStore";
import { boundsCenter, tileLayerWarnings } from "../utils/externalTiles";
import { useMapRegistry } from "./MapContext";

export function LayerPanel() {
  const baseMaps = useGisStore((state) => state.baseMaps);
  const map = useGisStore((state) => state.map);
  const layers = useGisStore((state) => state.layers);
  const setSelectedBaseMap = useGisStore((state) => state.setSelectedBaseMap);
  const setBaseMapOpacity = useGisStore((state) => state.setBaseMapOpacity);
  const updateLayer = useGisStore((state) => state.updateLayer);
  const removeLayer = useGisStore((state) => state.removeLayer);
  const moveLayer = useGisStore((state) => state.moveLayer);
  const setMapCenter = useGisStore((state) => state.setMapCenter);
  const setZoom = useGisStore((state) => state.setZoom);
  const setCompareMode = useGisStore((state) => state.setCompareMode);
  const setCompareTileLayerId = useGisStore((state) => state.setCompareTileLayerId);
  const registry = useMapRegistry();
  const tileLayers = [...layers].filter((layer) => layer.type === "tile").sort((a, b) => b.order - a.order);

  function zoomToLayer(layerId: string) {
    const layer = layers.find((item) => item.id === layerId);
    const config = layer?.externalTile;
    if (!config) return;
    const center = config.center ?? (config.bounds ? boundsCenter(config.bounds) : map.center);
    const targetZoom = Math.min(Math.max(18, config.minZoom), config.maxZoom);
    setMapCenter(center);
    setZoom(targetZoom);
    registry.flyTo(center[0], center[1], targetZoom);
  }

  function inspectLayer(layerId: string) {
    const layer = layers.find((item) => item.id === layerId);
    if (!layer) return;
    updateLayer(layer.id, { visible: true, opacity: 1 });
    setBaseMapOpacity(map.selectedBaseMap, 0.35);
    zoomToLayer(layer.id);
  }

  return (
    <div className="panel-content">
      <section className="panel-section">
        <div className="panel-heading">
          <h2>背景地図</h2>
        </div>
        <div className="layer-list">
          {baseMaps.map((baseMap) => (
            <article key={baseMap.id} className={`layer-card ${map.selectedBaseMap === baseMap.id ? "selected" : ""}`}>
              <label className="layer-title">
                <input type="radio" name="baseMap" checked={map.selectedBaseMap === baseMap.id} onChange={() => setSelectedBaseMap(baseMap.id)} />
                <span>{baseMap.name}</span>
              </label>
              <div className="range-row">
                <span>濃さ {Math.round(baseMap.opacity * 100)}%</span>
                <input type="range" min={0.15} max={1} step={0.05} value={baseMap.opacity} onChange={(event) => setBaseMapOpacity(baseMap.id, Number(event.target.value))} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <h2>オルソ画像</h2>
          <span className="layer-count">
            <Layers size={14} aria-hidden />
            {tileLayers.length}
          </span>
        </div>
        <div className="layer-list">
          {tileLayers.map((layer) => (
            <article key={layer.id} className={`layer-card ortho-card ${layer.visible ? "selected" : ""}`}>
              <div className="layer-title">
                <GripVertical size={16} aria-hidden />
                <span>{layer.name}</span>
                <button type="button" className="icon-button" title={layer.visible ? "非表示にする" : "表示する"} onClick={() => updateLayer(layer.id, { visible: !layer.visible })}>
                  {layer.visible ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
                </button>
              </div>
              <div className="range-row">
                <span>オルソ {Math.round(layer.opacity * 100)}%</span>
                <input type="range" min={0} max={1} step={0.05} value={layer.opacity} onChange={(event) => updateLayer(layer.id, { opacity: Number(event.target.value), visible: true })} />
              </div>
              <TileLayerDiagnostics
                layerId={layer.id}
                onZoomToLayer={() => zoomToLayer(layer.id)}
                onInspect={() => inspectLayer(layer.id)}
                onCompare={() => {
                  setCompareTileLayerId(layer.id);
                  setCompareMode(true);
                }}
              />
              <div className="layer-actions">
                <button type="button" title="表示順を上へ" onClick={() => moveLayer(layer.id, "up")}>
                  <ChevronUp size={15} aria-hidden />
                </button>
                <button type="button" title="表示順を下へ" onClick={() => moveLayer(layer.id, "down")}>
                  <ChevronDown size={15} aria-hidden />
                </button>
                <button type="button" title="レイヤーを削除" onClick={() => removeLayer(layer.id)}>
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            </article>
          ))}
          {!tileLayers.length ? <p className="empty">右パネルにXYZ/TMS URLを貼ると、オルソ画像レイヤーとしてここに追加されます。</p> : null}
        </div>
      </section>
    </div>
  );
}

interface TileLayerDiagnosticsProps {
  layerId: string;
  onZoomToLayer: () => void;
  onInspect: () => void;
  onCompare: () => void;
}

function TileLayerDiagnostics({ layerId, onZoomToLayer, onInspect, onCompare }: TileLayerDiagnosticsProps) {
  const layer = useGisStore((state) => state.layers.find((item) => item.id === layerId));
  const zoom = useGisStore((state) => state.map.zoom);
  const updateLayer = useGisStore((state) => state.updateLayer);
  const map = useGisStore((state) => state.map);
  const setBaseMapOpacity = useGisStore((state) => state.setBaseMapOpacity);
  if (!layer?.externalTile) return null;
  const config = layer.externalTile;
  const warnings = [...tileLayerWarnings(layer.visible, layer.opacity, zoom, config), ...(layer.tileDiagnostics?.warnings ?? [])];
  const metadata = config.metadata;

  async function copyTemplate() {
    await navigator.clipboard?.writeText(config.urlTemplate);
  }

  return (
    <div className="tile-diagnostics">
      <dl>
        <div>
          <dt>形式</dt>
          <dd>{config.scheme.toUpperCase()}{config.flipY ? " / Y反転" : ""}</dd>
        </div>
        <div>
          <dt>Zoom</dt>
          <dd>{config.minZoom}-{config.maxZoom}</dd>
        </div>
        <div>
          <dt>読込/エラー</dt>
          <dd>{layer.tileDiagnostics?.loadedCount ?? 0}/{layer.tileDiagnostics?.errorCount ?? 0}</dd>
        </div>
      </dl>
      {metadata?.provider || metadata?.capturedAt || metadata?.resolution ? (
        <p className="metadata-line">
          {[metadata.provider, metadata.capturedAt, metadata.resolution].filter(Boolean).join(" / ")}
        </p>
      ) : null}
      <div className="tile-quick-actions">
        <button type="button" className="primary-mini" onClick={onInspect} title="表示ON、オルソ100%、背景を薄くして撮影範囲へ移動">
          <ScanSearch size={14} aria-hidden />
          重なり確認
        </button>
        <button type="button" onClick={() => updateLayer(layer.id, { visible: true, opacity: 1 })} title="オルソ画像を100%表示">100%</button>
        <button type="button" onClick={() => updateLayer(layer.id, { visible: true, opacity: 0.65 })} title="オルソ画像を65%表示">65%</button>
        <button type="button" onClick={() => updateLayer(layer.id, { visible: true, opacity: 0.35 })} title="オルソ画像を35%表示">35%</button>
        <button type="button" onClick={() => setBaseMapOpacity(map.selectedBaseMap, 0.35)} title="背景地図を薄くする">背景薄く</button>
        <button type="button" onClick={() => setBaseMapOpacity(map.selectedBaseMap, 1)} title="背景地図を戻す">背景戻す</button>
        <button type="button" onClick={onZoomToLayer} title="保存したbboxまたは中心座標へ移動">
          <Focus size={14} aria-hidden />
          範囲
        </button>
        <button type="button" onClick={onCompare} title="2画面比較を開始">
          <SplitSquareHorizontal size={14} aria-hidden />
          比較
        </button>
        <button type="button" onClick={copyTemplate} title="URLテンプレートをコピー">
          <Copy size={14} aria-hidden />
          URL
        </button>
      </div>
      {warnings.length ? (
        <ul className="diagnostic-list warning">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {layer.tileDiagnostics?.lastError ? <p className="diagnostic-error">{layer.tileDiagnostics.lastError}</p> : null}
      {layer.tileDiagnostics?.suggestions?.length ? (
        <ul className="diagnostic-list">
          {layer.tileDiagnostics.suggestions.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      ) : null}
      {layer.tileDiagnostics?.lastTestUrl ? (
        <details>
          <summary>直近アクセスURL</summary>
          <code>{layer.tileDiagnostics.lastTestUrl}</code>
        </details>
      ) : null}
    </div>
  );
}
