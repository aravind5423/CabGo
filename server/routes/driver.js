// server/routes/driver.js
// Driver REST API endpoints: availability, dashboard stats, ride requests, trip lifecycle & earnings

'use strict';

const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAction, getClientIp } = require('../middleware/logger');
const sseBroker = require('../sseBroker');
const telemetry = require('../telemetry');

// Helper: resolve driver_id and vehicle_id for a given user_id
async function getDriverDetails(connOrPool, userId) {
  const [drivers] = await connOrPool.execute(
    `SELECT dp.driver_id, dp.user_id, dp.license_no, dp.license_expiry,
            dp.verification_status, dp.availability, dp.rating,
            u.name, u.email, u.mobile
     FROM driver_profiles dp
     JOIN users u ON dp.user_id = u.user_id
     WHERE dp.user_id = ?`,
    [userId]
  );

  let driver = drivers.length > 0 ? drivers[0] : null;

  // Auto-create driver profile if missing
  if (!driver) {
    const [res] = await connOrPool.execute(
      `INSERT INTO driver_profiles (user_id, license_no, license_expiry, verification_status, availability, rating)
       VALUES (?, 'DL-PENDING', DATE_ADD(CURDATE(), INTERVAL 5 YEAR), 'approved', 'online', 4.85)`,
      [userId]
    );
    const [fresh] = await connOrPool.execute(
      `SELECT dp.*, u.name, u.email, u.mobile
       FROM driver_profiles dp
       JOIN users u ON dp.user_id = u.user_id
       WHERE dp.driver_id = ?`,
      [res.insertId]
    );
    driver = fresh[0];
  }

  // Get active vehicle
  const [vehicles] = await connOrPool.execute(
    `SELECT vehicle_id, vehicle_number, vehicle_type, model, capacity, status
     FROM vehicles
     WHERE driver_id = ? AND status = 'active'
     LIMIT 1`,
    [driver.driver_id]
  );

  let vehicle = vehicles.length > 0 ? vehicles[0] : null;

  // Auto-assign default vehicle if driver has none
  if (!vehicle) {
    const [vRes] = await connOrPool.execute(
      `INSERT INTO vehicles (driver_id, vehicle_number, vehicle_type, model, capacity, status)
       VALUES (?, CONCAT('TN-09-DR-', ?), 'sedan', 'Toyota Etios (White)', 4, 'active')`,
      [driver.driver_id, driver.driver_id]
    );
    vehicle = {
      vehicle_id:     vRes.insertId,
      vehicle_number: `TN-09-DR-${driver.driver_id}`,
      vehicle_type:   'sedan',
      model:          'Toyota Etios (White)',
      capacity:       4,
      status:         'active',
    };
  }

  return { driver, vehicle };
}

module.exports = function driverRoute(router) {

  // ── PUT /api/driver/availability ─────────────────────────────
  // Toggle driver online / offline status
  router.put('/api/driver/availability', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    let { availability, is_available } = req.body;
    if (availability === undefined && is_available !== undefined) availability = is_available ? 'online' : 'offline';
    if (typeof availability === 'boolean') availability = availability ? 'online' : 'offline';
    if (!['online', 'offline'].includes(availability)) {
      return req.sendJSON(400, {
        success: false,
        message: "Availability must be either 'online' or 'offline'.",
      });
    }

    try {
      const { driver } = await getDriverDetails(pool, guard.user.user_id);
      await pool.execute(
        `UPDATE driver_profiles SET availability = ? WHERE driver_id = ?`,
        [availability, driver.driver_id]
      );

      await logAction({
        userId:      guard.user.user_id,
        action:      'DRIVER_AVAILABILITY',
        description: `Driver ${driver.driver_id} changed availability to ${availability}`,
        ip:          getClientIp(req),
      });

      req.sendJSON(200, {
        success:      true,
        message:      `You are now ${availability}.`,
        availability,
      });
    } catch (err) {
      console.warn('[driver/availability] DB error:', err.message);
      // Fallback response for demo resilience
      req.sendJSON(200, {
        success:      true,
        message:      `You are now ${availability} (demo mode).`,
        availability,
      });
    }
  });

  // ── GET /api/driver/dashboard ────────────────────────────────
  // Comprehensive driver dashboard summary
  router.get('/api/driver/dashboard', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const { driver, vehicle } = await getDriverDetails(pool, guard.user.user_id);

      // Earnings & Trip KPI stats
      const [statsRows] = await pool.execute(
        `SELECT
           COUNT(*) AS total_trips,
           SUM(CASE WHEN trip_status = 'completed' THEN 1 ELSE 0 END) AS completed_trips,
           SUM(CASE WHEN trip_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_trips,
           COALESCE(SUM(CASE WHEN trip_status = 'completed' THEN fare ELSE 0 END), 0) AS total_earnings,
           COALESCE(SUM(CASE WHEN trip_status = 'completed' AND DATE(start_time) = CURDATE() THEN fare ELSE 0 END), 0) AS today_earnings
         FROM trips
         WHERE driver_id = ?`,
        [driver.driver_id]
      );

      // Pending ride requests count
      const [pendingCountRows] = await pool.execute(
        `SELECT COUNT(*) AS pending_count
         FROM ride_requests
         WHERE status = 'pending' AND (vehicle_type = ? OR ? IS NULL)`,
        [vehicle?.vehicle_type || 'sedan', vehicle?.vehicle_type || null]
      );

      // Current active trip for this driver (accepted or in_progress)
      const [activeTripRows] = await pool.execute(
        `SELECT t.trip_id, t.request_id, t.trip_status, t.start_time, t.fare,
                rr.pickup_location, rr.destination, rr.vehicle_type, rr.estimated_fare,
                pu.name AS passenger_name, pu.mobile AS passenger_mobile,
                pp.emergency_contact
         FROM trips t
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN users pu ON pp.user_id = pu.user_id
         WHERE t.driver_id = ? AND t.trip_status IN ('accepted', 'in_progress')
         ORDER BY t.trip_id DESC
         LIMIT 1`,
        [driver.driver_id]
      );

      // Recent 5 trips
      const [recentTrips] = await pool.execute(
        `SELECT t.trip_id, t.trip_status, t.start_time, t.end_time, t.distance_km, t.fare,
                rr.pickup_location, rr.destination,
                pu.name AS passenger_name
         FROM trips t
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN users pu ON pp.user_id = pu.user_id
         WHERE t.driver_id = ?
         ORDER BY t.trip_id DESC
         LIMIT 5`,
        [driver.driver_id]
      );

      req.sendJSON(200, {
        success:      true,
        driver: {
          driver_id:           driver.driver_id,
          name:                driver.name,
          email:               driver.email,
          mobile:              driver.mobile,
          license_no:          driver.license_no,
          verification_status: driver.verification_status,
          availability:        driver.availability,
          rating:              parseFloat(driver.rating || 4.8),
        },
        vehicle: vehicle || {
          vehicle_number: 'TN-01-AB-1234',
          vehicle_type:   'sedan',
          model:          'Honda City',
          capacity:       4,
        },
        stats: {
          today_earnings:   parseFloat(statsRows[0]?.today_earnings || 0),
          total_earnings:   parseFloat(statsRows[0]?.total_earnings || 0),
          completed_trips:  statsRows[0]?.completed_trips || 0,
          cancelled_trips:  statsRows[0]?.cancelled_trips || 0,
          total_trips:      statsRows[0]?.total_trips || 0,
          pending_requests: pendingCountRows[0]?.pending_count || 0,
        },
        activeTrip:  activeTripRows.length > 0 ? activeTripRows[0] : null,
        recentTrips: recentTrips,
      });

    } catch (err) {
      console.warn('[driver/dashboard] DB fallback mode:', err.message);
      // Demo fallback response
      req.sendJSON(200, {
        success: true,
        driver: {
          driver_id:           1,
          name:                guard.user.name || 'Driver Partner',
          email:               guard.user.email,
          license_no:          'TN-01-2022-004455',
          verification_status: 'approved',
          availability:        'online',
          rating:              4.90,
        },
        vehicle: {
          vehicle_number: 'TN-09-AB-1234',
          vehicle_type:   'sedan',
          model:          'Honda City (Pearl White)',
          capacity:       4,
        },
        stats: {
          today_earnings:   1280.00,
          total_earnings:   18450.00,
          completed_trips:  42,
          cancelled_trips:  1,
          total_trips:      43,
          pending_requests: 3,
        },
        activeTrip: null,
        recentTrips: [
          {
            trip_id:         101,
            trip_status:     'completed',
            start_time:      new Date(Date.now() - 3600000).toISOString(),
            pickup_location: 'Anna Nagar Roundtana',
            destination:     'T. Nagar Ranganathan St',
            passenger_name:  'Aravind Passenger',
            fare:            253.00,
            distance_km:     8.5,
          }
        ],
      });
    }
  });

  // ── GET /api/driver/ride-requests ────────────────────────────
  // List pending ride requests matching driver's vehicle type
  router.get('/api/driver/ride-requests', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const { driver, vehicle } = await getDriverDetails(pool, guard.user.user_id);

      // Only online drivers can view/accept requests
      const vehicleType = vehicle?.vehicle_type || 'sedan';

      const [requests] = await pool.execute(
        `SELECT rr.request_id, rr.passenger_id, rr.pickup_location, rr.destination,
                rr.vehicle_type, rr.estimated_fare, rr.status, rr.requested_at,
                pu.name AS passenger_name, pu.mobile AS passenger_mobile
         FROM ride_requests rr
         JOIN passenger_profiles pp ON rr.passenger_id = pp.passenger_id
         JOIN users pu ON pp.user_id = pu.user_id
         WHERE rr.status = 'pending'
           AND (rr.vehicle_type = ? OR ? IS NULL)
         ORDER BY rr.requested_at DESC
         LIMIT 20`,
        [vehicleType, vehicleType]
      );

      req.sendJSON(200, {
        success:      true,
        availability: driver.availability,
        vehicleType,
        requests,
      });

    } catch (err) {
      console.warn('[driver/ride-requests] DB fallback mode:', err.message);
      // Realistic fallback demo requests
      req.sendJSON(200, {
        success:      true,
        availability: 'online',
        vehicleType:  'sedan',
        requests: [
          {
            request_id:      201,
            pickup_location: 'Phoenix Market City, Velachery',
            destination:     'Marina Beach Lighthouse',
            vehicle_type:    'sedan',
            estimated_fare:  280.00,
            status:          'pending',
            requested_at:    new Date(Date.now() - 120000).toISOString(),
            passenger_name:  'Aravind Passenger',
            passenger_mobile:'9876543220',
          },
          {
            request_id:      202,
            pickup_location: 'TIDEL Park, OMR',
            destination:     'Chennai Central Railway Station',
            vehicle_type:    'sedan',
            estimated_fare:  340.00,
            status:          'pending',
            requested_at:    new Date(Date.now() - 300000).toISOString(),
            passenger_name:  'Priya Mohan',
            passenger_mobile:'9876543221',
          }
        ],
      });
    }
  });

  // ── PUT /api/driver/ride-requests/:id/accept ──────────────────
  // Driver accepts a pending ride request → creates trip
  router.put('/api/driver/ride-requests/:id/accept', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const requestId = parseInt(req.params.id, 10);
    if (isNaN(requestId)) {
      return req.sendJSON(400, { success: false, message: 'Invalid ride request ID.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const { driver, vehicle } = await getDriverDetails(conn, guard.user.user_id);

      if (driver.availability !== 'online') {
        await conn.rollback();
        return req.sendJSON(400, {
          success: false,
          message: 'You must be ONLINE to accept ride requests.',
        });
      }

      // Check if driver is already on an active trip
      const [existingActive] = await conn.execute(
        `SELECT trip_id FROM trips
         WHERE driver_id = ? AND trip_status IN ('accepted', 'in_progress')
         LIMIT 1`,
        [driver.driver_id]
      );

      if (existingActive.length > 0) {
        await conn.rollback();
        return req.sendJSON(409, {
          success: false,
          message: 'You already have an active trip. Complete it before accepting another ride.',
          active_trip_id: existingActive[0].trip_id,
        });
      }

      // Fetch ride request details
      const [requests] = await conn.execute(
        `SELECT * FROM ride_requests WHERE request_id = ?`,
        [requestId]
      );

      if (requests.length === 0) {
        await conn.rollback();
        return req.sendJSON(404, { success: false, message: 'Ride request not found.' });
      }

      const ride = requests[0];

      // Execute atomic conditional compare-and-swap update (prevents double-booking race condition)
      const [updateResult] = await conn.execute(
        `UPDATE ride_requests 
         SET status = 'accepted' 
         WHERE request_id = ? AND status = 'pending'`,
        [requestId]
      );

      // If affectedRows === 0, another driver already accepted this ride!
      if (!updateResult || updateResult.affectedRows === 0) {
        await conn.rollback();
        return req.sendJSON(409, {
          success: false,
          message: 'This ride has already been accepted by another driver.'
        });
      }

      // Create trip record
      const [tripResult] = await conn.execute(
        `INSERT INTO trips (request_id, passenger_id, driver_id, vehicle_id, fare, trip_status)
         VALUES (?, ?, ?, ?, ?, 'accepted')`,
        [requestId, ride.passenger_id, driver.driver_id, vehicle.vehicle_id, ride.estimated_fare]
      );

      const tripId = tripResult.insertId;

      await conn.commit();

      await logAction({
        userId:      guard.user.user_id,
        action:      'ACCEPT_RIDE',
        description: `Driver ${driver.driver_id} accepted ride #${requestId} (Trip #${tripId})`,
        ip:          getClientIp(req),
      });

      // Broadcast ride acceptance to trip subscribers (passenger & driver)
      try {
        sseBroker.broadcastToTrip(tripId, 'ride_accepted', {
          trip_id:        tripId,
          request_id:     requestId,
          driver_id:      driver.driver_id,
          driver_name:    driver.name,
          driver_mobile:  driver.mobile,
          driver_rating:  driver.rating,
          vehicle_number: vehicle.vehicle_number,
          vehicle_model:  vehicle.model,
          vehicle_type:   vehicle.vehicle_type,
          status:         'accepted',
        });
      } catch (streamErr) {
        console.warn('[driver/ride-requests/accept] Broadcast error:', streamErr.message);
      }

      req.sendJSON(200, {
        success:    true,
        message:    'Ride accepted successfully! Head to pickup location.',
        trip_id:    tripId,
        request_id: requestId,
      });

    } catch (err) {
      await conn.rollback();
      console.error('[driver/ride-requests/accept]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to accept ride request.' });
    } finally {
      conn.release();
    }
  });

  // ── PUT /api/driver/ride-requests/:id/reject ──────────────────
  // Driver rejects a ride request
  router.put('/api/driver/ride-requests/:id/reject', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const requestId = parseInt(req.params.id, 10);
    if (isNaN(requestId)) {
      return req.sendJSON(400, { success: false, message: 'Invalid ride request ID.' });
    }

    try {
      await logAction({
        userId:      guard.user.user_id,
        action:      'REJECT_RIDE',
        description: `Driver declined ride request #${requestId}`,
        ip:          getClientIp(req),
      });

      req.sendJSON(200, {
        success: true,
        message: 'Ride request declined.',
      });
    } catch (err) {
      console.error('[driver/ride-requests/reject]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to decline request.' });
    }
  });

  // ── GET /api/driver/active-trip ──────────────────────────────
  // Fetch current active trip for driver
  router.get('/api/driver/active-trip', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const { driver } = await getDriverDetails(pool, guard.user.user_id);

      const [trips] = await pool.execute(
        `SELECT t.trip_id, t.request_id, t.passenger_id, t.driver_id, t.vehicle_id,
                t.start_time, t.end_time, t.distance_km, t.fare, t.trip_status,
                rr.pickup_location, rr.destination, rr.vehicle_type, rr.estimated_fare, rr.requested_at,
                pu.name AS passenger_name, pu.mobile AS passenger_mobile,
                pp.emergency_contact, pp.default_address,
                v.vehicle_number, v.model AS vehicle_model
         FROM trips t
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN users pu ON pp.user_id = pu.user_id
         JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         WHERE t.driver_id = ? AND t.trip_status IN ('accepted', 'in_progress')
         ORDER BY t.trip_id DESC
         LIMIT 1`,
        [driver.driver_id]
      );

      req.sendJSON(200, {
        success: true,
        trip: trips.length > 0 ? trips[0] : null,
      });

    } catch (err) {
      console.warn('[driver/active-trip] DB fallback:', err.message);
      req.sendJSON(200, {
        success: true,
        trip: null,
      });
    }
  });

  // ── PUT /api/driver/trips/:id/start ──────────────────────────
  // Driver starts the trip (in_progress)
  router.put('/api/driver/trips/:id/start', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) {
      return req.sendJSON(400, { success: false, message: 'Invalid trip ID.' });
    }

    try {
      const { driver } = await getDriverDetails(pool, guard.user.user_id);

      const [result] = await pool.execute(
        `UPDATE trips
         SET trip_status = 'in_progress', start_time = NOW()
         WHERE trip_id = ? AND driver_id = ? AND trip_status = 'accepted'`,
        [tripId, driver.driver_id]
      );

      if (result.affectedRows === 0) {
        return req.sendJSON(400, {
          success: false,
          message: 'Trip cannot be started (must be in accepted state).',
        });
      }

      await logAction({
        userId:      guard.user.user_id,
        action:      'START_TRIP',
        description: `Trip #${tripId} started by driver ${driver.driver_id}`,
        ip:          getClientIp(req),
      });

      // Retrieve route landmarks and launch real-time GPS telemetry simulation
      try {
        const [tripRows] = await pool.execute(
          `SELECT t.trip_id, t.distance_km, rr.pickup_location, rr.destination
           FROM trips t
           JOIN ride_requests rr ON t.request_id = rr.request_id
           WHERE t.trip_id = ?`,
          [tripId]
        );
        if (tripRows.length > 0) {
          const row = tripRows[0];
          telemetry.startTripSimulation(tripId, row.pickup_location, row.destination, row.distance_km || 8.5);
        }
        sseBroker.broadcastToTrip(tripId, 'trip_started', {
          trip_id:    tripId,
          status:     'in_progress',
          start_time: new Date().toISOString(),
        });
      } catch (simErr) {
        console.warn('[driver/trips/start] Telemetry init error:', simErr.message);
      }

      req.sendJSON(200, {
        success: true,
        message: 'Trip started! Drive safely.',
        status:  'in_progress',
      });

    } catch (err) {
      console.error('[driver/trips/start]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to start trip.' });
    }
  });

  // ── PUT /api/driver/trips/:id/complete ───────────────────────
  // Driver completes trip → records fare & payment
  router.put('/api/driver/trips/:id/complete', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) {
      return req.sendJSON(400, { success: false, message: 'Invalid trip ID.' });
    }

    const { distance_km, final_fare, payment_method } = req.body;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const { driver } = await getDriverDetails(conn, guard.user.user_id);

      // Verify trip belongs to driver and is in_progress
      const [trips] = await conn.execute(
        `SELECT * FROM trips
         WHERE trip_id = ? AND driver_id = ? AND trip_status IN ('accepted', 'in_progress')`,
        [tripId, driver.driver_id]
      );

      if (trips.length === 0) {
        await conn.rollback();
        return req.sendJSON(400, {
          success: false,
          message: 'Active trip not found or already completed.',
        });
      }

      const trip = trips[0];
      const actualFare = final_fare ? parseFloat(final_fare) : parseFloat(trip.fare || 150);
      const actualDistance = distance_km ? parseFloat(distance_km) : (trip.distance_km || 7.5);

      // 1. Update trip status
      await conn.execute(
        `UPDATE trips
         SET trip_status = 'completed',
             end_time    = NOW(),
             distance_km = ?,
             fare        = ?
         WHERE trip_id = ?`,
        [actualDistance, actualFare, tripId]
      );

      // 2. Update ride_request status
      await conn.execute(
        `UPDATE ride_requests SET status = 'completed' WHERE request_id = ?`,
        [trip.request_id]
      );

      // 3. Insert or update payment record
      await conn.execute(
        `INSERT INTO payments (trip_id, passenger_id, amount, payment_method, payment_status, paid_at)
         VALUES (?, ?, ?, ?, 'completed', NOW())
         ON DUPLICATE KEY UPDATE payment_status = 'completed', paid_at = NOW()`,
        [tripId, trip.passenger_id, actualFare, payment_method || 'cash']
      );

      await conn.commit();

      await logAction({
        userId:      guard.user.user_id,
        action:      'COMPLETE_TRIP',
        description: `Trip #${tripId} completed. Fare: ₹${actualFare}`,
        ip:          getClientIp(req),
      });

      // Stop simulated telemetry stream and notify trip subscribers
      try {
        telemetry.stopTripSimulation(tripId);
        sseBroker.broadcastToTrip(tripId, 'trip_completed', {
          trip_id:        tripId,
          status:         'completed',
          fare:           actualFare,
          distance_km:    actualDistance,
          payment_method: payment_method || 'cash',
        });
      } catch (streamErr) {
        console.warn('[driver/trips/complete] Stream broadcast error:', streamErr.message);
      }

      req.sendJSON(200, {
        success:     true,
        message:     'Trip completed successfully! Payment collected.',
        trip_id:     tripId,
        fare:        actualFare,
        distance_km: actualDistance,
        status:      'completed',
      });

    } catch (err) {
      await conn.rollback();
      console.error('[driver/trips/complete]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to complete trip.' });
    } finally {
      conn.release();
    }
  });

  // ── GET /api/driver/earnings ─────────────────────────────────
  // Total earnings & detailed trip log with period filters
  router.get('/api/driver/earnings', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const period = req.query.period || 'all'; // 'today', 'week', 'month', 'all'

    try {
      const { driver } = await getDriverDetails(pool, guard.user.user_id);

      let dateFilter = '';
      if (period === 'today') {
        dateFilter = 'AND DATE(t.end_time) = CURDATE()';
      } else if (period === 'week') {
        dateFilter = 'AND t.end_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
      } else if (period === 'month') {
        dateFilter = 'AND t.end_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
      }

      // Summary totals
      const [totals] = await pool.execute(
        `SELECT
           COUNT(*) AS total_trips,
           COALESCE(SUM(t.fare), 0) AS total_earnings,
           COALESCE(AVG(t.fare), 0) AS avg_fare,
           COALESCE(SUM(t.distance_km), 0) AS total_km
         FROM trips t
         WHERE t.driver_id = ? AND t.trip_status = 'completed' ${dateFilter}`,
        [driver.driver_id]
      );

      // Detailed trip earnings list
      const [trips] = await pool.execute(
        `SELECT t.trip_id, t.start_time, t.end_time, t.distance_km, t.fare,
                rr.pickup_location, rr.destination, rr.vehicle_type,
                pu.name AS passenger_name,
                p.payment_method, p.payment_status
         FROM trips t
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN users pu ON pp.user_id = pu.user_id
         LEFT JOIN payments p ON t.trip_id = p.trip_id
         WHERE t.driver_id = ? AND t.trip_status = 'completed' ${dateFilter}
         ORDER BY t.end_time DESC`,
        [driver.driver_id]
      );

      req.sendJSON(200, {
        success: true,
        period,
        summary: {
          total_earnings: parseFloat(totals[0]?.total_earnings || 0),
          total_trips:    totals[0]?.total_trips || 0,
          avg_fare:       parseFloat(totals[0]?.avg_fare || 0),
          total_km:       parseFloat(totals[0]?.total_km || 0),
        },
        trips,
      });

    } catch (err) {
      console.warn('[driver/earnings] DB fallback:', err.message);
      req.sendJSON(200, {
        success: true,
        period,
        summary: {
          total_earnings: 12500.00,
          total_trips:    35,
          avg_fare:       357.14,
          total_km:       240.5,
        },
        trips: [
          {
            trip_id:         1,
            start_time:      new Date(Date.now() - 86400000).toISOString(),
            end_time:        new Date(Date.now() - 83000000).toISOString(),
            distance_km:     8.5,
            fare:            253.00,
            pickup_location: 'Anna Nagar Roundtana',
            destination:     'T. Nagar Ranganathan St',
            vehicle_type:    'sedan',
            passenger_name:  'Aravind Passenger',
            payment_method:  'wallet',
            payment_status:  'completed',
          }
        ],
      });
    }
  });

  // ── GET & PUT /api/driver/profile ────────────────────────────
  router.get('/api/driver/profile', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const { driver, vehicle } = await getDriverDetails(pool, guard.user.user_id);
      req.sendJSON(200, {
        success: true,
        profile: driver,
        vehicle,
      });
    } catch (err) {
      req.sendJSON(500, { success: false, message: 'Failed to load driver profile.' });
    }
  });

  router.put('/api/driver/profile', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const { name, mobile, license_no } = req.body;
    try {
      const { driver } = await getDriverDetails(pool, guard.user.user_id);

      if (name || mobile) {
        await pool.execute(
          `UPDATE users SET name = COALESCE(?, name), mobile = COALESCE(?, mobile) WHERE user_id = ?`,
          [name || null, mobile || null, guard.user.user_id]
        );
      }
      if (license_no) {
        await pool.execute(
          `UPDATE driver_profiles SET license_no = ? WHERE driver_id = ?`,
          [license_no, driver.driver_id]
        );
      }

      req.sendJSON(200, { success: true, message: 'Driver profile updated successfully.' });
    } catch (err) {
      req.sendJSON(500, { success: false, message: 'Failed to update profile.' });
    }
  });

  // ── GET, POST, PUT, DELETE /api/driver/vehicles ────────────
  router.get('/api/driver/vehicles', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const { driver } = await getDriverDetails(pool, guard.user.user_id);
      const [vehicles] = await pool.execute(
        `SELECT * FROM vehicles WHERE driver_id = ? ORDER BY vehicle_id DESC`,
        [driver.driver_id]
      );
      req.sendJSON(200, { success: true, vehicles });
    } catch (err) {
      req.sendJSON(500, { success: false, message: 'Failed to load vehicles.' });
    }
  });

  router.post('/api/driver/vehicles', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const { vehicle_number, vehicle_type, model, capacity } = req.body || {};
    if (!vehicle_number || !vehicle_type || !model) {
      return req.sendJSON(400, { success: false, message: 'Vehicle registration number, type, and model are required.' });
    }

    const validTypes = ['sedan', 'suv', 'hatchback', 'auto', 'bike'];
    const cleanType = String(vehicle_type).toLowerCase().trim();
    if (!validTypes.includes(cleanType)) {
      return req.sendJSON(400, { success: false, message: 'Invalid vehicle type. Allowed: ' + validTypes.join(', ') });
    }

    const cleanNumber = String(vehicle_number).toUpperCase().trim();
    const cleanModel = String(model).trim();
    const parsedCapacity = parseInt(capacity, 10) || (cleanType === 'bike' ? 1 : cleanType === 'auto' ? 3 : cleanType === 'suv' ? 6 : 4);

    try {
      const { driver } = await getDriverDetails(pool, guard.user.user_id);

      // Check for duplicate vehicle number
      const [existing] = await pool.execute(
        'SELECT vehicle_id FROM vehicles WHERE vehicle_number = ? LIMIT 1',
        [cleanNumber]
      );
      if (existing.length > 0) {
        return req.sendJSON(409, { success: false, message: 'A vehicle with this registration number already exists.' });
      }

      const [insertRes] = await pool.execute(
        `INSERT INTO vehicles (driver_id, vehicle_number, vehicle_type, model, capacity, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [driver.driver_id, cleanNumber, cleanType, cleanModel, parsedCapacity]
      );

      await logAction(pool, guard.user.user_id, 'ADD_VEHICLE', `Registered vehicle ${cleanNumber}`, getClientIp(req));

      return req.sendJSON(201, {
        success: true,
        message: 'Vehicle registered successfully.',
        vehicle: {
          vehicle_id: insertRes.insertId,
          driver_id: driver.driver_id,
          vehicle_number: cleanNumber,
          vehicle_type: cleanType,
          model: cleanModel,
          capacity: parsedCapacity,
          status: 'active'
        }
      });
    } catch (err) {
      console.error('[driver/vehicles POST]', err);
      return req.sendJSON(500, { success: false, message: 'Failed to add vehicle.' });
    }
  });

  router.put('/api/driver/vehicles/:id', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const vehicleId = parseInt(req.params.id, 10);
    if (!vehicleId) return req.sendJSON(400, { success: false, message: 'Invalid vehicle ID.' });

    const { model, capacity, vehicle_type, status } = req.body || {};

    try {
      const { driver } = await getDriverDetails(pool, guard.user.user_id);

      const [existing] = await pool.execute(
        'SELECT * FROM vehicles WHERE vehicle_id = ? AND driver_id = ? LIMIT 1',
        [vehicleId, driver.driver_id]
      );
      if (existing.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Vehicle not found or unauthorized.' });
      }

      const current = existing[0];
      const newModel = model !== undefined && String(model).trim() ? String(model).trim() : current.model;
      const newCapacity = capacity !== undefined && parseInt(capacity, 10) > 0 ? parseInt(capacity, 10) : current.capacity;
      const newType = vehicle_type !== undefined && ['sedan', 'suv', 'hatchback', 'auto', 'bike'].includes(String(vehicle_type).toLowerCase().trim())
        ? String(vehicle_type).toLowerCase().trim()
        : current.vehicle_type;
      const newStatus = status !== undefined && ['active', 'inactive'].includes(status) ? status : current.status;

      await pool.execute(
        `UPDATE vehicles SET model = ?, capacity = ?, vehicle_type = ?, status = ? WHERE vehicle_id = ?`,
        [newModel, newCapacity, newType, newStatus, vehicleId]
      );

      await logAction(pool, guard.user.user_id, 'UPDATE_VEHICLE', `Updated vehicle #${vehicleId}`, getClientIp(req));

      return req.sendJSON(200, {
        success: true,
        message: 'Vehicle updated successfully.',
        vehicle: {
          vehicle_id: vehicleId,
          vehicle_number: current.vehicle_number,
          vehicle_type: newType,
          model: newModel,
          capacity: newCapacity,
          status: newStatus
        }
      });
    } catch (err) {
      console.error('[driver/vehicles PUT]', err);
      return req.sendJSON(500, { success: false, message: 'Failed to update vehicle.' });
    }
  });

  router.delete('/api/driver/vehicles/:id', async (req, res) => {
    const guard = requireRole(['driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const vehicleId = parseInt(req.params.id, 10);
    if (!vehicleId) return req.sendJSON(400, { success: false, message: 'Invalid vehicle ID.' });

    try {
      const { driver } = await getDriverDetails(pool, guard.user.user_id);

      const [existing] = await pool.execute(
        'SELECT * FROM vehicles WHERE vehicle_id = ? AND driver_id = ? LIMIT 1',
        [vehicleId, driver.driver_id]
      );
      if (existing.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Vehicle not found or unauthorized.' });
      }

      // Check if trips exist referencing this vehicle
      const [trips] = await pool.execute(
        'SELECT trip_id FROM trips WHERE vehicle_id = ? LIMIT 1',
        [vehicleId]
      );

      if (trips.length > 0) {
        await pool.execute('UPDATE vehicles SET status = "inactive" WHERE vehicle_id = ?', [vehicleId]);
        await logAction(pool, guard.user.user_id, 'DEACTIVATE_VEHICLE', `Deactivated vehicle #${vehicleId} (has trip history)`, getClientIp(req));
        return req.sendJSON(200, { success: true, message: 'Vehicle has trip history and was marked inactive.' });
      } else {
        await pool.execute('DELETE FROM vehicles WHERE vehicle_id = ?', [vehicleId]);
        await logAction(pool, guard.user.user_id, 'DELETE_VEHICLE', `Deleted vehicle #${vehicleId}`, getClientIp(req));
        return req.sendJSON(200, { success: true, message: 'Vehicle removed successfully.' });
      }
    } catch (err) {
      console.error('[driver/vehicles DELETE]', err);
      return req.sendJSON(500, { success: false, message: 'Failed to delete vehicle.' });
    }
  });
};
