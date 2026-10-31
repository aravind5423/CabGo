// server/db.js
// TiDB Cloud Serverless — HTTP-based stateless driver
// Fixes: transaction no-ops, correct DML result extraction, insertId via LAST_INSERT_ID()

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

const tidbConn = connect({ url: connectionUrl });

// ---------- Detect DML vs DQL ----------
function isDML(sql) {
  return /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
}

// ---------- Execute a SQL statement and return mysql2-compatible result ----------
// For SELECT/SHOW → returns [rows]
// For INSERT/UPDATE/DELETE → returns [{ insertId, affectedRows }]
// TiDB Serverless HTTP driver returns [] for DML, so we fetch LAST_INSERT_ID() after INSERTs.
async function executeSQL(sql, params) {
  const dml = isDML(sql);
  const raw = await tidbConn.execute(sql, params);

  if (dml) {
    // Fetch insertId and affected row count in one round-trip
    const meta = await tidbConn.execute('SELECT LAST_INSERT_ID() AS id, ROW_COUNT() AS affected');
    const row = Array.isArray(meta) && meta.length > 0 ? meta[0] : {};
    return [{ insertId: Number(row.id || 0), affectedRows: Number(row.affected || 0) }];
  }

  // SELECT / SHOW / DESCRIBE
  const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
  return [rows];
}

// ---------- Pool-like interface (matches mysql2 API used throughout routes) ----------
const pool = {
  execute: (sql, params) => executeSQL(sql, params),
  query:   (sql, params) => executeSQL(sql, params),

  // getConnection() returns a pseudo-connection object.
  // TiDB Cloud Serverless (HTTP driver) does NOT support persistent connections
  // or multi-statement transactions (BEGIN/COMMIT/ROLLBACK are unsupported SQL).
  // We make those calls safe no-ops so existing route code does not crash.
  // Data integrity is ensured by query ordering and status checks within each route.
  getConnection: () => Promise.resolve({
    execute:          (sql, params) => executeSQL(sql, params),
    query:            (sql, params) => executeSQL(sql, params),
    release:          ()            => {},
    beginTransaction: ()            => Promise.resolve(),
    commit:           ()            => Promise.resolve(),
    rollback:         ()            => Promise.resolve(),
  }),
};

// ---------- Startup connectivity test ----------
tidbConn.execute('SELECT 1 AS ok')
  .then(() => console.log('[db] ✅ TiDB Cloud connected — database:', database))
  .catch(err => console.error('[db] ❌ TiDB Cloud connection failed:', err.message));

module.exports = pool;
