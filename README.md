# Tech Tombola

A simple room-based technical Tambola game for **1,000 concurrent users**,
with detailed activity logs and server-authoritative gameplay.

Assigned ID/password → code/QR → lobby/practice → one immutable 3×9 ticket with
15 Keys. Questions appear without answers; users mark/unmark guesses. Admins
reveal batches (default 10), then claims use marked, officially revealed Keys.
Admins verify in server acceptance order; super admins also create admins.

Admin surfaces: question-only/reveal presentation, game control, individual
logs/meters. Connection/reload signals are not proof of cheating. No numerical
points system in the agreed MVP.

## Source of truth

- [Backend PRD](docs/TECH_TOMBOLA_BACKEND_PRD.md): rules, logs, security, load qualification.
- [Frontend PRD](docs/TECH_TOMBOLA_FRONTEND_PRD.md): User/Admin/Presentation UX.
- [Architecture](docs/ARCHITECTURE_CODING_STANDARDS.md): boundaries and tests.
- [Vocabulary](CONTEXT.md).
- [V2 decision](docs/adr/0006-simple-room-game-and-batch-reveals.md).
- [Agent workflow](AGENTS.md).

## Implementation status

This checkout contains specs/tooling; no backend/ or frontend/ application yet.
The [.scratch/backend plan](.scratch/backend/README.md) is superseded and must
not be implemented unchanged. Remote feature branches were not reviewed or
modified as part of this documentation update.

## Stack

React + TypeScript + Vite; Bun + Fastify + Drizzle + Zod; PostgreSQL; native
WebSockets. One modular monolith on AWS. Capacity/cost need actual measurement.
