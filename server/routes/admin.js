// server/routes/admin.js
// Admin REST API endpoints for Fare Rules, Service Areas, and Fare Estimation

'use strict';

const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAction, getClientIp } = require('../middleware/logger');
const { calculateFare } = require('../utils/fareCalculator');

module.exports = function adminRoute(router) {

  // ==============================================================
  // FARE RULES CRUD
  // ==============================================================

  // ── GET /api/admin/fare-rules ──────────────────────────────────
  // Retrieve all fare rules with summary statistics
  router.get('/api/admin/fare-rules', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const [rules] = await pool.execute(
        `SELECT fare_id, vehicle_type, base_fare, per_km_rate, per_minute_rate, cancellation_fee, status
         FROM fare_rules
         ORDER BY fare_id ASC`
      );

      // Aggregated metrics
      const totalRules = rules.length;
      const activeCount = rules.filter(r => r.status === 'active').length;
      const inactiveCount = totalRules - activeCount;

      let sumBase = 0;
      let sumKm = 0;
      rules.forEach(r => {
        sumBase += parseFloat(r.base_fare || 0);
        sumKm += parseFloat(r.per_km_rate || 0);
      });

      const avgBase = totalRules > 0 ? (sumBase / totalRules).toFixed(2) : 0;
      const avgKm = totalRules > 0 ? (sumKm / totalRules).toFixed(2) : 0;

      req.sendJSON(200, {
        success: true,
        summary: {
          total_rules: totalRules,
          active_count: activeCount,
          inactive_count: inactiveCount,
          avg_base_fare: parseFloat(avgBase),
          avg_per_km_rate: parseFloat(avgKm)
        },
        rules: rules.map(r => ({
          fare_id: r.fare_id,
          vehicle_type: r.vehicle_type,
          base_fare: parseFloat(r.base_fare),
          per_km_rate: parseFloat(r.per_km_rate),
          per_minute_rate: parseFloat(r.per_minute_rate),
          cancellation_fee: parseFloat(r.cancellation_fee),
          status: r.status
        }))
      });

    } catch (err) {
      console.error('[admin/fare-rules/list]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve fare rules.' });
    }
  });

  // ── POST /api/admin/fare-rules ─────────────────────────────────
  // Create a new fare rule for a vehicle category
  router.post('/api/admin/fare-rules', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const {
      vehicle_type,
      base_fare,
      per_km_rate,
      per_minute_rate = 0,
      cancellation_fee = 0,
      status = 'active'
    } = req.body || {};

    const validTypes = ['sedan', 'suv', 'hatchback', 'auto', 'bike'];
    if (!vehicle_type || !validTypes.includes(vehicle_type.toLowerCase())) {
      return req.sendJSON(400, {
        success: false,
        message: `Invalid vehicle_type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const baseFareNum = parseFloat(base_fare);
    const perKmNum = parseFloat(per_km_rate);
    const perMinNum = parseFloat(per_minute_rate);
    const cancelFeeNum = parseFloat(cancellation_fee);

    if (isNaN(baseFareNum) || baseFareNum < 0 || isNaN(perKmNum) || perKmNum < 0) {
      return req.sendJSON(400, {
        success: false,
        message: 'Base fare and Per-KM rate must be valid non-negative numbers.'
      });
    }

    if (isNaN(perMinNum) || perMinNum < 0 || isNaN(cancelFeeNum) || cancelFeeNum < 0) {
      return req.sendJSON(400, {
        success: false,
        message: 'Per-minute rate and cancellation fee must be valid non-negative numbers.'
      });
    }

    const validStatus = status === 'inactive' ? 'inactive' : 'active';
    const cleanType = vehicle_type.toLowerCase();

    try {
      // Check if rule for vehicle_type already exists
      const [existing] = await pool.execute(
        'SELECT fare_id FROM fare_rules WHERE vehicle_type = ? LIMIT 1',
        [cleanType]
      );

      if (existing.length > 0) {
        return req.sendJSON(409, {
          success: false,
          message: `Fare rule for vehicle category "${cleanType}" already exists. Edit the existing rule instead.`
        });
      }

      const [insertRes] = await pool.execute(
        `INSERT INTO fare_rules (vehicle_type, base_fare, per_km_rate, per_minute_rate, cancellation_fee, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cleanType, baseFareNum, perKmNum, perMinNum, cancelFeeNum, validStatus]
      );

      const [newRule] = await pool.execute(
        'SELECT * FROM fare_rules WHERE fare_id = ?',
        [insertRes.insertId]
      );

      await logAction({
        userId: guard.user.user_id,
        action: 'CREATE_FARE_RULE',
        description: `Created fare rule #${insertRes.insertId} for vehicle type '${cleanType}': Base ₹${baseFareNum}, KM ₹${perKmNum}, Min ₹${perMinNum}`,
        ip: getClientIp(req)
      });

      req.sendJSON(201, {
        success: true,
        message: 'Fare rule created successfully.',
        rule: newRule[0]
      });

    } catch (err) {
      console.error('[admin/fare-rules/create]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to create fare rule.' });
    }
  });

  // ── PUT /api/admin/fare-rules/:id ──────────────────────────────
  // Update an existing fare rule
  router.put('/api/admin/fare-rules/:id', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const fareId = parseInt(req.params.id, 10);
    if (!fareId) {
      return req.sendJSON(400, { success: false, message: 'Valid fare rule id is required.' });
    }

    const {
      vehicle_type,
      base_fare,
      per_km_rate,
      per_minute_rate,
      cancellation_fee,
      status
    } = req.body || {};

    try {
      const [existing] = await pool.execute(
        'SELECT * FROM fare_rules WHERE fare_id = ? LIMIT 1',
        [fareId]
      );

      if (existing.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Fare rule not found.' });
      }

      const current = existing[0];
      const validTypes = ['sedan', 'suv', 'hatchback', 'auto', 'bike'];
      let updatedType = current.vehicle_type;

      if (vehicle_type) {
        const cleanType = vehicle_type.toLowerCase();
        if (!validTypes.includes(cleanType)) {
          return req.sendJSON(400, {
            success: false,
            message: `Invalid vehicle_type. Allowed: ${validTypes.join(', ')}`
          });
        }
        // Check uniqueness if changing vehicle type
        if (cleanType !== current.vehicle_type) {
          const [conflict] = await pool.execute(
            'SELECT fare_id FROM fare_rules WHERE vehicle_type = ? AND fare_id != ? LIMIT 1',
            [cleanType, fareId]
          );
          if (conflict.length > 0) {
            return req.sendJSON(409, {
              success: false,
              message: `Another fare rule for '${cleanType}' already exists.`
            });
          }
          updatedType = cleanType;
        }
      }

      const updatedBase = base_fare !== undefined ? parseFloat(base_fare) : parseFloat(current.base_fare);
      const updatedKm = per_km_rate !== undefined ? parseFloat(per_km_rate) : parseFloat(current.per_km_rate);
      const updatedMin = per_minute_rate !== undefined ? parseFloat(per_minute_rate) : parseFloat(current.per_minute_rate);
      const updatedCancel = cancellation_fee !== undefined ? parseFloat(cancellation_fee) : parseFloat(current.cancellation_fee);
      const updatedStatus = status ? (status === 'inactive' ? 'inactive' : 'active') : current.status;

      if (isNaN(updatedBase) || updatedBase < 0 || isNaN(updatedKm) || updatedKm < 0 ||
          isNaN(updatedMin) || updatedMin < 0 || isNaN(updatedCancel) || updatedCancel < 0) {
        return req.sendJSON(400, {
          success: false,
          message: 'Fare rates and cancellation fee must be non-negative numbers.'
        });
      }

      await pool.execute(
        `UPDATE fare_rules
         SET vehicle_type = ?,
             base_fare = ?,
             per_km_rate = ?,
             per_minute_rate = ?,
             cancellation_fee = ?,
             status = ?
         WHERE fare_id = ?`,
        [updatedType, updatedBase, updatedKm, updatedMin, updatedCancel, updatedStatus, fareId]
      );

      const [updated] = await pool.execute(
        'SELECT * FROM fare_rules WHERE fare_id = ?',
        [fareId]
      );

      await logAction({
        userId: guard.user.user_id,
        action: 'UPDATE_FARE_RULE',
        description: `Updated fare rule #${fareId} (${updatedType}): Base ₹${updatedBase}, KM ₹${updatedKm}, Min ₹${updatedMin}, Status: ${updatedStatus}`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: 'Fare rule updated successfully.',
        rule: updated[0]
      });

    } catch (err) {
      console.error('[admin/fare-rules/update]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to update fare rule.' });
    }
  });

  // ── DELETE /api/admin/fare-rules/:id ───────────────────────────
  // Remove or deactivate a fare rule
  router.delete('/api/admin/fare-rules/:id', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const fareId = parseInt(req.params.id, 10);
    if (!fareId) {
      return req.sendJSON(400, { success: false, message: 'Valid fare rule id is required.' });
    }

    try {
      const [existing] = await pool.execute(
        'SELECT fare_id, vehicle_type FROM fare_rules WHERE fare_id = ? LIMIT 1',
        [fareId]
      );

      if (existing.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Fare rule not found.' });
      }

      await pool.execute('DELETE FROM fare_rules WHERE fare_id = ?', [fareId]);

      await logAction({
        userId: guard.user.user_id,
        action: 'DELETE_FARE_RULE',
        description: `Deleted fare rule #${fareId} for vehicle category '${existing[0].vehicle_type}'`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: `Fare rule for ${existing[0].vehicle_type} deleted successfully.`
      });

    } catch (err) {
      console.error('[admin/fare-rules/delete]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to delete fare rule.' });
    }
  });

  // ==============================================================
  // SERVICE AREAS CRUD
  // ==============================================================

  // ── GET /api/admin/service-areas ───────────────────────────────
  // Retrieve list of service areas with search & city filter
  router.get('/api/admin/service-areas', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const { search, city, status } = req.query || {};

    try {
      let sql = 'SELECT area_id, area_name, city, state, status FROM service_areas WHERE 1=1';
      const params = [];

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }
      if (city) {
        sql += ' AND city = ?';
        params.push(city);
      }
      if (search) {
        sql += ' AND (area_name LIKE ? OR city LIKE ? OR state LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      sql += ' ORDER BY city ASC, area_name ASC';

      const [areas] = await pool.execute(sql, params);

      // Aggregates
      const [stats] = await pool.execute(
        `SELECT
           COUNT(*) AS total_areas,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
           COUNT(DISTINCT city) AS cities_count
         FROM service_areas`
      );

      // Distinct cities list for filter dropdown
      const [cities] = await pool.execute(
        'SELECT DISTINCT city FROM service_areas ORDER BY city ASC'
      );

      req.sendJSON(200, {
        success: true,
        summary: {
          total_areas: parseInt(stats[0]?.total_areas || 0, 10),
          active_count: parseInt(stats[0]?.active_count || 0, 10),
          cities_count: parseInt(stats[0]?.cities_count || 0, 10)
        },
        cities: cities.map(c => c.city),
        areas
      });

    } catch (err) {
      console.error('[admin/service-areas/list]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve service areas.' });
    }
  });

  // ── POST /api/admin/service-areas ──────────────────────────────
  // Register a new operational service area
  router.post('/api/admin/service-areas', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const { area_name, city, state, status = 'active' } = req.body || {};

    if (!area_name || !city || !state) {
      return req.sendJSON(400, {
        success: false,
        message: 'Area name, city, and state are all required.'
      });
    }

    const cleanArea = String(area_name).trim().slice(0, 100);
    const cleanCity = String(city).trim().slice(0, 100);
    const cleanState = String(state).trim().slice(0, 100);
    const validStatus = status === 'inactive' ? 'inactive' : 'active';

    try {
      const [insertRes] = await pool.execute(
        `INSERT INTO service_areas (area_name, city, state, status)
         VALUES (?, ?, ?, ?)`,
        [cleanArea, cleanCity, cleanState, validStatus]
      );

      const [newArea] = await pool.execute(
        'SELECT * FROM service_areas WHERE area_id = ?',
        [insertRes.insertId]
      );

      await logAction({
        userId: guard.user.user_id,
        action: 'CREATE_SERVICE_AREA',
        description: `Created service area #${insertRes.insertId}: '${cleanArea}', ${cleanCity}, ${cleanState}`,
        ip: getClientIp(req)
      });

      req.sendJSON(201, {
        success: true,
        message: 'Service area added successfully.',
        area: newArea[0]
      });

    } catch (err) {
      console.error('[admin/service-areas/create]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to add service area.' });
    }
  });

  // ── PUT /api/admin/service-areas/:id ───────────────────────────
  // Update an existing service area
  router.put('/api/admin/service-areas/:id', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const areaId = parseInt(req.params.id, 10);
    if (!areaId) {
      return req.sendJSON(400, { success: false, message: 'Valid service area id is required.' });
    }

    const { area_name, city, state, status } = req.body || {};

    try {
      const [existing] = await pool.execute(
        'SELECT * FROM service_areas WHERE area_id = ? LIMIT 1',
        [areaId]
      );

      if (existing.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Service area not found.' });
      }

      const current = existing[0];
      const updatedArea = area_name ? String(area_name).trim().slice(0, 100) : current.area_name;
      const updatedCity = city ? String(city).trim().slice(0, 100) : current.city;
      const updatedState = state ? String(state).trim().slice(0, 100) : current.state;
      const updatedStatus = status ? (status === 'inactive' ? 'inactive' : 'active') : current.status;

      await pool.execute(
        `UPDATE service_areas
         SET area_name = ?,
             city = ?,
             state = ?,
             status = ?
         WHERE area_id = ?`,
        [updatedArea, updatedCity, updatedState, updatedStatus, areaId]
      );

      const [updated] = await pool.execute(
        'SELECT * FROM service_areas WHERE area_id = ?',
        [areaId]
      );

      await logAction({
        userId: guard.user.user_id,
        action: 'UPDATE_SERVICE_AREA',
        description: `Updated service area #${areaId}: '${updatedArea}', ${updatedCity}, ${updatedState} (${updatedStatus})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: 'Service area updated successfully.',
        area: updated[0]
      });

    } catch (err) {
      console.error('[admin/service-areas/update]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to update service area.' });
    }
  });

  // ── DELETE /api/admin/service-areas/:id ────────────────────────
  // Delete a service area
  router.delete('/api/admin/service-areas/:id', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const areaId = parseInt(req.params.id, 10);
    if (!areaId) {
      return req.sendJSON(400, { success: false, message: 'Valid service area id is required.' });
    }

    try {
      const [existing] = await pool.execute(
        'SELECT area_id, area_name, city FROM service_areas WHERE area_id = ? LIMIT 1',
        [areaId]
      );

      if (existing.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Service area not found.' });
      }

      await pool.execute('DELETE FROM service_areas WHERE area_id = ?', [areaId]);

      await logAction({
        userId: guard.user.user_id,
        action: 'DELETE_SERVICE_AREA',
        description: `Deleted service area #${areaId}: '${existing[0].area_name}' (${existing[0].city})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: `Service area "${existing[0].area_name}" removed successfully.`
      });

    } catch (err) {
      console.error('[admin/service-areas/delete]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to delete service area.' });
    }
  });

  // ── POST /api/admin/fare-calculator ────────────────────────────
  // Instant simulation helper for admin testing and verification
  router.post('/api/admin/fare-calculator', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const { vehicle_type, distance_km, duration_minutes = 0 } = req.body || {};

    const dist = parseFloat(distance_km);
    const dur = parseFloat(duration_minutes) || 0;

    if (isNaN(dist) || dist <= 0) {
      return req.sendJSON(400, { success: false, message: 'Valid positive distance_km is required.' });
    }

    try {
      const [rules] = await pool.execute(
        `SELECT vehicle_type, base_fare, per_km_rate, per_minute_rate, cancellation_fee
         FROM fare_rules
         WHERE vehicle_type = ? AND status = 'active'
         LIMIT 1`,
        [vehicle_type || 'sedan']
      );

      if (rules.length === 0) {
        return req.sendJSON(404, {
          success: false,
          message: `No active fare rule found for vehicle type '${vehicle_type}'.`
        });
      }

      const rule = rules[0];
      const baseFare = parseFloat(rule.base_fare);
      const kmRate = parseFloat(rule.per_km_rate);
      const minRate = parseFloat(rule.per_minute_rate);

      const distanceComponent = parseFloat((dist * kmRate).toFixed(2));
      const timeComponent = parseFloat((dur * minRate).toFixed(2));
      const totalFare = calculateFare(dist, baseFare, kmRate, dur, minRate);

      req.sendJSON(200, {
        success: true,
        calculation: {
          vehicle_type: rule.vehicle_type,
          distance_km: dist,
          duration_minutes: dur,
          breakdown: {
            base_fare: baseFare,
            distance_cost: distanceComponent,
            time_cost: timeComponent,
            per_km_rate: kmRate,
            per_minute_rate: minRate
          },
          total_fare: totalFare
        }
      });

    } catch (err) {
      console.error('[admin/fare-calculator]', err.message);
      req.sendJSON(500, { success: false, message: 'Fare calculation simulation failed.' });
    }
  });

  // ==============================================================
  // DAY 7: PASSENGERS MANAGEMENT
  // ==============================================================

  // ── GET /api/admin/passengers ──────────────────────────────────
  // Paginated list of passengers with search, filters, and usage metrics
  router.get('/api/admin/passengers', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const offset = (page - 1) * limit;
      const search = (req.query.search || '').trim();
      const statusFilter = (req.query.status || '').trim().toLowerCase();

      const conditions = ["u.role = 'passenger'"];
      const params = [];

      if (search) {
        conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)');
        const wild = `%${search}%`;
        params.push(wild, wild, wild);
      }

      if (statusFilter && ['active', 'inactive', 'blocked'].includes(statusFilter)) {
        conditions.push('u.status = ?');
        params.push(statusFilter);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const [countRows] = await pool.execute(
        `SELECT COUNT(DISTINCT pp.passenger_id) AS total
         FROM users u
         JOIN passenger_profiles pp ON u.user_id = pp.user_id
         ${whereClause}`,
        params
      );
      const total = countRows[0]?.total || 0;

      // Data query with metrics
      const [rows] = await pool.execute(
        `SELECT 
           pp.passenger_id,
           pp.user_id,
           pp.default_address,
           pp.emergency_contact,
           u.name,
           u.email,
           u.mobile,
           u.status,
           u.created_at,
           COUNT(DISTINCT t.trip_id) AS total_trips,
           COALESCE(SUM(CASE WHEN p.payment_status = 'completed' THEN p.amount ELSE 0 END), 0) AS total_spent,
           MAX(t.end_time) AS last_trip_at
         FROM users u
         JOIN passenger_profiles pp ON u.user_id = pp.user_id
         LEFT JOIN trips t ON pp.passenger_id = t.passenger_id
         LEFT JOIN payments p ON t.trip_id = p.trip_id
         ${whereClause}
         GROUP BY pp.passenger_id, pp.user_id, pp.default_address, pp.emergency_contact,
                  u.name, u.email, u.mobile, u.status, u.created_at
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, String(limit), String(offset)]
      );

      // Status counters
      const [statusCounts] = await pool.execute(
        `SELECT 
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
           SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked_count
         FROM users
         WHERE role = 'passenger'`
      );

      req.sendJSON(200, {
        success: true,
        summary: {
          total: statusCounts[0]?.total || 0,
          active: statusCounts[0]?.active_count || 0,
          blocked: statusCounts[0]?.blocked_count || 0
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        passengers: rows.map(r => ({
          passenger_id: r.passenger_id,
          user_id: r.user_id,
          name: r.name,
          email: r.email,
          mobile: r.mobile,
          status: r.status,
          default_address: r.default_address || '',
          emergency_contact: r.emergency_contact || '',
          total_trips: parseInt(r.total_trips, 10) || 0,
          total_spent: parseFloat(r.total_spent || 0),
          last_trip_at: r.last_trip_at,
          created_at: r.created_at
        }))
      });

    } catch (err) {
      console.error('[admin/passengers/list]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve passengers.' });
    }
  });

  // ── PUT /api/admin/passengers/:id/block ─────────────────────────
  // Block a passenger account
  router.put('/api/admin/passengers/:id/block', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const id = parseInt(req.params.id, 10);
    if (!id) return req.sendJSON(400, { success: false, message: 'Valid passenger ID is required.' });

    try {
      const [rows] = await pool.execute(
        `SELECT u.user_id, u.name, u.email, u.status
         FROM users u
         JOIN passenger_profiles pp ON u.user_id = pp.user_id
         WHERE pp.passenger_id = ? OR u.user_id = ?
         LIMIT 1`,
        [id, id]
      );

      if (rows.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Passenger not found.' });
      }

      const passenger = rows[0];
      await pool.execute("UPDATE users SET status = 'blocked' WHERE user_id = ?", [passenger.user_id]);

      await logAction({
        userId: guard.user.user_id,
        action: 'BLOCK_PASSENGER',
        description: `Blocked passenger #${passenger.user_id} (${passenger.name} - ${passenger.email})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: `Passenger "${passenger.name}" has been blocked successfully.`
      });

    } catch (err) {
      console.error('[admin/passengers/block]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to block passenger.' });
    }
  });

  // ── PUT /api/admin/passengers/:id/unblock ───────────────────────
  // Unblock a passenger account
  router.put('/api/admin/passengers/:id/unblock', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const id = parseInt(req.params.id, 10);
    if (!id) return req.sendJSON(400, { success: false, message: 'Valid passenger ID is required.' });

    try {
      const [rows] = await pool.execute(
        `SELECT u.user_id, u.name, u.email, u.status
         FROM users u
         JOIN passenger_profiles pp ON u.user_id = pp.user_id
         WHERE pp.passenger_id = ? OR u.user_id = ?
         LIMIT 1`,
        [id, id]
      );

      if (rows.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Passenger not found.' });
      }

      const passenger = rows[0];
      await pool.execute("UPDATE users SET status = 'active' WHERE user_id = ?", [passenger.user_id]);

      await logAction({
        userId: guard.user.user_id,
        action: 'UNBLOCK_PASSENGER',
        description: `Unblocked passenger #${passenger.user_id} (${passenger.name} - ${passenger.email})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: `Passenger "${passenger.name}" has been restored to active status.`
      });

    } catch (err) {
      console.error('[admin/passengers/unblock]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to unblock passenger.' });
    }
  });


  // ==============================================================
  // DAY 7: DRIVERS MANAGEMENT
  // ==============================================================

  // ── GET /api/admin/drivers ─────────────────────────────────────
  // Full list of drivers with verification status, fleet details, ratings, and filters
  router.get('/api/admin/drivers', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const search = (req.query.search || '').trim();
      const verificationFilter = (req.query.verification || req.query.status || '').trim().toLowerCase();
      const availabilityFilter = (req.query.availability || '').trim().toLowerCase();

      const conditions = ["u.role = 'driver'"];
      const params = [];

      if (search) {
        conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ? OR dp.license_no LIKE ?)');
        const wild = `%${search}%`;
        params.push(wild, wild, wild, wild);
      }

      if (verificationFilter && ['pending', 'approved', 'rejected'].includes(verificationFilter)) {
        conditions.push('dp.verification_status = ?');
        params.push(verificationFilter);
      } else if (verificationFilter === 'blocked') {
        conditions.push("u.status = 'blocked'");
      }

      if (availabilityFilter && ['online', 'offline'].includes(availabilityFilter)) {
        conditions.push('dp.availability = ?');
        params.push(availabilityFilter);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const [drivers] = await pool.execute(
        `SELECT 
           dp.driver_id,
           dp.user_id,
           dp.license_no,
           dp.license_expiry,
           dp.verification_status,
           dp.availability,
           dp.rating,
           u.name,
           u.email,
           u.mobile,
           u.status AS account_status,
           u.created_at,
           COUNT(DISTINCT t.trip_id) AS total_trips,
           COUNT(DISTINCT CASE WHEN t.trip_status = 'completed' THEN t.trip_id END) AS completed_trips,
           COALESCE(SUM(CASE WHEN t.trip_status = 'completed' THEN t.fare ELSE 0 END), 0) AS total_earnings,
           v.vehicle_id,
           v.vehicle_number,
           v.vehicle_type,
           v.model AS vehicle_model,
           v.status AS vehicle_status
         FROM driver_profiles dp
         JOIN users u ON dp.user_id = u.user_id
         LEFT JOIN trips t ON dp.driver_id = t.driver_id
         LEFT JOIN vehicles v ON dp.driver_id = v.driver_id AND v.status = 'active'
         ${whereClause}
         GROUP BY dp.driver_id, dp.user_id, dp.license_no, dp.license_expiry,
                  dp.verification_status, dp.availability, dp.rating,
                  u.name, u.email, u.mobile, u.status, u.created_at,
                  v.vehicle_id, v.vehicle_number, v.vehicle_type, v.model, v.status
         ORDER BY 
           CASE WHEN dp.verification_status = 'pending' THEN 0 ELSE 1 END,
           dp.driver_id DESC`,
        params
      );

      // KPI stats for drivers
      const [stats] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_drivers,
           SUM(CASE WHEN dp.verification_status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
           SUM(CASE WHEN dp.verification_status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
           SUM(CASE WHEN dp.verification_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
           SUM(CASE WHEN dp.availability = 'online' THEN 1 ELSE 0 END) AS online_count,
           SUM(CASE WHEN u.status = 'blocked' THEN 1 ELSE 0 END) AS blocked_count
         FROM driver_profiles dp
         JOIN users u ON dp.user_id = u.user_id`
      );

      req.sendJSON(200, {
        success: true,
        summary: {
          total: stats[0]?.total_drivers || 0,
          pending: stats[0]?.pending_count || 0,
          approved: stats[0]?.approved_count || 0,
          rejected: stats[0]?.rejected_count || 0,
          online: stats[0]?.online_count || 0,
          blocked: stats[0]?.blocked_count || 0
        },
        drivers: drivers.map(d => ({
          driver_id: d.driver_id,
          user_id: d.user_id,
          name: d.name,
          email: d.email,
          mobile: d.mobile,
          license_no: d.license_no,
          license_expiry: d.license_expiry,
          verification_status: d.verification_status,
          availability: d.availability,
          rating: parseFloat(d.rating || 0),
          account_status: d.account_status,
          total_trips: parseInt(d.total_trips, 10) || 0,
          completed_trips: parseInt(d.completed_trips, 10) || 0,
          total_earnings: parseFloat(d.total_earnings || 0),
          created_at: d.created_at,
          vehicle: d.vehicle_id ? {
            vehicle_id: d.vehicle_id,
            vehicle_number: d.vehicle_number,
            vehicle_type: d.vehicle_type,
            model: d.vehicle_model,
            status: d.vehicle_status
          } : null
        }))
      });

    } catch (err) {
      console.error('[admin/drivers/list]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve drivers.' });
    }
  });

  // Helper for driver state transitions
  async function updateDriverState(req, res, action) {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const id = parseInt(req.params.id, 10);
    if (!id) return req.sendJSON(400, { success: false, message: 'Valid driver ID is required.' });

    try {
      const [rows] = await pool.execute(
        `SELECT dp.driver_id, dp.user_id, dp.verification_status, u.name, u.email, u.status AS account_status
         FROM driver_profiles dp
         JOIN users u ON dp.user_id = u.user_id
         WHERE dp.driver_id = ? OR u.user_id = ?
         LIMIT 1`,
        [id, id]
      );

      if (rows.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Driver not found.' });
      }

      const driver = rows[0];

      if (action === 'approve') {
        await pool.execute("UPDATE driver_profiles SET verification_status = 'approved' WHERE driver_id = ?", [driver.driver_id]);
        await pool.execute("UPDATE users SET status = 'active' WHERE user_id = ?", [driver.user_id]);
      } else if (action === 'reject') {
        await pool.execute("UPDATE driver_profiles SET verification_status = 'rejected' WHERE driver_id = ?", [driver.driver_id]);
      } else if (action === 'block') {
        await pool.execute("UPDATE users SET status = 'blocked' WHERE user_id = ?", [driver.user_id]);
      } else if (action === 'unblock') {
        await pool.execute("UPDATE users SET status = 'active' WHERE user_id = ?", [driver.user_id]);
      } else {
        return req.sendJSON(400, { success: false, message: `Unsupported driver action: ${action}` });
      }

      await logAction({
        userId: guard.user.user_id,
        action: `DRIVER_${action.toUpperCase()}`,
        description: `Admin executed ${action} on driver #${driver.driver_id} (${driver.name})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: `Driver "${driver.name}" has been ${action}d successfully.`,
        driver_id: driver.driver_id,
        action
      });

    } catch (err) {
      console.error(`[admin/drivers/${action}]`, err.message);
      req.sendJSON(500, { success: false, message: `Failed to ${action} driver.` });
    }
  }

  // ── PUT /api/admin/drivers/:id/approve ──────────────────────────
  router.put('/api/admin/drivers/:id/approve', (req, res) => updateDriverState(req, res, 'approve'));

  // ── PUT /api/admin/drivers/:id/reject ───────────────────────────
  router.put('/api/admin/drivers/:id/reject', (req, res) => updateDriverState(req, res, 'reject'));

  // ── PUT /api/admin/drivers/:id/block ────────────────────────────
  router.put('/api/admin/drivers/:id/block', (req, res) => updateDriverState(req, res, 'block'));

  // ── PUT /api/admin/drivers/:id/unblock ──────────────────────────
  router.put('/api/admin/drivers/:id/unblock', (req, res) => updateDriverState(req, res, 'unblock'));


  // ==============================================================
  // DAY 7: FLEET VEHICLES MANAGEMENT
  // ==============================================================

  // ── GET /api/admin/vehicles ────────────────────────────────────
  // List all registered fleet vehicles with assigned driver details
  router.get('/api/admin/vehicles', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const search = (req.query.search || '').trim();
      const statusFilter = (req.query.status || '').trim().toLowerCase();
      const typeFilter = (req.query.type || '').trim().toLowerCase();

      const conditions = [];
      const params = [];

      if (search) {
        conditions.push('(v.vehicle_number LIKE ? OR v.model LIKE ? OR u.name LIKE ?)');
        const wild = `%${search}%`;
        params.push(wild, wild, wild);
      }

      if (statusFilter && ['active', 'inactive'].includes(statusFilter)) {
        conditions.push('v.status = ?');
        params.push(statusFilter);
      }

      if (typeFilter && ['sedan', 'suv', 'hatchback', 'auto', 'bike'].includes(typeFilter)) {
        conditions.push('v.vehicle_type = ?');
        params.push(typeFilter);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const [vehicles] = await pool.execute(
        `SELECT 
           v.vehicle_id,
           v.driver_id,
           v.vehicle_number,
           v.vehicle_type,
           v.model,
           v.capacity,
           v.status,
           dp.verification_status AS driver_verification,
           dp.availability AS driver_availability,
           dp.rating AS driver_rating,
           u.name AS driver_name,
           u.email AS driver_email,
           u.mobile AS driver_mobile,
           u.status AS driver_status,
           COUNT(t.trip_id) AS total_trips
         FROM vehicles v
         JOIN driver_profiles dp ON v.driver_id = dp.driver_id
         JOIN users u ON dp.user_id = u.user_id
         LEFT JOIN trips t ON v.vehicle_id = t.vehicle_id
         ${whereClause}
         GROUP BY v.vehicle_id, v.driver_id, v.vehicle_number, v.vehicle_type,
                  v.model, v.capacity, v.status, dp.verification_status,
                  dp.availability, dp.rating, u.name, u.email, u.mobile, u.status
         ORDER BY v.vehicle_id DESC`,
        params
      );

      // Fleet metrics
      const [fleetStats] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_fleet,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_fleet,
           SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_fleet,
           SUM(CASE WHEN vehicle_type = 'sedan' THEN 1 ELSE 0 END) AS sedan_count,
           SUM(CASE WHEN vehicle_type = 'suv' THEN 1 ELSE 0 END) AS suv_count,
           SUM(CASE WHEN vehicle_type = 'hatchback' THEN 1 ELSE 0 END) AS hatchback_count,
           SUM(CASE WHEN vehicle_type = 'auto' THEN 1 ELSE 0 END) AS auto_count,
           SUM(CASE WHEN vehicle_type = 'bike' THEN 1 ELSE 0 END) AS bike_count
         FROM vehicles`
      );

      req.sendJSON(200, {
        success: true,
        summary: {
          total: fleetStats[0]?.total_fleet || 0,
          active: fleetStats[0]?.active_fleet || 0,
          inactive: fleetStats[0]?.inactive_fleet || 0,
          by_type: {
            sedan: fleetStats[0]?.sedan_count || 0,
            suv: fleetStats[0]?.suv_count || 0,
            hatchback: fleetStats[0]?.hatchback_count || 0,
            auto: fleetStats[0]?.auto_count || 0,
            bike: fleetStats[0]?.bike_count || 0
          }
        },
        vehicles: vehicles.map(v => ({
          vehicle_id: v.vehicle_id,
          driver_id: v.driver_id,
          vehicle_number: v.vehicle_number,
          vehicle_type: v.vehicle_type,
          model: v.model,
          capacity: v.capacity,
          status: v.status,
          total_trips: parseInt(v.total_trips, 10) || 0,
          driver: {
            name: v.driver_name,
            email: v.driver_email,
            mobile: v.driver_mobile,
            verification_status: v.driver_verification,
            availability: v.driver_availability,
            rating: parseFloat(v.driver_rating || 0),
            account_status: v.driver_status
          }
        }))
      });

    } catch (err) {
      console.error('[admin/vehicles/list]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve vehicle fleet.' });
    }
  });

  // ── PUT /api/admin/vehicles/:id/status ──────────────────────────
  // Toggle or update vehicle operational status (active / inactive)
  router.put('/api/admin/vehicles/:id/status', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const vehicleId = parseInt(req.params.id, 10);
    if (!vehicleId) return req.sendJSON(400, { success: false, message: 'Valid vehicle ID is required.' });

    try {
      const [rows] = await pool.execute(
        'SELECT vehicle_id, vehicle_number, model, status FROM vehicles WHERE vehicle_id = ? LIMIT 1',
        [vehicleId]
      );

      if (rows.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Vehicle not found.' });
      }

      const vehicle = rows[0];
      const targetStatus = req.body?.status && ['active', 'inactive'].includes(req.body.status)
        ? req.body.status
        : (vehicle.status === 'active' ? 'inactive' : 'active');

      await pool.execute('UPDATE vehicles SET status = ? WHERE vehicle_id = ?', [targetStatus, vehicleId]);

      await logAction({
        userId: guard.user.user_id,
        action: 'UPDATE_VEHICLE_STATUS',
        description: `Set vehicle #${vehicleId} (${vehicle.vehicle_number} - ${vehicle.model}) status to ${targetStatus}`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: `Vehicle "${vehicle.vehicle_number}" status updated to ${targetStatus}.`,
        status: targetStatus
      });

    } catch (err) {
      console.error('[admin/vehicles/status]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to update vehicle status.' });
    }
  });


  // ==============================================================
  // DAY 7: TRIPS MONITORING & FORCE-COMPLETE
  // ==============================================================

  // ── GET /api/admin/trips ───────────────────────────────────────
  // Real-time trip inspection, route histories, fares, and search filters
  router.get('/api/admin/trips', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const statusFilter = (req.query.status || '').trim().toLowerCase();
      const search = (req.query.search || '').trim();
      const fromDate = (req.query.from || '').trim();
      const toDate = (req.query.to || '').trim();
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

      const conditions = [];
      const params = [];

      if (statusFilter && ['accepted', 'in_progress', 'completed', 'cancelled'].includes(statusFilter)) {
        conditions.push('t.trip_status = ?');
        params.push(statusFilter);
      }

      if (search) {
        conditions.push('(rr.pickup_location LIKE ? OR rr.destination LIKE ? OR p_user.name LIKE ? OR d_user.name LIKE ? OR v.vehicle_number LIKE ?)');
        const wild = `%${search}%`;
        params.push(wild, wild, wild, wild, wild);
      }

      if (fromDate) {
        conditions.push('DATE(rr.requested_at) >= ?');
        params.push(fromDate);
      }

      if (toDate) {
        conditions.push('DATE(rr.requested_at) <= ?');
        params.push(toDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const [trips] = await pool.execute(
        `SELECT 
           t.trip_id,
           t.request_id,
           t.passenger_id,
           t.driver_id,
           t.vehicle_id,
           t.start_time,
           t.end_time,
           t.distance_km,
           t.fare,
           t.trip_status,
           rr.pickup_location,
           rr.destination,
           rr.requested_at,
           rr.vehicle_type,
           rr.estimated_fare,
           p_user.name AS passenger_name,
           p_user.mobile AS passenger_mobile,
           p_user.email AS passenger_email,
           d_user.name AS driver_name,
           d_user.mobile AS driver_mobile,
           v.vehicle_number,
           v.model AS vehicle_model,
           pay.payment_id,
           pay.amount AS payment_amount,
           pay.payment_method,
           pay.payment_status,
           pay.paid_at,
           rev.rating,
           rev.comment AS review_comment
         FROM trips t
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN users p_user ON pp.user_id = p_user.user_id
         JOIN driver_profiles dp ON t.driver_id = dp.driver_id
         JOIN users d_user ON dp.user_id = d_user.user_id
         JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         LEFT JOIN payments pay ON t.trip_id = pay.trip_id
         LEFT JOIN ratings_reviews rev ON t.trip_id = rev.trip_id AND rev.reviewer_id = p_user.user_id
         ${whereClause}
         ORDER BY t.trip_id DESC
         LIMIT ?`,
        [...params, String(limit)]
      );

      // Trip metrics
      const [tripMetrics] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_trips,
           SUM(CASE WHEN trip_status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
           SUM(CASE WHEN trip_status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
           SUM(CASE WHEN trip_status = 'accepted' THEN 1 ELSE 0 END) AS accepted_count,
           SUM(CASE WHEN trip_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
           COALESCE(SUM(CASE WHEN trip_status = 'completed' THEN fare ELSE 0 END), 0) AS total_revenue
         FROM trips`
      );

      req.sendJSON(200, {
        success: true,
        summary: {
          total: tripMetrics[0]?.total_trips || 0,
          completed: tripMetrics[0]?.completed_count || 0,
          in_progress: tripMetrics[0]?.in_progress_count || 0,
          accepted: tripMetrics[0]?.accepted_count || 0,
          cancelled: tripMetrics[0]?.cancelled_count || 0,
          total_revenue: parseFloat(tripMetrics[0]?.total_revenue || 0)
        },
        trips: trips.map(t => ({
          trip_id: t.trip_id,
          request_id: t.request_id,
          passenger_id: t.passenger_id,
          driver_id: t.driver_id,
          vehicle_id: t.vehicle_id,
          pickup_location: t.pickup_location,
          destination: t.destination,
          vehicle_type: t.vehicle_type,
          vehicle_number: t.vehicle_number,
          vehicle_model: t.vehicle_model,
          passenger_name: t.passenger_name,
          passenger_mobile: t.passenger_mobile,
          passenger_email: t.passenger_email,
          driver_name: t.driver_name,
          driver_mobile: t.driver_mobile,
          start_time: t.start_time,
          end_time: t.end_time,
          requested_at: t.requested_at,
          distance_km: t.distance_km ? parseFloat(t.distance_km) : null,
          fare: t.fare ? parseFloat(t.fare) : (t.estimated_fare ? parseFloat(t.estimated_fare) : 0),
          trip_status: t.trip_status,
          payment: t.payment_id ? {
            payment_id: t.payment_id,
            amount: parseFloat(t.payment_amount),
            payment_method: t.payment_method,
            payment_status: t.payment_status,
            paid_at: t.paid_at
          } : null,
          rating: t.rating ? {
            rating: t.rating,
            comment: t.review_comment
          } : null
        }))
      });

    } catch (err) {
      console.error('[admin/trips/list]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve trips.' });
    }
  });

  // ── PUT /api/admin/trips/:id/complete ───────────────────────────
  // Admin emergency override to mark a stalled or ongoing trip as completed
  router.put('/api/admin/trips/:id/complete', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const tripId = parseInt(req.params.id, 10);
    if (!tripId) return req.sendJSON(400, { success: false, message: 'Valid trip ID is required.' });

    try {
      const [trips] = await pool.execute(
        `SELECT t.trip_id, t.request_id, t.passenger_id, t.driver_id, t.fare, t.trip_status,
                rr.estimated_fare
         FROM trips t
         JOIN ride_requests rr ON t.request_id = rr.request_id
         WHERE t.trip_id = ?
         LIMIT 1`,
        [tripId]
      );

      if (trips.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Trip not found.' });
      }

      const trip = trips[0];
      if (trip.trip_status === 'completed') {
        return req.sendJSON(400, { success: false, message: 'Trip is already marked as completed.' });
      }

      const finalFare = trip.fare || trip.estimated_fare || 150.00;

      // Update trip record
      await pool.execute(
        `UPDATE trips 
         SET trip_status = 'completed', 
             end_time = COALESCE(end_time, NOW()),
             start_time = COALESCE(start_time, NOW()),
             fare = ?
         WHERE trip_id = ?`,
        [finalFare, tripId]
      );

      // Update request record
      await pool.execute(
        "UPDATE ride_requests SET status = 'completed' WHERE request_id = ?",
        [trip.request_id]
      );

      // Ensure payment entry exists
      const [payments] = await pool.execute(
        'SELECT payment_id FROM payments WHERE trip_id = ? LIMIT 1',
        [tripId]
      );

      if (payments.length === 0) {
        await pool.execute(
          `INSERT INTO payments (trip_id, passenger_id, amount, payment_method, payment_status, paid_at)
           VALUES (?, ?, ?, 'cash', 'completed', NOW())`,
          [tripId, trip.passenger_id, finalFare]
        );
      } else {
        await pool.execute(
          "UPDATE payments SET payment_status = 'completed', paid_at = COALESCE(paid_at, NOW()) WHERE trip_id = ?",
          [tripId]
        );
      }

      await logAction({
        userId: guard.user.user_id,
        action: 'ADMIN_FORCE_COMPLETE_TRIP',
        description: `Admin marked trip #${tripId} as completed (Fare: ₹${finalFare})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: `Trip #${tripId} has been successfully completed.`,
        trip_id: tripId,
        fare: parseFloat(finalFare)
      });

    } catch (err) {
      console.error('[admin/trips/complete]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to complete trip.' });
    }
  });


  // ==============================================================
  // DAY 7: ADMIN DASHBOARD AGGREGATED METRICS & RECENT ACTIVITY
  // ==============================================================

  // ── GET /api/admin/stats ───────────────────────────────────────
  // Consolidated system KPI stats, recent activity logs, and trends for canvas charts
  router.get('/api/admin/stats', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      // 1. Passenger counts
      const [pCounts] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_passengers,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_passengers,
           SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked_passengers,
           SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS new_passengers_7d
         FROM users
         WHERE role = 'passenger'`
      );

      // 2. Driver counts
      const [dCounts] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_drivers,
           SUM(CASE WHEN dp.verification_status = 'pending' THEN 1 ELSE 0 END) AS pending_drivers,
           SUM(CASE WHEN dp.verification_status = 'approved' THEN 1 ELSE 0 END) AS approved_drivers,
           SUM(CASE WHEN dp.availability = 'online' THEN 1 ELSE 0 END) AS online_drivers
         FROM driver_profiles dp
         JOIN users u ON dp.user_id = u.user_id`
      );

      // 3. Fleet counts
      const [vCounts] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_vehicles,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_vehicles
         FROM vehicles`
      );

      // 4. Trip counts & revenue
      const [tCounts] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_trips,
           SUM(CASE WHEN trip_status = 'completed' THEN 1 ELSE 0 END) AS completed_trips,
           SUM(CASE WHEN trip_status = 'in_progress' THEN 1 ELSE 0 END) AS active_trips,
           SUM(CASE WHEN trip_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_trips,
           COALESCE(SUM(CASE WHEN trip_status = 'completed' THEN fare ELSE 0 END), 0) AS total_revenue
         FROM trips`
      );

      // 5. Recent 6 trips
      const [recentTrips] = await pool.execute(
        `SELECT 
           t.trip_id,
           t.fare,
           t.trip_status,
           t.start_time,
           rr.pickup_location,
           rr.destination,
           rr.vehicle_type,
           rr.requested_at,
           p_user.name AS passenger_name,
           d_user.name AS driver_name,
           v.vehicle_number
         FROM trips t
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN users p_user ON pp.user_id = p_user.user_id
         JOIN driver_profiles dp ON t.driver_id = dp.driver_id
         JOIN users d_user ON dp.user_id = d_user.user_id
         JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         ORDER BY t.trip_id DESC
         LIMIT 6`
      );

      // 6. Recent system logs
      const [recentLogs] = await pool.execute(
        `SELECT 
           sl.log_id,
           sl.user_id,
           sl.action,
           sl.description,
           sl.ip_address,
           sl.created_at,
           u.name AS user_name,
           u.role AS user_role
         FROM system_logs sl
         LEFT JOIN users u ON sl.user_id = u.user_id
         ORDER BY sl.log_id DESC
         LIMIT 8`
      );

      // 7. Last 7 days breakdown for Canvas chart
      const [chartTrends] = await pool.execute(
        `SELECT 
           DATE(rr.requested_at) AS date_label,
           COUNT(*) AS trip_count,
           COALESCE(SUM(CASE WHEN t.trip_status = 'completed' THEN t.fare ELSE 0 END), 0) AS daily_revenue
         FROM ride_requests rr
         LEFT JOIN trips t ON rr.request_id = t.request_id
         WHERE rr.requested_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(rr.requested_at)
         ORDER BY date_label ASC`
      );

      // 8. Vehicle distribution
      const [vehicleDist] = await pool.execute(
        `SELECT vehicle_type, COUNT(*) AS count
         FROM vehicles
         GROUP BY vehicle_type`
      );

      req.sendJSON(200, {
        success: true,
        stats: {
          passengers: {
            total: pCounts[0]?.total_passengers || 0,
            active: pCounts[0]?.active_passengers || 0,
            blocked: pCounts[0]?.blocked_passengers || 0,
            new_7d: pCounts[0]?.new_passengers_7d || 0
          },
          drivers: {
            total: dCounts[0]?.total_drivers || 0,
            pending: dCounts[0]?.pending_drivers || 0,
            approved: dCounts[0]?.approved_drivers || 0,
            online: dCounts[0]?.online_drivers || 0
          },
          fleet: {
            total: vCounts[0]?.total_vehicles || 0,
            active: vCounts[0]?.active_vehicles || 0
          },
          trips: {
            total: tCounts[0]?.total_trips || 0,
            completed: tCounts[0]?.completed_trips || 0,
            active: tCounts[0]?.active_trips || 0,
            cancelled: tCounts[0]?.cancelled_trips || 0,
            revenue: parseFloat(tCounts[0]?.total_revenue || 0)
          }
        },
        recent_trips: recentTrips.map(rt => ({
          trip_id: rt.trip_id,
          pickup: rt.pickup_location,
          destination: rt.destination,
          vehicle_type: rt.vehicle_type,
          vehicle_number: rt.vehicle_number,
          passenger_name: rt.passenger_name,
          driver_name: rt.driver_name,
          fare: parseFloat(rt.fare || 0),
          status: rt.trip_status,
          requested_at: rt.requested_at
        })),
        recent_logs: recentLogs.map(l => ({
          log_id: l.log_id,
          action: l.action,
          description: l.description,
          ip: l.ip_address,
          created_at: l.created_at,
          user: l.user_name ? `${l.user_name} (${l.user_role})` : 'System'
        })),
        chart_data: {
          trends: chartTrends.map(ct => ({
            date: ct.date_label,
            trips: parseInt(ct.trip_count, 10) || 0,
            revenue: parseFloat(ct.daily_revenue || 0)
          })),
          vehicle_dist: vehicleDist.map(vd => ({
            type: vd.vehicle_type,
            count: parseInt(vd.count, 10) || 0
          }))
        }
      });

    } catch (err) {
      console.error('[admin/stats]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve admin dashboard stats.' });
    }
  });

  // ==============================================================
  // REPORTS MODULE (DAY 8)
  // ==============================================================

  // ── GET /api/admin/reports/revenue ─────────────────────────────
  // Financial performance, payment method breakdown, daily revenue trends
  router.get('/api/admin/reports/revenue', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const { from, to } = req.query || {};

      const whereClauses = ["t.trip_status = 'completed'"];
      const params = [];

      if (from) {
        whereClauses.push('DATE(COALESCE(t.end_time, t.start_time, p.paid_at)) >= ?');
        params.push(from);
      }
      if (to) {
        whereClauses.push('DATE(COALESCE(t.end_time, t.start_time, p.paid_at)) <= ?');
        params.push(to);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // 1. Overall Revenue & Financial KPI Summary
      const [kpiRows] = await pool.execute(
        `SELECT 
           COUNT(DISTINCT t.trip_id) AS total_completed_trips,
           COALESCE(SUM(COALESCE(p.amount, t.fare, 0)), 0) AS total_revenue,
           COALESCE(AVG(COALESCE(p.amount, t.fare, 0)), 0) AS avg_fare,
           COALESCE(SUM(CASE WHEN COALESCE(p.payment_method, 'cash') = 'cash' THEN COALESCE(p.amount, t.fare, 0) ELSE 0 END), 0) AS cash_revenue,
           COALESCE(SUM(CASE WHEN p.payment_method = 'card' THEN COALESCE(p.amount, t.fare, 0) ELSE 0 END), 0) AS card_revenue,
           COALESCE(SUM(CASE WHEN p.payment_method = 'wallet' THEN COALESCE(p.amount, t.fare, 0) ELSE 0 END), 0) AS wallet_revenue,
           COALESCE(COUNT(CASE WHEN COALESCE(p.payment_method, 'cash') = 'cash' THEN 1 END), 0) AS cash_count,
           COALESCE(COUNT(CASE WHEN p.payment_method = 'card' THEN 1 END), 0) AS card_count,
           COALESCE(COUNT(CASE WHEN p.payment_method = 'wallet' THEN 1 END), 0) AS wallet_count,
           COALESCE(SUM(t.distance_km), 0) AS total_distance_km
         FROM trips t
         LEFT JOIN payments p ON t.trip_id = p.trip_id
         ${whereSql}`,
        params
      );

      // 2. Revenue breakdown by vehicle type
      const [vehicleBreakdown] = await pool.execute(
        `SELECT 
           COALESCE(v.vehicle_type, rr.vehicle_type, 'sedan') AS vehicle_type,
           COUNT(t.trip_id) AS trip_count,
           COALESCE(SUM(COALESCE(p.amount, t.fare, 0)), 0) AS revenue,
           COALESCE(AVG(COALESCE(p.amount, t.fare, 0)), 0) AS avg_fare
         FROM trips t
         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         LEFT JOIN ride_requests rr ON t.request_id = rr.request_id
         LEFT JOIN payments p ON t.trip_id = p.trip_id
         ${whereSql}
         GROUP BY vehicle_type
         ORDER BY revenue DESC`,
        params
      );

      // 3. Daily Revenue Trend for Canvas Bar Chart
      const [dailyTrends] = await pool.execute(
        `SELECT 
           DATE_FORMAT(COALESCE(t.end_time, t.start_time), '%Y-%m-%d') AS date_label,
           COUNT(t.trip_id) AS trip_count,
           COALESCE(SUM(COALESCE(p.amount, t.fare, 0)), 0) AS daily_revenue,
           COALESCE(AVG(COALESCE(p.amount, t.fare, 0)), 0) AS avg_fare
         FROM trips t
         LEFT JOIN payments p ON t.trip_id = p.trip_id
         ${whereSql}
         GROUP BY DATE_FORMAT(COALESCE(t.end_time, t.start_time), '%Y-%m-%d')
         ORDER BY date_label ASC`,
        params
      );

      // 4. Detailed Transaction Records (for table & CSV export)
      const [transactions] = await pool.execute(
        `SELECT 
           t.trip_id,
           COALESCE(p.payment_id, 0) AS payment_id,
           COALESCE(p.amount, t.fare, 0) AS amount,
           COALESCE(p.payment_method, 'cash') AS payment_method,
           COALESCE(p.payment_status, 'completed') AS payment_status,
           COALESCE(p.paid_at, t.end_time, t.start_time) AS transaction_date,
           u_p.name AS passenger_name,
           u_p.email AS passenger_email,
           u_p.mobile AS passenger_mobile,
           u_d.name AS driver_name,
           u_d.email AS driver_email,
           COALESCE(v.vehicle_type, rr.vehicle_type, 'sedan') AS vehicle_type,
           COALESCE(v.vehicle_number, 'N/A') AS vehicle_number,
           COALESCE(t.distance_km, 0) AS distance_km,
           rr.pickup_location,
           rr.destination
         FROM trips t
         LEFT JOIN payments p ON t.trip_id = p.trip_id
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN users u_p ON pp.user_id = u_p.user_id
         JOIN driver_profiles dp ON t.driver_id = dp.driver_id
         JOIN users u_d ON dp.user_id = u_d.user_id
         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         ${whereSql}
         ORDER BY transaction_date DESC
         LIMIT 200`,
        params
      );

      const kpi = kpiRows[0] || {};
      const totalRev = parseFloat(kpi.total_revenue || 0);

      await logAction({
        userId: guard.user.user_id,
        action: 'VIEW_REVENUE_REPORT',
        description: `Admin queried revenue report (from: ${from || 'start'}, to: ${to || 'now'})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        filters: { from: from || null, to: to || null },
        summary: {
          total_revenue: totalRev,
          total_completed_trips: parseInt(kpi.total_completed_trips, 10) || 0,
          avg_fare: parseFloat(parseFloat(kpi.avg_fare || 0).toFixed(2)),
          total_distance_km: parseFloat(parseFloat(kpi.total_distance_km || 0).toFixed(2)),
          payment_methods: {
            cash: { amount: parseFloat(kpi.cash_revenue || 0), count: parseInt(kpi.cash_count, 10) || 0 },
            card: { amount: parseFloat(kpi.card_revenue || 0), count: parseInt(kpi.card_count, 10) || 0 },
            wallet: { amount: parseFloat(kpi.wallet_revenue || 0), count: parseInt(kpi.wallet_count, 10) || 0 }
          }
        },
        vehicle_breakdown: vehicleBreakdown.map(vb => ({
          vehicle_type: vb.vehicle_type,
          trip_count: parseInt(vb.trip_count, 10) || 0,
          revenue: parseFloat(vb.revenue || 0),
          avg_fare: parseFloat(parseFloat(vb.avg_fare || 0).toFixed(2)),
          percentage: totalRev > 0 ? parseFloat(((parseFloat(vb.revenue || 0) / totalRev) * 100).toFixed(1)) : 0
        })),
        daily_trends: dailyTrends.map(dt => ({
          date: dt.date_label,
          trips: parseInt(dt.trip_count, 10) || 0,
          revenue: parseFloat(dt.daily_revenue || 0),
          avg_fare: parseFloat(parseFloat(dt.avg_fare || 0).toFixed(2))
        })),
        transactions: transactions.map(tx => ({
          trip_id: tx.trip_id,
          payment_id: tx.payment_id,
          amount: parseFloat(tx.amount || 0),
          payment_method: tx.payment_method,
          payment_status: tx.payment_status,
          date: tx.transaction_date,
          passenger_name: tx.passenger_name,
          passenger_email: tx.passenger_email,
          passenger_mobile: tx.passenger_mobile,
          driver_name: tx.driver_name,
          driver_email: tx.driver_email,
          vehicle_type: tx.vehicle_type,
          vehicle_number: tx.vehicle_number,
          distance_km: parseFloat(tx.distance_km || 0),
          pickup: tx.pickup_location,
          destination: tx.destination
        }))
      });

    } catch (err) {
      console.error('[admin/reports/revenue]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to generate revenue report.' });
    }
  });

  // ── GET /api/admin/reports/trips ───────────────────────────────
  // Operational trip statistics, completion rates, fleet distribution
  router.get('/api/admin/reports/trips', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const { status, from, to, vehicle_type, page = 1, limit = 50 } = req.query || {};

      const whereClauses = [];
      const params = [];

      if (status && status !== 'all') {
        whereClauses.push('t.trip_status = ?');
        params.push(status);
      }
      if (vehicle_type && vehicle_type !== 'all') {
        whereClauses.push('(v.vehicle_type = ? OR rr.vehicle_type = ?)');
        params.push(vehicle_type, vehicle_type);
      }
      if (from) {
        whereClauses.push('DATE(COALESCE(t.start_time, rr.requested_at)) >= ?');
        params.push(from);
      }
      if (to) {
        whereClauses.push('DATE(COALESCE(t.start_time, rr.requested_at)) <= ?');
        params.push(to);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // 1. Operational KPI stats
      const [kpiRows] = await pool.execute(
        `SELECT 
           COUNT(t.trip_id) AS total_trips,
           COUNT(CASE WHEN t.trip_status = 'completed' THEN 1 END) AS completed_trips,
           COUNT(CASE WHEN t.trip_status = 'cancelled' THEN 1 END) AS cancelled_trips,
           COUNT(CASE WHEN t.trip_status IN ('accepted', 'in_progress') THEN 1 END) AS active_trips,
           COALESCE(SUM(t.distance_km), 0) AS total_distance_km,
           COALESCE(AVG(t.distance_km), 0) AS avg_distance_km,
           COALESCE(AVG(t.fare), 0) AS avg_fare,
           COALESCE(SUM(t.fare), 0) AS total_fare_volume
         FROM trips t
         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         LEFT JOIN ride_requests rr ON t.request_id = rr.request_id
         ${whereSql}`,
        params
      );

      // 2. Status Breakdown
      const [statusBreakdown] = await pool.execute(
        `SELECT 
           t.trip_status,
           COUNT(t.trip_id) AS count
         FROM trips t
         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         LEFT JOIN ride_requests rr ON t.request_id = rr.request_id
         ${whereSql}
         GROUP BY t.trip_status`,
        params
      );

      // 3. Vehicle Type Breakdown
      const [vehicleBreakdown] = await pool.execute(
        `SELECT 
           COALESCE(v.vehicle_type, rr.vehicle_type, 'sedan') AS vehicle_type,
           COUNT(t.trip_id) AS trip_count,
           COUNT(CASE WHEN t.trip_status = 'completed' THEN 1 END) AS completed_count,
           COALESCE(SUM(t.distance_km), 0) AS total_km
         FROM trips t
         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         LEFT JOIN ride_requests rr ON t.request_id = rr.request_id
         ${whereSql}
         GROUP BY vehicle_type`,
        params
      );

      // 4. Daily Volume Trends
      const [dailyVolume] = await pool.execute(
        `SELECT 
           DATE_FORMAT(COALESCE(t.start_time, rr.requested_at), '%Y-%m-%d') AS date_label,
           COUNT(t.trip_id) AS total,
           COUNT(CASE WHEN t.trip_status = 'completed' THEN 1 END) AS completed,
           COUNT(CASE WHEN t.trip_status = 'cancelled' THEN 1 END) AS cancelled
         FROM trips t
         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         LEFT JOIN ride_requests rr ON t.request_id = rr.request_id
         ${whereSql}
         GROUP BY DATE_FORMAT(COALESCE(t.start_time, rr.requested_at), '%Y-%m-%d')
         ORDER BY date_label ASC`,
        params
      );

      // 5. Paginated Trip Log
      const numLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
      const numPage  = Math.max(1, parseInt(page, 10) || 1);
      const offset   = (numPage - 1) * numLimit;

      const [tripRecords] = await pool.execute(
        `SELECT 
           t.trip_id,
           t.trip_status,
           t.distance_km,
           t.fare,
           t.start_time,
           t.end_time,
           rr.pickup_location,
           rr.destination,
           rr.requested_at,
           u_p.name AS passenger_name,
           u_d.name AS driver_name,
           COALESCE(v.vehicle_type, rr.vehicle_type, 'sedan') AS vehicle_type,
           COALESCE(v.vehicle_number, 'N/A') AS vehicle_number
         FROM trips t
         JOIN ride_requests rr ON t.request_id = rr.request_id
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN users u_p ON pp.user_id = u_p.user_id
         JOIN driver_profiles dp ON t.driver_id = dp.driver_id
         JOIN users u_d ON dp.user_id = u_d.user_id
         LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
         ${whereSql}
         ORDER BY COALESCE(t.start_time, rr.requested_at) DESC
         LIMIT ? OFFSET ?`,
        [...params, numLimit, offset]
      );

      const kpi = kpiRows[0] || {};
      const totalTrips = parseInt(kpi.total_trips, 10) || 0;
      const completedTrips = parseInt(kpi.completed_trips, 10) || 0;
      const cancelledTrips = parseInt(kpi.cancelled_trips, 10) || 0;

      await logAction({
        userId: guard.user.user_id,
        action: 'VIEW_TRIPS_REPORT',
        description: `Admin queried trips analytics report (status: ${status || 'all'}, vehicle: ${vehicle_type || 'all'})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        summary: {
          total_trips: totalTrips,
          completed_trips: completedTrips,
          cancelled_trips: cancelledTrips,
          active_trips: parseInt(kpi.active_trips, 10) || 0,
          completion_rate: totalTrips > 0 ? parseFloat(((completedTrips / totalTrips) * 100).toFixed(1)) : 0,
          cancellation_rate: totalTrips > 0 ? parseFloat(((cancelledTrips / totalTrips) * 100).toFixed(1)) : 0,
          total_distance_km: parseFloat(parseFloat(kpi.total_distance_km || 0).toFixed(2)),
          avg_distance_km: parseFloat(parseFloat(kpi.avg_distance_km || 0).toFixed(2)),
          avg_fare: parseFloat(parseFloat(kpi.avg_fare || 0).toFixed(2)),
          total_fare_volume: parseFloat(parseFloat(kpi.total_fare_volume || 0).toFixed(2))
        },
        status_breakdown: statusBreakdown.reduce((acc, row) => {
          acc[row.trip_status] = parseInt(row.count, 10) || 0;
          return acc;
        }, {}),
        vehicle_breakdown: vehicleBreakdown.map(vb => ({
          vehicle_type: vb.vehicle_type,
          trip_count: parseInt(vb.trip_count, 10) || 0,
          completed_count: parseInt(vb.completed_count, 10) || 0,
          total_km: parseFloat(parseFloat(vb.total_km || 0).toFixed(2))
        })),
        daily_trends: dailyVolume.map(dv => ({
          date: dv.date_label,
          total: parseInt(dv.total, 10) || 0,
          completed: parseInt(dv.completed, 10) || 0,
          cancelled: parseInt(dv.cancelled, 10) || 0
        })),
        pagination: {
          total: totalTrips,
          page: numPage,
          limit: numLimit,
          total_pages: Math.ceil(totalTrips / numLimit) || 1
        },
        trips: tripRecords.map(tr => ({
          trip_id: tr.trip_id,
          status: tr.trip_status,
          distance_km: parseFloat(tr.distance_km || 0),
          fare: parseFloat(tr.fare || 0),
          start_time: tr.start_time,
          end_time: tr.end_time,
          pickup: tr.pickup_location,
          destination: tr.destination,
          passenger_name: tr.passenger_name,
          driver_name: tr.driver_name,
          vehicle_type: tr.vehicle_type,
          vehicle_number: tr.vehicle_number
        }))
      });

    } catch (err) {
      console.error('[admin/reports/trips]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to generate trips report.' });
    }
  });

  // ── GET /api/admin/reports/drivers ─────────────────────────────
  // Driver fleet performance, completed trips, earnings & satisfaction ratings
  router.get('/api/admin/reports/drivers', async (req, res) => {
    const guard = requireRole(['admin', 'superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const { status = 'all', sort = 'revenue', order = 'desc', limit = 50, page = 1 } = req.query || {};

      const whereClauses = [];
      const params = [];

      if (status && status !== 'all') {
        whereClauses.push('dp.verification_status = ?');
        params.push(status);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Validate sort field
      let orderBySql = 'total_revenue DESC';
      const ord = (order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      switch (sort) {
        case 'trips':
          orderBySql = `completed_trips ${ord}, total_revenue DESC`;
          break;
        case 'rating':
          orderBySql = `effective_rating ${ord}, completed_trips DESC`;
          break;
        case 'name':
          orderBySql = `u.name ${ord}`;
          break;
        case 'revenue':
        default:
          orderBySql = `total_revenue ${ord}, completed_trips DESC`;
          break;
      }

      // 1. High-level summary across all drivers
      const [summaryRows] = await pool.execute(
        `SELECT 
           COUNT(dp.driver_id) AS total_drivers,
           COUNT(CASE WHEN dp.verification_status = 'approved' THEN 1 END) AS approved_drivers,
           COUNT(CASE WHEN dp.verification_status = 'pending' THEN 1 END) AS pending_drivers,
           COUNT(CASE WHEN dp.availability = 'online' THEN 1 END) AS online_drivers,
           COALESCE(AVG(dp.rating), 0) AS avg_fleet_rating
         FROM driver_profiles dp`
      );

      // 2. Comprehensive Driver Performance Table
      const [driverRows] = await pool.execute(
        `SELECT 
           dp.driver_id,
           dp.user_id,
           u.name,
           u.email,
           u.mobile,
           u.status AS account_status,
           dp.license_no,
           dp.license_expiry,
           dp.verification_status,
           dp.availability,
           dp.rating AS base_rating,
           v.vehicle_number,
           v.vehicle_type,
           v.model AS vehicle_model,
           COUNT(DISTINCT t.trip_id) AS total_trips,
           COUNT(DISTINCT CASE WHEN t.trip_status = 'completed' THEN t.trip_id END) AS completed_trips,
           COUNT(DISTINCT CASE WHEN t.trip_status = 'cancelled' THEN t.trip_id END) AS cancelled_trips,
           COALESCE(SUM(CASE WHEN t.trip_status = 'completed' THEN COALESCE(p.amount, t.fare, 0) ELSE 0 END), 0) AS total_revenue,
           COALESCE(AVG(CASE WHEN t.trip_status = 'completed' THEN COALESCE(p.amount, t.fare, 0) ELSE NULL END), 0) AS avg_trip_fare,
           COALESCE(AVG(rr.rating), dp.rating) AS effective_rating,
           COUNT(DISTINCT rr.review_id) AS review_count
         FROM driver_profiles dp
         JOIN users u ON dp.user_id = u.user_id
         LEFT JOIN vehicles v ON dp.driver_id = v.driver_id AND v.status = 'active'
         LEFT JOIN trips t ON dp.driver_id = t.driver_id
         LEFT JOIN payments p ON t.trip_id = p.trip_id
         LEFT JOIN ratings_reviews rr ON t.trip_id = rr.trip_id AND rr.reviewed_user_id = u.user_id
         ${whereSql}
         GROUP BY dp.driver_id, v.vehicle_id
         ORDER BY ${orderBySql}`
      );

      const summary = summaryRows[0] || {};
      const totalDrivers = driverRows.length;
      const topPerformer = driverRows.length > 0 ? {
        name: driverRows[0].name,
        trips: parseInt(driverRows[0].completed_trips, 10) || 0,
        revenue: parseFloat(driverRows[0].total_revenue || 0)
      } : null;

      await logAction({
        userId: guard.user.user_id,
        action: 'VIEW_DRIVERS_REPORT',
        description: `Admin queried drivers performance report (status: ${status}, sort: ${sort})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        summary: {
          total_drivers: parseInt(summary.total_drivers, 10) || 0,
          approved_drivers: parseInt(summary.approved_drivers, 10) || 0,
          pending_drivers: parseInt(summary.pending_drivers, 10) || 0,
          online_drivers: parseInt(summary.online_drivers, 10) || 0,
          avg_fleet_rating: parseFloat(parseFloat(summary.avg_fleet_rating || 0).toFixed(2)),
          top_performer: topPerformer
        },
        drivers: driverRows.map(d => {
          const tot = parseInt(d.total_trips, 10) || 0;
          const comp = parseInt(d.completed_trips, 10) || 0;
          return {
            driver_id: d.driver_id,
            user_id: d.user_id,
            name: d.name,
            email: d.email,
            mobile: d.mobile,
            account_status: d.account_status,
            license_no: d.license_no,
            license_expiry: d.license_expiry,
            verification_status: d.verification_status,
            availability: d.availability,
            rating: parseFloat(parseFloat(d.effective_rating || d.base_rating || 0).toFixed(2)),
            review_count: parseInt(d.review_count, 10) || 0,
            vehicle: d.vehicle_number ? {
              number: d.vehicle_number,
              type: d.vehicle_type,
              model: d.vehicle_model
            } : null,
            total_trips: tot,
            completed_trips: comp,
            cancelled_trips: parseInt(d.cancelled_trips, 10) || 0,
            completion_rate: tot > 0 ? parseFloat(((comp / tot) * 100).toFixed(1)) : 0,
            total_revenue: parseFloat(d.total_revenue || 0),
            avg_trip_fare: parseFloat(parseFloat(d.avg_trip_fare || 0).toFixed(2))
          };
        })
      });

    } catch (err) {
      console.error('[admin/reports/drivers]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to generate drivers report.' });
    }
  });

};

