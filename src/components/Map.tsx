import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  loadLeaflet, gemPin, searchPlaces, OSM_TILES, OSM_ATTRIBUTION, DEFAULT_CENTER,
  type Leaflet, type LMap, type LMarker, type PlaceResult,
} from '@/lib/leaflet';
import { LoadingSpinner } from '@/components/States';
import { Crosshair, Search, Trash2, MapPin } from 'lucide-react';

export interface MapPoint { id: string; lat: number; lng: number; title: string }

/** Creates a Leaflet map in a div and tears it down on unmount. */
function useLeafletMap(opts: { center?: [number, number]; zoom?: number; interactive?: boolean } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ L: Leaflet; map: LMap } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: LMap | null = null;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !ref.current) return;
        map = L.map(ref.current, {
          zoomControl: opts.interactive !== false,
          dragging: opts.interactive !== false,
          scrollWheelZoom: false, // don't hijack page scrolling
          attributionControl: true,
        }).setView(opts.center ?? DEFAULT_CENTER, opts.zoom ?? 12);
        L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
        setState({ L, map });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      map?.remove();
      setState(null);
    };
    // Map is created once; later changes go through the returned map instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, L: state?.L ?? null, map: state?.map ?? null, error };
}

function MapFrame({ mapRef, error, className, loaded }: { mapRef: React.RefObject<HTMLDivElement>; error: string | null; className: string; loaded: boolean }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-3xl bg-stone-100 dark:bg-stone-800 ${className}`}>
      <div ref={mapRef} className="absolute inset-0" />
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-stone-400"><LoadingSpinner /></div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-stone-500">{error}</div>
      )}
    </div>
  );
}

/** Read-only map of one or many gems. Fits the view to all pins. */
export function GemsMap({ points, onSelect, className = 'h-80' }: { points: MapPoint[]; onSelect?: (id: string) => void; className?: string }) {
  const { ref, L, map, error } = useLeafletMap({ zoom: 12 });

  useEffect(() => {
    if (!L || !map) return;
    const markers: LMarker[] = points.map((p) => {
      const m = L.marker([p.lat, p.lng], { icon: gemPin(L), title: p.title, keyboard: true }).addTo(map);
      m.bindTooltip(p.title, { direction: 'top', offset: [0, -28] });
      if (onSelect) m.on('click', () => onSelect(p.id));
      return m;
    });
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15);
    else if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 15 });
    return () => markers.forEach((m) => m.remove());
  }, [L, map, points, onSelect]);

  return <MapFrame mapRef={ref} error={error} className={className} loaded={!!map} />;
}

export interface Coords { lat: number; lng: number }

/**
 * Lets the author drop a pin for a gem: tap the map, drag the pin, search an
 * address, or use the device's location.
 */
export function LocationPicker({ value, onChange, suggestedQuery = '' }: { value: Coords | null; onChange: (c: Coords | null) => void; suggestedQuery?: string }) {
  const { ref, L, map, error } = useLeafletMap({
    center: value ? [value.lat, value.lng] : undefined,
    zoom: value ? 16 : 11,
  });
  const markerRef = useRef<LMarker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState<'search' | 'locate' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Tap/click the map to place the pin
  useEffect(() => {
    if (!map) return;
    map.on('click', (e) => onChangeRef.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }));
  }, [map]);

  // Keep the marker in sync with the value
  useEffect(() => {
    if (!L || !map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    } else {
      markerRef.current = L.marker([value.lat, value.lng], { icon: gemPin(L, true), draggable: true }).addTo(map);
      markerRef.current.on('dragend', (e) => {
        const ll = e.target.getLatLng();
        onChangeRef.current({ lat: round(ll.lat), lng: round(ll.lng) });
      });
    }
  }, [L, map, value]);

  const flyTo = (c: Coords) => map?.setView([c.lat, c.lng], Math.max(map.getZoom(), 16));

  const runSearch = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = (query || suggestedQuery).trim();
    if (!q || busy) return;
    setBusy('search');
    setMessage(null);
    try {
      const found = await searchPlaces(q);
      setResults(found);
      if (found.length === 0) setMessage('No places found. Try a nearby street or landmark, or tap the map.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setBusy(null);
    }
  };

  const pick = (r: PlaceResult) => {
    const c = { lat: round(r.lat), lng: round(r.lng) };
    onChange(c);
    flyTo(c);
    setResults([]);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setMessage("This device can't share its location."); return; }
    setBusy('locate');
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
        onChange(c);
        flyTo(c);
        setBusy(null);
      },
      () => { setMessage('Location access was denied. Search for the place or tap the map instead.'); setBusy(null); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-3">
      <form onSubmit={runSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            className="input pl-10"
            placeholder={suggestedQuery ? `Search “${suggestedQuery}”` : 'Search an address or landmark'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search for the place on the map"
          />
        </div>
        <button type="submit" className="btn-secondary shrink-0" disabled={busy !== null}>
          {busy === 'search' ? <LoadingSpinner size={16} /> : 'Find'}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 dark:divide-stone-800 dark:border-stone-700">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" onClick={() => pick(r)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                <span className="line-clamp-2">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <MapFrame mapRef={ref} error={error} className="h-64 sm:h-72" loaded={!!map} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={useMyLocation} className="btn-outline py-2" disabled={busy !== null}>
          {busy === 'locate' ? <LoadingSpinner size={16} /> : <Crosshair className="h-4 w-4" />} Use my location
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="btn-ghost py-2 text-stone-500">
            <Trash2 className="h-4 w-4" /> Remove pin
          </button>
        )}
        <p className="ml-auto text-xs text-stone-400">
          {value ? `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} · drag to adjust` : 'Tap the map to drop a pin'}
        </p>
      </div>
      {message && <p role="status" className="text-sm text-stone-500 dark:text-stone-400">{message}</p>}
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}
