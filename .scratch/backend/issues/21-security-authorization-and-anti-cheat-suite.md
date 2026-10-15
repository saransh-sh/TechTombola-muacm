> **SUPERSEDED — 15 October 2026.** Historical v1 ticket. Do not implement unchanged; use [Backend PRD v2](../../../docs/TECH_TOMBOLA_BACKEND_PRD.md) and [ADR 0006](../../../docs/adr/0006-simple-room-game-and-batch-reveals.md).

# 21 — Security, Authorization, and Anti-Cheat Suite

**What to build:** A dedicated adversarial suite proves every role, ownership, secret-handling, and future-information boundary across the completed API and WebSocket surface.

**PRD traceability:** §§39–47, 58; NFR-004; critical invariants 13–15.

**Blocked by:** 04–19 — complete protected/public API surface.

**Branch:** `feature/tombola_backend_security_tests`

**Status:** superseded

## Scope and contracts

- Bun layers: adversarial black-box test harness plus route-inventory assertion; no production authorization path is duplicated in tests.
- Add `bun run test:security`; tests exercise HTTP, WebSocket, database/log sinks, and serializer allowlists without introducing a new security framework.
- Generate the authorization matrix from route inventory so every protected route has unauthenticated, wrong-role, wrong-owner, and wrong-Event coverage.
- Probe participant/public responses for future Keys, unpublished Questions, hashes, tokens, emails, stack traces, SQL details, and audit metadata.
- Frontend: none.

## Non-goals

- No penetration-test certification, external scanner platform, WAF, OAuth, production secret access, or speculative security framework.

## Acceptance criteria

- [ ] Every public/protected route and WebSocket channel appears in the matrix exactly once.
- [ ] Object-ID substitution cannot reveal whether another Participant's resource exists.
- [ ] Cookie flags, Origin enforcement, session revocation, throttling, and payload bounds are asserted.
- [ ] Secret scans cover database fixtures, application logs, audit metadata, email jobs, and idempotency outcomes.

## Required scenarios

- Participant/Admin/Super Admin/public matrix; inactive/deleted identities; expired/revoked Session.
- Cross-Participant and cross-Event IDs for Tickets, Cells, Claims, Winners, Draws, and profiles.
- Future-Key leakage through REST, WS, errors, pagination, and malformed requests.
- Injection-shaped inputs, oversized bodies/CSV/WS frames, rate limits, stack/SQL redaction, password/token scan.

## Verification

Run `cd backend && bun run test:security`, inspect the generated route-coverage report, then every canonical backend command and E2E suite.

```bash
cd backend && bun run test:security && bun run typecheck && bun run lint && bun test && bun run test:integration && bun run build && bun run test:e2e
```

## Completion evidence

- [ ] PR attaches the complete route/channel matrix and maps every adversarial scenario to a test.
- [ ] Ownership, future-Key leakage, cookie/session, bounds, and secret-scan reports are attached.
- [ ] `/code-review` has no unresolved Standards or Spec findings.
