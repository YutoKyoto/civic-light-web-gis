import { ChangeEvent, useRef, useState } from "react";
import { Eye, EyeOff, GripVertical, Trash2, Upload, ChevronUp, ChevronDown } from "lucide-react";
import { useGisStore } from "../store/useGisStore";
import { fileToLayer } from "../utils/fileParsers";
import { boundsCenter, tileLayerWarnings } from "../utils/externalTiles";
import { useMapRegistry } from "./MapContext";

export function LayerPanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const baseMaps = useGisStore((state) => state.baseMaps);
  const map = useGisStore((state) => state.map);
  const layers = useGisStore((state) => state.layers);
  const setSelectedBaseMap = useGisStore((state) => state.setSelectedBaseMap);
  const setBaseMapOpacity = useGisStore((state) => state.setBaseMapOpacity);
  const addLayer = useGisStore((state) => state.addLayer);
  const updateLayer = useGisStore((state) => state.updateLayer);
  const removeLayer = useGisStore((state) => state.removeLayer);
  const moveLayer = useGisStore((state) => state.moveLayer);
  const setMapCenter = useGisStore((state) => state.setMapCenter);
  const setZoom = useGisStore((state) => state.setZoom);
  const registry = useMapRegistry();
  const [message, setMessage] = useState("");

  async function loadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setMessage("");
    for (const file of files) {
      try {
        const layer = await fileToLayer(file, layers.length);
        addLayer(layer);
        setMessage(`${file.name} を読み込みました。`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "読み込みに失敗しました。");
      }
    }
    event.target.value = "";
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
                <span>透過</span>
                <input type="range" min={0.15} max={1} step={0.05} value={baseMap.opacity} onChange={(event) => setBaseMapOpacity(baseMap.id, Number(event.target.value))} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <h2>主題図レイヤー</h2>
          <button type="button" className="icon-button" title="GeoJSON・CSV・KMLを読み込む" onClick={() => inputRef.current?.click()}>
            <Upload size={17} aria-hidden />
          </button>
          <input ref={inputRef} type="file" multiple accept=".geojson,.json,.csv,.kml" onChange={loadFiles} hidden />
        </div>
        {message ? <p className="notice">{message}</p> : null}
        <div className="layer-list">
          {[...layers].sort((a, b) => b.order - a.order).map((layer) => (
            <article key={layer.id} className="layer-card">
              <div className="layer-title">
                <GripVertical size={16} aria-hidden />
                <span>{layer.name}</span>
                <button type="button" className="icon-button" title={layer.visible ? "非表示にする" : "表示する"} onClick={() => updateLayer(layer.id, { visible: !layer.visible })}>
                  {layer.visible ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
                </button>
              </div>
              <div className="range-row">
                <span>透過</span>
                <input type="range" min={0} max={1} step={0.05} value={layer.opacity} onChange={(event) => updateLayer(layer.id, { opacity: Number(event.target.value) })} />
              </div>
              {layer.type === "tile" && layer.externalTile ? (
                <TileLayerDiagnostics
                  layer={layer}
                  zoom={map.zoom}
                  onZoomToLayer={() => {
                    const center = layer.externalTile?.center ?? (layer.externalTile?.bounds ? boundsCenter(layer.externalTile.bounds) : undefined);
                    if (!center) return;
                    const targetZoom = Math.min(Math.max(map.zoom, layer.externalTile?.minZoom ?? map.zoom), layer.externalTile?.maxZoom ?? map.zoom);
                    setMapCenter(center);
                    setZoom(targetZoom);
                    registry.flyTo(center[0], center[1], targetZoom);
                  }}
                />
              ) : (
                <div className="style-grid">
                  <label title="線色">
                    線
                    <input type="color" value={layer.style.color} onChange={(event) => updateLayer(layer.id, { style: { ...layer.style, color: event.target.value } })} />
                  </label>
                  <label title="塗り色">
                    塗
                    <input type="color" value={layer.style.fillColor} onChange={(event) => updateLayer(layer.id, { style: { ...layer.style, fillColor: event.target.value } })} />
                  </label>
                  <label title="線幅">
                    幅
                    <input type="number" min={1} max={12} value={layer.style.weight} onChange={(event) => updateLayer(layer.id, { style: { ...layer.style, weight: Number(event.target.value) } })} />
                  </label>
                </div>
              )}
              <div className="layer-actions">
                <button type="button" title="表示順を上へ" onClick={() => moveLayer(layer.id, "up")}><ChevronUp size={15} aria-hidden /></button>
                <button type="button" title="表示順を下へ" onClick={() => moveLayer(layer.id, "down")}><ChevronDown size={15} aria-hidden /></button>
                <button type="button" title="レイヤーを削除" onClick={() => removeLayer(layer.id)}><Trash2 size={15} aria-hidden /></button>
              </div>
              {layer.legend ? <p className="legend">{layer.legend}</p> : null}
            </article>
          ))}
          {!layers.length ? <p className="empty">GeoJSON、CSV、KMLを追加するとここに表示されます。</p> : null}
        </div>
      </section>
    </div>
  );
}

interface TileLayerDiagnosticsProps {
  layer: ReturnType<typeof useGisStore.getState>["layers"][number];
  zoom: number;
  onZoomToLayer: () => void;
}

function TileLayerDiagnostics({ layer, zoom, onZoomToLayer }: TileLayerDiagnosticsProps) {
  const config = layer.externalTile;
  const map = useGisStore((state) => state.map);
  const updateLayer = useGisStore((state) => state.updateLayer);
  const setBaseMapOpacity = useGisStore((state) => state.setBaseMapOpacity);
  const setCompareMode = useGisStore((state) => state.setCompareMode);
  const setCompareTileLayerId = useGisStore((state) => state.setCompareTileLayerId);
  if (!config) return null;
  const warnings = [...tileLayerWarnings(layer.visible, layer.opacity, zoom, config), ...(layer.tileDiagnostics?.warnings ?? [])];
  return (
    <div className="tile-diagnostics">
      <dl>
        <div><dt>形式</dt><dd>{config.scheme.toUpperCase()}{config.flipY ? " / Y反転" : ""}</dd></div>
        <div><dt>Zoom</dt><dd>{config.minZoom}-{config.maxZoom}</dd></div>
        <div><dt>エラー</dt><dd>{layer.tileDiagnostics?.errorCount ?? 0}</dd></div>
      </dl>
      {config.center || config.bounds ? (
        <button type="button" onClick={onZoomToLayer} title="保存された中心座標またはbboxへ移動">範囲へ移動</button>
      ) : null}
      <div className="tile-quick-actions">
        <button
          type="button"
          className="primary-mini"
          onClick={() => {
            updateLayer(layer.id, { visible: true, opacity: 1 });
            setBaseMapOpacity(map.selectedBaseMap, 0.35);
            onZoomToLayer();
          }}
          title="表示ON、外部タイル100%、背景を薄くして範囲へ移動"
        >
          重なり確認
        </button>
        <button type="button" onClick={() => updateLayer(layer.id, { visible: true, opacity: 1 })} title="外部タイルを不透明で表示">100%</button>
        <button type="button" onClick={() => updateLayer(layer.id, { visible: true, opacity: 0.6 })} title="外部タイルを60%で表示">60%</button>
        <button type="button" onClick={() => updateLayer(layer.id, { visible: true, opacity: 0.3 })} title="外部タイルを30%で表示">30%</button>
        <button type="button" onClick={() => setBaseMapOpacity(map.selectedBaseMap, 0.35)} title="背景地図を薄くしてオルソ画像を見やすくする">背景薄く</button>
        <button type="button" onClick={() => setBaseMapOpacity(map.selectedBaseMap, 1)} title="背景地図の濃さを戻す">背景戻す</button>
        <button
          type="button"
          onClick={() => {
            setCompareTileLayerId(layer.id);
            setCompareMode(true);
          }}
          title="左を背景地図、右をこの外部タイル重ね合わせで比較"
        >
          比較
        </button>
      </div>
      {warnings.length ? (
        <ul className="diagnostic-list warning">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      {layer.tileDiagnostics?.lastError ? <p className="diagnostic-error">{layer.tileDiagnostics.lastError}</p> : null}
      {layer.tileDiagnostics?.suggestions?.length ? (
        <ul className="diagnostic-list">
          {layer.tileDiagnostics.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
        </ul>
      ) : null}
      {layer.tileDiagnostics?.lastTestUrl ? (
        <details>
          <summary>直近タイルURL</summary>
          <code>{layer.tileDiagnostics.lastTestUrl}</code>
        </details>
      ) : null}
    </div>
  );
}
