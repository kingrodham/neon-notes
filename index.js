import 'dotenv/config';
import { createPool, migrate } from './lib/database.js';
import { createApp } from './app.js';

const pool = createPool(process.env.DATABASE_URL);
try {
  await migrate(pool);
  const app = await createApp({ pool, sessionSecret: process.env.SESSION_SECRET, production: process.env.NODE_ENV === 'production' });
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => console.log(`Neon Notes is running on port ${port}`));
  server.on('error', error => { console.error('Server startup failed:', error.code); process.exit(1); });
  const shutdown = () => {
    server.close(async () => { app.locals.sessionStore.close(); await pool.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  console.error('Startup failed:', error.code || error.message);
  await pool.end();
  process.exitCode = 1;
}
