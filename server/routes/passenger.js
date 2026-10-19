// server/routes/passenger.js
// Passenger REST API endpoints: ride search, booking, tracking, history & stats

'use strict';

const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAction, getClientIp } = require('../middleware/logger');

// Helper to get or ensure passenger_id from user_id
async function getPassengerId(connOrPool, userId) {
  const [rows] = await connOrPool.execute(
    'SELECT passenger_id FROM passenger_profiles WHERE user_id = ?',
    [userId]
  );
  if (rows.length > 0) return rows[0].passenger_id;

  // If profile wasn't created during registration, create it now
  const [res] = await connOrPool.execute(
    'INSERT INTO passenger_profiles (user_id) VALUES (?)',
    [userId]
  );
  return res.insertId;
}

module.exports = function passengerRoute(router) {

  // ── GET /api/rides/search ────────────────────────────────────
  // Calculate fare estimate and find available driver count
  router.get('/api/rides/search', async (req, res) => {
    const { pickup, destination, type } = req.query;

    if (!pickup || !destination) {
      return req.sendJSON(400, { success: false, message: 'Pickup and destination are required.' });
    }

    try {
      let fareQuery = `SELECT * FROM fare_rules WHERE status = 'active'`;
      const fareParams = [];
      if (type) {
        fareQuery += ' AND vehicle_type = ?';
        fareParams.push(type);
      }

      const [fareRules] = await pool.execute(fareQuery, fareParams);

      // Count active online drivers
      const [driverCount] = await pool.execute(
        `SELECT COUNT(*) AS count FROM driver_profiles
         WHERE availability = 'online' AND verification_status = 'approved'`
      );

      // Realistic pseudo-distance based on string hashing if coordinates aren't provided
      const pseudoDist = Math.max(3.2, ((pickup.length + destination.length) % 18) + 2.5);

      const fareOptions = fareRules.map(r => {
        const base = parseFloat(r.base_fare);
        const perKm = parseFloat(r.per_km_rate);
        const est = +(base + pseudoDist * perKm).toFixed(2);
        return {
          vehicle_type:   r.vehicle_type,
          base_fare:      base,
          per_km_rate:    perKm,
          estimated_km:   +pseudoDist.toFixed(1),
          estimated_fare: est,
        };
      });

      req.sendJSON(200, {
        success:          true,
        pickup,
        destination,
        estimated_km:     +pseudoDist.toFixed(1),
        availableDrivers: driverCount[0].count,
        fareOptions,
      });
    } catch (err) {
      console.warn('[rides/search] DB fallback mode:', err.message);
      // Realistic default fare matrix for demo when DB is not yet running
      const pseudoDist = Math.max(3.2, ((pickup.length + destination.length) % 18) + 2.5);
      const defaults = [
        { vehicle_type: 'sedan',     base_fare: 100.0, per_km_rate: 18.0 },
        { vehicle_type: 'suv',       base_fare: 150.0, per_km_rate: 25.0 },
        { vehicle_type: 'hatchback', base_fare: 80.0,  per_km_rate: 14.0 },
        { vehicle_type: 'auto',      base_fare: 40.0,  per_km_rate: 10.0 },
        { vehicle_type: 'bike',      base_fare: 25.0,  per_km_rate: 7.0 },
      ];
      const fareOptions = defaults.map(r => ({
        vehicle_type:   r.vehicle_type,
        base_fare:      r.base_fare,
        per_km_rate:    r.per_km_rate,
        estimated_km:   +pseudoDist.toFixed(1),
        estimated_fare: +(r.base_fare + pseudoDist * r.per_km_rate).toFixed(2),
      }));

      req.sendJSON(200, {
        success:          true,
        pickup,
        destination,
        estimated_km:     +pseudoDist.toFixed(1),
        availableDrivers: 8,
        fareOptions,
      });
    }
  });

  // ── POST /api/rides/book ─────────────────────────────────────
  // Book a ride — creates pending ride_request
  router.post('/api/rides/book', async (req, res) => {
    const guard = requireRole(['passenger'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const { pickup_location, destination, vehicle_type, estimated_fare } = req.body;

    if (!pickup_location || !destination || !vehicle_type) {
      return req.sendJSON(400, {
        success: false,
        message: 'Pickup location, destination, and vehicle type are required.',
      });
    }

    const validTypes = ['sedan', 'suv', 'hatchback', 'auto', 'bike'];
    if (!validTypes.includes(vehicle_type)) {
      return req.sendJSON(400, {
        success: false,
        message: `Invalid vehicle type. Allowed: ${validTypes.join(', ')}`,
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const passengerId = await getPassengerId(conn, guard.user.user_id);

      // Check for existing pending or active ride
      const [activeRequests] = await conn.execute(
        `SELECT request_id, status FROM ride_requests
         WHERE passenger_id = ? AND status IN ('pending', 'accepted')
         LIMIT 1`,
        [passengerId]
      );

      if (activeRequests.length > 0) {
        await conn.rollback();
        return req.sendJSON(409, {
          success:    false,
          message:    'You already have an active or pending ride request.',
          request_id: activeRequests[0].request_id,
          status:     activeRequests[0].status,
        });
      }

      // Calculate estimate if not provided
      let finalFare = estimated_fare ? parseFloat(estimated_fare) : null;
      if (!finalFare) {
        const [rule] = await conn.execute(
          'SELECT base_fare, per_km_rate FROM fare_rules WHERE vehicle_type = ? LIMIT 1',
          [vehicle_type]
        );
        if (rule.length > 0) {
          finalFare = +(parseFloat(rule[0].base_fare) + 5 * parseFloat(rule[0].per_km_rate)).toFixed(2);
        } else {
          finalFare = 150.00;
        }
      }

      const [result] = await conn.execute(
        `INSERT INTO ride_requests
           (passenger_id, pickup_location, destination, vehicle_type, estimated_fare, status, requested_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
        [passengerId, pickup_location.trim(), destination.trim(), vehicle_type, finalFare]
      );

      const requestId = result.insertId;

      await conn.commit();

      await logAction({
        userId:      guard.user.user_id,
        action:      'BOOK_RIDE',
        description: `Ride booked #${requestId}: ${pickup_location} -> ${destination} (${vehicle_type})`,
        ip:          getClientIp(req),
      });

      req.sendJSON(201, {
        success:        true,
        message:        'Ride booked successfully! Searching for nearby drivers...',
        request_id:     requestId,
        pickup_location,
        destination,
        vehicle_type,
        estimated_fare: finalFare,
        status:         'pending',
      });
    } catch (err) {
      await conn.rollback();
      console.error('[rides/book]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to book ride.' });
    } finally {
      conn.release();
    }
  });

  // ── GET /api/rides/status/:request_id ────────────────────────
  // Poll ride request status + trip info
  router.get('/api/rides/status/:request_id', async (req, res) => {
    const guard = requireRole(null)(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const requestId = parseInt(req.params.request_id, 10);
    if (isNaN(requestId)) {
      return req.sendJSON(400, { success: false, message: 'Invalid request ID.' });
    }

    try {
      const [requests] = await pool.execute(
        `SELECT rr.*, u.name AS passenger_name, u.mobile AS passenger_mobile
         FROM ride_requests rr
         JOIN passenger_profiles pp ON rr.passenger_id = pp.passenger_id
         JOIN users u ON pp.user_id = u.user_id
         WHERE rr.request_id = ?`,
        [requestId]
      );

      if (requests.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Ride request not found.' });
      }

      const ride = requests[0];

      // Check if a trip has been created (driver accepted)
      const [trips] = await pool.execute(
        `SELECT t.*,
                du.name AS driver_name, du.mobile AS driver_mobile,
                dp.rating AS driver_rating,
                v.vehicle_number, v.model AS vehicle_model, v.vehicle_type
         FROM trips t
         JOIN driver_profiles dp ON t.driver_id = dp.driver_id
         JOIN users du ON dp.user_id = du.user_id
         JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         WHERE t.request_id = ?
         LIMIT 1`,
        [requestId]
      );

      const trip = trips.length > 0 ? trips[0] : null;

      req.sendJSON(200, {
        success: true,
        ride: {
          request_id:      ride.request_id,
          pickup_location: ride.pickup_location,
          destination:     ride.destination,
          vehicle_type:    ride.vehicle_type,
          estimated_fare:  ride.estimated_fare,
          status:          ride.status,
          requested_at:    ride.requested_at,
          trip,
        },
      });
    } catch (err) {
      console.error('[rides/status]', err.message);
      req.sendJSON(500, { success: false, message: 'Error retrieving ride status.' });
    }
  });

  // ── POST /api/rides/cancel/:request_id ───────────────────────
  // Cancel ride request (allowed only if pending)
  router.post('/api/rides/cancel/:request_id', async (req, res) => {
    const guard = requireRole(['passenger'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const requestId = parseInt(req.params.request_id, 10);
    if (isNaN(requestId)) {
      return req.sendJSON(400, { success: false, message: 'Invalid request ID.' });
    }

    try {
      const passengerId = await getPassengerId(pool, guard.user.user_id);

      const [requests] = await pool.execute(
        'SELECT request_id, status FROM ride_requests WHERE request_id = ? AND passenger_id = ?',
        [requestId, passengerId]
      );

      if (requests.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Ride request not found.' });
      }

      if (requests[0].status !== 'pending') {
        return req.sendJSON(400, {
          success: false,
          message: `Cannot cancel ride with status '${requests[0].status}'. Only pending rides can be cancelled directly.`,
        });
      }

      await pool.execute(
        `UPDATE ride_requests SET status = 'cancelled' WHERE request_id = ?`,
        [requestId]
      );

      await logAction({
        userId:      guard.user.user_id,
        action:      'CANCEL_RIDE',
        description: `Ride request #${requestId} cancelled by passenger`,
        ip:          getClientIp(req),
      });

      req.sendJSON(200, { success: true, message: 'Ride request cancelled successfully.' });
    } catch (err) {
      console.error('[rides/cancel]', err.message);
      req.sendJSON(500, { success: false, message: 'Error cancelling ride.' });
    }
  });

  // ── GET /api/rides/history ───────────────────────────────────
  // Passenger trip and booking history with filtering
  router.get('/api/rides/history', async (req, res) => {
    const guard = requireRole(['passenger'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const passengerId = await getPassengerId(pool, guard.user.user_id);
      const { status, from_date, to_date } = req.query;

      let query = `
        SELECT rr.request_id, rr.pickup_location, rr.destination, rr.vehicle_type,
               rr.estimated_fare, rr.status AS request_status, rr.requested_at,
               t.trip_id, t.start_time, t.end_time, t.distance_km, t.fare AS final_fare,
               t.trip_status,
               du.name AS driver_name, du.mobile AS driver_mobile,
               v.vehicle_number, v.model AS vehicle_model,
               p.payment_status, p.payment_method,
               rv.rating, rv.comment AS review_comment
        FROM ride_requests rr
        LEFT JOIN trips t ON rr.request_id = t.request_id
        LEFT JOIN driver_profiles dp ON t.driver_id = dp.driver_id
        LEFT JOIN users du ON dp.user_id = du.user_id
        LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        LEFT JOIN payments p ON t.trip_id = p.trip_id
        LEFT JOIN ratings_reviews rv ON t.trip_id = rv.trip_id AND rv.reviewer_id = ?
        WHERE rr.passenger_id = ?
      `;

      const params = [guard.user.user_id, passengerId];

      if (status) {
        query += ' AND rr.status = ?';
        params.push(status);
      }
      if (from_date) {
        query += ' AND rr.requested_at >= ?';
        params.push(`${from_date} 00:00:00`);
      }
      if (to_date) {
        query += ' AND rr.requested_at <= ?';
        params.push(`${to_date} 23:59:59`);
      }

      query += ' ORDER BY rr.requested_at DESC LIMIT 50';

      const [history] = await pool.execute(query, params);

      req.sendJSON(200, {
        success: true,
        count:   history.length,
        history,
      });
    } catch (err) {
      console.error('[rides/history]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve ride history.' });
    }
  });

  // ── GET /api/passenger/dashboard ─────────────────────────────
  // Aggregated dashboard metrics & active booking for passenger
  router.get('/api/passenger/dashboard', async (req, res) => {
    const guard = requireRole(['passenger'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const passengerId = await getPassengerId(pool, guard.user.user_id);

      // Total stats
      const [stats] = await pool.execute(
        `SELECT
           COUNT(*) AS total_rides,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_rides,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_rides,
           COALESCE(SUM(CASE WHEN status = 'completed' THEN estimated_fare ELSE 0 END), 0) AS total_spent
         FROM ride_requests
         WHERE passenger_id = ?`,
        [passengerId]
      );

      // Check for current active ride (pending or accepted)
      const [active] = await pool.execute(
        `SELECT rr.request_id, rr.pickup_location, rr.destination, rr.vehicle_type,
                rr.estimated_fare, rr.status, rr.requested_at,
                t.trip_id, t.trip_status,
                du.name AS driver_name, du.mobile AS driver_mobile,
                v.vehicle_number, v.model AS vehicle_model
         FROM ride_requests rr
         LEFT JOIN trips t ON rr.request_id = t.request_id
         LEFT JOIN driver_profiles dp ON t.driver_id = dp.driver_id
         LEFT JOIN users du ON dp.user_id = du.user_id
         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         WHERE rr.passenger_id = ? AND rr.status IN ('pending', 'accepted')
         ORDER BY rr.requested_at DESC
         LIMIT 1`,
        [passengerId]
      );

      // Recent 5 rides
      const [recent] = await pool.execute(
        `SELECT rr.request_id, rr.pickup_location, rr.destination, rr.vehicle_type,
                rr.estimated_fare, rr.status, rr.requested_at
         FROM ride_requests rr
         WHERE rr.passenger_id = ?
         ORDER BY rr.requested_at DESC
         LIMIT 5`,
        [passengerId]
      );

      req.sendJSON(200, {
        success:    true,
        stats:      stats[0] || { total_rides: 0, completed_rides: 0, cancelled_rides: 0, total_spent: 0 },
        activeRide: active.length > 0 ? active[0] : null,
        recentRides: recent,
      });
    } catch (err) {
      console.error('[passenger/dashboard]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to load dashboard data.' });
    }
  });

  // ── GET & PUT /api/passenger/profile ─────────────────────────
  router.get('/api/passenger/profile', async (req, res) => {
    const guard = requireRole(['passenger'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const [rows] = await pool.execute(
        `SELECT u.user_id, u.name, u.email, u.mobile, u.role, u.created_at,
                pp.passenger_id, pp.default_address, pp.emergency_contact
         FROM users u
         LEFT JOIN passenger_profiles pp ON u.user_id = pp.user_id
         WHERE u.user_id = ?`,
        [guard.user.user_id]
      );
      if (rows.length === 0) return req.sendJSON(404, { success: false, message: 'Profile not found.' });
      req.sendJSON(200, { success: true, profile: rows[0] });
    } catch (err) {
      console.error('[passenger/profile]', err.message);
      req.sendJSON(500, { success: false, message: 'Server error.' });
    }
  });

  router.put('/api/passenger/profile', async (req, res) => {
    const guard = requireRole(['passenger'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const { name, mobile, default_address, emergency_contact } = req.body;
    if (!name || !mobile) {
      return req.sendJSON(400, { success: false, message: 'Name and mobile are required.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        'UPDATE users SET name = ?, mobile = ? WHERE user_id = ?',
        [name.trim(), mobile.trim(), guard.user.user_id]
      );

      const [prof] = await conn.execute(
        'SELECT passenger_id FROM passenger_profiles WHERE user_id = ?',
        [guard.user.user_id]
      );
      if (prof.length > 0) {
        await conn.execute(
          'UPDATE passenger_profiles SET default_address = ?, emergency_contact = ? WHERE user_id = ?',
          [default_address || null, emergency_contact || null, guard.user.user_id]
        );
      } else {
        await conn.execute(
          'INSERT INTO passenger_profiles (user_id, default_address, emergency_contact) VALUES (?, ?, ?)',
          [guard.user.user_id, default_address || null, emergency_contact || null]
        );
      }

      await conn.commit();
      req.sendJSON(200, { success: true, message: 'Profile updated successfully.' });
    } catch (err) {
      await conn.rollback();
      console.error('[passenger/profile:put]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to update profile.' });
    } finally {
      conn.release();
    }
  });

};
