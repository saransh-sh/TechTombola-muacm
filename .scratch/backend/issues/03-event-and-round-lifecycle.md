# 03 — Event and Round Lifecycle State Machine

**What to build:** Pure domain state machines and admin management endpoints for Events (`DRAFT → READY → LIVE → COMPLETED / PAUSED / CANCELLED`) and Rounds (`DRAFT → READY → ACTIVE → COMPLETED / PAUSED / RECOVERY_REQUIRED`), enforcing that only one round may be active per event at any time.

**Blocked by:** 02 — Authentication and Role-Based Authorization

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Event domain model and state machine enforces valid transitions: `DRAFT → READY → LIVE → COMPLETED`, `LIVE ↔ PAUSED`, `DRAFT/READY/PAUSED → CANCELLED`.
- [ ] Round domain model and state machine enforces valid transitions: `DRAFT → READY → ACTIVE → COMPLETED`, `ACTIVE ↔ PAUSED`, `PAUSED/ACTIVE → RECOVERY_REQUIRED → ACTIVE`.
- [ ] State transition rejects invalid paths (e.g. `COMPLETED → ACTIVE` or starting a round when another round in the event is already `ACTIVE`) with HTTP 409 or HTTP 422.
- [ ] Admin REST endpoints created and protected by Admin role:
  - `POST /api/v1/admin/events` (create event)
  - `GET /api/v1/admin/events` & `PATCH /api/v1/admin/events/:id` (list/update event)
  - `POST /api/v1/admin/rounds` (create round linked to event)
  - `GET /api/v1/admin/rounds` & `PATCH /api/v1/admin/rounds/:id` (list/update round)
  - `POST /api/v1/admin/rounds/:id/start` (transition to `ACTIVE`)
  - `POST /api/v1/admin/rounds/:id/pause` (transition to `PAUSED`)
  - `POST /api/v1/admin/rounds/:id/resume` (transition from `PAUSED` to `ACTIVE`)
- [ ] Participant read-only endpoints:
  - `GET /api/v1/participant/event` (current live event metadata)
  - `GET /api/v1/participant/round/current` (current active or paused round status)
- [ ] Pure unit tests cover every valid and invalid state transition for Event and Round state machines.
- [ ] Integration tests verify round start, pause, resume endpoints, single-active-round constraint enforcement, and role access restrictions.
