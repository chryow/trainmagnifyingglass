// Loads Leaflet (open-source maps) from the unpkg CDN on first use, with
// subresource-integrity hashes so a tampered CDN file is refused. Loading it
// lazily keeps it out of the main bundle for pages without a map.

const VERSION = '1.9.4';
const CSS_URL = `https://unpkg.com/leaflet@${VERSION}/dist/leaflet.css`;
const CSS_SRI = 'sha512-Zcn6bjR/8RZbLEpLIeOwNtzREBAJnUKESxces60Mpoj+2okopSAcSUIUOseddDm0cxnGQzxIR7vJgsLZbdLE3w==';
const JS_URL = `https://unpkg.com/leaflet@${VERSION}/dist/leaflet.js`;
const JS_SRI = 'sha512-BwHfrr4c9kmRkLw6iXFdzcdWV/PGkVgiIyIWLLlTSXzWQzxuSg4DiQUCpauz/EWjgk5TYQqX/kvn9pG1NpYfqg==';

export const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Jakarta, used when there is nothing else to centre on */
export const DEFAULT_CENTER: [number, number] = [-6.2, 106.8166];

// Minimal typings for the parts of Leaflet this app uses.
export interface LatLng { lat: number; lng: number }
export interface LMarker {
  addTo(map: LMap): LMarker;
  setLatLng(ll: [number, number]): LMarker;
  getLatLng(): LatLng;
  on(event: string, fn: (e: { target: LMarker }) => void): LMarker;
  bindTooltip(content: string, opts?: Record<string, unknown>): LMarker;
  remove(): void;
}
export interface LMap {
  setView(center: [number, number], zoom?: number, opts?: Record<string, unknown>): LMap;
  fitBounds(bounds: [number, number][], opts?: Record<string, unknown>): LMap;
  on(event: string, fn: (e: { latlng: LatLng }) => void): LMap;
  getZoom(): number;
  invalidateSize(): void;
  remove(): void;
}
export interface Leaflet {
  map(el: HTMLElement, opts?: Record<string, unknown>): LMap;
  tileLayer(url: string, opts?: Record<string, unknown>): { addTo(map: LMap): unknown };
  marker(ll: [number, number], opts?: Record<string, unknown>): LMarker;
  divIcon(opts: Record<string, unknown>): unknown;
}

let loading: Promise<Leaflet> | null = null;

export function loadLeaflet(): Promise<Leaflet> {
  const existing = (window as unknown as { L?: Leaflet }).L;
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;

  loading = new Promise<Leaflet>((resolve, reject) => {
    if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS_URL;
      link.integrity = CSS_SRI;
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = JS_URL;
    script.integrity = JS_SRI;
    script.crossOrigin = '';
    script.async = true;
    script.onload = () => {
      const L = (window as unknown as { L?: Leaflet }).L;
      if (L) resolve(L);
      else reject(new Error('Map library failed to initialise.'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the map. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** The app's map pin: a small gem-gradient teardrop instead of Leaflet's default blue marker. */
export function gemPin(L: Leaflet, active = false) {
  const size = active ? 36 : 30;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#c96685,#8f74c2 52%,#5e6ec2);border:3px solid white;box-shadow:0 4px 10px rgba(28,20,51,.35)"></span>`,
  });
}

export interface PlaceResult { label: string; lat: number; lng: number }

/**
 * Address search via OpenStreetMap's Nominatim. Their usage policy allows
 * light use (max 1 request/second), so only call this on explicit submit.
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } });
  if (!res.ok) throw new Error('Place search is unavailable right now.');
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}
