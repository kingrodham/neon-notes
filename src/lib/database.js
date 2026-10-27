import pg from 'pg';
import { readFile } from 'node:fs/promises';

export function createPool(connectionString) {
  if (!connectionString) throw new Error('Set DATABASE_URL before starting Neon Notes. See .env.example.');
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 10000 });
  pool.on('error', error => console.error('Idle database connection failed:', error.code || error.name));
  return pool;
}

export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(78310425)');
    await client.query(await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8'));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
