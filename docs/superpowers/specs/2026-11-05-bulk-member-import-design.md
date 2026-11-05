# Bulk member import: design

Date: 5 Nov 2026. Branch: `bulk-import`, from `main` (5d2e0bb).

## Purpose

Load the club's current members into the app at go-live from one Excel file, instead of typing each one through Add member. Afterwards, show staff what each member still lacks (KTP, registration form and so on) and let them fill it in from one list.

Decided with KC:

1. For current members at go-live: past start dates are allowed and those members owe no registration fee.
2. Management (and the Owner) only, on desktop and tablet. The missing list also works on phones.
3. Preview first. Rows with errors are blocked, good rows import, bad rows can be downloaded to fix.
4. The registration form starts as "requested". The uploader confirms the club holds data consent. Face consent is no unless the file says yes.
5. No messages to families at import. Management invites them later.
6. Conditions, allergies, mobility and diet are imported, with allergies required as an explicit "None". Medicines, photo and spouse are completed later. A missing carer NIK is allowed and listed.
7. Show what is missing after import.
8. Front desk filling an empty document or photo slot applies at once. Replacing what is already on file still needs approval.

## Out of scope

- Importing from any column layout. Only our template is accepted.
- Updating existing members from a file. Duplicates are refused.
- Carrying over old invoices, balances or visit history.
- Closing an open lead automatically. The preview warns; staff close the lead.
- Asking families in bulk for missing documents.
- Face enrolment on the missing list: the code has no action that enrols a face, so staff could never clear the item.

## Flow

### 1. Template

Members > Import members (shown to management and the Owner on tablet and desktop widths, next to Add member; not shown on phones). The screen offers Download template and Choose file.

The template is generated in the browser so its dropdowns match the current catalogue. Language follows the app. Row 1 holds the headers; a required header is marked with `*`.

| Column | Required | Rule |
|---|---|---|
| Title * | yes | Dropdown of the presets; free text allowed (warning if the title isn't in the known female list and isn't Opa or Bapak, because gender is read from the title and defaults to male) |
| Full name * | yes | At least 2 characters |
| Date of birth * | yes | Text column, dd/mm/yyyy; age 18 to 120 |
| Start date * | yes | Text column, dd/mm/yyyy; see Start date below |
| Plan * | yes | Dropdown of active plans |
| Contact name * | yes | At least 2 characters, unless the phone matches an existing contact |
| Contact phone * | yes | Text column; valid after `e164` |
| Relation * | yes | Dropdown of `RELATIONS` |
| Food allergies * | yes | "None", or a comma-separated list of `FOODS`, with anything else kept as `foodOther` |
| Drug allergies * | yes | "None", or a comma-separated list; a name outside the known list becomes `other:<name>` |
| Contact email | no | Valid email |
| Nickname, address, city | no | As Add member |
| Member NIK, family NIK | no | Text column, 16 digits |
| Usual arrival | no | HH:MM inside opening hours |
| Conditions | no | Comma-separated |
| Diabetic | no | Yes/No, blank is No |
| Mobility | no | Dropdown of `MOBILITIES`, blank is none |
| Diet | no | Comma-separated from `DIETS` |
| Dementia care | no | Yes/No, blank is No. Billed monthly, so it lives in the file |
| Pick-up | no | Yes/No, blank is No |
| Pick-up price | no | Whole rupiah within `PICKUP_MIN` to `PICKUP_MAX`; blank uses the club's price |
| Carer name, carer phone, carer NIK | no | Carer NIK is 16 digits when given; blank is listed as missing |
| Face consent | no | Yes/No, blank is **No** |
| Spouse name | no | Free text; only puts "Spouse link" on the missing list |
| Care notes | no | Up to 1000 characters |

### 2. Reading the file

- Read in the browser with `exceljs`, dynamically imported on this screen so it never reaches phones or other screens.
- Only `.xlsx`, at most 5 MB and 300 rows. Wholly blank rows are skipped. Headers are matched by template name in either language; a missing required header refuses the file, naming the header.
- The file itself is not uploaded or stored.

**NIK.** A numeric cell is refused, not read: Excel keeps 15 significant digits, so the 16th has already become 0 and would still pass the 16-digit check. The row error says to retype it as text. A text NIK must be exactly 16 digits.

**Dates.** Date columns are text, so a typed date stays as typed whatever the laptop's locale. Text is parsed as dd/mm/yyyy or yyyy-mm-dd; anything else is an error. A real Excel date cell (pasted from elsewhere) is accepted, and carries a warning to check it. The preview always writes dates out in full ("3 Apr 1945").

**Phones.** Numeric cells are accepted: `e164` restores the +62, and a phone has few enough digits to survive.

### 3. Preview

Each row is checked by one pure function, also used by the server:

`packages/shared/src/rules/memberImport.ts`: `checkImportRows(rows, state, today)` returns, per row, `{ row, input, errors, warnings, linksContactId? }`.

**Errors (the row is blocked):**

- Any field rule above.
- Same name and date of birth as a live member (including pending), or as an earlier row in the file. Names compare trimmed, single-spaced and case-insensitively.
- Same NIK as a live member or an earlier row.
- Contact phone belongs to a staff member.
- Same phone as an earlier row, but a different contact name.
- Future start date on a closed day or a weekend.

**Warnings (the row still imports):**

- Unknown title (treated as male).
- Date read from a real Excel date cell.
- Contact phone or senior name matches an open lead.
- No carer NIK.

**Contact matching.** A phone matching an existing contact links to that contact. A phone repeated in the file with the same name shares one new contact. Both show in the preview as "Joins contact Rina Santoso, +62 812-…", with the count at the top, because a mistyped phone would otherwise attach a member to another family.

A contact's existing `primary` link is left alone. The member's new link is primary for that member, so the contact pays for them.

The screen shows counts (ready, link to a contact, can't import), the rows with problems first, then a required tick, "The club holds signed data consent for these N members", then Download N rows to fix and Import N members. Downloaded rows use the template columns with an added Error column.

### 4. Import: `members.import`

`packages/shared/src/actions/memberImport.ts`, with `can: isMgmt`-level access (management and Owner) and no review.

Input: `{ batchId, fileName, consentConfirmed: true, rows }`. The action re-runs `checkImportRows` against the current state, and any error refuses the **whole** action, naming the row, so nothing half-imports. The screen then re-checks against fresh state and shows the preview again.

For each row, creation reuses the code of `members.create`, moved into a shared `createMemberRow` helper, with these differences:

| Field | `members.create` | Import |
|---|---|---|
| Form or signature | Required | Not required; `membershipForm` document starts as `requested` |
| Start date | Today or later | Past allowed, on any day; future as Add member |
| Carer NIK | Required with a carer | Optional |
| New family link `appAccess` | `true` | **`false`** until invited |
| `healthAlerts` | `true` | `true`, so it works from the invite on |
| `activateMember` | Runs for management | **Does not run**: no welcome, no contract email |
| Medicines | From the form | Empty, `medsPending: true` |
| Feed | One entry per member | One entry for the batch |

New field on `Member`, no new table:

```ts
imported?: {
  batchId: string;
  on: ISODate;
  at: DT;
  by: Actor;
  fileName: string;
  /** until members.setMeds runs for this member (an empty list counts as "no medicines") */
  medsPending: boolean;
  /** from the file; shown on the missing list until spouseId is set */
  spouseName?: string;
  invitedAt?: DT;
};
```

Contacts created by an import get `importBatchId` so that Undo can remove them.

Data consent is recorded per member as `via: 'staff'` with the uploader's name and time. Face consent comes from the file.

### 5. Result, invite and undo

The result screen shows the number added, "No messages sent to families", the missing counts per item, See what's missing, and Undo import.

The import screen keeps a Last import card, derived by grouping members on `imported.batchId`: file name, who, when, count, Invite families and Undo import.

**`members.inviteImported { batchId }`** (management). For each member of the batch not yet invited: turns the batch's links `appAccess` on, then runs the existing `activateMember` (activation, welcome notification, contract email if already stamped), and sets `invitedAt`. Running it twice changes nothing.

**`members.undoImport { batchId }`** (management). Soft-deletes the batch's members and their links, and the contacts it created unless they still have another live link (a later import or a manual link may share them). It refuses the whole batch once any member has an attendance row, trip visit, invoice, payment or pending charge, naming the first member. After an invite it is also refused, because the family has been told.

### 6. Missing details

`packages/shared/src/rules/memberMissing.ts`: `missingItems(s, member)` returns the items below, worked out live, so an item goes as soon as it is filled in. It covers every active, non-pending member, imported or not. Existing members with gaps will appear too.

| Item | Missing when | Filled in by |
|---|---|---|
| Registration form | `membershipForm` not `onFile` | Upload scan (`signing.physical`), or Send to sign once the family is invited (`signing.send`) |
| Member KTP | `ktp` not `onFile` | Upload or camera |
| Family KTP | `guarantorKtp` not `onFile` | Upload or camera |
| Carer KTP | has a carer and `nannyKtp` not `onFile` | Upload or camera |
| Carer NIK | has a carer and no NIK | Opens the carer form on the profile |
| Photo | no `photoMediaId` | Upload or camera |
| Medicines | `imported.medsPending` | Nurse or management: Add, or "No medicines" (`members.setMeds`). Other roles see the item with no button |
| Spouse link | `imported.spouseName` set and no `spouseId` | Opens the profile |

A document on file with no scan means a paper copy at the club, as it does today, and counts as present. `healthInfo` isn't listed: it's optional.

**Members list.** New filter `missing` ("Missing details · 48") in `MEMBER_FILTERS`, for lobby, nurse, management and Owner, plus a second dropdown for one item. Rows show one small outlined chip per item. Styling stays grey, white and ink.

**Row sheet.** Tapping a row in this filter opens a sheet listing that member's items with their buttons (reusing `useDocPicker`), so staff can work down the list without opening each profile. A filled item leaves the sheet; the sheet closes after the last one. Outside this filter a row opens the profile as today.

### 7. Front desk approvals

The `review.policy` of these actions becomes a function, as the framework already allows. It returns `'none'` when the change only fills an empty slot, and `'gate'` otherwise:

- `members.setDocuments`: every document in the input has no `onFile` or `pendingReview` document of its type.
- `members.updateDetails`: the patch contains only `photoMediaId`, and the member has no photo.
- `signing.physical`: the form document isn't `onFile`.

This applies to every member, not only imported ones. `members.setMeds` keeps its `flag` policy (applies at once, reviewed afterwards).

## Billing and other rules

- **Registration fee.** `registrationDue` returns false when `m.imported` exists and the current membership's start is before `m.imported.on`. A future start in the file still owes it, and so does a member who leaves and rejoins, since their new start is later.
- **Invoices.** Imported members are billed from the next run, invited or not, because `billingContactOf` and `primaryContact` ignore `appAccess`. A run bills only its own period, so a past start must not back-bill; a test confirms this.
- **Few visits.** `fewVisitMembers` skips a member whose import date falls after the first of the month, so visits before go-live, which the app can't see, don't flag them. Without this, everyone imported mid-month looks absent.
- **Flex quota.** In the import month a Flex member has their full quota, because earlier visits aren't known. Accepted for go-live.
- **Member numbers and virtual accounts.** Assigned in row order by the existing `nextMemberNumber`. Undo leaves a gap in the numbers, which is harmless.

## Family app

A contact with only invite-pending links has no visible members (`familyMemberIds` filters on `appAccess`). If they sign in before the invite, they must see a plain "Your club will invite you soon" state, not a broken or blank screen. This is built and tested as part of this work.

An existing contact who gains an imported parent doesn't see that parent until the invite.

## Errors

| Situation | Behaviour |
|---|---|
| Not `.xlsx`, unreadable, over 5 MB or 300 rows | Message on the import screen; nothing is read |
| Missing required header | Names the header and offers the template |
| No good rows | Import button replaced by Download rows to fix |
| State changed since the preview | Action refused with the row; preview re-checks |
| Consent not ticked | Import button asks for the tick; the server also refuses |
| Undo after activity or invite | Refused, naming the first member; end memberships individually |
| Connection lost during import | The retry sends the same `batchId`; the action refuses a `batchId` already used, and the screen then shows that batch's result. The server has no `mutationId` de-duplication to rely on |

## Files

New:

- `packages/shared/src/rules/memberImport.ts`: template columns, row checks
- `packages/shared/src/rules/memberMissing.ts`: `missingItems`
- `packages/shared/src/actions/memberImport.ts`: `members.import`, `members.inviteImported`, `members.undoImport`
- `apps/web/src/features/members/import/`: `ImportMembers.tsx`, `readWorkbook.ts`, `writeTemplate.ts`, `MissingSheet.tsx`

Changed:

- `packages/shared/src/actions/members.ts`: `createMemberRow` helper; review policy functions; `setMeds` clears `medsPending`
- `packages/shared/src/actions/signing.ts`: review policy function
- `packages/shared/src/rules/members.ts`: `missing` filter
- `packages/shared/src/rules/billing.ts`: `registrationDue`
- `packages/shared/src/rules/fewVisits.ts`: import-date skip
- `packages/shared/src/types.ts`: `Member.imported`, `FamilyContact.importBatchId`
- `packages/shared/src/i18n/{en,id}`: all new text in both languages
- `apps/web/src/features/members/MembersList.tsx`: Import button, filter, chips, sheet
- Family app: the waiting-for-invite state
- `apps/web/package.json`: `exceljs`

## Testing

Minimal, per KC's rule, with one test runner at a time and `--maxWorkers=2`.

- Typecheck.
- Unit: `checkImportRows` (each error and warning, duplicates in file and in state, phone matching, numeric NIK); `members.import` (all-or-nothing, no welcome, `appAccess` off, used `batchId` refused); invite (idempotent); undo (refused after activity, keeps a contact with another live link); `registrationDue`; past start not back-billed; few-visits skip; `missingItems`; empty-slot review policy, including replace still gated.
- Reading a real `.xlsx`: one fixture written by `writeTemplate`, read back by `readWorkbook`.
- One e2e pass: download template, upload a filled file, fix nothing, import, see the missing list, upload a KTP, undo.
- Screenshots on phone, tablet and desktop.
