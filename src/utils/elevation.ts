export interface ElevationResponse {
  elevation: number | null;
  hsrc?: string;
}

// 国土地理院 標高API:
// https://maps.gsi.go.jp/development/elevation.html
// 利用時は国土地理院の利用規約・出典表記を確認してください。
export async function fetchGsiElevation(lat: number, lng: number): Promise<ElevationResponse> {
  const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("標高APIの取得に失敗しました。");
  const json = (await response.json()) as { elevation?: number | "-----"; hsrc?: string };
  return {
    elevation: typeof json.elevation === "number" ? json.elevation : null,
    hsrc: json.hsrc
  };
}
