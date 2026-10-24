// scripts/migrate.js
// Automatically runs schema.sql and seed.sql against the configured MySQL database

'use strict';

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load .env
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('[migrate] ❌ .env file not found at:', envPath);
    process.exit(1);
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

async function run() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT, 10) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const isRemote = host !== 'localhost' && host !== '127.0.0.1';

  console.log(`[migrate] 📡 Connecting to MySQL at ${host}:${port} as ${user}...`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
      ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    });
    console.log('[migrate] ✅ Connected successfully!');
  } catch (err) {
    console.error('[migrate] ❌ Connection failed:', err.message);
    console.error('Please verify DB_HOST, DB_PORT, DB_USER, and DB_PASSWORD in your .env file.');
    process.exit(1);
  }

  try {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    console.log('[migrate] 📄 Reading database/schema.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('[migrate] ⚙️  Executing schema (creating tables)...');
    await connection.query(schemaSql);
    console.log('[migrate] ✅ Tables created successfully!');

    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    console.log('[migrate] 📄 Reading database/seed.sql...');
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('[migrate] 🌱 Seeding demo users, drivers, vehicles, and rules...');
    await connection.query(seedSql);
    console.log('[migrate] ✅ Seed data inserted successfully!');

    console.log('\n🎉 ALL DONE! Your database is fully configured and ready.');
    console.log('You can now run: npm start\n');
  } catch (err) {
    console.error('[migrate] ❌ Query execution failed:', err.message);
  } finally {
    await connection.end();
  }
}

run();
