import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Known Chennai landmarks — mirrors the server-side geocoding table so client
// previews line up with the simulated telemetry route.
const CHENNAI_WAYPOINTS = {
  'chennai central': [13.0827, 80.2707],
  'central railway': [13.0827, 80.2707],
  'anna nagar':      [13.0850, 80.2101],
  't. nagar':        [13.0418, 80.2341],
  't nagar':         [13.0418, 80.2341],
  'ranganathan':     [13.0418, 80.2341],
  'airport':         [12.9941, 80.1709],
  'omr':             [12.9897, 80.2483],
  'tidel park':      [12.9897, 80.2483],
  'velachery':       [12.9815, 80.2180],
  'phoenix market':  [12.9915, 80.2170],
  'marina beach':    [13.0500, 80.2824],
  'besant nagar':    [13.0003, 80.2667],
  'sholinganallur':  [12.9010, 80.2279],
  'siruseri':        [12.8335, 80.2173],
  'koyambedu':       [13.0694, 80.1948],
};

/** Normalises [lat, lng], {lat, lng} or a landmark string into [lat, lng]. */
export function resolveLatLng(input) {
  if (input === null || input === undefined || input === '') return null;
  if (Array.isArray(input) && input.length >= 2) {
    const lat = Number(input[0]); const lng = Number(input[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }
  if (typeof input === 'object') {
    const lat = Number(input.lat); const lng = Number(input.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }
  if (typeof input === 'string') {
    const lower = input.toLowerCase();
    for (const [key, coords] of Object.entries(CHENNAI_WAYPOINTS)) {
      if (lower.includes(key)) return coords;
    }
    // Deterministic fallback inside the Chennai metro area
    let hash = 0;
    for (let i = 0; i < input.length; i++) { hash = (hash << 5) - hash + input.charCodeAt(i); hash |= 0; }
    const latDelta = ((Math.abs(hash) % 1000) / 1000) * 0.15 - 0.075;
    const lngDelta = ((Math.abs(hash >> 3) % 1000) / 1000) * 0.12 - 0.06;
    return [+(13.04 + latDelta).toFixed(6), +(80.23 + lngDelta).toFixed(6)];
  }
  return null;
}

const pinIcon = (color, svgPath) => L.divIcon({
  html: `
    <div style="width:30px;height:30px;border-radius:50%;background:${color};border:3px solid #fff;
                box-shadow:0 2px 8px rgba(15,23,42,0.3);display:flex;align-items:center;justify-content:center;color:#fff;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>
    </div>`,
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -16],
});

const PICKUP_ICON = pinIcon('#16A34A', '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>');
const DROP_ICON   = pinIcon('#DC2626', '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>');

const carIcon = (bearing = 0) => L.divIcon({
  html: `
    <div style="width:38px;height:38px;display:flex;align-items:center;justify-content:center;transform:rotate(${bearing}deg);transition:transform 0.4s ease;">
      <div style="width:34px;height:34px;border-radius:50%;background:#0F172A;border:3px solid #fff;
                  box-shadow:0 0 0 4px rgba(15,23,42,0.12),0 3px 10px rgba(15,23,42,0.4);display:flex;align-items:center;justify-content:center;color:#fff;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11 2 11.5 2 12v4c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
        </svg>
      </div>
    </div>`,
  className: '',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -20],
});

function AutoFitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 14);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/**
 * Route map: pickup + destination pins, optional live vehicle marker.
 * Accepts coordinates or landmark address strings for each point.
 */
export default function LeafletMap({ pickupCoords, dropCoords, driverCoords, bearing = 0, height = '100%', zoom = 13 }) {
  const pCoords = resolveLatLng(pickupCoords);
  const dCoords = resolveLatLng(dropCoords);
  const vCoords = resolveLatLng(driverCoords);

  const center = vCoords || pCoords || [13.0827, 80.2707];
  const route = [pCoords, dCoords].filter(Boolean);
  const bounds = [pCoords, dCoords].filter(Boolean); // vehicle moves along route; keep bounds stable

  return (
    <div style={{ height, width: '100%', minHeight: 240 }} className="relative overflow-hidden">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        {bounds.length > 0 && <AutoFitBounds points={bounds} />}

        {route.length >= 2 && (
          <Polyline positions={route} pathOptions={{ color: '#16A34A', weight: 4, opacity: 0.85, dashArray: '8 8', lineCap: 'round' }} />
        )}

        {pCoords && (
          <Marker position={pCoords} icon={PICKUP_ICON}>
            <Popup><div className="text-xs"><div className="font-semibold text-emerald-700">Pickup</div><div className="text-slate-600">{typeof pickupCoords === 'string' ? pickupCoords : 'Pickup point'}</div></div></Popup>
          </Marker>
        )}
        {dCoords && (
          <Marker position={dCoords} icon={DROP_ICON}>
            <Popup><div className="text-xs"><div className="font-semibold text-rose-700">Destination</div><div className="text-slate-600">{typeof dropCoords === 'string' ? dropCoords : 'Drop-off point'}</div></div></Popup>
          </Marker>
        )}
        {vCoords && (
          <Marker position={vCoords} icon={carIcon(bearing)} zIndexOffset={1000}>
            <Popup><div className="text-xs"><div className="font-semibold text-slate-900">Vehicle</div><div className="text-slate-600">Live position</div></div></Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
