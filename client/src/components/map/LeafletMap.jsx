import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Known Chennai Landmark Waypoint Geocoding Dictionary
const CHENNAI_WAYPOINTS = {
  'chennai central': [13.0827, 80.2707],
  'central railway': [13.0827, 80.2707],
  'anna nagar': [13.0850, 80.2101],
  't. nagar': [13.0418, 80.2341],
  't nagar': [13.0418, 80.2341],
  'ranganathan': [13.0418, 80.2341],
  'airport': [12.9941, 80.1709],
  'chennai airport': [12.9941, 80.1709],
  'omr': [12.9897, 80.2483],
  'tidel park': [12.9897, 80.2483],
  'velachery': [12.9815, 80.2180],
  'phoenix market': [12.9915, 80.2170],
  'marina beach': [13.0500, 80.2824],
  'besant nagar': [13.0003, 80.2667],
  'sholinganallur': [12.9010, 80.2279],
  'siruseri': [12.8335, 80.2173],
  'koyambedu': [13.0694, 80.1948],
};

/**
 * Normalizes [lat, lng], {lat, lng}, or landmark address string into [number, number]
 */
export function resolveLatLng(input) {
  if (!input) return null;
  if (Array.isArray(input) && input.length >= 2) {
    const lat = Number(input[0]);
    const lng = Number(input[1]);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  }
  if (typeof input === 'object' && input.lat && input.lng) {
    return [Number(input.lat), Number(input.lng)];
  }
  if (typeof input === 'string') {
    const lower = input.toLowerCase();
    for (const [key, coords] of Object.entries(CHENNAI_WAYPOINTS)) {
      if (lower.includes(key)) {
        return coords;
      }
    }
    // Deterministic fallback inside Chennai Metro bounds
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    const latDelta = ((Math.abs(hash) % 1000) / 1000) * 0.12 - 0.06;
    const lngDelta = ((Math.abs(hash >> 3) % 1000) / 1000) * 0.10 - 0.05;
    return [+(13.05 + latDelta).toFixed(4), +(80.24 + lngDelta).toFixed(4)];
  }
  return null;
}

// Custom Marker Icons (Inline SVG, Zero external asset latency)
const createPickupDivIcon = () =>
  L.divIcon({
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(16, 185, 129, 0.35); animation: pulse-glow 2s infinite;"></div>
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10B981, #047857);
          border: 2.5px solid #ffffff;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.5), 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `,
    className: 'rydio-pickup-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });

const createDropDivIcon = () =>
  L.divIcon({
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(239, 68, 68, 0.3); animation: pulse-glow 2s infinite;"></div>
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #EF4444, #B91C1C);
          border: 2.5px solid #ffffff;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.5), 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
      </div>
    `,
    className: 'rydio-drop-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });

const createCarDivIcon = (bearing = 0) =>
  L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${bearing}deg);
        transition: transform 0.4s ease;
      ">
        <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(245, 158, 11, 0.4); animation: pulse-glow 2s infinite;"></div>
        <div style="
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          border: 2.5px solid #ffffff;
          box-shadow: 0 0 18px rgba(245, 158, 11, 0.8), 0 3px 8px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11 2 11.5 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    className: 'rydio-vehicle-marker',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -22],
  });

function AutoFitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    const validPoints = points.filter(Boolean);
    if (validPoints.length > 1) {
      map.fitBounds(validPoints, { padding: [40, 40], maxZoom: 15, animate: true, duration: 0.8 });
    } else if (validPoints.length === 1) {
      map.setView(validPoints[0], 14, { animate: true });
    }
  }, [points, map]);
  return null;
}

export default function LeafletMap({
  pickupCoords,
  dropCoords,
  driverCoords,
  bearing = 0,
  height = '100%',
  zoom = 13,
  theme = 'voyager',
}) {
  const pCoords = resolveLatLng(pickupCoords);
  const dCoords = resolveLatLng(dropCoords);
  const vCoords = resolveLatLng(driverCoords);

  const center = vCoords || pCoords || [13.0827, 80.2707];

  const polylinePoints = [];
  if (pCoords) polylinePoints.push(pCoords);
  if (vCoords && pCoords && dCoords) {
    polylinePoints.push(vCoords);
  }
  if (dCoords) polylinePoints.push(dCoords);

  const allPoints = [pCoords, dCoords, vCoords].filter(Boolean);

  const tileUrl =
    theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  return (
    <div style={{ height, width: '100%', minHeight: '260px' }} className="relative overflow-hidden rounded-2xl shadow-inner">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', borderRadius: '16px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'
          url={tileUrl}
          subdomains="abcd"
          maxZoom={20}
        />

        {allPoints.length > 0 && <AutoFitBounds points={allPoints} />}

        {/* Pickup Pin */}
        {pCoords && (
          <Marker position={pCoords} icon={createPickupDivIcon()}>
            <Popup>
              <div className="font-sans text-xs p-1">
                <span className="font-bold text-emerald-700 block flex items-center gap-1">
                  Pickup Location
                </span>
                <span className="text-slate-600 mt-0.5 block">{typeof pickupCoords === 'string' ? pickupCoords : 'Passenger Pickup'}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Pin */}
        {dCoords && (
          <Marker position={dCoords} icon={createDropDivIcon()}>
            <Popup>
              <div className="font-sans text-xs p-1">
                <span className="font-bold text-rose-700 block flex items-center gap-1">
                  Destination
                </span>
                <span className="text-slate-600 mt-0.5 block">{typeof dropCoords === 'string' ? dropCoords : 'Passenger Destination'}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Driver Partner Pin */}
        {vCoords && (
          <Marker position={vCoords} icon={createCarDivIcon(bearing)}>
            <Popup>
              <div className="font-sans text-xs p-1">
                <span className="font-bold text-amber-600 block flex items-center gap-1">
                  Rydio Driver Partner
                </span>
                <span className="text-slate-600 mt-0.5 block">Live GPS Telemetry Active</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Route Polyline */}
        {polylinePoints.length >= 2 && (
          <Polyline
            positions={polylinePoints}
            pathOptions={{
              color: '#16A34A',
              weight: 4.5,
              opacity: 0.9,
              dashArray: '8, 8',
              lineCap: 'round',
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
