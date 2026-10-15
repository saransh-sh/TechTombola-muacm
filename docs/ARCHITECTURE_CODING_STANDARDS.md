# Architecture and Coding Standards — Tech Tombola

V2, 15 October 2026. Business rules:
[backend](TECH_TOMBOLA_BACKEND_PRD.md), [frontend](TECH_TOMBOLA_FRONTEND_PRD.md).
Terms: [CONTEXT.md](../CONTEXT.md). No v1 Event/Round architecture in MVP.

## 1. Shape and stack

```text
React SPA: User | Admin control | Admin logs | Super Admin | Presentation
                          HTTPS REST + native WebSocket
                                     |
                   TLS reverse proxy → Bun/Fastify process
                                     |
                                 PostgreSQL
```

One live room, 1,000 users, one ticket/user; multiple admins share committed
state. AWS EC2 app host, same-origin static frontend, private PostgreSQL (RDS
target), backups independent of app host. Measure sizing and cost. No Redis,
brokers, microservices, event sourcing, AI execution or analytics service.

Strict TypeScript, Bun, Fastify, Zod, Drizzle/SQL migrations, Argon2id, secure
HTTP-only JWT cookie bound to active DB Session. Native WebSockets notify only.

## 2. Backend boundaries

```text
routes → service → domain
           |
       repository + WebSocket adapter
```

Established `routes → service → domain ← repository` vocabulary describes the
same dependency boundary: domain has no IO imports. Services call domain and
repositories; repositories may use domain types.

| Layer | Owns | Prohibited |
|---|---|---|
| Routes | Zod, HTTP mapping, auth context, service calls | SQL, game rules/mutations, direct broadcast |
| Service | Transaction/use-case orchestration, domain calls, audit, after-commit effects | HTTP parsing, duplicated game rules |
| Domain | Pure tickets, lifecycle, batches, mark permissions, patterns/priority | Fastify, SQL, clock/random IO, WS |
| Repository | Parameterized queries, transactions/locks, persisted snapshots | Deciding gameplay |
| Realtime | Role-filtered committed updates, connection lifecycle | Mutation frames or deciding winners |

Folders: auth/accounts, rooms/content, tickets/marks, questions/reveals, claims,
activity. Inject time/randomness at real seams. Interfaces only at IO boundaries;
no speculative base classes or extensible pattern framework. Extract duplicated
behavior; YAGNI wins over ceremonial SOLID.

## 3. Authority and concurrency

Backend owns membership/capacity, tickets, question/reveal state, accepted marks,
claim evidence/order, winners, metrics and recovery. Pre-reveal marks allowed;
acceptance never confirms hidden correctness. Claims require marked/revealed Keys.

Successful mutation and authoritative activity record commit atomically. Lock
shared resources for join/start, next/reveal, mark/claim snapshots, pattern
priority/verification. Unique constraints backstop domain invariants. Idempotency
keys replay safe outcomes; changed payload conflicts. Expected room versions
reject stale admin commands. Marks use desired state + revision, not toggles.
Commit precedes broadcast; failed broadcast never rolls back/repeats a question.

Own-ticket Keys are visible. Hidden mappings/future questions never enter user
or presentation DTOs. Separate role allowlists; hidden React elements cannot
secure privileged payloads. Persist versions; REST snapshots restore after gaps.
Memory holds connections/presence, not a second game authority. Restart enters
RECOVERY_REQUIRED; admin resumes after validation, without regeneration/reveal.

## 4. React boundaries

React/TypeScript/Vite, Router, TanStack Query, CSS Modules/modern CSS, native WS,
purposeful GSAP with reduced motion. Local state for transient UI; Zustand only
when shared UI needs it.

pages → features/hooks → lib/api + lib/websocket; presentational components
receive props/emit actions. All HTTP in src/lib/api. Hooks own requests/events
and pending state; types mirror backend DTOs. No client ticket generation,
hidden matching, score, win eligibility or claim ordering. Client validation is
UX only; authoritative server state is not duplicated into UI stores.

## 5. Security and logs

Validate auth, role, ownership and room scope on every protected action.
Validate WS session/Origin and revoke established sessions on logout/deactivation.
CSRF/Origin checks, secure cookies, payload limits, rate limits, parameterized
SQL, escaped text and least-privilege DB/network access are required.
Content is never executable or interpreted by an LLM.

Authoritative activity is append-only via application permissions. Client events
are bounded/validated/untrusted; server assigns actor/time. Exclude secrets,
raw bodies and unrevealed answers from generic logs. Admin-only indexed,
paginated log reads; aggregate noise. Reload/heartbeat delay alone never proves
misconduct. Product logging rules are in backend PRD §8.

App routes /api/v1. Safe error envelope `{ error: { code, message }, requestId }`.
/health is liveness; /ready tests dependencies and may return 503. Never commit
secrets or put them into frontend bundles.

## 6. Verification and workflow

List scenarios first; adjacent tests per implementation: domain pure unit,
service IO fakes, Fastify contract tests, real PostgreSQL transaction races,
React mocked API/WS tests and Playwright critical flow. Don't mock away DB
constraints for concurrency. PRDs give required scenario matrices.

Build, typecheck, lint and required tests pass before delivery. Release requires
1,000-user load with logging enabled and backup/restore rehearsal. Never disable
tests for gates. Docs-only changes use link/consistency/diff checks, without
invented application tests or unearned load claims.

Keep AGENTS.md workflow: grill open requirements; synchronize main; dedicated
feature/tombola_<slug>; review; commit/push/PR; explicit approval before merge;
preserve branches. Simplification retains security, tests and audit integrity.
