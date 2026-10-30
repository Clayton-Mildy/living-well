# Round 16: owner role, notice period, extra fees and billing contacts

Date: 30 October 2026. Status: designed with KC in chat and approved; written here for KC's review.

## Why

Before the ops-team presentation KC listed nine changes: a helicopter view of the member counts, a notice period for plan changes, emails to the family (contract, invoices), charges for birthdays, two new fees, an Owner above Management with a role access screen and owner approvals, passing the billing between sisters, and proof for payments recorded by hand.

KC's answers that shaped the scope:
- Roles: a **menu grid** (Hidden / View / Edit per role and menu item) plus **owner approval switches**; not per-action switches.
- The Owner in the demo is a new user, **Benjamin Cass**; Ega stays Management.
- Emails are **simulated** (like WhatsApp, DOKU and Xero today).
- Pick-up is a **monthly** fee per member; a field trip is charged **per trip** to the members who went.
- Billing between sisters: **switch the billing contact** (not per invoice, not automatic turns).
- A birthday's charges go on **their own invoice**; KC's worry was the VA, which already covers several invoices in one payment (point 4).
- Notice: **14 days before the 1st** of the month the change starts.
- Proof of payment is **required** for transfer and cash.

## Conventions

As in rounds 12–15:
- shared immer actions in `packages/shared/src/actions`, pure rules in `rules`;
- role checks server-side through `can`;
- dense phone-first UI, 44 px targets, ink, grey and white with the warm staff skin, no pastel tints;
- every string in EN and ID;
- family edits go through approvals, except where this spec says otherwise;
- seed RNG-neutral, `CP_SEED_SMALL=1` working, club state under the 7,500,000-character cap at the real date and at 2026-12-30;
- minimal tests (typecheck, unit tests for new rules and actions, one e2e pass per phase);
- verified at phone, tablet and desktop.

## Phase 1 — day-to-day

### 1. Members: Flex and Gold beside Active

The filter row becomes **Active · Flex · Gold · In the club · Attention · Check on · Ended** (`MEMBER_FILTERS` reordered), each with its count. Flex and Gold count active members only, as today. The grey split line under the filters ("12 Flex · 30 Gold", round 14) is removed for Active, because the chips say it; In the club keeps its Plan chips.

### 2. Two weeks' notice for plan changes

- New setting `ClubSettings.noticeDays` (default 14), edited in **Plans and pricing** (owner approval applies, point 10).
- The deadline for a change starting in month M is `1st of M − noticeDays` (December → 17 November).
- **Downgrade, stop and leave** need the deadline; an **upgrade** can be asked until the day before the 1st (as today). Upgrade/downgrade compares the plans' monthly prices on the 1st of M (equal price = a downgrade, so notice applies).
- The rule applies wherever a change is made: the family app (plan request, leave request), Next month (renewals follow-up) and the member's Plan tab. Leave's own 14-day rule (`rules/leave.ts`) reads the setting instead of a constant.
- After the deadline the change cannot be made for M. The form says "Too late for December · earliest January" and offers M+1. Entry point: the Next month change sheet gets a **Starts** choice (M or M+1) when M is past its deadline, so the front desk can record a late request for the month after; the family app's month choices skip months whose deadline has passed.
- A stop's last day must fall in the first allowed month or later (a stop recorded on 20 November ends on 31 December at the earliest).

### 3. Contract email to the family (simulated)

- `FamilyContact.email` (optional), in the family contact add/edit forms, the registration form's family step and the family app's Me profile (a family edit, so it goes to approval).
- New collection `emails`: `{ to, toName, familyId, memberId, kind: 'contract' | 'invoice', subject, ref: { type: 'document' | 'invoice', id }, sentAt, sentBy, status: 'sent' | 'noAddress' }`. Nothing leaves the server; the row is the record.
- **When**: once the member is active and the membership form is fully signed (stamped), whichever comes second, the signed form is "emailed" to the billing contact. The member's Documents section shows "Contract emailed to rina@… · 30 Oct" and a **Send again** button (management, front desk). With no email on file the row is `noAddress` and the section says "No email for Rina — add one", with the same Send again after it is added.
- Toast for staff on the activating action: "Contract emailed to rina@…".

### 4. Birthday charges, on their own invoice

- `Celebration.charges: { id, item, amount }[]` (default empty = free). **Add charge** (item, price) on the celebration sheet for the front desk and management while the celebration is open; remove a charge before it is invoiced.
- **Issue invoice** (finance, management) creates one invoice (`kind: 'manual'`, lines of a new kind `'celebration'`, due in 7 days) for the charges not yet invoiced, sent to the billing contact (in-app notification and simulated email, point 3). Charges added later go on a new invoice.
- The family sees the charges on the celebration in their app before the invoice exists.
- Payment: each member has one virtual account and the family app's **Pay** already pays every open invoice of that member in one VA transfer (`payment.simulateVa`), so a monthly invoice plus a birthday invoice is one payment. No change needed there; the Bills list shows both.

### 5. Pick-up fee and field trip fee

- `PriceVersion.pickup` (monthly default) and `PriceVersion.fieldTrip` (per trip default), edited in Plans and pricing beside the dementia fee.
- **Pick-up**: the member's Billing section gets a **Pick-up** row: off, or on at the default price or a custom price (`Member.pickup: { on: boolean; price?: number }`, management and finance). The monthly invoice adds a `'pickup'` line for months the plan is billed (not leave months, not after a stop). The Billing section shows the price in force ("Pick-up · Rp 600.000 / month · custom").
- **Field trip**: the Calendar's **Outing** event (existing kind) gets a **Field trip fee** (`CalendarEvent.fee`, defaults from settings, 0 = free) and, from its date on, a **Who went** list where staff tick members. Each ticked member gets a pending charge (`PendingCharge`, label "Field trip · {title} · {date}") that lands on their next monthly invoice (existing mechanism). Unticking before it is invoiced removes the charge. Activity and management tick; finance sees it.

### 6. Switch the billing contact

- The billing contact is the member's `primary` family link (unchanged: one flag).
- New action `family.setBillingContact { memberId, familyId }`: the current billing contact (family app, Me › Bills: "Billing contact: you · Pass to …" listing the member's other approved contacts) or staff (front desk, finance, management; member › Family › "Make billing contact"). Applies at once, no approval: the family alternates month by month.
- Effects: the new contact becomes `primary`; every **unpaid** invoice of that member moves to her (`payerFamilyId`) and is re-emailed to her; every invoice issued from then on goes to her and is emailed (point 3 extends to all invoices: monthly, final, manual, birthday). Both contacts and finance are notified.
- Because it is one flag, she also becomes the contact for plan and leave requests and for the membership form signature (a form already sent stays with its signer; a resend goes to her, as in round 14).

### 7. Proof of payment

- `Payment.proofMediaId`. Recording a payment by hand (`payment.record`) with method **bank transfer** or **cash** requires a photo: the transfer slip or the signed receipt (camera or upload, `POST /api/media`). DOKU VA payments and `other` don't need one.
- The proof shows on the payment in Payments and in the finance approval of a front-desk payment (round 13).

## Phase 2 — Owner and roles

### 8. The Owner role

- `StaffRole` gains `'owner'`. Seed: **Benjamin Cass** (username `benjamin`, password `citra123`), Owner, supervisor. Ega stays Management.
- The Owner has everything Management has (`isMgmt` and `hasRole(u, 'mgmt')` are true for the Owner; notifications to `mgmt` reach the Owner), plus **Admin › Roles** and the owner approvals. The Owner's access cannot be edited.
- Owner nav = Management's nav plus **Roles** under Club. Lands on Arrivals like Management.

### 9. Admin › Roles

- `ClubSettings.access: Record<role, Record<menuKey, 'off' | 'view' | 'edit'>>` for Management, Front desk, Nurse, Activity, Kitchen and Finance. Missing = the defaults.
- The screen (Owner only): one row per role, one column per menu item (on phones: pick a role, then a list of menu items with a Hidden / View / Edit dropdown each). Save applies at once for everyone.
- **Hidden**: not in the menu, links to it are refused. **View**: the screen opens read-only, its buttons are hidden and the server refuses that menu's actions. **Edit**: the menu's staff actions are allowed for that role.
- Enforcement: every staff action is mapped to one menu key (`actionArea`). A role-list check in `can` (for example `finMgmt`) is replaced by an area check `canEdit(user, area, state)`; row checks stay (own entries, family-only actions, approval gates). The UI hides controls through the same check.
- Defaults reproduce today's access exactly (NAVS, NAVG, EXTRA and the current `can` role lists), plus KC's changes:
  - Front desk (Caca): **Billing: View**.
  - Management: **Receipts: View** — only Finance (and the Owner) approve receipts.
- The phone bar and the sidebar groups are built from the grid (order as today; a newly granted item goes under its usual group).

### 10. Owner approvals

- `ClubSettings.ownerApproval: Record<role, { pricing: boolean; holidays: boolean; budget: boolean }>`, shown as three switches per row on the Roles screen. Default: all three on for Management, off for the others.
- **pricing**: Plans and pricing changes (`prices.set`, `club.setPlan`, the fees and `noticeDays`). **holidays**: adding, moving or removing a `closed` or `holiday` Calendar event. **budget**: setting the weekly budget limits and sections (`budget.setLimit`, `budget.addSection`, `budget.renameSection`).
- A gated change is stored as a `ChangeRequest` (`kind: 'approval'`, new sections `'pricing' | 'holiday' | 'budget'`) through the existing approval gate; it applies when the Owner approves it in **Approvals**, and is dropped when he rejects it (with a note). The person who asked sees "Waiting for owner" where they made the change and is notified of the decision.
- Management keeps approving staff entries (photos, logs, family-visible notes, front-desk payments) as today; the Owner can approve them too.
- Seed: one pending holiday from Ega (a closed day in December) waiting for Benjamin.

## Testing

Per phase:
- typecheck;
- unit tests: notice deadline (downgrade late/on time, upgrade late, stop last day, leave from the setting), billing contact switch (unpaid invoices move, new invoice payer, emails), birthday invoice, pick-up line (custom price, leave month), field trip charge on/off, proof required, role grid defaults equal today's access, view refuses an action, edit grants one, owner approval gate apply/reject;
- one e2e pass of the phase's main story on a phone viewport.

## Out of scope

- Sending real email (provider, domain, PDF rendering on the server).
- Per-action permission switches.
- Automatic turns between payers.
- Owner approval for invoice adjustments, voids or a member's plan change (Management's own changes there apply as today).
- DOKU (D4).

## Assumptions confirmed in chat

1. "Change the plan and billing" means the **Plans and pricing** settings (prices, catalogue, fees, notice period).
2. Management keeps approving staff entries; the Owner can approve them too.
3. The billing contact and the primary contact stay one flag.
