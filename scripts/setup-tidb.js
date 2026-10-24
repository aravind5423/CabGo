// scripts/setup-tidb.js
// Runs schema.sql on TiDB Cloud using the @tidbcloud/serverless HTTP driver
'use strict';

const { connect } = require('@tidbcloud/serverless');
const fs = require('fs');
const path = require('path');

const URL = 'mysql://XGZSBkh6bGvYCD8.root:QZyHLSaBDOQ87LRV@gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000/cab_booking?ssl=true';

async function runSchema() {
  const conn = connect({ url: URL });

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
