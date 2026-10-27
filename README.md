# NEON / NOTES

A private blogging application with a futuristic dark interface, mint accents and responsive layouts. Built with Node.js, Express, EJS and PostgreSQL.

## Live application

[Neon Notes](https://neon-notes.onrender.com)

The live application uses PostgreSQL-backed accounts, posts and sessions. Registration, login and private post creation/editing/deletion were verified on the hosted service on 27 October 2026. Free web services can take time to wake after inactivity.

**Hosting lifecycle:** the current free Render PostgreSQL instance expires on **26 November 2026**. Upgrade it or export/migrate its data before that date to keep the application working and preserve records. No paid plan has been activated.

## Features

- Register with a name, email and password; sign in and sign out.
- Create, read, edit and delete your own posts. Posts are private to the account that owns them.
- PostgreSQL stores accounts, posts and sessions across application restarts.
- Salted scrypt password hashes; passwords are never stored as plaintext.
- Session regeneration after login; HttpOnly, SameSite cookies and HTTPS-only production cookies.
- CSRF tokens on every form that changes data, parameterised SQL, server-side input limits and escaped EJS output.
- Authentication rate limiting, security headers and friendly error pages.
- Responsive writing workspace, matching account screens and visible keyboard focus.

## Local setup

Requires Node.js 24+, npm and PostgreSQL 13+ (tested locally with PostgreSQL 18).

```bash
git clone https://github.com/kingrodham/neon-notes.git
cd neon-notes
npm ci
```

Create a dedicated database with pgAdmin or `createdb neon_notes`. Copy `.env.example` to `.env`, then set:

```dotenv
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5433/neon_notes
SESSION_SECRET=your-random-secret-with-at-least-32-characters
PORT=3000
NODE_ENV=development
```

Use the port on which your PostgreSQL server actually runs; the default is 5432. URL-encode special characters in database usernames/passwords. Generate a session secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Then run:

```bash
npm start
```

Open http://localhost:3000 (or your configured PORT). Startup creates the tables automatically before accepting requests. `npm run migrate` can initialise the schema separately; it is safe to repeat. `npm run dev` restarts the app after source changes. `.env` is ignored by Git.

## Deployment configuration

The existing Render service is configured with the database connection, a generated session secret, production mode and the `/health` check. For a new deployment or migration, follow these steps:

1. Create a Render PostgreSQL database in the same region as the existing web service. Choose a plan deliberately: free databases have lifecycle/retention limits; check the current Render terms and arrange backups or an appropriate paid plan for lasting data.
2. In the existing **neon-notes** web service's Environment settings, set `DATABASE_URL` to the database's **Internal Database URL**. Never paste credentials into source code, GitHub issues or the README.
3. Generate and set `SESSION_SECRET` (32+ random characters), and set `NODE_ENV=production`.
4. Keep Build Command `npm ci`, Start Command `npm start`, and set Health Check Path `/health`.
5. Deploy the main branch. Startup applies the additive schema before serving pages. Verify registration, login, create/edit/delete and sign-out on HTTPS.

The pool honours PostgreSQL connection-string TLS options. For external providers, use the provider's verified TLS configuration; do not disable certificate verification. The supplied Render Internal Database URL uses Render's private network.

### Alternative: a separate preview deployment

`render.yaml` defines a **new** `neon-notes-auth` service and a new `neon-notes-db` database, with the connection string linked automatically and a generated session secret. Use **New → Blueprint** on Render and choose the main branch. This does not upgrade the existing neon-notes service automatically. Review proposed resources/plans before creating them. The blueprint requests free plans and may need adjustment for availability or account limits.

## Tests

Create a separate disposable database named `neon_notes_test`, then set `TEST_DATABASE_URL` in `.env` (or the shell) and run:

```bash
npm test
```

**Tests reset tables in that database.** A guard refuses database names that do not end in `_test`. Never use a production database, even if its name ends in `_test`. GitHub Actions uses its own temporary PostgreSQL service.

Integration coverage includes validation, password hashing, login failure, duplicate accounts, session rotation and logout, CSRF rejection, escaped content, user ownership on read/edit/delete, persistence across app recreation, rate limiting and secure production cookies. `npm audit` checks dependency advisories.

## Structure

```text
index.js             Configuration, schema initialisation and server lifecycle
app.js               Middleware, authentication and owner-scoped post routes
lib/database.js      PostgreSQL pool and migration transaction
lib/passwords.js     Salted scrypt password hashing and verification
schema.sql           Accounts, posts, indexes and session storage
views/               EJS homepage, editor, account and error screens
public/styles.css    Responsive neon theme
scripts/migrate.js   Optional standalone schema initialisation
render.yaml          Separate Render preview and database setup
test/app.test.js    Real-PostgreSQL integration tests
```

## Data and scope

Existing in-memory demo posts were temporary and cannot be migrated after their server restarts. New posts belong to the account that creates them. This version has no public post feed, password recovery, email verification or account-deletion UI. Database-backed sessions survive restarts while valid; changing SESSION_SECRET invalidates old signed cookies. Site operators with database access can read posts: private access is not end-to-end encryption.

Authentication throttling currently uses per-process memory, appropriate for a single instance. A multi-instance deployment should use a shared limiter store. Back up PostgreSQL and test restores before relying on it for important content. A future upgrade can add account recovery and publishing controls.

GitHub hosts the source. The Express application needs a Node.js host and PostgreSQL; GitHub Pages alone cannot run it.

## Learning focus

Express routing and middleware, PostgreSQL relationships and parameterised queries, authentication vs authorisation, sessions, CSRF protection, EJS rendering and responsive CSS. Developed with assistance for explanations, implementation, testing and visual design.
