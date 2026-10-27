# Deployment and hosting

The existing Render service is configured with the database connection, a generated session secret, production mode and the `/health` check. For a new deployment or migration, follow these steps:

1. Create a Render PostgreSQL database in the same region as the existing web service. Choose a plan deliberately: free databases have lifecycle/retention limits; check the current Render terms and arrange backups or an appropriate paid plan for lasting data.
2. In the existing **neon-notes** web service's Environment settings, set `DATABASE_URL` to the database's **Internal Database URL**. Never paste credentials into source code, GitHub issues or the README.
3. Generate and set `SESSION_SECRET` (32+ random characters), and set `NODE_ENV=production`.
4. Keep Build Command `npm ci`, Start Command `npm start`, and set Health Check Path `/health`.
5. Deploy the main branch. Startup applies the additive schema before serving pages. Verify registration, login, create/edit/delete and sign-out on HTTPS.

The pool honours PostgreSQL connection-string TLS options. For external providers, use the provider's verified TLS configuration; do not disable certificate verification. The supplied Render Internal Database URL uses Render's private network.

### Alternative: a separate preview deployment

`render.yaml` defines a **new** `neon-notes-auth` service and a new `neon-notes-db` database, with the connection string linked automatically and a generated session secret. Use **New → Blueprint** on Render and choose the main branch. This does not upgrade the existing neon-notes service automatically. Review proposed resources/plans before creating them. The blueprint requests free plans and may need adjustment for availability or account limits.


## Current hosting lifecycle

The free Render PostgreSQL database created for this deployment expires on **26 November 2026**. Upgrade it or export and migrate the database before expiry. No paid plan has been activated. Keep backups in private storage; never commit database dumps.

[Back to project overview](../README.md)
