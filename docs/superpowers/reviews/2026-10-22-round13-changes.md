# Round 13 — everything that changed (for KC's review, 22 Oct 2026)

Phase 1 is on `main` (merged this morning). Phase 2 is on branch `round13` (complete at 1d5e584: nine tasks, final review and fixes, 1834 unit tests and 278 phone e2e green, demo reset). Not merged to main yet. Sign in with `citra123`; the demo day is Thursday 22 Oct.

## Phase 1 — quick wins (on main)

1. **Renames.** "Needs attention" → **Health attention**; "Check on" → **Haven't come lately**. Members page filters, the Arrivals rail, Overview and the Month report (`Haven't come lately` / `Lama tidak datang`).
2. **Approvals bottom bar** (ega). Page-colour background with a hairline, quiet "Select all / Clear", **Approve** in ink and **Reject** secondary, both 44 px, greyed when nothing is selected. Same on the wide layout.
3. **Title "Other"** with free text. New lead, Add member (Person step), the online form and the edit-details dialog share one title field: Oma / Opa / Ibu / Bapak / **Other** → text (max 20). Both paths produce the same member. Initials and the printed registration form follow the title.
   *Ruling:* gender is guessed from the title (Oma, Ibu, Tante, Bu, Nyonya, Nenek, Mbak, Mama, Mrs, Ms, Miss, Madam, Aunty, Nona, Mami = she); any other free text = he, until an explicit gender choice exists.
4. **Lobby duties** (caca → Tasks). "Check-ins · n" and "Check-outs · m of n", each opening Arrivals on the matching tab; the quick-tasks popup shows the same counts.
   *Ruling:* Check-ins is "done" once anyone is in and never goes late (nudges the lobby completion % up one tick a day).
5. **Guest hosts for the front desk.** "Guests today" block on the Arrivals rail (host, time, activity → opens the read-only session); lobby notification when a guest is booked or cancelled (cancel withdraws the booked notice); lobby gets a read-only Guests page without fees; one guest seeded on the demo day.
   *Ruling:* on non-Wednesdays the seeded guest takes over the 10:30 slot with their own activity (today: Bu Ratna, Angklung ensemble, instead of the Gardening club).
6. **Portraits for all 40 roster members** (free Unsplash photos, sources in `apps/web/public/demo/SOURCES.md`). Nine swapped after review; m80 (Opa Ferry, roadside backdrop) is the one you may still want to change.

## Phase 2 — after the review (on round13)

7. **Plans page in sections** (ega → Manage → Plans). Five sections: **Plans** (Flex + Gold; the "Flex visits per month" rule now sits inside the Flex card, the separate Club rules card is gone), **Extra charges** (Extra day, Leave month), **One-off fees** (Registration, 2-day trial), **Changes** ("Takes effect from" + "Tell the team"), **Next invoice preview**. Behaviour unchanged.
   *Ruling:* a visits-only edit shows "Takes effect from · next invoice" read-only, no "Tell the team" switch (that action has no notification).
8. **Lead history** (Enquiries). Every lead keeps a history of its moves (new → visit → trial → joined / lost, with dates and who); each lead card shows a timeline line; a **Leads | History** switch opens a per-month view: Opened, Visited, Trial, Joined (with %), Lost with reasons. The Month report pipeline reads the same numbers.
   *Ruling:* monthly rows count what happened in that month (joins dated by the membership start, so October reads 2 joined); the % is a conversion of leads opened in the three months before (October: 38%), shown on the Joined row only.
9. **Front desk: plan change and payments** (caca on a member's profile).
   - Plan tab → change plan → it becomes a request management approves in Approvals (pending banner with Withdraw); lobby's date is fixed to the 1st of next month; the family is told when applied.
   - Billing tab → **Record payment** (cash or bank transfer, up to the balance) → "Recorded by Caca, waiting for finance". Fransiska confirms on Payments ("Waiting for you") or Ega in Approvals → **Payments**. Until confirmed: families, Xero, refunds and the Month report "Collected" do not see it; staff see the invoice as Paid (with the waiting line). Reject reopens the invoice.
10. **Month report hero** (ega → Month report). Four tiles above the groups: **Revenue collected**, **Active members** (41), **Mood index** (3.7), **Enquiry → joined** (38%), each with a six-month sparkline (Apr–Sep) and a delta; tapping a sparkline reads the month. The owner summary text leads with the same four numbers.
   *Ruling:* while the period is a partial month ("This month" today) the revenue tile says "so far this month" instead of a delta, because the same-length comparison (1–22 Oct vs 9–30 Sep) spans the invoice run and read "−Rp 87 M". The Money row keeps its delta.
11. **Surveys for the front desk** (caca → More → Surveys). The live family survey only: results, details, **Send to a contact**. Create/edit/close stay management.
12. **Staff leave** (5 days a year). Any staff: Account → Leave (and the bottom of Tasks → Mine) → "4 of 5 days left this year", **Ask for leave** (dates, reason). Ega: People → person → **Leave** tab (balance, pending with Approve / Decline, year history); People rows say "Leave asked"; bell item "Caca asks for 2 days off from 9 Nov"; approved days show as "(on leave)" on the Team view. Seeded: Dinar and Caca approved, Caca pending (9–10 Nov), Chef Agus declined.
    *Ruling:* the Leave tab takes Attendance's place and Attendance stays after it, renamed **Hours** (clock in/out kept). The spec said replace; removing it would have cost management a working feature.

13. **Leave requests in Approvals** (your review note). Ega's Approvals list has a **Leave** tab after Payments: Approve / Reject (with an optional note) and "Approve all"; the bell item points there; People → Leave still works.
14. **Every picture opens full size** (your review note). Kitchen lunch and tea tiles, camera drafts, scans and KTP previews, receipts, rejected activity pictures, the activity catalog picture, staff and profile photos; the ✕ stays a separate target.
15. **The online registration form is stepped** (your review note). Five steps like the staff flow, Back / Continue, per-step errors; the draft is saved on the phone and through the link, so the family can continue on any phone; if two phones edit, a choice appears; the lead card reads "In progress · step n of 5"; Join pre-fills from the partial draft.
    *Ruling:* the form renders at zoom 1 (about 14% larger than the app) so chips and buttons reach 44 px.

## Things to decide or overrule
- Gender from title (3) — add a gender choice under "Other"?
- Revenue tile "so far this month" (10) — or show the delta anyway?
- Hours tab kept (12) — or remove as originally said?
- Portrait m80 (6) — swap?
- The Attendance → Leave e2e, survey e2e and hero e2e were written in the final step; its report says whether all pass.

## Where things are
- Spec: `docs/superpowers/specs/2026-10-22-round13-lobby-owner-design.md`; plans: `docs/superpowers/plans/2026-10-22-round13-phase1.md`, `…phase2.md`.
- Phase 1 final review + rulings: `docs/superpowers/reviews/2026-10-22-round13-phase1-*.md`. Phase 2 reviews: `.superpowers/sdd/2026-10-22-round13-phase2/` (not committed).
- After `pnpm db:reset` the API must be restarted or it serves stale state.
