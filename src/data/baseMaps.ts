import type { BaseMapLayer } from "../types";

// 国土地理院タイル利用規約:
// https://maps.gsi.go.jp/development/ichiran.html
// https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html
// アプリ内では出典表示を保持し、必要に応じて利用者が用途別に確認できる設計にしています。
export const BASE_MAPS: BaseMapLayer[] = [
  {
    id: "gsi-standard",
    name: "地理院 標準地図",
    url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    attribution: "地図の出典: 国土地理院",
    maxZoom: 18,
    opacity: 1,
    visible: true
  },
  {
    id: "gsi-pale",
    name: "地理院 淡色地図",
    url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
    attribution: "地図の出典: 国土地理院",
    maxZoom: 18,
    opacity: 1,
    visible: false
  },
  {
    id: "gsi-photo",
    name: "地理院 航空写真",
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    attribution: "写真の出典: 国土地理院",
    maxZoom: 18,
    opacity: 1,
    visible: false
  },
  {
    id: "gsi-hillshade",
    name: "地理院 陰影起伏図",
    url: "https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png",
    attribution: "地図の出典: 国土地理院",
    maxZoom: 16,
    opacity: 0.75,
    visible: false
  },
  {
    id: "gsi-relief",
    name: "地理院 色別標高図",
    url: "https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png",
    attribution: "地図の出典: 国土地理院",
    maxZoom: 15,
    opacity: 0.7,
    visible: false
  },
  {
    id: "osm",
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
    opacity: 1,
    visible: false
  }
];
