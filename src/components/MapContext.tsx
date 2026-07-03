import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type L from "leaflet";

interface MapRegistry {
  maps: Record<string, L.Map | undefined>;
  setMap: (id: string, map?: L.Map) => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
}

const Context = createContext<MapRegistry | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const mapsRef = useRef<Record<string, L.Map | undefined>>({});
  const setMap = useCallback((id: string, map?: L.Map) => {
    mapsRef.current = { ...mapsRef.current, [id]: map };
  }, []);
  const flyTo = useCallback((lat: number, lng: number, zoom = 15) => {
    Object.values(mapsRef.current).forEach((map) => map?.flyTo([lat, lng], zoom));
  }, []);
  const value = useMemo<MapRegistry>(
    () => ({
      maps: mapsRef.current,
      setMap,
      flyTo
    }),
    [flyTo, setMap]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMapRegistry() {
  const value = useContext(Context);
  if (!value) throw new Error("MapProvider is missing.");
  return value;
}
