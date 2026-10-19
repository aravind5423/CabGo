// server/middleware/logger.js
// Writes every API call to system_logs table

'use strict';

const pool = require('../db');

/**
 * logAction — writes a record to system_logs
 * @param {object} opts
 * @param {number|null} opts.userId
 * @param {string}      opts.action       e.g. 'POST /api/auth/login'
 * @param {string}      opts.description  human-readable description
 * @param {string}      opts.ip           client IP
 */
async function logAction({ userId = null, action, description = '', ip = '' }) {
  try {
    await pool.execute(
      `INSERT INTO system_logs (user_id, action, description, ip_address, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId || null, action, description, ip]
    );
  } catch (err) {
    // Non-fatal — just print to console so we never break the main response
    console.error('[logger] Failed to write log:', err.message);
  }
}

/**
 * requestLogger — middleware-style wrapper
 * Call this inside each route handler after the main logic.
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for'] ||
    req.socket?.remoteAddress ||
    ''
  );
}

module.exports = { logAction, getClientIp };
