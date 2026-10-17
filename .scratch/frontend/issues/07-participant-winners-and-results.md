# 07 — Participant Winners and Results

**What to build:** WinnerBanner, persistent verified Pattern/result state, /participant/results.

**PRD traceability:** Frontend PRD §§15, 19, 28, 49, 53, 58, 62, 63; §50 FR-FE-011. Common NFR/definition-of-done obligations are in [README](../README.md).

**Blocked by:** [06 — Participant Claim Submission and Status](06-participant-claims-and-status.md)

**Backend prerequisite:** Backend ticket 16: Winner REST/WS currently exposes Pattern but no contributing cell IDs. Exact cell highlighting requires G01 resolution.

**Branch:** `feature/tombola_frontend_participant_winners_and_results`

**Status:** needs-info

**Contract blockers:** [G01](../CONTRACT_GAPS.md#g01). This ticket remains `needs-info` until resolved; specified subparts may be developed without claiming full completion.

## Scope and contracts

- **Backend:** Backend ticket 16: Winner REST/WS currently exposes Pattern but no contributing cell IDs. Exact cell highlighting requires G01 resolution.
- **Frontend:** WinnerBanner, persistent verified Pattern/result state, /participant/results.
- **API/data:** GET /api/v1/participant/wins; GET /api/v1/participant/claims; WINNER_VERIFIED and ROUND_COMPLETED events. Inspect current serializers/schemas before coding; TypeScript server Dates serialize as JSON strings.
- Use safe Winner events to refresh participant-specific wins; an event with only display name/Pattern does not establish that the current participant won.
- Keep verified Winner and Round result visible through refresh until authoritative scope changes. Distinguish own win, others' public win, pending Claim, rejection, and Round completion.
- Use controlled GSAP celebration with reduced-motion alternative and cleanup; do not block Ticket access.
- G01 blocks completion of exact winning-cell highlighting. Consume approved server-provided cell evidence once available; never recreate Early 5/line/Full House evaluation in React.

## Non-goals

No inferred winner identity, client Pattern evaluation, fabricated contributing cells, or extended celebration feature.

## Acceptance criteria

- [ ] Winner/Pattern identity is server-confirmed and persists across refresh/reconnect; display-name collisions cannot award the local participant a win.
- [ ] Completed/cancelled Round routes render truthful final state and no new mutation affordance.
- [ ] Relevant winning cells are highlighted only using the resolved G01 contract; partial generic Winner UI does not satisfy the whole ticket.
- [ ] Applicable loading, empty, error, permission, stale/reconnecting and pending states, accessible interaction, reduced motion and relevant responsive layouts satisfy the [common completion gate](../README.md#completion-gate).

## Required scenarios

List these as individual scenarios before implementation; each semicolon-separated case needs explicit verification.
- Own/other/no Winner; duplicate winner names; multiple Patterns; capacity reached; pending/rejected Claim.
- Winner event before/after REST; duplicate events; Round completion during animation; refresh and next Round.
- Approved winning-cell evidence including Early 5 ambiguity; missing evidence; reduced motion and unmount.
- Mock `lib/api` and IO for unit/component tests; use real backend/WS/PostgreSQL only in integration/E2E. Do not unit-test duplicated game rules.

## Verification

Run the focused feature tests first, then the [canonical frontend commands](../README.md#canonical-frontend-commands). Add real integration/E2E evidence for the API/WS behavior above. Tickets 22–25 also execute their stated cross-feature checks. Commands are planned until ticket 01 creates the frontend.

## Completion evidence

- [ ] Map every acceptance criterion/scenario to a test or recorded manual check, including actual command results and environment.
- [ ] Attach relevant REST/WS integration, responsive/accessibility and refresh/reconnect evidence; mark unavailable evidence pending.
- [ ] Resolve this ticket's contract blockers, verify prerequisites by code/PR state, and complete `/code-review` with no unresolved findings.
- [ ] Follow repository feature-branch/PR approval workflow; never infer merge readiness from this planning status.

