# 22 — Critical E2E Flows and Authorization Regression

**What to build:** Playwright critical role flows against isolated real backend/PostgreSQL, not a mock-only release claim.

**PRD traceability:** Frontend PRD §§45, 46, 50, 52, 53, 54, 59, 67; §50 FR-FE-001, §50 FR-FE-002, §50 FR-FE-003, §50 FR-FE-007, §50 FR-FE-008, §50 FR-FE-009, §50 FR-FE-010, §50 FR-FE-011, §50 FR-FE-012, §50 FR-FE-013, §50 FR-FE-014, §50 FR-FE-015, §50 FR-FE-016, §50 FR-FE-017, §50 FR-FE-018, §50 FR-FE-019, §50 FR-FE-020, §50 FR-FE-021. Common NFR/definition-of-done obligations are in [README](../README.md).

**Blocked by:** [08 — Reconnect and Authoritative State Recovery](08-reconnect-and-state-recovery.md); [14 — CSV Preview, Import Confirmation, and Results](14-participant-csv-onboarding.md); [16 — Random and Manual Draw Control Safety](16-admin-random-and-manual-draws.md); [17 — Admin Claim Review and Adjudication](17-admin-claim-adjudication.md); [18 — Admin Winner History and Audit Views](18-admin-winners-and-audit.md); [19 — Super Admin Account Management](19-super-admin-account-management.md); [20 — System Health and Recovery Visibility](20-super-admin-system-and-recovery.md); [21 — Public Live Display and Winner Announcements](21-public-live-display.md)

**Backend prerequisite:** Existing backend security/E2E fixtures and owning services provide real game authority; change fixtures only if needed, not production rules.

**Branch:** `feature/tombola_frontend_critical_flow_and_authorization_e2e`

**Status:** ready-for-agent

## Scope and contracts

- **Backend:** Existing backend security/E2E fixtures and owning services provide real game authority; change fixtures only if needed, not production rules.
- **Frontend:** Playwright critical role flows against isolated real backend/PostgreSQL, not a mock-only release claim.
- **API/data:** Real REST/WS integration across participant, Admin, Super Admin and public channels. Inspect current serializers/schemas before coding; TypeScript server Dates serialize as JSON strings.
- Build deterministic resettable Event/Key/Question/Participant/Round fixtures through supported test setup, and run the PRD §67 login→Ticket→start→Draw→mark→Claim→verify→participant/display Winner→refresh/reconnect flow.
- Exercise logout/revocation, cross-participant/cross-Event access, private/public route leakage and rendering of untrusted text.
- Use separate browser contexts for roles and concurrency; cover duplicate interactions, simultaneous Claim decisions, offline periods and delayed responses.
- Document exact commands/fixtures and attach results. Contract-blocked acceptance criteria stay blocked rather than being skipped or mocked as passing.

## Non-goals

No production fixture backdoors, shared test database contamination, mock-only E2E claim, or fixes outside owned failing behavior.

## Acceptance criteria

- [ ] The complete release path passes with real persistence and WS, including participant refresh and display propagation.
- [ ] Denied access and concurrency checks preserve server authority and show truthful browser feedback.
- [ ] All failures and unresolved G01–G03 criteria remain visible release blockers; no disabled assertions count as evidence.
- [ ] Applicable loading, empty, error, permission, stale/reconnecting and pending states, accessible interaction, reduced motion and relevant responsive layouts satisfy the [common completion gate](../README.md#completion-gate).

## Required scenarios

List these as individual scenarios before implementation; each semicolon-separated case needs explicit verification.
- Full §67 flow; five supported Patterns through deterministic fixtures; no-win and rejected Claim paths.
- Refresh, network drop, resync, session revocation, different participant isolation and next Round.
- Concurrent Draw/verification interactions, wrong-role requests, future-data exposure, XSS-like content and no credential logs.
- Mock `lib/api` and IO for unit/component tests; use real backend/WS/PostgreSQL only in integration/E2E. Do not unit-test duplicated game rules.

## Verification

Run the focused feature tests first, then the [canonical frontend commands](../README.md#canonical-frontend-commands). Add real integration/E2E evidence for the API/WS behavior above. Tickets 22–25 also execute their stated cross-feature checks. Commands are planned until ticket 01 creates the frontend.

## Completion evidence

- [ ] Map every acceptance criterion/scenario to a test or recorded manual check, including actual command results and environment.
- [ ] Attach relevant REST/WS integration, responsive/accessibility and refresh/reconnect evidence; mark unavailable evidence pending.
- [ ] Resolve this ticket's contract blockers, verify prerequisites by code/PR state, and complete `/code-review` with no unresolved findings.
- [ ] Follow repository feature-branch/PR approval workflow; never infer merge readiness from this planning status.

