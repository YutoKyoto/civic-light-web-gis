import type { ProjectState } from "../types";

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function readProjectFile(file: File): Promise<ProjectState> {
  const text = await file.text();
  const parsed = JSON.parse(text) as ProjectState;
  if (parsed.schemaVersion !== 1) throw new Error("未対応のプロジェクト形式です。");
  return parsed;
}

export function updateUrlShareParams(center: [number, number], zoom: number, baseMap: string, layerIds: string[]) {
  const params = new URLSearchParams(window.location.search);
  params.set("lat", center[0].toFixed(6));
  params.set("lng", center[1].toFixed(6));
  params.set("z", String(zoom));
  params.set("base", baseMap);
  params.set("layers", layerIds.join(","));
  window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
}

export function readUrlMapState() {
  const params = new URLSearchParams(window.location.search);
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const zoom = Number(params.get("z"));
  return {
    center: Number.isFinite(lat) && Number.isFinite(lng) ? ([lat, lng] as [number, number]) : undefined,
    zoom: Number.isFinite(zoom) ? zoom : undefined,
    baseMap: params.get("base") ?? undefined,
    layers: params.get("layers")?.split(",").filter(Boolean) ?? undefined
  };
}
