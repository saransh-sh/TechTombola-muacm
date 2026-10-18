# Frontend Contract Gaps and Approved Boundaries

Baseline: read-only inspection of the local backend on 2026-10-17. Code presence is not live API, runtime verification or remote-main availability. Reinspect owning serializers/routes when executing a ticket.

The user approved local tickets and the policy: use existing backend contracts, identify unsupported required details as blockers, and keep game decisions in Bun. No backend extension or PRD requirement removal is authorized by this planning document.

## Resolution protocol

For an unresolved item: inspect the cited existing reads first, define the smallest exact request/response/error/security/test contract needed, use the project's grill/spec gate for business decisions, and create separate backend work if genuinely necessary. Link that deliverable and evidence here and in the affected ticket before changing `needs-info` to `ready-for-agent`. Until then preserve the required acceptance criterion as unchecked.

<a id="g01"></a>
## G01 — Exact winning-cell evidence

**State:** unresolved; blocks ticket 07 and downstream completion.

- Frontend PRD §28 requires highlighting relevant Ticket cells.
- [Winner service](../../backend/src/modules/claims/winner.service.ts) returns winner/participant/Pattern data; [WS schema](../../backend/src/realtime/events.ts) provides winner ID, participant name and Pattern. Neither currently supplies contributing Ticket cell IDs.
- The browser must not reconstruct eligibility or choose an arbitrary five cells for Early 5.
- Resolve which authoritative cells constitute the presentation evidence, especially Early 5 when more than five Ticket keys have been drawn, and how own-winner REST recovers the same evidence after reconnect.
- Needed evidence: approved server DTO/security semantics and regression scenarios for all five Patterns, Early 5 ambiguity, identity isolation, missing evidence and refresh/WS convergence.
- Generic Winner/Pattern display is implementable now but does not complete §28. A display-name match is never proof of the current participant's win.

<a id="g02"></a>
## G02 — Complete Question/Key search, filters and used state

**State:** unresolved; blocks ticket 12 full completion.

- Frontend PRD §31 requires search/filter and controls respecting used-data immutability.
- [Question schemas](../../backend/src/modules/questions/question.schemas.ts) and [routes](../../backend/src/modules/questions/question.routes.ts) provide scoped pagination/CRUD; do not assume unsupported full-dataset search/status filters exist.
- Specify search scope, filters and authoritative used/immutable-state presentation after inspecting existing returned fields. An explicitly labelled loaded-page filter is truthful but does not silently fulfill global dataset search.
- Inspect existing backend DTOs before extending them; reuse returned immutable/used information where present.
- Needed evidence: an agreed complete-dataset UI/API contract or explicit product-approved scope refinement, pagination/filter scenarios, immutability rejection handling and role/Event isolation.
- Question bulk import is conditional in the PRD ('where supported') and currently has no route. No bulk import is planned. There is no invented Key DELETE.

<a id="g03"></a>
## G03 — Participant Ticket identifier and import status

**State:** unresolved; blocks ticket 13 full completion.

- Frontend PRD §32 asks for Ticket identifier and import status alongside Participant management.
- [Participant DTO](../../backend/src/modules/participants/participant.types.ts) supplies identity/Event/status and emailDeliveryStatus/error, not per-Round Ticket identifier or durable import history.
- [Admin Ticket reads](../../backend/src/modules/tickets/ticket.routes.ts) already list Round Tickets. Evaluate a bounded authorized read/composition before deciding a backend extension is needed. Unloaded joined pages are not proof a Participant has no Ticket.
- Clarify the Round represented by 'Ticket identifier' and distinguish import outcome from credential-delivery status. Immediate CSV report and email-delivery fields do not establish persistent import-job history.
- Needed evidence: agreed scope/read composition or approved backend field contract, permission/pagination/loading scenarios and actual missing-versus-unloaded state tests.
- The Participant PATCH schema does not permit Event reassignment. Display existing assignment and use supported creation, without inventing reassignment controls.

<a id="g04"></a>
## G04 — Announcements

**State:** consumption defined; no admin authoring feature planned.

- [WS events](../../backend/src/realtime/events.ts) include ANNOUNCEMENT, but inspection found no admin producer route.
- Ticket 21 consumes allowed incoming announcements and tests that UI with a safe fixture. It does not claim a production announcement has been sent.
- A new admin composer/producer requires its own product/backend requirement. Verified Winner announcements use the existing WINNER_VERIFIED flow.

<a id="g05"></a>
## G05 — Eligibility, rejection reason and winning identity

**State:** existing-contract presentation approved.

- Frontend PRD §27's available Pattern illustration is not an eligibility API.
- [Round DTO](../../backend/src/modules/rounds/round.types.ts) supplies enabled/configured OPEN/CLOSED Patterns. [Claim service](../../backend/src/modules/claims/claim.service.ts) evaluates eligibility only on submission; Participant Claim responses omit the stored rejection reason.
- Ticket 06 displays Pattern configuration/open state, lets the server validate, and polls/refetches pending Claims for terminal state. There is no participant rejection event.
- Use generic rejected status when the backend supplies no reason; do not infer incomplete Pattern from an admin rejection or exhausted capacity. A truthful 'eligible now' indicator or detailed rejection reason would need explicit server evidence.
- Winner messages contain public display names, not sufficient authenticated own-winner identity. Refetch own wins for that decision.

<a id="g06"></a>
## G06 — Lifecycle, timing and mutation affordances

**State:** existing-contract presentation approved.

- [Round types](../../backend/src/modules/rounds/round.types.ts) include RECOVERY_REQUIRED and CANCELLED, absent from the simplified frontend sample model. All lifecycle states must be represented.
- There is no server Round countdown field. Use actual schedule information only where provided, otherwise show waiting; a timer cannot transition a Round.
- DRAW_CREATED contains both question and key. Their animation sequence is presentation, never hidden server-timed reveal or a marking lock.
- [Realtime routes](../../backend/src/realtime/realtime.routes.ts) and [subscription service](../../backend/src/realtime/subscription.service.ts) limit allowed states. Lobby/terminal clients need REST observation rather than an endless rejected socket loop.
- [Recovery route](../../backend/src/modules/recovery/recovery.routes.ts) is Admin Round recovery; no generic /super-admin/recovery/* implementation was found. Super Admin reuses allowed operations and system reads.
- [Mark routes](../../backend/src/modules/marks/mark.routes.ts) include unmark, but the frontend PRD only requires marking. No extra undo affordance is planned.

<a id="g07"></a>
## G07 — CSV preview and progress

**State:** synchronous-import presentation approved.

- Frontend PRD §32 requests preview, validation, confirm, progress and summary.
- [Import route](../../backend/src/modules/participants/participant.routes.ts) and [service](../../backend/src/modules/participants/import/import.service.ts) implement one synchronous upload and final report, with no asynchronous job/dry-run/progress API.
- Ticket 14 provides local syntax/preview, explicit confirmation, indeterminate processing and actual server business-validation/import/delivery results.
- Local preview must not duplicate server account/business validation or promise database checks happened before upload. No invented row percentage, durable import job or automatic retry.
- Server-side preflight validation or durable import progress would require a separately scoped backend contract, not silently added by a frontend agent.

