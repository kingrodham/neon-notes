# Neon Notes

**A private home for your ideas.** Neon Notes lets you write, revisit and refine personal blog posts through a responsive interface with a dark neon theme.

[Open the live app](https://neon-notes.onrender.com) · [Create an account](https://neon-notes.onrender.com/register)

Built by **Rodham Makwara** as a full-stack portfolio project using **Node.js, Express, EJS and PostgreSQL**.

## Contents

- [Overview](#overview)
- [Features](#features)
- [How it works](#how-it-works)
- [Technology](#technology)
- [Project structure](#project-structure)
- [Run locally](#run-locally)
- [Commands](#commands)
- [Tests](#tests)
- [Security and hosting](#security-and-hosting)
- [Roadmap](#roadmap)
- [Author](#author)

## Overview

Neon Notes provides one place to capture short ideas and longer personal posts, then return to refine them later. The project grew from an in-memory CRUD capstone into an account-based application with durable storage and private collections.

The main engineering focus is following a user's request from a form through validation, authentication, ownership checks and database storage, then rendering the result clearly.

## Features

- Create an account, sign in and sign out.
- Write posts with a title and body, then edit or delete them.
- View a private feed containing only your own posts, newest first.
- Return to saved posts after signing out or restarting the application.
- Use the writing workspace on desktop and mobile, with keyboard focus and reduced-motion support.

Posts are private account content; publishing a post saves it to your collection rather than a public feed.

## How it works

```mermaid
flowchart LR
    A[Browser and EJS forms] --> B[Express middleware]
    B --> C[Authentication and owner-scoped routes]
    C --> D[(PostgreSQL)]
    C --> E[Rendered HTML response]
    E --> A
```

The backend validates input and checks the signed-in user's ownership before accessing a post. PostgreSQL keeps the data outside the application process, so restarting the web server does not clear it. Passwords are stored as salted scrypt hashes.

## Technology

| Area | Tools |
| --- | --- |
| Interface | HTML, CSS, responsive layouts, EJS templates |
| Server | Node.js 24+, Express |
| Database | PostgreSQL and node-postgres (`pg`) |
| Accounts | express-session, connect-pg-simple, Node.js crypto |
| Protection | Helmet, CSRF tokens, parameterised SQL, express-rate-limit |
| Verification | Node.js test runner, Supertest, real PostgreSQL integration tests |
| Hosting | Render web service and PostgreSQL |

## Project structure

```text
src/          Express application, startup and shared database/password code
database/     PostgreSQL table definitions and indexes
views/        EJS pages and shared navigation
public/       Browser-facing styles
scripts/      Database initialisation command
tests/        PostgreSQL integration tests
docs/         Architecture, security and deployment guides
.github/      GitHub Actions workflow
```

Root-level files configure npm, Git and Render. See the [full file tree, database model and routes](docs/architecture.md).

## Run locally

You need **Node.js 24+**, **npm** and **PostgreSQL 13+**. Development and integration tests were verified with PostgreSQL 18.

```bash
git clone https://github.com/kingrodham/neon-notes.git
cd neon-notes
npm ci
cp .env.example .env
```

Create a database named `neon_notes` in pgAdmin or with `createdb neon_notes`. Edit `.env` with your own local connection and a random session secret:

```dotenv
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/neon_notes
SESSION_SECRET=replace-with-a-long-random-value
PORT=3000
NODE_ENV=development
```

Use your PostgreSQL server's actual port; some installations use 5433. URL-encode special characters in database credentials. Generate a session secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Start the app:

```bash
npm start
```

Visit **http://localhost:3000**. Startup creates the required tables before accepting requests. `.env` stays on your computer and must never be committed.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the application |
| `npm run dev` | Restart automatically when source files change |
| `npm run migrate` | Initialise the database separately; safe to repeat |
| `npm test` | Run the PostgreSQL integration checks |
| `npm audit` | Check dependency advisories |

## Tests

Create a separate **disposable** database named `neon_notes_test`, add its connection string to `.env`, then run the tests:

```dotenv
TEST_DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/neon_notes_test
```

```bash
npm test
```

Tests reset their database tables. The runner requires a database name ending in `_test`; never point it at production.

Coverage includes registration validation, hashed passwords, invalid credentials, duplicate accounts, session rotation and logout, CSRF rejection, escaped content, access restrictions between users, post editing/deletion, persistence across app recreation, rate limiting and production HTTPS cookies. All 11 checks passed locally on 27 October 2026. GitHub Actions runs against its own PostgreSQL service when account-level runner access is available.

## Security and hosting

Read [security and limitations](docs/security.md) for the implemented protections and remaining scope, including password recovery, email verification and multi-instance rate limiting.

See [deployment instructions](docs/deployment.md) for Render configuration. The free web service may sleep when inactive. **The current free database expires on 26 November 2026** and must be upgraded or migrated before then to preserve records and keep the service working.

## Roadmap

- [ ] Verified-email registration and secure password recovery.
- [ ] Search and pagination for larger post collections.
- [ ] Shared rate-limit storage for deployments with multiple instances.
- [ ] Optional public publishing with explicit visibility controls.

These are planned improvements, not current features. See [architecture and design decisions](docs/architecture.md) for the current implementation.

## Author

**Rodham Makwara** · [GitHub](https://github.com/kingrodham)

### What this project demonstrates

Server-rendered full-stack development, form handling, relational data modelling, persistent sessions, authentication versus authorisation, secure ownership checks, integration testing and responsive interface design. Developed with assistance for implementation, explanations, testing and visual design.
