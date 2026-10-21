# Round 12: staff and owner improvements

Date: 21 October 2026. Status: approved in chat, awaiting KC's review of this document.

## Why

KC's review with the CitraPremier owner is on 22 October. A colleague's competing app was reviewed first, and the owner named what matters to them. This round closes those gaps and adds a few things that make the app visibly more useful to staff (front desk, nurse, activity) and more meaningful to the owner. Success: every item below demos well on a phone on 22 October, seeded with a story.

KC's answers that shaped the scope:
- Build everything; KC reviews afterwards and asks for rollbacks where needed.
- Mood: five faces, one tap, required at the door, optional elsewhere.
- Front desk: venue bookings for the lobby, plus member celebrations. No visitor book, no call log.
- Registration: too long in one dialog; the paper scan blocks the demo; otherwise judge the friction while building.
- Month report: all four groups (money, members, care and mood, pipeline and team).
- Extras: birthdays and anniversaries, mood-by-activity insight. No incident log, no owner digest.

## What exists already (not rebuilt)

| Ask | Today |
|---|---|
| Mood | One mood word per day in the daily log (`DailyLog.mood`, four words), teacher's "Mood & notes" round. |
| Venue bookings | `VenueBooking` rows and the management Venue page (`features/mgmt/Venue.tsx`), management only. |
| Registration | Join from a lead (`features/enquiries/dialogs.tsx`) and Add member (`features/members/dialogs`), both one long dialog needing the signed paper form scan; the online link `/form/:token` pre-fills Join. |
| Not seen | `lastVisit` shown only for paused or closed members in the members list. |
| Nickname | `MemberRegistration.nickname` (Panggilan), shown as "Known as" on the profile overview only. |
| Reports | Daily report (Summary, By member), Insights (visits), management Overview. |
| Bad photo | Camera retake, Drafts before sending, Remove with an Undo toast, "show again". |

## Conventions that apply to everything below

- Shared, server-authoritative immer actions in `packages/shared/src/actions`, pure rules in `packages/shared/src/rules`, live SSE replica on the web. New rows extend `Row` and live in `ClubState`; the Drizzle table list (`apps/server/src/db/schema.ts`) and the snapshot/seed grow with them.
- Phone first, dense UI, no description text, iOS grouped lists, ink buttons, grey/white only (no pastel tints). Staff screens keep the warm skin; the family app keeps its own look.
- Full English and Indonesian strings.
- Round 5 rule: entries by non-management staff that families would see go through management approval. Where this spec says "no approval", it says why.
- Testing per KC's demo rule: typecheck, unit tests for the new rules and actions, one end-to-end pass of the demo script. No matrices.

## 1. Mood marks

### Data
```ts
export type MoodMoment = 'arrival' | 'health' | 'activity' | 'departure';
export interface MoodMark extends Row {
  memberId: string;
  date: ISODate;
  time: HM;
  moment: MoodMoment;
  /** 1 = upset … 5 = great */
  face: 1 | 2 | 3 | 4 | 5;
  /** activity marks: the session slot */
  slot?: Slot;
  /** health marks: the reading saved with it */
  readingId?: string;
  by: Actor;
}
// ClubState.moodMarks: Record<string, MoodMark>; id = `${date}:${memberId}:${moment}` or `${date}:${memberId}:activity:${slot}`
```
One mark per member per moment per day (one per session for activity). Marking again replaces the mark and keeps the latest `time` and `by`.

### Actions
- `mood.mark { memberId, moment, face, slot?, readingId? }`: any staff role. Upserts the mark for `ctx.today`. Rejects when the member is not checked in today (except `arrival`, which the check-in itself writes).
- `mood.clear { memberId, moment, slot? }`: same roles; removes the mark.
- `attendance.checkIn` and `attendance.checkOut` accept `face` (required for manual and face check-ins and for check-out) and write the `arrival` or `departure` mark in the same action. Undoing a check-in or check-out removes its mark.
- `reading.save` accepts an optional `face` and writes a `health` mark with `readingId`; `reading.void` removes that mark.
- `log.mark` (the daily-log round marking) accepts an optional `face` with a session mark and writes an `activity` mark with `slot`.

No management approval: marks are stamps like check-in times, entered at the moment, with no free text. Families see them at once.

### Faces
Five faces, one row, 44 px targets, the chosen one filled in ink, the rest outlined. Order left to right: great, good, okay, low, upset (values 5 to 1). Labels under the faces only on tablet and laptop. One shared component `MoodFaces` in `components/ui`.

### Where staff tap
- **Check-in**: the face-card confirm and the manual check-in row confirm get the face row above the button. The button is disabled until a face is tapped. Door camera auto check-ins (actor `doorCamera`) write no arrival mark; the lobby sees a small "Mood?" pill on that member's row that opens the faces.
- **Check-out dialog**: the face row above Confirm, required.
- **Health form** (nurse, management): the face row under the measurements, optional, saved with the reading.
- **Daily log, activity round**: beside Joined / Sat out for each person, a compact face row, optional.
- **Daily log, Mood & notes round**: the day's arc (faces with times) read-only at the top. The teacher's summary word stays.

### Where it shows
- **Member profile, Care log**: each day card shows the arc under the attendance line.
- **Daily report, Summary → Mood and notes**: counts of faces per moment (arrival, departure), the average arrival → departure change for the day, and "not marked at the door: N". By member: arrival and departure faces as two small icons.
- **Family Today timeline**: each mark is a timeline entry ("Arrived in a good mood, 10:02"). Family Health tiles unchanged.
- **Management Overview**: tile "Mood today" with the average face so far and the arrival → departure lift.

### Seed
Marks for every seeded check-in in the last six months: arrival and departure for every visit, health marks where a reading exists, activity marks for about 70% of sessions. Distribution weighted so the club lifts mood on average (departure one face higher than arrival for about 40% of visits). Scripted: Oma Lina arrives "okay" and leaves "great"; Opa Hendra arrives "low" on his Watch days.

## 2. Nickname everywhere

- `displayName(m)` in `rules/core.ts`: `${title} ${registration.nickname}` when a nickname is set, else `memberShort(m)`. `displayFull(m)` returns the full legal name for the secondary line.
- Every list row, picker, chip, photo tag, notification and feed line that calls `memberShort` for a member uses `displayName`. The full name appears as the secondary line in the Arrivals drawer, the members list, the profile hero and the health station header.
- Search (Arrivals member list, Members, MemberPicker, photo tagging) matches nickname, first name and last name, accent and case insensitive.
- Add member and Join ask for the nickname on the Person step, labelled "Called" / "Panggilan", directly under the name.
- Family app: the hero and switcher use `displayName` too.
- Seed: four roster members get long Chinese or Javanese full names with a short nickname, for example "Oei Giok Nio" called "Nio" and "Raden Ajeng Soekartini Wirjo" called "Tini". The five scripted members keep their names so existing tests hold.

## 3. Check on: not seen for a while

### Rule (`rules/checkOn.ts`)
```ts
export interface CheckOnRow { member: Member; lastVisit: ISODate | null; daysSince: number; usualGapDays: number | null; lastCall?: CareCall }
export function checkOnList(s: ClubState, today: ISODate): CheckOnRow[]
```
A member is listed when all hold:
- active today, not on leave this month, not on hold for an unpaid invoice;
- no check-in today;
- `daysSince` ≥ threshold, where threshold = clamp(2 × usual gap, 10, 14) and usual gap = median of the gaps between their check-ins over the last 90 days (null with fewer than three visits, then the threshold is 14);
- no care call with `checkAgainOn` later than today, and no care call in the last `threshold` days.
Sorted by `daysSince` descending. Members who joined less than 14 days ago are excluded.

### Data
```ts
export type CareCallOutcome = 'fine' | 'unwell' | 'hospital' | 'travelling' | 'wantsPause' | 'noAnswer' | 'other';
export interface CareCall extends Row {
  memberId: string;
  at: DT;
  by: Actor;
  contactName: string;
  phone: string;
  outcome: CareCallOutcome;
  note?: string;
  checkAgainOn?: ISODate;
}
// ClubState.careCalls
```
Action `member.logCall { memberId, contactName, phone, outcome, note?, checkAgainOn? }`: lobby, nurse, management. Staff-only data; families never see calls. `unwell` and `hospital` notify management (severity attention) and add a staff-only member note. `wantsPause` deep-links to the existing leave flow in the toast.

### Where it shows
- **Arrivals side rail**: a "Check on" block under Also today: up to five rows (display name, "18 days", last outcome if any), tap = call sheet, "All N" opens Members with the filter.
- **Members list**: a filter chip "Check on (N)".
- **Management Overview**: tile "Check on: N".
- **Call sheet** (bottom sheet on phone, dialog wider): the primary family contact's name and phone with a Call button (`tel:` link), then the outcome chips, note, "Check again on" date, Save. After Save the member leaves the list and a toast confirms.
- **Member profile, Care log**: calls appear as entries on their day, staff only.

### Seed
Two roster members with their last visit about 20 days before the demo date, one of them with a call logged a week ago ("travelling, back on …") so the demo shows both states.

## 4. Front desk bookings

### 4a. Venue for the lobby
- `venue` joins the lobby nav (it lands under More on phones). The page is the existing management page with role-aware actions: lobby can add, edit, cancel, ask for a rating and enter a rating by hand; "Create invoice" shows only to management and finance.
- Actions `venue.book`, `venue.update`, `venue.cancel`, `venue.askReview`, `venue.recordReview` widen `can` to lobby; `venue.createInvoice` stays management and finance. `venue.book` by a lobby user notifies management ("Caca booked the Garden Room for PT Maju, 28 Oct"). No approval: venue bookings are not family-visible.

### 4b. Celebrations
```ts
export interface Celebration extends Row {
  memberId: string;
  kind: 'birthday' | 'anniversary' | 'other';
  title: string;            // "Opa Budi's 80th"
  date: ISODate; from: HM; to: HM;
  roomId: string;
  guests: number;           // family and friends, besides the member
  cateringNote?: string;    // cake, tumpeng, outside catering
  status: 'requested' | 'confirmed' | 'declined' | 'cancelled';
  requestedBy: Actor; decidedBy?: Actor; decidedAt?: DT; declineReason?: string;
}
// ClubState.celebrations
```
- Actions: `celebration.request` (lobby, management), `celebration.edit`, `celebration.cancel` (lobby, management), `celebration.decide { id, status: 'confirmed' | 'declined', reason? }` (management). Management's own request is confirmed at once. Clash check: the room must be free of venue bookings and other confirmed celebrations for the time; club open hours apply; past dates are rejected.
- **Venue page** gets a segmented control: Venue · Celebrations. Celebrations list: upcoming first, requested ones with a "Waiting" pill for the lobby and Confirm / Decline buttons for management, then past ones. Add form: member (picker), kind, title (prefilled from kind and the member's name), date, time slot, room, guests, catering note.
- **Once confirmed**: the calendar day shows a chip; the kitchen's Menu day view shows "Celebration 15:00: Opa Budi's 80th, 12 guests, chocolate cake" and the covers count includes the guests; the family Today shows a card on the day and Calendar shows the chip. Requested or declined ones are invisible to families (the status, not the approval mark, does the gating; it reads better on the page).
- Management is notified of each request; the lobby is notified of each decision.

### Seed
One confirmed celebration: Opa Budi's birthday this week (see §7), Garden Room, 12 guests, cake note. One requested celebration for a roster member next week.

## 5. Registration: one stepped flow

- One component `RegistrationFlow` replaces the body of both Join and Add member. Steps: **Person** (title, name, called, gender, date of birth, address, NIK, photo), **Family** (primary contact, relation, phone, second contact, guarantor ID), **Health** (conditions, dementia, allergies, mobility, diet, carer), **Plan** (plan, start date, usual arrival, price shown), **Paper form** (the scan or PDF, plus KTP photos), **Review** (everything on one screen with Edit links per step, then Submit).
- Progress bar with step names at the top; on a phone one step per screen with Back and Next; on tablet and laptop the steps sit as a left rail with the current step on the right. Validation happens per step on Next; the Review step lists any step still incomplete.
- Draft: the flow's state is saved to this device (`localStorage` under a key per lead or "new"), so the desk can close it and resume; "Discard draft" clears it. Submit clears it.
- Pre-fill: a lead's name, contact, plan hint and the online-form draft fill the steps as today. Add member starts with an optional "From a lead" search (name or phone) that pre-fills the same way, so both entry points share one path.
- Duplicate check on the Person step: a phone or NIK that already belongs to a member or a lead shows a warning row with a link, non-blocking.
- **Sample form for the demo**: when demo sign-in is on (`CP_DEMO_LOGIN` not `0`, the same switch that shows the one-tap demo accounts), the Paper form step shows "Use sample form", which attaches the bundled sample scan (`apps/web/public/demo/sample-registration.jpg`) as the paper form. The real requirement is unchanged.
- While building, both flows are walked in the browser on a phone viewport and the top friction items found are fixed and listed in the plan.

## 6. Month report

- New management screen `monthReport` ("Month report"), in the first nav group next to Report. Period: the Insights period picker (this month, last month, last three, last six, custom). Every group compares with the previous period of the same length ("+3", "−2", with sage up and rust down where up is good, reversed for outstanding and lost).
- Rules module `rules/monthReport.ts` returning one typed object per group, unit-tested against the seed:
  - **Money**: billed, collected, outstanding (end of period), Flex extra days (count and amount), venue income (bookings in the period with an invoice), refunds. Sources: invoices, payments, refunds, venue bookings.
  - **Members**: active at period end, joined, ended (by reason), renewals kept and lost (from `rules/renewals.ts`), on leave, check-on count today, average visits per active member, utilisation = total visits ÷ (open days × active members).
  - **Care and mood**: mood index (average face over all marks), arrival → departure lift, average face by moment, health alerts and watches, re-checks done, lunch eaten share (all or most ÷ logged).
  - **Pipeline and team**: enquiries new, visits, trials, joined in the period with conversion between stages; lost reasons; duty completion per role (from `rules/tasks.ts`); family and venue survey averages.
- Each number is a row in an iOS grouped list; tapping opens the detail screen filtered to the period where one exists (Billing, Members, Insights, Enquiries, Tasks, Surveys).
- **Send to owner**: composes a plain-text summary in the current language (one line per key number) in a dialog with Copy and "Send on WhatsApp" (simulated, like broadcasts). Nothing is stored.

## 7. Birthdays and anniversaries

- `rules/occasions.ts`: `occasionsInRange(s, from, to)` returns `{ member, kind: 'birthday' | 'anniversary', date, years }` from `dob` and the first membership start (anniversaries from the first year). `occasionsThisWeek(s, today)` covers today through the next seven days.
- Shows: a block "This week" in the Arrivals rail (cake icon, "Opa Budi turns 80 on Friday"); a cake icon on the member's Arrivals row and face card on the day; a line on the kitchen's Menu day view; a chip on the calendar day (staff and family); a card on family Today ("Opa Budi turns 80 on Friday"); the member profile hero shows the age with "birthday Friday" when within the week.
- Seed: Opa Budi's `dob` is set so his birthday falls three open days after the demo date (the seed is rebuilt around today, so this is computed), and one roster member's anniversary falls in the week.

## 8. Mood by activity insight

- `rules/insights.ts` grows `moodInsights(s, period)`: average face per activity (from activity marks joined to the schedule), per weekday, per moment, the arrival → departure lift, and `moodDrops`: members whose last three visits show a falling arrival face (each lower than the one before).
- Insights gets a **Mood** tab: a summary line ("The club lifts mood by +0.8 on average"), a horizontal bar list of activities by average face with counts, weekday averages, and a "Dropping" list linking each member to the Check on call sheet.

## 9. Photo rollback

Existing behaviour stays. Addition: after Send from Drafts or the quick camera, the success toast carries Undo for eight seconds; Undo runs `photo.unsend { ids }` (activity, kitchen, management: own photos only), which returns the photos to draft, removes the pending approval and the family notification. The demo script gets a step "A bad photo: retake, then remove and undo".

## 10. Nav and roles summary

| Role | New or changed |
|---|---|
| Lobby | Venue (with Celebrations), Check on block, faces at check-in and check-out, birthdays block, stepped registration |
| Nurse | Face row on the health form, Check on call sheet from the profile |
| Activity | Faces per session in the activity round, arc in Mood & notes |
| Kitchen | Celebrations and birthdays on the Menu day, covers include celebration guests |
| Finance | Venue invoice unchanged |
| Management | All of the above plus Month report, celebration decisions, Mood tab in Insights, Overview tiles (Mood today, Check on) |
| Family | Mood entries on Today, celebration and birthday cards, nickname as display name |

## 11. Seed and demo script

Seed additions are listed per section. The demo pill's steps gain: "Mood at the door" (Lina checks in, picks a face), "Check on" (call Opa Tjahjadi's daughter), "Front desk books the venue", "Opa Budi's birthday", "A bad photo", "Month report". `pnpm db:reset` rebuilds everything around today.

## 12. Testing

- Typecheck across the monorepo.
- Unit tests: `rules/checkOn`, `rules/occasions`, `rules/monthReport`, `moodInsights`, `displayName` and search; actions `mood.mark`, check-in and check-out with faces (and their undo), `member.logCall`, `celebration.*` with clash checks, `photo.unsend`; the existing daily-report test grows the mood section.
- One end-to-end pass of the demo script with the small seed (`CP_SEED_SMALL=1`), including the stepped registration with the sample form.

## Out of scope this round

Visitor book, call log, incident log, owner weekly digest, digital signature on the online form, real WhatsApp or telephony.
