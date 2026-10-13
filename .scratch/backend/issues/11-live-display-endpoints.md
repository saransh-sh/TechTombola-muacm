# 11 — Live Display Public Endpoints

**What to build:** Public, read-only, high-performance REST endpoints optimized for the live projector display, providing current event status, active draw, draw history, and verified winners without leaking sensitive internal participant data.

**Blocked by:** 10 — Winner Evaluation Engine and Claim Verification

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Read-only public REST endpoints implemented under `/api/v1/live`:
  - `GET /api/v1/live/event` (current event name, status, theme metadata).
  - `GET /api/v1/live/round` (active round sequence, status, remaining patterns).
  - `GET /api/v1/live/draws` (chronological list of drawn questions, keys, and sequence numbers).
  - `GET /api/v1/live/winners` (verified winners grouped by pattern, including display names).
- [ ] Security and data isolation:
  - Endpoints do not require participant/admin auth tokens (can be consumed by public projector views).
  - Responses strictly exclude internal IDs, participant emails, unverified claims, and undrawn questions/keys.
- [ ] Performance target:
  - P95 response time < 200ms under 500-client load using indexed PostgreSQL read queries.
- [ ] Unit tests verify payload serialization and ensure sensitive fields are stripped.
- [ ] Integration tests verify endpoints return accurate live data during active rounds and update immediately following draws and winner verifications.
