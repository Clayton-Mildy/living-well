# Handoff — where round 19 stands (updated 4 Nov 2026)

Read this first when picking the work up in a new session. Rounds 16 and 17 are done; round 17 is merged into `main` locally (not pushed). Their notes follow round 18.

## Round 19 (branch `round19`, not pushed)
Spec `specs/2026-11-04-round19-design.md`; plan `plans/2026-11-04-round19.md`; progress log `.superpowers/sdd/2026-11-04-round19/`.

### Status
- Track A: upgrade notice days (`notice.upgrade`, default 1) and `leaveMaxMonths` (default 2) in Settings; the seeded terms use `{upgradeDays}` and `{leaveMaxMonths}` (still version 1). Merged.
- Track B: one Contacts menu; the `directory` key is retired and `/directory` redirects. Merged.
- Track C: a field trip blocks its day in the weekly schedule builder (`[data-trip-block]`); Few visits is a button on Next month › Members (`few-btn`). Merged.
- Task 6: seed terms, `e2e/round19.spec.ts`, screenshots in `artifacts/shots/round19/`; round 17p2 and round 18 specs updated for the button and the upgrade field.

### Rulings made without KC (easy to reverse)
R1 upgrade notice joins `NOTICE_KINDS`; `changeKind` returns a third value `'takeBack'`, treated as "before the 1st". R2 `leaveMaxMonths` lives on `ClubSettings`, saved by `club.updateSettings`, not in `notice`. R3 the Contacts merge is done by reading: `accessOf` takes the more permissive of the `contacts` and `directory` cells, and `access.setRole` writes only `contacts`. R4 the builder reads trips with `eventsOn` filtered to `kind === 'outing'`. R5 the Few visits button lives in `NextMonthList.tsx` (Members tab only); `FewVisitsCard.tsx` is deleted.

## Round 18 (branch `round18`, not pushed)
Spec `specs/2026-11-03-round18-design.md`; plan `plans/2026-11-03-round18.md`; progress log `.superpowers/sdd/2026-11-03-round18/progress.md`.

### Status
- Tasks 1–3 (track A): notice days per kind (downgrade, stop, leave), the few-visits alert as days before next month, Settings › Membership rules. Merged.
- Tasks 4–6 (track B): charges on a new celebration, field trips (name, New field trip, search), proof of payment opens (photo in the viewer, PDF in a new tab). Merged.
- Task 7 (track C): Roles page sectioned like Tasks, two columns on wide screens. Merged.
- Task 8 (seed): fuller terms v1, Oma Sri Rahayu just joined with Ratna, the Owner in the quick list. Done.
- Task 9: e2e (`e2e/round18.spec.ts`) and screenshots at phone, tablet and laptop. Still to do.

### Logins added to the quick list (`/api/demo/accounts`, `apps/server/src/app.ts`)
- **Benjamin Cass** (`s11`, Owner): login `benjamin` / `citra123`, after Ega.
- **Ratna Rahayu** (`f_ratna`): login `ratna` / `citra123`, after Daniel. Full 46-member roster only, so the small seed (tests, e2e) has no Ratna and the list skips her.

### Seed (`packages/shared/src/seed/r7/terms.ts`, `round18.ts`; no random draws)
- **Terms v1** (`terms.ts`): 14 sections in English and Indonesian, with placeholders filled from the settings: `{flexQuota}`, `{issueDay}`, `{dueDay}`, `{downgradeDays}`, `{stopDays}` and `{leaveDays}`. It is still version 1, so no seeded family meets a new-version gate. The staff Terms page shows "Demo text: review before going live" while version 1 is current.
- **Oma Sri Rahayu** (`m_sri`, Flex; roster only, after round 17):
  - She started 2 open days before the demo day, from a paper form (on file), with no photo and no face enrolled.
  - She has one check-in today (09:05, by name) and a joined lead (`e-h-m_sri`), like every roster member who joined in the last six months. Her welcome notification was sent to Ratna.
- **Ratna Rahayu**: daughter, primary and billing contact with app access. She has never signed in and has no `termsAgreed`, so she lands on the welcome + terms page.
- **Oma Sri's first invoice** follows the app's rule: a run bills every member active on its issue day, and the run job never runs a month twice.
  - On the 21st (the tests' demo day), she is on October's run (issued that morning) with a prorated Flex fee and the registration fee, unpaid.
  - On any day between runs, nothing is issued yet: the next run bills her first plan fee and the registration fee.
- **Counts on the full seed:** 46 members, not 45. October's Month report and Enquiries History now show 3 joined and 44% conversion (9 opened, 4 joined), not 2 and 38%. The tests were updated to match.

### Next steps
1. Task 9 (e2e and screenshots), then a review of the round.
2. Reset the dev database so the local demo has Oma Sri, Ratna and the new terms text: `pnpm db:reset` (API on port 8788). Ratna's welcome + terms page shows only until she agrees; reset again to show it once more.
3. The terms text is demo text: KC or the owner reviews it before going live. The Indonesian text is a first translation.

## Round 17 (merged into `main` locally, not pushed)
Spec `specs/2026-11-03-round17-design.md`; plans `plans/2026-11-03-round17-phase1.md` and `...-phase2.md`. KC approved the spec on 3 Nov.

### Phase 1 (points 1–7): money on the next monthly invoice, proof of payment, spouse
- Birthday charges and field-trip fees are **pending charges** billed on the next monthly invoice (no separate birthday invoice).
- Family Bills shows **On your next bill**; Pick-up shows in the family plan; the Plans preview uses draft fees.
- Fransiska/Caca can **Make billing contact** (asks first, unpaid invoices move); the member's Documents tab lists the **Emails** sent.
- The server checks the proof-of-payment upload exists. Oma Lina's Family tab shows Opa Budi as her spouse.
- E2E: `e2e/round17p1.spec.ts`.

### Phase 2 (points 8–11): Roles, few-visits alert, Settings, terms
- **Admin › Roles** (`features/mgmt/Roles.tsx`, `RolePage.tsx`): a role list, then View and Edit checkboxes per menu, saved in one go with `access.setRole`. Ticking Edit ticks View; unticking View unticks Edit; neither = the menu is hidden. Leaving with a draft asks first (`lib/leaveGuard.ts`). New `components/ui/Checkbox.tsx`.
- **Few visits** (`rules/fewVisits.ts`, `actions/visitCalls.ts`, collection `visitCalls`, migration `0009`): an active member with fewer than 5 visit days this month is flagged from the alert day (next month's notice deadline less 2 days). Shown as the Next month › Few visits card and list, the call sheet (`visitCall.log`: Reached / No answer / Staying), the Also today block and the monthly notification `renewals.few.notif`.
- **Admin › Settings** (`features/mgmt/Settings.tsx`): notice period, few-visits settings, Terms and conditions. Management's notice-period change waits for the Owner; few-visits settings apply at once.
- **Terms** (`rules/terms.ts`, `actions/terms.ts`, `TermsPage.tsx`, `TermsEditor.tsx`, family `TermsGate.tsx`): versioned, edited by Management (`terms.publish`); families agree once (`terms.agree`). `execute()` refuses a family contact's actions with `err.termsFirst` until they have agreed to the current version. Me › Terms shows when they agreed.
- E2E: `e2e/round17p2.spec.ts` (Roles, few-visits call, Sinta's gate, version 2). Screenshots: `E2E_SHOTS=1 scripts/e2e-all.sh 1 "phone tablet laptop" round17p2` writes `artifacts/shots/round17p2/` (git-ignored).

### Seed (`packages/shared/src/seed/r7/round17.ts`, no random draws)
- Terms **version 1** (English and Indonesian) published by Ega on the club's first day; every seeded family contact has `termsAgreed` version 1.
- **Sinta Halim** (`f_sinta`, login `sinta` / `citra123`): Opa Hendra's second daughter, not primary, never signed in, so she meets the terms gate. She is a seventh family contact with the app, so recipient counts in tests went from 6 to 7.
- **Few-visits list** on the demo day (21 Oct): small seed Opa Budi (3 visits), Opa Tjahjadi (4) and Opa Hendra (4, already called: Caca reached his family). The full roster adds Endang, Hendrik, Rizal and three more. To get there the seed removes the *earlier* October visits of `m2, m20, m46, m53, m54, m62` (it keeps the latest 3 before today, today's visit, and any day with an Alert reading), with the readings, logs, photo tags and mood marks that hang off them.
- Seed size stays under 7,500,000 characters at the real date and at 2026-12-30 (`seed/history.test.ts`).

### Rulings made without KC (easy to reverse)
Phase 1 plan: R1 invoice line labels live in the `inv` namespace; R2 `PendingCharge` gains `params` and `source`; R3 birthday charge id is `cel-<chargeId>`, trip charge `trip-<eventId>-<memberId>`; R4 `CelebrationCharge.invoiceId` is gone (read from the pending charge); R5 declining or cancelling a celebration removes its un-invoiced charges; R6 a fee-only edit of a past outing is allowed while it has an un-invoiced charge; R7 families get only their own members' pending charges and `wentIds`; R8 Next bill = the pick-up and charge lines of the next un-run period's `runLinesFor` (this month's until its run is done, then next month's; plan fee left out), so it matches the invoice; R9 the proof check is server-side only (`mediaExists`, `finance.err.proofMissing`); R10 the Emails list is on Documents (Finance sees "Emailed to" on each invoice instead); R11 Make billing contact asks first, then `family.setPrimary`; R12 spouse edits use `members.updateDetails` (a front-desk edit goes to review).

Phase 2 plan: R1 role-page groups come from the sidebar layout (`menuGroups()` in `nav.ts`); R2 `access.setRole` is Owner only and stores only cells that differ from the default (a default-off cell saved as off stays "never set", so Caca's cash payment from an invoice still works); R3 unsaved changes ask in a dialog and a `beforeunload` guard (no router blocker); R4 new `Checkbox`; R5 menu key `settings` (mgmt and owner, Club group after Plans); R6 only `noticeDays` or `flexQuota` in `club.updateSettings` needs the Owner; R7 `club.updateSettings` accepts `fewVisits`; R8 "left out" of Few visits: not active today, started after the 1st, on leave, stopping or on leave next month, or a plan change asked for next month; R9 the monthly notification is told once (`toldAlready`); R10 `visitCalls` is a new collection (family projection drops it); R11 the terms gate in `execute()` lets `terms.agree`, `notifications.read`, `notifications.readAll` and `account.updateFamily` through, and does nothing while no terms are published; R12 Sinta is the only contact without `termsAgreed`; R13 publishing notifies every contact with a username (`terms.notif.updated`, link `/me?terms=1`).

Task 10 (seed) rulings: the third small-seed member on the few-visits list is Opa Hendra (Opa Bambang is excluded: he has a plan change asked for next month; Oma Lina's October story is too entangled). The seed leaves his Alert-reading day (14 Oct) so the health pages and daily report keep their story. Existing tests were updated for Sinta (recipient lists and counts), terms (tests of "no terms" start from a club without them) and the removed October visits.

## Next steps
1. Push `round17` and open a PR to `main` once KC agrees.
2. Reset the dev database so the local demo has Sinta, terms v1 and the few-visits list: `pnpm db:reset` (API on port 8788).
3. Tell KC:
   - Families now meet the terms gate on their next sign-in after Ega publishes a new version; a contact added at registration has not agreed yet.
   - The few-visits list ignores members who already asked for a plan change or leave for next month.
   - Opa Budi, Opa Tjahjadi and Opa Hendra now show few visits in October in the demo (their earlier October visits were removed from the seed).
   - The seeded terms say each month's invoice is issued on day {issueDay} of that month (the app's rule), not "the month before". If the club really bills a month ahead, the billing model needs changing, not the text.
4. **Demo note (few visits).** The list is open only from the alert day to the last change day (15–17 Nov with the defaults), so on most demo dates the card reads "list opens …" or "… · changes closed". To show the open list on another day, set Settings › "Alert 14 days before the last change day": with 14 days' notice that opens it from the 3rd of the month.
5. Open items: the real terms text needs KC's or the owner's review; the Indonesian text is a first translation.

## How to run e2e
`E2E_NAME=x E2E_PORT=8921 scripts/e2e-all.sh 1 phone round16p1 round16p2 round17p1 round17p2` builds the app and starts isolated servers (demo date 2026-10-21, small seed, Postgres on 5434). Tests: `pnpm -r typecheck && pnpm test` (the server test needs Postgres on 5434).

## Round 16 (merged into round17)
- Phase 1: notice period, family emails + simulated outbox, billing-contact switch, pick-up and field-trip fees, proof of payment. Phase 2: Owner **Benjamin Cass** (`s11`, login `benjamin`) counts as Management everywhere; access grid in `rules/access.ts` with `permit()` in `actions/framework.ts` and `actions/areas.ts`; owner approvals (`actions/ownerGate.ts`).
- Open from round 16: hide the "Add note" form for non-Owners on Benjamin's staff row (`features/mgmt/People.tsx`, the server already refuses the save); on the round 16 tip 4027c2d, the full phone suite has 71 failing tests (smoke 20, lobby 10, activity 10, kitchen 8, family 6, calendar 5, mgmt 3, terms.spec 2, round14 2, members 2, round15p2-programme 1, round14p2 1, health 1). Round 17 phone count: 71 on the round 16 baseline, plus 5 (finance › long payment lists paged, uikit › Pager payments, uikit › Pager bell and demo accounts, terms › leave on the Plan tab, terms › registration fee) that recorded payments through the API with a made-up proof id; the specs now upload a real proof (`uploadProof` in `e2e/kit.ts`).
