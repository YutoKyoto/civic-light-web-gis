import { Fragment, useEffect, useMemo } from "react";
import { MapContainer, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useGisStore } from "../store/useGisStore";
import { buildLeafletTileUrl, isCenterInsideBounds } from "../utils/externalTiles";
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
      <TileLayer
        key={selectedBaseMap.id}
        url={selectedBaseMap.url}
        maxZoom={selectedBaseMap.maxZoom}
        opacity={selectedBaseMap.opacity}
        attribution={selectedBaseMap.attribution}
        zIndex={100}
      />
      <MapLifecycle mapId={mapId} sync={sync} />
      <OrthophotoLayerRenderer externalTileMode={externalTileMode} externalTileLayerId={externalTileLayerId} />
      <OrthophotoStatus externalTileMode={externalTileMode} externalTileLayerId={externalTileLayerId} />
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
    },
    click(event) {
      L.popup()
        .setLatLng(event.latlng)
        .setContent(`緯度 ${event.latlng.lat.toFixed(7)}<br/>経度 ${event.latlng.lng.toFixed(7)}`)
        .openOn(map);
    }
  });

  return null;
}

function OrthophotoLayerRenderer({ externalTileMode, externalTileLayerId }: { externalTileMode: "all" | "none" | "only"; externalTileLayerId?: string }) {
  const layers = useGisStore((state) => state.layers);
  const updateLayer = useGisStore((state) => state.updateLayer);
  const visibleLayers = useMemo(
    () =>
      [...layers]
        .filter((layer) => layer.visible && layer.type === "tile" && layer.externalTile)
        .sort((a, b) => a.order - b.order),
    [layers]
  );

  if (externalTileMode === "none") return null;

  return (
    <>
      {visibleLayers.map((layer) => {
        if (!layer.externalTile) return null;
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
                        "撮影範囲外を見ている、ズーム範囲外、TMS/Y反転違い、URLパターン違いが主な候補です。",
                        "レイヤーパネルの「重なり確認」または「範囲へ移動」を試してください。"
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
                pathOptions={{ color: "#f59e0b", weight: 3, opacity: 0.95, fillColor: "#f59e0b", fillOpacity: 0.05, dashArray: "8 6" }}
              >
                <Tooltip sticky>{layer.name} の撮影範囲</Tooltip>
              </Rectangle>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

function OrthophotoStatus({ externalTileMode, externalTileLayerId }: { externalTileMode: "all" | "none" | "only"; externalTileLayerId?: string }) {
  const zoom = useGisStore((state) => state.map.zoom);
  const center = useGisStore((state) => state.map.center);
  const layers = useGisStore((state) => state.layers);
  const visibleTiles = layers.filter((layer) => {
    if (!layer.visible || layer.type !== "tile" || !layer.externalTile) return false;
    if (externalTileMode === "none") return false;
    if (externalTileMode === "only" && layer.id !== externalTileLayerId) return false;
    return true;
  });

  return (
    <div className="map-overlay-status" aria-label="オルソ画像表示状態">
      {visibleTiles.length ? (
        visibleTiles.map((layer) => {
          const diagnostics = layer.tileDiagnostics;
          const config = layer.externalTile;
          const zoomWarning = config && (zoom < config.minZoom || zoom > config.maxZoom);
          const outOfBounds = config?.bounds && !isCenterInsideBounds(center, config.bounds);
          return (
            <div key={layer.id} className={`overlay-status-item ${diagnostics?.status ?? "unchecked"}`}>
              <strong>{layer.name}</strong>
              <span>読込 {diagnostics?.loadedCount ?? 0} / エラー {diagnostics?.errorCount ?? 0} / 透過 {Math.round(layer.opacity * 100)}%</span>
              {zoomWarning ? <em>ズーム範囲外 {config?.minZoom}-{config?.maxZoom}</em> : null}
              {outOfBounds ? <em>現在地が撮影範囲外です</em> : null}
              {diagnostics?.lastTestUrl ? <small>{diagnostics.lastTestUrl}</small> : null}
            </div>
          );
        })
      ) : (
        <div className="overlay-status-item unchecked">
          <strong>オルソ画像未表示</strong>
          <span>右パネルからXYZ/TMSタイルURLを追加してください。</span>
        </div>
      )}
    </div>
  );
}
