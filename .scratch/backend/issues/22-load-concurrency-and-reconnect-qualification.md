# 22 — Load, Concurrency, and Reconnect Qualification

**What to build:** A repeatable performance harness proves the single Bun/PostgreSQL deployment supports the target event without duplicate Draws, corrupt Winners, leaked data, or missed recovery.

**PRD traceability:** §§5, 30, 60–61; NFR-001–NFR-003, NFR-005.

**Blocked by:** 17 — Live Display; 18 — Recovery; 19 — Admin Operations; 20 — E2E; 21 — Security Suite.

**Branch:** `feature/tombola_backend_load_qualification`

**Status:** ready-for-agent

## Scope and contracts

- Bun layers: external load harness and invariant reporter only; production services are exercised through public HTTP/WebSocket contracts.
- Add `bun run test:load` with documented hardware/database assumptions, seeded fixture, warm-up, duration, concurrency, thresholds, and machine-readable report artifact.
- Simulate 500 authenticated Participants, ticket reads, live-state reads, simultaneous reconnects, host Draws, Marks, and competing Claims.
- Targets: read p50 <200 ms, p95 <500 ms, p99 <1 s; committed Draw propagation <1 s.
- Harness is test tooling only; no Redis, clustering, cache, or speculative production abstraction.

## Non-goals

- No internet-scale benchmark, distributed deployment, autoscaling, production traffic, Redis/cache introduction, or threshold waiver.

## Acceptance criteria

- [ ] Threshold failure exits nonzero and identifies endpoint/event percentiles and error rates.
- [ ] Invariants are checked after load: no duplicate/gapped Draws, cross-user data, lost Tickets, or excess Winners.
- [ ] Database pool saturation, memory, event-loop delay, and WebSocket connection count are captured.
- [ ] Results are reproducible enough to compare before the live event.

## Required scenarios

- 500 logins/ticket reads/current-state reads; 500 sockets; burst reconnect with REST recovery.
- Double-click and independent concurrent Draw commands; simultaneous final-slot Claims; mark bursts.
- Public Live Display reads/events under Participant load; email/import excluded from live-game baseline but measured separately.
- Graceful degradation at threshold and recovery after load stops.

## Verification

Run `cd backend && bun run test:load`, preserve the report path in the PR, then run canonical, E2E, and security suites.

```bash
cd backend && bun run test:load && bun run typecheck && bun run lint && bun test && bun run test:integration && bun run build && bun run test:e2e && bun run test:security
```

## Completion evidence

- [ ] PR attaches harness configuration, host/database assumptions, machine-readable results, and invariant report.
- [ ] Threshold, reconnect, Draw, Claim race, resource, and recovery evidence are attached.
- [ ] `/code-review` has no unresolved Standards or Spec findings.
