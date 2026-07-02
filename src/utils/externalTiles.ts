import type { ExternalTileConfig, LatLngTuple, TileBounds, TileDiagnostics } from "../types";

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
  requestedY: number;
}

export interface TilePreviewResult {
  ok: boolean;
  url: string;
  tile: TileCoordinate;
  diagnostics: TileDiagnostics;
  imageDataUrl?: string;
  discoveredBounds?: TileBounds;
  previewCenter?: LatLngTuple;
  previewZoom?: number;
}

const imageExtensionPattern = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i;
const xyzEndingPattern = /\/(?:\{z\}|\{zoom\})\/(?:\{x\}|\{tileX\})\/(?:\{y\}|\{tileY\})(?:[?#].*)?$/i;

export function normalizeTileTemplate(value: string): string {
  return value
    .trim()
    .replace(/^[<"'`“”‘’「『]+/, "")
    .replace(/[>"'`“”‘’」』,;]+$/, "")
    .replaceAll("｛", "{")
    .replaceAll("｝", "}");
}

export function validateTileTemplate(config: ExternalTileConfig): TileDiagnostics {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const template = normalizeTileTemplate(config.urlTemplate);

  if (!/^https?:\/\//i.test(template)) {
    return {
      status: "error",
      errorCount: 1,
      warnings,
      suggestions: [
        "URLは http:// または https:// から始めてください。",
        "引用符付きで貼り付けた場合は自動除去しますが、URL前に説明文が混ざっていないか確認してください。"
      ],
      lastError: "URLの形式が正しくありません。"
    };
  }

  const hasZ = template.includes("{z}") || template.includes("{zoom}");
  const hasX = template.includes("{x}") || template.includes("{tileX}");
  const hasY = template.includes("{y}") || template.includes("{tileY}");
  if (!hasZ || !hasX || !hasY) {
    return {
      status: "error",
      errorCount: 1,
      warnings,
      suggestions: ["URLテンプレートに {z}/{x}/{y} または {zoom}/{tileX}/{tileY} を含めてください。"],
      lastError: "ズーム・X・Y のプレースホルダーが不足しています。"
    };
  }

  if (!imageExtensionPattern.test(template) && !xyzEndingPattern.test(template)) {
    warnings.push("URL末尾が標準的な /{z}/{x}/{y} 形式ではありません。画像拡張子なしのXYZ URLなら /{z}/{x}/{y} で終わる形を推奨します。");
    suggestions.push("例: https://example.com/tiles/{z}/{x}/{y}");
  }

  if (window.location.protocol === "https:" && template.startsWith("http://")) {
    warnings.push("HTTPSページ上でHTTPタイルを読むとMixed Contentでブロックされる可能性があります。");
    suggestions.push("可能なら https:// のタイルURLを使用してください。");
  }

  if (config.minZoom > config.maxZoom) {
    return {
      status: "error",
      errorCount: 1,
      warnings,
      suggestions: ["最小ズームは最大ズーム以下にしてください。"],
      lastError: "ズーム範囲が逆転しています。"
    };
  }

  return {
    status: warnings.length ? "warning" : "unchecked",
    errorCount: 0,
    warnings,
    suggestions
  };
}

export function latLngToTile(center: LatLngTuple, zoom: number, config: Pick<ExternalTileConfig, "scheme" | "flipY">): TileCoordinate {
  const z = Math.max(0, Math.round(zoom));
  const [lat, lng] = center;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (clampedLat * Math.PI) / 180;
  const xyzY = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  const needsFlip = config.scheme === "tms" || config.flipY;
  const requestedY = needsFlip ? n - 1 - xyzY : xyzY;
  return {
    z,
    x: clampTile(x, n),
    y: clampTile(xyzY, n),
    requestedY: clampTile(requestedY, n)
  };
}

export function buildTileUrl(template: string, tile: TileCoordinate): string {
  return normalizeTileTemplate(template)
    .replaceAll("{z}", String(tile.z))
    .replaceAll("{x}", String(tile.x))
    .replaceAll("{y}", String(tile.requestedY))
    .replaceAll("{zoom}", String(tile.z))
    .replaceAll("{tileX}", String(tile.x))
    .replaceAll("{tileY}", String(tile.requestedY));
}

export function buildLeafletTileUrl(config: ExternalTileConfig): string {
  return normalizeTileTemplate(config.urlTemplate)
    .replaceAll("{zoom}", "{z}")
    .replaceAll("{tileX}", "{x}")
    .replaceAll("{tileY}", "{y}");
}

export async function previewTile(config: ExternalTileConfig, center: LatLngTuple, zoom: number): Promise<TilePreviewResult> {
  const initial = validateTileTemplate(config);
  const isOam = isOpenAerialMapTemplate(config.urlTemplate);
  const discoveredBounds = config.bounds ? undefined : await discoverOpenAerialMapBounds(config.urlTemplate);
  const effectiveBounds = config.bounds ?? discoveredBounds;
  const previewCenter = effectiveBounds && !isCenterInsideBounds(center, effectiveBounds) ? boundsCenter(effectiveBounds) : center;
  const previewZoom = isOam && effectiveBounds ? Math.min(Math.max(zoom, 18), config.maxZoom) : zoom;
  const tile = latLngToTile(previewCenter, previewZoom, config);
  const url = buildTileUrl(config.urlTemplate, tile);
  const warnings = [...initial.warnings];
  const suggestions = [...initial.suggestions];

  if (initial.status === "error") {
    return {
      ok: false,
      url,
      tile,
      previewCenter,
      previewZoom,
      diagnostics: {
        ...initial,
        lastTestUrl: url,
        lastTile: tile,
        lastCheckedAt: new Date().toISOString()
      }
    };
  }

  if (zoom < config.minZoom || zoom > config.maxZoom) {
    warnings.push(`現在ズーム ${zoom} はレイヤーの表示範囲 ${config.minZoom}-${config.maxZoom} 外です。`);
    suggestions.push("プレビュー位置のズームを範囲内にするか、最小/最大ズームを調整してください。");
  }
  if (isOam && effectiveBounds && zoom < 18) {
    warnings.push("OpenAerialMapのオルソ画像は狭い範囲が多いため、プレビューは自動的に高ズームで試します。");
    suggestions.push("追加後は「範囲へ移動」でbbox中心へ移動してください。");
  }

  if (config.bounds && !isCenterInsideBounds(center, config.bounds)) {
    warnings.push("現在の地図中心がレイヤーbboxの外にあります。");
    suggestions.push("bboxを設定している場合は「範囲へ移動」で表示範囲へ移動してください。");
  }
  if (discoveredBounds && !isCenterInsideBounds(center, discoveredBounds)) {
    warnings.push("OpenAerialMapのメタデータからbboxを取得し、プレビューは画像範囲の中心で試しました。");
    suggestions.push("追加後はレイヤーパネルまたは外部タイル追加の「範囲へ移動」で撮影範囲へ移動してください。");
  }

  try {
    const loaded = await loadBestTileImage(config, previewCenter, previewZoom);
    return {
      ok: true,
      url: loaded.url,
      tile: loaded.tile,
      imageDataUrl: loaded.imageDataUrl,
      discoveredBounds,
      previewCenter,
      previewZoom: loaded.tile.z,
      diagnostics: {
        status: warnings.length ? "warning" : "ok",
        errorCount: 0,
        lastTestUrl: loaded.url,
        lastTile: loaded.tile,
        lastCheckedAt: new Date().toISOString(),
        warnings,
        suggestions
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "タイル画像を読み込めませんでした。";
    return {
      ok: false,
      url,
      tile,
      discoveredBounds,
      previewCenter,
      previewZoom,
      diagnostics: {
        status: "error",
        errorCount: 1,
        lastTestUrl: url,
        lastTile: tile,
        lastError: message,
        lastCheckedAt: new Date().toISOString(),
        warnings,
        suggestions: [
          ...suggestions,
          "URLテンプレートの {z}/{x}/{y} の順番がサービス仕様と一致するか確認してください。",
          "TMS配信の場合はTMSまたはY座標反転を有効にしてください。",
          "ドローン画像の範囲外を見ている場合はbbox/中心座標を指定してください。",
          "認証が必要なURL、404、HTMLエラーページ、CORS/リファラ制限の可能性があります。"
        ]
      }
    };
  }
}

export async function discoverOpenAerialMapBounds(template: string): Promise<TileBounds | undefined> {
  const cogUrl = deriveOpenAerialMapCogUrl(template);
  if (!cogUrl) return undefined;
  try {
    const endpoint = new URL("https://titiler.hotosm.org/cog/bounds");
    endpoint.searchParams.set("url", cogUrl);
    const response = await fetch(endpoint.toString());
    if (!response.ok) return undefined;
    const json = (await response.json()) as { bounds?: [number, number, number, number] };
    if (!json.bounds) return undefined;
    const [west, south, east, north] = json.bounds;
    return { west, south, east, north };
  } catch {
    return undefined;
  }
}

function deriveOpenAerialMapCogUrl(template: string): string | undefined {
  try {
    const url = new URL(normalizeTileTemplate(template));
    if (url.hostname !== "tiles.openaerialmap.org") return undefined;
    const parts = url.pathname.split("/").filter(Boolean);
    const zeroIndex = parts.indexOf("0");
    if (zeroIndex <= 0 || !parts[zeroIndex + 1]) return undefined;
    const imageId = parts[zeroIndex - 1];
    const assetId = parts[zeroIndex + 1];
    return `https://oin-hotosm-temp.s3.us-east-1.amazonaws.com/${imageId}/0/${assetId}.tif`;
  } catch {
    return undefined;
  }
}

function isOpenAerialMapTemplate(template: string): boolean {
  try {
    return new URL(normalizeTileTemplate(template)).hostname === "tiles.openaerialmap.org";
  } catch {
    return false;
  }
}

export function tileLayerWarnings(layerVisible: boolean, opacity: number, zoom: number, config?: ExternalTileConfig): string[] {
  const warnings: string[] = [];
  if (!config) return warnings;
  if (!layerVisible) warnings.push("現在このタイルレイヤーは非表示です。");
  if (opacity <= 0) warnings.push("透過率が0%のため地図上に見えません。");
  if (zoom < config.minZoom || zoom > config.maxZoom) warnings.push(`現在ズーム ${zoom} は表示範囲 ${config.minZoom}-${config.maxZoom} 外です。`);
  return warnings;
}

export function isCenterInsideBounds(center: LatLngTuple, bounds: TileBounds): boolean {
  const [lat, lng] = center;
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

export function boundsCenter(bounds: TileBounds): LatLngTuple {
  return [(bounds.south + bounds.north) / 2, (bounds.west + bounds.east) / 2];
}

function clampTile(value: number, n: number): number {
  return Math.max(0, Math.min(n - 1, value));
}

async function loadBestTileImage(config: ExternalTileConfig, center: LatLngTuple, zoom: number): Promise<{ imageDataUrl: string; url: string; tile: TileCoordinate }> {
  const zooms = [...new Set([zoom, 19, 18, 17, 16, 15].filter((z) => z >= config.minZoom && z <= config.maxZoom))];
  let lastError: unknown;
  for (const z of zooms) {
    const base = latLngToTile(center, z, config);
    const candidates = tileCandidates(base);
    for (const tile of candidates) {
      const url = buildTileUrl(config.urlTemplate, tile);
      try {
        const imageDataUrl = await loadTileImage(url);
        return { imageDataUrl, url, tile };
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("タイル画像を読み込めませんでした。");
}

function tileCandidates(base: TileCoordinate): TileCoordinate[] {
  const n = 2 ** base.z;
  const offsets = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ];
  return offsets.map(([dx, dy]) => {
    const x = clampTile(base.x + dx, n);
    const y = clampTile(base.y + dy, n);
    const requestedY = base.requestedY === base.y ? y : clampTile(base.requestedY + dy, n);
    return { z: base.z, x, y, requestedY };
  });
}

function loadTileImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.src = "";
      reject(new Error("タイムアウトしました。サーバー応答、URL、認証、CORS/リファラ制限を確認してください。"));
    }, 10000);

    image.onload = () => {
      window.clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(image.naturalWidth || 256, 256);
        canvas.height = Math.min(image.naturalHeight || 256, 256);
        const context = canvas.getContext("2d");
        context?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(url);
      }
    };
    image.onerror = async () => {
      window.clearTimeout(timeout);
      const detail = await fetchTileErrorDetail(url);
      reject(new Error(detail ?? "画像として読み込めませんでした。404、範囲外、HTMLエラーページ、認証、Mixed Content、CORS/リファラ制限が候補です。"));
    };
    image.src = url;
  });
}

async function fetchTileErrorDetail(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    if (text.includes("outside bounds")) {
      return "タイルサーバーは応答していますが、このz/x/yは画像の撮影範囲外です。bbox/中心座標を使って範囲へ移動してください。";
    }
    if (response.status === 404) {
      return `404 Not Foundです。タイルが存在しない範囲、ズーム範囲外、またはURLパターン違いの可能性があります。${contentType.includes("json") && text ? ` サーバー応答: ${text.slice(0, 160)}` : ""}`;
    }
    if (contentType.includes("text/html")) {
      return "画像ではなくHTMLが返っています。認証ページ、エラーページ、URL違いの可能性があります。";
    }
    if (!response.ok) {
      return `HTTP ${response.status} が返りました。認証、アクセス制限、URL違いの可能性があります。`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
