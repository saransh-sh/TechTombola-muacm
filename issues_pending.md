# Ticket 21 — Pending Work

Branch: `feature/anushka/backend_security_tests_ticket_21`

Stacked on: Ticket 20, `feature/anushka/critical_flow_end_to_end_verification_ticket_20`

## Implemented on this branch

- Added a runtime HTTP and WebSocket route inventory with role and scope rationale.
- Added generated checks that every protected route rejects unauthenticated callers and wrong-role sessions.
- Added a regression test ensuring rejected mutation Origins are not reflected in error messages.
- Set an explicit 64 KiB inbound WebSocket frame limit.
- Added `bun run test:security` and wired it into the backend workflow.

## Pending Ticket 21 coverage

- Generate and execute wrong-Participant and wrong-Event requests for every Participant Event-scoped route, including profile, Round, Ticket, Cell, Draw, Claim, Winner, and WebSocket subscription boundaries.
- Add adversarial response and WebSocket scans proving future Keys and unpublished Questions are not exposed.
- Scan database fixtures, application logs, audit metadata, and idempotency outcomes for password hashes, tokens, SQL details, stack traces, and other secrets.
- Complete the remaining security matrix cases for inactive/deleted identities, expired/revoked sessions, cookie flags, Origin enforcement, throttling, injection-shaped inputs, malformed requests, and oversized JSON/CSV/WebSocket payloads.
- Add positive allowed-role assertions to the generated matrix, including Super Admin access to Admin operations.
- Run the complete backend unit, integration, and E2E suites and attach their results.
- Complete the Issue 21 code/spec review after the full security coverage is implemented.

## Verification status at push time

- `bun run test:security`: passed, 7 tests and 246 assertions.
- `bun run typecheck`: passed.
- `bun run build`: passed.
- Full `bun run test`: did not exit cleanly; no final suite summary was available, so it is not recorded as passed.
- Database integration and E2E suites were not run because PostgreSQL was unavailable on port 5433 in the implementation environment.

## Upstream limitations

- No specific code blocker from Tickets 04–20 was confirmed during the Ticket 21 inspection.
- The schema has no durable email-job table, so scanning persisted email jobs is not applicable to the current model. Ticket 20's fake-provider boundary is the available email evidence.
- The focused security tests do not replace the missing database-backed ownership and secret-scan scenarios listed above.
