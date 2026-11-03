# Round 18: owner demo account, Roles like Tasks, charges on new celebrations, field trips, proof opens, membership rules per kind, terms and a new member

Date: 3 November 2026. Status: designed with KC in chat, section by section, all four sections approved (sections 1–2 shown as mockups); written here for KC's review.
Branch: `round18`, cut from `main` after round 17 was merged (25fa31f).

## Why

KC tried round 17 and sent eight points:
1. a quick-login demo account for the Owner (Benjamin);
2. the Roles page is messy, so section it like the Tasks page and audit the design;
3. charges can only be added after a celebration exists, so list them when creating one;
4. field trips can't be found in the page, the calendar or search;
5. proof of payment can't be opened;
6. membership rules need to be clearer, with notice days per category and a better design;
7. the few-visits alert day should be "how many days before next month";
8. fuller terms and conditions, plus one member who has just joined, to see the first-login page.

KC's answers that shaped the scope:
- **Notice per kind of change**: Downgrade, Stop and Leave each have their own days. Upgrade needs no notice.
- **Field trips**: their own type, with a New field trip button and search. There is no separate Field trips page.
- **First login**: keep today's welcome + terms page (no new multi-step flow), and seed a just-joined member whose family hasn't signed in.
- **Few-visits alert**: "N days before next month", default **16**, which puts the alert on 15 Nov for December.
- **Roles on wide screens**: the role's sections sit in **two columns**.

## Conventions

As in rounds 12–17:
- shared immer actions live in `packages/shared/src/actions` and pure rules in `rules`; role checks run server-side through `can` and `permit()`;
- the UI is dense and phone-first, with 44 px targets, ink, grey and white on the warm staff skin, no pastel tints and no descriptive filler text; phones use iOS grouped lists;
- every string exists in EN and ID;
- the seed stays RNG-neutral, `CP_SEED_SMALL=1` keeps working, and club state stays under the 7,500,000-character cap at the real date and at 2026-12-30;
- tests stay minimal: typecheck, unit tests for new rules and actions, and one e2e pass on a phone viewport, plus screenshots at phone, tablet and laptop;
- the API dev port is 8788 (never 8787).

## 1. Owner demo account

- The server's quick-login list (`apps/server/src/app.ts`, the `order` array of `/api/demo/accounts`) adds **Benjamin Cass (`s11`, Owner)** after Ega, and the new family contact **Ratna Rahayu** (section 8) after Daniel.
- No web change is needed. The Login page and the Demo panel already show any staff role; the i18n keys `roles.owner` and `roles.lands_owner` exist.
- A missing id is skipped, as today, so the small seed (which has no Ratna) still works.

## 2. Roles page, sectioned like Tasks

**Audit of the round 17 page**, from screenshots at phone and laptop:
- about 60 checkboxes sit in one long column;
- each group's tick-all boxes float outside its card, and the mixed "—" box is unclear;
- the View/Edit header is far from the rows;
- the role list has no icons and no sense of how much each role can do;
- on a laptop the right half of the screen is empty;
- the Owner row and the owner-approval block look different from everything else.

**New layout**, using the Tasks page's parts (`features/tasks/RoleSplit.tsx`: `RoleSplit`, `RoleRow`, `RoleHead`, `ScoreBar`, `RoleIcon`; `TeamView.tsx`: `Lines`). These move to a shared place, or Roles imports them, so the two pages stay the same.
- **Role list**: each row shows the role icon, the role name, its people and "{n} of {total}", the menus it can see, with the small bar.
  - The **Owner** row is locked and reads "full access".
  - On a phone it is a grouped list and a role opens full screen. On wide screens it is a card on the left.
- **Role head**: icon, name, people, "changed {date} by {name}", and "{n} of {total}" with its bar.
- **Sections**: one per sidebar group (`menuGroups()`).
  - The header has the group title and a count ("General · 4 of 7"), and a small **All / None** text button replaces the tick-all checkboxes.
  - Each **menu row** has the menu's sidebar icon, its name, " · view only" when View is ticked without Edit, and the View and Edit checkboxes aligned under one View/Edit header.
  - The ticking rules are unchanged: ticking Edit ticks View, unticking View unticks Edit, and neither means the menu is hidden.
- **Hidden groups**: a group with nothing ticked folds to one line ("Care · hidden"). Tapping it opens the group's rows.
- **Needs owner approval**: its own section at the bottom, with one checkbox per row.
- **Two columns on wide screens**: when the role panel is about 900 px or wider, the sections flow into two columns, balanced by row count, and each column repeats the View/Edit header. Tablet portrait and phone use one column. The owner-approval section and the Save bar span the full width.
- **Save bar**: Reset and "Save · {n} changes". The draft, the leave-without-saving guard and `access.setRole` are unchanged.

## 3. Charges on a new celebration

- The **New celebration** sheet (`features/mgmt/CelebrationSheet.tsx`) gets a **Charges** list, the same as the Charges dialog: item + price, "Add charge", remove, and a running total. It is labelled "Charges · next monthly bill".
  - It shows only for roles that may add charges (front desk, management). Activity staff don't see it.
- `celebration.request` accepts optional `charges: { item, amount }[]` (0–10 items, same limits as `celebration.addCharge`). It creates `Celebration.charges` and the pending charges (`cel-<chargeId>`, label `inv.line.birthday`, source celebration) in the same action. A role without addCharge rights that sends charges is refused.
- Everything after creation is unchanged:
  - decline or cancel drops un-invoiced charges;
  - the Charges dialog still adds and removes;
  - the family sees the charges with the party, also while it is requested.

## 4. Field trips

- "Outing" becomes **Field trip** in every label: the event type chip, calendar, day blocks, family calendar and agenda, Who went, invoice line and notifications. Indonesian is **Karyawisata**.
  - The data kind stays `outing`, so there's no migration.
  - Seeded titles drop the "Outing:" prefix (for example "Kebun Raya Bogor botanical garden").
- **New field trip** button in Calendar, management only, beside Add event. On a phone it's in the add menu.
  - It opens the event editor with Field trip picked, From/To shown and the fee pre-filled from the price list.
- **Search** (`app/searchRegistry.ts`):
  - a **New field trip** action (management), with keywords "field trip, trip, outing, karyawisata";
  - an index of calendar events from 3 months back to 6 months ahead by title, with field trips also matching "field trip / karyawisata".
  - A result opens that day in Calendar; activity staff land on the day where they tick Who went.
- Who creates and who ticks Who went is unchanged.

## 5. Proof of payment opens

- Cause: the proof picker accepts photos and PDFs (`ProofField`, `useDocPicker`), but the invoice and Payments always open the proof in the image viewer (`ImageOpen`), so a PDF shows a broken image.
- `Payment.proofKind?: 'image' | 'pdf'` is set by the client from the picked file and stored by `payment.record`.
- Opening:
  - an image opens in the image viewer;
  - a PDF opens in a new tab, as registration documents do (`DocView`);
  - a payment without `proofKind` asks the server for the file's type (`HEAD /api/media/:id`) on first open.
- Display: the proof shows as a small thumbnail (photo) or a "PDF" tile in the invoice sheet's payments and in Payments, in place of the receipt icon.

## 6. Membership rules: notice per kind of change

**Data**
- `ClubSettings.notice?: { downgrade: number; stop: number; leave: number }` (1–60 days each).
- A missing kind falls back to the old `noticeDays`, then to 14, so existing clubs behave exactly as today.
- `noticeDays(s, kind)` replaces the single value everywhere:
  - `rules/notice.ts` (`noticeDeadline`, `inTime`, `earliestMonth`, `noticeCheck` take the kind);
  - `rules/leave.ts` (the leave deadline uses `leave`);
  - `actions/renewals.ts`, `actions/members.ts`, `actions/planRequests.ts`, `actions/membership.ts`;
  - the Next month screens and the error message `err.noticeLate`, which names its kind's days.
- Upgrade: no notice, starting the next 1st (unchanged).

**Settings › Membership rules** (`features/mgmt/Settings.tsx`):
- one grouped card with a row per kind:
  - **Downgrade**, **Stop membership** and **Leave**, each with an icon, a number field ("days"), and a live line under it: "ask by {date}" for next month;
  - **Upgrade**: "starts the next 1st · no notice" (fixed);
  - **Leave in a row**: "up to 2 months; no word after that ends the membership" (fixed, read-only this round).
- Saving: Management sees "Send to owner" and the change waits for the Owner (owner gate "pricing", for any notice kind or `flexQuota`). The Owner's save applies at once.

**Terms placeholders**
- `{downgradeDays}`, `{stopDays}` and `{leaveDays}` are added.
- `{noticeDays}` stays and means the stop days, for old terms versions.

## 7. Few-visits alert: days before next month

- `fewVisits: { below, daysBeforeMonth }`, default `{ below: 5, daysBeforeMonth: 16 }`.
- A stored round 17 `daysBeforeDeadline` is read as `daysBeforeDeadline + stopDays`.
- Alert day = the 1st of next month − `daysBeforeMonth`. The list is open from the alert day to the **stop** deadline (1st − stop days), then shows "changes closed" with its counts.
  - With the defaults: December has its alert on 15 Nov and closes 17 Nov; November has its alert on 16 Oct and closes 18 Oct.
- Validation: `daysBeforeMonth` must be at least the stop days and at most 28, so the alert can't fall after changes close (`mgmt.err.fewDaysInvalid` names the range). This also fixes the round 17 case of a long notice period leaving no window.
- Settings row: "Alert before next month · {n} days", with a live line "December: alert 15 Nov · changes close 17 Nov".
- The Next month card, Also today, the job and the notification use the new window. Their wording is unchanged.

## 8. Terms text and a just-joined member

**Terms version 1, rewritten** (`seed/r7/round17.ts` or a new `seed/r7/terms.ts`)
- 14 sections in English and Indonesian, about 2–3 phone screens:
  1. Membership and plans
  2. Visits and opening hours (closed days, Flex visits per month `{flexQuota}`)
  3. Fees and billing (one-time registration fee; each month's invoice issued on day `{issueDay}` of that month, due on day `{dueDay}`; pay by VA, or by cash or transfer with proof; late payment)
  4. Changing, stopping and leave (`{downgradeDays}`, `{stopDays}`, `{leaveDays}`; up to 2 months of leave in a row)
  5. Pick-up and field trips (fees on the monthly invoice)
  6. Birthdays and celebrations (charges on the next bill)
  7. Health and safety (health checks, medicines, what the club does in an emergency and whom it calls)
  8. Meals and allergies
  9. Belongings
  10. Photos (shared only with the member's family; face tagging can be turned off)
  11. Personal data
  12. Complaints and contact
  13. Changes to these terms (a new version is notified and must be agreed again)
  14. Agreeing
- It stays **version 1**, so seeded contacts keep `termsAgreed` and no existing demo family sees a new-version gate.
- The staff Terms page shows a one-line note on version 1: "Demo text: review before going live".

**Oma Sri Rahayu** (full 45-member roster only; the small seed stays at its 5 members)
- **Plan**: Flex, starting 2 open days before the seed's today.
- **Registration**: signed form; the one-time registration fee waits for her first invoice on the 21st; the welcome notification is sent.
- **Visits**: one check-in so far.
- **Photo**: none (initials only), per the no-placeholder-photos rule.
- **Contact**: daughter **Ratna Rahayu**, login `ratna` / `citra123`, primary and billing, with app access. She has never signed in and has no `termsAgreed`, so she lands on the welcome + terms page with Oma Sri's name. She is listed in the quick-login list (section 1).
- All of this stays under the seed-size cap.

## Testing

- **Unit tests**:
  - notice per kind, including the fallback to `noticeDays` and the error naming its kind;
  - the few-visits window, the conversion of `daysBeforeMonth` and its validation;
  - `celebration.request` with charges, including a refused role;
  - `payment.record` storing `proofKind`;
  - the search registry finding field trips and the New field trip action;
  - the seed: Ratna with no `termsAgreed`, Oma Sri's registration fee pending, the terms placeholders all filled;
  - the demo accounts list including `s11`.
- **e2e** (`e2e/round18.spec.ts`, phone; plus screenshots at phone, tablet and laptop):
  - Benjamin signs in from the quick list;
  - the Roles page shows two columns on a laptop and the folded hidden group;
  - a new celebration with two charges shows them on the family's next bill;
  - search for "field trip" opens the Bogor trip;
  - a PDF proof opens in a new tab and a photo proof in the viewer;
  - Settings shows notice per kind with live dates; with leave notice set to 30 days, a December leave request on 5 Nov is refused while a December stop request is accepted;
  - the few-visits row shows "15 Nov".
  - The first-login page for a newly registered contact is checked by registering a member through the API in the test (the e2e servers use the small seed).

## Not in this round

- Making "leave in a row" editable.
- A Field trips list page.
- A multi-step welcome flow (password, tour).
- Editing the plan catalogue's Flex quota from Settings.
- The round 17 leftovers listed in HANDOFF: the spouse row projection, a past field trip's fee after 0, and Settings Edit granted to a non-management role skipping owner approval.
