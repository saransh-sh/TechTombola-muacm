# 18 — Restart and Crash Recovery

**What to build:** After process loss, PostgreSQL remains authoritative, an interrupted active Round becomes `RECOVERY_REQUIRED`, and an Admin can resume only after a complete consistency validation.

**PRD traceability:** §§32, 36–37, 64; FR-018; NFR-001, NFR-006; critical invariants 5, 9–12.

**Blocked by:** 12 — Round Operation; 13 — Draws; 14 — Marks; 16 — Winners.

**Branch:** `feature/tombola_crash_recovery`

**Status:** ready-for-agent

## Scope and contracts

- Bun layers: startup/recovery route and schema -> recovery service -> pure consistency validator <- all game repositories, audit, and WebSocket boundaries.
- Startup transaction changes a previously ACTIVE Round to RECOVERY_REQUIRED and appends `RECOVERY_STARTED`; it never silently resumes.
- API: `POST /api/v1/admin/rounds/:id/recover`; Super Admin wildcard recovery commands are limited to documented diagnostics/repair authorization, not arbitrary state rewriting.
- Validator checks continuous Draw sequences, immutable Ticket shape, Mark ownership/drawn status, Claim/Winner consistency, Pattern capacity/closure, and global active-Round exclusivity directly from PostgreSQL.
- Successful confirmation moves RECOVERY_REQUIRED to ACTIVE, records `RECOVERY_COMPLETED`, then broadcasts `ROUND_RESUMED`. No game cache is rebuilt.
- Frontend: none; publishes recovery status/error details safe for administrators.

## Non-goals

- No in-memory game cache, automatic resume, arbitrary database repair, history rewrite, backup implementation, or disaster-recovery orchestration.

## Acceptance criteria

- [ ] A fresh app instance over existing data detects interruption deterministically.
- [ ] Any failed consistency check leaves the Round in RECOVERY_REQUIRED with an actionable safe error.
- [ ] Completed/cancelled Rounds cannot be recovered; duplicate recovery is idempotent.
- [ ] Recovery never repeats a Draw, reopens a closed Pattern, or removes history.

## Required scenarios

- Cold start with no/ACTIVE/PAUSED/RECOVERY_REQUIRED/COMPLETED Round; repeated starts.
- Gap/duplicate Draw sequence, malformed Ticket, invalid Mark, winner-capacity mismatch, conflicting active Round.
- Admin/Super Admin authorization matrix, repeated/concurrent recovery state handling, rollback/audit failure.
- Resume broadcast after commit, socket registry empty on restart, next Draw sequence correct.

## Verification

Run cold-start tests using a second app instance, corruption fixtures, concurrency/idempotency tests, then every canonical backend command.

```bash
cd backend && bun run typecheck && bun run lint && bun test && bun run test:integration && bun run build
```

## Completion evidence

- [ ] PR includes recovery request/result/error examples and maps every scenario to a test.
- [ ] Second-instance, corruption, concurrency, next-sequence, audit, and post-commit broadcast evidence are attached.
- [ ] `/code-review` has no unresolved Standards or Spec findings.
