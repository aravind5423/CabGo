'use strict';

const ORS_BASE_URL = 'https://api.openrouteservice.org';

// ── Chennai landmark coordinate table (mirrors telemetry.js) ─────────────
const KNOWN_COORDS = {
  'anna nagar':      { lat: 13.0850, lng: 80.2101 },
  't. nagar':        { lat: 13.0418, lng: 80.2341 },
  't nagar':         { lat: 13.0418, lng: 80.2341 },
  'omr':             { lat: 12.9897, lng: 80.2483 },
  'tidel park':      { lat: 12.9897, lng: 80.2483 },
  'airport':         { lat: 12.9941, lng: 80.1709 },
  'velachery':       { lat: 12.9815, lng: 80.2180 },
  'marina beach':    { lat: 13.0500, lng: 80.2824 },
  'central railway': { lat: 13.0827, lng: 80.2707 },
  'chennai central': { lat: 13.0827, lng: 80.2707 },
  'besant nagar':    { lat: 13.0003, lng: 80.2667 },
  'sholinganallur':  { lat: 12.9010, lng: 80.2279 },
  'siruseri':        { lat: 12.8335, lng: 80.2173 },
  'koyambedu':       { lat: 13.0694, lng: 80.1948 },
};

// Resolve a text address to { lat, lng } — landmark match first, then deterministic hash
function resolveCoordinates(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') {
    return { lat: 13.0827, lng: 80.2707 }; // Chennai Central default
  }
  const lower = locationStr.toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_COORDS)) {
    if (lower.includes(key)) return { ...coords };
  }
  // Deterministic hash → stable coordinates within Chennai metro bounding box
  let hash = 0;
  for (let i = 0; i < locationStr.length; i++) {
    hash = (hash << 5) - hash + locationStr.charCodeAt(i);
    hash |= 0;
  }
  const latDelta = ((Math.abs(hash) % 1000) / 1000) * 0.15 - 0.075;
  const lngDelta = ((Math.abs(hash >> 3) % 1000) / 1000) * 0.12 - 0.06;
  return {
    lat: +(13.04 + latDelta).toFixed(6),
    lng: +(80.23 + lngDelta).toFixed(6),
  };
}

// Haversine formula + 1.3× road factor to approximate driving distance
function haversineDistanceKm(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinA = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(sinA), Math.sqrt(1 - sinA));
  return +(R * c * 1.3).toFixed(1); // 1.3x road-distance factor
}

// ── OpenRouteService integration (used only when API key is present) ──────
function getApiKey() {
  return process.env.OPENROUTESERVICE_API_KEY || null; // never throws
}

async function orsRequest(url, options = {}) {
  const apiKey = getApiKey();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: apiKey,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('OpenRouteService request failed.');
  }
  return data;
}

// Convert an address into geographic coordinates [lng, lat].
async function geocodeAddress(address) {
  if (typeof address !== 'string' || !address.trim()) {
    throw new Error('A valid address is required.');
  }
  const url = new URL(`${ORS_BASE_URL}/geocode/search`);
  url.searchParams.set('text', address.trim());
  url.searchParams.set('size', '1');
  const data = await orsRequest(url.toString());
  const coordinates = data.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 ||
      !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) {
    throw new Error(`Location not found: ${address}`);
  }
  return coordinates; // [lng, lat]
}

/**
 * Get road distance in km between two address strings.
 *
 * Primary:  OpenRouteService API (live road routing) — used when OPENROUTESERVICE_API_KEY is set.
 * Fallback: Haversine formula with Chennai landmark coordinate table — always works without a key.
 *
 * @param {string} pickup
 * @param {string} destination
 * @returns {Promise<number>} distance in km, minimum 1.0
 */
async function getRoadDistanceKm(pickup, destination) {
  if (typeof pickup !== 'string' || typeof destination !== 'string' ||
      !pickup.trim() || !destination.trim()) {
    throw new Error('Pickup and destination addresses are required.');
  }

  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const [startCoords, endCoords] = await Promise.all([
        geocodeAddress(pickup),
        geocodeAddress(destination),
      ]);
      const routeData = await orsRequest(`${ORS_BASE_URL}/v2/directions/driving-car`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: [startCoords, endCoords] }),
      });
      const distanceMeters = routeData.routes?.[0]?.summary?.distance;
      if (Number.isFinite(distanceMeters) && distanceMeters > 0) {
        return Number((distanceMeters / 1000).toFixed(1));
      }
    } catch (orsErr) {
      console.warn('[fareCalculator] ORS API failed, using haversine fallback:', orsErr.message);
    }
  }

  // ── Haversine fallback ────────────────────────────────────────────────────
  const coordA = resolveCoordinates(pickup);
  const coordB = resolveCoordinates(destination);
  const dist   = haversineDistanceKm(coordA, coordB);
  return Math.max(dist, 1.0); // enforce minimum 1 km to avoid zero-fare edge cases
}

// Calculate the fare using base fare, per-kilometre rate, and per-minute rate.
// Formula: estimatedFare = base_fare + (km × per_km_rate) + (min × per_minute_rate)
function calculateFare(distanceKm, baseFare, perKmRate, durationMinutes = 0, perMinuteRate = 0) {
  const distance = Number(distanceKm);
  const base     = Number(baseFare);
  const kmRate   = Number(perKmRate);
  const duration = Number(durationMinutes || 0);
  const minRate  = Number(perMinuteRate   || 0);

  if (!Number.isFinite(distance) || distance <= 0) throw new Error('Distance must be greater than zero.');
  if (!Number.isFinite(base)     || base < 0)      throw new Error('Base fare must be zero or greater.');
  if (!Number.isFinite(kmRate)   || kmRate < 0)    throw new Error('Per-kilometre rate must be zero or greater.');
  if (!Number.isFinite(duration) || duration < 0)  throw new Error('Duration minutes must be zero or greater.');
  if (!Number.isFinite(minRate)  || minRate < 0)   throw new Error('Per-minute rate must be zero or greater.');

  return Number((base + (distance * kmRate) + (duration * minRate)).toFixed(2));
}

// Calculate fare directly using active rules from the database
async function estimateTripFare(pool, vehicleType, distanceKm, durationMinutes = 0) {
  const [rules] = await pool.execute(
    `SELECT base_fare, per_km_rate, per_minute_rate, cancellation_fee
     FROM fare_rules
     WHERE vehicle_type = ? AND status = 'active'
     LIMIT 1`,
    [vehicleType]
  );

  if (rules.length === 0) {
    // Fallback default rates if DB record missing
    const defaults = {
      sedan:     { base: 100, km: 18, min: 2.0  },
      suv:       { base: 150, km: 25, min: 3.0  },
      hatchback: { base: 80,  km: 14, min: 1.5  },
      auto:      { base: 40,  km: 10, min: 1.0  },
      bike:      { base: 25,  km: 7,  min: 0.75 },
    };
    const def = defaults[vehicleType] || defaults.sedan;
    return calculateFare(distanceKm, def.base, def.km, durationMinutes, def.min);
  }

  const rule = rules[0];
  return calculateFare(
    distanceKm,
    parseFloat(rule.base_fare),
    parseFloat(rule.per_km_rate),
    durationMinutes,
    parseFloat(rule.per_minute_rate)
  );
}

// Export the functions for use across passenger, driver, and admin modules
module.exports = {
  geocodeAddress,
  getRoadDistanceKm,
  calculateFare,
  estimateTripFare,
};
