import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type L from "leaflet";

interface MapRegistry {
  maps: Record<string, L.Map | undefined>;
  setMap: (id: string, map?: L.Map) => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
}

const Context = createContext<MapRegistry | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const [maps, setMaps] = useState<Record<string, L.Map | undefined>>({});
  const value = useMemo<MapRegistry>(
    () => ({
      maps,
      setMap: (id, map) => setMaps((current) => ({ ...current, [id]: map })),
      flyTo: (lat, lng, zoom = 15) => {
        Object.values(maps).forEach((map) => map?.flyTo([lat, lng], zoom));
      }
    }),
    [maps]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMapRegistry() {
  const value = useContext(Context);
  if (!value) throw new Error("MapProvider is missing.");
  return value;
}
