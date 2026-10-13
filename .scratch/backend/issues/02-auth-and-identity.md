# 02 — Authentication and Role-Based Authorization

**What to build:** User entity persistence, Argon2id password hashing, JWT session token generation, role verification middleware (`SUPER_ADMIN`, `ADMIN`, `PARTICIPANT`), rate-limited login, and session endpoints.

**Blocked by:** 01 — Server Foundation, Database Schema, and Environment Configuration

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Password hashing utility implemented using Argon2id with strict non-storage of plaintext credentials.
- [ ] User repository and service created with support for `users` table and roles: `SUPER_ADMIN`, `ADMIN`, `PARTICIPANT`.
- [ ] `POST /api/v1/auth/login` endpoint validates credentials, updates user `last_login_at`, and returns a signed JWT access token along with user profile metadata.
- [ ] Rate limiting middleware blocks brute-force login attempts (rejecting with HTTP 429 after 5 failed attempts within 1 minute per IP/identifier).
- [ ] Authentication middleware verifies JWT tokens on incoming protected requests and attaches authenticated user context.
- [ ] Role authorization guard (`requireRole(['ADMIN', 'SUPER_ADMIN'])`) rejects unauthorized access with HTTP 403.
- [ ] `POST /api/v1/auth/logout` and `GET /api/v1/me` return authenticated identity state and revoke or invalidate active sessions.
- [ ] Unit tests verify Argon2id hash creation and validation, token signing/expiration, and role guard decisions.
- [ ] Integration tests verify successful login, invalid password failure, rate limit triggering, and unauthorized role rejection.
