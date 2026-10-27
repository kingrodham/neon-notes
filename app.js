import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword } from './lib/passwords.js';

const text = (value) => typeof value === 'string' ? value.trim() : '';
const validId = (id) => /^[1-9]\d{0,9}$/.test(id) && Number(id) <= 2147483647;

export async function createApp({ pool, sessionSecret, production = false, authLimit = 20 }) {
  if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const app = express();
  const PgStore = connectPgSimple(session);
  const store = new PgStore({ pool, tableName: 'app_sessions', pruneSessionInterval: 900 });
  app.locals.sessionStore = store;
  // Render terminates HTTPS at one reverse proxy. Only trust that hop.
  if (production) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('./views', import.meta.url)));
  app.use(helmet());
  app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));
  app.get('/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.use(express.urlencoded({ extended: false, limit: '128kb' }));
  app.use(session({
    name: 'neon.sid', store, secret: sessionSecret,
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure: production, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));
  app.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.locals.user = null;
    res.locals.error = null;
    res.locals.values = {};
    if (req.session.userId) {
      const { rows } = await pool.query('SELECT id, email, display_name FROM app_users WHERE id=$1', [req.session.userId]);
      res.locals.user = rows[0] || null;
      if (!rows[0]) delete req.session.userId;
    }
    req.session.csrfToken ||= randomBytes(32).toString('hex');
    res.locals.csrfToken = req.session.csrfToken;
    next();
  });
  function problem(res, status, message) {
    return res.status(status).render('error', { message, status });
  }
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const supplied = typeof req.body?._csrf === 'string' ? req.body._csrf : '';
    const expected = req.session.csrfToken;
    const a = Buffer.from(supplied), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return problem(res, 403, 'This form expired. Refresh the page and try again.');
    next();
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: authLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res) => problem(res, 429, 'Too many sign-in attempts. Please try again in 15 minutes.'),
  });
  // A dummy hash keeps unknown-account password checks on the same expensive path.
  const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
  const requireLogin = (req, res, next) => res.locals.user ? next() : res.redirect(303, '/login');
  const guestOnly = (req, res, next) => res.locals.user ? res.redirect(303, '/') : next();
  async function signIn(req, userId) {
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = userId;
    req.session.csrfToken = randomBytes(32).toString('hex');
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  }
  app.get('/register', guestOnly, (req, res) => res.render('auth', { mode: 'register' }));
  app.get('/login', guestOnly, (req, res) => res.render('auth', { mode: 'login' }));
  app.post('/register', guestOnly, authLimiter, async (req, res) => {
    const email = text(req.body.email).toLowerCase();
    const displayName = text(req.body.displayName);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const values = { email, displayName };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !displayName || displayName.length > 60 || password.length < 12 || password.length > 128) {
      return res.status(400).render('auth', { mode: 'register', values, error: 'Enter a name (1–60 characters), a valid email and a password of 12–128 characters.' });
    }
    try {
      const passwordHash = await hashPassword(password);
      const { rows } = await pool.query('INSERT INTO app_users(email, display_name, password_hash) VALUES($1,$2,$3) RETURNING id', [email, displayName, passwordHash]);
      await signIn(req, rows[0].id);
      res.redirect(303, '/');
    } catch (error) {
      if (error.code === '23505') return res.status(400).render('auth', { mode: 'register', values, error: 'Unable to create this account. Try signing in or use another email.' });
      throw error;
    }
  });
  app.post('/login', guestOnly, authLimiter, async (req, res) => {
    const email = text(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (email.length > 254 || password.length > 128 || !password) return res.status(400).render('auth', { mode: 'login', values: { email }, error: 'Email or password is incorrect.' });
    const { rows } = await pool.query('SELECT id, password_hash FROM app_users WHERE email=$1', [email]);
    const matches = await verifyPassword(password, rows[0]?.password_hash || dummyHash);
    if (!rows[0] || !matches) return res.status(400).render('auth', { mode: 'login', values: { email }, error: 'Email or password is incorrect.' });
    await signIn(req, rows[0].id);
    res.redirect(303, '/');
  });
  app.post('/logout', async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie('neon.sid', { path: '/', httpOnly: true, secure: production, sameSite: 'lax' });
    res.redirect(303, '/');
  });
  app.get('/', async (req, res) => {
    const posts = res.locals.user ? (await pool.query('SELECT id, title, content, created_at, updated_at FROM posts WHERE user_id=$1 ORDER BY created_at DESC, id DESC', [res.locals.user.id])).rows : [];
    res.render('index', { posts });
  });
  function postInput(req) {
    const title = text(req.body.title), content = text(req.body.content);
    return { title, content, valid: title.length > 0 && title.length <= 160 && content.length > 0 && content.length <= 20000 };
  }
  app.post('/posts', requireLogin, async (req, res) => {
    const input = postInput(req);
    if (!input.valid) {
      const posts = (await pool.query('SELECT id,title,content FROM posts WHERE user_id=$1 ORDER BY created_at DESC,id DESC', [res.locals.user.id])).rows;
      return res.status(400).render('index', { posts, values: input, error: 'Use a title of 1–160 characters and a story of 1–20,000 characters.' });
    }
    await pool.query('INSERT INTO posts(user_id,title,content) VALUES($1,$2,$3)', [res.locals.user.id, input.title, input.content]);
    res.redirect(303, '/');
  });
  app.get('/posts/:id/edit', requireLogin, async (req, res) => {
    if (!validId(req.params.id)) return problem(res, 404, 'Post not found.');
    const { rows } = await pool.query('SELECT id,title,content FROM posts WHERE id=$1 AND user_id=$2', [req.params.id, res.locals.user.id]);
    if (!rows[0]) return problem(res, 404, 'Post not found.');
    res.render('edit', { post: rows[0] });
  });
  app.post('/posts/:id/edit', requireLogin, async (req, res) => {
    if (!validId(req.params.id)) return problem(res, 404, 'Post not found.');
    const { rows } = await pool.query('SELECT id,title,content FROM posts WHERE id=$1 AND user_id=$2', [req.params.id, res.locals.user.id]);
    if (!rows[0]) return problem(res, 404, 'Post not found.');
    const input = postInput(req);
    if (!input.valid) return res.status(400).render('edit', { post: { ...rows[0], ...input }, error: 'Use a title of 1–160 characters and a story of 1–20,000 characters.' });
    await pool.query('UPDATE posts SET title=$1,content=$2,updated_at=now() WHERE id=$3 AND user_id=$4', [input.title, input.content, req.params.id, res.locals.user.id]);
    res.redirect(303, '/');
  });
  app.post('/posts/:id/delete', requireLogin, async (req, res) => {
    if (!validId(req.params.id)) return problem(res, 404, 'Post not found.');
    const result = await pool.query('DELETE FROM posts WHERE id=$1 AND user_id=$2', [req.params.id, res.locals.user.id]);
    if (!result.rowCount) return problem(res, 404, 'Post not found.');
    res.redirect(303, '/');
  });
  app.use((req, res) => problem(res, 404, 'That page does not exist.'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Request failed:', error.code || error.name);
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
    problem(res, status, status === 413 ? 'This submission is too large.' : status === 400 ? 'This request could not be read.' : 'Something went wrong. Please try again shortly.');
  });
  return app;
}
