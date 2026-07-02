export interface CatalogLayer {
  id: string;
  name: string;
  category: "防災" | "行政" | "地域分析";
  description: string;
  expectedFormat: "GeoJSON" | "CSV" | "KML" | "XYZ" | "WMS";
  sourceHint: string;
}

export const DISASTER_LAYER_CATALOG: CatalogLayer[] = [
  {
    id: "flood-assumption",
    name: "洪水浸水想定区域",
    category: "防災",
    description: "国・都道府県・自治体が公開する浸水想定区域データをGeoJSON等で追加する想定です。",
    expectedFormat: "GeoJSON",
    sourceHint: "国土数値情報、各自治体オープンデータ、防災ポータル等の利用条件を確認してください。"
  },
  {
    id: "tsunami-assumption",
    name: "津波浸水想定",
    category: "防災",
    description: "沿岸自治体や都道府県が公開する津波浸水想定区域を重ね合わせます。",
    expectedFormat: "GeoJSON",
    sourceHint: "自治体・都道府県のオープンデータカタログを想定。"
  },
  {
    id: "landslide-warning",
    name: "土砂災害警戒区域",
    category: "防災",
    description: "土砂災害警戒区域、特別警戒区域などのポリゴンデータを扱います。",
    expectedFormat: "GeoJSON",
    sourceHint: "国土数値情報または都道府県公開データを想定。"
  },
  {
    id: "shelters",
    name: "避難所",
    category: "防災",
    description: "避難所のポイントデータ。CSVなら緯度・経度列から表示できます。",
    expectedFormat: "CSV",
    sourceHint: "自治体オープンデータ、防災ポータル等。"
  },
  {
    id: "admin-boundary",
    name: "行政界",
    category: "行政",
    description: "市区町村界、町丁目界などの境界ポリゴン。",
    expectedFormat: "GeoJSON",
    sourceHint: "国土数値情報、e-Stat、自治体オープンデータ等。"
  },
  {
    id: "population-mesh",
    name: "人口メッシュ",
    category: "地域分析",
    description: "地域メッシュ統計を主題図化するためのポリゴンまたはポイントデータ。",
    expectedFormat: "GeoJSON",
    sourceHint: "e-Stat、国勢調査メッシュ等。"
  },
  {
    id: "land-use",
    name: "土地利用",
    category: "地域分析",
    description: "土地利用細分メッシュや都市計画基礎調査データを重ね合わせます。",
    expectedFormat: "GeoJSON",
    sourceHint: "国土数値情報、自治体都市計画オープンデータ等。"
  }
];
