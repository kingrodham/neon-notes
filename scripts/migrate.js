import 'dotenv/config';
import { createPool, migrate } from '../lib/database.js';
const pool = createPool(process.env.DATABASE_URL);
try { await migrate(pool); console.log('Database schema is ready.'); }
finally { await pool.end(); }
