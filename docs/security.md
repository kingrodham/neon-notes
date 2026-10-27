# Security and scope

## Implemented protections

- Salted scrypt password hashes and constant-time hash comparison.
- PostgreSQL-backed sessions, a fresh session after login and session destruction at logout.
- HttpOnly and SameSite=Lax cookies; production account pages require HTTPS.
- CSRF tokens on forms that change data.
- Parameterised database queries and ownership checks on every post lookup, edit and deletion.
- Server-side validation, request-size limits and escaped EJS output.
- Security headers and per-process authentication rate limiting.
- The deployed database accepts private Render network traffic; public inbound access is blocked.

These are safeguards, not a claim of an independent security audit. See the integration tests for behaviour that has been verified.

## Limitations

Existing in-memory demo posts were temporary and cannot be migrated after their server restarts. New posts belong to the account that creates them. This version has no public post feed, password recovery, email verification or account-deletion UI. Database-backed sessions survive restarts while valid; changing SESSION_SECRET invalidates old signed cookies. Site operators with database access can read posts: private access is not end-to-end encryption.

Authentication throttling currently uses per-process memory, appropriate for a single instance. A multi-instance deployment should use a shared limiter store. Back up PostgreSQL and test restores before relying on it for important content. A future upgrade can add account recovery and publishing controls.

GitHub hosts the source. The Express application needs a Node.js host and PostgreSQL; GitHub Pages alone cannot run it.


[Back to project overview](../README.md)
