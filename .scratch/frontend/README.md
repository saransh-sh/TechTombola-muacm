# Frontend Agent Execution Plan

Approved scope: convert the existing Frontend PRD into **25 local tickets only**. No GitHub issues, product implementation, dependencies, commits, pushes, deployment, or PR publication are part of this planning change.

## Start here

1. Read [coverage](COVERAGE.md), [contract gaps](CONTRACT_GAPS.md), and the selected ticket. The [Frontend PRD](../../docs/TECH_TOMBOLA_FRONTEND_PRD.md) defines WHAT; [AGENTS.md](../../AGENTS.md), [CONTEXT.md](../../CONTEXT.md), [architecture](../../docs/ARCHITECTURE_CODING_STANDARDS.md) and relevant ADRs define HOW.
2. Choose a fully specified ticket whose listed frontend and backend prerequisites are actually available. Read each backend prerequisite under [the backend backlog](../backend/README.md). A checkbox or `done` label is not proof its code is on the integration base.
3. Identify actual request/response serializers, query/body schemas, error codes and WS subscription behavior. Resolve any changed contract before implementation. Use the project's grill workflow for new requirements; do not re-ask settled decisions recorded here.
4. For implementation, synchronize the latest remote main and create the ticket's declared `feature/tombola_frontend_<slug>` branch using the repository workflow. Preserve existing branches and local changes. If required backend code exists only on another branch, record the integration prerequisite; do not silently assume main contains it or merge it without authorization.
5. List individual test scenarios first. Implement one scoped slice through API adapter, hooks, feature UI and tests; leave game decisions in the backend.
6. Execute focused checks and the completion gate. Review, commit, push and open an implementation PR when authorized by the implementation task; merge only after the repository's explicit human approval gate.

## Snapshot and limits

- Planning baseline: local checkout inspected on 2026-10-17, branch `feature/tombola_backup_restore_rehearsal`; it contains backend code and no `frontend/` directory. Runtime/API/browser behavior was not executed in this planning task.
- The previously created remote milestone branch was created from remote main. Its name does not prove backend feature branches were integrated into it. This plan makes no claim about remote code readiness.
- Work is participant-first, then operational roles and display, then release qualification. Separate Admin slices can proceed once their actual prerequisites are present.
- Backend-owned behavior is consumed, not reimplemented or unnecessarily rebuilt. Backend extensions are separate scoped work after a contract decision.
- The execution pack is planning, not an implementation or release-readiness claim.

## Ticket index

| Ticket | Delivers | Frontend blockers | Specification status |
|---|---|---|---|
| [01](issues/01-application-authentication-and-role-routing.md) | Application, Authentication, and Role Routing | None | ready-for-agent |
| [02](issues/02-participant-lobby-and-lifecycle.md) | Participant Lobby and Lifecycle States | [01](issues/01-application-authentication-and-role-routing.md) | ready-for-agent |
| [03](issues/03-persistent-mobile-ticket.md) | Persistent Mobile Ticket Rendering | [02](issues/02-participant-lobby-and-lifecycle.md) | ready-for-agent |
| [04](issues/04-live-draw-feed-and-reveal.md) | Live Draw Feed and Question/Key Reveal | [03](issues/03-persistent-mobile-ticket.md) | ready-for-agent |
| [05](issues/05-server-confirmed-marking.md) | Server-Confirmed Marking and Tap Safety | [04](issues/04-live-draw-feed-and-reveal.md) | ready-for-agent |
| [06](issues/06-participant-claims-and-status.md) | Participant Claim Submission and Status | [05](issues/05-server-confirmed-marking.md) | ready-for-agent |
| [07](issues/07-participant-winners-and-results.md) | Participant Winners and Results | [06](issues/06-participant-claims-and-status.md) | needs-info: G01 |
| [08](issues/08-reconnect-and-state-recovery.md) | Reconnect and Authoritative State Recovery | [07](issues/07-participant-winners-and-results.md) | ready-for-agent |
| [09](issues/09-admin-dashboard-and-navigation.md) | Admin Dashboard and Navigation | [01](issues/01-application-authentication-and-role-routing.md) | ready-for-agent |
| [10](issues/10-admin-event-management.md) | Admin Event Configuration and Lifecycle | [09](issues/09-admin-dashboard-and-navigation.md) | ready-for-agent |
| [11](issues/11-admin-rounds-and-pattern-configuration.md) | Admin Round and Pattern Configuration | [10](issues/10-admin-event-management.md) | ready-for-agent |
| [12](issues/12-admin-questions-and-keys.md) | Admin Question and Key Management | [11](issues/11-admin-rounds-and-pattern-configuration.md) | needs-info: G02 |
| [13](issues/13-admin-participant-management.md) | Admin Participant Management | [10](issues/10-admin-event-management.md) | needs-info: G03 |
| [14](issues/14-participant-csv-onboarding.md) | CSV Preview, Import Confirmation, and Results | [13](issues/13-admin-participant-management.md) | ready-for-agent |
| [15](issues/15-admin-round-live-operations.md) | Round Readiness and Live Operations | [11](issues/11-admin-rounds-and-pattern-configuration.md), [12](issues/12-admin-questions-and-keys.md), [13](issues/13-admin-participant-management.md) | ready-for-agent |
| [16](issues/16-admin-random-and-manual-draws.md) | Random and Manual Draw Control Safety | [04](issues/04-live-draw-feed-and-reveal.md), [15](issues/15-admin-round-live-operations.md) | ready-for-agent |
| [17](issues/17-admin-claim-adjudication.md) | Admin Claim Review and Adjudication | [06](issues/06-participant-claims-and-status.md), [15](issues/15-admin-round-live-operations.md) | ready-for-agent |
| [18](issues/18-admin-winners-and-audit.md) | Admin Winner History and Audit Views | [09](issues/09-admin-dashboard-and-navigation.md), [17](issues/17-admin-claim-adjudication.md) | ready-for-agent |
| [19](issues/19-super-admin-account-management.md) | Super Admin Account Management | [09](issues/09-admin-dashboard-and-navigation.md) | ready-for-agent |
| [20](issues/20-super-admin-system-and-recovery.md) | System Health and Recovery Visibility | [15](issues/15-admin-round-live-operations.md), [19](issues/19-super-admin-account-management.md) | ready-for-agent |
| [21](issues/21-public-live-display.md) | Public Live Display and Winner Announcements | [04](issues/04-live-draw-feed-and-reveal.md), [07](issues/07-participant-winners-and-results.md) | ready-for-agent |
| [22](issues/22-critical-flow-and-authorization-e2e.md) | Critical E2E Flows and Authorization Regression | [08](issues/08-reconnect-and-state-recovery.md), [14](issues/14-participant-csv-onboarding.md), [16](issues/16-admin-random-and-manual-draws.md), [17](issues/17-admin-claim-adjudication.md), [18](issues/18-admin-winners-and-audit.md), [19](issues/19-super-admin-account-management.md), [20](issues/20-super-admin-system-and-recovery.md), [21](issues/21-public-live-display.md) | ready-for-agent |
| [23](issues/23-accessibility-responsive-browser-validation.md) | Accessibility, Responsive Layouts, and Browser Validation | [22](issues/22-critical-flow-and-authorization-e2e.md) | ready-for-agent |
| [24](issues/24-performance-and-safe-observability.md) | Performance, Animation Cleanup, and Safe Diagnostics | [23](issues/23-accessibility-responsive-browser-validation.md) | ready-for-agent |
| [25](issues/25-deployment-and-event-release-rehearsal.md) | Static Deployment and Event Release Rehearsal | [24](issues/24-performance-and-safe-observability.md) | ready-for-agent |

## Dependency frontier

```text
01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08
01 -> 09 -> 10 -> 11 -> 12
            10 -> 13 -> 14
11 + 12 + 13 -> 15
04 + 15 -> 16
06 + 15 -> 17
09 + 17 -> 18
09 -> 19
15 + 19 -> 20
04 + 07 -> 21
08 + 14 + 16 + 17 + 18 + 19 + 20 + 21 -> 22 -> 23 -> 24 -> 25
```

The files' **Blocked by** fields are authoritative. Dependencies are prerequisite work, not estimates, ownership assignments, or instructions to run multiple agents. Unresolved G01 blocks 07, G02 blocks 12, and G03 blocks 13; their dependent tickets cannot claim completion until the affected contract acceptance criteria are resolved.

## Status vocabulary

- `ready-for-agent`: specification is settled; execution still waits for every listed frontend/backend prerequisite and a valid integration base.
- `needs-info`: an explicit contract gap prevents full specification/completion. Develop settled subparts only with a recorded partial status; never call the whole ticket done.
- `in-progress`: an implementation task has claimed the ticket on its feature branch.
- `ready-for-human`: a concrete hosting/device/approval step requires human action.
- `implemented-unmerged`: code and local checks delivered, PR still unmerged.
- `done`: acceptance criteria and required evidence pass and implementation is merged with explicit approval. Preserve the feature branch.

All tickets start as planning entries with unchecked criteria. No blanket claim is made that existing backend tickets are merged, available, or currently validated.

## Authority and contracts

- React is presentation and input: pages → features → hooks → `lib/api` → backend, with presentational components and scoped Query caches. Bun routes → service → domain ← repository remains authoritative for draws, ticket generation, mark validity, eligibility, capacity and winners.
- TanStack Query owns server snapshots and cookie-backed user/session reads. Zustand holds only temporary UI/connection/animation state. No persistent browser mirror of game authority.
- All HTTP goes through `src/lib/api/`; use native WebSocket via the shared transport adapter. Validate external payloads at trust boundaries, handle cancellation, and serialize DTO dates as strings.
- All API paths in tickets are rooted at `/api/v1`. Use actual serializers and schemas, not the illustrative frontend PRD interfaces. Normalize participant Draw `questionText/keyValue/sequenceNumber`, public Draw `question/key/sequenceNumber`, and WS Draw `question/key/sequence` at the adapter seam.
- Ticket DTOs expose populated cells with `rowIndex/colIndex` (also `row/column` aliases). Render the 3×9 layout from server positions and empty slots, never generate or reshuffle keys. A participant may see their authorized Ticket keys; future Draw sequence and unauthorized Question/Key mappings must not be fetched.
- Marking is pending → server-confirmed or rejected → authoritative refetch. Pattern options are not computed eligibility. WS winner messages alone do not prove the current participant won.
- WS events are `ROUND_STARTED`, `ROUND_PAUSED`, `ROUND_RESUMED`, `DRAW_CREATED`, `WIN_CLAIM_CREATED` (Admin only), `WINNER_VERIFIED`, `ROUND_COMPLETED`, `ANNOUNCEMENT`. No separate question-revealed/key-revealed/rejection/recovery events are invented.
- WS has no replay. Snapshot/subscription/reconnect races require scoped reconciliation; event envelope `eventId` is the Event identity, not a unique replay-event identifier.
- Read current subscription query and scope checks. Authenticated sockets presently allow ACTIVE/PAUSED; public sockets additionally support READY/RECOVERY_REQUIRED/COMPLETED. Lobby/terminal transitions therefore require REST observation where WS is unavailable.
- Session transport uses HTTP-only cookies, credentialed Fetch and backend Origin controls. Never store/log passwords, session tokens, private import content or sensitive admin responses.
- Disable pending duplicate actions; do not retry gameplay mutations automatically. Idempotency-Key applies only to operations whose existing backend contract explicitly requires it. Ambiguous outcomes require authoritative reads.
- Safe rendered text, loading/empty/error/permission/stale feedback, accessibility, appropriate responsive layouts and reduced motion are per-ticket requirements, not deferred polish.
- UI implementation must run the project's `saransh_custom_antislop` gate; it is not run or claimed during this document-only task.

## Approved handling of PRD ambiguities

- Requirements are cited with their section: `§50 FR-FE-001` means login; `§16 FR-FE-001` means Ticket rendering. The PRD reuses FR-FE-001 through FR-FE-006; this pack does not silently renumber the PRD.
- Countdown uses an actual schedule only; no Round scheduling/automatic-start behavior is invented. Question/key reveal sequencing is short presentation animation on the same Draw payload; it never locks marking.
- Claim options show backend configuration/open status; specific eligibility needs server evidence. Rejections use returned details or truthful generic status, with REST refresh for pending Claims.
- CSV preview validates file presentation/syntax only. The synchronous server report is authoritative for business checks; processing is indeterminate, not fabricated row progress.
- Existing unmark API does not imply a new undo requirement. No undo UI is added by this plan.
- No unsupported Question bulk import, Key DELETE, admin announcement composer, Super Admin recovery wildcard, or editing Participant Event assignment is invented.
- Exact winning-cell highlights and other unsupported required data remain explicit blockers in [CONTRACT_GAPS](CONTRACT_GAPS.md). No required PRD behavior is silently dropped.

## Canonical frontend commands

**Planned by ticket 01, not existing runnable scripts.** Establish these in `frontend/package.json` with Bun as the package runner. The test script invokes **Vitest**, not Bun's native test runner; React Testing Library tests must actually execute under the configured Vitest DOM environment.

```bash
cd frontend
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run test
bun run test:coverage
bun run build
bun run test:e2e
```

Ticket 01 initially creates and commits a lockfile with `bun install`; subsequent reproducible checks use `--frozen-lockfile`. Planned script meanings: `test` = `vitest run`; `test:coverage` = Vitest coverage; `test:e2e` = Playwright against the configured app/real backend; `typecheck`, `lint`, and `build` must genuinely run their named tools.

Keep adjacent `*.test.ts(x)` coverage with mocked `lib/api`/IO in unit/component tests. Test user-visible behavior and meaningful failure/race cases; no mirrored browser game engine. Use a disposable backend/PostgreSQL fixture for integration/E2E, never production or a shared dirty fixture. Read the backend README for its existing commands; frontend completion cannot claim backend builds passed if they were not executed.

The PRD and repository mention frontend hooks, but the frontend is absent in this checkout. Ticket 01 must inspect the actual state at execution time, preserve existing hooks if present, and establish the documented adjacent-test/relevant-test/full-suite behavior if missing. Advisory coverage figures from AGENTS are lines/functions/statements 80%, branches 75%; report actual coverage and gaps without treating thresholds as proof of scenario coverage.

## Completion gate

A feature is complete only with its UI, real API integration, relevant WS behavior, server-confirmed state, tested refresh/reconnect, loading/error/pending/permission states, responsive/touch behavior, keyboard/semantic accessibility, reduced motion, adjacent tests, required E2E coverage, passing build/checks, and no normal-flow console errors or leaked sockets/timers/GSAP contexts.

- Enumerate scenarios, run focused checks, then canonical gates; repair regressions owned by the ticket.
- State exact commands, pass/fail results and environment. Browser emulation is not real-device evidence, local gates are not hosted CI, and a mocked fixture is not real backend integration.
- Attach acceptance-criterion → evidence mapping and contract resolution links; record unavailable/failed evidence as pending, not passed.
- Verify actual backend branch/commit/PR availability and permissions. A blocked contract or missing dependency prevents completion.
- Run `/code-review` against PRD, architecture and tests before delivery. Follow the repository's explicit approval gate before merging.
- Tickets 22–25 require real multi-role flow, browser/mobile/a11y checks, measured performance, safe diagnostics, static deployment and event rehearsal evidence. No ticket may skip or disable a failing requirement to pass the release gate.

## Planning maintenance checks

When editing this pack, verify exactly 25 numbered issue files, unique requirement-slug branches, valid local links, blockers that exist earlier in dependency order, an acyclic graph, status consistency with G01–G03, coverage of §50's 21 FRs / §16's six distinct FRs / §51's ten NFRs, and all 67 PRD sections. Run `git diff --check -- .scratch/frontend`. These checks validate planning structure, not production code.

