import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from "geojson";

export type LatLngTuple = [number, number];

export type LayerType =
  | "geojson"
  | "csv"
  | "kml"
  | "drawing"
  | "analysis"
  | "tile"
  | "heatmap";

export type DrawingTool = "select" | "point" | "line" | "polygon" | "circle" | "rectangle" | "text" | "measure-distance" | "measure-area";

export interface MapState {
  center: LatLngTuple;
  zoom: number;
  selectedBaseMap: string;
  activeLayers: string[];
}

export interface LayerStyle {
  color: string;
  fillColor: string;
  weight: number;
  opacity: number;
  fillOpacity: number;
  radius: number;
}

export interface BaseMapLayer {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  opacity: number;
  visible: boolean;
  legend?: string;
}

export type ExternalTileScheme = "xyz" | "tms";

export interface TileBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ExternalTileMetadata {
  capturedAt?: string;
  resolution?: string;
  provider?: string;
  description?: string;
}

export interface ExternalTileConfig {
  urlTemplate: string;
  attribution: string;
  minZoom: number;
  maxZoom: number;
  scheme: ExternalTileScheme;
  flipY: boolean;
  bounds?: TileBounds;
  center?: LatLngTuple;
  metadata?: ExternalTileMetadata;
}

export interface TileDiagnostics {
  status: "unchecked" | "ok" | "warning" | "error";
  errorCount: number;
  loadedCount?: number;
  lastTestUrl?: string;
  lastTile?: {
    z: number;
    x: number;
    y: number;
    requestedY: number;
  };
  lastError?: string;
  lastCheckedAt?: string;
  warnings: string[];
  suggestions: string[];
}

export interface AppLayer {
  id: string;
  name: string;
  type: LayerType;
  sourceUrl?: string;
  opacity: number;
  visible: boolean;
  style: LayerStyle;
  legend?: string;
  data?: FeatureCollection;
  externalTile?: ExternalTileConfig;
  tileDiagnostics?: TileDiagnostics;
  order: number;
  createdAt: string;
}

export interface DrawingFeature {
  id: string;
  geometry: Geometry;
  properties: GeoJsonProperties & {
    label?: string;
    kind?: string;
    radiusMeters?: number;
  };
  style: LayerStyle;
}

export interface AnalysisResult {
  id: string;
  type: "buffer" | "heatmap" | "voronoi" | "point-count" | "overlay" | "filter";
  sourceLayerId: string;
  resultGeoJSON: FeatureCollection;
}

export interface SearchResult {
  id: string;
  label: string;
  lat: number;
  lng: number;
  source: "latlng" | "nominatim" | "gazetteer" | "history";
  detail?: string;
  confidence?: number;
  bounds?: TileBounds;
}

export interface ProjectState {
  schemaVersion: 1;
  map: MapState;
  layers: AppLayer[];
  drawings: DrawingFeature[];
  analysisResults: AnalysisResult[];
  savedAt: string;
}

export type AnyFeature = Feature<Geometry, GeoJsonProperties>;
