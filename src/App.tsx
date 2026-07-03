import { useEffect, useRef } from "react";
import { MapProvider } from "./components/MapContext";
import { SearchBar } from "./components/SearchBar";
import { LayerPanel } from "./components/LayerPanel";
import { ToolPanel } from "./components/ToolPanel";
import { StatusBar } from "./components/StatusBar";
import { MainMap } from "./components/MainMap";
import { CompareMap } from "./components/CompareMap";
import { useGisStore } from "./store/useGisStore";
import { readUrlMapState, updateUrlShareParams } from "./utils/project";

const TOKYO_STATION: [number, number] = [35.681236, 139.767125];

export default function App() {
  const map = useGisStore((state) => state.map);
  const layers = useGisStore((state) => state.layers);
  const compareMode = useGisStore((state) => state.compareMode);
  const setMapCenter = useGisStore((state) => state.setMapCenter);
  const setZoom = useGisStore((state) => state.setZoom);
  const setSelectedBaseMap = useGisStore((state) => state.setSelectedBaseMap);
  const updateLayer = useGisStore((state) => state.updateLayer);
  const persist = useGisStore((state) => state.persist);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const shared = readUrlMapState();
    const isNullIsland = shared.center && Math.abs(shared.center[0]) < 1 && Math.abs(shared.center[1]) < 1;
    const hasNoSharedLayers = !shared.layers?.length;
    const isGsiBase = !shared.baseMap || shared.baseMap.startsWith("gsi-");
    if (shared.center) setMapCenter(isNullIsland && hasNoSharedLayers && isGsiBase ? TOKYO_STATION : shared.center);
    if (shared.zoom) setZoom(shared.zoom);
    if (shared.baseMap) setSelectedBaseMap(shared.baseMap);
    if (shared.layers) {
      shared.layers.forEach((layerId) => updateLayer(layerId, { visible: true }));
    }
  }, [setMapCenter, setSelectedBaseMap, setZoom, updateLayer]);

  useEffect(() => {
    persist();
    const activeLayerIds = layers.filter((layer) => layer.visible).map((layer) => layer.id);
    updateUrlShareParams(map.center, map.zoom, map.selectedBaseMap, activeLayerIds);
  }, [layers, map, persist]);

  return (
    <MapProvider>
      <div className="app-shell">
        <header className="topbar">
          <SearchBar />
        </header>
        <aside className="left-panel" aria-label="背景地図とオルソ画像レイヤー">
          <LayerPanel />
        </aside>
        <main className="map-stage" id="map-export-target">
          {compareMode ? <CompareMap /> : <MainMap mapId="primary" />}
        </main>
        <aside className="right-panel" aria-label="オルソ画像追加と比較">
          <ToolPanel />
        </aside>
        <footer className="statusbar">
          <StatusBar />
        </footer>
      </div>
    </MapProvider>
  );
}
