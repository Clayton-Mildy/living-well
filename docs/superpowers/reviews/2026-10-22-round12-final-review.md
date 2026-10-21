# Round 12 final review — 466579d..cee1438 (branch `round12`)

Reviewed in three passes over `review-466579d..cee1438.diff` (25,942 lines): (1) shared package — types, migration, actions, rules, seed, i18n, projection; (2) web — lobby, activity, health, report, mgmt, insights, kitchen, calendar, registration, family; (3) tests, e2e, README, plan deviations, and the per-task deferred list. Seed facts below were checked by evaluating the real seed with `tsx` (no tree mutation, no DB, no servers): `buildSeed('2026-10-21' | '2026-10-22', 10:00, { roster: true })`.

## Strengths

- Clean architecture: three collections through the one `COLLECTIONS` array, `emptyClub` and `loadAll` give every old persisted state the new (empty) collections, and migration 0005 matches the generic table shape (member_id/date/status/kind + indexes). Backward compatibility is sound; `live(s.moodMarks ?? {})` guards even a state that predates the field.
- Mood is modelled as idempotent stamps with a natural key (`moodId`), so re-marking, undo of check-in/check-out and `reading.void` all stay consistent without reconciliation code. The daily report, family timeline, hero, Overview and month report all read the same `dayArc`/`moodStats`.
- Roles are right everywhere I checked: `celebration.decide` mgmt-only, `venue.createInvoice` mgmt/finance (server and UI), `member.logCall` lobby/nurse/mgmt, `photo.unsend` sender-or-mgmt; care calls and the "Welfare call" member note are staff-only and never reach a family (projection `{}` + family SSE is a "changed" ping that refetches the projected snapshot, so there is no patch leak).
- `venueClash` widened to celebrations in both directions, with the `org`→`title` param kept in both EN and ID error strings; `coversOn` grew a `celebration` part and its one consumer (`kitchen/vals.ts`) was updated.
- `displayName`/`listName`/`displayFull` are applied consistently: no `memberShort(` call sites remain in `apps/web` or in rules/actions outside `core.ts`; `shortOf` makes every feed line and notification follow.
- i18n: every new namespace (`mood`, `checkOn`, `reg`, `celeb`, `occasions`, `month`) is registered in both indexes and `EN_NS`; the ID files are typed `Same<typeof EN>` so parity is compiler-enforced. No raw-key leak found; the Enquiries test asserts it for Indonesian.
- Tests are real behaviour, not mocks, in the shared package (actions run through `execute`, the seed is the fixture); the five Review Focus items each have a test (mood.test check-out without check-in; checkOn.test null gap/14; celebrations.test clash + closed day with nothing stored; draft.test lead A vs B vs new; monthReport.test empty period without NaN). The photo-unsend suite covers the midnight window and the tea photo round-trip.
- The registration flow is a genuine simplification: one state, one validator (`stepIssues` reuses `validateNewMember`/`validateRegistration`), both dialogs became one-liners, and the device draft is defensive against blocked storage.

## Issues

### Critical (Must Fix)

None found. No wrong data in a stored row, no broken flow, no role leak, no crash path.

### Important (Should Fix)

1. **`packages/shared/src/rules/monthReport.ts:69` — "Outstanding" is dominated by invoices not yet due and reads as a collections collapse.** On the demo day the Money group shows Outstanding **Rp 125.122.000, +Rp 118.472.000 in rust** vs September (Rp 6.650.000). Measured: Rp 118.472.000 of that is 35 October invoices issued on the 21st and due on the 28th; only Rp 6.650.000 (2 invoices) is past due. The prev-period snapshot (30 Sep) sits after September's due date, the current one (21/22 Oct) before October's, so the delta is structurally alarming until the 28th of every month. The owner will read "outstanding" as "unpaid when it should have been paid". Fix: compute `outstanding` from invoices whose `dueDate < p.to` (past due at period end), or split the row into "Not yet due" and "Overdue" (and keep `good: 'down'` only on the overdue part); add one line to `monthReport.test.ts` asserting the October figure excludes invoices due after `p.to`.
2. **`packages/shared/src/seed/r7/moodMarks.ts:28` — none of today's 16 seeded check-ins has an arrival mark.** The comment says "today's three early arrivals stay unmarked", but on the demo day `TODAY_IN` plus the cast put 16 members in the club by 10:00 and `moodStats(s, [today]).notMarkedAtDoor === 16`. Visible effects on the demo day: Daily report › Mood and notes shows "Not marked at the door: 16" with two "—" face rows, By member shows "· ·" for everyone, Overview "Mood today" is "–". For the owner, whose named priority is mood, this reads as the lobby ignoring the "required at the door" rule for the whole morning. The ruling to leave **Oma Lina** unmarked (her check-in and face are live) stands; the other 15 should carry arrival marks (and departure marks for the three in `TODAY_OUT`). Fix: in `seedMoodMarks`, skip `a.date > T` and `a.date === T && a.memberId === 'm1'` instead of `a.date >= T`; today's `departure` only when `a.checkOut`. Two tests pin today's count and will need updating: `rules/dailyReport.test.ts:194` (`notMarkedDoor` = members.length on the small seed) and `rules/mood.test.ts:35`.
3. **`packages/shared/src/seed/index.ts:133,273` — Mbak Sari (Oma Lina's carer) has no NIK, so editing Oma Lina's details on the phone stops with "Add the carer's NIK (16 digits)".** Known app-side item, confirmed in the seed (`m1.nanny = { name: 'Mbak Sari' }`). Oma Lina is the demo's first member; the client will hit this. Fix: give the cast carer a NIK in the seed (`nanny: { name: 'Mbak Sari', nik: '3175…' }`; `CastRow.nanny` is a string today, so a small shape change or a `NANNY_NIK` map). The e2e helper `carerNik()` in `e2e/members.spec.ts:36` fills the NIK only when the field is empty, so seeding one does not break those tests; `members.spec.ts:1296-1297` only asserts the carer name.
4. **`apps/web/src/features/calendar/lib.tsx:13-14` — the celebration and birthday chips use a pastel tint (`#F6E7DD`).** KC rolled back round 8e's soft colours as not premium (memory: no pastel tints, stay grey/white/ink). Budi's birthday and his party are the calendar's demo moment, so this is the first thing the owner sees in the new colour. Fix: `bg: 'var(--fill, #F4F4F5)'` with an ink/accent `fg` (and `neutralFill` picks up the grey automatically), keep the dot colours.
5. **`apps/web/src/features/members/register/ReviewStep.tsx:22` — the Review step shows the date of birth without a year ("Mon 14 Oct").** `fds` is the short day format. A birth date without a year is meaningless on a registration review, and the registration is a demo row. Fix: format with `fmt.fd(st.dob, { day: 'numeric', month: 'short', year: 'numeric' })` (or `fdl`).

### Minor (Nice to Have)

6. `apps/web/src/components/ui/MoodFaces.tsx:10` — spec §1 asks for labels under the faces on tablet and laptop; `labels` is never passed anywhere, so wide screens show glyphs only (aria-label and title only). Pass `labels={!isPhone}` at the door and on the health form.
7. `apps/web/src/features/family/ParentSwitch.tsx:39` — spec §2 says the family switcher uses `displayName`; it still uses `memberName` for the aria-label. Harmless for the five demo parents (nickname = title + first name).
8. `packages/shared/src/actions/mood.ts:38` — `mood.mark` with `moment: 'arrival'` is accepted without a check-in; the spec exempted arrival only because the check-in writes it. Nothing in the UI calls it this way (the "Mood?" pill was dropped per deviation 2), so it is dead permissiveness; tighten to require a check-in for every moment.
9. `packages/shared/src/seed/r7/checkOn.ts:13` — `goQuiet` keeps `monthly` readings after the last visit, so m90 has a monthly reading on 1 Oct, a day he was not in (the Care log shows a health reading on a day with "Away"). Delete monthly readings after `lastDay` too, or accept as a spot check.
10. `apps/web/src/features/kitchen/KitchenMenu.tsx:80-81,116-117` — `{celebLines}` / `{birthdayLine}` sit at column 0 inside deeply nested JSX; formatting only.
11. `README.md:75` — "the toast has **Undo** for 10 minutes": the toast lasts 7 s (`store/ui.ts:17`); the 10 minutes is the action window. Say "the toast has Undo; the send can be taken back for 10 minutes".
12. `apps/web/src/features/activity/DailyLog.tsx:108` — clearing a session chip sends `log.mark` then `mood.clear` as two mutations (not atomic, untested). Fold into `log.mark` when `session.value === null`.
13. `apps/web/src/features/lobby/Arrivals.tsx:54` — `/today?checkOn=<id>` opens the call sheet for any member, listed or not (the Dropping list links members who may not be on the check-on list). Acceptable (a welfare call is always allowed), but the sheet's "Last seen · N days" line is then absent; consider a `lastVisit` line from `lastVisits()` instead of `checkOnList`.
14. Month report rows navigate to `/billing`, `/members`, `/insights` etc. without the period filter the spec asks for ("filtered to the period where one exists"); only Insights carries `?tab=`. Low value for the demo.
15. `packages/shared/src/actions/photoDrafts.ts` — `photo.unsend` lets management take back anyone's photos; spec §9 said "own photos only" for all three roles. The plan chose "or mgmt"; fine, but note it in the plan deviations.

## Deferred-minor triage

Must fix before merge (why):
- **Task 14: birthday + celebration chips use pastel bg `#F6E7DD`** — KC's standing no-pastel rule, on the calendar surface the demo opens for Budi's birthday (Important #4).
- **Task 11 (cosmetic note A1b): Review step DOB shows no year** — a registration review that drops the birth year misreads to anyone (Important #5).
- **Task 16 app-side: Mbak Sari has no NIK so editing Oma Lina demands one** — the client will hit it on the first member (Important #3).

Can wait (grouped):
- Mood rules/actions: `applyMarks` onlyEmpty (already restricted in the final code), `dayArc` activity order (already sorted by slot), orphaned health/activity marks after undoCheckIn or unmarking, two readings a day sharing one health mark, thin rules tests (zero-marks null case, writeMark createdAt, family refused, past-date log).
- Door UI: MoodFaces aria `label` prop (done), per-row `dayArc` in MemberRow (compute only when checked in), radiogroup roving tabIndex, face reset untested, MemberRow face icon accessible name, caption+faces wrapper duplicated in FaceCard/CheckoutDialog.
- Activity round: `stacked={isPhone}` for every round, non-atomic clear (Minor #12), arc tests by text, MoodArc per-face values hidden by `role=img`, health face unit test, arc labels without times.
- Report/family: two-parent hero rows without the arrival face; two "—" rows on a no-face day (moot once Important #2 lands).
- Seed: state size 6.94 MB of the 7.5 MB cap (~7% headroom — the next seed addition trips it; raise the cap or trim arrival photos); no test for the 70%/60% activity-mark rules; first history test checks 50 visits only.
- Nickname: accent folding in `memberSearchBlob`, family EditSheet label "Nickname (Panggilan)", `NICK` keyed by first name, 13 px full-name line, `listName` unit test, hero full name for non-nickname parents.
- Check on: outcome translation copy-pasted ×3 in Notifications.tsx, English-only staff note text, `?checkOn` not cleared on close, "All N" link only when N>5, no leaves-the-list UI test, `memberRows` recomputes suspensions.
- Venue/celebrations: busy guard (done via `useBusy`), lobby "View answers" link (done, gated to mgmt), UI invoice gate duplicates the server rule, `famMonth` does not mark celebration days, title refills the suggestion when cleared, missing tests (lobby cancel → mgmt notify, decide on cancelled, update with unchanged slot).
- Mood tab: drops only inside the chosen period, rounding before sort, EmptyState sub, 5th tab orphaned on phone, aria-label on a div, unused `moodByActivityAria`, no zero/negative-lift wording test.
- Photo undo: multi-photo family notification carries the first ref only (the toast always unsends the whole batch, so no partial case today), lunch announcement dedupe vs partial unsend, hard deletes of notifications/feed, midnight test (now present).
- Month report: `includeVoid=true` in one test, screen test derives expected billed from `monthReport` itself, `month.nDays` unused, `empty` ignores venue/refund/survey-only periods, owner summary omits the "Oct vs Sep" basis, no Jan→Dec / Last 6 window test, Copy/Send footer not centred.
- Registration: `pickLead` clears an untouched new draft, no "From a lead" switch test, Review IDs row under Form, `matchLeads` duplicates `leadMatches`, resumed lead draft shows a stale contact, submit busy guard reads state, unused `enq.jn_fromEnquiry`, consent switch without an earlier hint, laptop dialog title/close scroll away.
- Occasions: today's-occasion lookup duplicated in MemberList/FaceCard, 1946/"80" hard-coded in the seed, birthday-before-anniversary sort unpinned, untested kitchen/family card/profile hint/MatchedPanel cake, "Nothing else today" above This week.

## Declined to judge

- `listName` leading list rows with the full registered name when there is no nickname ("Opa Hartono Salim" instead of "Opa Hartono") — a controller ruling refining spec §2; KC may still prefer short names (one-helper swap).
- Celebrations allowed inside club hours (`checkCelebrationSlot` skips the club-hours rule) — ruled; the spec's own seed (15:00–17:00 on an open day) needs it.
- Face optional at the action level for `attendance.checkIn`/`checkOut` (plan deviation 1) — justified by the test/e2e base; the UI enforces it, and the API path is staff-only.
- No "Mood?" pill for door-camera check-ins (deviation 2) — there is no auto check-in path to patch.
- Guided demo steps off; README rows and `e2e/round12.spec.ts` stand in (deviation 3) — a demo-tooling choice, outside the app.
- Opa Budi's birth year moved to 1946 so he "turns 80" (deviation 4) — seed storytelling.
- The hidden management Overview (tiles Mood today, Check on) — KC hid it in round 2; built to the spec, carries no demo value.
- Only m90 on the demo Check-on list because m57's call hides her (`checkAgainOn`) — by design per ruling; her call shows on the Care log.
- Month-report invoice rows comparing whole billing months ("Oct vs Sep") while date-shaped rows compare the same-length window — ruled; captioned on the rows.
- Management cancelling a confirmed celebration notifying the family — ruled (spec silent).
- `log.mark` writing activity faces only for today's log date — ruled; mood is captured live.
- `reading.save` with a face writing a health mark without a check-in — ruled; the reading proves presence.
- Activity-round faces at 32 px on phones (below the 44 px line) — ruled for density.
- Toast Undo lasting 7 s rather than the spec's 8 s — the shared toast kit's action duration.
- `photo.unsend` allowed to management for others' photos (Minor #15) — plan interface chose it; noted, not judged.
- Mood tab default period and the "Dropping" list limited to the period — spec silent; deferred minor.
- The two commits by "Claude Opus 5.5" keeping their co-author trailer — ruled.
- Browser-pane cosmetic notes from the verification (dialog title scrolls away on laptop, Copy/Send footer alignment, Mood tab alone in its row) — polish; not merge blockers.

## Recommendations

1. Land the five Important fixes as one short "round 12 final fixes" commit before merging: outstanding = past due at period end (or split not-yet-due), today's seeded arrival marks (all but Lina), the carer NIK in the cast seed, grey calendar chips, and the full DOB on Review. Re-run `pnpm typecheck`, `pnpm test packages/shared/src/rules/monthReport.test.ts packages/shared/src/rules/mood.test.ts packages/shared/src/rules/dailyReport.test.ts packages/shared/src/seed`, and the phone e2e for `members` and `round12` only (KC's one-pass rule).
2. After the merge, `pnpm db:reset` on the demo box so the seed changes (marks, NIK) are live; the clock should be pinned to the demo date so Budi's birthday lands three open days out as the README describes.
3. Carry the "can wait" list into round 13 as one hygiene task; the state-size headroom (7%) is the first item that will bite.
4. Add the two documented-but-undocumented choices to the plan's deviations list: management may unsend others' photos; month-report rows open their screens unfiltered.

## Assessment

**Ready to merge?** With fixes

**Reasoning:** The round is architecturally sound, role-safe and well tested, with no critical defect; what blocks a confident owner demo is presentation of two owner-facing facts (an "outstanding" figure inflated by invoices not yet due, and a demo day on which nobody was marked at the door) plus three small, client-visible polish items (carer NIK, pastel chips, DOB year), all fixable in under an hour with two tests to adjust.
