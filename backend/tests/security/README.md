# Ticket 21 Security Suite

## Scenario inventory

This suite treats the registered Fastify routes as the source of truth for coverage and makes every route's role and data boundary explicit.

| Scenario | Coverage |
| --- | --- |
| Registered HTTP routes and WebSocket channels appear exactly once | `route-inventory.test.ts` compares the inventory to Fastify's runtime route tree. |
| Every protected operation has an explicit role and scope decision | `route-inventory.test.ts` rejects missing role/scope rationale; scoped Participant routes are called out for cross-identity probes. |
| Unauthenticated and wrong-role access | Generated from `PROTECTED_ROUTES`. The route suite replaces token validation with synthetic principals to exercise the actual registered guards without a database. Auth token/session persistence remains covered by `tests/integration/auth.test.ts`. |
| Wrong Participant and Event identifiers | **Incomplete in this branch.** The inventory identifies each Participant Event-scoped route, but it does not yet execute generated foreign-owner/Event requests for each route. Existing integration tests cover Ticket substitution only. |
| WebSocket authentication and subscription scope | `realtime.routes.test.ts` covers authenticated/public channel separation, invalid scope, client mutation frames, and revocation. |
| Cookie/session handling, inactive identities, and login throttling | `tests/integration/auth.test.ts` covers session cookies, inactive accounts, role guards, revocation, and throttling. |
| Safe errors and secret redaction | `tests/integration/errors.test.ts` and app error handling assert safe public errors; log redaction is configured in `src/app.ts`. |
| Future-key and unpublished-question secrecy | **Incomplete in this branch.** Existing Issue 04–20 serializer/endpoint behavior needs dedicated adversarial response and WebSocket scans here. |
| Oversized request/frame limits | The app configures WebSocket inbound frames to 64 KiB; Fastify's default JSON body limit and multipart's 10 MiB limit remain runtime configuration. A real network-level oversize-frame check is not yet in the focused suite. |
| Secret scans across logs, audit, and idempotency outcomes | **Incomplete in this branch.** Existing redaction and audit unit tests are supporting evidence, not a generated black-box scan across every sink. |

## Coverage boundaries and dependencies

- Admin and Super Admin operations are role-global by the current API contract. Cross-owner/Event denial is N/A for those operations; role guards still apply. Their evidence is the role matrix and the service/repository scope contract.
- `/me` and the authenticated WebSocket channel are identity-scoped, not Event-owned. A valid session is required; Event substitution is N/A for `/me` and must be rejected by the authenticated subscription service for WebSocket requests.
- Participant endpoints are Event-bound by the authenticated Participant profile. Each applicable route needs a concrete generated request using another Participant's Ticket/Cell/Claim/Winner or another Event's Round; tests must not infer protection from a missing resource alone.
- This branch starts from Ticket 20. Earlier Tickets 04–20 provide required APIs, database migrations, and realtime behavior. Their contract failures are upstream dependencies and are recorded in branch completion evidence rather than silently papered over here.
- No durable email-job table exists in this branch's schema. Email-job database scanning is therefore N/A; provider-boundary checks from Ticket 20 remain the available evidence.
- No upstream code blocker from Tickets 04–20 has been confirmed by the inspection completed so far. The missing adversarial cases above are implementation work still outstanding in Ticket 21, not attributed to a prior ticket.
- This is an automated regression suite, not an external penetration test or security certification.

## Local execution

The focused `test:security` suite currently runs without PostgreSQL. Database-backed auth, ownership, and end-to-end security scenarios require `E2E_DATABASE_URL` to point at an isolated-capable PostgreSQL server; it must never target a developer or production database. This environment had no PostgreSQL listener on port 5433, so those scenarios and the full integration/E2E gates could not be verified here.
