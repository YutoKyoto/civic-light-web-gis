import { ChangeEvent, useRef, useState } from "react";
import { FileUp, Save, SplitSquareHorizontal } from "lucide-react";
import { useGisStore } from "../store/useGisStore";
import { downloadJson, readProjectFile } from "../utils/project";
import { ExternalTilePanel } from "./ExternalTilePanel";

export function ToolPanel() {
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const exportProject = useGisStore((state) => state.exportProject);
  const importProject = useGisStore((state) => state.importProject);
  const compareMode = useGisStore((state) => state.compareMode);
  const setCompareMode = useGisStore((state) => state.setCompareMode);
  const compareBaseMapId = useGisStore((state) => state.compareBaseMapId);
  const setCompareBaseMapId = useGisStore((state) => state.setCompareBaseMapId);
  const compareTileLayerId = useGisStore((state) => state.compareTileLayerId);
  const setCompareTileLayerId = useGisStore((state) => state.setCompareTileLayerId);
  const baseMaps = useGisStore((state) => state.baseMaps);
  const layers = useGisStore((state) => state.layers);
  const [message, setMessage] = useState("");
  const tileLayers = layers.filter((layer) => layer.type === "tile");

  function saveProject() {
    downloadJson(`orthophoto-viewer-${new Date().toISOString().slice(0, 10)}.json`, exportProject());
  }

  async function loadProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const project = await readProjectFile(file);
      importProject({ ...project, drawings: [], analysisResults: [], layers: project.layers.filter((layer) => layer.type === "tile") });
      setMessage("オルソ画像プロジェクトを復元しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "プロジェクトの復元に失敗しました。");
    }
    event.target.value = "";
  }

  return (
    <div className="panel-content">
      <ExternalTilePanel />

      <section className="panel-section">
        <div className="panel-heading">
          <h2>比較表示</h2>
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={compareMode} onChange={(event) => setCompareMode(event.target.checked)} />
          {compareMode ? "2画面比較中" : "2画面比較を使う"}
        </label>
        <label className="field">
          右画面の背景
          <select value={compareBaseMapId} onChange={(event) => setCompareBaseMapId(event.target.value)}>
            {baseMaps.map((baseMap) => (
              <option key={baseMap.id} value={baseMap.id}>
                {baseMap.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          右画面のオルソ画像
          <select value={compareTileLayerId ?? ""} onChange={(event) => setCompareTileLayerId(event.target.value || undefined)}>
            <option value="">表示中のオルソ画像すべて</option>
            {tileLayers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <button type="button" onClick={() => setCompareMode(!compareMode)} title="通常表示と2画面比較を切り替える">
            <SplitSquareHorizontal size={16} aria-hidden />
            {compareMode ? "比較解除" : "比較開始"}
          </button>
        </div>
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <h2>保存・復元</h2>
        </div>
        <div className="button-row">
          <button type="button" onClick={saveProject} title="オルソ画像URL、bbox、透過率、表示状態をJSON保存">
            <Save size={16} aria-hidden />
            JSON保存
          </button>
          <button type="button" onClick={() => projectInputRef.current?.click()} title="保存済みJSONを復元">
            <FileUp size={16} aria-hidden />
            JSON復元
          </button>
          <input ref={projectInputRef} type="file" accept=".json" hidden onChange={loadProject} />
        </div>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <h2>このビューアの目的</h2>
        </div>
        <ul className="feature-list">
          <li>OpenAerialMapやドローン配信サービスのXYZ/TMSタイルを貼り付けて確認</li>
          <li>bbox、中心座標、ズーム範囲、Y反転を保存</li>
          <li>背景地図との重なり、読込エラー、直近URLを常時表示</li>
          <li>地理院地図・航空写真と2画面で比較</li>
        </ul>
      </section>
    </div>
  );
}
