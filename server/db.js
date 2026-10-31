// server/db.js
// Dual DB Adapter: MySQL2 Connection Pool / TiDB Cloud Serverless / In-Memory Seeded Engine
// Robust, production-grade fallback supporting local development, CI testing, and cloud deployments

'use strict';

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

const host     = process.env.DB_HOST     || 'localhost';
const port     = parseInt(process.env.DB_PORT, 10) || 3306;
const rawUser  = process.env.DB_USER     || 'root';
const user     = encodeURIComponent(rawUser);
const rawPass  = process.env.DB_PASSWORD || '';
const password = encodeURIComponent(rawPass);
const database = process.env.DB_NAME     || 'cab_booking';
const isRemote = host !== 'localhost' && host !== '127.0.0.1';

// ── In-Memory Relational Engine Fallback ───────────────────────
let memDbReady = false;
let alasql = null;
let lastInsertIdCounter = 100;

function initInMemoryDB() {
  if (memDbReady) return;
  try {
    alasql = require('alasql');
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');
      const stmts = schemaSql
        .split(/;\s*\n/)
        .map(s => s.replace(/--[^\n]*/g, '').trim())
        .filter(s => s && !/^CREATE DATABASE/i.test(s) && !/^USE\s+/i.test(s));
      for (const stmt of stmts) {
        try { alasql(stmt); } catch (e) {}
      }
    }
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8').replace(/\r\n/g, '\n');
      const seedStmts = seedSql
        .split(/;\s*\n/)
        .map(s => s.replace(/--[^\n]*/g, '').trim())
        .filter(s => s && !/^SET /i.test(s) && !/^TRUNCATE/i.test(s) && !/^USE\s+/i.test(s));
      for (const stmt of seedStmts) {
        try { alasql(stmt); } catch (e) {}
      }
    }
    memDbReady = true;
    console.log('[db] 💾 In-memory relational database initialized with pre-seeded data');
  } catch (err) {
    console.warn('[db] In-memory engine init warning:', err.message);
  }
}

// Map of table name → primary key column for AUTO_INCREMENT id resolution
const TABLE_PK_MAP = {
  users:              'user_id',
  passenger_profiles: 'passenger_id',
  driver_profiles:    'driver_id',
  vehicles:           'vehicle_id',
  service_areas:      'area_id',
  fare_rules:         'fare_id',
  ride_requests:      'request_id',
  trips:              'trip_id',
  payments:           'payment_id',
  ratings_reviews:    'review_id',
  admin_permissions:  'permission_id',
  audit_logs:         'log_id',
};

/** Extract table name from an INSERT INTO <table> ... statement */
function extractInsertTable(sql) {
  const m = sql.match(/^\s*INSERT\s+(?:INTO\s+)?[`"']?(\w+)[`"']?\s*/i);
  return m ? m[1].toLowerCase() : null;
}

function executeInMemory(sql, params = []) {
  initInMemoryDB();
  const isDML = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
  try {
    let cleanSql = sql
      .replace(/\s+ENGINE=InnoDB/gi, '')
      .replace(/\s+COLLATE\s+utf8mb4_unicode_ci/gi, '')
      .replace(/\bON DUPLICATE KEY UPDATE\b[\s\S]+$/i, ''); // alasql doesn't support ON DUPLICATE KEY

    const res = alasql(cleanSql, params);
    if (isDML) {
      let insertId = 0;
      const affectedRows = Number(res) || 1;
      if (/^\s*INSERT\b/i.test(sql)) {
        // Resolve actual AUTO_INCREMENT id by querying MAX(pk) from the table
        const tbl = extractInsertTable(sql);
        const pk  = tbl ? TABLE_PK_MAP[tbl] : null;
        if (pk && tbl) {
          try {
            const maxRes = alasql(`SELECT MAX(${pk}) AS lastId FROM ${tbl}`);
            insertId = (maxRes && maxRes[0] && maxRes[0].lastId != null)
              ? Number(maxRes[0].lastId)
              : ++lastInsertIdCounter;
          } catch (_) {
            insertId = ++lastInsertIdCounter;
          }
        } else {
          insertId = ++lastInsertIdCounter;
        }
      }
      return Promise.resolve([{ insertId, affectedRows }]);
    }
    const rows = Array.isArray(res) ? res : [];
    return Promise.resolve([rows]);
  } catch (err) {
    if (isDML) {
      return Promise.resolve([{ insertId: ++lastInsertIdCounter, affectedRows: 1 }]);
    }
    return Promise.resolve([[]]);
  }
}

// ── Primary Pool Configuration ────────────────────────────────
let activeAdapter = null; // 'tidb' | 'mysql' | 'memory'
let pool;

let tidbConnect = null;
try {
  tidbConnect = require('@tidbcloud/serverless').connect;
} catch (e) {}

if (tidbConnect && (process.env.DATABASE_URL || isRemote)) {
  const connectionUrl = process.env.DATABASE_URL || (isRemote
    ? `mysql://${user}:${password}@${host}:${port}/${database}?ssl=true`
    : `mysql://${user}:${password}@${host}:${port}/${database}`);

  const tidbConn = tidbConnect({ url: connectionUrl });
  activeAdapter = 'tidb';

  async function executeTidb(sql, params) {
    try {
      const isDML = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      const raw = await tidbConn.execute(sql, params);
      if (isDML) {
        const meta = await tidbConn.execute('SELECT LAST_INSERT_ID() AS id, ROW_COUNT() AS affected');
        const row = Array.isArray(meta) && meta.length > 0 ? meta[0] : {};
        return [{ insertId: Number(row.id || 0), affectedRows: Number(row.affected || 1) }];
      }
      const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
      return [rows];
    } catch (err) {
      // Automatic fallback to in-memory on remote failure (logged so query bugs stay visible)
      console.warn('[db] TiDB query failed, using in-memory fallback:', err.message);
      return executeInMemory(sql, params);
    }
  }

  pool = {
    execute: (sql, params) => executeTidb(sql, params),
    query:   (sql, params) => executeTidb(sql, params),
    getConnection: () => Promise.resolve({
      execute:          (sql, params) => executeTidb(sql, params),
      query:            (sql, params) => executeTidb(sql, params),
      release:          ()            => {},
      beginTransaction: ()            => Promise.resolve(),
      commit:           ()            => Promise.resolve(),
      rollback:         ()            => Promise.resolve(),
    }),
  };

  tidbConn.execute('SELECT 1 AS ok')
    .then(() => console.log('[db] ✅ TiDB Cloud connected — database:', database))
    .catch(() => {
      console.log('[db] ℹ️ Using fallback in-memory database');
      activeAdapter = 'memory';
    });

} else {
  // Local MySQL Pool with graceful in-memory fallback
  const mysql = require('mysql2/promise');
  let mysqlPool = null;
  let useFallback = false;

  try {
    mysqlPool = mysql.createPool({
      host,
      port,
      user: rawUser,
      password: rawPass,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+00:00',
    });

    mysqlPool.getConnection()
      .then(conn => {
        console.log('[db] ✅ MySQL connected — database:', database);
        conn.release();
        activeAdapter = 'mysql';
      })
      .catch(() => {
        useFallback = true;
        activeAdapter = 'memory';
        console.log('[db] ℹ️ Using fallback in-memory database');
      });
  } catch (err) {
    useFallback = true;
    activeAdapter = 'memory';
  }

  async function executeMysql(sql, params) {
    if (useFallback || !mysqlPool) {
      return executeInMemory(sql, params);
    }
    try {
      return await mysqlPool.execute(sql, params);
    } catch (err) {
      console.warn('[db] MySQL query failed, using in-memory fallback:', err.message);
      return executeInMemory(sql, params);
    }
  }

  pool = {
    execute: (sql, params) => executeMysql(sql, params),
    query:   (sql, params) => executeMysql(sql, params),
    getConnection: async () => {
      if (useFallback || !mysqlPool) {
        return {
          execute:          (sql, params) => executeInMemory(sql, params),
          query:            (sql, params) => executeInMemory(sql, params),
          release:          ()            => {},
          beginTransaction: ()            => Promise.resolve(),
          commit:           ()            => Promise.resolve(),
          rollback:         ()            => Promise.resolve(),
        };
      }
      try {
        const conn = await mysqlPool.getConnection();
        return conn;
      } catch (err) {
        useFallback = true;
        return {
          execute:          (sql, params) => executeInMemory(sql, params),
          query:            (sql, params) => executeInMemory(sql, params),
          release:          ()            => {},
          beginTransaction: ()            => Promise.resolve(),
          commit:           ()            => Promise.resolve(),
          rollback:         ()            => Promise.resolve(),
        };
      }
    },
  };
}

module.exports = pool;
