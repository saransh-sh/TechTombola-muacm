# Tech Tombola — Backend PRD

Version 2.0 · 15 October 2026 · Agreed product direction; implementation pending.

This replaces v1's Event/Round platform with one room-based game for 1,000
concurrent users. The owner accepted gameplay recommendations Q1–Q8 in two
clarification rounds. This PRD defines behavior; the
[architecture standards](ARCHITECTURE_CODING_STANDARDS.md) define execution.

## 1. Aim and scope

Run a simple, reliable technical Tambola game with useful individual activity
logs. Questions are clues whose predefined answers are Keys printed on tickets.
Users never submit textual answers.

ID/password login → room code or QR → lobby and practice → questions → manual
marks → batch answer reveal → claims → admin verification.

MVP: one live room, one ticket per joined user, up to 1,000 users, six fixed
patterns, three admin surfaces, reconnect/restart recovery, durable activity
history. Finished rooms remain readable. No separate Event/Round hierarchy.

Lifetime cross-game analytics and indefinite retention policy are deferred.
Keep room records/logs durable; defer the analytics platform, not logging.
Numerical points, public signup, payments, email delivery, AI features, chat,
multiple simultaneous live rooms and multiple tickets per user are out of scope.

## 2. Roles and accounts

Exactly three roles: USER, ADMIN, SUPER_ADMIN. Participant is an older synonym
for User, not another role/profile.

| Capability | User | Admin | Super admin |
|---|---|---|---|
| Join, practice, own ticket, mark, claim | Yes | No | No |
| Create/import users and regenerate credentials | No | Yes | Yes |
| Create/configure room, questions, tickets | No | Yes | Yes |
| Operate game, reveal answers, verify claims | No | Yes | Yes |
| Inspect meters, individual logs and alerts | No | Yes | Yes |
| Create/disable admins | No | No | Yes |

FR-BE-001: Admins share committed room state across laptops. No public admin
signup. Bootstrap first super admin through a deployment-only command without
default credentials. Account creation uses assigned login ID, display name,
initial password; CSV import reports created, duplicate and invalid rows.
Credentials are never recoverable from database/logs. Reset generates a new
credential rather than retrieving the old password. Secure issuance is an
admin-only operation; no mandatory email service.

## 3. Room and lobby

FR-BE-002: Admin creates room with name, unpredictable join code, capacity up
to 1,000 and reveal batch size (default 10). QR contains join URL/code only,
never credentials. Authenticated users join by code in LOBBY. The code locates
a room; it does not replace login. Rate-limit code attempts.

FR-BE-003: Membership is unique per user/room. Joining creates membership and
ticket atomically; repeat joins return the same allocation. Joining closes
atomically at start. Concurrent joins/start cannot admit late users or exceed
capacity. Existing members may reconnect without consuming another seat.
Only one room may be LOBBY, ACTIVE, PAUSED or RECOVERY_REQUIRED at a time.
Completed historical rooms remain readable.

FR-BE-004: Lobby shows instructions, do's/don'ts, joined count/capacity,
connection and room status. Sample practice supports marking, revelation and
sample claims, isolated from live questions/tickets/claims/winners. Practice
telemetry is labeled separately and does not change live game meters.

## 4. Tickets and content

FR-BE-005: Generate one persistent ticket server-side on join. Exactly 27 cells:
3 rows × 9 columns, 5 populated per row, 15 unique Keys and 12 blanks.
Technology Keys have no numeric column ordering. Ticket freezes on allocation;
retries, refresh, logout, reconnect and restart never regenerate it.

FR-BE-006: Each room question has text and exactly one Key; one question per
Key per room. Normalize Key values (trim, collapse spaces, uppercase) and
reject duplicates. At least 15 valid distinct pairs are required to open the
lobby. Content freezes at lobby opening because tickets are being allocated.
Preserve question/Key snapshots for historical reads.

FR-BE-007: Users see all Keys on their own ticket, including those whose
questions have not appeared. Never expose future question text, unrevealed
question→Key mappings, complete Key pools, future order, other tickets, or
admin DTOs. Own-ticket Key labels are intentionally visible, not secret.

## 5. Lifecycle, questions and delayed answers

FR-BE-008: Explicit transitions:

```text
DRAFT → LOBBY → ACTIVE → COMPLETED
                  ↕
                PAUSED
ACTIVE / PAUSED → RECOVERY_REQUIRED → ACTIVE or PAUSED (admin decision)
```

Start requires at least one member, valid immutable tickets, content and fixed
patterns. Completion is explicit, never clears history, and cannot resume.
Invalid transitions conflict. DRAFT configuration is not a running game.

FR-BE-009: Next question selects one unused question server-side using secure
randomness, persists continuous sequence and snapshots, then broadcasts question
text without its answer. Admins receive a separate DTO containing the Key.
Never select the same question/Key twice. Exhaustion cannot wrap to question one.

FR-BE-010: Admin explicitly reveals the current batch. At configured batch
size, Next is blocked until reveal. Final short batch can be revealed when
the pool is exhausted. Reveal publishes all question/answer pairs in that
batch together to users and presentation. Earlier revealed batches remain
available to users. Presentation retains the batch until advance/completion.
Question presentation and answer revelation are separate persisted operations.

## 6. Marks and operational meters

FR-BE-011: During ACTIVE, users may mark/unmark any populated own-ticket cell,
even before its question or answer reveal. Backend verifies identity, ownership,
cell membership and room state. Acceptance must not confirm whether a hidden
guess is correct. Empty/foreign cells are rejected. PAUSED, RECOVERY_REQUIRED
and COMPLETED block changes, retaining existing marks.

Write desired state (true/false) with mark revision, not blind toggle. Serialize
writes, reject stale revisions and refetch. Retries cannot invert a mark or
overwrite newer intent. Persist actual changes with phase, server time/result.
Distinguish duplicate retries from genuine changes in diagnostic history.

FR-BE-012: Only marked cells whose Keys are officially revealed count toward
wins. Users can correct marks after reveal. Never auto-mark. Backend-stored
marks are required evidence; client assertions alone are not proof.

FR-BE-013: Backend computes individual admin meters:

| Meter | Definition |
|---|---|
| Marked | Populated cells currently marked |
| Expected | Ticket Keys whose questions have appeared |
| Correct | Marked cells whose Keys belong to appeared questions |
| Missed | Expected cells currently unmarked |
| Extra | Marked cells whose questions have not appeared |
| Eligible marked | Marked cells whose Keys have been officially revealed |
| Difference | Marked minus Expected; show Missed and Extra separately too |

Expected/Correct/Missed/Extra are admin-only during hidden-answer play. User
responses and mark acknowledgments cannot leak hidden mappings through counts.
These are operational meters, not points. Show pre-reveal marks and post-reveal
corrections without claiming they prove knowledge. No numerical scoring in MVP.

Room meters: joined, connected/disconnected, remaining seats, allocated tickets,
questions presented/remaining, answers revealed, current batch, pending claims,
winners, service health. Ticket counts and cell counts are separate.

## 7. Claims and winners

FR-BE-014: Six fixed patterns, one winner each. All required cells must be
marked in server state and their Keys officially revealed:

| Pattern | Required cells |
|---|---|
| Early 5 | At least five anywhere |
| Top Line | All five in top row |
| Middle Line | All five in middle row |
| Bottom Line | All five in bottom row |
| Four Corners | First/last populated cells of top/bottom rows |
| Full House | All fifteen |

FR-BE-015: Accept claims only in ACTIVE after at least one batch reveal, using
revealed Keys only. A later batch may be underway; hidden Keys cannot count.
Derive ticket from session/member, validate, then save immutable eligibility
snapshot (marks, revealed Keys, pattern, acceptance sequence). Later unmarking
cannot rewrite pending evidence. Early 5 remains valid beyond five eligible
cells. This supersedes v1's mark-independent eligibility.

FR-BE-016: Assign acceptance order transactionally under room/pattern locking;
browser time never determines priority. Verify only the earliest pending
eligible claimant per pattern. Admin may reject with recorded reason, allowing
the next eligible claim. Verification creates one winner and closes pattern
atomically; remaining pending claims become rejected because pattern closed.
Duplicate pending/verified claims conflict. A rejected user may submit a new
claim while open; retry of an old request replays its original result.

## 8. Activity logs and silent alerts

FR-BE-017: Durable structured logs are core product functionality. Record
authentication/security outcomes, account/room administration, join/allocation,
start/pause/resume/complete, question/reveal, mark/unmark, claim/verification/
rejection, recovery and important failed requests. Successful mutations and
their authoritative audit record commit atomically. Audit failure rolls back
the mutation rather than falsely succeeding.

FR-BE-018: Browser telemetry is best-effort: page views, practice entry/exit,
reload/navigation signals, visibility/connection changes, client errors.
Validate, size-limit, rate-limit, deduplicate by event ID, label CLIENT_REPORTED.
Browser reports can be missing/forged. Server attaches authenticated identity,
never accepts submitted actor ID as authoritative. No password-field tracking,
raw keystrokes, clipboard, screen recording or unrelated browsing collection.
Show activity-collection notice on login/lobby.

Records contain event ID/type, server timestamp, actor/role, room/resource IDs
where applicable, correlation/request ID, source/trust, outcome and allowlisted
metadata. Client occurrence time is optional/untrusted. Exclude passwords,
password hashes, cookies, JWTs, raw request bodies and unrevealed answers from
generic telemetry/operational logs.

FR-BE-019: Admin logs page offers room feed, individual timeline, filters by
time/user/type/result, cursor pagination, backend-computed meters and alert
acknowledgment. Index and bound queries. Refresh feed/meters live or with bounded
polling; do not broadcast every user's raw interactions to every browser.

FR-BE-020: Silent admin alerts cover repeated login failures, unauthorized
resource access, malformed/rate-limited requests, stale writes, reconnect bursts
and delayed heartbeats. Separate security rejections from browser/connectivity
signals. Reload, hidden tab or slow heartbeat alone is not cheating or grounds
for disqualification. Missing heartbeats mean connection uncertain, not proven
bad internet. Aggregate bursts and allow acknowledgment.

Keep logs and game records through completion and backups. No automatic cleanup
on completion. Lifetime analytics, archival schedules and indefinite retention
promises remain deferred. Access to detailed room logs is admin-only.

## 9. Architecture and AWS qualification

NFR-BE-001: One React application; one Bun/TypeScript/Fastify modular monolith;
PostgreSQL; Drizzle; Zod; native WebSockets. Modules are folders: auth/accounts,
rooms/content, tickets/marks, questions/reveals, claims, activity. Routes validate,
services coordinate, domain owns pure rules, repositories own SQL. No Redis,
Kafka, microservices, event sourcing, AI judge or plugin framework.

NFR-BE-002: AWS target is one EC2 app host with TLS reverse proxy, same-origin
static frontend and private PostgreSQL (RDS for managed persistence). Backups
survive app-host loss. Use bounded DB pooling, restricted networking, encrypted
transport, least-privilege DB account and environment/managed secrets.
Deployment sizing is validated empirically, not guaranteed by framework choice.

NFR-BE-003: Qualify 1,000 authenticated users plus admins/projectors on actual
AWS infrastructure. Simulate join/start contention, mark bursts, reveals, logs
queries, concurrent claims and reconnect storms with logging enabled.
Targets: read p95 <500 ms, p99 <1 s; committed questions/reveals visible <1 s;
no duplicate allocation, leaked mappings, lost committed marks or excess winners.
Record instance sizing, workload and results. The old ~$100 figure is historical,
not an approved operating-cost guarantee for 1,000 users. Estimate current
regional costs and enable budget alerts before deployment.

## 10. Security and recovery

NFR-BE-004: Assigned ID/password login; Argon2id hashes; signed JWT in secure
HTTP-only SameSite cookie, bound to active DB Session. Validate HTTP and WS
sessions/role/scope; logout/deactivation revokes established WS access too.
Origin/CSRF protection, payload limits, login/join/claim/telemetry rate limits.

NFR-BE-005: Zod on external input, parameterized SQL/Drizzle, allowlisted sort
fields and bounded imports. Render questions/names/logs as escaped text. User
content never becomes shell code, executable templates or instructions. No LLM
interprets gameplay/logs, so prompt injection has no execution path in MVP.
Avoid blanket claims that software cannot be manipulated.

NFR-BE-006: PostgreSQL is authoritative. Commit before broadcast. WS client
frames never mutate games. Only connection registries/presence live in memory.
Reconnect fetches role-filtered REST snapshots; version gaps trigger resync and
bounded polling recovers missed notifications. Startup moves previously ACTIVE/
PAUSED room to RECOVERY_REQUIRED; preserve tickets, marks, question/reveal
boundaries, claim order, winners and logs. Validate consistency, then admin
explicitly resumes. Never repeat a question or reveal answers on restart.
Provide /health, DB-aware /ready, request IDs, safe structured errors, daily
backups and tested restore instructions.

## 11. Persistence and API contract boundaries

Minimal records: User, Session, Room, RoomMember, Question (including Key), Ticket,
TicketCell, Mark, PresentedQuestion, RevealBatch, Claim (snapshot/order), Winner,
ActivityLog, Alert, IdempotencyRecord. No Event/Round, global Key catalog, email
queue or separate participant/admin profiles.

Unique constraints protect login IDs/codes, membership/allocation, ticket
positions/Keys, question/Key per room, question/sequence, batch boundary, winner
per room/pattern. Transactions serialize join/start, next/reveal, mark/claim
snapshot and pattern verification. Persist increasing room versions.

All application routes use /api/v1. Required operation groups:

| Group | Operations |
|---|---|
| Auth | Login, logout, current account |
| User | Join; own room snapshot/ticket/marks/claims; set mark; claim |
| Admin | Users/import/reset; room/content; open/start/pause/resume/complete/recover; next; reveal; verify/reject; meters/logs/alerts |
| Super admin | Create/list/disable admins |
| Presentation | Safe current question/revealed batch snapshot |
| Telemetry | Bounded authenticated event batches |

Endpoint schemas are implementation contracts to grill with their vertical
slice; the old endpoint inventory is superseded. Errors:
`{ error: { code, message }, requestId }`. Statuses: 400 malformed input,
401 unauthenticated, 403 forbidden, 404 missing, 409 conflict/stale version,
422 ineligible claim, 429 limited, 503 unavailable dependency. Never expose
SQL, stack traces or hidden correctness in errors.

Critical retries use Idempotency-Key scoped to actor/operation/room and request
fingerprint. Same-key concurrent retries replay one safe committed result;
payload mismatch conflicts. Different keys are independent commands, serialized
where needed. Room expectedVersion on start/next/reveal/verification rejects
stale admin screens. Never persist raw credential-issuance responses for replay.

WS events are role-filtered: room state, QUESTION_PRESENTED, ANSWERS_REVEALED,
own claim updates and verified winners for users; privileged question DTOs,
meters/alerts and claim queues for admins. Public presentation channel allows
only current question, explicitly revealed batch and presentation state;
never users, tickets, claims, meters, logs or unrevealed admin answers.

## 12. Required verification and completion

List scenarios first; ship domain/service tests, HTTP contracts, PostgreSQL
race tests and frontend behavior tests with each implementation slice.

| Area | Required scenarios |
|---|---|
| Accounts | Valid/invalid login; inactive/expired/revoked session; role escalation; import duplicates; no credential leakage |
| Join | Invalid/repeat code; 1,000-capacity boundary; concurrent join/start; late join; reconnect same membership |
| Tickets | Many seeded layouts; dimensions/counts/uniqueness; insufficient pool; immutability; ownership |
| Practice | Sample/reset; no live access or mutation; separate telemetry |
| Questions | Unique selection; exhaustion; same/new idempotency keys; concurrent admins; stale versions; private answers |
| Reveal | Full batch blocks Next; final short batch; retry; reconnect either side of reveal; safe projector payload |
| Marks | Neutral pre-reveal acceptance; correction; blank/foreign cell rejection; pause; stale revision; concurrent claim snapshot |
| Claims | Six patterns; marks required; unrevealed excluded; >=5; immutable snapshot; duplicate/rejected resubmit; priority; one winner under race |
| Logs/meters | Formulas; Missed/Extra cancel in Difference; phase history; audit rollback; filters/indexes/pagination |
| Telemetry | Forged actor; trust labels; dedup/limits; no secrets; reload not cheating; uncertain heartbeat; admin isolation |
| Recovery | Restart at question/reveal/claim boundaries; missed broadcast; version resync; history intact; backup restore |
| Security/load | SQL/XSS inputs; CSRF/WS Origin; cross-user/role bypass; 1,000-user load/reconnect with logging |

MVP completes only after builds, typecheck, lint, required tests, full User→Admin→
Presentation E2E, measured load and restore rehearsal pass. Introduce runnable
scripts with implementation; this doc change does not claim an application
or passing qualification already exists.

## 13. References

- [Tambola/Four Corners event rules, IIT Bombay](https://www.ieor.iitb.ac.in/ieorday21/pdfs/IEOR%20Day%20-%20Cultural%20events.pdf)
- [OWASP SQL injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP safe logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [AWS EC2 concepts](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html)
- [AWS RDS getting started](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.html)
