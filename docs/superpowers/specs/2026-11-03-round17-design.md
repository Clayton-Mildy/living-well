# Round 17: round 16 made demo-proof, spouse, Roles redesign, few-visits alert, terms and settings

Date: 3 November 2026. Status: designed with KC in chat, section by section, all four sections approved; written here for KC's review.
Branch: `round17`, cut from `round16` (round 16 is not on `main` yet).

## Why

KC tried round 16 and sent two lists. First, the five money features must work as expected end to end (birthday charges, pick-up fee, field trip fee, proof of payment, switching the billing contact), with one change: a birthday's charges go on next month's invoice. Second, issues and a client request: the member's Family tab doesn't show the spouse; the Roles screen isn't laid out like a normal admin role page (pick a role, then tick permissions; the Hidden / View / Edit / "—" dropdown is unclear); the client wants a warning about members with few visits before plan changes close ("potential quitters"); and the club wants Terms and Conditions that a family reads on first login, plus a Settings page for rules like the notice period.

KC's answers that shaped the scope:
- Birthday charges go on the **next monthly invoice only**; the separate birthday invoice goes away.
- Roles: **menu-level View + Edit checkboxes** (not per-action permissions).
- Few visits: count **this month so far**; Ega and Caca get a notification, a list in Next month, and a **call log** so they don't call the same family twice.
- Terms: **family only**. A new version sends a notification and families must **scroll and agree again**.
- Settings: **Owner and Management**; Management's notice-period change still waits for the Owner.

## Conventions

As in rounds 12–16:
- shared immer actions in `packages/shared/src/actions`, pure rules in `rules`; role checks server-side through `can` and the round 16 area check (`permit()` in `actions/framework.ts`, `actions/areas.ts`);
- dense phone-first UI, 44 px targets, ink, grey and white with the warm staff skin, no pastel tints; iOS grouped lists on phones;
- every string in EN and ID;
- seed RNG-neutral, `CP_SEED_SMALL=1` working, club state under the 7,500,000-character cap at the real date and at 2026-12-30;
- minimal tests (typecheck, unit tests for new rules and actions, one e2e pass per phase on a phone viewport);
- screenshots at phone, tablet and desktop.

## Phase 1 — the round 16 money features, demo-proof; the spouse

An audit of round 16 (3 Nov) found the features built but with gaps. This phase closes them.

### 1. Birthday charges on next month's invoice

- **Add charge** (front desk, management; while the celebration is not cancelled) creates a `PendingCharge` for the celebrating member: label key `charge.birthday` → "Birthday · {item}" / "Ulang tahun · {item}", the amount, and `celebrationId`. It lands on the member's next monthly invoice through the existing mechanism (`runLinesFor` adds un-invoiced pending charges; `issueRun` sets their `invoiceId`).
- `Celebration.charges` keeps `{ id, item, amount }` for the celebration sheet; each charge points to its pending charge (`chargeId`). **Remove** deletes both, refused once invoiced (`err.charged`).
- Removed: `celebration.issueInvoice`, the `CEL-YYMM-NNN` invoices, the Finance Billing "to invoice" card, the Issue invoice button. The seed's birthday invoice becomes pending charges.
- Voiding an invoice already releases its pending charges (`invoice.void`); this now covers birthday charges too (the round 16 stranding bug goes away with the separate invoice).
- The family sees the charges on the celebration in Today and the Calendar agenda, also while the celebration is still **requested** (today: only once confirmed).

### 2. Pick-up fee

- Already on the monthly invoice (`pickup-YYYY-MM`, not on leave months, not after a stop).
- New: the family's Plan section shows "Pick-up · Rp 600.000 / month" when on.
- Fix: the Plans and pricing sample-invoice preview (`rules/mgmt.ts`) uses the drafted pick-up and field trip prices.

### 3. Field trip fee

The flow stays: management sets the fee on an **Outing**; activity and management tick **Who went** from the outing's date on; each ticked member gets a pending charge for the next invoice. Fixes:
- The charge label is an i18n key (`charge.fieldTrip` → "Field trip · {title} · {date}" / "Karyawisata · …"); pending charges store the key and params, rendered in the reader's language.
- Changing the outing's fee re-prices its un-invoiced charges; a fee of 0 removes them. The fee stays editable after the date while any charge is un-invoiced.
- Deleting the outing removes its un-invoiced charges. It is always allowed; charges already invoiced stay as lines on their invoices.
- The family calendar shows "Field trip · Rp 250.000" on an outing with a fee.

### 4. "On your next bill"

- Family Bills and the member's Plan tab (staff) show **On your next bill**: every un-invoiced pending charge (birthday, field trip, others) and the pick-up fee, with a total. Families see a charge before the invoice arrives.
- `pendingCharges` of the family's own members are sent to the family app (`project.ts`), so far not projected.

### 5. Proof of payment

- Already required for cash and bank transfer on every hand-recorded payment (`PaymentForm` / `ProofField`, used by Payments, the invoice sheet and Next month › Unpaid).
- New: the invoice sheet's payment lines open the proof photo (staff).
- New: the server checks that `proofMediaId` names a stored media item (today only its format is checked).

### 6. Billing contact and the invoice emails

- Staff get a visible **Make billing contact** button on each approved contact in Member › Family (front desk, finance, management; the action `family.setPrimary` already allows them). Today it is only a toggle inside the Edit dialog, and finance has no way in.
- New **Emails** list on the member's Documents tab: every simulated email for that member (to, subject, kind, date), newest first, with "No email address" rows marked. This shows that the chosen contact got the invoices.
- `invoice.adjust` re-sends the invoice email to the payer (today only the run, final invoices, the billing switch and contracts write email rows).
- The invoice sheet's "Emailed to …" line also shows a `noAddress` row ("Not emailed · no address for Rina").

### 7. Spouse in the Family tab

- The member's spouse (`Member.spouseId`) shows as the first row of Member › Family: photo, name, a **Member** tag, and a link to their profile (staff) — in the staff profile and in the family app's profile.
- Front desk and management can set, change or clear the spouse from that row with a member picker (existing `setSpouse` through the member update action). Family edits are not part of this.

## Phase 2 — Roles, few-visits alert, terms and settings

### 8. Admin › Roles redesign

Common admin-console pattern: choose a role, see and tick its permissions, save.

- **Roles list** (Owner only, under Club): one row per role with its people ("Front desk · Caca") and "10 menus". **Owner** sits at the top, "Full access", not editable. Phone: tap opens the role page; tablet and desktop: list on the left, the role on the right.
- **Role page**:
  - header: role name, its people, "Last changed by Benjamin · 2 Nov" (`ClubSettings.accessChanged: Record<role, { by, at }>`);
  - menus grouped as in the sidebar (Front desk, Health, Kitchen, Finance, Club); each row has **View** and **Edit** checkboxes. Ticking Edit ticks View; unticking View unticks Edit; neither = the menu is hidden and its screen refused;
  - each group header has a tick-all checkbox per column (checked, unchecked or mixed);
  - a small "changed" dot on rows that differ from the default;
  - **Needs owner approval**: three checkboxes, Prices and plans · Closed days and holidays · Weekly budget (the round 16 switches);
  - changes are a draft: a sticky bar "3 changes · Cancel · Save"; leaving with unsaved changes asks; **Reset to default** asks first.
- Save is one action, `access.setRole { role, levels, approvals }` (Owner only), applied at once; the role's staff are notified. It replaces `access.set` and `access.setOwnerApproval` in the UI (the actions can stay for tests or be removed).
- The "—" choice disappears. Underneath, the round 16 rule stays: a cell that is off by default and never set still lets the role do what it does from other screens (Caca records cash from a member's invoice without the Payments menu). Unticking a menu the role has by default stores an explicit off and blocks that menu's actions. Saving a draft writes only cells that differ from the default, so untouched default-off cells stay "never set".
- Not included: creating custom roles (each role drives its own home screen and screens).

### 9. Few-visits alert ("potential quitters")

**Rule** (`rules/fewVisits.ts`, pure):
- **Alert day** for month M = `noticeDeadline(M+1) − daysBeforeDeadline` (default 2). For November: the December deadline is 17 Nov, so the alert day is **15 Nov** — the client's "2 weeks and 1 day before the month ends". It follows the notice period.
- **Flagged**: an active member with fewer than `below` (default 5) visit days from the 1st of M up to today.
- **Left out**: on leave on any day of M; started after the 1st of M; already stopping, leaving or ending for M+1 (a recorded change or a pending family request); ended.
- Settings: `ClubSettings.fewVisits: { below: number; daysBeforeDeadline: number }` (missing = 5 and 2).

**Notification**: the daily job, once per month on the alert day, notifies management (Ega, and the Owner through the mgmt reach) and the front desk (Caca): "7 members came 4 times or fewer this month · plan changes close 17 Nov". Tap opens the list. Not sent when nobody is flagged.

**Next month**:
- A **Few visits** card above the tabs: "Few visits · 7 · 2 called · changes close 17 Nov"; tap opens the list.
- Before the alert day the card is quiet grey: "Few visits · list opens 15 Nov · 6 so far" (it opens the list too, so it can be demoed and looked at early).
- After the last change day the card says "changes closed"; it stays until the month ends.

**The list** (sheet on phone, side panel wider):
- Rows: photo, name, plan, "3 visits · last 4 Nov", call and WhatsApp buttons for the billing contact, a **Called** tag.
- Not-yet-called first, then called; each group by visits ascending.
- Tap opens **Log a call**: outcome **Reached**, **No answer** or **Staying**, optional note; the sheet shows earlier calls (who, when, outcome). Front desk and management.
- A member who reaches the threshold drops off the live list; their calls stay in the month's log.
- New collection `visitCalls: { id, memberId, month, outcome, note?, by, at }`, action `visitCall.log`.

**Today**: from the alert day to the last change day, front desk and management get one **Also today** row "Few visits · 5 to call" (not called yet), opening the list.

**Seed**: about 6 members flagged in the current month, one call logged.

### 10. Admin › Settings

New screen under Club for the Owner and Management (menu key `settings`, a grid menu so the Owner can grant it), an iOS grouped list:
- **Membership rules**: Notice period (days). Moved here from Plans and pricing (Plans keeps prices and fees). A change by Management waits for the Owner (owner approval kind `pricing`, as today).
- **Few-visits alert**: "Flag below {n} visits", "Alert {n} days before the last change day". Apply at once.
- **Terms and conditions**: "Version 2 · published 2 Nov by Ega · 38 of 41 agreed"; opens the terms page.

Billing dates, opening hours and staff leave days stay where they are this round.

### 11. Terms and conditions

**Data**: `ClubSettings.terms: { version: number; en: string; id: string; publishedAt: ISODateTime; publishedBy: string }[]` (the last is current); `FamilyContact.termsAgreed?: { version: number; at: ISODateTime }`.

**Staff (Settings › Terms and conditions)**:
- The current text, version and date; a **Not agreed yet** list (contact, member).
- **Edit**: full-screen editor with EN and ID tabs, plain text; a line starting "# " is a heading, "- " a bullet. Empty ID text falls back to EN.
- Placeholders `{noticeDays}`, `{issueDay}`, `{dueDay}`, `{flexQuota}` render from the settings, so the terms never contradict the app.
- **Publish** (action `terms.publish`, Owner and Management, applies at once) creates a new version after "Families will be asked to agree again"; every family contact is notified "Terms updated · read and agree".

**Family**:
- After sign-in, a contact whose `termsAgreed.version` is not the current version sees a full-screen page before the app:
  - first time: a short welcome ("Welcome, Rina — you're family for Ibu Sari", logo, parent photo), then the terms;
  - a newer version: titled "Terms updated", no welcome.
- The terms are in a scroll box; **Agree and continue** is disabled until the reader reaches the end ("Scroll to the end to continue"); if the text fits without scrolling it is enabled at once. A Sign out link is the only other way out.
- Agree is action `terms.agree { version }`; the server refuses other family actions (`err.termsFirst`) until the current version is agreed.
- **Me › Terms and conditions**: the current text, "You agreed on 2 Nov · version 2" at the end.

**Seed**: version 1 (EN and ID) covering plans and visits, monthly billing (invoice on the {issueDay}, due on the {dueDay}), the {noticeDays}-day notice period, leave, unpaid invoices, pick-up, field trips, birthdays, photos and privacy, health information. Every contact has agreed except one demo family login, so the first-login flow shows after a reset.

## Testing

Per phase:
- typecheck;
- unit tests — phase 1: birthday charge → pending charge → monthly line, remove refused once invoiced, void releases; field trip fee change re-prices and 0 removes, outing delete removes un-invoiced; next-bill preview totals; proof media must exist; `invoice.adjust` writes an email row; spouse set/clear. Phase 2: role draft save writes only non-default cells, default-off untouched cells still fall back to `can`, explicit off blocks; alert day for 30- and 31-day months and February, the exclusions, threshold; call log; settings owner gate for notice; terms publish bumps the version and notifies, agree, family action refused before agreeing, placeholders render;
- one e2e pass per phase on a phone viewport (phase 1: birthday charge → next invoice, field trip tick, billing contact switch with Emails list; phase 2: Owner edits a role and saves, Few visits card → log a call, family first login scroll-to-agree);
- screenshots at phone, tablet and desktop.

## Out of scope

- Custom roles; per-action permissions.
- Real email, real e-Meterai, DOKU.
- Moving billing dates, opening hours or staff leave days into Settings.
- A rich-text editor for the terms.
