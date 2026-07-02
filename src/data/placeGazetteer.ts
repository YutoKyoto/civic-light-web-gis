import type { SearchResult } from "../types";

type GazetteerItem = Omit<SearchResult, "id" | "source"> & {
  aliases: string[];
};

export const PLACE_GAZETTEER: GazetteerItem[] = [
  { label: "札幌駅", lat: 43.06866, lng: 141.35076, detail: "北海道札幌市 / 鉄道駅", confidence: 0.98, aliases: ["札駅", "さつえき", "sapporo station", "sapporo sta"] },
  { label: "札幌市役所", lat: 43.06198, lng: 141.35439, detail: "北海道札幌市中央区", confidence: 0.95, aliases: ["札幌市役所", "札幌 市役所", "sapporo city hall"] },
  { label: "北海道庁旧本庁舎", lat: 43.06397, lng: 141.34792, detail: "北海道札幌市中央区 / 赤れんが庁舎", confidence: 0.94, aliases: ["赤れんが", "赤レンガ", "道庁", "北海道庁"] },
  { label: "大通公園", lat: 43.0599, lng: 141.3479, detail: "北海道札幌市中央区", confidence: 0.94, aliases: ["大通", "odori park", "odori"] },
  { label: "新千歳空港", lat: 42.7752, lng: 141.6923, detail: "北海道千歳市 / 空港", confidence: 0.96, aliases: ["新千歳", "千歳空港", "cts", "new chitose"] },
  { label: "東京駅", lat: 35.681236, lng: 139.767125, detail: "東京都千代田区 / 鉄道駅", confidence: 0.98, aliases: ["tokyo station", "東京 駅"] },
  { label: "東京都庁", lat: 35.68962, lng: 139.6921, detail: "東京都新宿区", confidence: 0.95, aliases: ["都庁", "tokyo metropolitan government"] },
  { label: "横浜駅", lat: 35.4662, lng: 139.6227, detail: "神奈川県横浜市 / 鉄道駅", confidence: 0.95, aliases: ["yokohama station"] },
  { label: "名古屋駅", lat: 35.1709, lng: 136.8815, detail: "愛知県名古屋市 / 鉄道駅", confidence: 0.95, aliases: ["名駅", "meieki", "nagoya station"] },
  { label: "京都駅", lat: 34.98585, lng: 135.75877, detail: "京都府京都市 / 鉄道駅", confidence: 0.95, aliases: ["kyoto station"] },
  { label: "大阪駅", lat: 34.70249, lng: 135.49596, detail: "大阪府大阪市 / 鉄道駅", confidence: 0.95, aliases: ["梅田", "大阪梅田", "osaka station", "umeda"] },
  { label: "博多駅", lat: 33.5902, lng: 130.4206, detail: "福岡県福岡市 / 鉄道駅", confidence: 0.95, aliases: ["hakata station"] },
  { label: "那覇空港", lat: 26.2067, lng: 127.6469, detail: "沖縄県那覇市 / 空港", confidence: 0.95, aliases: ["oka", "naha airport"] },
  { label: "香取市役所", lat: 35.89774, lng: 140.49926, detail: "千葉県香取市", confidence: 0.9, aliases: ["香取 市役所", "katori city hall"] },
  { label: "佐原駅", lat: 35.8946, lng: 140.4935, detail: "千葉県香取市 / 鉄道駅", confidence: 0.9, aliases: ["さわら駅", "sawara station"] }
];

export const PREFECTURE_HINTS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府",
  "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
];
