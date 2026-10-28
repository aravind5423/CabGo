'use strict';

const { connect } = require('@tidbcloud/serverless');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || '3306';
const user = encodeURIComponent(process.env.DB_USER || 'root');
const password = encodeURIComponent(process.env.DB_PASSWORD || '');
const database = process.env.DB_NAME || 'cab_booking';
const isRemote = host !== 'localhost' && host !== '127.0.0.1';

const connectionUrl = process.env.DATABASE_URL || (isRemote
  ? `mysql://${user}:${password}@${host}:${port}/${database}?ssl=true`
  : `mysql://${user}:${password}@${host}:${port}/${database}`);

async function seed() {
  console.log('[seed] Connecting to TiDB...');
  const conn = connect({ url: connectionUrl });

  // 1. First ensure schema tables exist
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');
  const schemaStmts = schemaSql.split(/;\s*\n/).map(s => s.trim()).filter(s => {
    const clean = s.replace(/--[^\n]*/g, '').trim();
    return clean && !/^CREATE DATABASE/i.test(clean) && !/^USE\s+/i.test(clean);
  });

  console.log(`[seed] Checking ${schemaStmts.length} schema statements...`);
  for (const stmt of schemaStmts) {
    try {
      await conn.execute(stmt);
    } catch (e) {
      // ignore table exists
    }
  }

  // 2. Run seed statements
  const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf8').replace(/\r\n/g, '\n');
  const seedStmts = seedSql.split(/;\s*\n/).map(s => s.trim()).filter(s => {
    const clean = s.replace(/--[^\n]*/g, '').trim();
    return clean && !/^USE\s+/i.test(clean) && !/^SET\s+/i.test(clean);
  });

  console.log(`[seed] Running ${seedStmts.length} seed statements...`);
  for (const stmt of seedStmts) {
    try {
      await conn.execute(stmt);
      console.log('✅ ' + stmt.replace(/\n/g, ' ').slice(0, 60));
    } catch (e) {
      console.warn('⚠️  ' + e.message.slice(0, 80));
    }
  }

  const [res] = await conn.execute('SELECT COUNT(*) as cnt FROM users');
  const count = Array.isArray(res) ? res[0]?.cnt : (res.rows?.[0]?.cnt || res);
  console.log('[seed] ✅ Seeding complete! Users count:', count);
}

seed().catch(err => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
