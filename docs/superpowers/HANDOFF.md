# Handoff — where round 17 stands (updated 3 Nov 2026)

Read this first when picking the work up in a new session. Round 16 is done and merged into this branch (its notes are at the end).

## Round 17 (branch `round17`, not pushed)
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
Phase 1 plan: R1 invoice line labels live in the `inv` namespace; R2 `PendingCharge` gains `params` and `source`; R3 birthday charge id is `cel-<chargeId>`, trip charge `trip-<eventId>-<memberId>`; R4 `CelebrationCharge.invoiceId` is gone (read from the pending charge); R5 declining or cancelling a celebration removes its un-invoiced charges; R6 a fee-only edit of a past outing is allowed while it has an un-invoiced charge; R7 families get only their own members' pending charges and `wentIds`; R8 Next bill = un-invoiced charges + next month's pick-up (plan fee left out); R9 the proof check is server-side only (`mediaExists`, `finance.err.proofMissing`); R10 the Emails list is on Documents (Finance sees "Emailed to" on each invoice instead); R11 Make billing contact asks first, then `family.setPrimary`; R12 spouse edits use `members.updateDetails` (a front-desk edit goes to review).

Phase 2 plan: R1 role-page groups come from the sidebar layout (`menuGroups()` in `nav.ts`); R2 `access.setRole` is Owner only and stores only cells that differ from the default (a default-off cell saved as off stays "never set", so Caca's cash payment from an invoice still works); R3 unsaved changes ask in a dialog and a `beforeunload` guard (no router blocker); R4 new `Checkbox`; R5 menu key `settings` (mgmt and owner, Club group after Plans); R6 only `noticeDays` or `flexQuota` in `club.updateSettings` needs the Owner; R7 `club.updateSettings` accepts `fewVisits`; R8 "left out" of Few visits: not active today, started after the 1st, on leave, stopping or on leave next month, or a plan change asked for next month; R9 the monthly notification is told once (`toldAlready`); R10 `visitCalls` is a new collection (family projection drops it); R11 the terms gate in `execute()` lets `terms.agree`, `notifications.read`, `notifications.readAll` and `account.updateFamily` through, and does nothing while no terms are published; R12 Sinta is the only contact without `termsAgreed`; R13 publishing notifies every contact with a username (`terms.notif.updated`, link `/me?terms=1`).

Task 10 (seed) rulings: the third small-seed member on the few-visits list is Opa Hendra (Opa Bambang is excluded: he has a plan change asked for next month; Oma Lina's October story is too entangled). The seed leaves his Alert-reading day (14 Oct) so the health pages and daily report keep their story. Existing tests were updated for Sinta (recipient lists and counts), terms (tests of "no terms" start from a club without them) and the removed October visits.

## Next steps
1. Push `round17` and open a PR to `main` once KC agrees.
2. Reset the dev database so the local demo has Sinta, terms v1 and the few-visits list: `pnpm db:reset` (API on port 8788).
3. Tell KC:
   - Families now meet the terms gate on their next sign-in after Ega publishes a new version; a contact added at registration has not agreed yet.
   - The few-visits list ignores members who already asked for a plan change or leave for next month.
   - Opa Budi, Opa Tjahjadi and Opa Hendra now show few visits in October in the demo (their earlier October visits were removed from the seed).
4. Open items: the real terms text needs KC's or the owner's review; the Indonesian text is a first translation.

## How to run e2e
`E2E_NAME=x E2E_PORT=8921 scripts/e2e-all.sh 1 phone round16p1 round16p2 round17p1 round17p2` builds the app and starts isolated servers (demo date 2026-10-21, small seed, Postgres on 5434). Tests: `pnpm -r typecheck && pnpm test` (the server test needs Postgres on 5434).

## Round 16 (merged into round17)
- Phase 1: notice period, family emails + simulated outbox, billing-contact switch, pick-up and field-trip fees, proof of payment. Phase 2: Owner **Benjamin Cass** (`s11`, login `benjamin`) counts as Management everywhere; access grid in `rules/access.ts` with `permit()` in `actions/framework.ts` and `actions/areas.ts`; owner approvals (`actions/ownerGate.ts`).
- Open from round 16: hide the "Add note" form for non-Owners on Benjamin's staff row (`features/mgmt/People.tsx`, the server already refuses the save); about 45 older phone e2e tests (lobby, activity, kitchen, calendar, family…) were already failing before round 16.
