import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties, MultiPolygon, Point, Polygon } from "geojson";
import type { AppLayer, DrawingFeature, LayerStyle } from "../types";

export function layerStyle(style: LayerStyle, layerOpacity: number) {
  return {
    color: style.color,
    fillColor: style.fillColor,
    weight: style.weight,
    opacity: style.opacity * layerOpacity,
    fillOpacity: style.fillOpacity * layerOpacity,
    radius: style.radius
  };
}

export function drawingToFeatureCollection(drawings: DrawingFeature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: drawings.map((drawing) => ({
      type: "Feature",
      geometry: drawing.geometry,
      properties: { ...drawing.properties, _drawingId: drawing.id, _style: drawing.style }
    }))
  };
}

export function featureCollectionToDrawings(collection: FeatureCollection): DrawingFeature[] {
  return collection.features.map((feature) => ({
    id: crypto.randomUUID(),
    geometry: feature.geometry,
    properties: feature.properties ?? {},
    style: (feature.properties?._style as LayerStyle | undefined) ?? {
      color: "#0f766e",
      fillColor: "#14b8a6",
      weight: 3,
      opacity: 0.9,
      fillOpacity: 0.25,
      radius: 7
    }
  }));
}

export function measureLength(features: FeatureCollection | Feature<Geometry>): number {
  return turf.length(features, { units: "kilometers" });
}

export function measureArea(feature: Feature<Geometry>): number {
  return turf.area(feature);
}

export function createBuffer(layer: AppLayer, radiusMeters: number): FeatureCollection {
  if (!layer.data) throw new Error("解析対象レイヤーにデータがありません。");
  const buffered = turf.buffer(layer.data, radiusMeters, { units: "meters" }) as FeatureCollection | Feature<Geometry> | undefined;
  if (!buffered) throw new Error("バッファを作成できませんでした。");
  if (buffered.type === "FeatureCollection") return buffered;
  return { type: "FeatureCollection", features: [buffered] };
}

export function createVoronoi(layer: AppLayer): FeatureCollection {
  if (!layer.data) throw new Error("解析対象レイヤーにデータがありません。");
  const points = turf.featureCollection(layer.data.features.filter((feature): feature is Feature<Point, GeoJsonProperties> => feature.geometry?.type === "Point"));
  if (!points.features.length) throw new Error("ボロノイ図にはポイントレイヤーが必要です。");
  const bbox = turf.bbox(points);
  const result = turf.voronoi(points, { bbox });
  return result ?? { type: "FeatureCollection", features: [] };
}

export function countPointsInPolygon(pointLayer: AppLayer, polygonLayer: AppLayer): FeatureCollection {
  if (!pointLayer.data || !polygonLayer.data) throw new Error("集計対象レイヤーにデータがありません。");
  const points = pointLayer.data.features.filter((feature): feature is Feature<Point, GeoJsonProperties> => feature.geometry?.type === "Point");
  const polygons = polygonLayer.data.features.filter((feature): feature is Feature<Polygon | MultiPolygon, GeoJsonProperties> => feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon");
  return {
    type: "FeatureCollection",
    features: polygons.map((polygon) => {
      const count = points.filter((point) => turf.booleanPointInPolygon(point, polygon)).length;
      return {
        ...polygon,
        properties: {
          ...(polygon.properties ?? {}),
          point_count: count
        }
      };
    })
  };
}

export function formatDistance(kilometers: number): string {
  return kilometers >= 1 ? `${kilometers.toFixed(2)} km` : `${Math.round(kilometers * 1000)} m`;
}

export function formatArea(squareMeters: number): string {
  return squareMeters >= 1_000_000 ? `${(squareMeters / 1_000_000).toFixed(2)} km2` : `${Math.round(squareMeters).toLocaleString()} m2`;
}
