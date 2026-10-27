import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createPool, migrate } from '../lib/database.js';
import { createApp } from '../app.js';

const secret = 'integration-test-secret-with-more-than-32-characters';
function token(response) {
  const match = response.text.match(/name="_csrf" value="([a-f0-9]+)"/);
  assert.ok(match, 'Page should include a CSRF token');
  return match[1];
}

test('account and post lifecycle against a real PostgreSQL database', async t => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'Set TEST_DATABASE_URL to a dedicated database ending in _test.');
  assert.ok(new URL(url).pathname.endsWith('_test'), 'Refusing to reset a non-test database.');
  const pool = createPool(url);
  let app;
  t.after(async () => { app?.locals.sessionStore.close(); await pool.end(); });
  await migrate(pool);
  await migrate(pool); // Startup migration is safe to repeat.
  await pool.query('TRUNCATE posts, app_users, app_sessions RESTART IDENTITY CASCADE');
  app = await createApp({ pool, sessionSecret: secret });
  const alice = request.agent(app), bob = request.agent(app), guest = request.agent(app);
  let aliceToken, bobToken, postId;
  const password = 'A long unique test passphrase!';

  await t.test('guest landing, health, security headers and gated mutations', async () => {
    const home = await guest.get('/').expect(200);
    assert.match(home.text, /Create account/);
    assert.ok(home.headers['content-security-policy']);
    await guest.get('/health').expect(200);
    await guest.post('/posts').type('form').send({ title: 'Forged' }).expect(403);
    const csrf = token(await guest.get('/login'));
    await guest.post('/posts').type('form').send({ _csrf: csrf, title: 'Forged', content: 'x' }).expect(303).expect('Location', '/login');
  });
  await t.test('registration validates input and rotates the session', async () => {
    const page = await alice.get('/register').expect(200);
    const csrf = token(page);
    await alice.post('/register').type('form').send({ _csrf: csrf, displayName: 'Alice', email: 'not-an-email', password: 'short' }).expect(400);
    const response = await alice.post('/register').type('form').send({ _csrf: csrf, displayName: 'Alice', email: 'Alice@Example.com', password }).expect(303);
    assert.notEqual(response.headers['set-cookie'][0].split(';')[0], page.headers['set-cookie'][0].split(';')[0]);
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
    const home = await alice.get('/').expect(200); aliceToken = token(home);
    assert.match(home.text, /Hi, Alice/);
    const { rows } = await pool.query('SELECT email,password_hash FROM app_users');
    assert.equal(rows[0].email, 'alice@example.com');
    assert.notEqual(rows[0].password_hash, password);
    assert.match(rows[0].password_hash, /^scrypt\$/);
    await alice.post('/posts').type('form').send({ _csrf: csrf, title: 'Stale token', content: 'x' }).expect(403);
  });
  await t.test('post validation and escaped rendering', async () => {
    await alice.post('/posts').type('form').send({ _csrf: aliceToken, title: '   ', content: 'x' }).expect(400);
    await alice.post('/posts').type('form').send({ _csrf: aliceToken, title: 'x'.repeat(161), content: 'x' }).expect(400);
    await alice.post('/posts').type('form').send({ _csrf: aliceToken, title: 'My saved thought', content: '<script>alert(1)</script>' }).expect(303);
    const home = await alice.get('/').expect(200);
    assert.match(home.text, /&lt;script&gt;/);
    assert.doesNotMatch(home.text, /<script>alert/);
    postId = (await pool.query('SELECT id FROM posts')).rows[0].id;
  });
  await t.test('another user cannot read, edit or delete the owner’s post', async () => {
    const csrf = token(await bob.get('/register'));
    await bob.post('/register').type('form').send({ _csrf: csrf, displayName: 'Bob', email: 'bob@example.com', password }).expect(303);
    const page = await bob.get('/'); bobToken = token(page);
    assert.doesNotMatch(page.text, /My saved thought/);
    await bob.get(`/posts/${postId}/edit`).expect(404);
    await bob.post(`/posts/${postId}/edit`).type('form').send({ _csrf: bobToken, title: 'Stolen', content: 'x' }).expect(404);
    await bob.post(`/posts/${postId}/delete`).type('form').send({ _csrf: bobToken }).expect(404);
    await bob.get('/posts/not-a-number/edit').expect(404);
    assert.equal((await pool.query('SELECT title FROM posts')).rows[0].title, 'My saved thought');
  });
  await t.test('owner can edit while invalid edits preserve the existing post', async () => {
    const edit = await alice.get(`/posts/${postId}/edit`).expect(200);
    assert.match(edit.text, /My saved thought/);
    await alice.post(`/posts/${postId}/edit`).type('form').send({ _csrf: aliceToken, title: '', content: 'x' }).expect(400);
    await alice.post(`/posts/${postId}/edit`).type('form').send({ _csrf: aliceToken, title: 'Updated thought', content: 'Persistent content' }).expect(303);
    assert.equal((await pool.query('SELECT title FROM posts')).rows[0].title, 'Updated thought');
  });
  await t.test('posts and existing sessions survive an application restart', async () => {
    const sessionCookie = (await pool.query('SELECT sid FROM app_sessions WHERE sess->>\'userId\'=\'1\'')).rows;
    assert.equal(sessionCookie.length, 1);
    const { rows: sessions } = await pool.query('SELECT sid FROM app_sessions');
    assert.ok(sessions.length >= 2);
    // Obtain the actual signed cookie by signing out/in before restarting the app.
    await alice.post('/logout').type('form').send({ _csrf: aliceToken }).expect(303);
    const csrf = token(await alice.get('/login'));
    const login = await alice.post('/login').type('form').send({ _csrf: csrf, email: 'ALICE@example.com', password }).expect(303);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    app.locals.sessionStore.close();
    app = await createApp({ pool, sessionSecret: secret });
    const home = await request(app).get('/').set('Cookie', cookie).expect(200);
    assert.match(home.text, /Hi, Alice/); assert.match(home.text, /Updated thought/);
    const csrf2 = token(home);
    await request(app).post('/logout').set('Cookie', cookie).type('form').send({ _csrf: csrf2 }).expect(303);
    const loggedOut = await request(app).get('/').set('Cookie', cookie);
    assert.doesNotMatch(loggedOut.text, /Updated thought/);
  });
  await t.test('wrong password, unknown account and duplicate registration are rejected', async () => {
    const agent = request.agent(app);
    const csrf = token(await agent.get('/login'));
    const wrong = await agent.post('/login').type('form').send({ _csrf: csrf, email: 'alice@example.com', password: 'Incorrect password' }).expect(400);
    const unknown = await agent.post('/login').type('form').send({ _csrf: csrf, email: 'unknown@example.com', password }).expect(400);
    assert.match(wrong.text, /Email or password is incorrect/); assert.match(unknown.text, /Email or password is incorrect/);
    await agent.post('/register').type('form').send({ _csrf: csrf, displayName: 'Duplicate', email: 'ALICE@example.com', password }).expect(400);
    assert.equal((await pool.query('SELECT count(*) FROM app_users')).rows[0].count, '2');
  });
  await t.test('owner can log back in and delete persisted content', async () => {
    const agent = request.agent(app); const csrf = token(await agent.get('/login'));
    await agent.post('/login').type('form').send({ _csrf: csrf, email: 'alice@example.com', password }).expect(303);
    const csrf2 = token(await agent.get('/'));
    await agent.post(`/posts/${postId}/delete`).type('form').send({ _csrf: csrf2 }).expect(303);
    assert.equal((await pool.query('SELECT count(*) FROM posts')).rows[0].count, '0');
  });
  await t.test('authentication throttling responds with a helpful error', async () => {
    const limitedApp = await createApp({ pool, sessionSecret: secret, authLimit: 2 });
    try {
      const agent = request.agent(limitedApp); const csrf = token(await agent.get('/login'));
      const payload = { _csrf: csrf, email: 'missing@example.com', password };
      await agent.post('/login').type('form').send(payload).expect(400);
      await agent.post('/login').type('form').send(payload).expect(400);
      await agent.post('/login').type('form').send(payload).expect(429);
    } finally { limitedApp.locals.sessionStore.close(); }
  });
  await t.test('production cookies require HTTPS', async () => {
    const secureApp = await createApp({ pool, sessionSecret: secret, production: true });
    try {
      await request(secureApp).get('/login').expect(400);
      const page = await request(secureApp).get('/login').set('X-Forwarded-Proto', 'https').expect(200);
      assert.match(page.headers['set-cookie'][0], /; Secure/);
    } finally { secureApp.locals.sessionStore.close(); }
  });
});
