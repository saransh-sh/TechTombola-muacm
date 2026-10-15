# 0006. Simple Room Game, Batch Reveals and Activity Logs

Accepted product direction, 15 October 2026. Owner confirmed recommendations
Q1–Q5 and Q6–Q8 before documentation changes.

## Decision

- USER, ADMIN, SUPER_ADMIN; admins create/import users; only super admins
  create admins. No public admin signup.
- One live room, 1,000 users, one immutable ticket each; entry closes at start.
  Existing members reconnect. Remove Event/Round hierarchy.
- 3×9 ticket, 15 Keys, 12 blanks. Server-generated and persisted.
- Questions precede answers; users may mark guesses. Explicit admin answer
  batches, default 10; full batch blocks advance until revelation.
- Claims after reveal require persisted marks plus revealed Keys. Corrections
  allowed while active. Six fixed patterns including Four Corners, one winner
  each. No numerical points.
- Server acceptance order sets priority; admin verifies earliest pending
  eligible claim or rejects with reason.
- Presentation shows question or explicit batch answers. Game control and
  logs/meters are separate admin pages.
- Durable room activity; browser reports labeled untrusted. Reload/connection
  trouble is not automatic cheating. Lifetime analytics/indefinite retention
  policy deferred.
- Keep Bun/Fastify/PostgreSQL monolith, revocable sessions, server authority,
  transactions, tests and explicit merge approval.

## Supersession

Overrides incompatible ADR 0003 rules (draw-only marks, mark-independent wins),
400–500 capacity assumptions in ADRs 0001/0002/0004, v1 PRDs and old backend
tickets. ADR 0005 sessions remains applicable. Historical files are retained
with supersession notices; v2 PRDs define current behavior.

## Consequences

Separate question presentation and answer revelation in persistent state.
Own-ticket labels visible; hidden mappings private. Mark replies cannot leak
correctness. Claims preserve evidence so later changes don't rewrite acceptance.
Load-test 1,000 users with logging/admin reads; never infer cost/capacity solely
from framework choice.
