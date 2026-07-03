import { useEffect, useRef } from "react";
import { MainMap } from "./MainMap";
import { useGisStore } from "../store/useGisStore";

export function CompareMap() {
  const baseMaps = useGisStore((state) => state.baseMaps);
  const selectedBaseMap = useGisStore((state) => state.map.selectedBaseMap);
  const compareBaseMapId = useGisStore((state) => state.compareBaseMapId);
  const compareTileLayerId = useGisStore((state) => state.compareTileLayerId);
  const setCompareBaseMapId = useGisStore((state) => state.setCompareBaseMapId);
  const setCompareMode = useGisStore((state) => state.setCompareMode);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (compareBaseMapId === selectedBaseMap) {
      setCompareBaseMapId(baseMaps.find((baseMap) => baseMap.id !== selectedBaseMap)?.id ?? selectedBaseMap);
    }
  }, [baseMaps, compareBaseMapId, selectedBaseMap, setCompareBaseMapId]);

  return (
    <div className="compare-grid">
      <button type="button" className="compare-exit" onClick={() => setCompareMode(false)} title="2画面比較を解除して通常地図へ戻る">
        比較解除
      </button>
      <div className="compare-pane">
        <span className="compare-label">左: 地理院地図・OSM</span>
        <MainMap mapId="compare-left" baseMapOverride={selectedBaseMap} externalTileMode="none" />
      </div>
      <div className="compare-pane">
        <span className="compare-label">右: オルソ画像重ね合わせ</span>
        <MainMap mapId="compare-right" baseMapOverride={compareBaseMapId} externalTileMode={compareTileLayerId ? "only" : "all"} externalTileLayerId={compareTileLayerId} />
      </div>
    </div>
  );
}
