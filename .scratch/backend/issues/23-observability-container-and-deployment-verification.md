> **SUPERSEDED — 15 October 2026.** Historical v1 ticket. Do not implement unchanged; use [Backend PRD v2](../../../docs/TECH_TOMBOLA_BACKEND_PRD.md) and [ADR 0006](../../../docs/adr/0006-simple-room-game-and-batch-reveals.md).

# 23 — Observability, Container, and Deployment Verification

**What to build:** A production container and lightweight operational signals make the qualified backend deployable and diagnosable within the single-instance AWS cost envelope.

**PRD traceability:** §§8–9, 63, 65–66, 73–75; NFR-001, NFR-008–NFR-010.

**Blocked by:** 19 — Operations; 21 — Security Suite; 22 — Load Qualification.

**Branch:** `feature/tombola_backend_deployment`

**Status:** superseded

## Scope and contracts

- Bun layers: application composition/logging and deployment artifacts; domain/services expose no infrastructure-specific behavior.
- Production multi-stage container runs the built Bun service as non-root, exposes health/readiness, handles SIGTERM, and contains no development secrets or test data.
- Structured logs include request ID, safe actor/resource identifiers, latency, status, database errors, auth failures, game actions, WS counts, and recovery state; never credentials/tokens/Questions not yet drawn.
- Document environment variables, migration release step, readiness rollout behavior, single-process capacity assumptions, and rollback procedure.
- Add `bun run verify:container` and a deployment smoke command against a disposable environment.
- Frontend: none.

## Non-goals

- No Kubernetes, microservices, broker, multi-instance coordination, vendor-locked application logic, or full observability platform.

## Acceptance criteria

- [ ] Image builds reproducibly, passes vulnerability/config checks available in the project, and starts with read-only runtime filesystem except declared temp paths.
- [ ] `/ready` fails during unavailable database/migration mismatch and succeeds only when traffic is safe.
- [ ] Logs and metrics diagnose Draw/Claim/recovery failures without leaking protected data.
- [ ] Deployment plan remains one Bun process + PostgreSQL with no broker or infrastructure-specific application logic.

## Required scenarios

- Clean start/migration, missing config, database unavailable/restored, SIGTERM during idle and in-flight request.
- Health/readiness container probes, non-root/file permissions, image secret scan.
- Structured success/error/auth/game logs and redaction; WS connection count; request latency.
- Deploy/smoke/rollback rehearsal using documented commands.

## Verification

Run `cd backend && bun run verify:container`, deployment smoke/rollback rehearsal, then canonical, E2E, security, and load suites.

```bash
cd backend && bun run verify:container && bun run typecheck && bun run lint && bun test && bun run test:integration && bun run build && bun run test:e2e && bun run test:security && bun run test:load
```

## Completion evidence

- [ ] PR attaches image metadata/scan, probe, shutdown, migration, smoke, and rollback output.
- [ ] Log/metric redaction and AWS cost-envelope assumptions are documented.
- [ ] `/code-review` has no unresolved Standards or Spec findings.
