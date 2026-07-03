import { useGisStore } from "../store/useGisStore";

export function StatusBar() {
  const map = useGisStore((state) => state.map);
  const coord = useGisStore((state) => state.statusCoordinate);
  const visibleCount = useGisStore((state) => state.layers.filter((layer) => layer.visible && layer.type === "tile").length);

  return (
    <div className="status-content">
      <span>Zoom {map.zoom}</span>
      <span>中心 {map.center[0].toFixed(5)}, {map.center[1].toFixed(5)}</span>
      <span>カーソル {coord ? `${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}` : "-"}</span>
      <span>表示オルソ {visibleCount}</span>
      <span className="scale">0 ━━━━━ 500m</span>
    </div>
  );
}
