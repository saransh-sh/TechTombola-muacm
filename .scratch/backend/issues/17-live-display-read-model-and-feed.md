# 17 — Live Display Read Model and Feed

**What to build:** A public Live Display can recover and follow current Event, Round, Draw, and verified Winner state without gaining any Participant/Admin privilege or future information.

**PRD traceability:** §§33–34, 38, 45–47, 60; FR-017; NFR-002, NFR-004.

**Blocked by:** 05 — Events; 11 — Real-Time Transport; 12 — Round Operation; 13 — Draws; 16 — Winners.

**Branch:** `feature/tombola_live_display_api`

**Status:** ready-for-agent

## Scope and contracts

- Bun layers: public Live routes/serializers -> read service <- Event/Round/Draw/Winner repositories plus public WebSocket adapter; no game domain mutation.
- API: `GET /api/v1/live/event|round|draws|winners`; `/api/v1/live/ws` from ticket 11 supplies matching safe updates.
- Explicit response allowlists expose public display names and stable public IDs only; never emails, Session data, unverified Claims, future Questions/Keys, or internal audit metadata.
- Draws are chronological; Winners group by Pattern and include only VERIFIED records. Empty/no-live state has a documented `200` nullable payload rather than accidental 404 differences.
- Indexed repository reads target PRD p50/p95/p99 thresholds; performance qualification belongs to ticket 22.
- Frontend: none; these are the complete Live Display contracts.

## Non-goals

- No Live Display authentication/privilege, mutation, unverified Claim visibility, theme system, cache layer, or future content.

## Acceptance criteria

- [ ] REST recovery and public events represent the same committed state.
- [ ] ACTIVE, PAUSED, RECOVERY_REQUIRED, COMPLETED, and no-live states serialize explicitly.
- [ ] Cross-Event data cannot enter current-state responses.
- [ ] A strict serializer fails tests when a sensitive field is added upstream.

## Required scenarios

- No Event/Round, each lifecycle state, zero/one/many Draws and Winners, deterministic ordering/grouping.
- Unverified/rejected Claim excluded; undrawn Question/Key excluded; email/internal ID/audit fields excluded.
- State changes after start/draw/verify/complete reflected in REST and public event; reconnect REST convergence.
- 500 concurrent read smoke fixture with correct indexes and query-count assertions.

## Verification

Run serializer leak tests, lifecycle fixtures, REST/WS convergence integration tests, query-plan checks, then every canonical backend command.

```bash
cd backend && bun run typecheck && bun run lint && bun test && bun run test:integration && bun run build
```

## Completion evidence

- [ ] PR includes each public DTO/null state/event example and maps every scenario to a test.
- [ ] Field-allowlist, cross-Event, query-plan, concurrency, and REST/WS convergence evidence are attached.
- [ ] `/code-review` has no unresolved Standards or Spec findings.
