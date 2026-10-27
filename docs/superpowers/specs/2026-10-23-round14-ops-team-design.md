# Round 14: what the owner asked for before the operations team sees it

Date: 23 October 2026. Status: scoped with KC in chat (sections A–E approved); waiting for KC's review of this document.

## Why

KC presented the app to the owner (Ben) on 23 Oct. They agreed to work together and go live, but the app is still treated as a demo: the next showing is to CitraPremier's operations team. A friend's notes of the meeting list seven areas; this round turns them into features the ops team can walk through on a phone.

KC's answers that shaped the scope:
- Still a demo: every integration stays simulated (DOKU, Xero, e-Meterai, receipt OCR), but each sits behind a provider interface so the real one can plug in later.
- Order: A (changes to what exists) and B (new operations) first; then C purchasing with simulated OCR; then D online signing with a simulated e-Meterai; then E a super search. The chatbot is out.
- Membership rolls on by default and needs no approval from Ega; the month-end screen lists changes and unpaid invoices only.
- Dementia stays a yes / no; "yes" tells the family it costs more.
- Mood: all six moments are expected, none blocks anything.
- Lunch belongs to the F&B team (photos and who ate), not the activity team.
- Every activity programme (weekdays and weekends) goes to Ega for approval; a weekend day with an approved programme is an open drop-in day.
- The Members page "In the club" filter shows the Flex / Gold split.

Already built and only re-shown (not rebuilt): the monthly leads breakdown (Month report: joined, lost with reasons, conversion; Enquiries → History), member trends (Insights → Membership), check-out times (Daily report → By member, in–out), nicknames as display names (round 12), lunch photos with a food AI suggestion, DOKU virtual-account payments (simulated) with the Xero sync status.

## Conventions

Same as rounds 12 and 13: shared immer actions in `packages/shared/src/actions`, pure rules in `rules`, dense phone-first UI, ink/grey/white with the warm staff skin, every string in EN and ID, approvals for non-management entries families would see, minimal tests (typecheck, unit tests for new rules and actions, one e2e pass at the end of each phase). Seed changes keep `CP_SEED_SMALL=1` working for e2e.

## Phase 1 — A: changes to what exists

### A1. Membership rolls on; Renewals becomes "Next month"
- Every active member continues into the next month unless something is recorded. Nobody has to be called to say "continue".
- `features/renewals` is renamed **Next month** (nav key unchanged, label `renewals.title`), with two tabs:
  - **Changes**: plan switch (Flex ↔ Gold), leave (cuti) and stop, recorded by the front desk, finance or management. A change applies from the 1st of the chosen month **without approval**: `actions/renewals.ts` stops calling `markPending` for these outcomes; `FollowUp.status` goes straight to `done`. The 14-day leave notice and "at most 2 months in a row" rules stay. A row lists member, change, from-date, recorded by; Undo until the 1st.
  - **Unpaid**: every issued invoice past its due day and not fully paid (`rules/finance.ts`). Row: member, family contact with Call / WhatsApp, amount owed, days late, the suspend and stop dates from `settings.suspendDay` / `stopDay`. A tap opens a follow-up sheet: outcome `promised` (with a date) | `paid` (opens Record payment) | `disputed` | `noAnswer`, a note, and the call history. Stored as `UnpaidFollowUp { invoiceId, memberId, calls: { at, by, outcome, promisedOn?, note? }[] }`, id `uf-${invoiceId}`. Visible to lobby, finance and management. A promised date that passes puts the row back at the top.
- The old "18 of 45 decided" progress bar, the "To do / Waiting for management / Decided" segments and the call-everyone duty go. Past months stay a read-only log of changes.
- Round 13's lobby plan change (`PlanChangeRequest`) also applies directly from next month with no approval; the request record stays as the history.
- The renewals duty in `rules/tasks.ts` becomes "Unpaid · N to follow up" (lobby and finance), done when every unpaid row has a call this week.

### A2. Dementia notice and fee
- `PriceVersion.dementia?: number`, a monthly fee set by management in Manage → Plans → **Extra charges** (seed Rp 750.000).
- Registration (paper form step, online form, Edit details): answering **Yes** shows an inline notice under the question: "Dementia care costs Rp 750.000 more a month." (ID text alongside). The Review step and the printed application form show the fee line.
- Invoicing: a member with `registration.dementia === true` gets an `InvoiceLine { kind: 'dementia' }` each month at the price version's rate. Changing the answer applies from the next invoice. The Next invoice preview on the Plans page shows it.

### A3. Nanny details
- `Member.nanny` gains `photoMediaId?`, `note?` (e.g. agency, which days they come). The KTP photo keeps using the `nannyKtp` document.
- Add member, Edit details and the online form get a nanny photo (camera or upload, same `CameraCapture` as the profile photo).
- The member profile shows a Nanny row with the photo, name, phone and note; the Arrivals check-in drawer shows the nanny's face and name under the member so the desk knows who came along.

### A4. Today's numbers in Insights and on Members
- Insights → Overall gets a **Today** block at the top (any date in range shows that day): active members split Flex / Gold, came today, in the club now, gone home, not in today.
- Members page: the **In the club** filter chip reads "In the club · 12" and, when selected, the list header shows "8 Flex · 4 Gold". The Active filter shows the same split for all active members.
- Rule: `rules/insights.ts` `dayCounts(s, date) → { active: { flex, gold }, came, inNow, gone, notIn }`, reused by both.

### A5. Mood at six moments
- `MoodMoment` becomes `'arrival' | 'health' | 'morning' | 'lunch' | 'activity' | 'departure'` (labels: Check-in, Nurse, Morning, Lunch, Activity, Checkout). Existing marks keep their moments.
- One scale everywhere: the 5 faces each carry a fixed meaning shown under the picker (EN / ID):
  5 Joyful, chatting and laughing · 4 Content, engaged · 3 Calm, quiet but fine · 2 Low, withdrawn or tired · 1 Distressed, agitated or in pain.
- Who marks what, where they already work:
  - Check-in and Checkout: lobby, in the check-in / check-out drawer (no longer required: the face row is shown but saving without it is allowed).
  - Nurse: the health form (as now).
  - Morning: activity team, a one-tap **Morning round** on Activity Today listing everyone in the club (from 09:30 until lunch).
  - Lunch: F&B, in the new lunch round (A6).
  - Activity: activity team, per session (as now).
- Nothing blocks. `rules/tasks.ts` gets one duty per role, "Mood · N not marked" (lobby: arrival + departure; nurse: health for members with a reading; activity: morning + each session joined; kitchen: lunch), done when zero.
- **Daily mood** = the rounded average of that day's marks (`rules/mood.ts` `dailyMood(s, memberId, date) → { face, marks }`). It replaces the daily log's mood word wherever a day summary is shown (Care log, Daily report, Month report mood index, Insights → Mood). The `DailyLog.mood` field stays for old data and is no longer edited.
- Family app: Today shows the day's mood face with its meaning and a small line of the faces through the day (moment label under each); Health → history shows the daily mood trend.

### A6. Lunch moves to the F&B team
- The kitchen role gets **Lunch round** on its Today: everyone in the club, one row each with how much they ate (`all | most | half | little | none`, the existing `DailyLog.lunch` values) and the lunch mood face; it opens at 11:30. Lunch photos (`features/kitchen/LunchPhotos.tsx`) sit at the top of the same screen.
- The lunch field leaves the activity team's daily log editor (`features/activity/LogFields.tsx`, `DailyLog.tsx`, `Drafts.tsx`); activity keeps sessions, the morning round, notes. `DailyLog.lunch` is written by the kitchen action `kitchen.lunchMark`; the approval rule for staff entries families see applies as before.
- Families: Today gets a **Lunch** card (the day's dishes from `DayMenu`, the approved lunch photos, their parent's portion). The Photos feed filter gains **Meals / Activities** (meals = `kind: 'lunch'` plus tea photos; activities = everything else except arrival).
- Staff photo library gets the same Meals / Activities split.

### A7. Birthdays two weeks ahead
- "Also today" (`features/lobby/AlsoToday.tsx`) and the activity Today list birthdays and anniversaries for the next **14 days** (`occasionsInRange(s, today, addDays(today, 14))`).
- A job notifies activity, lobby and management exactly 14 days before each birthday: "Oma Lina turns 82 on 6 Nov".
- Each birthday row has **Prepare**, opening the existing Celebration request (`features/mgmt/Celebrations.tsx`) pre-filled with the member, kind birthday, the date and the usual room; a row that already has a celebration shows its status instead.

## Phase 1 — B: new operations

### B1. Every activity programme goes to Ega
- `schedule.publish` by activity staff now stores the version as `status: 'pending'` (the status already exists on `ScheduleVersion`); management's `schedule.approve` publishes it from its `effectiveFrom` and sends the usual notification; `schedule.return` sets `rejected` with `rejectNote`. Management's own publish stays direct.
- One-day changes and extra sessions (`ScheduleDay`) by activity staff get `approval?: Approval` through `approvalGate.ts` (`markPending`); until approved, everyone except the activity team and management sees the previous day plan.
- Approvals gets a **Programme** group (weekly versions and day changes); the row shows the week or date and a before / after of the changed sessions.
- The activity team's calendar shows a "Waiting for Ega" badge on affected days and "Returned: <note>" with Edit and Resubmit.

### B2. Weekends
- `Weekday` widens to `1 | 2 | 3 | 4 | 5 | 6 | 7`; `ScheduleVersion.days` and `MenuVersion.days` take optional Saturday (6) and Sunday (7) entries. The weekly plan editors show Sat and Sun columns after Fri, empty by default.
- Open-day rule (`rules/core.ts` day status, `openDaysInMonth`, `util.ts` `isWeekday` callers): a date is open if it is Mon–Fri and not a holiday or closure, **or** it is Sat / Sun with at least one approved session that day (weekly plan or day change). Everything that keys off "open" follows: check-in, health station, lunch round, duties, Flex visit counting (a weekend visit counts like any visit), the family calendar and day strip.
- `settings.hoursLabel` default becomes "Mon–Fri 08:30–16:30 · weekends when programmed".
- Seed: an approved Saturday programme this month (two sessions, a menu), and a pending Sunday programme in Ega's Approvals.

### B3. Year view
- Calendar (staff and family) gets **Year** next to Month: 12 small months in one scroll (two per row on a phone, four on a laptop).
- Each day is shaded: closed / holiday (light grey), open weekday (white), weekend open day (ink outline). Small dots below a day: event or outing, celebration, birthday.
- Tap a month → that month; tap a day → that day.
- Family version: no staff-only items, and only their own parent's birthday.

### B4. Small consistency points
- The Month report counts weekend open days in attendance and links its money section to Next month → Unpaid.
- Search, notifications and the Approvals bar include the new Programme group.

## Phase 2 — C: purchasing with simulated OCR

### C1. Itemised receipts
- `Receipt` gains `source: 'shop' | 'tokopedia' | 'other'`, `orderNo?`, `lines: ReceiptLine[]` with `ReceiptLine { id, name, brand?, qty, unit, unitPrice, amount, category }`. `amount` stays the receipt total.
- Anyone who buys (lobby, kitchen, activity, finance, management) can submit from Receipts: photo of the nota or the Tokopedia order screen → lines → section → send to finance. This replaces Caca's monthly WhatsApp of photos to Gabriel.
- Finance's review (approve / reject / edit / void) is unchanged; the receipt sheet shows the lines.

### C2. Simulated OCR
- Server interface `apps/server/src/providers/receiptOcr.ts`: `extract(mediaId) → { supplier?, source?, orderNo?, date?, lines: ReceiptLine[], total?, confidence }`. The simulated provider picks a plausible receipt from a seeded catalogue (adult diapers, wet wipes, gloves, rice, cooking oil, sugar-free biscuits, craft paper, paint, cleaning liquid…, with brands and price ranges) and waits about 1.5 s.
- UI: after the photo, "Reading the receipt…", then the lines appear pre-filled and editable (add, remove, change). If the lines do not add up to the total, an inline warning with the difference. "Filled in automatically: check before sending."
- A real provider (a vision model or a document-AI service) replaces the simulated one by config; nothing in the screens changes.

### C3. Vendor categories
- `DirectoryContact` (suppliers) gains `category`: Groceries, Medical supplies, Hygiene & toiletries, Activity materials, Cleaning, Kitchen equipment, Online marketplace, Other. The list is editable by finance in the Directory.
- The Directory gets a category filter; a receipt's lines default their category from the supplier's.

### C4. Spending
- Finance → **Spending** (finance and management): a period picker (this month, 3 months, 6 months, custom), then totals by category, by item, by brand and by vendor, approved receipts only.
- An item row: quantity bought, average unit price, a small price trend; tap → every purchase of that item.
- Seed: six months of itemised receipts (mostly Tokopedia, some shops) for the charts.

## Phase 3 — D: online signing, e-Meterai, payment provider

### D1. Sign the membership form online
- The membership application form (already printed from member data, `rules/applicationForm.ts`) gets a signing flow: the front desk taps **Send for signing** (simulated WhatsApp link) or the family opens it from the family app, Me → Documents.
- The family reads the filled form, draws a signature, and confirms with a simulated 6-digit OTP. Management then countersigns in Approvals.
- `MemberDocument` gains `signing?: { status: 'draft' | 'sent' | 'signed' | 'countersigned' | 'stamped'; steps: { status, at, by }[]; meterai: 'e' | 'physical'; meteraiSerial?: string }`.

### D2. e-Meterai or physical meterai
- Per document, the front desk chooses **e-Meterai** (default) or **Physical meterai**.
- e-Meterai: server interface `apps/server/src/providers/stampProvider.ts`, `affix(documentId) → { serial, at }`; the simulated provider returns a serial; the signed PDF shows the e-Meterai box with the serial. A licensed distributor plugs in behind the same interface later.
- Physical: print, sign over a paper meterai, scan or photograph it with the existing paper-form scan; the document is marked "Physical meterai" and goes straight to stamped.

### D3. Status trail
The member profile Documents list shows each document's status (Draft → Sent → Signed by family → Countersigned → Stamped) and its timeline (who, when).

### D4. Payment provider interface (added by Claude while writing the spec: KC to confirm)
DOKU virtual-account payments are already simulated end to end. Move the simulation behind `apps/server/src/providers/paymentGateway.ts` (`createVa(invoice)`, and a `POST /api/payments/doku/notify` endpoint shaped like DOKU's payment notification that the "simulate payment received" button calls) so a real DOKU account only swaps the provider. No visible change.

## Phase 4 — E: super search (staff app)

- Opens from a search icon in the top bar on phones (full screen) and a search field at the top of the sidebar on laptops, plus ⌘K / Ctrl-K.
- Finds, grouped: **Screens** (EN and ID keywords and synonyms: "tagihan", "invoice", "bayar" → Billing), **Actions** (Add member, Record payment, Request leave, New celebration, Submit receipt, Send for signing…: each opens the right screen or sheet), **People** (members by nickname or full name, family contacts, staff, guest hosts), **Records** (invoice numbers, leads, dishes, activities, suppliers).
- Ranking: exact and prefix matches first, then word matches, then a small typo tolerance. Recent searches are kept on the device (`localStorage`, wrapped in try/catch).
- Only what the signed-in role can open is shown. Every screen and action declares its keywords in one registry, `apps/web/src/app/searchRegistry.ts`, so a new feature becomes searchable with one entry. Searching runs on the synced client state; no server search.

## Testing

Per phase: typecheck; unit tests for the new rules and actions (rolling membership, unpaid list, dementia line, `dayCounts`, `dailyMood`, weekend open days, programme approval, receipt lines total, signing status moves, search ranking); one e2e pass of the phase's main story on a phone viewport.

## Out of scope

The chatbot; real DOKU, Xero, e-Meterai and OCR accounts; Tokopedia API import (receipts come from photos of the order); a family-facing search.

## Assumptions to confirm in review

1. Dementia: one monthly fee, set by management, added to the invoice (A2).
2. Morning mood = one round by the activity team before lunch (A5).
3. KC overruled this on 27 Oct 2026: families see one daily face (the average of the marked moments), no face per moment (A5). Done on branch round14-p2, commit d6bcfdd.
4. D4 (payment provider interface) was not asked for; it is invisible plumbing so DOKU can go live.
