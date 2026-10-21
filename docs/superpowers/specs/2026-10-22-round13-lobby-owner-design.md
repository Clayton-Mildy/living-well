# Round 13: front desk powers, lead history, staff leave

Date: 22 October 2026 (00:40). Status: scoped with KC in chat; phase 1 approved as "quick wins first", phase 2 after the owner review.

## Why

KC's second batch of asks after walking round 12. The owner review is later today, so the round is split: phase 1 lands before the review (about 1.5 hours), phase 2 after it.

KC's answers that shaped the scope:
- Lobby plan and billing = change a member's plan from next month and record a cash or transfer payment; issuing or voiding invoices stays with finance.
- Lobby surveys = send the live family survey and see results; creating or closing stays with management.
- Month report "more interesting" = hero numbers with six-month trend lines above the four groups.
- Order: quick wins first (naming, approvals bar, title "Other", lobby duties, guest hosts), the rest after the review.

## Conventions

Same as round 12: shared immer actions in `packages/shared/src/actions`, pure rules in `rules`, dense phone-first UI, ink/grey/white, every string in EN and ID, approvals for non-management entries families would see, minimal tests (typecheck, unit for new rules/actions, one e2e pass).

## Phase 1 (before the review)

### 1. Section naming on the Members page
- The filter and section called "Need attention" becomes **"Health attention"** (`members.f.att`), since its rows are health flags (BP watch/alert, re-checks).
- The check-on filter, Arrivals rail block and Overview tile are renamed **"Haven't come lately"** (ID "Lama tidak datang"). The `checkOn` keys stay; only the texts change.

### 2. Approvals page bottom bar
`features/members/Reviews.tsx` phone toolbar (sticky bottom, ~L570–590): its white background sits on the grey grouped-list page and the actions blend in. Fix: background = the page background (`var(--cp-bg)` / the grouped-list grey), a top hairline, "Select all" and "Clear" as quiet text buttons on the left, **Approve** as a 44 px ink primary `Button`, **Reject** as a 44 px secondary `Button` with the rust text, both with their counts. The wide-screen gradient bar gets the same button treatment.

### 3. Title "Other" on New lead and Add member
- `Title` becomes `'Oma' | 'Opa' | 'Ibu' | 'Bapak' | (string & {})`; `TITLES` keeps the four presets. Parsers accept any 1 to 20 character title; validation `members.err.titleRequired` when empty.
- Forms: the title chips gain **Other**, which reveals a text field (placeholder "e.g. Tante"). Same component on New lead (`enquiries/dialogs.tsx`), the registration flow Person step (`TitleName`) and the online form, so both paths produce the same member.
- `memberName`, `initials`, `displayName` work with any title (initials strips the title by matching the member's own `title`, not a fixed list).

### 4. Lobby duties: check-in and check-out counts
`rules/tasks.ts` DUTIES gains `lobby.checkin` (every day, open from club open, due at close; parts = members checked in today, so the row reads "Check-ins · 23") and `lobby.checkout` shows its count the same way ("Check-outs · 21 of 23"). Both link to Arrivals (In the club / Gone home modes). Status: `done` when every checked-in member is out by close, `open` otherwise; never `late` during the day.

### 5. Guest hosts visible to the front desk
- Arrivals rail gets a **"Guests today"** block listing today's `guestSessions`: host name, kind icon, slot, the activity; tap → the session on the Calendar day.
- `guest.book` (the guest-host session booking action) notifies the lobby role (`guests.notif.booked`: "{host} comes {date} {slot}"), so the desk expects them.
- Lobby nav gets `guests` as a link-only key (EXTRA) so the block can open the Guests page read-only (no booking or pay buttons for lobby).

## Phase 2 (after the review)

### 6. Lobby: change plan and record payment
- Plan: lobby can start a plan change for a member from the profile Plan tab; it is a `PlanChangeRequest` that management approves (round 5 rule), effective from the 1st of next month, with the family notified on approval.
- Payment: lobby can record a cash or bank-transfer payment against an open invoice from the profile Billing tab (`payment.record`, `can` lobby|finance|mgmt); the entry is marked for finance review (approval type `payments`) and shows "Recorded by Caca, waiting for finance" until approved; the family sees it once approved.

### 7. Lead history
- `Enquiry.history: { stage, at, by, note? }[]` appended by every stage move, visit/trial booking, join and lost; seeded for the demo leads.
- Enquiries gets a **History** view: per month, leads opened, visits, trials, joined, lost (with reasons), conversion to joined; each lead card shows a timeline of its moves with dates. The Month report pipeline group reads from the history instead of proxies.

### 8. Lobby surveys
Lobby nav gets Surveys: the live family survey's results and the "Send" action to a contact; create, edit, close stay management-only (`can` on `survey.create/update/close/delete` unchanged, `survey.send` widened to lobby).

### 9. Month report: hero numbers and trends
Above the four groups, four hero tiles: revenue collected, active members, mood index, enquiry → joined conversion, each with its value, the delta and a six-month sparkline (`TrendChart`), computed from `monthReport` over the last six whole months. The owner summary text leads with the same four numbers.

### 10. Staff leave requests
- New collection `leaveRequests { staffId, from, to, days, reason, status: 'pending'|'approved'|'declined', decidedBy?, decidedAt?, note? }`; 5 days a year per staff member (`settings.leaveDays = 5`).
- Any staff member requests leave from Account (or Tasks → Leave): dates, reason (required). Management approves or declines from People → **Leave** tab (replaces the Attendance tab): per person the balance ("3 of 5 left"), pending requests with Approve / Decline, and the year's history. Approval writes `staffTime` rows (`kind: 'leave'`) for the days so the duty tracker and team views see them. Notifications both ways.

### 11. Plans and billing sections
KC: "section the plans and billing better". To be detailed with KC after the review (which page, which groups); not planned yet.

## Out of scope
Finance invoice issuing by lobby, survey creation by lobby, payroll, leave carry-over between years.

### 5b. Portraits for every member (added 22 Oct 01:xx)
All 40 roster members get a stock portrait (free Unsplash photos, matched to gender and age, recorded in SOURCES.md) so no member shows initials. Phase 1.
