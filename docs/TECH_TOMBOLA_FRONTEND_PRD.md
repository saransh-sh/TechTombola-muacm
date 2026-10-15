# Tech Tombola — Frontend PRD

Version 2.0 · 15 October 2026 · Agreed product direction; implementation pending.

One React/TypeScript/Vite application for User, Admin, Super Admin and read-only
presentation. Target: 1,000 mobile users plus several admin laptops/projectors.
[Backend PRD](TECH_TOMBOLA_BACKEND_PRD.md) owns gameplay/security rules.
Replaces v1's Event/Round screens and immediate-answer model.

## 1. User experience

FR-FE-001: Assigned ID/password login → enter room code → lobby. QR opens join
URL; login returns to joining. Never put credentials in URLs or store tokens/
passwords in local storage. Handle bad credentials/code, full/closed room,
throttling and session expiry without losing committed state.

FR-FE-002: Lobby shows instructions, do's/don'ts, six patterns, batch rules,
attendance/capacity, connection status and activity-collection notice. Explain
marking before reveal and server-validated claims. Refresh/reconnect returns
the same membership/ticket. Only already joined users return after start.

FR-FE-003: Clearly labeled practice has sample ticket/questions, mark/unmark,
sample reveal/claim feedback and reset. No live content, ticket mutations or
claims; practice telemetry is labeled separately. If room starts during practice,
move into the authoritative live room snapshot.

FR-FE-004: Game screen prioritizes server-rendered 3×9 ticket (15 Keys, 12 blanks),
current question, batch progress, connection/state, revealed answers and claims.
Keys are labels, not necessarily numbers. No textual answer input.

FR-FE-005: Active users can mark/unmark populated cells before reveal. Neutral
selected/unselected/pending/error states never confirm hidden correctness.
Empty cells inert. Send desired state/revision, confirm from server, resync
stale conflicts and serialize rapid taps. Pause/recovery/end disable changes
and retain existing marks. Pending selection is distinct from persisted state.

FR-FE-006: Explicit reveal shows the batch's question/answer pairs (default 10,
backend-configured). Earlier revealed batches remain accessible without losing
ticket interaction. Users can correct marks. Do not load future pools, hidden
mappings or privileged match counts; own-ticket labels are intentionally visible.

FR-FE-007: Display Early 5, three lines, Four Corners and Full House. Explain
corners as first/last populated cells in top/bottom rows. Claims follow backend
room/reveal/pattern status, confirm intent and show pending/verified/rejected/
closed with safe reasons. Server determines eligibility and order. No numerical
points. Actual marks and officially revealed Keys are required for claims.

## 2. Admin surfaces

Three principal pages run independently across laptops. Super Admin additionally
has protected admin-account management. Hidden controls never replace backend
authorization.

### Presentation

FR-FE-008: Public read-only projector page shows only current question during
question play. Explicit reveal replaces it with that batch's question/answer
pairs, retained until admin advances/completes. Large high-contrast type, readable
at 1280×720, 1366×768 and 1920×1080, with no clipped question/answer list.
Show minimal idle/pause/reconnect/end state when needed. No tickets, people,
meters, winners, claims, logs, controls or hidden answers. Reconnect fetches
safe presentation snapshot.

### Game control

FR-FE-009: Create/configure room, questions/Keys, batch size, capacity. Open
lobby, show/copy QR and code, attendance and ticket allocation. Content locks
at lobby opening. User create/import/reset is a section of this page; no public
signup or required email. Secure credential issuance avoids logs/browser storage.

FR-FE-010: Show privileged question/answer, presented/remaining questions,
batch/reveal counts, joined/connected/remaining seats, tickets and claim queue.
Next/reveal/start/pause/resume/complete use server state and command version.
Disable pending actions, confirm start/reveal/end/verification, and refetch on
stale conflicts. Full batch blocks Next; exhausted short batch can be revealed.
Startup recovery requires explicit admin validation/resume.

FR-FE-011: Claims sort by server priority per pattern, showing evidence.
Only earliest pending eligible claim can be verified. Reject requires reason.
All admins see updates; simultaneous actions never create two winners.

### Logs and meters

FR-FE-012: Room feed and searchable user timeline filter by user/time/type/result
with server pagination. User detail shows ticket and backend-computed Marked,
Expected, Correct, Missed, Extra, Eligible marked and Difference (backend §6).
Show pre-reveal marks/post-reveal corrections, distinguishing authoritative
events from client reports. Separate ticket and cell counts. Do not imply
these measures prove knowledge or constitute a points system.

FR-FE-013: Silent admin-only alerts have source, context, time and acknowledgment.
No audio, public shaming or automatic disqualification. Reload/visibility/network
signals alone do not become cheating labels. Distinguish security rejections
from uncertain connections; aggregate repeated signals and heartbeat status.

FR-FE-014: Super Admin can create/list/disable admins. No public admin signup
and no self-escalation by ordinary admins.

## 3. Architecture and quality

React renders authoritative snapshots and captures intent. All HTTP in
src/lib/api; hooks own requests/WS subscriptions. TanStack Query for server
state; local React state for inputs/modals; Zustand only for actual shared UI
needs. Backend DTOs own contracts. WS notifies, REST restores after reconnect
or version gap; bounded polling covers missed notifications. Browser never
generates tickets, computes win eligibility or establishes claim priority.

NFR-FE-001: Mobile-first from 320px, readable Key labels and touch targets;
allow intentional ticket scrolling when nine columns cannot fit readably.
Admin desktop/tablet-first, projector large-screen-first.

NFR-FE-002: Semantic controls, labels, keyboard/focus, sufficient contrast,
non-color-only states and reduced motion. Purposeful GSAP question/reveal/
confirmation transitions never block actions or determine game state.

NFR-FE-003: Loading, empty, error/retry, forbidden, expired-session and reconnect
states. Network uncertainty retries original idempotency key or refetches;
never invent success or discard confirmed marks.

NFR-FE-004: Allowlisted bounded browser events only; best-effort/untrusted.
Collection notice; no password capture, keystrokes, clipboard or unrelated
browsing. Escape questions/names/errors/log rows; no raw HTML from content.
No auth tokens in URLs, client logs or persisted UI storage.

## 4. Required tests and release gate

List scenarios first. Vitest/React Testing Library with mocked API/WS; Playwright
full-system tests. Required coverage:

- ID login/QR return; bad/full/closed room; roles/direct route bypass; expiry.
- Sample/reset isolation; room start while practicing.
- Exact ticket, long Keys/blanks; neutral pre-reveal marks; repeated taps,
  stale revisions, rejection/retry, pause and accessibility.
- Full/short reveal batches, previous answers, no premature mapping leakage,
  safe projector DTO and target resolutions.
- Claims before reveal blocked; six patterns and pending/reject/verify/closed;
  earliest server priority and simultaneous admins.
- Correct meter labels, filters/pagination, source/trust labels, silent alerts,
  reload not cheating, no secrets in telemetry.
- Refresh/logout/reconnect/restart restores ticket/marks/screen; missed/out-of-
  order updates resync; offline mutation stays visibly unconfirmed.
- Real mobile, keyboard/reduced motion, slow network, malicious text, and
  1,000-user backend qualification with admin/projector traffic and logs enabled.

Release requires login→join→practice→questions→marks→batch reveal→claim→admin
verification plus projector sync and reconnect restoration, with required
tests/builds passing. This PRD does not claim screens already exist.
