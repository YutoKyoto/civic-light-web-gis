import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleMarker, GeoJSON, MapContainer, Polygon, Polyline, Popup, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import "leaflet.heat";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import { useGisStore } from "../store/useGisStore";
import { layerStyle, measureArea, measureLength, formatArea, formatDistance } from "../utils/geo";
import { fetchGsiElevation } from "../utils/elevation";
import { buildLeafletTileUrl } from "../utils/externalTiles";
import { useMapRegistry } from "./MapContext";

interface MainMapProps {
  mapId: string;
  baseMapOverride?: string;
  sync?: boolean;
  externalTileMode?: "all" | "none" | "only";
  externalTileLayerId?: string;
}

export function MainMap({ mapId, baseMapOverride, sync = true, externalTileMode = "all", externalTileLayerId }: MainMapProps) {
  const mapState = useGisStore((state) => state.map);
  const baseMaps = useGisStore((state) => state.baseMaps);
  const selectedBaseMapId = baseMapOverride ?? mapState.selectedBaseMap;
  const selectedBaseMap = baseMaps.find((baseMap) => baseMap.id === selectedBaseMapId) ?? baseMaps[0];

  return (
    <MapContainer className="leaflet-map" center={mapState.center} zoom={mapState.zoom} zoomControl={false}>
      <TileLayer key={selectedBaseMap.id} url={selectedBaseMap.url} maxZoom={selectedBaseMap.maxZoom} opacity={selectedBaseMap.opacity} attribution={selectedBaseMap.attribution} zIndex={100} />
      <MapLifecycle mapId={mapId} sync={sync} />
      <LayerRenderer externalTileMode={externalTileMode} externalTileLayerId={externalTileLayerId} />
      <DrawingRenderer />
      <AnalysisRenderer />
      <DrawingController />
      <OverlayStatus externalTileMode={externalTileMode} externalTileLayerId={externalTileLayerId} />
    </MapContainer>
  );
}

function MapLifecycle({ mapId, sync }: { mapId: string; sync: boolean }) {
  const map = useMap();
  const registry = useMapRegistry();
  const setMapCenter = useGisStore((state) => state.setMapCenter);
  const setZoom = useGisStore((state) => state.setZoom);
  const setStatusCoordinate = useGisStore((state) => state.setStatusCoordinate);

  useEffect(() => {
    registry.setMap(mapId, map);
    return () => registry.setMap(mapId, undefined);
  }, [map, mapId, registry]);

  useMapEvents({
    moveend(event) {
      if (!sync) return;
      const current = event.target as L.Map;
      const center = current.getCenter();
      setMapCenter([center.lat, center.lng]);
      setZoom(current.getZoom());
    },
    mousemove(event) {
      setStatusCoordinate([event.latlng.lat, event.latlng.lng]);
    },
    mouseout() {
      setStatusCoordinate(undefined);
    }
  });

  return null;
}

function LayerRenderer({ externalTileMode, externalTileLayerId }: { externalTileMode: "all" | "none" | "only"; externalTileLayerId?: string }) {
  const layers = useGisStore((state) => state.layers);
  const updateLayer = useGisStore((state) => state.updateLayer);
  const visibleLayers = useMemo(() => [...layers].filter((layer) => layer.visible).sort((a, b) => a.order - b.order), [layers]);

  return (
    <>
      {visibleLayers.map((layer) => {
        if (layer.type === "tile" && layer.externalTile) {
          if (externalTileMode === "none") return null;
          if (externalTileMode === "only" && layer.id !== externalTileLayerId) return null;
          const config = layer.externalTile;
          const tms = config.scheme === "tms" || config.flipY;
          return (
            <Fragment key={`${layer.id}-${layer.opacity}-${config.urlTemplate}-${tms}`}>
            <TileLayer
              url={buildLeafletTileUrl(config)}
              opacity={layer.opacity}
              minZoom={config.minZoom}
              maxZoom={config.maxZoom}
              tms={tms}
              attribution={config.attribution}
              zIndex={650 + layer.order}
              className="external-tile-layer"
              eventHandlers={{
                tileload: (event) => {
                  const image = event.tile as HTMLImageElement;
                  const url = image.currentSrc || image.src;
                  updateLayer(layer.id, {
                    tileDiagnostics: {
                      status: "ok",
                      errorCount: layer.tileDiagnostics?.errorCount ?? 0,
                      loadedCount: (layer.tileDiagnostics?.loadedCount ?? 0) + 1,
                      lastTestUrl: url,
                      lastCheckedAt: new Date().toISOString(),
                      warnings: layer.tileDiagnostics?.warnings ?? [],
                      suggestions: layer.tileDiagnostics?.suggestions ?? []
                    }
                  });
                },
                tileerror: (event) => {
                  const image = event.tile as HTMLImageElement;
                  const url = image.currentSrc || image.src;
                  updateLayer(layer.id, {
                    tileDiagnostics: {
                      status: "error",
                      errorCount: (layer.tileDiagnostics?.errorCount ?? 0) + 1,
                      loadedCount: layer.tileDiagnostics?.loadedCount ?? 0,
                      lastTestUrl: url,
                      lastError: "地図表示中にタイル読み込みエラーが発生しました。",
                      lastCheckedAt: new Date().toISOString(),
                      warnings: layer.tileDiagnostics?.warnings ?? [],
                      suggestions: [
                        "現在地がタイル提供範囲外の可能性があります。",
                        "ズーム範囲、TMS/Y反転、認証、404、Mixed Content、CORS/リファラ制限を確認してください。"
                      ]
                    }
                  });
                }
              }}
            />
            {config.bounds ? (
              <Rectangle
                bounds={[
                  [config.bounds.south, config.bounds.west],
                  [config.bounds.north, config.bounds.east]
                ]}
                pathOptions={{ color: "#facc15", weight: 3, opacity: 0.95, fillColor: "#facc15", fillOpacity: 0.06, dashArray: "8 6" }}
              >
                <Tooltip sticky>{layer.name} の表示範囲</Tooltip>
              </Rectangle>
            ) : null}
            </Fragment>
          );
        }

        if (!layer.data) return null;
        return (
          <GeoJSON
            key={`${layer.id}-${layer.opacity}-${JSON.stringify(layer.style)}`}
            data={layer.data as FeatureCollection}
            pointToLayer={(_, latlng) => L.circleMarker(latlng, layerStyle(layer.style, layer.opacity))}
            style={() => layerStyle(layer.style, layer.opacity)}
            onEachFeature={(feature, leafletLayer) => {
              leafletLayer.bindPopup(propertiesHtml(feature.properties ?? {}, layer.name));
            }}
          />
        );
      })}
    </>
  );
}

function OverlayStatus({ externalTileMode, externalTileLayerId }: { externalTileMode: "all" | "none" | "only"; externalTileLayerId?: string }) {
  const zoom = useGisStore((state) => state.map.zoom);
  const layers = useGisStore((state) => state.layers);
  const visibleTiles = layers.filter((layer) => {
    if (!layer.visible || layer.type !== "tile" || !layer.externalTile) return false;
    if (externalTileMode === "none") return false;
    if (externalTileMode === "only" && layer.id !== externalTileLayerId) return false;
    return true;
  });

  if (!visibleTiles.length) return null;

  return (
    <div className="map-overlay-status" aria-label="外部タイル表示状態">
      {visibleTiles.map((layer) => {
        const diagnostics = layer.tileDiagnostics;
        const config = layer.externalTile;
        const zoomWarning = config && (zoom < config.minZoom || zoom > config.maxZoom);
        return (
          <div key={layer.id} className={`overlay-status-item ${diagnostics?.status ?? "unchecked"}`}>
            <strong>{layer.name}</strong>
            <span>読込 {diagnostics?.loadedCount ?? 0} / エラー {diagnostics?.errorCount ?? 0}</span>
            {zoomWarning ? <em>ズーム範囲外 {config?.minZoom}-{config?.maxZoom}</em> : null}
            {diagnostics?.lastTestUrl ? <small>{diagnostics.lastTestUrl}</small> : null}
          </div>
        );
      })}
    </div>
  );
}

function DrawingRenderer() {
  const drawings = useGisStore((state) => state.drawings);
  const removeDrawing = useGisStore((state) => state.removeDrawing);
  const duplicateDrawing = useGisStore((state) => state.duplicateDrawing);

  return (
    <>
      {drawings.map((drawing) => {
        const style = layerStyle(drawing.style, 1);
        const menu = (
          <Popup>
            <strong>{drawing.properties?.label ?? "作図フィーチャ"}</strong>
            <div className="popup-actions">
              <button type="button" onClick={() => duplicateDrawing(drawing.id)}>複製</button>
              <button type="button" onClick={() => removeDrawing(drawing.id)}>削除</button>
            </div>
            <pre>{JSON.stringify(drawing.properties ?? {}, null, 2)}</pre>
          </Popup>
        );
        if (drawing.geometry.type === "Point") {
          const [lng, lat] = drawing.geometry.coordinates;
          return (
            <CircleMarker key={drawing.id} center={[lat, lng]} pathOptions={style} radius={drawing.style.radius}>
              {menu}
              {drawing.properties?.label ? <Tooltip permanent>{drawing.properties.label}</Tooltip> : null}
            </CircleMarker>
          );
        }
        if (drawing.geometry.type === "LineString") {
          return (
            <Polyline key={drawing.id} positions={coordsToLatLng(drawing.geometry.coordinates)} pathOptions={style}>
              {menu}
              {drawing.properties?.label ? <Tooltip sticky>{drawing.properties.label}</Tooltip> : null}
            </Polyline>
          );
        }
        if (drawing.geometry.type === "Polygon") {
          const ring = drawing.geometry.coordinates[0] ?? [];
          if (drawing.properties?.kind === "circle" && drawing.properties.radiusMeters) {
            const center = polygonCenterLatLng(drawing.geometry);
            return (
              <Circle key={drawing.id} center={center} radius={drawing.properties.radiusMeters} pathOptions={style}>
                {menu}
              </Circle>
            );
          }
          if (drawing.properties?.kind === "rectangle") {
            const latlngs = coordsToLatLng(ring);
            const bounds = L.latLngBounds(latlngs as L.LatLngExpression[]);
            return (
              <Rectangle key={drawing.id} bounds={bounds} pathOptions={style}>
                {menu}
              </Rectangle>
            );
          }
          return (
            <Polygon key={drawing.id} positions={coordsToLatLng(ring)} pathOptions={style}>
              {menu}
              {drawing.properties?.label ? <Tooltip sticky>{drawing.properties.label}</Tooltip> : null}
            </Polygon>
          );
        }
        return null;
      })}
    </>
  );
}

function AnalysisRenderer() {
  const results = useGisStore((state) => state.analysisResults);
  return (
    <>
      {results.map((result) =>
        result.type === "heatmap" ? (
          <HeatLayer key={result.id} data={result.resultGeoJSON} />
        ) : (
          <GeoJSON
            key={result.id}
            data={result.resultGeoJSON}
            pointToLayer={(_, latlng) => L.circleMarker(latlng, { radius: 7, color: "#ef4444", fillColor: "#f97316", fillOpacity: 0.45 })}
            style={() => ({ color: "#dc2626", fillColor: "#f97316", weight: 2, opacity: 0.9, fillOpacity: 0.25 })}
            onEachFeature={(feature, layer) => layer.bindPopup(propertiesHtml(feature.properties ?? {}, `解析結果: ${result.type}`))}
          />
        )
      )}
    </>
  );
}

function HeatLayer({ data }: { data: FeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    const latlngs = data.features
      .filter((feature): feature is Feature<Point> => feature.geometry?.type === "Point")
      .map((feature) => [feature.geometry.coordinates[1], feature.geometry.coordinates[0], Number(feature.properties?.weight ?? 0.7)] as [number, number, number]);
    const layer = L.heatLayer(latlngs, { radius: 28, blur: 22, maxZoom: 17, minOpacity: 0.35 });
    layer.addTo(map);
    return () => {
      layer.removeFrom(map);
    };
  }, [data, map]);
  return null;
}

function DrawingController() {
  const map = useMap();
  const activeTool = useGisStore((state) => state.activeTool);
  const addDrawing = useGisStore((state) => state.addDrawing);
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [measureText, setMeasureText] = useState("");
  const clickStart = useRef<L.LatLng | null>(null);

  useEffect(() => {
    setPoints([]);
    setMeasureText("");
    clickStart.current = null;
  }, [activeTool]);

  useMapEvents({
    async click(event) {
      if (activeTool === "select") {
        try {
          const elevation = await fetchGsiElevation(event.latlng.lat, event.latlng.lng);
          L.popup()
            .setLatLng(event.latlng)
            .setContent(`緯度: ${event.latlng.lat.toFixed(6)}<br/>経度: ${event.latlng.lng.toFixed(6)}<br/>標高: ${elevation.elevation ?? "不明"} m`)
            .openOn(map);
        } catch {
          L.popup().setLatLng(event.latlng).setContent(`緯度: ${event.latlng.lat.toFixed(6)}<br/>経度: ${event.latlng.lng.toFixed(6)}`).openOn(map);
        }
        return;
      }

      if (activeTool === "point" || activeTool === "text") {
        const label = activeTool === "text" ? window.prompt("ラベルを入力してください", "テキスト") ?? "テキスト" : window.prompt("点のラベル", "ポイント") ?? "ポイント";
        addDrawing({
          id: crypto.randomUUID(),
          geometry: { type: "Point", coordinates: [event.latlng.lng, event.latlng.lat] },
          properties: { label, kind: activeTool },
          style: activeTool === "text" ? { color: "#111827", fillColor: "#facc15", weight: 2, opacity: 1, fillOpacity: 0.9, radius: 5 } : { color: "#2563eb", fillColor: "#60a5fa", weight: 2, opacity: 0.95, fillOpacity: 0.75, radius: 7 }
        });
        return;
      }

      if (activeTool === "line" || activeTool === "measure-distance") {
        const next = [...points, event.latlng];
        setPoints(next);
        if (next.length >= 2) {
          const feature = lineFeature(next);
          setMeasureText(`距離: ${formatDistance(measureLength(feature))}`);
        }
        if (event.originalEvent.detail >= 2 && next.length >= 2) {
          addDrawing({
            id: crypto.randomUUID(),
            geometry: lineFeature(next).geometry,
            properties: { label: activeTool === "measure-distance" ? measureText : "ライン", kind: activeTool },
            style: { color: activeTool === "measure-distance" ? "#dc2626" : "#0891b2", fillColor: "#0891b2", weight: 4, opacity: 0.9, fillOpacity: 0.2, radius: 7 }
          });
          setPoints([]);
          setMeasureText("");
        }
        return;
      }

      if (activeTool === "polygon" || activeTool === "measure-area") {
        const next = [...points, event.latlng];
        setPoints(next);
        if (next.length >= 3) {
          const feature = polygonFeature(next);
          setMeasureText(`面積: ${formatArea(measureArea(feature))} / 周囲長: ${formatDistance(measureLength(feature))}`);
        }
        if (event.originalEvent.detail >= 2 && next.length >= 3) {
          const feature = polygonFeature(next);
          addDrawing({
            id: crypto.randomUUID(),
            geometry: feature.geometry,
            properties: { label: activeTool === "measure-area" ? measureText : "ポリゴン", kind: activeTool },
            style: { color: activeTool === "measure-area" ? "#b45309" : "#16a34a", fillColor: activeTool === "measure-area" ? "#f59e0b" : "#22c55e", weight: 3, opacity: 0.9, fillOpacity: 0.25, radius: 7 }
          });
          setPoints([]);
          setMeasureText("");
        }
        return;
      }

      if (activeTool === "circle" || activeTool === "rectangle") {
        if (!clickStart.current) {
          clickStart.current = event.latlng;
          return;
        }
        const start = clickStart.current;
        const end = event.latlng;
        if (activeTool === "circle") {
          const radius = start.distanceTo(end);
          addDrawing({
            id: crypto.randomUUID(),
            geometry: circleApproxFeature(start, radius).geometry,
            properties: { label: `円 ${Math.round(radius)}m`, kind: "circle", radiusMeters: radius },
            style: { color: "#7c3aed", fillColor: "#a78bfa", weight: 3, opacity: 0.9, fillOpacity: 0.22, radius: 7 }
          });
        } else {
          addDrawing({
            id: crypto.randomUUID(),
            geometry: rectangleFeature(start, end).geometry,
            properties: { label: "矩形", kind: "rectangle" },
            style: { color: "#0f766e", fillColor: "#2dd4bf", weight: 3, opacity: 0.9, fillOpacity: 0.22, radius: 7 }
          });
        }
        clickStart.current = null;
      }
    },
    contextmenu() {
      setPoints([]);
      setMeasureText("");
      clickStart.current = null;
    }
  });

  return (
    <>
      {(activeTool === "line" || activeTool === "measure-distance") && points.length > 0 ? <Polyline positions={points} pathOptions={{ color: "#ef4444", dashArray: "6 6" }} /> : null}
      {(activeTool === "polygon" || activeTool === "measure-area") && points.length > 0 ? <Polygon positions={points} pathOptions={{ color: "#f97316", dashArray: "6 6", fillOpacity: 0.12 }} /> : null}
      {measureText && points[points.length - 1] ? (
        <Tooltip direction="top" permanent position={points[points.length - 1]}>
          {measureText}
        </Tooltip>
      ) : null}
    </>
  );
}

function propertiesHtml(properties: Record<string, unknown>, title: string) {
  const rows = Object.entries(properties)
    .filter(([key]) => !key.startsWith("_"))
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value ?? ""))}</td></tr>`)
    .join("");
  return `<div class="popup-table"><strong>${escapeHtml(title)}</strong><table>${rows || "<tr><td>属性なし</td></tr>"}</table></div>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

function coordsToLatLng(coords: number[][]): LatLngExpression[] {
  return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
}

function lineFeature(points: L.LatLng[]): Feature<Geometry> {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: points.map((point) => [point.lng, point.lat]) },
    properties: {}
  };
}

function polygonFeature(points: L.LatLng[]): Feature<Geometry> {
  const coordinates = points.map((point) => [point.lng, point.lat]);
  coordinates.push(coordinates[0]);
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coordinates] },
    properties: {}
  };
}

function rectangleFeature(start: L.LatLng, end: L.LatLng): Feature<Geometry> {
  const west = Math.min(start.lng, end.lng);
  const east = Math.max(start.lng, end.lng);
  const south = Math.min(start.lat, end.lat);
  const north = Math.max(start.lat, end.lat);
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]]
    },
    properties: {}
  };
}

function circleApproxFeature(center: L.LatLng, radiusMeters: number): Feature<Geometry> {
  const points: number[][] = [];
  const earthRadius = 6378137;
  for (let i = 0; i <= 64; i += 1) {
    const angle = (i / 64) * Math.PI * 2;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const lat = center.lat + (dy / earthRadius) * (180 / Math.PI);
    const lng = center.lng + (dx / (earthRadius * Math.cos((Math.PI * center.lat) / 180))) * (180 / Math.PI);
    points.push([lng, lat]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [points] }, properties: {} };
}

function polygonCenterLatLng(geometry: Extract<Geometry, { type: "Polygon" }>): [number, number] {
  const ring = geometry.coordinates[0] ?? [];
  const lat = ring.reduce((sum: number, point: number[]) => sum + point[1], 0) / Math.max(ring.length, 1);
  const lng = ring.reduce((sum: number, point: number[]) => sum + point[0], 0) / Math.max(ring.length, 1);
  return [lat, lng];
}
