// server/db.js
// TiDB Cloud connection — uses @tidbcloud/serverless (HTTP-based, no TCP/TLS issues)

'use strict';

const { connect } = require('@tidbcloud/serverless');
const fs   = require('fs');
const path = require('path');

// ---------- Load .env manually ----------
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
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

// ---------- Build connection URL ----------
const host     = process.env.DB_HOST     || 'localhost';
const port     = process.env.DB_PORT     || '3306';
const user     = encodeURIComponent(process.env.DB_USER     || 'root');
const password = encodeURIComponent(process.env.DB_PASSWORD || '');
const database = process.env.DB_NAME     || 'cab_booking';
const isRemote = host !== 'localhost' && host !== '127.0.0.1';

const connectionUrl = process.env.DATABASE_URL || (isRemote
  ? `mysql://${user}:${password}@${host}:${port}/${database}?ssl=true`
  : `mysql://${user}:${password}@${host}:${port}/${database}`);

// ---------- Create a pool-like wrapper ----------
// @tidbcloud/serverless creates stateless connections per query,
// so we wrap it to match the mysql2 pool API used in routes.
const tidbConn = connect({ url: connectionUrl });

const pool = {
  // routes call pool.execute(sql, params)
  execute: (sql, params) => tidbConn.execute(sql, params)
    .then(result => {
      // mysql2 returns [rows, fields]; serverless returns { rows, ... }
      const rows = Array.isArray(result) ? result : (result.rows || result);
      return [rows];
    }),

  // routes also call pool.query(sql, params)
  query: (sql, params) => tidbConn.execute(sql, params)
    .then(result => {
      const rows = Array.isArray(result) ? result : (result.rows || result);
      return [rows];
    }),

  // some routes use pool.getConnection() pattern
  getConnection: () => Promise.resolve({
    execute: (sql, params) => pool.execute(sql, params),
    query:   (sql, params) => pool.query(sql, params),
    release: () => {},
    beginTransaction: () => tidbConn.execute('BEGIN'),
    commit:           () => tidbConn.execute('COMMIT'),
    rollback:         () => tidbConn.execute('ROLLBACK'),
  }),
};

// ---------- Test on startup ----------
tidbConn.execute('SELECT 1 AS ok')
  .then(() => {
    console.log('[db] ✅ TiDB Cloud connected — database:', database);
  })
  .catch(err => {
    console.error('[db] ❌ TiDB Cloud connection failed:', err.message);
  });

module.exports = pool;
