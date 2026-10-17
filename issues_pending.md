# Ticket 11 — Pending Work

Branch: `feature/anushka/display_live_11`

## Status and record mismatch

This branch's issue spec still says `ready-for-agent` and leaves its acceptance and completion-evidence checkboxes unchecked. A later stacked snapshot marks Ticket 11 done. Resolve that discrepancy by checking the evidence below against this branch before treating the ticket as complete.

## Verify before closure

- Confirm expired and revoked sessions cannot connect or remain subscribed.
- Confirm Admin-only Claim events never reach Participant or public sockets.
- Confirm broadcasts follow committed domain events only.
- Confirm REST remains authoritative after reconnect and there is no replay log or broker.
- Attach event envelope, payload, audience, close, and error examples.
- Attach evidence for the 500-connection smoke run, heartbeat, reconnect, and cross-channel isolation.
- Run the ticket's canonical backend checks and record their results.
- Reconcile the issue status and complete the required Standards/Spec review.

No conclusion is recorded here that these behaviors are broken; the branch's own spec currently lacks completion evidence.
