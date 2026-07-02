# Civic Light Web GIS

ひなたGISを複製せず、自治体・教育・研究・防災・地域分析で使える軽量ブラウザ完結型Web GISとして実装したReact/TypeScriptアプリです。

## 公開URL

GitHub Pages:

https://YutoKyoto.github.io/civic-light-web-gis/

`main` ブランチへpushすると、GitHub Actionsで自動ビルドされ、GitHub Pagesへ公開されます。
リポジトリの Settings > Pages で Source が `GitHub Actions` になっていることを確認してください。

## 1. ディレクトリ構成

```text
outputs/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  src/
    App.tsx
    main.tsx
    styles.css
    types.ts
    components/
      CompareMap.tsx
      LayerPanel.tsx
      MainMap.tsx
      MapContext.tsx
      SearchBar.tsx
      StatusBar.tsx
      ToolPanel.tsx
    data/
      baseMaps.ts
      disasterLayers.ts
    store/
      useGisStore.ts
    utils/
      elevation.ts
      exportMap.ts
      fileParsers.ts
      geo.ts
      project.ts
```

## 2. 使用ライブラリ

- React / TypeScript / Vite
- Leaflet / React Leaflet
- Turf.js
- Zustand
- PapaParse
- togeojson / tokml
- html2canvas / jsPDF
- Chart.js / react-chartjs-2
- lucide-react

## 3. 主要コンポーネント設計

- `App.tsx`: 全体レイアウト、URL共有パラメータ、localStorage永続化
- `MainMap.tsx`: 地図表示、背景タイル、主題図、作図、計測、属性ポップアップ、標高クリック取得
- `CompareMap.tsx`: 左右2画面比較表示
- `LayerPanel.tsx`: 背景地図と主題図レイヤーの管理、透過率、順序、表示切替、ファイル読み込み
- `ToolPanel.tsx`: 作図、計測、バッファ、ボロノイ、ヒートマップ候補、プロジェクト保存復元、PNG/PDF出力
- `ExternalTilePanel.tsx`: XYZ/TMS外部タイルURLの検証、プレビュー、診断、登録
- `SearchBar.tsx`: 住所・地名・緯度経度検索と履歴
- `StatusBar.tsx`: 座標、ズーム、表示レイヤー数、簡易スケール

## 4. 型定義

主要型は `src/types.ts` に集約しています。

- `MapState`: 中心座標、ズーム、背景地図、表示レイヤー
- `AppLayer`: レイヤーID、名称、種別、URL、透過率、表示状態、スタイル、凡例、GeoJSON
- `DrawingFeature`: 作図フィーチャ、属性、スタイル
- `AnalysisResult`: 解析結果種別、入力レイヤー、結果GeoJSON
- `ProjectState`: 保存・復元用プロジェクトJSON
- `ExternalTileConfig`: URLテンプレート、XYZ/TMS、Y反転、ズーム範囲、bbox、中心座標、メタデータ
- `TileDiagnostics`: プレビューURL、z/x/y、読み込みエラー数、警告、修正候補

## 5. 実装コード

実装コードは `src/` 配下に省略なしで配置しています。国土地理院タイル、標高API、Nominatimの利用箇所には、該当利用規約を確認できるコメントを入れています。

外部タイル追加MVP:

- 右ツールパネルの「外部タイル追加」にXYZ/TMS URLを入力
- `{z}/{x}/{y}` または `{zoom}/{tileX}/{tileY}` で終わるXYZテンプレートに対応
- `.png` などの拡張子がない `https://example.com/tiles/{z}/{x}/{y}` 形式も標準扱い
- 登録前に現在の地図中心・ズームから1枚のタイルURLを生成してプレビュー
- PNG/JPG/WebP等の画像タイル、HTTP/HTTPS、Mixed Content、ズーム範囲、bbox外を診断
- 追加後は主題図レイヤーとして自動表示ON
- レイヤーパネルに読み込みエラー数、直近タイルURL、原因候補、範囲へ移動を表示
- TMS/Y反転、中心座標、bbox、撮影日、解像度、提供者を保存
- 2画面比較では左を地理院地図、右を比較背景＋選択外部タイルにできます

## 6. 起動方法

```bash
pnpm install
pnpm dev
```

GitHub Pages用にビルドする場合:

```bash
pnpm build
```

この環境では以下で検証済みです。

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

## 7. 今後の拡張方法

- `data/disasterLayers.ts` に防災・地域分析レイヤーカタログを追加
- `utils/geo.ts` にTurf.js解析関数を追加
- `ToolPanel.tsx` に解析UIを追加
- WMS/XYZ/ベクトルタイル対応は `AppLayer.type` と `MainMap.tsx` のレンダラを拡張
- 標高断面図は作図ラインをサンプリングして `utils/elevation.ts` で標高取得し、Chart.jsで描画
- 3D地形表示はCesiumJSを遅延読み込みし、右ツールパネルからモード切替する構成が適しています
