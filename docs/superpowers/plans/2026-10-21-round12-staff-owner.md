# Round 12: staff and owner improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the owner's named gaps (mood at four moments, nickname as display name, "check on" members not seen, front desk venue and celebration bookings, stepped registration, a month report) and add birthdays and a mood-by-activity insight, all seeded with demo stories for the 22 October review.

**Architecture:** Three new `ClubState` collections (`moodMarks`, `careCalls`, `celebrations`) registered through the single `COLLECTIONS` array plus one drizzle migration; new pure rules modules (`mood`, `checkOn`, `celebrations`, `occasions`, `monthReport`) with unit tests; new `defineAction` entries following the `venue.book` pattern; web screens built from the existing kit (`Sheet`, `Group`, `Segmented`, `ListCard`). Families see mood marks and confirmed celebrations through `projectForFamily`; care calls stay staff-only by default.

**Tech Stack:** TypeScript, React 18 + Vite, Hono, Drizzle + PostgreSQL 17, immer, zod 4, vitest, Playwright. Monorepo with pnpm.

**Spec:** `docs/superpowers/specs/2026-10-21-round12-staff-owner-design.md`

## Global Constraints

- Phone first, dense UI: no description text under controls, iOS grouped lists (`Group`, `GROUP_HEAD`), ink buttons, grey/white only. Staff screens keep `data-skin=warm`; the family app keeps its own kit (`family/kit.tsx`).
- Every new string in both `packages/shared/src/i18n/en/*` and `id/*`; the ID file is typed `Same<typeof EN>`, so typecheck enforces parity.
- New collection rows extend `Row` and name their indexed fields `memberId`, `date`, `status`, `kind` so `store.ts keyCols` indexes them for free.
- Actions use `defineAction` with hand-written parsers from `rules/mgmtParse.ts` (`obj, str, int, isoDate, hm, oneOf, bool`) or a local zod `parseWith`; role checks with `hasRole(u, ...)`; ids with `ctx.id(prefix)`; side effects through `ctx.feed` / `ctx.notify`.
- Faces: `1 | 2 | 3 | 4 | 5`, 5 = great. Order on screen left to right: 5, 4, 3, 2, 1. Labels: great, good, okay, low, upset.
- Check-on threshold: `clamp(2 × usualGap, 10, 14)` days; usual gap = median gap between check-ins over the last 90 days, `null` with fewer than three visits (then 14).
- Tests: `pnpm typecheck`, `pnpm test <file>`, and one e2e pass. No full matrices.
- Commit after each task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Deviations from the spec (decided while planning, each one line)

1. **Face is optional at the action level** for `attendance.checkIn` / `checkOut`; the UI disables the confirm button until a face is tapped. Reason: forty existing tests, the e2e helpers and the seeded demo deep link call check-in without a face, and the door is the only place the rule matters.
2. **No "Mood?" pill for door-camera auto check-ins**: there is no auto check-in path in the code (`doorCamera` is only an actor label), so there is nothing to patch.
3. **Guided demo steps are off** (`SHOW_GUIDED = false` in `shell/DemoPanel.tsx`), so §11's "demo steps" become README script rows plus the e2e spec `e2e/round12.spec.ts`.
4. **Opa Budi turns 80**, not whatever 1942 gives: his `dob` year becomes 1946 so "turns 80 on Friday" reads well; tests that pinned his age get updated in Task 14.

## Review Focus

Inputs the spec implies but no feature test exercises; each line's test is added to the owning task.

1. Check-out with no check-in today, or a face sent for a member already checked out: the action must fail with the existing codes and write no mark (Task 2).
2. A member with exactly one or two visits in 90 days: the usual gap is `null` and the threshold is 14, never `NaN` or 0 (Task 8).
3. A celebration requested in a room and time that a venue booking already holds, or on a closed day: refused with the venue codes, nothing stored (Task 10).
4. A registration draft saved on this device for lead A must not pre-fill lead B or a fresh Add member (Task 11).
5. A month report for a period with no invoices, no visits and no marks: every number is 0 or `null`, every ratio avoids division by zero, and the screen renders empty states, not `NaN` (Task 12).

---

### Task 0: Commit the round 8 to 11 working tree

The working tree holds 346 modified files from rounds 8 to 11 (family redesign, v4 warm skin, round 10 and 11 asks), browser-checked but never committed. Round 12 commits must not carry them.

**Files:** everything `git status` lists.

- [ ] **Step 1: Check nothing stray is staged**

Run: `git status --short | grep -v '^ M\|^??' ; git status --short | grep '^??'`
Expected: no unexpected untracked files beyond `docs/superpowers/plans/` (this plan). Build output (`apps/web/dist`, `artifacts/`) must be ignored; if `git status` lists any, add the path to `.gitignore` first.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Rounds 8-11: family app redesign, v4 warm skin for staff, fewer taps, parent switch, online form link, NIK and carer fields

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 1: Three new collections

**Files:**
- Modify: `packages/shared/src/types.ts` (after `Attendance` ~L324 for `MoodMark`; after `MemberNote` ~L268 for `CareCall`; after `VenueBooking` ~L547 for `Celebration`; `ClubState` ~L1103; `COLLECTIONS` ~L1115)
- Modify: `apps/server/src/db/schema.ts:28-38` (named exports)
- Create: `apps/server/drizzle/0005_round12_collections.sql` + `meta/0005_snapshot.json` + `meta/_journal.json` entry (generated)
- Modify: `packages/shared/src/project.ts:32-90`
- Test: `packages/shared/src/seed.test.ts`, `apps/server/src/server.test.ts`

**Interfaces:**
- Produces (types.ts), copied from the spec §1, §3, §4b:

```ts
export type MoodMoment = 'arrival' | 'health' | 'activity' | 'departure';
export type Face = 1 | 2 | 3 | 4 | 5;
export interface MoodMark extends Row { memberId: string; date: ISODate; time: HM; moment: MoodMoment; face: Face; slot?: Slot; readingId?: string; by: Actor }
export type CareCallOutcome = 'fine' | 'unwell' | 'hospital' | 'travelling' | 'wantsPause' | 'noAnswer' | 'other';
export interface CareCall extends Row { memberId: string; date: ISODate; at: DT; by: Actor; contactName: string; phone: string; outcome: CareCallOutcome; note?: string; checkAgainOn?: ISODate }
export type CelebrationKind = 'birthday' | 'anniversary' | 'other';
export type CelebrationStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled';
export interface Celebration extends Row { memberId: string; kind: CelebrationKind; title: string; date: ISODate; from: HM; to: HM; roomId: string; guests: number; cateringNote?: string; status: CelebrationStatus; requestedBy: Actor; decidedBy?: Actor; decidedAt?: DT; declineReason?: string }
```
  `ClubState` gains `moodMarks`, `careCalls`, `celebrations` as `Record<string, X>`; `COLLECTIONS` gains the three names (appended at the end).
- `CareCall.date` is the call date (`ctx.today`), kept so `keyCols` indexes it.

- [ ] **Step 1: Write the failing tests**

In `packages/shared/src/seed.test.ts` add:
```ts
it('round 12 collections exist and start empty in Adina', () => {
  const { citra, adina } = buildSeed();
  for (const k of ['moodMarks', 'careCalls', 'celebrations'] as const) { expect(citra[k]).toBeTypeOf('object'); expect(adina[k]).toEqual({}); }
});
```
In `apps/server/src/server.test.ts`, in the family snapshot test, add: `expect(snap.careCalls).toEqual({});` and `expect(Object.keys(snap.moodMarks)).toBeDefined();` (projection keys exist).

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test packages/shared/src/seed.test.ts apps/server/src/server.test.ts`
Expected: FAIL (property does not exist / type error).

- [ ] **Step 3: Add the types, the `ClubState` fields and the `COLLECTIONS` entries in `types.ts`; add `export const moodMarks = tables.moodMarks, careCalls = tables.careCalls, celebrations = tables.celebrations` to `schema.ts`.**

- [ ] **Step 4: Generate the migration**

Run: `pnpm --filter @cp/server exec drizzle-kit generate --name round12_collections`
Expected: `apps/server/drizzle/0005_round12_collections.sql` with three `CREATE TABLE` blocks (`mood_marks`, `care_calls`, `celebrations`) and the journal entry. Inspect it against `0004_round7_collections.sql`.

- [ ] **Step 5: Family projection in `project.ts`**

Add after the venue block: `out.moodMarks = pick(s.moodMarks, (r) => mine.has(r.memberId))` and `out.celebrations = pick(s.celebrations, (r) => mine.has(r.memberId) && r.status === 'confirmed')`, using the same member-set helper the file already uses for `dailyLogs`. `careCalls` stays `{}`.

- [ ] **Step 6: Run the tests and the typecheck**

Run: `pnpm test packages/shared/src/seed.test.ts apps/server/src/server.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/types.ts apps/server/src/db/schema.ts apps/server/drizzle packages/shared/src/project.ts packages/shared/src/seed.test.ts apps/server/src/server.test.ts
git commit -m "round 12: moodMarks, careCalls and celebrations collections

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Mood rules and actions

**Files:**
- Create: `packages/shared/src/rules/mood.ts`, `packages/shared/src/rules/mood.test.ts`
- Create: `packages/shared/src/actions/mood.ts`, `packages/shared/src/actions/mood.test.ts`
- Modify: `packages/shared/src/actions/index.ts:2-34` (register `moodActions`)
- Modify: `packages/shared/src/actions/attendance.ts:24-30` (parsers), the `checkIn` / `checkOut` / `undoCheckIn` / `undoCheckOut` runs
- Modify: `packages/shared/src/actions/health.ts:117-135` (`reading.save` parse + run), `reading.void` run (~L266)
- Modify: `packages/shared/src/actions/care.ts:155` (`markSchema`), `applyMarks`
- Modify: `packages/shared/src/rules/index.ts` (export `./mood`)
- Test: `packages/shared/src/actions/attendance.test.ts` (helper `checkIn` keeps working without a face)

**Interfaces:**
- Produces (`rules/mood.ts`):
```ts
export const FACES: readonly Face[] = [5, 4, 3, 2, 1];
export const FACE_KEY: Record<Face, string>;                // 'mood.face.5' …
export const moodId = (date: ISODate, memberId: string, moment: MoodMoment, slot?: Slot) => string; // `${date}:${memberId}:${moment}` or `…:activity:${slot}`
export function marksOn(s: ClubState, memberId: string, date: ISODate): MoodMark[];                 // live, sorted by time
export interface DayArc { arrival?: Face; health?: Face; activity: { slot: Slot; face: Face }[]; departure?: Face; lift: number | null }
export function dayArc(s: ClubState, memberId: string, date: ISODate): DayArc;                      // lift = departure − arrival, null unless both
export interface MoodStats { index: number | null; n: number; byMoment: Record<MoodMoment, { avg: number | null; n: number }>; lift: number | null; liftN: number; notMarkedAtDoor: number }
export function moodStats(s: ClubState, dates: ISODate[]): MoodStats;                               // notMarkedAtDoor counts visits (checkIn) on those dates without an arrival mark
export function writeMark(d: Draft<ClubState>, ctx: Ctx, m: { memberId: string; moment: MoodMoment; face: Face; slot?: Slot; readingId?: string }): MoodMark; // upsert, keeps id
export function clearMark(d: Draft<ClubState>, date: ISODate, memberId: string, moment: MoodMoment, slot?: Slot): void;
```
- Produces (`actions/mood.ts`): `mood.mark { memberId, moment, face, slot?, readingId? }` (any staff role: `isStaff(u)`), fails `mood.err.notIn` unless `moment === 'arrival'` or the member has `checkIn` today; `mood.clear { memberId, moment, slot? }`.
- Attendance: `parseArrival` returns `{ memberId, method, face?: Face }`; new `parseDeparture` returns `{ memberId, face?: Face }` and replaces `parseMember` on `attendance.checkOut`. `checkIn` writes an `arrival` mark when `face` is given; `checkOut` a `departure` mark; `undoCheckIn` / `undoCheckOut` call `clearMark`.
- Health: `ReadingSaveInput.face?: Face`; `reading.save` writes a `health` mark with `readingId` when given; `reading.void` clears the mark whose `readingId` matches.
- Care: `markSchema.face: z.union([z.literal(1)…z.literal(5)]).optional()`, allowed only with `session`; `applyMarks` writes an `activity` mark per member with `slot = session.slot` when `session.value` is `'joined'` or `'satOut'` and `face` is given.

- [ ] **Step 1: Write the failing rules tests** (`rules/mood.test.ts`)

```ts
const T = '2026-10-21'; const s0 = buildSeed().citra;
const withMarks = produce(s0, (d) => { for (const [moment, face, time] of [['arrival', 3, '10:00'], ['departure', 5, '15:45']] as const) d.moodMarks[moodId(T, 'm1', moment)] = { id: moodId(T, 'm1', moment), clubId: d.clubId, createdAt: `${T}T${time}`, createdBy: 'staff:s1', memberId: 'm1', date: T, time, moment, face, by: 'staff:s1' }; });
it('moodId is stable and slot-aware', () => { expect(moodId(T, 'm1', 'activity', '10:30')).toBe('2026-10-21:m1:activity:10:30'); expect(moodId(T, 'm1', 'arrival')).toBe('2026-10-21:m1:arrival'); });
it('dayArc gives the lift', () => { const a = dayArc(withMarks, 'm1', T); expect(a.arrival).toBe(3); expect(a.departure).toBe(5); expect(a.lift).toBe(2); expect(dayArc(s0, 'm1', T).lift).toBeNull(); });
it('moodStats counts visits without an arrival mark', () => { const st = moodStats(withMarks, [T]); expect(st.index).toBe(4); expect(st.n).toBe(2); expect(st.lift).toBe(2); expect(st.notMarkedAtDoor).toBe(Object.values(withMarks.attendance).filter((a) => a.date === T && a.checkIn).length - 1); });
```

- [ ] **Step 2: Write the failing action tests** (`actions/mood.test.ts`, with the `club.test.ts` preamble: `run`, `fails`, `clock`)

```ts
it('mood.mark upserts one mark per moment', () => {
  let s = run(seed(), 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 's1').state;
  s = run(s, 'mood.mark', { memberId: 'm1', moment: 'arrival', face: 4 }, 's1').state;
  s = run(s, 'mood.mark', { memberId: 'm1', moment: 'arrival', face: 2 }, 's1').state;
  const marks = Object.values(s.moodMarks).filter((m) => m.memberId === 'm1' && m.date === T);
  expect(marks).toHaveLength(1); expect(marks[0].face).toBe(2); expect(marks[0].time).toBe('10:00');
});
it('mood.mark refuses a non-arrival mark before check-in', () => fails(seed(), 'mood.mark', { memberId: 'm1', moment: 'health', face: 3 }, 's8', 'mood.err.notIn'));
it('mood.mark rejects face 6', () => fails(seed(), 'mood.mark', { memberId: 'm1', moment: 'arrival', face: 6 }, 's1', 'err.invalid'));
it('check-in with a face writes the arrival mark; undo removes it', () => {
  const s1 = run(seed(), 'attendance.checkIn', { memberId: 'm1', method: 'manual', face: 3 }, 's1').state;
  expect(s1.moodMarks[moodId(T, 'm1', 'arrival')]?.face).toBe(3);
  const s2 = run(s1, 'attendance.undoCheckIn', { memberId: 'm1' }, 's1').state;
  expect(s2.moodMarks[moodId(T, 'm1', 'arrival')]).toBeUndefined();
});
it('check-out with a face writes departure; without check-in it fails and writes nothing', () => {
  fails(seed(), 'attendance.checkOut', { memberId: 'm1', face: 5 }, 's1', 'err.notCheckedIn');
  const s1 = run(seed(), 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 's1').state;
  const s2 = run(s1, 'attendance.checkOut', { memberId: 'm1', face: 5 }, 's1', { ...clock, nowMin: 15 * 60 }).state;
  expect(s2.moodMarks[moodId(T, 'm1', 'departure')]).toMatchObject({ face: 5, time: '15:00' });
  fails(s2, 'attendance.checkOut', { memberId: 'm1', face: 1 }, 's1', 'err.alreadyCheckedOut');
});
it('reading.save with a face writes a health mark tied to the reading; void clears it', () => {
  const s1 = run(seed(), 'attendance.checkIn', { memberId: 'm2', method: 'face' }, 's1').state;
  const r = run(s1, 'reading.save', { memberId: 'm2', kind: 'arrival', sys: 130, dia: 80, pulse: 70, noteKeys: [], shared: true, tellFamily: false, recheck: false, deferMonthly: false, face: 4 }, 's8');
  const mark = r.state.moodMarks[moodId(T, 'm2', 'health')];
  expect(mark).toMatchObject({ face: 4, readingId: r.result.readingId });
  const s3 = run(r.state, 'reading.void', { readingId: r.result.readingId, reason: 'duplicate', withMonthly: false }, 's8').state;
  expect(s3.moodMarks[moodId(T, 'm2', 'health')]).toBeUndefined();
});
it('log.mark with a session and a face writes an activity mark per member', () => {
  const s1 = run(seed(), 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 's1').state;
  const s2 = run(s1, 'log.mark', { date: T, memberIds: ['m1'], session: { slot: '10:30', value: 'joined' }, face: 5 }, 's5').state;
  expect(s2.moodMarks[moodId(T, 'm1', 'activity', '10:30')]?.face).toBe(5);
});
```
(Use the real reading field names from `ReadingSaveInput`; the test above lists the ones `reading.save` requires for an arrival.)

- [ ] **Step 3: Run both files to see them fail**

Run: `pnpm test packages/shared/src/rules/mood.test.ts packages/shared/src/actions/mood.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `rules/mood.ts` with the signatures above; implement `actions/mood.ts` and register it; thread `face` through attendance, health and care as described in Interfaces.**

Parsing: in attendance use `const face = (raw) => raw.face === undefined ? undefined : int(raw.face, 1, 5, 'face') as Face` from `mgmtParse`; in care use the zod union; in health follow the file's own helpers.

- [ ] **Step 5: Run the new tests plus the touched suites**

Run: `pnpm test packages/shared/src/rules/mood.test.ts packages/shared/src/actions/mood.test.ts packages/shared/src/actions/attendance.test.ts packages/shared/src/actions/health.test.ts packages/shared/src/actions/care.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the `mood` i18n namespace** (`i18n/en/mood.ts`, `i18n/id/mood.ts`, registered in both `index.ts`): `face.5 … face.1` (Great / Good / Okay / Low / Upset; Senang sekali / Baik / Biasa / Kurang / Sedih), `moment.arrival/health/activity/departure`, `err.notIn`, `ask` ("How is {name} today?"), `askOut` ("How is {name} leaving?"), `notMarkedDoor` ("Not marked at the door: {n}"), `lift` ("Lift {n}"), `index` ("Mood index"), `arc`.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/rules/mood.ts packages/shared/src/rules/mood.test.ts packages/shared/src/rules/index.ts packages/shared/src/actions/mood.ts packages/shared/src/actions/mood.test.ts packages/shared/src/actions/index.ts packages/shared/src/actions/attendance.ts packages/shared/src/actions/health.ts packages/shared/src/actions/care.ts packages/shared/src/i18n
git commit -m "round 12: mood marks: rules, mood.mark/clear, faces on check-in, check-out, readings and session marks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Faces at the door

**Files:**
- Create: `apps/web/src/components/ui/MoodFaces.tsx` (export from `components/ui/index.tsx`)
- Modify: `apps/web/src/features/lobby/FaceCard.tsx:21-37` (`MatchedPanel`: new props), `Arrivals.tsx:85-101, 125, 188-194` (`doCheckIn`/`doCheckOut` take a face; state `face`), `CheckoutDialog.tsx:34-52`, `MemberRow.tsx:53-59` (mood dot)
- Test: `apps/web/src/components/ui/MoodFaces.test.tsx`, `apps/web/src/features/lobby/MemberList.test.tsx` (existing file; add the check-out dialog case if it mounts dialogs, otherwise a new `CheckoutDialog.test.tsx`)

**Interfaces:**
- `MoodFaces({ value, onChange, size = 44, labels = false, name }: { value: Face | null; onChange: (f: Face) => void; size?: number; labels?: boolean; name: string })` — a `role="radiogroup"` with five `role="radio"` buttons `aria-label={t(FACE_KEY[f])}`, `data-face={f}`, chosen one filled `#24201C` with white glyph, others outlined `HAIRLINE`. Glyphs: Material icons `sentiment_very_satisfied`, `sentiment_satisfied`, `sentiment_neutral`, `sentiment_dissatisfied`, `sentiment_very_dissatisfied`.
- `MatchedPanel` gains `face: Face | null`, `onFace: (f: Face) => void`; the confirm button is `aria-disabled` and grey while `face === null`. The row sits above the buttons with the caption `t('mood.ask', { name })` at 14px.
- `Arrivals.doCheckIn(memberId, method, face)` and `doCheckOut(memberId, face)` pass `face` into the action input. `CheckoutDialog.onConfirm: (id: string, face: Face) => Promise<boolean>`; its confirm button is disabled until a face is chosen. The demo deep link `?demo=arrival` passes `face: 4`.
- `MemberRow` sub line: when today's arc has an arrival face, a `DotItem` with the face icon (16px) before the time.

- [ ] **Step 1: Write the failing component test** (`MoodFaces.test.tsx`, jsdom, same mount helper as `Enquiries.test.tsx`)

```ts
it('renders five faces, great first, and reports the tap', () => {
  const on = vi.fn(); mount(<MoodFaces value={null} onChange={on} name="t" />);
  const radios = host!.querySelectorAll('[role=radio]'); expect(radios).toHaveLength(5);
  expect(radios[0].getAttribute('data-face')).toBe('5'); expect(radios[4].getAttribute('data-face')).toBe('1');
  act(() => (radios[1] as HTMLButtonElement).click()); expect(on).toHaveBeenCalledWith(4);
});
it('marks the chosen face', () => { mount(<MoodFaces value={3} onChange={() => {}} name="t" />); expect(host!.querySelector('[role=radio][aria-checked=true]')?.getAttribute('data-face')).toBe('3'); });
```

- [ ] **Step 2: Write the failing check-out test**: mount `CheckoutDialog` for `m1` after a seeded check-in; assert the confirm button has `aria-disabled="true"`, click face 5, assert enabled, click confirm, assert `onConfirm` called with `('m1', 5)`.

- [ ] **Step 3: Run to see them fail** — `pnpm test apps/web/src/components/ui/MoodFaces.test.tsx apps/web/src/features/lobby/CheckoutDialog.test.tsx` → FAIL.

- [ ] **Step 4: Implement `MoodFaces`; wire `MatchedPanel`, `Arrivals`, `CheckoutDialog`, `MemberRow` per Interfaces.** Reset the chosen face whenever `scan` changes or the dialog closes.

- [ ] **Step 5: Run the tests and typecheck** — PASS.

- [ ] **Step 6: Browser check on the phone viewport**: `preview_start` the web dev server, sign in as `caca`, open Arrivals, start a manual check-in: confirm is grey until a face is tapped; check out Opa Budi with a face. Screenshot.

- [ ] **Step 7: Commit** — `git add apps/web/src/components/ui apps/web/src/features/lobby` ; message `round 12: mood faces at check-in and check-out`.

---

### Task 4: Faces on the health form and in the activity round

**Files:**
- Modify: `apps/web/src/features/health/form.ts:38-48, 137` (`Draft.face: Face | null`, `toInput` passes `face` when set), `ReadingForm.tsx:106-122, 175-193` (a `MoodFaces` row above Quick notes, caption `t('mood.ask', { name })`), `HealthStation.tsx:159-185` (draft reset keeps working)
- Modify: `apps/web/src/features/activity/DailyLog.tsx:103-106, 129-133, 217` (`MarkRow` gains `face`, `onFace`; `markOne` sends `face` with the session mark), `LogFields.tsx` (no change to `LOG_ROWS`), `DailyLog.tsx` mood round header: the arc (read-only `MoodArc`)
- Create: `apps/web/src/features/activity/MoodArc.tsx`: `MoodArc({ arc, size = 18 }: { arc: DayArc; size?: number })` — faces with times in a row (arrival · activity… · departure), muted when missing
- Test: `apps/web/src/features/activity/DailyLog.test.tsx` (new; mount the activity round for today's seeded check-ins and assert a face tap calls `log.mark` with `face`)

**Interfaces:**
- Consumes `MoodFaces`, `dayArc`, `FACE_KEY` from Tasks 2 and 3.
- In the activity round, tapping a face on a row whose session value is still unset marks the session `joined` and the face together (one `log.mark` call).

- [ ] **Step 1: Write the failing DailyLog test** (assert on the mocked `act` payload `{ date, memberIds: ['m1'], session: { slot, value: 'joined' }, face: 5 }`).
- [ ] **Step 2: Run to see it fail.**
- [ ] **Step 3: Implement the health draft field, the form row, `MoodArc`, and the activity row faces.**
- [ ] **Step 4: Run the test, typecheck.** PASS.
- [ ] **Step 5: Browser check** as `dewi` (health form shows the faces, optional) and `dinar` (activity round, a face per row; Mood & notes round shows the arc).
- [ ] **Step 6: Commit** — `round 12: mood faces on the health form and the activity round`.

---

### Task 5: Mood everywhere it is read

**Files:**
- Modify: `packages/shared/src/rules/dailyReport.ts:16, 97, 220-252` — `ReportMember.arrivalFace?: Face; departureFace?: Face`; `ReportMood.faces: { arrival: Record<Face, number>; departure: Record<Face, number>; lift: number | null; notMarkedDoor: number }`
- Modify: `packages/shared/src/rules/family.ts:144-185` — `TlItem` `arrival`, `health`, `home` variants gain `face?: Face`
- Modify: `packages/shared/src/rules/mgmt.ts:222-255` — `OverviewStats.mood: { index: number | null; lift: number | null; n: number }`
- Modify: `apps/web/src/features/report/Summary.tsx:230-261` (`MoodNotes`: a face-count line for arrival and departure, the lift, "not marked at the door"), `ByMember.tsx:17, 72, 89, 100` (mood column shows the two faces)
- Modify: `apps/web/src/features/members/profile/CareTab.tsx:107-162` (`DayCard`: `MoodArc` under the attendance line)
- Modify: `apps/web/src/features/family/Timeline.tsx:89-175` (`view()` adds the face to the title: `t('ftoday.arrivedMood', { face: t(FACE_KEY[f]) })`)
- Modify: `apps/web/src/features/mgmt/Overview.tsx:32-48` (tile `mood`, value `index` to one decimal, badge with the lift, `to: '/insights?tab=mood'`)
- Test: `packages/shared/src/rules/dailyReport.test.ts`, `packages/shared/src/rules/family.test.ts`, `packages/shared/src/rules/mgmt.test.ts`

- [ ] **Step 1: Write the failing rules tests**

```ts
// dailyReport.test.ts
it('counts faces at the door and the lift', () => { const r = dailyReport(withMarks, T, T, 16 * 60); expect(r.mood.faces.arrival[3]).toBe(1); expect(r.mood.faces.departure[5]).toBe(1); expect(r.mood.faces.lift).toBe(2); expect(r.members.find((x) => x.m.id === 'm1')).toMatchObject({ arrivalFace: 3, departureFace: 5 }); });
// family.test.ts
it('timeline carries the faces', () => { const items = timelineOf(withMarks, [m1], T, 16 * 60); expect(items.find((i) => i.kind === 'arrival')).toMatchObject({ face: 3 }); expect(items.find((i) => i.kind === 'home')).toMatchObject({ face: 5 }); });
// mgmt.test.ts
it('overview has the mood index', () => { expect(overviewStats(withMarks, T).mood).toEqual({ index: 4, lift: 2, n: 2 }); expect(overviewStats(buildSeed().citra, T).mood.index).toBeNull(); });
```
(`withMarks` as in Task 2's rules test; put it in a shared test helper `packages/shared/src/rules/testMarks.ts` if two files need it.)

- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement the rules changes, then the four screens.**
- [ ] **Step 4: Run tests + typecheck.** PASS. Also `pnpm test apps/web/src/features/report/DailyReport.test.tsx`.
- [ ] **Step 5: Commit** — `round 12: mood arc on the profile, daily report, family timeline and overview`.

---

### Task 6: Seed the mood history

**Files:**
- Modify: `packages/shared/src/seed/history.ts:181-216` (visits loop: add arrival and departure marks), `:250-301` (health mark with each arrival reading), `:316-371` (activity marks for ~70% of joined sessions)
- Modify: `packages/shared/src/seed/index.ts:269-373` (today's and the last four weeks' scripted rows: Lina arrives 3 leaves 5 today; Hendra arrives 2 on Watch days)
- Test: `packages/shared/src/seed/history.test.ts`

**Interfaces:** marks use `moodId` and the `hash32(key)`-seeded `unit()` helpers already in `history.ts`, keyed `mood:${memberId}:${date}:${moment}` so adding them does not shift other streams.

Distribution: arrival face = weighted pick {5: 15%, 4: 40%, 3: 35%, 2: 8%, 1: 2%}; departure = arrival + 1 (capped at 5) in 40% of visits, same otherwise, −1 in 5%. Health marks copy the arrival face. Activity marks: 70% of joined sessions, face = max(arrival, departure) in 60%, arrival otherwise.

- [ ] **Step 1: Write the failing seed test**

```ts
it('every historical visit has arrival and departure marks and the club lifts mood', () => {
  const s = buildSeed().citra; const visits = Object.values(s.attendance).filter((a) => a.checkIn && a.checkOut && a.date < DEMO_TODAY);
  for (const a of visits.slice(0, 50)) { expect(s.moodMarks[moodId(a.date, a.memberId, 'arrival')]).toBeDefined(); expect(s.moodMarks[moodId(a.date, a.memberId, 'departure')]).toBeDefined(); }
  const st = moodStats(s, [...new Set(visits.map((a) => a.date))]); expect(st.lift).toBeGreaterThan(0.2); expect(st.lift).toBeLessThan(0.6);
});
it('Oma Lina arrives okay and leaves great today', () => { const s = buildSeed('2026-10-21', 16 * 60).citra; expect(dayArc(s, 'm1', '2026-10-21')).toMatchObject({ arrival: 3, departure: 5 }); });
```

- [ ] **Step 2: Run to fail. Step 3: Implement. Step 4: Run `pnpm test packages/shared/src/seed` (all seed tests still pass: the RNG streams must not shift; if `anchors.test.ts` changes, the marks drew from a shared stream — switch to `hash32`).**
- [ ] **Step 5: `pnpm db:reset`** then open the family app as `maria`: Today shows "Arrived in an okay mood" on the timeline.
- [ ] **Step 6: Commit** — `round 12: seed six months of mood marks`.

---

### Task 7: Nickname as the display name

**Files:**
- Modify: `packages/shared/src/rules/core.ts:36-38` — add `displayName`, `displayFull`
- Modify: `packages/shared/src/rules/members.ts:227` (`memberSearchBlob` includes `registration.nickname`)
- Modify: every web `memberShort(` call site to `displayName(` (list with `grep -rln "memberShort(" apps/web/src`; the heavy ones: `activity/Camera.tsx`, `lobby/Arrivals.tsx`, `family/Timeline.tsx`, `members/profile/HealthTab.tsx`, `health/LimitsSheet.tsx`, `family/StoryHero.tsx`, `family/FamilyBilling.tsx`); `members/MembersList.tsx:207-232` and the phone row show `displayName` at 17px and `displayFull` at 14px muted when they differ; `members/profile` hero and `health/HealthStation` header the same; `lobby/MemberDrawer.tsx` header
- Modify: `packages/shared/src/actions/helpers.ts` `shortOf(d, memberId)` → uses `displayName` (feed and notifications follow)
- Modify: `apps/web/src/features/members/dialogs/forms.tsx:188-191` (`RegPersonalFields`: nickname field moves to the first position with label `profile.f.called`), and the online form `enquiries/PublicForm.tsx` label
- Modify: `packages/shared/src/seed/roster.ts:241-255` (four rows get `registration: { nickname }` and long full names)
- Test: `packages/shared/src/rules/members.test.ts`, `packages/shared/src/rules/core` tests (add to `util.test.ts` or a new `core.test.ts`)

**Interfaces:**
```ts
export const displayName = (m: Pick<Member, 'title' | 'firstName' | 'registration'>) => string; // `${title} ${nickname}` or memberShort(m)
export const displayFull = (m: Pick<Member, 'title' | 'firstName' | 'lastName' | 'registration'>) => string | null; // memberName(m) when it differs from displayName, else null
```
Seed rows (roster index → names): pick four `ROWS` entries without a spouse or scripted story and set `[first, last] = ['Giok Nio', 'Oei']` nickname `Nio`; `['Soekartini', 'Wirjo']` nickname `Tini`; `['Tjoa Sioe', 'Lan']` nickname `Lan`; `['Raden Mas Soedjatmoko', 'Hadi']` nickname `Djat`.

- [ ] **Step 1: Failing tests**
```ts
it('displayName prefers the nickname', () => { const m = { title: 'Oma', firstName: 'Giok Nio', lastName: 'Oei', registration: { nickname: 'Nio' } } as Member; expect(displayName(m)).toBe('Oma Nio'); expect(displayFull(m)).toBe('Oma Giok Nio Oei'); expect(displayFull({ ...m, registration: undefined })).toBeNull(); });
it('search matches the nickname', () => { const s = buildSeed().citra; const nio = Object.values(s.members).find((m) => m.registration?.nickname === 'Nio')!; expect(matchesQuery(s, nio, 'nio')).toBe(true); });
```
- [ ] **Step 2: Run to fail. Step 3: Implement core + search + seed, then replace the web call sites.**
- [ ] **Step 4: `pnpm typecheck && pnpm test`** (the whole suite: `shortOf` feeds notification params, so assertions on "Oma Lina" still hold because her nickname is "Oma Lina" — if any test asserts the literal with a title doubled, fix the seed nickname to `Lina` and the test to the new text).
- [ ] **Step 5: Browser check**: Members list shows "Oma Nio" with the full name under it; Arrivals search "nio" finds her.
- [ ] **Step 6: Commit** — `round 12: nickname is the display name everywhere`.

---

### Task 8: Check on

**Files:**
- Create: `packages/shared/src/rules/checkOn.ts`, `checkOn.test.ts`
- Create: `packages/shared/src/actions/checkOn.ts`, `checkOn.test.ts`; register in `actions/index.ts`
- Modify: `packages/shared/src/rules/members.ts:149-212` (`MemberFilter` gains `'checkOn'`; `MemberRow.checkOn?: CheckOnRow`; `FILTERS.checkOn`)
- Modify: `packages/shared/src/rules/mgmt.ts` (`OverviewStats.checkOn: number`)
- Create: `apps/web/src/features/lobby/CheckOnSheet.tsx`
- Modify: `apps/web/src/features/lobby/AlsoToday.tsx` (a "Check on" `Block`, up to five rows, "All N" → `/members?f=checkOn`), `Arrivals.tsx` (mount the sheet), `members/MembersList.tsx` (reads `?f=` for the initial filter), `mgmt/Overview.tsx` (tile `checkOn`, `to: '/members?f=checkOn'`), `members/profile/CareTab.tsx` (call entries on their day, staff only; a "Log a call" button when the member is on the list), `members/MemberProfile.tsx` header action
- Modify: seed `packages/shared/src/seed/r7/index.ts` + create `seed/r7/checkOn.ts` (`seedCheckOn(s, T)`: two roster members' last visits moved to T−20 and T−22 by deleting their later attendance rows; one `careCalls` row a week ago, outcome `travelling`, `checkAgainOn = T + 5`)
- i18n: `checkOn.*` keys in a new namespace (`title`, `days` "{n} days", `call`, `outcome.fine|unwell|hospital|travelling|wantsPause|noAnswer|other`, `again`, `saved`, `all`, `notif.unwell` "{name}: family says {outcome}")

**Interfaces:**
```ts
// rules/checkOn.ts
export const CHECK_ON_MIN = 10, CHECK_ON_MAX = 14, CHECK_ON_WINDOW = 90, CHECK_ON_MIN_VISITS = 3, CHECK_ON_NEW_DAYS = 14;
export function usualGapDays(s: ClubState, memberId: string, today: ISODate): number | null;   // median gap of check-ins in (today-90, today]; null < 3 visits
export function checkOnThreshold(gap: number | null): number;                                 // clamp(2*gap, 10, 14); 14 when null
export interface CheckOnRow { member: Member; lastVisit: ISODate | null; daysSince: number; usualGapDays: number | null; threshold: number; lastCall?: CareCall }
export function checkOnList(s: ClubState, today: ISODate): CheckOnRow[];                     // per spec §3, sorted daysSince desc
export const CARE_CALL_OUTCOMES: CareCallOutcome[];
// actions/checkOn.ts
// member.logCall { memberId, contactName, phone, outcome, note?, checkAgainOn? } — hasRole(u,'lobby','nurse','mgmt'); writes careCalls[ctx.id('call')] with date=ctx.today;
// unwell|hospital → ctx.notify({ toRoles:['mgmt'], kind:'checkOn.notif.unwell', severity:'attention', link:`/members/${id}` }) and a staff-only MemberNote; ctx.feed('checkOn.feed.called').
```
`CheckOnSheet({ memberId, onClose }: { memberId: string | null; onClose: () => void })`: `Sheet` with the primary contact (`renewalContact(s, memberId)` gives contact + relation), a `tel:` `CallLink`, outcome `ChipGroup`, note `TextField`, `DateField` "Check again on", Save → `act('member.logCall', …, { ok: t('checkOn.saved') })`.

- [ ] **Step 1: Failing rules tests**
```ts
const quiet = (s: ClubState, id: string, days: number) => produce(s, (d) => { for (const k of Object.keys(d.attendance)) if (d.attendance[k].memberId === id && daysBetween(d.attendance[k].date, T) < days) delete d.attendance[k]; });
it('threshold clamps', () => { expect(checkOnThreshold(null)).toBe(14); expect(checkOnThreshold(2)).toBe(10); expect(checkOnThreshold(6)).toBe(12); expect(checkOnThreshold(20)).toBe(14); });
it('usual gap is null with fewer than three visits, never NaN', () => { const s = produce(seed, (d) => { for (const k of Object.keys(d.attendance)) if (d.attendance[k].memberId === 'm2') delete d.attendance[k]; }); expect(usualGapDays(s, 'm2', T)).toBeNull(); expect(checkOnList(quiet(s, 'm2', 1), T).find((r) => r.member.id === 'm2')?.threshold).toBe(14); });
it('lists a daily member after 10 quiet days, not after 5', () => { expect(checkOnList(quiet(seed, 'm1', 5), T).some((r) => r.member.id === 'm1')).toBe(false); expect(checkOnList(quiet(seed, 'm1', 11), T).find((r) => r.member.id === 'm1')).toMatchObject({ daysSince: 11, threshold: 10 }); });
it('a call with checkAgainOn later than today hides the member; a call older than the threshold does not', () => { /* add careCalls rows; assert presence */ });
it('members on leave, on hold, or joined < 14 days ago are not listed', () => { /* use seed members with leave / unpaid (m20 has an overdue invoice) */ });
```
- [ ] **Step 2: Failing action test**: `member.logCall` by `s1` stores the row with `date: T`; outcome `hospital` creates one `mgmt` notification with `severity: 'attention'`; a family user is forbidden (`err.forbidden`); `outcome: 'nope'` is `err.invalid`.
- [ ] **Step 3: Run to fail. Step 4: Implement rules, action, filter, overview field, seed.**
- [ ] **Step 5: Run `pnpm test packages/shared` and typecheck.** PASS.
- [ ] **Step 6: Build the sheet, rail block, filter chip, tiles, Care log entries.** Browser check as `caca`: rail shows "Check on (2)", open one, log a call, the row leaves the list.
- [ ] **Step 7: Commit** — `round 12: check on members not seen for a while, welfare calls`.

---

### Task 9: Venue bookings for the front desk

**Files:**
- Modify: `packages/shared/src/actions/club.ts:14, 201-350` (`const lobbyOrMgmt = (u) => hasRole(u, 'lobby', 'mgmt')`; `venue.book/update/cancel/askReview/recordReview` use it; `venue.createInvoice` keeps `mgmtOnly` widened to `hasRole(u,'mgmt','finance')`); `venue.book` run: when `ctx.role === 'lobby'` → `ctx.notify({ toRoles: ['mgmt'], kind: 'mgmt.notif.venueBookedBy', params: { who, org, date }, link: '/venue' })`
- Modify: `apps/web/src/app/nav.ts:10` (`NAVS.lobby` gains `n('venue', 'venue', 'storefront')` after `renewals`)
- Modify: `apps/web/src/features/mgmt/Venue.tsx:73-95` (`row(v)`: the `invoice` act only when `role === 'mgmt' || role === 'finance'`, via `useMe()`)
- Test: `packages/shared/src/actions/club.test.ts`

- [ ] **Step 1: Failing tests**: `run(seed(), 'venue.book', booking, 's1')` succeeds and creates one `mgmt` notification `mgmt.notif.venueBookedBy`; `fails(…, 'venue.createInvoice', { venueId: 'v1' }, 's1', 'err.forbidden')`; the same by `s10` (finance) succeeds.
- [ ] **Step 2: Run to fail. Step 3: Implement. Step 4: `pnpm test packages/shared/src/actions/club.test.ts` + typecheck.** Also grep `apps/web/src e2e` for `allowedKeys|NAVS` tests and update any snapshot of the lobby nav.
- [ ] **Step 5: Browser check** as `caca`: More → Venue, book a room; `ega` sees the notification.
- [ ] **Step 6: Commit** — `round 12: front desk books the venue`.

---

### Task 10: Celebrations

**Files:**
- Create: `packages/shared/src/rules/celebrations.ts`, `celebrations.test.ts`; `packages/shared/src/actions/celebrations.ts`, `celebrations.test.ts` (register)
- Modify: `packages/shared/src/rules/mgmt.ts:25` (`venueClash` also returns a clash against confirmed celebrations: widen the return type to `{ kind: 'venue' | 'celebration'; id: string; title: string } | undefined` and update `checkVenueSlot` params `{ org }` → `{ title }`)
- Modify: `packages/shared/src/rules/calendar.ts:11-12, 53, 56-106` (`CalKind` + `'celebration'`; `DayItem.celebrationId?`; `dayInfo` pushes confirmed ones for both audiences and requested ones for staff with `note: 'requested'`), `rules/famCalendar.ts:97-131` (row kind `'celebration'` for `who`'s members), `rules/kitchenOps.ts:39` (`coversOn` returns `{ total, members, guests, celebration }`, total includes confirmed celebration guests)
- Modify: `apps/web/src/features/mgmt/Venue.tsx` (a `SegTabs` Venue · Celebrations under `PageHead`; the Celebrations body in a new file), `apps/web/src/features/calendar/lib.tsx:8, 43` (`KIND.celebration` icon `cake`, `itemText`), `calendar/PhoneMonth.tsx:11` (`DOT_ORDER`), `kitchen/KitchenMenu.tsx:62, 96` (a line per celebration: time · title · guests · catering note), `family/FamilyToday.tsx` (a `FillCard` "Celebration" on the day, after `LastVisitCard`), `family/*Calendar*` row render for the new kind
- Create: `apps/web/src/features/mgmt/Celebrations.tsx`
- Seed: `packages/shared/src/seed/r7/celebrations.ts` `seedCelebrations(s, T)` (one confirmed for `m46` on Budi's birthday from Task 14 — until then, `T + 3 open days` — Garden Room 15:00–17:00, 12 guests, "Chocolate cake, no nuts"; one `requested` for a roster member at `T + 9`)
- i18n namespace `celeb.*`

**Interfaces:**
```ts
// rules/celebrations.ts
export function celebrationsOn(s: ClubState, date: ISODate, statuses: CelebrationStatus[] = ['confirmed']): Celebration[];
export function celebrationLists(s: ClubState, today: ISODate, now: HM): { requested: Celebration[]; upcoming: Celebration[]; past: Celebration[] };
export function checkCelebrationSlot(s: ClubState, slot: { roomId; date; from; to }, today, now, ignoreId?): SlotCheck; // = checkVenueSlot (room, past, times, hours, closed, clash)
export const celebrationTitle = (kind: CelebrationKind, name: string, years?: number, lang: Lang) => string; // "Opa Budi's 80th" / "Ulang tahun ke-80 Opa Budi"
// actions/celebrations.ts (hasRole lobby|mgmt unless stated)
// celebration.request { memberId, kind, title, date, from, to, roomId, guests (0-200), cateringNote? } → status 'requested' (mgmt: 'confirmed', decidedBy/At set); notify mgmt 'celeb.notif.requested' when by lobby
// celebration.update { celebrationId, ...same fields optional } → re-runs the slot check; a confirmed one edited by lobby goes back to 'requested'
// celebration.cancel { celebrationId }
// celebration.decide { celebrationId, status: 'confirmed' | 'declined', reason? } — mgmt only; notify lobby 'celeb.notif.decided'; confirmed → notify the member's family 'celeb.notif.family' link '/calendar'
```
`Celebrations()` screen: `ListCard` Requested (mgmt sees Confirm / Decline `PillBtn`s; lobby sees a "Waiting" `BadgePill`), Upcoming, Past; "New" opens an inline form like `VenueForm` with a member picker (`MemberPicker` from `features/activity`), kind `ChipGroup`, title prefilled by `celebrationTitle`, `DateField`, `SLOTS` chips + `TimeField`s, room `Select`, guests, catering note.

- [ ] **Step 1: Failing rules tests**: `checkCelebrationSlot` refuses a slot overlapping seeded venue booking `v1` (`code: 'venueClash'`) and a closed Sunday (`venueClosed`); `celebrationsOn` returns only confirmed by default; `celebrationTitle('birthday', 'Opa Budi', 80, 'en') === "Opa Budi's 80th birthday"`.
- [ ] **Step 2: Failing action tests**: lobby request → `requested` + one mgmt notification; mgmt request → `confirmed`; `celebration.decide` by lobby → `err.forbidden`; decide confirmed → family notification to `m46`'s family users; a request clashing with `v1` → `venueClash` and `Object.keys(s.celebrations)` unchanged; `coversOn(s, date).celebration === guests` once confirmed and `0` while requested; `dayInfo(s, date, 'family').items` has the celebration only when confirmed.
- [ ] **Step 3: Run to fail. Step 4: Implement rules, actions, calendar/kitchen/family rules, seed.** `pnpm test packages/shared` PASS.
- [ ] **Step 5: Build the screens** (Venue segment, calendar chip, kitchen line, family card). Browser check as `caca` (request), `ega` (confirm), `agus` (covers and the cake line), `maria` (Today card on the day; Calendar chip).
- [ ] **Step 6: Commit** — `round 12: celebrations booked at the front desk, confirmed by management`.

---

### Task 11: One stepped registration flow

**Files:**
- Create: `apps/web/src/features/members/register/RegistrationFlow.tsx` (shell), `steps.ts` (step list and per-step validation), `draft.ts` (device draft), `PersonStep.tsx`, `FamilyStep.tsx`, `HealthStep.tsx`, `PlanStep.tsx`, `PaperStep.tsx`, `ReviewStep.tsx`, `submit.ts`, `RegistrationFlow.test.tsx`, `draft.test.ts`
- Modify: `apps/web/src/features/members/dialogs/AddMemberDialog.tsx` (body → `<RegistrationFlow mode={{ kind: 'new' }} onDone />`), `apps/web/src/features/enquiries/dialogs.tsx:297-382` (`JoinDialog` body → `<RegistrationFlow mode={{ kind: 'lead', id }} />`)
- Modify: `apps/server/src/app.ts:108` (`GET /api/demo/accounts` adds `demoLogin: process.env.CP_DEMO_LOGIN !== '0'`), `apps/web/src/shell/demoAccounts.ts` (expose `useDemoLogin(): boolean`)
- Modify: `packages/shared/src/rules/members.ts` — add `findDuplicates(s, { phone?, nik? }): { members: Member[]; leads: Enquiry[] }`
- i18n `reg.*`: step names (`person, family, health, plan, paper, review`), `next, back, discard, resume` ("Continue where you left off?"), `sample` ("Use sample form"), `fromLead` ("From a lead"), `duplicate` ("{name} already has this {what}")

**Interfaces:**
```ts
export type RegMode = { kind: 'new' } | { kind: 'lead'; id: string };
export type RegStep = 'person' | 'family' | 'health' | 'plan' | 'paper' | 'review';
export const REG_STEPS: RegStep[];
export interface RegState { title: Title; name: string; nickname: string; gender: 'f' | 'm'; dob: string; address: string; usual: string; photo: PaperFile | null; nik: string; ids: RegId[]; contactMode: 'new' | 'existing'; existingId: string; contact: string; rel: Relation | ''; phone: string; primary: boolean; guarantorNik: string; health: HealthDraft & AllergyDraft; dementia: YN; dementiaNote: string; carer: CarerDraft; meds: MedRow[]; care: string; plan: Plan | ''; start: string; form: PaperFile | null; ktp: KtpUploads; consentData: boolean; consentFace: boolean; note: string; reg: RegDraft }
export function RegistrationFlow({ mode, onDone }: { mode: RegMode; onDone: (memberId?: string) => void }): JSX.Element;
export function stepIssues(step: RegStep, st: RegState, mode: RegMode, today: ISODate): FieldIssue[];   // steps.ts; reuses validateNewMember / validateRegistration per field group
export const draftKey = (mode: RegMode) => `cp.reg.${mode.kind === 'lead' ? mode.id : 'new'}`;         // draft.ts
export function loadDraft(mode: RegMode): RegState | null; export function saveDraft(mode: RegMode, st: RegState): void; export function clearDraft(mode: RegMode): void; // try/catch around localStorage
export function toCreateInput(st: RegState): NewMemberFull; export function toConvertInput(st: RegState, lead: Enquiry, plan: Plan, start: ISODate): ConvertIn; // submit.ts
export function initialState(s: ClubState, mode: RegMode): RegState;                                   // pre-fill from lead + online draft (same mapping JoinDialog does today) or from a chosen lead in 'new' mode
```
Layout: phone = `PhoneScreen` with a 4px progress bar under the label (filled `#24201C`, `width = (i+1)/6`), footer Back / Next (Next disabled while `stepIssues` has entries; errors show after the first Next); tablet/laptop = `Dialog maxWidth={760}` with a left rail of the six steps (done = check, current = ink). Review step: one `Group` per step with an Edit link. Submit button label = `joinLabel(t, role, plan)` for leads, `members.create` text otherwise. Draft: `saveDraft` on each change (debounced 300 ms); on open, if a draft exists, a `Note` with Resume / Discard. Person step shows the duplicate warning `Note tone="ochre"` with a link when `findDuplicates` hits. Paper step: `PaperFormField`; below it, when `useDemoLogin()` is true, a `PillBtn` "Use sample form" that runs `const blob = await (await fetch('/forms/application-1.jpg')).blob(); onChange(await uploadDocument(blob, 'registration-form.jpg'))`. In `'new'` mode the Person step starts with a `SearchBar` "From a lead" listing open leads by name or phone; picking one re-initialises state from the lead and switches `mode` to `{ kind: 'lead', id }` (the Join path).

- [ ] **Step 1: Failing draft test** (`draft.test.ts`): save for `{kind:'lead', id:'e1'}`, then `loadDraft({kind:'lead', id:'e2'})` is `null` and `loadDraft({kind:'new'})` is `null`; `clearDraft` removes; a throwing `localStorage` (stub) does not throw out of `saveDraft`.
- [ ] **Step 2: Failing flow test** (`RegistrationFlow.test.tsx`): mount in `'new'` mode; Next is disabled; fill name, dob, gender; Next enabled; reach Plan; pick Flex; progress bar width is `calc(4/6*100%)` (or `data-step="plan"`); Paper step without a form keeps Next disabled; with a stubbed `uploadDocument`, the "Use sample form" button (render with `useDemoLogin` mocked true) sets the form and enables Next; Review shows six groups; Submit calls `act('members.create', …)` once with `formMediaId` set.
- [ ] **Step 3: Failing lead test**: mount `{kind:'lead', id:'e3'}` (seed lead with a submitted online draft): Person step is pre-filled with the draft name; Family step shows the lead contact read-only; Submit calls `enquiry.convert` with `enquiryId: 'e3'`.
- [ ] **Step 4: Run to fail. Step 5: Implement `draft.ts`, `steps.ts`, `submit.ts`, the six steps, the shell; swap the two dialog bodies; add the server flag and hook.**
- [ ] **Step 6: Run the three tests + the existing `ApplicationForm.test.tsx`, `Enquiries.test.tsx`; typecheck.** PASS.
- [ ] **Step 7: Friction walk** on the phone viewport as `caca`: Enquiries → a lead → Join, and Members → Add member. Fix the top items found and list them under a "Friction fixed" heading at the end of this task in the plan file (candidates: plan preselected from the lead's `plan`; start date defaults to the next Monday; phone keypad for numbers; carer toggle hidden until asked).
- [ ] **Step 8: Commit** — `round 12: one stepped registration flow for Join and Add member, device draft, sample form in demo`.

---

### Task 12: Month report

**Files:**
- Create: `packages/shared/src/rules/monthReport.ts`, `monthReport.test.ts`
- Create: `apps/web/src/features/report/MonthReport.tsx`, `OwnerSummary.tsx`, `MonthReport.test.tsx`; export `MonthReport` from `features/report/index.tsx`
- Modify: `apps/web/src/app/nav.ts:22, 62-77` (`n('monthReport', 'monthReport', 'query_stats')` after `report` in the first `NAVG.mgmt` group; `ScreenId`; `screenFor` map), `apps/web/src/app/screens.tsx` (`monthReport: L(report, 'MonthReport')`), `i18n/*/core.ts` `nav.monthReport`, `nav.s_monthReport`
- i18n namespace `month.*` (group titles, every row label, `vsPrev` "vs {period}", `sendOwner`, `copy`, `copied`, `sent`)

**Interfaces:**
```ts
export interface Delta<T = number> { cur: T; prev: T; diff: T | null; good: 'up' | 'down' | 'none' }   // good: whether up is good
export interface MoneyGroup { billed: Delta; collected: Delta; outstanding: Delta; extraDays: Delta & { amount: Delta }; venueIncome: Delta; refunds: Delta }
export interface MembersGroup { active: Delta; joined: Delta; ended: Delta & { byReason: Record<EndReason, number> }; renewalsKept: Delta; renewalsLost: Delta; onLeave: Delta; checkOn: number; visitsPerMember: Delta<number | null>; utilisation: Delta<number | null> }
export interface CareGroup { index: Delta<number | null>; lift: Delta<number | null>; byMoment: Record<MoodMoment, number | null>; alerts: Delta; watches: Delta; rechecks: Delta; lunchEaten: Delta<number | null> }
export interface PipelineGroup { funnel: { new: number; visit: number; trial: number; joined: number }; conversion: { toVisit: number | null; toTrial: number | null; toJoined: number | null }; lostReasons: Record<LostReason, number>; duties: { role: StaffRole; done: number; total: number }[]; surveys: { family: number | null; venue: number | null } }
export interface MonthReport { period: InsightPeriod; prev: InsightPeriod; money: MoneyGroup; members: MembersGroup; care: CareGroup; pipeline: PipelineGroup; empty: boolean }
export function prevPeriod(p: InsightPeriod): InsightPeriod;                       // same length, ending the day before p.from
export function monthReport(s: ClubState, period: InsightPeriod, today: ISODate, nowMin: number): MonthReport;
export function ownerSummaryLines(r: MonthReport, t: TFn, fmt: { rp: (n: number) => string; pct: (n: number | null) => string }): string[];  // web, OwnerSummary.tsx
```
Sources (from the explorer map): money from `invoiceViews(s, today, true)` filtered by `invoicePeriod(inv)` in the period (billed = `total`, collected = payments with `ym(receivedOn)` in period, outstanding = sum of `balance` of invoices issued up to `period.to`), extra days = lines `kind === 'extraDay'` (`qty`, `amount`), venue income = `venueBookings` with `invoiceRef` and `date` in period summing `price`, refunds from `s.refunds` by `ym(createdAt)`. Members: `activeOn(m, period.to)`; joined = `currentMembership(m).start` in period; ended = `lastDay` in period; renewals from `renewalRows(s, month)` for the period's months (kept = outcome in `continue|upgrade|downgrade|leave` and status `done|pending`, lost = `stop`); on leave = `onLeaveOn(m, period.to)`; `checkOn = checkOnList(s, today).length`; visits from `observedDays` + attendance; utilisation = visits ÷ (openDays × active). Care: `moodStats(s, days)`; alerts/watches = readings `status` counts; rechecks = `kind === 'recheck'`; lunchEaten = logs with `lunch in all|most` ÷ logs with `lunch`. Pipeline: enquiries by `createdAt` in period for `new`; visits/trials from `guestVisits` dates; joined from members whose lead `memberId` matches with `start` in period; lost = `stage === 'lost'` with `createdAt` in period (no lost timestamp exists, state this in the row's caption "leads opened this period"); duties from `teamRange(s, from, to, today, nowMin)`; surveys = average `overall` of `SurveyResponse.on` in period per kind.

Screen: the `DailyReport` shell (`PageHead`, period `Select` over `PERIOD_KEYS` + custom `DateField`s), then four `Group`s of rows: label left, `cur` right in 17px, under it a 13px delta (`+3` sage / `−2` rust, colour by `good`), tappable rows navigate (`/billing`, `/members`, `/insights?tab=mood`, `/enquiries`, `/tasks`, `/surveys`). Empty period → `EmptyState`. A `Pin` "Send to owner" opens `OwnerSummary` (`Dialog`): the Broadcast bubble style (copy the box from `Broadcast.tsx:146-155` into a small `WaBubble` in `mgmt/common.tsx` and reuse it there), Copy (`navigator.clipboard.writeText`, toast `month.copied`), "Send on WhatsApp" (toast `month.sent`, simulated).

- [ ] **Step 1: Failing rules tests**
```ts
it('prevPeriod is the same length ending the day before', () => expect(prevPeriod({ from: '2026-10-01', to: '2026-10-21' })).toEqual({ from: '2026-09-10', to: '2026-09-30' }));
it('an empty period has zeros and nulls, no NaN', () => { const r = monthReport(buildSeed().citra, { from: '2020-01-01', to: '2020-01-31' }, T, 600); expect(r.empty).toBe(true); expect(r.members.visitsPerMember.cur).toBeNull(); expect(r.members.utilisation.cur).toBeNull(); expect(r.care.index.cur).toBeNull(); expect(r.money.billed.cur).toBe(0); expect(JSON.stringify(r)).not.toContain('NaN'); });
it('September money matches the seed invoices', () => { const r = monthReport(s, periodFor('lastMonth', T), T, 600); const sept = invoiceViews(s, T, true).filter((v) => invoicePeriod(v.inv) === '2026-09'); expect(r.money.billed.cur).toBe(sept.reduce((a, v) => a + v.total, 0)); expect(r.money.extraDays.cur).toBe(sept.flatMap((v) => v.inv.lines).filter((l) => l.kind === 'extraDay').reduce((a, l) => a + l.qty, 0)); });
it('this month counts Lina as active and the check-on list', () => { const r = monthReport(s, periodFor('thisMonth', T), T, 600); expect(r.members.active.cur).toBe(Object.values(s.members).filter((m) => activeOn(m, T)).length); expect(r.members.checkOn).toBe(checkOnList(s, T).length); expect(r.care.lift.cur).toBeGreaterThan(0); });
```
- [ ] **Step 2: Failing screen test**: mount `MonthReport` as `ega`; four groups render; the Money group has a row `month.billed`; Send to owner opens a dialog whose text contains the billed amount.
- [ ] **Step 3: Run to fail. Step 4: Implement rules, nav, screen, summary.** Step 5: tests + typecheck PASS.
- [ ] **Step 6: Browser check** on phone and laptop as `ega`; screenshot both.
- [ ] **Step 7: Commit** — `round 12: month report for management with send-to-owner summary`.

---

### Task 13: Mood insights tab

**Files:**
- Modify: `packages/shared/src/rules/mood.ts` — add `moodInsights`
- Modify: `apps/web/src/features/insights/index.tsx:20-24, 73-93` (`Tab` + `'mood'`, `TAB_KEY.mood = 'insights.tabMood'`, reads `?tab=` for the initial tab), create `apps/web/src/features/insights/Mood.tsx`
- Test: `packages/shared/src/rules/mood.test.ts`

**Interfaces:**
```ts
export interface MoodInsights { byActivity: { activityId: string; avg: number; n: number }[]; byWeekday: (number | null)[]; byMoment: Record<MoodMoment, number | null>; lift: number | null; drops: { memberId: string; faces: Face[] }[] }
export function moodInsights(s: ClubState, period: InsightPeriod, today: ISODate): MoodInsights;
// byActivity joins activity marks to the schedule cell at (date, slot) via the same lookup dailyReport uses for sessions; sorted avg desc, n ≥ 3
// drops: members whose last three visits' arrival faces are strictly decreasing
```
`Mood` tab: summary line `t('insights.moodLift', { n })`, `Bars` of activities (label = activity name, value = avg, tip = `n`), weekday `Line`s, moment averages, "Dropping" `Group` with `displayName` rows linking to `/today?checkOn=<id>` (Arrivals opens the `CheckOnSheet` for that id).

- [ ] **Step 1: Failing test**: build a state with three visits for `m2` with arrival faces 4, 3, 2 → `drops` contains `m2` with `[4,3,2]`; faces 3, 3, 2 → not included; `byActivity` entries have `n >= 3`; `byWeekday` has 5 entries.
- [ ] **Step 2–5: fail, implement, pass, typecheck.** Browser check as `ega`: Insights → Mood.
- [ ] **Step 6: Commit** — `round 12: mood by activity insight`.

---

### Task 14: Birthdays and anniversaries

**Files:**
- Create: `packages/shared/src/rules/occasions.ts`, `occasions.test.ts`
- Modify: `packages/shared/src/seed/index.ts:132-160` (`CAST` m46 dob → computed: `1946-${mmdd(addOpenDays(T, 3))}`; keep the others), `seed/r7/celebrations.ts` (use the same date)
- Modify: `apps/web/src/features/lobby/AlsoToday.tsx` ("This week" block), `lobby/MemberRow.tsx` + `FaceCard.tsx` (cake icon on the day), `kitchen/KitchenMenu.tsx` (line "Birthday today: …"), `calendar/lib.tsx` + `rules/calendar.ts` (`CalKind 'birthday'`, `dayInfo` pushes one item per member with a birthday that day, staff audience; family audience only for `who` → handled in `famCalendar`), `family/FamilyToday.tsx` (card "{name} turns {n} on {day}" within the week), `members/profile` hero (age + "birthday {day}")
- Test: `packages/shared/src/rules/occasions.test.ts`, seed tests that pinned Budi's age (search `84` / `1942-02-03` and fix)

**Interfaces:**
```ts
export interface Occasion { member: Member; kind: 'birthday' | 'anniversary'; date: ISODate; years: number }
export function occasionsInRange(s: ClubState, from: ISODate, to: ISODate): Occasion[];   // birthdays from dob (year-agnostic, 29 Feb → 28 Feb in non-leap years); anniversaries from the first membership start, years ≥ 1; active members only; sorted by date
export const occasionsThisWeek = (s: ClubState, today: ISODate) => occasionsInRange(s, today, addDays(today, 7));
```
- [ ] **Step 1: Failing tests**: Budi appears in `occasionsThisWeek(seed, T)` with `years: 80` and `date` three open days from `T`; a member with `dob: null` never appears; `occasionsInRange` across a year boundary (`2026-12-28` → `2027-01-04`) includes a January birthday; an anniversary for a roster member whose `start` month-day falls in the week.
- [ ] **Step 2–5: fail, implement rules + seed, run `pnpm test packages/shared` (fix age assertions), build the five surfaces, typecheck.** Browser check as `caca` (rail block, cake icon on Friday via the demo clock), `maria` (card).
- [ ] **Step 6: Commit** — `round 12: birthdays and anniversaries this week`.

---

### Task 15: Undo after sending photos

**Files:**
- Modify: `packages/shared/src/actions/photoDrafts.ts:163-209` (`photo.sendDrafts` result adds `sentAt: ctx.nowDT`; new action `photo.unsend`), `packages/shared/src/actions/photos.ts:33` (`notifyNewPhotos` sets `ref: { type: 'photo', id }` on each notification if missing)
- Modify: `apps/web/src/features/activity/Drafts.tsx:225-234` (`say(text, { action: { label: t('common.undo'), run: () => act('photo.unsend', { ids: sentIds }) } })`)
- Test: `packages/shared/src/actions/photoDrafts.test.ts`

**Interfaces:** `photo.unsend { ids: string[] }` — `isStaff`; only photos the actor sent (`createdBy === ctx.actor` or mgmt) within 10 minutes of `sentAt` (store `sentAt` on the photo when sending); reverts `visibility` to `'draft'`, deletes `approved`, removes the photo from `dayMenu.photoIds` / `teaPhotoIds`, deletes notifications with `ref.type === 'photo' && ids.includes(ref.id)` and feed entries with `params.photoId` in ids; result `{ undone: number }`; fails `drafts.err.tooLate` after 10 minutes.

- [ ] **Step 1: Failing tests**: send two drafts as `s5`, unsend → both `draft`, no `pending` approval, zero family notifications referencing them; as `s9` (mgmt, visible) a lunch photo unsend leaves `dayMenu.photoIds` without it; unsend 11 minutes later → `drafts.err.tooLate`; unsend by another teacher → `err.forbidden`.
- [ ] **Step 2–4: fail, implement, pass.** Browser check: Camera → Drafts → Send → toast Undo returns them.
- [ ] **Step 5: Commit** — `round 12: undo after sending photo drafts`.

---

### Task 16: README script, e2e pass, final verification

**Files:**
- Modify: `README.md` demo script table (rows: Mood at the door · Check on · Front desk books the venue · Celebration · Opa Budi's birthday · A bad photo · Month report) and the "KC's additions" list
- Create: `e2e/round12.spec.ts`
- Modify: `docs/superpowers/plans/2026-10-21-round12-staff-owner.md` (tick boxes, "Friction fixed" list)

- [ ] **Step 1: Write `e2e/round12.spec.ts`** (phone project; `CP_SEED_SMALL=1` state): as `caca`: manual check-in of Opa Budi: confirm is disabled until a face is tapped, then succeeds; the Check on block is absent (the small seed has nobody quiet); book the venue; as `ega`: Month report renders four groups and Send to owner opens; as `maria`: Today timeline shows the arrival mood text. Keep it to one spec file, under ten assertions.
- [ ] **Step 2: Run** `pnpm typecheck && pnpm test` → all PASS (paste the summary line into the commit).
- [ ] **Step 3: Run** `scripts/e2e-all.sh 1 "phone" round12` → PASS. If the disk is still near full, run `pnpm test:e2e -g round12` against a single dev server instead and say so.
- [ ] **Step 4: Browser demo pass** on the phone viewport through the README rows; screenshots of mood at the door, Check on, Month report for KC.
- [ ] **Step 5: Commit** — `round 12: README demo script, e2e`.

---

## Self-review notes

- Spec coverage: §1 → Tasks 2–6; §2 → 7; §3 → 8; §4a → 9; §4b → 10; §5 → 11; §6 → 12; §7 → 14; §8 → 13; §9 → 15; §10 (nav/roles) spread over 3, 8, 9, 12; §11 → 6, 8, 10, 14, 16; §12 → every task's tests + 16.
- Type names used across tasks: `Face`, `MoodMoment`, `MoodMark`, `DayArc`, `moodId`, `dayArc`, `moodStats`, `displayName`, `CheckOnRow`, `checkOnList`, `Celebration`, `checkCelebrationSlot`, `coversOn().celebration`, `Occasion`, `MonthReport`, `RegMode`, `RegState` — defined once each in the task that owns the file.
- Ordering: Task 10's seed uses Budi's birthday date; until Task 14 lands it uses `addOpenDays(T, 3)` directly, which is the same date, so no rework.
