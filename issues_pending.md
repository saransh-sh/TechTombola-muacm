# Ticket 17 — Pending Work

Branch: `feature/anushka/live_display_feed_ticket_17`

## Status and record mismatch

This branch's issue spec says `ready-for-agent` and leaves acceptance/evidence checkboxes unchecked. The later Ticket 20 snapshot marks Ticket 17 `in-progress`. Verify the implementation and evidence below, then update the status consistently.

## Verify before closure

- Confirm REST recovery and public WebSocket events represent the same committed state.
- Verify explicit serialization for ACTIVE, PAUSED, RECOVERY_REQUIRED, COMPLETED, and no-live states.
- Prove responses cannot include data from another Event.
- Add/verify a strict serializer regression test that fails if a sensitive field is added.
- Confirm unverified/rejected Claims and undrawn Questions/Keys stay out of public responses.
- Attach public DTO/null-state/event examples and field-allowlist, query-plan, concurrency, and REST/WS convergence evidence.
- Run the ticket's canonical backend checks and record their results.
- Complete the required Standards/Spec review.

This note records missing branch evidence; it does not assert that each behavior is currently defective.
