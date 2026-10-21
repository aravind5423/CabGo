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

};
