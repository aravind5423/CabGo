// server/routes/auth.js
// Authentication: register, login, logout, current user, health check

'use strict';

const crypto = require('crypto');
const pool   = require('../db');
const { createToken, requireRole } = require('../middleware/auth');
const { logAction, getClientIp }   = require('../middleware/logger');

// ── Password helpers (Node built-in crypto only) ─────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const incoming = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(incoming, 'hex'));
  } catch { return false; }
}

// ── Input validators ─────────────────────────────────────────
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const TOKEN_TTL_SECONDS = 24 * 60 * 60;

// ── Seeded demo accounts ─────────────────────────────────────
// Only these accounts accept the shared demo shortcut password used by the
// login page's one-click buttons. Every other account must use its real password.
const DEMO_ACCOUNTS = {
  'superadmin@cab.com': 'SuperAdmin@123',
  'admin@cab.com':      'Admin@123',
  'admin2@cab.com':     'Admin@123',
  'driver1@cab.com':    'Driver@123',
  'driver2@cab.com':    'Driver@123',
  'driver3@cab.com':    'Driver@123',
  'driver4@cab.com':    'Driver@123',
  'driver5@cab.com':    'Driver@123',
  'passenger1@cab.com': 'Pass@123',
  'passenger2@cab.com': 'Pass@123',
  'passenger3@cab.com': 'Pass@123',
  'passenger4@cab.com': 'Pass@123',
  'passenger5@cab.com': 'Pass@123',
};
const DEMO_SHORTCUT_PASSWORD = 'password123';

// Short handles accepted on the login screen (e.g. "driver1" → driver1@cab.com)
const HANDLE_ALIASES = {
  superadmin: 'superadmin@cab.com',
  admin:      'admin@cab.com',
  admin1:     'admin@cab.com',
  admin2:     'admin2@cab.com',
  driver:     'driver1@cab.com',
  passenger:  'passenger1@cab.com',
};

function resolveLoginEmail(input) {
  const handle = String(input || '').toLowerCase().trim();
  if (HANDLE_ALIASES[handle]) return HANDLE_ALIASES[handle];
  if (handle.includes('@')) return handle;
  return `${handle}@cab.com`;
}

function issueToken(user) {
  return createToken({
    user_id: user.user_id,
    name:    user.name,
    email:   user.email,
    role:    user.role,
    exp:     Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });
}

function publicUser(user) {
  return { user_id: user.user_id, name: user.name, email: user.email, mobile: user.mobile, role: user.role };
}

module.exports = function authRoute(router) {

  // ── GET /api/health ──────────────────────────────────────
  router.get('/api/health', async (req) => {
    req.sendJSON(200, { success: true, message: 'Rydio API is running', timestamp: new Date().toISOString() });
  });

  // ── POST /api/auth/register ──────────────────────────────
  router.post('/api/auth/register', async (req) => {
    const {
      name, email, password, mobile, role,
      license_no, license_expiry,
      default_address, emergency_contact,
    } = req.body || {};

    if (!name || !email || !password || !mobile || !role) {
      return req.sendJSON(400, { success: false, message: 'Name, email, password, mobile and role are required.' });
    }
    if (!['passenger', 'driver'].includes(role)) {
      return req.sendJSON(400, { success: false, message: 'Role must be passenger or driver.' });
    }
    if (!EMAIL_RE.test(email)) {
      return req.sendJSON(400, { success: false, message: 'Invalid email address.' });
    }
    if (!MOBILE_RE.test(mobile)) {
      return req.sendJSON(400, { success: false, message: 'Invalid mobile number (10 digits, starting with 6-9).' });
    }
    if (password.length < 6) {
      return req.sendJSON(400, { success: false, message: 'Password must be at least 6 characters.' });
    }
    if (role === 'driver' && (!license_no || !license_expiry)) {
      return req.sendJSON(400, { success: false, message: 'License number and expiry date are required for drivers.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [existing] = await conn.execute('SELECT user_id FROM users WHERE email = ?', [cleanEmail]);
      if (existing.length > 0) {
        await conn.rollback();
        return req.sendJSON(409, { success: false, message: 'Email is already registered.' });
      }

      const [userResult] = await conn.execute(
        `INSERT INTO users (name, email, password, mobile, role, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'active', NOW())`,
        [name.trim(), cleanEmail, hashPassword(password), mobile.trim(), role]
      );
      const userId = userResult.insertId;

      if (role === 'passenger') {
        await conn.execute(
          `INSERT INTO passenger_profiles (user_id, default_address, emergency_contact) VALUES (?, ?, ?)`,
          [userId, default_address || null, emergency_contact || null]
        );
      } else {
        await conn.execute(
          `INSERT INTO driver_profiles (user_id, license_no, license_expiry, verification_status, availability, rating)
           VALUES (?, ?, ?, 'pending', 'offline', 0.00)`,
          [userId, license_no.trim(), license_expiry]
        );
      }

      await conn.commit();

      await logAction({ userId, action: 'REGISTER', description: `New ${role} registered: ${cleanEmail}`, ip: getClientIp(req) });

      const user = { user_id: userId, name: name.trim(), email: cleanEmail, mobile: mobile.trim(), role };
      req.sendJSON(201, {
        success: true,
        message: role === 'driver'
          ? 'Registration successful. Your driver account is pending admin verification.'
          : 'Registration successful. Welcome to Rydio!',
        token: issueToken(user),
        user:  publicUser(user),
      });
    } catch (err) {
      await conn.rollback();
      console.error('[auth/register]', err.message);
      req.sendJSON(500, { success: false, message: 'Registration failed. Please try again.' });
    } finally {
      conn.release();
    }
  });

  // ── POST /api/auth/login ─────────────────────────────────
  router.post('/api/auth/login', async (req) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return req.sendJSON(400, { success: false, message: 'Email and password are required.' });
    }

    const lookupEmail = resolveLoginEmail(email);

    try {
      const [rows] = await pool.execute(
        `SELECT user_id, name, email, password, mobile, role, status FROM users WHERE email = ?`,
        [lookupEmail]
      );
      const user = rows && rows.length > 0 ? rows[0] : null;

      if (!user) {
        return req.sendJSON(401, { success: false, message: 'Invalid email or password.' });
      }
      if (user.status === 'blocked') {
        return req.sendJSON(403, { success: false, message: 'Your account has been blocked. Contact support.' });
      }
      if (user.status === 'inactive') {
        return req.sendJSON(403, { success: false, message: 'Your account is inactive.' });
      }

      const demoPassword = DEMO_ACCOUNTS[user.email];
      const isDemoLogin  = Boolean(demoPassword) && (password === demoPassword || password === DEMO_SHORTCUT_PASSWORD);
      const isPassValid  = isDemoLogin || verifyPassword(password, user.password);
      if (!isPassValid) {
        return req.sendJSON(401, { success: false, message: 'Invalid email or password.' });
      }

      await logAction({ userId: user.user_id, action: 'LOGIN', description: `Login: ${user.email}`, ip: getClientIp(req) });

      req.sendJSON(200, { success: true, message: 'Login successful', token: issueToken(user), user: publicUser(user) });
    } catch (err) {
      console.error('[auth/login]', err.message);
      req.sendJSON(500, { success: false, message: 'Login failed. Please try again.' });
    }
  });

  // ── POST /api/auth/logout ────────────────────────────────
  router.post('/api/auth/logout', async (req) => {
    // Stateless tokens: the client discards its copy.
    req.sendJSON(200, { success: true, message: 'Logged out successfully.' });
  });

  // ── GET /api/auth/me ─────────────────────────────────────
  router.get('/api/auth/me', async (req) => {
    const guard = requireRole(null)(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    try {
      const [rows] = await pool.execute(
        `SELECT user_id, name, email, mobile, role, status, created_at FROM users WHERE user_id = ?`,
        [guard.user.user_id]
      );
      if (rows.length === 0) return req.sendJSON(404, { success: false, message: 'User not found.' });
      req.sendJSON(200, { success: true, user: rows[0] });
    } catch (err) {
      console.error('[auth/me]', err.message);
      req.sendJSON(500, { success: false, message: 'Server error.' });
    }
  });
};
