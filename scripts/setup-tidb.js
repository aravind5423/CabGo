// scripts/setup-tidb.js
// Runs schema.sql on TiDB Cloud using the @tidbcloud/serverless HTTP driver
'use strict';

const { connect } = require('@tidbcloud/serverless');
const fs = require('fs');
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

async function runSchema() {
  console.log(`[setup] Connecting to ${isRemote ? 'cloud database' : 'database'} (${database} on ${host})...`);
  const conn = connect({ url: connectionUrl });

  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  let sql = fs.readFileSync(schemaPath, 'utf8');

  // Remove Windows line endings
  sql = sql.replace(/\r\n/g, '\n');

  // Split on semicolons followed by newline or end-of-string
  const rawStatements = sql.split(/;\s*\n/);

  const statements = rawStatements
    .map(s => s.trim())
    .filter(s => {
      if (!s) return false;
      // Remove pure comment blocks
      const noComments = s.replace(/--[^\n]*/g, '').trim();
      if (!noComments) return false;
      // Skip CREATE DATABASE (already created) and USE statements
      if (/^CREATE DATABASE/i.test(noComments)) return false;
      if (/^USE\s+/i.test(noComments)) return false;
      return true;
    });

  console.log(`[setup] Running ${statements.length} SQL statements on TiDB Cloud...`);

  let ok = 0, skipped = 0, failed = 0;
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      const firstLine = stmt.replace(/\n/g, ' ').substring(0, 70);
      console.log(`  ✅  ${firstLine}`);
      ok++;
    } catch (err) {
      if (err.message && (err.message.includes('already exists') || err.message.includes('Duplicate'))) {
        const firstLine = stmt.replace(/\n/g, ' ').substring(0, 70);
        console.log(`  ⚠️  (skip) ${firstLine}`);
        skipped++;
      } else {
        console.error(`  ❌  ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n[setup] Done — ${ok} created, ${skipped} skipped, ${failed} failed`);
}

runSchema().catch(err => {
  console.error('[setup] Fatal:', err.message);
  process.exit(1);
});
