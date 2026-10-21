# Round 13 phase 1 — final review (8911e10..56cd93c)

Reviewed the full diff in five passes (header/SOURCES/nav/ui; forms and guests feature; lobby; members/tasks/shell; e2e, shared actions, i18n, rules, seed) plus the current tree where the diff needed context (`Guests.tsx` param effect, `rules/tasks.ts` duty catalogue, `seed/r7/guests.ts`, `actions/guests.ts` update/cancel, `rules/core.ts` name helpers, `global.css`, `apps/server/src/app.ts`). Read-only; no tests run.

## Strengths
- One parser for the widened title (`titleOf` in `packages/shared/src/actions/members.ts`) feeds all three entry paths (members.create / members.update, enquiry.create / update, the online form submit), trims, caps at `TITLE_MAX`, and lets the caller choose the empty-code. No `oneOf(TITLES)` is left anywhere in a parser.
- `initials` now takes the member and slices the member's own title off `memberName`; the string path still strips the usual staff/contact titles. Every member avatar (Avatar, Av ×2, MemberAvatar, MembersList, MemberProfile, family bits) was moved over, so "Tante Lily Tan" is LT everywhere a member record is at hand.
- `genderOf` is the single source for the member record (create and update), the lead → member conversion (`isFemaleTitle`), and the printed form's gender box; the female list is case-insensitive and trimmed.
- The cancel path retracts the desk's earlier "will lead" notice before posting the cancellation, so the lobby bell only ever carries the current truth for that session; the test asserts both the retraction and the count.
- `lobby.checkin` / `lobby.checkout` use the existing `attendedRows` and `linkTo` helpers; `dutyState` passing 24:00 for past dates is the only `nowMin` consumer in the catalogue (checked: no other duty reads `nowMin`), so no other duty's history shifts.
- Seed changes are RNG-neutral: `seedGuests` uses no RNG; `addRoster` adds `photoMediaId` after the unchanged `between()` call. `history.test.ts:142` ties members-with-portraits to `MEMBER_PORTRAITS`, and the roster test checks the files exist and are distinct.
- i18n parity holds for every new or changed key (EN and ID): `enq.err.titleRequired`, `members.err.titleRequired`, `guests.g_done`, `lobby.guestsToday`, `profile.f.titleOther`, `profile.f.titleOtherHint`, `tasks.part.countOf`, `tasks.duty.lobby.checkin/checkout`, `tasks.feed.duty.lobby.checkin/checkout`; the removed `enq.fSeniorTitle` has no remaining consumer.
- The e2e edits are honest text updates (renamed sections, the seeded guest host on the 21 Oct keroncong session); no assertion was loosened. `Tasks.test` 0 of 4 → 1 of 5 and the `MemberList.test` split at "Guests today" reflect real seed changes.
- Server-side role boundary for guests is intact: every `guest.*` action is `mgmtOnly`; the lobby gets `/guests` as a link-only key, and the Book pin, BookSheet and HostForm are all behind `canEdit`.

## Issues

### Critical
None.

### Important
1. **Seeded demo-day guest is an angklung teacher "leading" the Gardening club on any non-Wednesday — including today (Thursday).** `packages/shared/src/seed/r7/guests.ts:~100-110`: when the 10:30 weekly activity on T matches no `PAIRS` entry the code falls back to `PAIRS[0]` (Bu Ratna) and books her on `w.activityId` as it stands. Thursday 10:30 is `act-garden` (`seed/index.ts:95`), and the demo DB was reset on 22 Oct. The owner will see "Gardening club · with Bu Ratna · guest" on the Arrivals rail, the Calendar day, the activity staff's session row and the lobby bell. The controller noted it as a deferred minor; for an owner who knows their own programme it is a credibility hole in the one new block the front desk will be shown. Fix (five minutes): try both slots on T for a `PAIRS` match (`['10:30','13:30'].map(weekly)`), and when neither matches either call `lead(T, slot, 'act-angklung')` exactly as gs-3/gs-4 do (one `scheduleDays[T]` row; the existing test that `scheduleDays['2026-10-21']` is undefined still holds because Wednesday matches) or skip gs-5 and tell KC. Before choosing `lead`, confirm the main seed has not already attached today's 10:30 attendance/photos to `act-garden` at the seed's `nowMin`.
2. **`guest.update` posts a new lobby notice but never retracts the old one.** `packages/shared/src/actions/guests.ts:200-205`: moving a session (date, slot or host) sends `guests.notif.booked` to the lobby again, leaving the earlier "will lead X on <old date>" in the desk's bell; a later cancel only retracts notices matching the *current* date/slot, so the original stays forever. Fix: lift the retraction loop at :226-228 into `retractLobby(d, ctx, name, date, slot)` and call it in update with `prev` before `tellLobby`. Not exercised in the demo; can follow after the review.

### Minor
3. `apps/web/src/features/lobby/AlsoToday.tsx:145` — management tapping a guest row goes to `/guests` and drops the session id, although `Guests.tsx:50` opens `?session=` for every role. Make `open` always `/guests?session=${id}`.
4. `apps/web/src/features/enquiries/PublicForm.tsx:123` — tapping Other blanks the title, so the hero reads " …" until something is typed. Show `d.name || '…'` alone when the title is empty.
5. `apps/web/src/features/members/Reviews.tsx:231` — a pending registration without a member record falls to the string `initials` path (`name || d.title`), so a free-text title gives "TL" for "Tante Lily Tan". Pass a `{ title, firstName, lastName }` stub from the draft when there is no `m`.
6. `apps/web/src/features/lobby/Arrivals.tsx:47,58` — `?mode=` stays in the URL after the desk switches tabs by hand; a refresh reopens the deep-linked tab. Clear the param in the mode effect (`setParams({}, { replace: true })` as `Guests.tsx` does).
7. `packages/shared/src/rules/tasks.ts:263-268` — the always-done check-in row counts as a duty in `roleSummary`, `teamRange` (month report) and `dailyReport`, nudging the lobby's completion up by one per attended day. Ruled acceptable; a `score: false` flag on the def, skipped by `roleSummary`/`roleRange`, would keep the row without the free tick.
8. `packages/shared/src/actions/guests.ts:227` — retraction matches `params.name`; a host renamed between booking and cancel leaves the old notice. Match on a `sessionId` param instead (add it to the lobby params).

## Deferred-minor triage
| Item (from deferred-and-rulings) | Verdict |
|---|---|
| Non-Wednesday fallback: Bu Ratna leads whatever runs at 10:30 (Thursday: Gardening club) | **Must fix before the demo reset** (Important 1): today is Thursday and the DB is already on 22 Oct. |
| Edit-then-cancel leaves a stale lobby notice | Can wait, but fix soon (Important 2): also plain edits leave a stale notice. |
| Phone bar fallback #F2F2F4 vs wide #F6F1EA | Can wait / no-op: `--page` is always set by `global.css` (#FFFFFF default skin, #F6F1EA warm), so the fallbacks never render. |
| Stale "Check on" code comments | Can wait. |
| Portraits: m80 backdrop, m64/m74 age, rural skew | Can wait (KC's call after the demo). |
| ProfilePhoto preview uses the string initials path | Can wait (same class as Minor 5). |
| TitleField.tapped not reset when a lead is picked | Can wait; the field opens on Other only when the value is not a preset, so the visible effect is a chip flicker. |
| TitleField/forms circular import | Can wait; both sides reference each other only inside render functions. |
| Free-text titles outside the list read male | Can wait; tell KC as ruled. |
| Manage can edit/switch off the informational check-in duty | Can wait. |
| Lobby completion % nudged up | Can wait (Minor 7). |
| Retraction matches host name | Can wait (Minor 8). |
| Fees hidden in UI only | Can wait; the server sends the full club state to every staff role (`apps/server/src/app.ts:35`), so this matches how finance data already reaches the lobby. |
| Double import in AlsoToday | Not present in the final tree (`guestSessionsOn` and `activityName` are imported once each). |
| Lobby booking notice links to /calendar without a date | Can wait; the teachers' notice has done the same since round 7. |

## Declined to judge
- Portrait likeness, age and ethnicity matching: KC accepted the set per the ruling; a design call, not a code fault.
- The lobby's replica carrying guest hosts' bank details and fees: the staff snapshot has always been the whole club state; UI-only hiding is the app's existing pattern for every role.
- `lobby.checkin` being `done` rather than `open` during the day: controller ruling, overrides the plan.
- Free-text titles defaulting to male: controller ruling, to be told to KC.
- ID duty labels "Check-in" / "Check-out" as loanwords: common Indonesian usage.
- Approvals buttons at 44 px via `size={48}`: the kit maps 48 → 44 per the ruling.
- The 2.8 MB of portrait JPEGs under `apps/web/public/demo`: static assets, not club state; the 7.5 MB cap counts state only.
- Management being able to edit or switch off the informational check-in duty in Manage: a product question for KC.
- The lobby's Guests page showing phone and WhatsApp for a host: a desk greeting a guest reasonably needs them.
- The activity teacher's screen now reading "with Pak Hendro · guest" instead of "with Dinar" on the demo-day keroncong: a seed-visible but intended consequence of seeding a guest on T.

## Recommendations
- Fix Important 1 before the next `db:reset` (or confirm the demo keeps the 21 Oct Wednesday seed, in which case it is moot).
- Fold Important 2 and Minor 8 into one small follow-up after the review: a `sessionId` in the lobby params and a shared `retractLobby` helper used by update and cancel.
- Minors 3, 4, 6 are one-liners that could ride along with the phase 2 lobby work.

## Assessment — Ready to merge? **With fixes**
Code quality is high and the six tasks hold together across their seams: the title widening reaches every parser and name helper, gender derivation is centralised, the new duty does not disturb other duties' history, deep links coexist (`?mode=` beside `?checkOn=` and `?demo=`), server permissions on guests are untouched, seeds stay RNG-neutral and under the cap, i18n is complete, and the e2e edits are honest. The one thing to do before the owner sees it is the seeded demo-day guest: on today's Thursday reset it books an angklung teacher onto the Gardening club. Fix that (or re-seed on a Wednesday), merge, and take the stale-notice retraction on `guest.update` right after the review.
