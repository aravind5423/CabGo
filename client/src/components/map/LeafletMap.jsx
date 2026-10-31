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

// Custom Marker Icons (Zero external image dependencies, Retina-ready)
const createPickupDivIcon = () =>
  L.divIcon({
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #10B981;
        border: 2.5px solid #ffffff;
        box-shadow: 0 0 14px rgba(16, 185, 129, 0.8), 0 3px 8px rgba(0,0,0,0.5);
      ">
        <span style="font-size: 15px; line-height: 1;">📍</span>
      </div>
    `,
    className: 'cabgo-pickup-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });

const createDropDivIcon = () =>
  L.divIcon({
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #EF4444;
        border: 2.5px solid #ffffff;
        box-shadow: 0 0 14px rgba(239, 68, 68, 0.8), 0 3px 8px rgba(0,0,0,0.5);
      ">
        <span style="font-size: 15px; line-height: 1;">🏁</span>
      </div>
    `,
    className: 'cabgo-drop-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });

// Custom Car Marker with animated glow & bearing rotation
const createCarDivIcon = (bearing = 0) =>
  L.divIcon({
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(245,158,11,0.98) 0%, rgba(217,119,6,0.9) 100%);
        border: 2.5px solid #ffffff;
        box-shadow: 0 0 18px rgba(245, 158, 11, 0.95), 0 3px 8px rgba(0,0,0,0.6);
        transform: rotate(${bearing}deg);
        transition: transform 0.4s ease;
      ">
        <span style="font-size: 20px; line-height: 1;">🚖</span>
      </div>
    `,
    className: 'cabgo-vehicle-marker',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });

// Auto-adjusts view bounds when coordinates change
function AutoFitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    const validPoints = points.filter(Boolean);
    if (validPoints.length > 1) {
      map.fitBounds(validPoints, { padding: [40, 40], maxZoom: 15 });
    } else if (validPoints.length === 1) {
      map.setView(validPoints[0], 14);
    }
  }, [points, map]);
  return null;
}

/**
 * LeafletMap Component
 * - Uses CartoDB Voyager public CDN tiles (reliable, free, complies with web app tile usage policies)
 * - Self-contained SVG/HTML markers for Pickup (Green), Destination (Red), and Driver (🚖 with bearing)
 * - Connecting Route Polyline
 * - Dynamic bounds auto-fit
 */
export default function LeafletMap({
  pickupCoords,
  dropCoords,
  driverCoords,
  bearing = 0,
  height = '100%',
  zoom = 13,
  theme = 'voyager', // 'voyager' | 'dark'
}) {
  const pCoords = resolveLatLng(pickupCoords);
  const dCoords = resolveLatLng(dropCoords);
  const vCoords = resolveLatLng(driverCoords);

  const center = vCoords || pCoords || [13.0827, 80.2707];

  // Build active route polyline coordinates
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
    <div style={{ height, width: '100%', minHeight: '260px' }}>
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
              <div className="font-sans text-xs">
                <span className="font-bold text-emerald-700 block">📍 Pickup Location</span>
                <span>{typeof pickupCoords === 'string' ? pickupCoords : 'Passenger Pickup'}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Pin */}
        {dCoords && (
          <Marker position={dCoords} icon={createDropDivIcon()}>
            <Popup>
              <div className="font-sans text-xs">
                <span className="font-bold text-red-700 block">🏁 Destination</span>
                <span>{typeof dropCoords === 'string' ? dropCoords : 'Passenger Destination'}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Driver Partner Pin with Heading */}
        {vCoords && (
          <Marker position={vCoords} icon={createCarDivIcon(bearing)}>
            <Popup>
              <div className="font-sans text-xs">
                <span className="font-bold text-amber-600 block">🚖 CabGo Driver Partner</span>
                <span>Live GPS Radar Telemetry</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Route Polyline (Amber Dash) */}
        {polylinePoints.length >= 2 && (
          <Polyline
            positions={polylinePoints}
            pathOptions={{
              color: '#F59E0B',
              weight: 4,
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
