// server/db.js
// MySQL2 connection pool — reads config from .env file

'use strict';

const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

// ---------- Load .env manually (no dotenv package) ----------
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.warn('[db] .env file not found — using process.env or defaults');
    return;
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ---------- Create pool ----------
const isRemoteHost = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT, 10) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'cab_booking',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  ssl:                isRemoteHost ? { rejectUnauthorized: false } : undefined,
});

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('[db] ✅ MySQL connected — database:', process.env.DB_NAME || 'cab_booking');
    conn.release();
  })
  .catch(err => {
    console.error('[db] ❌ MySQL connection failed:', err.message);
  });

module.exports = pool;
