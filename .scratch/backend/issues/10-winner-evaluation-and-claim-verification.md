# 10 — Winner Evaluation Engine and Claim Verification

**What to build:** Server-side winner evaluation engine for the 5 Tombola patterns (Early 5, Top Line, Middle Line, Bottom Line, Full House), participant claim submission, admin claim review/verification, race-condition mitigation, and pattern closure.

**Blocked by:** 09 — Participant Ticket Marking and Validation

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Pure domain winner evaluator (`winner.domain.ts`):
  - `EARLY_5`: Exactly 5 valid drawn keys marked anywhere on the ticket.
  - `TOP_LINE`: All 5 populated cells in Row 1 marked with valid drawn keys.
  - `MIDDLE_LINE`: All 5 populated cells in Row 2 marked with valid drawn keys.
  - `BOTTOM_LINE`: All 5 populated cells in Row 3 marked with valid drawn keys.
  - `FULL_HOUSE`: All 15 populated cells across the entire ticket marked with valid drawn keys.
  - Rejects incomplete lines, invalid marks, or claims referencing undrawn keys.
- [ ] Claim submission service & endpoint:
  - `POST /api/v1/participant/claims` (body: `{ roundId, pattern }`).
  - Verifies round is `ACTIVE` and pattern is not already closed.
  - Re-evaluates ticket cells against official draw history server-side.
  - Rejects ineligible claim immediately (HTTP 422).
  - Persists valid claim with status `PENDING_VERIFICATION` into `win_claims` table.
  - Broadcasts `WIN_CLAIM_CREATED` over WebSocket to admin connections.
- [ ] Admin claim review and winner verification:
  - `GET /api/v1/admin/claims` (list pending and historical claims).
  - `POST /api/v1/admin/claims/:id/verify` verifies claim inside an atomic PostgreSQL transaction.
  - Locks winning pattern row (`SELECT FOR UPDATE`). If pattern has reached maximum allowed winners (e.g. 1 per pattern), updates pattern to `CLOSED`.
  - Rejects competing concurrent claims with `REJECTED_PATTERN_ALREADY_CLOSED` (HTTP 409).
  - Records winner in `winners` table (`round_id`, `participant_id`, `pattern`, `verified_at`).
  - Broadcasts `WINNER_VERIFIED` event to all connected clients.
  - `POST /api/v1/admin/claims/:id/reject` updates claim status to `REJECTED`.
  - `GET /api/v1/participant/claims` and `GET /api/v1/participant/wins` return participant claim and win history.
- [ ] Pure unit tests verify every pattern evaluator (Early 5, Top/Middle/Bottom Line, Full House) with truth tables and edge cases.
- [ ] Integration tests simulate concurrent claims for the same pattern, verifying that only the winning quota is accepted and subsequent claims are rejected without data corruption.
