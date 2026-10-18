# 13 — Admin Participant Management

**What to build:** /admin/participants: scoped list/detail, create/edit, search/status filters and assignment context.

**PRD traceability:** Frontend PRD §§5, 9, 25, 30, 32, 45, 48; §50 FR-FE-015. Common NFR/definition-of-done obligations are in [README](../README.md).

**Blocked by:** [10 — Admin Event Configuration and Lifecycle](10-admin-event-management.md)

**Backend prerequisite:** Backend tickets 08 and 10: Participant CRUD/read and Admin Ticket listing; G03 resolves complete ticket/import-status presentation.

**Branch:** `feature/tombola_frontend_admin_participant_management`

**Status:** needs-info

**Contract blockers:** [G03](../CONTRACT_GAPS.md#g03). This ticket remains `needs-info` until resolved; specified subparts may be developed without claiming full completion.

## Scope and contracts

- **Backend:** Backend tickets 08 and 10: Participant CRUD/read and Admin Ticket listing; G03 resolves complete ticket/import-status presentation.
- **Frontend:** /admin/participants: scoped list/detail, create/edit, search/status filters and assignment context.
- **API/data:** GET/POST /api/v1/admin/participants; GET/PATCH /api/v1/admin/participants/:id; existing Admin Round Ticket listing if justified by G03. Inspect current serializers/schemas before coding; TypeScript server Dates serialize as JSON strings.
- Use server pagination/search/status filters with Event scope; render identity, active status and returned credential-delivery status without exposing passwords.
- Create assignment through the supported create schema. Event reassignment is not an editable PATCH capability unless the backend contract explicitly permits it.
- G03 must distinguish current Ticket identifier, credential-delivery state and import history. Evaluate existing Admin Ticket reads before proposing any backend extension; never show 'unallocated' merely because a joined page was not loaded.
- Confirm deactivation and re-read results when sessions become revoked; preserve privacy in errors and diagnostics.

## Non-goals

No password viewer/reset feature, invented Participant reassignment, unrestricted list download, or client-owned Ticket allocation.

## Acceptance criteria

- [ ] Admin can manage allowed fields and search/filter Participants across the server dataset.
- [ ] Cross-Event data and passwords cannot appear in list/detail/cache/logs.
- [ ] Ticket identifier and import-related states satisfy resolved G03 semantics or remain explicit blockers.
- [ ] Applicable loading, empty, error, permission, stale/reconnecting and pending states, accessible interaction, reduced motion and relevant responsive layouts satisfy the [common completion gate](../README.md#completion-gate).

## Required scenarios

List these as individual scenarios before implementation; each semicolon-separated case needs explicit verification.
- Create/update/activate/deactivate; duplicate email; malformed input; forbidden reassignment.
- Server search/status combinations; empty result; pagination changes while editing; Event switch.
- Ticket data absent versus not loaded; delivery failure; permission errors and safe diagnostics.
- Mock `lib/api` and IO for unit/component tests; use real backend/WS/PostgreSQL only in integration/E2E. Do not unit-test duplicated game rules.

## Verification

Run the focused feature tests first, then the [canonical frontend commands](../README.md#canonical-frontend-commands). Add real integration/E2E evidence for the API/WS behavior above. Tickets 22–25 also execute their stated cross-feature checks. Commands are planned until ticket 01 creates the frontend.

## Completion evidence

- [ ] Map every acceptance criterion/scenario to a test or recorded manual check, including actual command results and environment.
- [ ] Attach relevant REST/WS integration, responsive/accessibility and refresh/reconnect evidence; mark unavailable evidence pending.
- [ ] Resolve this ticket's contract blockers, verify prerequisites by code/PR state, and complete `/code-review` with no unresolved findings.
- [ ] Follow repository feature-branch/PR approval workflow; never infer merge readiness from this planning status.

