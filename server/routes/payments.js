// server/routes/payments.js
// Payments REST API module for trip fare settlement, receipts, and passenger payment history

'use strict';

const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAction, getClientIp } = require('../middleware/logger');

// Helper to look up passenger_id from user_id
async function getPassengerId(db, userId) {
  const [rows] = await db.execute(
    'SELECT passenger_id FROM passenger_profiles WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows.length > 0 ? rows[0].passenger_id : null;
}

// Helper to look up driver_id from user_id
async function getDriverId(db, userId) {
  const [rows] = await db.execute(
    'SELECT driver_id FROM driver_profiles WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows.length > 0 ? rows[0].driver_id : null;
}

module.exports = function paymentsRoute(router) {

  // ── POST /api/payments ─────────────────────────────────────────
  // Record or update payment settlement for a trip
  router.post('/api/payments', async (req, res) => {
    const guard = requireRole(['passenger', 'driver', 'admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const {
      trip_id,
      amount,
      payment_method = 'cash',
      payment_status = 'completed'
    } = req.body || {};

    const tripId = parseInt(trip_id, 10);
    if (!tripId) {
      return req.sendJSON(400, { success: false, message: 'Valid trip_id is required.' });
    }

    const validMethods = ['cash', 'card', 'wallet'];
    if (!validMethods.includes(payment_method)) {
      return req.sendJSON(400, {
        success: false,
        message: `Invalid payment_method. Allowed: ${validMethods.join(', ')}`
      });
    }

    const validStatuses = ['pending', 'completed', 'failed', 'refunded'];
    if (!validStatuses.includes(payment_status)) {
      return req.sendJSON(400, {
        success: false,
        message: `Invalid payment_status. Allowed: ${validStatuses.join(', ')}`
      });
    }

    try {
      // 1. Fetch trip and participant info
      const [trips] = await pool.execute(
        `SELECT t.trip_id, t.passenger_id, t.driver_id, t.fare, t.trip_status,
                rr.estimated_fare, rr.pickup_location, rr.destination,
                pp.user_id AS passenger_user_id,
                dp.user_id AS driver_user_id
         FROM trips t
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN driver_profiles dp ON t.driver_id = dp.driver_id
         WHERE t.trip_id = ?`,
        [tripId]
      );

      if (trips.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Trip not found.' });
      }

      const trip = trips[0];
      const currentUserId = guard.user.user_id;
      const currentUserRole = guard.user.role;

      // 2. Authorization check
      if (currentUserRole === 'passenger' && currentUserId !== trip.passenger_user_id) {
        return req.sendJSON(403, { success: false, message: 'You are not the passenger of this trip.' });
      }
      if (currentUserRole === 'driver' && currentUserId !== trip.driver_user_id) {
        return req.sendJSON(403, { success: false, message: 'You are not the assigned driver of this trip.' });
      }

      // 3. Resolve payment amount
      const finalAmount = amount !== undefined && amount !== null && !isNaN(parseFloat(amount))
        ? parseFloat(amount)
        : parseFloat(trip.fare || trip.estimated_fare || 0);

      if (finalAmount < 0) {
        return req.sendJSON(400, { success: false, message: 'Payment amount cannot be negative.' });
      }

      // 4. Upsert payment record
      const [existing] = await pool.execute(
        'SELECT payment_id, payment_status, paid_at FROM payments WHERE trip_id = ? LIMIT 1',
        [tripId]
      );

      let paymentId;
      if (existing.length > 0) {
        paymentId = existing[0].payment_id;
        await pool.execute(
          `UPDATE payments
           SET amount = ?,
               payment_method = ?,
               payment_status = ?,
               paid_at = CASE 
                 WHEN ? = 'completed' THEN COALESCE(paid_at, NOW())
                 ELSE paid_at
               END
           WHERE payment_id = ?`,
          [finalAmount, payment_method, payment_status, payment_status, paymentId]
        );
      } else {
        const [insertRes] = await pool.execute(
          `INSERT INTO payments (trip_id, passenger_id, amount, payment_method, payment_status, paid_at)
           VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'completed' THEN NOW() ELSE NULL END)`,
          [tripId, trip.passenger_id, finalAmount, payment_method, payment_status, payment_status]
        );
        paymentId = insertRes.insertId;
      }

      // 5. Fetch updated payment row
      const [saved] = await pool.execute(
        'SELECT * FROM payments WHERE payment_id = ?',
        [paymentId]
      );

      await logAction({
        userId: currentUserId,
        action: 'RECORD_PAYMENT',
        description: `Payment recorded for Trip #${tripId}. Amount: ₹${finalAmount}, Method: ${payment_method}, Status: ${payment_status}`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: 'Payment recorded successfully.',
        payment: saved[0]
      });

    } catch (err) {
      console.error('[payments/record]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to record payment.' });
    }
  });

  // ── GET /api/payments/trip/:trip_id ────────────────────────────
  // Retrieve payment details & full invoice receipt for a specific trip
  router.get('/api/payments/trip/:trip_id', async (req, res) => {
    const guard = requireRole(['passenger', 'driver', 'admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const tripId = parseInt(req.params.trip_id, 10);
    if (!tripId) {
      return req.sendJSON(400, { success: false, message: 'Valid trip_id is required.' });
    }

    try {
      const [rows] = await pool.execute(
        `SELECT p.payment_id, p.trip_id, p.passenger_id, p.amount, p.payment_method,
                p.payment_status, p.paid_at,
                t.distance_km, t.fare AS trip_fare, t.trip_status, t.start_time, t.end_time,
                rr.pickup_location, rr.destination, rr.vehicle_type, rr.estimated_fare, rr.requested_at,
                u_pass.name AS passenger_name, u_pass.mobile AS passenger_mobile, pp.user_id AS passenger_user_id,
                u_driv.name AS driver_name, u_driv.mobile AS driver_mobile, dp.user_id AS driver_user_id,
                v.vehicle_number, v.model AS vehicle_model
         FROM trips t
         LEFT JOIN payments p ON t.trip_id = p.trip_id
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN users u_pass ON pp.user_id = u_pass.user_id
         JOIN driver_profiles dp ON t.driver_id = dp.driver_id
         JOIN users u_driv ON dp.user_id = u_driv.user_id
         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         WHERE t.trip_id = ?`,
        [tripId]
      );

      if (rows.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Trip not found.' });
      }

      const receipt = rows[0];
      const currentUserId = guard.user.user_id;
      const currentUserRole = guard.user.role;

      // Access control: passenger must own trip, driver must be driver of trip, or admin/superadmin
      if (currentUserRole === 'passenger' && currentUserId !== receipt.passenger_user_id) {
        return req.sendJSON(403, { success: false, message: 'Unauthorized access to trip receipt.' });
      }
      if (currentUserRole === 'driver' && currentUserId !== receipt.driver_user_id) {
        return req.sendJSON(403, { success: false, message: 'Unauthorized access to trip receipt.' });
      }

      req.sendJSON(200, {
        success: true,
        payment: receipt.payment_id ? {
          payment_id: receipt.payment_id,
          trip_id: receipt.trip_id,
          amount: parseFloat(receipt.amount),
          payment_method: receipt.payment_method,
          payment_status: receipt.payment_status,
          paid_at: receipt.paid_at
        } : null,
        receipt: {
          trip_id: receipt.trip_id,
          pickup_location: receipt.pickup_location,
          destination: receipt.destination,
          vehicle_type: receipt.vehicle_type,
          vehicle_model: receipt.vehicle_model,
          vehicle_number: receipt.vehicle_number,
          distance_km: receipt.distance_km ? parseFloat(receipt.distance_km) : null,
          fare: receipt.trip_fare ? parseFloat(receipt.trip_fare) : parseFloat(receipt.estimated_fare || 0),
          trip_status: receipt.trip_status,
          start_time: receipt.start_time,
          end_time: receipt.end_time,
          driver_name: receipt.driver_name,
          driver_mobile: receipt.driver_mobile,
          passenger_name: receipt.passenger_name,
          passenger_mobile: receipt.passenger_mobile
        }
      });

    } catch (err) {
      console.error('[payments/trip]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve trip payment details.' });
    }
  });

  // ── GET /api/passenger/payments ────────────────────────────────
  // Passenger transaction & invoice history with aggregated metrics
  router.get('/api/passenger/payments', async (req, res) => {
    const guard = requireRole(['passenger'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const passengerId = await getPassengerId(pool, guard.user.user_id);
      if (!passengerId) {
        return req.sendJSON(404, { success: false, message: 'Passenger profile not found.' });
      }

      const { status, method, from_date, to_date, limit = 50 } = req.query || {};

      let sql = `
        SELECT p.payment_id, p.trip_id, p.amount, p.payment_method, p.payment_status, p.paid_at,
               t.distance_km, t.fare AS trip_fare, t.trip_status, t.start_time, t.end_time,
               rr.pickup_location, rr.destination, rr.vehicle_type, rr.requested_at,
               u_driv.name AS driver_name, v.vehicle_number, v.model AS vehicle_model
        FROM payments p
        JOIN trips t ON p.trip_id = t.trip_id
        JOIN ride_requests rr ON t.request_id = rr.request_id
        JOIN driver_profiles dp ON t.driver_id = dp.driver_id
        JOIN users u_driv ON dp.user_id = u_driv.user_id
        LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        WHERE p.passenger_id = ?
      `;

      const params = [passengerId];

      if (status) {
        sql += ' AND p.payment_status = ?';
        params.push(status);
      }
      if (method) {
        sql += ' AND p.payment_method = ?';
        params.push(method);
      }
      if (from_date) {
        sql += ' AND p.paid_at >= ?';
        params.push(`${from_date} 00:00:00`);
      }
      if (to_date) {
        sql += ' AND p.paid_at <= ?';
        params.push(`${to_date} 23:59:59`);
      }

      sql += ' ORDER BY COALESCE(p.paid_at, t.start_time) DESC LIMIT ?';
      params.push(Math.min(parseInt(limit, 10) || 50, 100));

      const [payments] = await pool.execute(sql, params);

      // Aggregated summary metrics for this passenger
      const [metrics] = await pool.execute(
        `SELECT
           COUNT(*) AS total_transactions,
           COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END), 0) AS total_spent,
           SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
           SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) AS pending_count
         FROM payments
         WHERE passenger_id = ?`,
        [passengerId]
      );

      req.sendJSON(200, {
        success: true,
        count: payments.length,
        summary: {
          total_spent: parseFloat(metrics[0]?.total_spent || 0),
          total_transactions: parseInt(metrics[0]?.total_transactions || 0, 10),
          completed_count: parseInt(metrics[0]?.completed_count || 0, 10),
          pending_count: parseInt(metrics[0]?.pending_count || 0, 10)
        },
        payments
      });

    } catch (err) {
      console.error('[passenger/payments]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve payment history.' });
    }
  });

};
