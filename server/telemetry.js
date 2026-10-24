// server/telemetry.js
// GPS Simulation Engine & Real-Time Coordinate Interpolator for Active Trips
// Uses Server-Sent Events broker for zero-dependency push streaming

'use strict';

const sseBroker = require('./sseBroker');

// ── Known Urban Transit Waypoints (Chennai Geographic Landmarks) ─
const KNOWN_COORDS = {
  'anna nagar':       { lat: 13.0850, lng: 80.2101 },
  't. nagar':         { lat: 13.0418, lng: 80.2341 },
  't nagar':          { lat: 13.0418, lng: 80.2341 },
  'omr':              { lat: 12.9897, lng: 80.2483 },
  'tidel park':       { lat: 12.9897, lng: 80.2483 },
  'airport':          { lat: 12.9941, lng: 80.1709 },
  'velachery':        { lat: 12.9815, lng: 80.2180 },
  'marina beach':     { lat: 13.0500, lng: 80.2824 },
  'central railway':  { lat: 13.0827, lng: 80.2707 },
  'chennai central':  { lat: 13.0827, lng: 80.2707 },
  'besant nagar':     { lat: 13.0003, lng: 80.2667 },
  'sholinganallur':   { lat: 12.9010, lng: 80.2279 },
  'siruseri':         { lat: 12.8335, lng: 80.2173 },
  'koyambedu':        { lat: 13.0694, lng: 80.1948 },
};

// Fallback coordinate finder
function resolveCoordinates(locationStr, fallbackOffset = 0) {
  if (!locationStr || typeof locationStr !== 'string') {
    return { lat: 13.0827 + fallbackOffset * 0.01, lng: 80.2707 + fallbackOffset * 0.01 };
  }
  const lower = locationStr.toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_COORDS)) {
    if (lower.includes(key)) {
      return { ...coords };
    }
  }
  // Generate deterministic coordinate within Chennai metro bounding box
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

// Calculate bearing between two coordinates in degrees (0 - 360)
function calculateBearing(startLat, startLng, destLat, destLng) {
  const toRad = deg => (deg * Math.PI) / 180;
  const toDeg = rad => (rad * 180) / Math.PI;

  const y = Math.sin(toRad(destLng - startLng)) * Math.cos(toRad(destLat));
  const x =
    Math.cos(toRad(startLat)) * Math.sin(toRad(destLat)) -
    Math.sin(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.cos(toRad(destLng - startLng));

  const brng = toDeg(Math.atan2(y, x));
  return Math.round((brng + 360) % 360);
}

// ── Active Simulated Trip Telemetry Sessions ─────────────────
// activeSimulations: Map<tripId, { timer, currentStep, totalSteps, waypoints, lastPayload }>
const activeSimulations = new Map();

/**
 * Generate interpolated waypoints along a simulated route
 */
function generateRouteWaypoints(pickupStr, destinationStr, totalSteps = 30) {
  const start = resolveCoordinates(pickupStr, 0);
  const end   = resolveCoordinates(destinationStr, 1);

  const waypoints = [];
  const bearing = calculateBearing(start.lat, start.lng, end.lat, end.lng);

  for (let i = 0; i <= totalSteps; i++) {
    const t = i / totalSteps;
    // Add realistic road curve micro-variation
    const curveDeviation = Math.sin(t * Math.PI) * 0.0035;
    const lat = +(start.lat + (end.lat - start.lat) * t + curveDeviation).toFixed(6);
    const lng = +(start.lng + (end.lng - start.lng) * t - curveDeviation * 0.5).toFixed(6);

    waypoints.push({
      lat,
      lng,
      bearing,
      progress: Math.round(t * 100),
    });
  }

  return waypoints;
}

/**
 * Start or resume simulated GPS telemetry stream for an active trip
 */
function startTripSimulation(tripId, pickupStr, destinationStr, estimatedKm = 10) {
  const tId = String(tripId);

  // If already running, do not start duplicate timer
  if (activeSimulations.has(tId)) {
    return activeSimulations.get(tId).lastPayload;
  }

  const totalSteps = 24; // 24 steps * 2.5s = ~60 seconds simulated transit demonstration
  const waypoints  = generateRouteWaypoints(pickupStr, destinationStr, totalSteps);

  const simState = {
    currentStep: 0,
    totalSteps,
    waypoints,
    lastPayload: {
      trip_id:          tripId,
      lat:              waypoints[0].lat,
      lng:              waypoints[0].lng,
      bearing:          waypoints[0].bearing,
      speed_kmh:        0,
      eta_minutes:      Math.ceil(estimatedKm * 2.2),
      progress_percent: 0,
      status:           'in_progress',
    },
    timer: null,
  };

  activeSimulations.set(tId, simState);

  // Broadcast initial position
  sseBroker.broadcastToTrip(tripId, 'telemetry', simState.lastPayload);

  // Step interval (every 2.5 seconds)
  simState.timer = setInterval(() => {
    if (simState.currentStep < totalSteps) {
      simState.currentStep++;
      const point = waypoints[simState.currentStep];
      const remainingProgress = (totalSteps - simState.currentStep) / totalSteps;
      const speed = simState.currentStep === totalSteps ? 0 : Math.round(36 + Math.sin(simState.currentStep) * 12);

      const payload = {
        trip_id:          tripId,
        lat:              point.lat,
        lng:              point.lng,
        bearing:          point.bearing,
        speed_kmh:        speed,
        eta_minutes:      Math.max(1, Math.ceil(estimatedKm * 2.2 * remainingProgress)),
        progress_percent: point.progress,
        status:           simState.currentStep === totalSteps ? 'arrived' : 'in_progress',
      };

      simState.lastPayload = payload;
      sseBroker.broadcastToTrip(tripId, 'telemetry', payload);

      if (simState.currentStep === totalSteps) {
        clearInterval(simState.timer);
        sseBroker.broadcastToTrip(tripId, 'trip_arrived', {
          trip_id: tripId,
          message: 'Vehicle has arrived at the destination!',
        });
      }
    }
  }, 2500);

  if (simState.timer.unref) {
    simState.timer.unref();
  }

  return simState.lastPayload;
}

/**
 * Stop and clean up simulation when trip is completed or cancelled
 */
function stopTripSimulation(tripId) {
  const tId = String(tripId);
  if (activeSimulations.has(tId)) {
    const sim = activeSimulations.get(tId);
    if (sim.timer) clearInterval(sim.timer);
    activeSimulations.delete(tId);
  }
}

/**
 * Get current coordinates / state of an ongoing trip
 */
function getTripCoordinates(tripId, pickupStr = '', destinationStr = '') {
  const tId = String(tripId);
  if (activeSimulations.has(tId)) {
    return activeSimulations.get(tId).lastPayload;
  }
  const start = resolveCoordinates(pickupStr);
  return {
    trip_id:          tripId,
    lat:              start.lat,
    lng:              start.lng,
    bearing:          0,
    speed_kmh:        0,
    eta_minutes:      12,
    progress_percent: 0,
    status:           'accepted',
  };
}

module.exports = {
  resolveCoordinates,
  calculateBearing,
  generateRouteWaypoints,
  startTripSimulation,
  stopTripSimulation,
  getTripCoordinates,
};
