// server/routes/superadmin.js
// Super Admin REST API module for system audit logs, admin user management, and RBAC permissions

'use strict';

const crypto = require('crypto');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAction, getClientIp } = require('../middleware/logger');

// ── Password hash helper (consistent with auth.js) ──────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

const AVAILABLE_PERMISSIONS = [
  'manage_users',
  'manage_drivers',
  'manage_vehicles',
  'manage_trips',
  'manage_fares',
  'view_reports',
  'manage_system'
];

module.exports = function superadminRoute(router) {

  // ==============================================================
  // 0. SUPERADMIN DASHBOARD OVERVIEW & GLOBAL TELEMETRY
  // ==============================================================

  // ── GET /api/superadmin/overview ───────────────────────────────
  // Consolidated system-wide telemetry, user distribution, fleet metrics, admin overview, and recent audit logs
  async function handleSuperadminOverview(req, res) {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      // 1. User population counts
      const [uCounts] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_users,
           SUM(CASE WHEN role = 'passenger' THEN 1 ELSE 0 END) AS passengers_count,
           SUM(CASE WHEN role = 'driver' THEN 1 ELSE 0 END) AS drivers_count,
           SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins_count,
           SUM(CASE WHEN role = 'superadmin' THEN 1 ELSE 0 END) AS superadmins_count,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_users,
           SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked_users,
           SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_users,
           SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS new_users_7d
         FROM users`
      );

      // 2. Driver compliance & live status
      const [dCounts] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_drivers,
           SUM(CASE WHEN dp.verification_status = 'pending' THEN 1 ELSE 0 END) AS pending_drivers,
           SUM(CASE WHEN dp.verification_status = 'approved' THEN 1 ELSE 0 END) AS approved_drivers,
           SUM(CASE WHEN dp.verification_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_drivers,
           SUM(CASE WHEN dp.availability = 'online' THEN 1 ELSE 0 END) AS online_drivers
         FROM driver_profiles dp`
      );

      // 3. Vehicles fleet metrics
      const [vCounts] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_vehicles,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_vehicles,
           SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_vehicles,
           SUM(CASE WHEN vehicle_type = 'sedan' THEN 1 ELSE 0 END) AS sedan_count,
           SUM(CASE WHEN vehicle_type = 'suv' THEN 1 ELSE 0 END) AS suv_count,
           SUM(CASE WHEN vehicle_type = 'hatchback' THEN 1 ELSE 0 END) AS hatchback_count,
           SUM(CASE WHEN vehicle_type = 'auto' THEN 1 ELSE 0 END) AS auto_count,
           SUM(CASE WHEN vehicle_type = 'bike' THEN 1 ELSE 0 END) AS bike_count
         FROM vehicles`
      );

      // 4. Trips performance & Gross Merchandise Value
      const [tCounts] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_trips,
           SUM(CASE WHEN trip_status = 'completed' THEN 1 ELSE 0 END) AS completed_trips,
           SUM(CASE WHEN trip_status = 'in_progress' THEN 1 ELSE 0 END) AS active_trips,
           SUM(CASE WHEN trip_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_trips,
           COALESCE(SUM(CASE WHEN trip_status = 'completed' THEN fare ELSE 0 END), 0) AS total_revenue
         FROM trips`
      );

      // 5. System logs & audit activity
      const [logCounts] = await pool.execute(
        `SELECT 
           COUNT(*) AS total_logs,
           SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS logs_today,
           COUNT(DISTINCT ip_address) AS distinct_ips
         FROM system_logs`
      );

      // 6. Top action breakdown for canvas visualization
      const [topActions] = await pool.execute(
        `SELECT action, COUNT(*) AS count
         FROM system_logs
         GROUP BY action
         ORDER BY count DESC
         LIMIT 6`
      );

      // 7. Administrators overview list with permissions count
      const [admins] = await pool.execute(
        `SELECT 
           u.user_id,
           u.name,
           u.email,
           u.mobile,
           u.role,
           u.status,
           u.created_at,
           COUNT(ap.permission_id) AS permissions_count,
           GROUP_CONCAT(ap.permission_name ORDER BY ap.permission_name ASC SEPARATOR ',') AS permissions_str
         FROM users u
         LEFT JOIN admin_permissions ap ON u.user_id = ap.admin_id
         WHERE u.role IN ('admin', 'superadmin')
         GROUP BY u.user_id
         ORDER BY u.role DESC, u.created_at ASC`
      );

      // 8. Recent 8 system audit logs
      const [recentLogs] = await pool.execute(
        `SELECT 
           sl.log_id,
           sl.user_id,
           sl.action,
           sl.description,
           sl.ip_address,
           sl.created_at,
           COALESCE(u.name, 'System') AS user_name,
           COALESCE(u.email, 'system@cab.com') AS user_email,
           COALESCE(u.role, 'system') AS user_role
         FROM system_logs sl
         LEFT JOIN users u ON sl.user_id = u.user_id
         ORDER BY sl.created_at DESC, sl.log_id DESC
         LIMIT 8`
      );

      const uRow = uCounts[0] || {};
      const dRow = dCounts[0] || {};
      const vRow = vCounts[0] || {};
      const tRow = tCounts[0] || {};
      const lRow = logCounts[0] || {};

      const totalAdmins = parseInt(uRow.admins_count, 10) || 0;
      const totalSuperadmins = parseInt(uRow.superadmins_count, 10) || 0;
      const activeAdminsCount = admins.filter(a => a.status === 'active').length;
      const inactiveAdminsCount = admins.length - activeAdminsCount;

      req.sendJSON(200, {
        success: true,
        stats: {
          users: {
            total: parseInt(uRow.total_users, 10) || 0,
            passengers: parseInt(uRow.passengers_count, 10) || 0,
            drivers: parseInt(uRow.drivers_count, 10) || 0,
            admins: totalAdmins,
            superadmins: totalSuperadmins,
            active: parseInt(uRow.active_users, 10) || 0,
            blocked: parseInt(uRow.blocked_users, 10) || 0,
            inactive: parseInt(uRow.inactive_users, 10) || 0,
            new_7d: parseInt(uRow.new_users_7d, 10) || 0
          },
          drivers: {
            total: parseInt(dRow.total_drivers, 10) || 0,
            approved: parseInt(dRow.approved_drivers, 10) || 0,
            pending: parseInt(dRow.pending_drivers, 10) || 0,
            rejected: parseInt(dRow.rejected_drivers, 10) || 0,
            online: parseInt(dRow.online_drivers, 10) || 0
          },
          fleet: {
            total: parseInt(vRow.total_vehicles, 10) || 0,
            active: parseInt(vRow.active_vehicles, 10) || 0,
            inactive: parseInt(vRow.inactive_vehicles, 10) || 0,
            sedan: parseInt(vRow.sedan_count, 10) || 0,
            suv: parseInt(vRow.suv_count, 10) || 0,
            hatchback: parseInt(vRow.hatchback_count, 10) || 0,
            auto: parseInt(vRow.auto_count, 10) || 0,
            bike: parseInt(vRow.bike_count, 10) || 0
          },
          trips: {
            total: parseInt(tRow.total_trips, 10) || 0,
            completed: parseInt(tRow.completed_trips, 10) || 0,
            active: parseInt(tRow.active_trips, 10) || 0,
            cancelled: parseInt(tRow.cancelled_trips, 10) || 0,
            revenue: parseFloat(tRow.total_revenue) || 0
          },
          admins: {
            total: admins.length,
            superadmins: totalSuperadmins,
            active: activeAdminsCount,
            inactive: inactiveAdminsCount
          },
          audit: {
            total_logs: parseInt(lRow.total_logs, 10) || 0,
            logs_today: parseInt(lRow.logs_today, 10) || 0,
            distinct_ips: parseInt(lRow.distinct_ips, 10) || 0
          }
        },
        chart_data: {
          role_dist: [
            { label: 'Passengers', count: parseInt(uRow.passengers_count, 10) || 0, color: '#3B82F6' },
            { label: 'Drivers', count: parseInt(uRow.drivers_count, 10) || 0, color: '#10B981' },
            { label: 'Admins', count: totalAdmins, color: '#6366F1' },
            { label: 'Superadmins', count: totalSuperadmins, color: '#F59E0B' }
          ],
          trip_dist: [
            { label: 'Completed', count: parseInt(tRow.completed_trips, 10) || 0, color: '#10B981' },
            { label: 'In Progress', count: parseInt(tRow.active_trips, 10) || 0, color: '#3B82F6' },
            { label: 'Cancelled', count: parseInt(tRow.cancelled_trips, 10) || 0, color: '#EF4444' }
          ],
          top_actions: topActions.map(a => ({
            action: a.action,
            count: parseInt(a.count, 10) || 0
          }))
        },
        admins: admins.map(a => ({
          user_id: a.user_id,
          name: a.name,
          email: a.email,
          mobile: a.mobile,
          role: a.role,
          status: a.status,
          created_at: a.created_at,
          permissions_count: parseInt(a.permissions_count, 10) || 0,
          permissions: a.permissions_str ? a.permissions_str.split(',') : []
        })),
        recent_logs: recentLogs.map(l => ({
          log_id: l.log_id,
          user_id: l.user_id,
          user_name: l.user_name,
          user_email: l.user_email,
          user_role: l.user_role,
          action: l.action,
          description: l.description,
          ip_address: l.ip_address,
          created_at: l.created_at
        }))
      });

    } catch (err) {
      console.error('[superadmin/overview]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve superadmin telemetry.' });
    }
  }

  router.get('/api/superadmin/overview', handleSuperadminOverview);
  router.get('/api/superadmin/stats', handleSuperadminOverview);

  // ==============================================================
  // 1. SYSTEM LOGS & AUDIT TRAIL
  // ==============================================================

  // ── GET /api/superadmin/logs ───────────────────────────────────
  // Paginated and filterable system operational & security audit logs
  router.get('/api/superadmin/logs', async (req, res) => {
    const guard = requireRole(['superadmin', 'admin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const { user, action, from, to, page = 1, limit = 50 } = req.query || {};

      const whereClauses = [];
      const params = [];

      if (user) {
        whereClauses.push('(u.name LIKE ? OR u.email LIKE ? OR sl.user_id = ?)');
        params.push(`%${user}%`, `%${user}%`, parseInt(user, 10) || 0);
      }

      if (action) {
        whereClauses.push('(sl.action LIKE ? OR sl.description LIKE ?)');
        params.push(`%${action}%`, `%${action}%`);
      }

      if (from) {
        whereClauses.push('DATE(sl.created_at) >= ?');
        params.push(from);
      }

      if (to) {
        whereClauses.push('DATE(sl.created_at) <= ?');
        params.push(to);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Count total matching logs
      const [countRows] = await pool.execute(
        `SELECT COUNT(sl.log_id) AS total_count
         FROM system_logs sl
         LEFT JOIN users u ON sl.user_id = u.user_id
         ${whereSql}`,
        params
      );

      const totalLogs = parseInt(countRows[0]?.total_count, 10) || 0;
      const numLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
      const numPage  = Math.max(1, parseInt(page, 10) || 1);
      const offset   = (numPage - 1) * numLimit;

      // Fetch paginated logs
      const [logs] = await pool.execute(
        `SELECT 
           sl.log_id,
           sl.user_id,
           sl.action,
           sl.description,
           sl.ip_address,
           sl.created_at,
           COALESCE(u.name, 'System') AS user_name,
           COALESCE(u.email, 'system@cab.com') AS user_email,
           COALESCE(u.role, 'system') AS user_role
         FROM system_logs sl
         LEFT JOIN users u ON sl.user_id = u.user_id
         ${whereSql}
         ORDER BY sl.created_at DESC, sl.log_id DESC
         LIMIT ? OFFSET ?`,
        [...params, numLimit, offset]
      );

      // Aggregate top actions breakdown
      const [actionSummary] = await pool.execute(
        `SELECT sl.action, COUNT(sl.log_id) AS action_count
         FROM system_logs sl
         ${whereSql}
         GROUP BY sl.action
         ORDER BY action_count DESC
         LIMIT 6`,
        params
      );

      req.sendJSON(200, {
        success: true,
        summary: {
          total_logs: totalLogs,
          displayed_logs: logs.length,
          top_actions: actionSummary.map(a => ({
            action: a.action,
            count: parseInt(a.action_count, 10) || 0
          }))
        },
        pagination: {
          total: totalLogs,
          page: numPage,
          limit: numLimit,
          total_pages: Math.ceil(totalLogs / numLimit) || 1
        },
        logs: logs.map(l => ({
          log_id: l.log_id,
          user_id: l.user_id,
          user_name: l.user_name,
          user_email: l.user_email,
          user_role: l.user_role,
          action: l.action,
          description: l.description,
          ip_address: l.ip_address,
          created_at: l.created_at
        }))
      });

    } catch (err) {
      console.error('[superadmin/logs]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve system logs.' });
    }
  });

  // ==============================================================
  // 2. ADMIN USER MANAGEMENT CRUD
  // ==============================================================

  // ── GET /api/superadmin/admins ─────────────────────────────────
  // List all admin users with assigned permission sets
  router.get('/api/superadmin/admins', async (req, res) => {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const [admins] = await pool.execute(
        `SELECT 
           u.user_id,
           u.name,
           u.email,
           u.mobile,
           u.role,
           u.status,
           u.created_at,
           GROUP_CONCAT(ap.permission_name ORDER BY ap.permission_name ASC SEPARATOR ',') AS permissions_str
         FROM users u
         LEFT JOIN admin_permissions ap ON u.user_id = ap.admin_id
         WHERE u.role IN ('admin', 'superadmin')
         GROUP BY u.user_id
         ORDER BY u.role DESC, u.created_at ASC`
      );

      req.sendJSON(200, {
        success: true,
        total: admins.length,
        available_permissions: AVAILABLE_PERMISSIONS,
        admins: admins.map(a => ({
          user_id: a.user_id,
          name: a.name,
          email: a.email,
          mobile: a.mobile,
          role: a.role,
          status: a.status,
          created_at: a.created_at,
          permissions: a.permissions_str ? a.permissions_str.split(',') : []
        }))
      });

    } catch (err) {
      console.error('[superadmin/admins/list]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve admin accounts.' });
    }
  });

  // ── POST /api/superadmin/admins ────────────────────────────────
  // Provision a new operations admin account with designated permissions
  router.post('/api/superadmin/admins', async (req, res) => {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const { name, email, password, mobile, permissions = [] } = req.body || {};

    if (!name || !email || !password || !mobile) {
      return req.sendJSON(400, {
        success: false,
        message: 'Name, email, password, and mobile number are required.'
      });
    }

    if (!EMAIL_RE.test(email)) {
      return req.sendJSON(400, { success: false, message: 'Invalid email address.' });
    }

    if (!MOBILE_RE.test(mobile)) {
      return req.sendJSON(400, { success: false, message: 'Mobile must be a valid 10-digit number.' });
    }

    if (password.length < 6) {
      return req.sendJSON(400, { success: false, message: 'Password must be at least 6 characters.' });
    }

    try {
      // Check existing email
      const [existing] = await pool.execute('SELECT user_id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
      if (existing.length > 0) {
        return req.sendJSON(409, { success: false, message: 'An account with this email already exists.' });
      }

      const hashedPassword = hashPassword(password);

      // Insert new admin user
      const [result] = await pool.execute(
        `INSERT INTO users (name, email, password, mobile, role, status, created_at)
         VALUES (?, ?, ?, ?, 'admin', 'active', NOW())`,
        [name.trim(), email.toLowerCase().trim(), hashedPassword, mobile.trim()]
      );

      const newAdminId = result.insertId;

      // Assign initial permissions if provided
      if (Array.isArray(permissions) && permissions.length > 0) {
        const validPerms = permissions.filter(p => AVAILABLE_PERMISSIONS.includes(p));
        for (const perm of validPerms) {
          await pool.execute(
            `INSERT IGNORE INTO admin_permissions (admin_id, permission_name) VALUES (?, ?)`,
            [newAdminId, perm]
          );
        }
      }

      await logAction({
        userId: guard.user.user_id,
        action: 'CREATE_ADMIN',
        description: `Superadmin created admin user: ${email} (ID: ${newAdminId})`,
        ip: getClientIp(req)
      });

      req.sendJSON(201, {
        success: true,
        message: 'Admin account created successfully.',
        admin: {
          user_id: newAdminId,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          mobile: mobile.trim(),
          role: 'admin',
          status: 'active',
          permissions: Array.isArray(permissions) ? permissions.filter(p => AVAILABLE_PERMISSIONS.includes(p)) : []
        }
      });

    } catch (err) {
      console.error('[superadmin/admins/create]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to create admin account.' });
    }
  });

  // ── PUT /api/superadmin/admins/:id ─────────────────────────────
  // Update admin profile details and permissions
  router.put('/api/superadmin/admins/:id', async (req, res) => {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const adminId = parseInt(req.params.id, 10);
    if (!adminId) return req.sendJSON(400, { success: false, message: 'Valid admin ID required.' });

    const { name, email, mobile, status, permissions } = req.body || {};

    try {
      const [existing] = await pool.execute(
        'SELECT user_id, role, email FROM users WHERE user_id = ? AND role IN (\'admin\', \'superadmin\')',
        [adminId]
      );

      if (existing.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Admin user not found.' });
      }

      const updates = [];
      const params = [];

      if (name) { updates.push('name = ?'); params.push(name.trim()); }
      if (email) {
        if (!EMAIL_RE.test(email)) return req.sendJSON(400, { success: false, message: 'Invalid email address.' });
        // Check uniqueness if email changed
        if (email.toLowerCase().trim() !== existing[0].email) {
          const [checkEmail] = await pool.execute('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email.toLowerCase().trim(), adminId]);
          if (checkEmail.length > 0) return req.sendJSON(409, { success: false, message: 'Email is already in use.' });
        }
        updates.push('email = ?');
        params.push(email.toLowerCase().trim());
      }
      if (mobile) {
        if (!MOBILE_RE.test(mobile)) return req.sendJSON(400, { success: false, message: 'Mobile must be 10 digits.' });
        updates.push('mobile = ?');
        params.push(mobile.trim());
      }
      if (status && ['active', 'inactive', 'blocked'].includes(status)) {
        if (adminId === guard.user.user_id && status !== 'active') {
          return req.sendJSON(400, { success: false, message: 'Cannot deactivate or block your own superadmin account.' });
        }
        updates.push('status = ?');
        params.push(status);
      }

      if (updates.length > 0) {
        params.push(adminId);
        await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);
      }

      // Update permissions if an array is explicitly supplied
      if (Array.isArray(permissions)) {
        await pool.execute('DELETE FROM admin_permissions WHERE admin_id = ?', [adminId]);
        const validPerms = permissions.filter(p => AVAILABLE_PERMISSIONS.includes(p));
        for (const perm of validPerms) {
          await pool.execute(
            'INSERT IGNORE INTO admin_permissions (admin_id, permission_name) VALUES (?, ?)',
            [adminId, perm]
          );
        }
      }

      await logAction({
        userId: guard.user.user_id,
        action: 'UPDATE_ADMIN',
        description: `Superadmin updated admin ID ${adminId} details`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, { success: true, message: 'Admin account updated successfully.' });

    } catch (err) {
      console.error('[superadmin/admins/update]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to update admin account.' });
    }
  });

  // ── DELETE /api/superadmin/admins/:id ──────────────────────────
  // Remove an admin user account
  router.delete('/api/superadmin/admins/:id', async (req, res) => {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const adminId = parseInt(req.params.id, 10);
    if (!adminId) return req.sendJSON(400, { success: false, message: 'Valid admin ID required.' });

    if (adminId === guard.user.user_id) {
      return req.sendJSON(400, { success: false, message: 'You cannot delete your own account.' });
    }

    try {
      const [existing] = await pool.execute('SELECT user_id, email, role FROM users WHERE user_id = ?', [adminId]);
      if (existing.length === 0 || !['admin', 'superadmin'].includes(existing[0].role)) {
        return req.sendJSON(404, { success: false, message: 'Admin user not found.' });
      }

      // Delete user (admin_permissions cascades on delete)
      await pool.execute('DELETE FROM users WHERE user_id = ?', [adminId]);

      await logAction({
        userId: guard.user.user_id,
        action: 'DELETE_ADMIN',
        description: `Superadmin deleted admin account: ${existing[0].email} (ID: ${adminId})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, { success: true, message: 'Admin account deleted successfully.' });

    } catch (err) {
      console.error('[superadmin/admins/delete]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to delete admin account.' });
    }
  });

  // ── PUT /api/superadmin/admins/:id/activate ─────────────────────
  // Activate an admin account
  router.put('/api/superadmin/admins/:id/activate', async (req, res) => {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const adminId = parseInt(req.params.id, 10);
    if (!adminId) return req.sendJSON(400, { success: false, message: 'Valid admin ID required.' });

    try {
      const [resUpdate] = await pool.execute(
        "UPDATE users SET status = 'active' WHERE user_id = ? AND role IN ('admin', 'superadmin')",
        [adminId]
      );

      if (resUpdate.affectedRows === 0) {
        return req.sendJSON(404, { success: false, message: 'Admin account not found.' });
      }

      await logAction({
        userId: guard.user.user_id,
        action: 'ACTIVATE_ADMIN',
        description: `Activated admin account ID: ${adminId}`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, { success: true, message: 'Admin account activated.' });

    } catch (err) {
      console.error('[superadmin/admins/activate]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to activate admin.' });
    }
  });

  // ── PUT /api/superadmin/admins/:id/deactivate ───────────────────
  // Deactivate an admin account
  router.put('/api/superadmin/admins/:id/deactivate', async (req, res) => {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const adminId = parseInt(req.params.id, 10);
    if (!adminId) return req.sendJSON(400, { success: false, message: 'Valid admin ID required.' });

    if (adminId === guard.user.user_id) {
      return req.sendJSON(400, { success: false, message: 'Cannot deactivate your own superadmin account.' });
    }

    try {
      const [resUpdate] = await pool.execute(
        "UPDATE users SET status = 'inactive' WHERE user_id = ? AND role IN ('admin', 'superadmin')",
        [adminId]
      );

      if (resUpdate.affectedRows === 0) {
        return req.sendJSON(404, { success: false, message: 'Admin account not found.' });
      }

      await logAction({
        userId: guard.user.user_id,
        action: 'DEACTIVATE_ADMIN',
        description: `Deactivated admin account ID: ${adminId}`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, { success: true, message: 'Admin account deactivated.' });

    } catch (err) {
      console.error('[superadmin/admins/deactivate]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to deactivate admin.' });
    }
  });

  // ==============================================================
  // 3. ADMIN PERMISSIONS MANAGEMENT
  // ==============================================================

  // ── GET /api/superadmin/permissions/:id ────────────────────────
  // Retrieve permissions list for a specific admin
  router.get('/api/superadmin/permissions/:id', async (req, res) => {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const adminId = parseInt(req.params.id, 10);
    if (!adminId) return req.sendJSON(400, { success: false, message: 'Valid admin ID required.' });

    try {
      const [admin] = await pool.execute('SELECT user_id, name, email, role FROM users WHERE user_id = ?', [adminId]);
      if (admin.length === 0) return req.sendJSON(404, { success: false, message: 'Admin not found.' });

      const [perms] = await pool.execute(
        'SELECT permission_id, permission_name FROM admin_permissions WHERE admin_id = ? ORDER BY permission_name ASC',
        [adminId]
      );

      req.sendJSON(200, {
        success: true,
        admin: admin[0],
        available_permissions: AVAILABLE_PERMISSIONS,
        assigned_permissions: perms.map(p => p.permission_name),
        details: perms
      });

    } catch (err) {
      console.error('[superadmin/permissions/get]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to fetch admin permissions.' });
    }
  });

  // ── POST /api/superadmin/permissions/:id ───────────────────────
  // Grant a specific permission to an admin
  router.post('/api/superadmin/permissions/:id', async (req, res) => {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const adminId = parseInt(req.params.id, 10);
    const { permission_name } = req.body || {};

    if (!adminId || !permission_name) {
      return req.sendJSON(400, { success: false, message: 'Admin ID and permission_name are required.' });
    }

    if (!AVAILABLE_PERMISSIONS.includes(permission_name)) {
      return req.sendJSON(400, {
        success: false,
        message: `Invalid permission. Allowed: ${AVAILABLE_PERMISSIONS.join(', ')}`
      });
    }

    try {
      await pool.execute(
        'INSERT IGNORE INTO admin_permissions (admin_id, permission_name) VALUES (?, ?)',
        [adminId, permission_name]
      );

      await logAction({
        userId: guard.user.user_id,
        action: 'GRANT_PERMISSION',
        description: `Granted '${permission_name}' to admin ID: ${adminId}`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, { success: true, message: `Permission '${permission_name}' granted.` });

    } catch (err) {
      console.error('[superadmin/permissions/grant]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to grant permission.' });
    }
  });

  // ── DELETE /api/superadmin/permissions/:id ─────────────────────
  // Revoke a permission from an admin
  router.delete('/api/superadmin/permissions/:id', async (req, res) => {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const adminId = parseInt(req.params.id, 10);
    const permissionName = req.query.permission_name || req.body?.permission_name;

    if (!adminId || !permissionName) {
      return req.sendJSON(400, { success: false, message: 'Admin ID and permission_name are required.' });
    }

    try {
      await pool.execute(
        'DELETE FROM admin_permissions WHERE admin_id = ? AND permission_name = ?',
        [adminId, permissionName]
      );

      await logAction({
        userId: guard.user.user_id,
        action: 'REVOKE_PERMISSION',
        description: `Revoked '${permissionName}' from admin ID: ${adminId}`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, { success: true, message: `Permission '${permissionName}' revoked.` });

    } catch (err) {
      console.error('[superadmin/permissions/revoke]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to revoke permission.' });
    }
  });

  // ==============================================================
  // 4. PLATFORM SYSTEM SETTINGS
  // ==============================================================

  const DEFAULT_SETTINGS = {
    platform_name: 'CabGo Transit Network',
    currency: 'INR',
    currency_symbol: '₹',
    support_email: 'support@cabgo.com',
    support_phone: '+91 98765 43210',
    operating_city: 'Bengaluru, Karnataka',
    max_cancellations: 3,
    maintenance_mode: false,
    driver_commission_pct: 15,
    tax_pct: 5,
    surge_multiplier_max: 2.5,
    booking_timeout_sec: 60,
    session_timeout_hours: 24
  };

  let inMemorySettings = { ...DEFAULT_SETTINGS };

  // Helper to load settings from DB or fallback
  async function getStoredSettings() {
    try {
      const [rows] = await pool.execute('SELECT setting_key, setting_value FROM system_settings');
      if (rows && rows.length > 0) {
        const dbSettings = {};
        for (const r of rows) {
          try {
            dbSettings[r.setting_key] = JSON.parse(r.setting_value);
          } catch {
            dbSettings[r.setting_key] = r.setting_value;
          }
        }
        return { ...DEFAULT_SETTINGS, ...inMemorySettings, ...dbSettings };
      }
    } catch (err) {
      // Table may not exist yet or connection issue, use in-memory
    }
    return { ...DEFAULT_SETTINGS, ...inMemorySettings };
  }

  // ── GET /api/superadmin/settings ───────────────────────────────
  // Retrieve global system settings
  router.get('/api/superadmin/settings', async (req, res) => {
    const guard = requireRole(['superadmin', 'admin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const settings = await getStoredSettings();
      req.sendJSON(200, {
        success: true,
        settings
      });
    } catch (err) {
      console.error('[superadmin/settings/get]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to retrieve system settings.' });
    }
  });

  // ── PUT /api/superadmin/settings ───────────────────────────────
  // Update global system settings
  router.put('/api/superadmin/settings', async (req, res) => {
    const guard = requireRole(['superadmin'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const payload = req.body || {};

    try {
      const current = await getStoredSettings();
      const updated = { ...current };

      if (payload.platform_name && typeof payload.platform_name === 'string') {
        updated.platform_name = payload.platform_name.trim();
      }
      if (payload.currency && typeof payload.currency === 'string') {
        updated.currency = payload.currency.trim().toUpperCase();
      }
      if (payload.currency_symbol && typeof payload.currency_symbol === 'string') {
        updated.currency_symbol = payload.currency_symbol.trim();
      }
      if (payload.support_email && typeof payload.support_email === 'string') {
        if (!EMAIL_RE.test(payload.support_email)) {
          return req.sendJSON(400, { success: false, message: 'Invalid support email address.' });
        }
        updated.support_email = payload.support_email.trim();
      }
      if (payload.support_phone && typeof payload.support_phone === 'string') {
        updated.support_phone = payload.support_phone.trim();
      }
      if (payload.operating_city && typeof payload.operating_city === 'string') {
        updated.operating_city = payload.operating_city.trim();
      }
      if (payload.max_cancellations !== undefined) {
        const val = parseInt(payload.max_cancellations, 10);
        if (isNaN(val) || val < 1 || val > 20) {
          return req.sendJSON(400, { success: false, message: 'Max cancellations must be between 1 and 20.' });
        }
        updated.max_cancellations = val;
      }
      if (payload.maintenance_mode !== undefined) {
        updated.maintenance_mode = Boolean(payload.maintenance_mode);
      }
      if (payload.driver_commission_pct !== undefined) {
        const val = parseFloat(payload.driver_commission_pct);
        if (isNaN(val) || val < 0 || val > 60) {
          return req.sendJSON(400, { success: false, message: 'Commission must be between 0% and 60%.' });
        }
        updated.driver_commission_pct = val;
      }
      if (payload.tax_pct !== undefined) {
        const val = parseFloat(payload.tax_pct);
        if (isNaN(val) || val < 0 || val > 30) {
          return req.sendJSON(400, { success: false, message: 'Tax percentage must be between 0% and 30%.' });
        }
        updated.tax_pct = val;
      }
      if (payload.booking_timeout_sec !== undefined) {
        const val = parseInt(payload.booking_timeout_sec, 10);
        if (isNaN(val) || val < 15 || val > 300) {
          return req.sendJSON(400, { success: false, message: 'Booking timeout must be between 15 and 300 seconds.' });
        }
        updated.booking_timeout_sec = val;
      }
      if (payload.session_timeout_hours !== undefined) {
        const val = parseInt(payload.session_timeout_hours, 10);
        if (isNaN(val) || val < 1 || val > 168) {
          return req.sendJSON(400, { success: false, message: 'Session timeout must be between 1 and 168 hours.' });
        }
        updated.session_timeout_hours = val;
      }

      // Update in-memory
      inMemorySettings = { ...updated };

      // Persist to DB table if table exists
      try {
        for (const [key, val] of Object.entries(updated)) {
          await pool.execute(
            `INSERT INTO system_settings (setting_key, setting_value)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [key, JSON.stringify(val)]
          );
        }
      } catch (dbErr) {
        // In-memory fallback
      }

      await logAction({
        userId: guard.user.user_id,
        action: 'UPDATE_SETTINGS',
        description: `Superadmin updated platform system settings (maintenance_mode: ${updated.maintenance_mode})`,
        ip: getClientIp(req)
      });

      req.sendJSON(200, {
        success: true,
        message: 'Platform settings saved successfully.',
        settings: updated
      });

    } catch (err) {
      console.error('[superadmin/settings/put]', err.message);
      req.sendJSON(500, { success: false, message: 'Failed to update system settings.' });
    }
  });

};
