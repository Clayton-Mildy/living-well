# Round 13 phase 2 (+2b, task 9) rulings (controller, on KC's behalf)

- Task 1: review Approved (3050e6a..6ab3f14) — Ruling: a visits-only edit shows a read-only "Takes effect from · next invoice" row, no Tell-the-team switch (club.updateSettings has no notify; a no-op switch would mislead). Cost if wrong: a small action-level follow-up.
- Task 2: review Approved (3050e6a..889ba14) — Ruling (supersedes plan ruling 3): monthly rows and the Month report pipeline count MOVES in the period (opened/visited/trial/lost by move date; joined by the approved member's membership start, reconciling with the Members group); conversion = cohort of leads opened in the 3 whole months before the period's month, captioned so. Cost if wrong: copy + ~40 test lines.
- Task 3: review Approved (1a95628..00b73a8) — Ruling: staff-facing status stays "Paid" while a desk payment waits (the balance drives it; the row and invoice sheet carry "waiting for finance")
- Task 4: review Approved with a required fix (352c383..e1789a0) — Important: TrendChart readout head shows a weekday for a monthly point → dateLabel prop. Ruling: on a partial-month period the revenue hero tile shows "so far this month" instead of its delta (the Money row keeps the same-length comparison); tell KC. Cost if wrong: ~8 lines.
- Task 6: review Approved (352c383..6c1fd26) — Ruling: "N of 5 days left" = allowance − approved (waiting shown beside), as planned
- Task 7: review Approved (b11927b..8eb8072) — Ruling: hr badge stays beside the Approvals badge for now. Minor (deferred): bulk-reject dialog names the first person only; hub note limit 240 vs 200; History "N of 5 left" after own deduction.

## Deferred minors
- Task 1: minor (deferred): rulesBody misnamed; no mixed price+visits test; mixed edit's single effective date is pre-existing ambiguity
- Task 2: minor (deferred): gated join's approval date not recorded as a move; reopen into an unreached stage records an undo; timeline dates lack weekday
- Task 2: minor (deferred): rebooking moves a visit's month; multi-month period conversion uses the first month; pipeline joined counts lead-born members only
- Task 3: minor (deferred): simulateVa uses the staff balance while a desk payment waits; Month report outstanding counts waiting payments (as planned)
- Task 4: minor (deferred): jt abbreviation hard-coded; April collected 0 is a seed artefact; summary-order test loose; e2e s9 owed in the Final step
- Task 6: minor (deferred): Hours tab edits not coupled to requests; Team view clamps to today; reasons visible to all staff (known design)
- Task 9: minor (deferred): sendForm on an expired link drops the saved draft; Save-for-later tap during an in-flight push shows no "Saved."; late draft response can replace the thanks view; saved lang not restored
