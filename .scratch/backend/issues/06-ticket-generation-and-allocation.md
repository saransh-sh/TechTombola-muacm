# 06 — Ticket Generation and Zero-Knowledge Allocation

**What to build:** Server-authoritative Tombola ticket generator creating valid 3×9 cards with exactly 15 populated cells (5 per row) with no duplicate keys, immutable database persistence, and secure participant ticket retrieval.

**Blocked by:** 04 — Question and Key Bank Management, 05 — Participant Management, Bulk Import, and Credential Delivery

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Pure domain ticket generation engine (`ticket.domain.ts`):
  - Generates a 3-row by 9-column grid (27 total cells).
  - Populates exactly 15 cells with unique keys selected from the round's key pool (exactly 5 keys per row).
  - Remaining 12 cells are marked empty (`null` key).
  - Enforces zero duplicate keys within the same ticket card.
  - Distributes keys across columns following traditional Tombola column sorting conventions where applicable.
- [ ] Ticket allocation service and repository:
  - Generates tickets in batch for all active participants in a round.
  - Ensures a participant has exactly one assigned ticket per round.
  - Persists tickets and ticket cells immutably in PostgreSQL (`tickets` and `ticket_cells` tables).
- [ ] Participant ticket endpoint:
  - `GET /api/v1/participant/ticket` returns the authenticated participant's ticket layout, cell IDs, and keys for the current round.
  - Enforces zero-knowledge isolation: a participant can ONLY access their own ticket; requests attempting to access another participant's ticket return HTTP 403.
  - Undrawn questions and future draw order are never exposed or leakable through ticket data.
- [ ] Pure unit tests verify ticket structural invariants:
  - Exact 3×9 dimension check.
  - Exactly 15 populated cells and 12 empty cells.
  - Exactly 5 populated cells per row.
  - No duplicate keys on any single ticket.
  - Generation failure if round key pool has fewer than 15 unique keys.
- [ ] Integration tests verify batch ticket generation for 500 participants, database persistence, and ownership enforcement on `GET /api/v1/participant/ticket`.
