# 09 — Participant Ticket Marking and Validation

**What to build:** Server-side ticket cell mark and unmark endpoints, strictly validating that marked cells exist on the participant's assigned ticket and that the corresponding key has already been drawn in the active round.

**Blocked by:** 08 — Server-Authoritative Draw Engine with Live Broadcast

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Mark domain logic and state persistence:
  - Participants can manually mark or unmark cells on their assigned ticket.
  - Server verifies that the cell ID belongs to the participant's ticket for the current active round.
  - Server verifies that the cell holds a valid key.
  - **Critical Invariant:** A participant cannot mark an undrawn key. The cell's key must exist in the round's official `draws` history table. If not drawn, request is rejected with HTTP 422 Unprocessable Entity (`KEY_NOT_DRAWN`).
- [ ] Endpoints created with participant JWT auth:
  - `POST /api/v1/participant/tickets/:ticketId/marks` (body: `{ cellId }`) marks the cell and records `marked_at` timestamp.
  - `DELETE /api/v1/participant/tickets/:ticketId/marks/:cellId` removes mark from the cell.
- [ ] Idempotency: marking an already-marked cell returns `200 OK` without error.
- [ ] Participant isolation: an attempt to mark another participant's ticket returns HTTP 403 Forbidden.
- [ ] Round state enforcement: marks are rejected if the round is `PAUSED` or `COMPLETED`.
- [ ] Pure unit tests verify validation rules: drawn key allowed, undrawn key rejected, empty cell rejected, wrong ticket rejected.
- [ ] Integration tests verify database persistence of marks, 422 error on unrevealed keys, and isolation between different participants.
