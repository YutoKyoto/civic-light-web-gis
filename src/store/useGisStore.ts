import { create } from "zustand";
import type { AnalysisResult, AppLayer, BaseMapLayer, DrawingFeature, DrawingTool, LatLngTuple, MapState, ProjectState, SearchResult } from "../types";
import { BASE_MAPS } from "../data/baseMaps";

const STORE_KEY = "civic-light-web-gis-state";

interface GisStore {
  map: MapState;
  baseMaps: BaseMapLayer[];
  layers: AppLayer[];
  drawings: DrawingFeature[];
  analysisResults: AnalysisResult[];
  searchHistory: SearchResult[];
  activeTool: DrawingTool;
  selectedLayerId?: string;
  compareMode: boolean;
  compareBaseMapId: string;
  compareTileLayerId?: string;
  statusCoordinate?: LatLngTuple;
  setMapCenter: (center: LatLngTuple) => void;
  setZoom: (zoom: number) => void;
  setSelectedBaseMap: (id: string) => void;
  setBaseMapOpacity: (id: string, opacity: number) => void;
  addLayer: (layer: AppLayer) => void;
  updateLayer: (id: string, patch: Partial<AppLayer>) => void;
  removeLayer: (id: string) => void;
  moveLayer: (id: string, direction: "up" | "down") => void;
  addDrawing: (feature: DrawingFeature) => void;
  updateDrawing: (id: string, patch: Partial<DrawingFeature>) => void;
  removeDrawing: (id: string) => void;
  duplicateDrawing: (id: string) => void;
  addAnalysisResult: (result: AnalysisResult) => void;
  clearAnalysis: () => void;
  setActiveTool: (tool: DrawingTool) => void;
  setSelectedLayerId: (id?: string) => void;
  setStatusCoordinate: (coordinate?: LatLngTuple) => void;
  addSearchHistory: (result: SearchResult) => void;
  setCompareMode: (enabled: boolean) => void;
  setCompareBaseMapId: (id: string) => void;
  setCompareTileLayerId: (id?: string) => void;
  exportProject: () => ProjectState;
  importProject: (project: ProjectState) => void;
  persist: () => void;
}

const defaultMap: MapState = {
  center: [35.681236, 139.767125],
  zoom: 12,
  selectedBaseMap: "gsi-standard",
  activeLayers: []
};

const defaultStyle = {
  color: "#2563eb",
  fillColor: "#38bdf8",
  weight: 3,
  opacity: 0.9,
  fillOpacity: 0.25,
  radius: 7
};

function loadPersisted(): Pick<GisStore, "map" | "baseMaps" | "layers" | "drawings" | "analysisResults" | "searchHistory" | "compareMode" | "compareBaseMapId" | "compareTileLayerId"> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      return {
        map: defaultMap,
        baseMaps: BASE_MAPS,
        layers: [],
        drawings: [],
        analysisResults: [],
        searchHistory: [],
        compareMode: false,
        compareBaseMapId: "gsi-photo",
        compareTileLayerId: undefined
      };
    }
    const parsed = JSON.parse(raw) as ProjectState & { searchHistory?: SearchResult[]; compareMode?: boolean; compareBaseMapId?: string; compareTileLayerId?: string };
    return {
      map: parsed.map ?? defaultMap,
      baseMaps: BASE_MAPS,
      layers: parsed.layers ?? [],
      drawings: parsed.drawings ?? [],
      analysisResults: parsed.analysisResults ?? [],
      searchHistory: parsed.searchHistory ?? [],
      compareMode: parsed.compareMode ?? false,
      compareBaseMapId: parsed.compareBaseMapId ?? "gsi-photo",
      compareTileLayerId: parsed.compareTileLayerId
    };
  } catch {
    return {
      map: defaultMap,
      baseMaps: BASE_MAPS,
      layers: [],
      drawings: [],
      analysisResults: [],
      searchHistory: [],
      compareMode: false,
      compareBaseMapId: "gsi-photo",
      compareTileLayerId: undefined
    };
  }
}

const initial = loadPersisted();

export const useGisStore = create<GisStore>((set, get) => ({
  ...initial,
  activeTool: "select",
  selectedLayerId: undefined,
  statusCoordinate: undefined,
  setMapCenter: (center) => set((state) => ({ map: { ...state.map, center } })),
  setZoom: (zoom) => set((state) => ({ map: { ...state.map, zoom } })),
  setSelectedBaseMap: (id) => set((state) => ({ map: { ...state.map, selectedBaseMap: id } })),
  setBaseMapOpacity: (id, opacity) => set((state) => ({ baseMaps: state.baseMaps.map((layer) => (layer.id === id ? { ...layer, opacity } : layer)) })),
  addLayer: (layer) => set((state) => ({ layers: [...state.layers, layer], map: { ...state.map, activeLayers: [...state.map.activeLayers, layer.id] } })),
  updateLayer: (id, patch) => set((state) => ({ layers: state.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)) })),
  removeLayer: (id) =>
    set((state) => ({
      layers: state.layers.filter((layer) => layer.id !== id),
      map: { ...state.map, activeLayers: state.map.activeLayers.filter((layerId) => layerId !== id) }
    })),
  moveLayer: (id, direction) =>
    set((state) => {
      const sorted = [...state.layers].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((layer) => layer.id === id);
      const target = direction === "up" ? index + 1 : index - 1;
      if (index < 0 || target < 0 || target >= sorted.length) return state;
      [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
      return { layers: sorted.map((layer, order) => ({ ...layer, order })) };
    }),
  addDrawing: (feature) => set((state) => ({ drawings: [...state.drawings, feature] })),
  updateDrawing: (id, patch) => set((state) => ({ drawings: state.drawings.map((feature) => (feature.id === id ? { ...feature, ...patch } : feature)) })),
  removeDrawing: (id) => set((state) => ({ drawings: state.drawings.filter((feature) => feature.id !== id) })),
  duplicateDrawing: (id) =>
    set((state) => {
      const original = state.drawings.find((feature) => feature.id === id);
      if (!original) return state;
      const copy: DrawingFeature = {
        ...structuredClone(original),
        id: crypto.randomUUID(),
        properties: { ...original.properties, label: `${original.properties?.label ?? "図形"} コピー` }
      };
      return { drawings: [...state.drawings, copy] };
    }),
  addAnalysisResult: (result) => set((state) => ({ analysisResults: [...state.analysisResults, result] })),
  clearAnalysis: () => set({ analysisResults: [] }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  setStatusCoordinate: (coordinate) => set({ statusCoordinate: coordinate }),
  addSearchHistory: (result) =>
    set((state) => ({
      searchHistory: [result, ...state.searchHistory.filter((item) => item.label !== result.label)].slice(0, 10)
    })),
  setCompareMode: (enabled) => set({ compareMode: enabled }),
  setCompareBaseMapId: (id) => set({ compareBaseMapId: id }),
  setCompareTileLayerId: (id) => set({ compareTileLayerId: id }),
  exportProject: () => ({
    schemaVersion: 1,
    map: get().map,
    layers: get().layers,
    drawings: get().drawings,
    analysisResults: get().analysisResults,
    savedAt: new Date().toISOString()
  }),
  importProject: (project) =>
    set({
      map: project.map,
      layers: project.layers,
      drawings: project.drawings,
      analysisResults: project.analysisResults
    }),
  persist: () => {
    const state = get();
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        ...state.exportProject(),
        searchHistory: state.searchHistory,
        compareMode: state.compareMode,
        compareBaseMapId: state.compareBaseMapId,
        compareTileLayerId: state.compareTileLayerId
      })
    );
  }
}));

export { defaultStyle };
