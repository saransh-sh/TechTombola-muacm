# 04 — Question and Key Bank Management

**What to build:** Technology Answer Key and Question Clue domain models, validation, and administrative management APIs, ensuring canonical key normalization and 1:1 question-to-key associations.

**Blocked by:** 03 — Event and Round Lifecycle State Machine

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Domain models for `Key` and `Question` created with strict validation:
  - Keys must be uppercase, trimmed, alphanumeric with spaces or hyphens allowed, 2–50 characters, and unique within an event.
  - Questions must have prompt text (10–500 characters) and map to exactly one valid key in the round.
- [ ] Admin REST endpoints created with Zod validation:
  - `POST /api/v1/admin/keys` (create answer key)
  - `GET /api/v1/admin/keys` & `PATCH /api/v1/admin/keys/:id` (list/update keys)
  - `POST /api/v1/admin/questions` (create question associated with a key and round)
  - `GET /api/v1/admin/questions` & `PATCH /api/v1/admin/questions/:id` (list/update questions)
  - `DELETE /api/v1/admin/questions/:id` (delete un-drawn question)
- [ ] Prevent deletion or modification of a Question or Key if it is associated with an active or completed round or has already been drawn.
- [ ] Domain validation ensures a round cannot transition to `READY` unless it has an adequate pool of questions/keys (minimum 25 keys).
- [ ] Pure unit tests verify Key normalization, uniqueness validation, and question-key mapping logic.
- [ ] Integration tests verify Admin CRUD operations, validation failures (empty key, duplicate key), and deletion constraints on active questions.
