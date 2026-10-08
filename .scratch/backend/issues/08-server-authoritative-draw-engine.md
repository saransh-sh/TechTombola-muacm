# 08 — Server-Authoritative Draw Engine with Live Broadcast

**What to build:** Server-authoritative random and manual draw engine that selects unused question-key pairs, persists draw records with continuous sequence numbers in database transactions, and broadcasts `DRAW_CREATED` real-time events.

**Blocked by:** 06 — Ticket Generation and Zero-Knowledge Allocation, 07 — Native Real-Time WebSocket Transport

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Draw domain logic (`draw.domain.ts`):
  - Validates that the target round is strictly `ACTIVE`.
  - Filters available questions to exclude already drawn questions in that round.
  - Randomly selects an undrawn question (or validates specified manual question).
  - Resolves the chosen question to its canonical key.
  - Enforces invariant: a question cannot be drawn more than once within the same round.
- [ ] Draw persistence and concurrency control:
  - Executes draw creation inside a PostgreSQL transaction (`SELECT FOR UPDATE` on round state/draw sequence).
  - Assigns strictly continuous sequence numbers (`1, 2, 3...`) per round.
  - Persists record into `draws` table (`round_id`, `question_id`, `key_id`, `sequence_number`, `drawn_at`).
  - Concurrent draw requests from multiple admins are serialized or deduplicated (returns HTTP 409 for conflicts).
- [ ] Real-time event broadcast:
  - Broadcasts `DRAW_CREATED` payload (`roundId`, `sequence`, `key`, `question`, `drawnAt`) to all active WebSocket clients within <100ms.
- [ ] REST API endpoints:
  - `POST /api/v1/admin/rounds/:id/draws` (trigger random draw)
  - `POST /api/v1/admin/rounds/:id/draws/manual` (trigger manual draw of specified question)
  - `GET /api/v1/admin/rounds/:id/draws` (authoritative draw history for admin)
  - `GET /api/v1/participant/draws` (participant authoritative draw history for sync/recovery)
- [ ] Pure unit tests verify random selection over remaining pool, sequence incrementing, and duplicate draw prevention.
- [ ] Integration tests verify atomic transaction concurrency, WebSocket broadcast trigger upon draw, and error handling when round pool is exhausted.
