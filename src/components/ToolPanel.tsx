import { ChangeEvent, useRef, useState } from "react";
import { Activity, BarChart3, Download, FileDown, FileUp, Flame, Layers2, Map, MousePointer2, PenLine, Printer, Ruler, Save, Shapes, SplitSquareHorizontal, Trash2 } from "lucide-react";
import type { FeatureCollection } from "geojson";
import { useGisStore } from "../store/useGisStore";
import type { DrawingTool } from "../types";
import { createBuffer, createVoronoi, drawingToFeatureCollection, featureCollectionToDrawings } from "../utils/geo";
import { downloadJson, readProjectFile } from "../utils/project";
import { exportMapPdf, exportMapPng } from "../utils/exportMap";
import { ExternalTilePanel } from "./ExternalTilePanel";

const toolButtons: Array<{ id: DrawingTool; label: string; icon: typeof MousePointer2; title: string }> = [
  { id: "select", label: "選択", icon: MousePointer2, title: "クリック地点の座標・標高を表示" },
  { id: "point", label: "点", icon: Map, title: "地図上に点を作成" },
  { id: "line", label: "線", icon: PenLine, title: "クリックで線を作成、ダブルクリックで確定" },
  { id: "polygon", label: "面", icon: Shapes, title: "クリックでポリゴンを作成、ダブルクリックで確定" },
  { id: "circle", label: "円", icon: Activity, title: "中心と半径位置をクリックして円を作成" },
  { id: "rectangle", label: "矩形", icon: SplitSquareHorizontal, title: "対角2点をクリックして矩形を作成" },
  { id: "text", label: "文字", icon: BarChart3, title: "ラベル付きポイントを作成" },
  { id: "measure-distance", label: "距離", icon: Ruler, title: "クリックで距離計測、ダブルクリックで保存" },
  { id: "measure-area", label: "面積", icon: Layers2, title: "クリックで面積・周囲長計測、ダブルクリックで保存" }
];

export function ToolPanel() {
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const drawingInputRef = useRef<HTMLInputElement | null>(null);
  const activeTool = useGisStore((state) => state.activeTool);
  const setActiveTool = useGisStore((state) => state.setActiveTool);
  const layers = useGisStore((state) => state.layers);
  const drawings = useGisStore((state) => state.drawings);
  const addDrawing = useGisStore((state) => state.addDrawing);
  const analysisResults = useGisStore((state) => state.analysisResults);
  const addAnalysisResult = useGisStore((state) => state.addAnalysisResult);
  const clearAnalysis = useGisStore((state) => state.clearAnalysis);
  const exportProject = useGisStore((state) => state.exportProject);
  const importProject = useGisStore((state) => state.importProject);
  const compareMode = useGisStore((state) => state.compareMode);
  const setCompareMode = useGisStore((state) => state.setCompareMode);
  const compareBaseMapId = useGisStore((state) => state.compareBaseMapId);
  const setCompareBaseMapId = useGisStore((state) => state.setCompareBaseMapId);
  const compareTileLayerId = useGisStore((state) => state.compareTileLayerId);
  const setCompareTileLayerId = useGisStore((state) => state.setCompareTileLayerId);
  const baseMaps = useGisStore((state) => state.baseMaps);
  const [sourceLayerId, setSourceLayerId] = useState("");
  const [secondLayerId, setSecondLayerId] = useState("");
  const [bufferMeters, setBufferMeters] = useState(500);
  const [message, setMessage] = useState("");

  function selectedLayer() {
    return layers.find((layer) => layer.id === sourceLayerId) ?? layers[0];
  }

  function runBuffer() {
    try {
      const layer = selectedLayer();
      if (!layer) throw new Error("解析対象レイヤーを追加してください。");
      const result = createBuffer(layer, bufferMeters);
      addAnalysisResult({ id: crypto.randomUUID(), type: "buffer", sourceLayerId: layer.id, resultGeoJSON: result });
      setMessage(`バッファ ${bufferMeters}m を作成しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "バッファ解析に失敗しました。");
    }
  }

  function runVoronoi() {
    try {
      const layer = selectedLayer();
      if (!layer) throw new Error("解析対象レイヤーを追加してください。");
      const result = createVoronoi(layer);
      addAnalysisResult({ id: crypto.randomUUID(), type: "voronoi", sourceLayerId: layer.id, resultGeoJSON: result });
      setMessage("ボロノイ図を作成しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ボロノイ作成に失敗しました。");
    }
  }

  function addHeatmapPlaceholder() {
    const layer = selectedLayer();
    if (!layer?.data) {
      setMessage("ヒートマップにはポイントレイヤーが必要です。");
      return;
    }
    const points = layer.data.features.filter((feature) => feature.geometry?.type === "Point");
    addAnalysisResult({
      id: crypto.randomUUID(),
      type: "heatmap",
      sourceLayerId: layer.id,
      resultGeoJSON: { type: "FeatureCollection", features: points }
    });
    setMessage("ヒートマップ用ポイントを解析結果として追加しました。");
  }

  function saveProject() {
    downloadJson(`web-gis-project-${new Date().toISOString().slice(0, 10)}.json`, exportProject());
  }

  async function loadProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const project = await readProjectFile(file);
      importProject(project);
      setMessage("プロジェクトを復元しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "プロジェクトの復元に失敗しました。");
    }
    event.target.value = "";
  }

  function saveDrawings() {
    downloadJson("drawings.geojson", drawingToFeatureCollection(drawings));
  }

  async function loadDrawings(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const collection = JSON.parse(await file.text()) as FeatureCollection;
      featureCollectionToDrawings(collection).forEach(addDrawing);
      setMessage("作図GeoJSONを読み込みました。");
    } catch {
      setMessage("作図GeoJSONの読み込みに失敗しました。");
    }
    event.target.value = "";
  }

  async function exportPng() {
    const target = document.getElementById("map-export-target");
    if (target) await exportMapPng(target);
  }

  async function exportPdf() {
    const target = document.getElementById("map-export-target");
    if (target) await exportMapPdf(target);
  }

  return (
    <div className="panel-content">
      <ExternalTilePanel />

      <section className="panel-section">
        <div className="panel-heading">
          <h2>作図・計測</h2>
        </div>
        <div className="tool-grid">
          {toolButtons.map((tool) => {
            const Icon = tool.icon;
            return (
              <button key={tool.id} type="button" className={activeTool === tool.id ? "tool active" : "tool"} title={tool.title} onClick={() => setActiveTool(tool.id)}>
                <Icon size={17} aria-hidden />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>
        <p className="hint">線・面の確定はダブルクリック、作図中止は右クリックです。</p>
        <div className="button-row">
          <button type="button" onClick={saveDrawings} title="作図データをGeoJSONで保存"><Download size={16} aria-hidden />作図保存</button>
          <button type="button" onClick={() => drawingInputRef.current?.click()} title="作図GeoJSONを読み込む"><FileUp size={16} aria-hidden />作図読込</button>
          <input ref={drawingInputRef} type="file" accept=".geojson,.json" hidden onChange={loadDrawings} />
        </div>
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <h2>解析</h2>
        </div>
        <label className="field">
          対象レイヤー
          <select value={sourceLayerId} onChange={(event) => setSourceLayerId(event.target.value)}>
            <option value="">先頭レイヤー</option>
            {layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
          </select>
        </label>
        <label className="field">
          バッファ距離 m
          <input type="number" min={1} step={50} value={bufferMeters} onChange={(event) => setBufferMeters(Number(event.target.value))} />
        </label>
        <div className="button-row">
          <button type="button" onClick={runBuffer} title="Turf.jsでバッファを作成"><Activity size={16} aria-hidden />バッファ</button>
          <button type="button" onClick={runVoronoi} title="ポイントからボロノイ図を作成"><Shapes size={16} aria-hidden />ボロノイ</button>
          <button type="button" onClick={addHeatmapPlaceholder} title="ポイント密度表示の下準備"><Flame size={16} aria-hidden />ヒート</button>
        </div>
        <label className="field">
          重ね合わせ候補
          <select value={secondLayerId} onChange={(event) => setSecondLayerId(event.target.value)}>
            <option value="">未選択</option>
            {layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
          </select>
        </label>
        <p className="hint">ポイント集計、属性フィルタ、重ね合わせ判定は同じデータ構造で拡張できます。</p>
        <div className="button-row">
          <button type="button" onClick={clearAnalysis} title="解析結果を消去"><Trash2 size={16} aria-hidden />解析消去</button>
          <span className="pill">{analysisResults.length} 件</span>
        </div>
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <h2>比較・出力</h2>
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={compareMode} onChange={(event) => setCompareMode(event.target.checked)} />
          {compareMode ? "2画面比較中" : "2画面比較"}
        </label>
        <label className="field">
          比較背景
          <select value={compareBaseMapId} onChange={(event) => setCompareBaseMapId(event.target.value)}>
            {baseMaps.map((baseMap) => <option key={baseMap.id} value={baseMap.id}>{baseMap.name}</option>)}
          </select>
        </label>
        <label className="field">
          右画面タイル
          <select value={compareTileLayerId ?? ""} onChange={(event) => setCompareTileLayerId(event.target.value || undefined)}>
            <option value="">表示中の外部タイルすべて</option>
            {layers.filter((layer) => layer.type === "tile").map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
          </select>
        </label>
        <div className="button-row">
          {compareMode ? <button type="button" onClick={() => setCompareMode(false)} title="2画面比較を解除"><SplitSquareHorizontal size={16} aria-hidden />比較解除</button> : null}
          <button type="button" onClick={exportPng} title="現在の地図をPNGで出力"><Printer size={16} aria-hidden />PNG</button>
          <button type="button" onClick={exportPdf} title="現在の地図をPDFで出力"><FileDown size={16} aria-hidden />PDF</button>
        </div>
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <h2>プロジェクト</h2>
        </div>
        <div className="button-row">
          <button type="button" onClick={saveProject} title="地図状態・レイヤー・作図・解析結果をJSON保存"><Save size={16} aria-hidden />保存</button>
          <button type="button" onClick={() => projectInputRef.current?.click()} title="保存済みプロジェクトJSONを復元"><FileUp size={16} aria-hidden />復元</button>
          <input ref={projectInputRef} type="file" accept=".json" hidden onChange={loadProject} />
        </div>
        {message ? <p className="notice">{message}</p> : null}
      </section>
    </div>
  );
}
