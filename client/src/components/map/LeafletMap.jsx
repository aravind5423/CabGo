import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue with Vite/webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const dropIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/**
 * LeafletMap - Real OpenStreetMap-powered GIS map component
 * @param {[number, number]} pickupCoords - [lat, lng] of pickup
 * @param {[number, number]} dropCoords - [lat, lng] of destination
 * @param {[number, number]} driverCoords - [lat, lng] of driver (live)
 */
export default function LeafletMap({ pickupCoords, dropCoords, driverCoords }) {
  const center = pickupCoords || [13.0827, 80.2707]; // Default: Chennai

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '400px', width: '100%', borderRadius: '16px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pickupCoords && (
        <Marker position={pickupCoords} icon={pickupIcon}>
          <Popup>📍 Pickup Location</Popup>
        </Marker>
      )}
      {dropCoords && (
        <Marker position={dropCoords} icon={dropIcon}>
          <Popup>🏁 Destination</Popup>
        </Marker>
      )}
      {driverCoords && (
        <Marker position={driverCoords} icon={driverIcon}>
          <Popup>🚖 Driver Partner</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
