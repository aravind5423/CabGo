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

};
