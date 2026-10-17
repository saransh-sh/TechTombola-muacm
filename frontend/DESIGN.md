# Tech Tombola visual system

Reference inspected on 2026-10-17: [Hacktoberfest](https://hacktoberfest.com/), page title “Hacktoberfest 2026 | AI belongs to everyone”. Desktop and mobile screenshots were captured at 1440×1000 and 390×844. The implementation borrows the requested event energy, not its logos or content. Exact source font and color values were not extracted; tokens below are deliberate approximations.

- Desktop reference: [hacktoberfest-2026-10-17-desktop.png](design/reference/hacktoberfest-2026-10-17-desktop.png)
- Mobile reference: [hacktoberfest-2026-10-17-mobile.png](design/reference/hacktoberfest-2026-10-17-mobile.png)
- Rendered login, desktop 1440×1000: [login-desktop.png](design/screenshots/login-desktop.png)
- Rendered login, mobile 390×844: [login-mobile.png](design/screenshots/login-mobile.png)
- Admin dashboard, desktop 1440×1000: [admin-dashboard-desktop.png](design/screenshots/admin-dashboard-desktop.png)
- Admin dashboard, tablet 1024×900: [admin-dashboard-tablet.png](design/screenshots/admin-dashboard-tablet.png)
- Event management, desktop 1440×1000: [admin-event-management-desktop.png](design/screenshots/admin-event-management-desktop.png)
- Participant management, desktop 1440×1000: [admin-participant-management-desktop.png](design/screenshots/admin-participant-management-desktop.png)
- Participant CSV import preview, desktop 1440×1000: [admin-participant-csv-import-desktop.png](design/screenshots/admin-participant-csv-import-desktop.png)
- Round configuration, desktop 1440×1000: [admin-round-configuration-desktop.png](design/screenshots/admin-round-configuration-desktop.png)
- Round operations, desktop 1440×1000: [admin-round-operations-desktop.png](design/screenshots/admin-round-operations-desktop.png)
- Round operations, mobile 390×844: [admin-round-operations-mobile.png](design/screenshots/admin-round-operations-mobile.png)
- Question and Key management, desktop 1440×1000: [admin-question-key-management-desktop.png](design/screenshots/admin-question-key-management-desktop.png)
- Draw control, desktop 1440×1213: [admin-draw-control-desktop.png](design/screenshots/admin-draw-control-desktop.png)
- Draw control, mobile 390px wide: [admin-draw-control-mobile.png](design/screenshots/admin-draw-control-mobile.png)
- Claim review, desktop 1440px wide: [admin-claim-review-desktop.png](design/screenshots/admin-claim-review-desktop.png)
- Claim review, mobile 390px wide: [admin-claim-review-mobile.png](design/screenshots/admin-claim-review-mobile.png)

The rendered login, dashboard, Event, Round configuration/operations, Draw control, Claim review, Question/Key, Participant and CSV import captures use mocked API responses; they document browser rendering, not real backend integration. Round operations display backend-reported Ticket counts and readiness errors. Recovery remains unavailable until the backend publishes a confirmed recovery command. The CSV import response currently omits per-Participant credential-delivery status; the UI points admins to the refreshed Participant list for that status.

## Tokens

- Forest `#315c53` for the page field; warm cream `#f4ecd6` for the form; coral `#ef8076` for action and emphasis; near-black `#1d2421` for outlines and text.
- Condensed system sans for display and interface text, with system monospace for metadata, status and small labels. No remote font dependency.
- 20–72px responsive page gutters; login content uses a two-column desktop composition and one column below 700px.
- Rectangular controls and surfaces, 1–2px dark outlines, hard 4–8px offset shadows, no blur.
- Focus uses a visible coral outline; active buttons translate with their shadow; pending actions disable the submit control. Reduced motion removes the transition.

## Responsive behavior

The sign-in form remains full-width within a 430px maximum panel. At narrow widths, the intro precedes the form, gutters remain 20px, and heading size scales with viewport width. No information is communicated by color alone; errors and labels are textual. Future Ticket layouts must keep the server's 3×9 geometry and reflow surrounding content without changing cells.
