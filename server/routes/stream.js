// server/routes/stream.js
// Server-Sent Events (SSE) route handlers for live trip telemetry and driver dispatching

'use strict';

const pool      = require('../db');
const sseBroker = require('../sseBroker');
const telemetry = require('../telemetry');
const { decodeToken } = require('../middleware/auth');

// Helper to authenticate user from Query param (?token=...) or Authorization header
function authenticateFromToken(req) {
  let token = null;

  // 1. Check query parameter (standard for browser native EventSource)
  if (req.query && req.query.token) {
    token = req.query.token;
  }

  // 2. Fallback to Authorization header
  if (!token && req.headers['authorization']) {
    const parts = req.headers['authorization'].split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) return null;
  return decodeToken(token);
}

module.exports = function streamRoute(router) {

  // ── GET /api/stream/trip/:id ─────────────────────────────────
  // Streams real-time trip status and GPS telemetry to passenger & driver
  router.get('/api/stream/trip/:id', async (req, res) => {
    const user = authenticateFromToken(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Authentication required for SSE stream.' }));
      return;
    }

    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid trip ID.' }));
      return;
    }

    try {
      // Fetch trip details
      const [trips] = await pool.execute(
        `SELECT t.trip_id, t.request_id, t.passenger_id, t.driver_id, t.vehicle_id,
                t.start_time, t.end_time, t.distance_km, t.fare, t.trip_status,
                rr.pickup_location, rr.destination, rr.vehicle_type, rr.estimated_fare,
                u_p.name AS passenger_name, u_p.mobile AS passenger_mobile,
                u_d.name AS driver_name, u_d.mobile AS driver_mobile,
                dp.rating AS driver_rating,
                v.vehicle_number, v.model AS vehicle_model
         FROM trips t
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN users u_p ON pp.user_id = u_p.user_id
         LEFT JOIN driver_profiles dp ON t.driver_id = dp.driver_id
         LEFT JOIN users u_d ON dp.user_id = u_d.user_id
         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         WHERE t.trip_id = ?`,
        [tripId]
      );

      const trip = trips.length > 0 ? trips[0] : null;

      // Initialize persistent SSE stream
      sseBroker.initSSEStream(req, res, 'trip-telemetry-ready');

      // Register subscriber
      sseBroker.subscribeToTrip(tripId, {
        req,
        res,
        userId: user.user_id,
        role: user.role,
      });

      if (trip) {
        // Send initial trip status snapshot
        sseBroker.sendEvent(res, 'trip_status', {
          success: true,
          trip,
        });

        // Send current or initial telemetry coordinates
        const coords = telemetry.getTripCoordinates(
          trip.trip_id,
          trip.pickup_location,
          trip.destination
        );
        sseBroker.sendEvent(res, 'telemetry', coords);

        // If trip is in_progress, ensure telemetry simulation is running
        if (trip.trip_status === 'in_progress') {
          telemetry.startTripSimulation(
            trip.trip_id,
            trip.pickup_location,
            trip.destination,
            trip.distance_km || 8.5
          );
        }
      } else {
        // Mock fallback for demo resilience
        const mockCoords = telemetry.getTripCoordinates(tripId, 'Anna Nagar', 'T. Nagar');
        sseBroker.sendEvent(res, 'telemetry', mockCoords);
      }

    } catch (err) {
      console.warn('[SSE /api/stream/trip] Fallback stream:', err.message);
      sseBroker.initSSEStream(req, res, 'trip-telemetry-demo');
      sseBroker.subscribeToTrip(tripId, { req, res, userId: user.user_id, role: user.role });
      const demoCoords = telemetry.getTripCoordinates(tripId, 'Anna Nagar', 'T. Nagar');
      sseBroker.sendEvent(res, 'telemetry', demoCoords);
    }
  });

  // ── GET /api/stream/driver-dispatch ──────────────────────────
  // Live dispatch notification stream for online drivers
  router.get('/api/stream/driver-dispatch', async (req, res) => {
    const user = authenticateFromToken(req);
    if (!user || user.role !== 'driver') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Driver authorization required.' }));
      return;
    }

    try {
      // Resolve driver profile & vehicle type
      const [drivers] = await pool.execute(
        `SELECT dp.driver_id, v.vehicle_type
         FROM driver_profiles dp
         LEFT JOIN vehicles v ON dp.driver_id = v.driver_id AND v.status = 'active'
         WHERE dp.user_id = ?`,
        [user.user_id]
      );

      const driver = drivers.length > 0 ? drivers[0] : { driver_id: user.user_id, vehicle_type: 'sedan' };

      sseBroker.initSSEStream(req, res, 'driver-dispatch-ready');
      sseBroker.subscribeDriver(driver.driver_id, {
        req,
        res,
        userId: user.user_id,
        vehicleType: driver.vehicle_type,
      });

      // Send initial acknowledgement
      sseBroker.sendEvent(res, 'dispatch_connected', {
        driver_id:    driver.driver_id,
        vehicle_type: driver.vehicle_type,
        message:      'Live dispatch feed connected.',
      });

    } catch (err) {
      console.warn('[SSE /api/stream/driver-dispatch] Error:', err.message);
      sseBroker.initSSEStream(req, res, 'driver-dispatch-demo');
      sseBroker.subscribeDriver(user.user_id, { req, res, userId: user.user_id, vehicleType: 'sedan' });
    }
  });

  // ── GET /api/stream/admin-live ───────────────────────────────
  // Executive real-time audit event stream for Super Admin and Operations Admin
  router.get('/api/stream/admin-live', async (req, res) => {
    const user = authenticateFromToken(req);
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Admin authorization required.' }));
      return;
    }

    sseBroker.initSSEStream(req, res, 'admin-telemetry-ready');
    sseBroker.subscribeAdmin({ req, res, userId: user.user_id });

    sseBroker.sendEvent(res, 'admin_connected', {
      user_id: user.user_id,
      role:    user.role,
      message: 'Admin executive telemetry stream connected.',
    });
  });

};
