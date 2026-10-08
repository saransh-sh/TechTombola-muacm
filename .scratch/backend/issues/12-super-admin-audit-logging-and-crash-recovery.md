# 12 — Super Admin Controls, Audit Logging, and Crash Recovery

**What to build:** Super Admin management of operational admins, immutable system-wide audit logging for all critical game operations, and disaster recovery endpoints to restore active round state and in-memory caches upon server restart.

**Blocked by:** 10 — Winner Evaluation Engine and Claim Verification

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Super Admin management endpoints under `/api/v1/super-admin/admins`:
  - `GET /api/v1/super-admin/admins` (list admin staff accounts).
  - `POST /api/v1/super-admin/admins` (create new admin account with role `ADMIN`).
  - `PATCH /api/v1/super-admin/admins/:id` (activate/deactivate admin).
  - `DELETE /api/v1/super-admin/admins/:id` (soft-delete admin).
  - Enforce role check: only users with `SUPER_ADMIN` role may access these endpoints (HTTP 403 for `ADMIN` or `PARTICIPANT`).
- [ ] Immutable audit logging service:
  - Appends audit events to `audit_logs` table (`actor_id`, `action`, `resource_type`, `resource_id`, `metadata`, `ip_address`, `created_at`).
  - Covers critical actions: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `PARTICIPANT_IMPORTED`, `ROUND_STARTED`, `ROUND_PAUSED`, `ROUND_RESUMED`, `ROUND_COMPLETED`, `DRAW_CREATED`, `MARK_CREATED`, `WIN_CLAIM_CREATED`, `WINNER_VERIFIED`, `RECOVERY_EXECUTED`.
  - Admin endpoint: `GET /api/v1/admin/audit` (paginated audit trail filtered by actor, action, or date).
- [ ] Crash recovery routine (`POST /api/v1/admin/rounds/:id/recover`):
  - On unexpected server termination or restart, reads PostgreSQL state to verify round status, completed draws, marked cells, and closed patterns.
  - Re-hydrates in-memory state and validates that round can safely continue without data loss or duplicate draw sequences.
  - Logs `RECOVERY_EXECUTED` to audit trail.
- [ ] Pure unit tests verify audit log payload builder and recovery state validator.
- [ ] Integration tests verify Super Admin role enforcement, audit log entry creation across various game operations, and crash recovery against persisted database state.
