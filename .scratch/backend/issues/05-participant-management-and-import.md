# 05 — Participant Management, Bulk Import, and Credential Delivery

**What to build:** Participant entity and profile management, bulk CSV/JSON participant onboarding with atomic account creation, temporary password generation, and transactional email dispatch for credentials.

**Blocked by:** 02 — Authentication and Role-Based Authorization

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Participant profile entity linked 1:1 with `User` table per event (`user_id`, `event_id`, `name`, `email`, `phone_optional`, `is_active`).
- [ ] Bulk participant onboarding service supporting CSV and JSON payload formats:
  - Validates email formats and rejects corrupted rows with detailed error reporting.
  - Automatically creates a `User` record with role `PARTICIPANT`.
  - Generates secure random initial password (Argon2id hashed before persistence).
  - Enforces uniqueness of participant email within the event.
- [ ] Admin REST endpoints:
  - `GET /api/v1/admin/participants` (paginated participant list with search/filter)
  - `POST /api/v1/admin/participants` (single participant creation)
  - `POST /api/v1/admin/participants/import` (bulk import up to 500 participants)
  - `GET /api/v1/admin/participants/:id` & `PATCH /api/v1/admin/participants/:id` (view/update status)
- [ ] Transactional email interface (`EmailService`) with mockable provider boundary:
  - Generates credential delivery email templates with event link, login email, and initial password.
  - Records email delivery status (`PENDING`, `SENT`, `FAILED`) in database.
- [ ] Unit tests for CSV parser, random password generator, and duplicate email handling.
- [ ] Integration tests verify bulk import of 500 participant records, partial batch rollback handling, and email job queueing.
