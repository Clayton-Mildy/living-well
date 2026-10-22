# Round 13 phase 2 (+2b, task 9) — final review before merge

Range 6950139..262c20e (branch round13), 137 files, +12,761/−390. Reviewed read-only in three passes: (1) shared actions, rules, project.ts, notify.ts, server routes, schema and migration; (2) the web layer (Approvals hub, finance desk payment, Month report, Surveys, People/Leave, PublicForm + onlineForm, ImageLightbox and the picture sites, Enquiries/History); (3) seeds, i18n EN/ID, e2e edits, the server route tests. No binaries in the range. Nothing was run except reading; the e2e re-run and demo reset belong to the other agent.

## Strengths
- Role boundaries are enforced server-side on every widened action, with parsed input available to `can`: `approval.approve/reject` lets finance through only for `type === 'payments'` (approvals.ts:337,343); `survey.send` lets lobby through only with a `familyId` and then checks live + family + has-app + not-already-sent (club.ts:556-570); `payment.record` for lobby demands an invoice, cash/transfer and `amount <= balance` (finance.ts:253-261); `members.changePlan` for lobby pins the date to the 1st of next month and stays gated (members.ts:420-436); `enquiry.formSave` is system-only and token-bound; `leave.*` use isStaff / mgmtOnly / requester-while-pending.
- The family projection is clean: `leaveRequests` and `enquiries` are never populated (project.ts:33 starts every collection at `{}`), waiting payments are filtered by `isConfirmed` and the mark stripped (project.ts:68), and the server test asserts `fam.state.leaveRequests` is `{}`.
- `isConfirmed` is applied everywhere "collected" is computed: `paymentsBoard` (rules/finance.ts:152), `refundableOn`/`paymentView` (refunds impossible on a waiting payment), the Month report `side()` (monthReport.ts:68), the hero tiles via the same Delta, project.ts. Held payments carry `xero: 'notSent'` so the Xero sweep (finance.ts:52,57) never pushes them, and `REJECT.payments` re-opens an invoice a sweep had marked synced.
- Leave decisions share one code path (`decideLeave`) between People → Leave and the Approvals hub, with a dry-run `tryRun` so a balance that no longer covers the request surfaces as a conflict instead of a throw.
- The draft route is defended properly: content-length required and capped (413), per-token 2 s guard that only counts real writes (so a no-op save or 429 never starves a real one), `rev` precondition → 409 that hands back the server copy, lenient shape-only parse with bounded strings, and the client handles 429 (wait + retry ×3), 409 (choice sheet, nothing written until chosen), expired and done. The server tests cover each branch, and the e2e covers resume after reload.
- Lead history: every stage-changing action appends (create, move with undo flag, bookVisit/bookTrial with dedupe, markLost with reason, reopen, convert incl. gated, afterReject/withdraw); seeded past leads have no `next`, ids are `e-h-*`, and both seed files draw nothing from the RNG. The History view, the Month report pipeline and the hero conversion read the same `leadMoves`/`leadConversion`.
- Migration 0006 matches the generic table shape, the snapshot and journal are present, `leaveRequests` is in `COLLECTIONS`, the schema named export and the seed test; `SETTINGS.leaveDays: 5`.
- i18n parity is guaranteed by `Same<typeof EN>` on every ID file (typecheck clean); the ID strings read naturally ("Sisa cuti tahun ini 4 dari 5 hari", "Dicatat Caca, menunggu keuangan").
- e2e edits are honest: each of the three changed assertions reflects an intended behaviour change (rejected picture opens, receipt thumbnail is a button, Attendance → Hours).
- Pictures: one `ImageLightbox`/`ImageOpen` pair, 44 px X, Escape captured so a sheet beneath stays open, back gesture, portal bubbling stopped; the lunch tile's remove X stays its own 44 px target above the open button.

## Issues

### Critical
None.

### Important
1. **A desk plan change approved on or after the 2nd of next month is silently skipped and can never be approved.** `packages/shared/src/actions/members.ts:434` (`if (effective < ctx.today) ctx.fail('members.err.effectiveInvalid')`) runs again on approval: `approveChange` (review.ts:32) replays `def.run` with the approving manager's `ctx.today`. The desk's date is forced to the 1st of next month, so if Ega approves on 2 Nov the replay throws, `APPROVE.profile` maps any code other than `err.reviewConflict` to `'skip'` (approvals.ts:139), and the request stays pending with no message. Finance's gated change had the same hole before, but finance could pick any date; the desk cannot. Fix (3–4 lines + one test in members.test.ts): in `members.changePlan.run`, only apply the past-date check when the action is not a replay (e.g. `ctx.actor === actorOf(ctx.user)`), and on a replay accept an `effective` on or after the 1st of its own month so the entry is back-dated to the 1st as the desk asked; alternatively map `members.err.effectiveInvalid` to `'conflict'` in `APPROVE.profile` so management at least sees it. The first is what management would expect ("I approved it late; it still starts on the 1st").

### Minor
2. **"so far" wording differs between the tiles and the owner summary.** `HeroTiles.tsx:31-33` and `MonthReport.tsx:81` say "so far this month" only when the period runs from the 1st of the current month and "so far" otherwise; `OwnerSummary.tsx:33,36` always says "so far this month" on any partial period (Last 3 months ending today, a custom range). Fix: pass the same `thisMonth` test into `ownerSummaryLines` (or compute it from `r.period` and today there).
3. **Management gets two bell entries for one desk payment.** `payment.record` tells `['finance','mgmt']` directly (`finance.ts:274` via `tellFinance`) and `notify.ts:61` adds the mgmt action item "Payments waiting for your confirmation: n". Finance gets one of each too, which is fine (notice + to-do), but for management the per-payment notice duplicates the action item. Fix: send `finance.notif.paymentToConfirm` to finance only.
4. **Confirm / Reject on the Payments waiting row, "Cancel request" (MyLeave) and "Cancel leave" (LeaveTab) are 34 px `PillBtn`s** (finance/parts.tsx:234, mgmt/common.tsx:205). Consistent with the existing Refund pills on the same page, but below the 44 px target the round asks for. Fix: `Button size={44}` or a `PillBtn` height prop for these three action spots.
5. **`people.err.leaveTooMany` is worded for the requester but also shown to management.** `decideLeave` (staffLeave.ts:46) fails with it when approving a request the balance no longer covers; the text "That is more than you can still ask for this year ({left} left after the ones waiting)" reads oddly as a toast to Ega, and `{left}` there is the approved-only balance (no "waiting"). Fix: a second key for the decision side ("Only {left} of 5 left; this request needs {days}").
6. **History view label "Visited" counts the month a visit was booked, not the visit day.** `leadMoves` (rules/enquiries.ts:98) counts moves by `m.at`, and `bookMove` stamps the booking time; a visit booked 30 Oct for 3 Nov counts under October. The ruling chose move dates; the label is what misleads. Fix: "Visit booked" / "Trial booked" (`enq.hist.visited`, `enq.hist.trial`), or count by `m.date` in a later round.
7. **`lastDraftWrite` grows forever** (public.ts:36): one entry per token that ever saved, never pruned. Negligible for this demo; a `setInterval` sweep of entries older than a minute, or a bounded Map, closes it.
8. **Management cancelling approved leave deletes every live `leave` StaffTime row in the range** (`clearRows`, staffLeave.ts:30), including one typed by hand on the Hours tab for the same days. Same family as the deferred "Hours tab edits not coupled"; harmless until someone mixes the two paths.

## Deferred-minor triage
All deferred minors can wait; none changes what a user sees on the demo day or lets a role do something it should not.
- Task 1 (rulesBody name, mixed price+visits test, single effective date): can wait.
- Task 2 (gated join's approval date not a move; reopen into an unreached stage records an undo; no weekday on timeline dates; rebooking moves a visit's month; multi-month conversion uses the first month; pipeline joined = lead-born members only): can wait. The multi-month conversion is captioned, and the e2e/browser walk confirmed the month view.
- Task 3 (`simulateVa` uses the staff balance while a desk payment waits; Month report outstanding counts waiting payments): can wait. The first in fact prevents a double payment in the demo.
- Task 4 (`jt` hard-coded; April collected 0 seed artefact; loose summary-order test): can wait.
- Task 6 (Hours tab edits not coupled to requests; Team view clamps to today; reasons visible to all staff in the snapshot): can wait; reasons appear in no UI except management's and the requester's own.
- Task 7 (bulk-reject dialog names the first person only; hub note limit 240 vs the action's 200; History "N of 5 left" after own deduction): can wait. Note the hub's REJECT.leave stores up to 240 characters directly (no `str(…,200)` on that path) — harmless.
- Task 9 (sendForm on an expired link drops the draft; Save-for-later during an in-flight push shows no "Saved."; late draft response replaces the thanks view; saved lang not restored): these appear already addressed in the tree — `enquiry.sendForm` carries `draft/step/savedAt/rev` to the new link (enquiries.ts:398-401), `pushDraft` sets `feedback` and loops on `again` (PublicForm.tsx:107-141), every response is dropped once `finished`/`submitting` (PublicForm.tsx:121), and `load()`/`adoptSaved` call `setLang(pick.lang)`. Confirm and strike them from the list.

## Declined to judge
- A family still sees the invoice as open (and could pay by VA) while a desk cash payment waits for finance: the spec says the family sees it once approved; `simulateVa` happens to block a double payment in the demo.
- Staff-facing invoice status reads "Paid" while a desk payment waits (ruling from Task 3; the row and sheet carry "waiting for finance").
- Monthly "visited/trial/lost" counted by move date and "joined" by membership start; conversion shown on the Joined row only: Task 2 ruling.
- hr badge and Approvals badge both counting the same leave request: Task 7 ruling.
- A manager requesting and approving their own leave: one manager in the club, documented in staffLeave.ts.
- `GET /api/public/form/:token` returning the whole saved draft (health included) to anyone holding the link: the round 10 design (the token is the secret); the draft route adds no new exposure.
- Lead `visit`/`trial` moves recording the booking moment rather than the day: follows the action's clock, consistent with the seed's `derive`.
- The timeline on the lead card showing the last four moves only: a density choice.
- Lobby nav gaining Surveys in the More grid rather than the tab bar: KC's order to decide.
- Finance unable to record a real payment or void an invoice while a desk payment waits (`invoicePaid`): the waiting payment must be rejected first, which is a sensible ordering.
- Plan change notice to the family firing at apply time rather than at the desk's submission: the spec says "family notified on approval".
- Leave inside one calendar year, no carry-over: out of scope by the spec.
- Pipeline "Visited"/"Trial day" rows losing their percentage subs in the Month report: follows the ruling that conversion is a cohort figure.
- Plans page look (card name moved into the section, 17 px row): restyle only, walked by KC's agent.

## Recommendations
- Land the Important fix (late approval of a desk plan change) with a test that approves a pending request with `today` in the following month, then merge.
- In the same pass, dedupe management's bell (finance-only direct notice) and align the owner summary's "so far" wording; both are one-liners.
- Next round: a "Paid · waiting for finance" badge on the invoice sheet (the browser walk already flagged the plain "Paid" as misleading), 44 px action pills, and either relabel "Visited" to "Visit booked" or count by the visit day.
- Keep `.superpowers/sdd/.../deferred-and-rulings.md` current: strike the Task 9 items that the fix commits resolved.

## Assessment — Ready to merge? **With fixes**
Everything the round set out to do is there, consistent across its seams (roles, family projection, approvals counts and history, Month report hero vs groups, lead history vs pipeline, seeds, migration, i18n) and backed by tests at the right layers. One Important defect remains: a desk plan change that management approves after the 1st of the following month is silently skipped by the approvals hub and stays pending forever. It cannot bite on the demo day, but it is a dead end with no feedback in a flow this round introduced, and the fix is a few lines plus one test. Fix that, then merge; the minors and the deferred list can follow.
