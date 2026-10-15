# Tech Tombola

Agreed v2 direction, 15 October 2026: one room-based technical Tambola game for
1,000 users. [Backend rules](docs/TECH_TOMBOLA_BACKEND_PRD.md),
[frontend UX](docs/TECH_TOMBOLA_FRONTEND_PRD.md).
V1 Event/Round scope and old 24-ticket plan are superseded.

| Term | Meaning |
|---|---|
| User | USER role; plays. Participant is an older synonym, not another profile. |
| Admin | Creates/imports users, creates/operates rooms, verifies claims, monitors logs. |
| Super Admin | All Admin rights plus creating/disabling admins. |
| Room | One game, join code/QR, lobby, tickets, questions, reveals and history. |
| Lobby | Joining, instructions and isolated sample practice. |
| Question | Technical clue with one predefined Key; no textual answers submitted. |
| Key | Answer label on ticket; own labels visible, unrevealed question mapping private. |
| Presented question | Server-selected question shown without answer mapping; replaces v1 combined Draw. |
| Reveal batch | Admin-published question/answer pairs, default batch size 10. |
| Ticket | Immutable 3×9: 15 unique Keys, five/row, 12 blanks; one/user/room. |
| Cell | Populated Key position or blank. |
| Mark | Persisted selection, allowed before reveal; server marks plus revealed Keys determine claims. |
| Claim | Validated pattern assertion with immutable evidence snapshot and server order. |
| Pattern | Early 5, Top/Middle/Bottom Line, Four Corners, Full House; one winner each. |
| Four Corners | First/last populated cells of top/bottom rows, not necessarily geometric corners. |
| Winner | Earliest pending eligible claimant explicitly verified by admin. |
| Presentation | Read-only question-only or explicit batch-answer projector view. |
| Activity log | Durable structured actions/outcomes with source/trust level. |
| Client telemetry | Best-effort untrusted browser reports; insufficient alone to disqualify. |
| Silent alert | Admin-only operational/security signal, no sound/public notification. |

Use Room instead of adding Event/Round entities. Ten questions are not ten
rounds. Distinguish ticket count from cell count. No numerical points system.
Lifetime analytics are deferred; room logs/history persist after completion.
