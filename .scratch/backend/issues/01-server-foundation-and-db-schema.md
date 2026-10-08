# 01 — Server Foundation, Database Schema, and Environment Configuration

**What to build:** The foundational Bun + Fastify modular monolith server with PostgreSQL connection, Drizzle ORM configuration, environment variable validation, standardized error handling, and health check endpoints.

**Blocked by:** None — can start immediately.

**Status:** completed

## APIs to Implement

### 1. `GET /health` (Liveness Probe)
- **Auth:** None (Public)
- **Purpose:** Verifies that the Fastify process is running and responsive.
- **Success Response (`200 OK`):**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-08T22:56:00.000Z"
  }
  ```

### 2. `GET /ready` (Readiness Probe)
- **Auth:** None (Public)
- **Purpose:** Verifies that the server and backing database connection pool are healthy and ready to accept traffic.
- **Success Response (`200 OK`):**
  ```json
  {
    "status": "ready",
    "database": "connected"
  }
  ```
- **Failure Response (`503 Service Unavailable`):**
  ```json
  {
    "status": "not_ready",
    "database": "disconnected"
  }
  ```

### 3. API Routing Prefix & Standard Error Contract
- **Base Routing:** Root application configured with `/api/v1` route prefix namespace for future feature modules.
- **Request Tracking:** Generates or honors `X-Request-Id` on all incoming requests and attaches it to response headers and error bodies.
- **Standard Error Envelope:** Every API error (4xx/5xx) emitted by the system conforms to:
  ```json
  {
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human-readable explanation of error."
    },
    "requestId": "req_abc123"
  }
  ```

## Acceptance Criteria

- [x] Bun (v1.x) runtime initialized with Fastify server configured with CORS (`@fastify/cors`), sensible timeouts, request ID generation, and JSON parsing.
- [x] Zod environment schema parses and strictly validates required environment variables (`PORT`, `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `LOG_LEVEL`, `CORS_ORIGIN`).
- [x] PostgreSQL connection pool initialized via `postgres` (postgres.js) with Drizzle ORM configuration and automated migration execution on startup.
- [x] Base database schema defined for core entities: `users`, `events`, `rounds`, `keys`, `questions`, `tickets`, `ticket_cells`, `draws`, `winning_patterns`, `win_claims`, `winners`, `audit_logs`.
- [x] Standardized API error handler transforms all domain, validation (Zod), and unhandled errors into the contract: `{ "error": { "code": string, "message": string }, "requestId": string }`.
- [x] `GET /health` and `GET /ready` endpoints implemented and return expected response payloads and status codes.
- [x] Base application router mounted under `/api/v1`.
- [x] Pure unit tests pass for environment validation, error transformer, and health endpoints via `app.inject()`.
- [x] Integration test passes verifying Fastify starts, handles ping/health, and queries PostgreSQL.
