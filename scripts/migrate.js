import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMysqlPool } from '../packages/database/mysql_adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('--- Running PdhSafetyFire Database Migrations ---');
  const pool = await getMysqlPool();
  const sqlPath = path.join(__dirname, '../packages/database/schema.sql');
  const schemaSql = fs.readFileSync(sqlPath, 'utf-8');

  // Split SQL commands cleanly
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const connection = await pool.getConnection();
  try {
    for (const stmt of statements) {
      await connection.query(stmt);
    }
    console.log(`Successfully executed ${statements.length} DDL migration statements.`);

    // Record migration version
    await connection.query('INSERT IGNORE INTO migrations (version) VALUES (?)', ['v1.0.0_pdhsafetyfire_initial']);
  } finally {
    connection.release();
  }
}

if (process.argv[1] === __filename) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed successfully.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
