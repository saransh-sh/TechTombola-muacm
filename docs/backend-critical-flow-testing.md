# Backend critical-flow verification

`bun run test:e2e` starts the compiled backend and talks to it through real HTTP and WebSocket connections. It uses a local fake HTTP email provider and creates a randomly named PostgreSQL database for each run. The harness applies migrations to that database and drops it during teardown.

Set `E2E_DATABASE_URL` to a PostgreSQL server URL whose user may create and drop databases. The URL must identify an existing maintenance database, such as `postgres`. Do not point it at an application database. The test does not seed application records directly; bootstrap, authentication, configuration, Participants, Tickets, Draws, Marks, Claims, and Winners use public APIs.

The bootstrap route is `POST /api/v1/auth/bootstrap-super-admin`. It requires `SUPER_ADMIN_BOOTSTRAP_SECRET` (at least 32 characters) in the `x-bootstrap-secret` header and accepts `email`, `name`, and a caller-chosen initial `password`. It is unavailable when the secret is unset and permanently closes after any Super Admin profile exists. Configure the secret only for initial provisioning, then remove it from the running service configuration.

The email adapter posts JSON to `EMAIL_PROVIDER_URL` with a Bearer `EMAIL_PROVIDER_API_KEY`. Its JSON body contains `from`, `to`, `subject`, and `text`; any 2xx response means accepted. Requests time out after five seconds. Provider response bodies and transport errors are not returned to API callers.

Run the suite twice, then the backend checks:

```sh
bun run build && bun run test:e2e
bun run build && bun run test:e2e
bun run typecheck
bun run lint
bun run test
bun run test:integration
```
