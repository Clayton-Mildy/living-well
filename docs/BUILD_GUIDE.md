# CitraPremier: build guide for feature work

This guide is the contract for every feature area. Read it fully before writing code.
The approved plan is at `~/.claude/plans/use-the-claude-design-mcp-humble-ripple.md`. Its "Fix list" says what each area must fix beyond the design.

## 1. Non-negotiables
1. **Look exactly like the design.**
   - The source is `design/CitraPremier App.dc.html`: template lines 394–2199, logic lines 2200–3704.
   - Every screen and overlay already exists as converted JSX in `design/generated/<Region>.tsx`, with exact inline styles. See `design/generated/INDEX.md`.
   - **Start from that markup and keep every px, colour, radius, font size and gap.**
   - Hover classes such as `className="dh15"` refer to `apps/web/src/styles/pseudo.css`. Keep them.
2. **Mobile first.** Build and check the phone layout (390 and 360 wide) first, then tablet (768–1279), then laptop (≥1280). The design switches layout in JS on `isPhone`, `device === 'tablet'` and similar; reproduce that with `useDevice()`.
3. **Fix the design's bugs.** Implement every fix-list item for your area. New UI must reuse the design's own patterns: sheets, the edit dialog, chips, toggles, 44px row actions, toasts, lock tags.
4. **Full English and Indonesian.** No hard-coded user-visible text. Every string goes through `t('ns.key')`.
5. **Test logic and view.** No area is done without passing unit tests and e2e specs (section 9).
6. **Login is username + password** (round 2; see README "Signing in"); the one-tap demo accounts stay. The camera and photo uploads are real (round 2). Other outside services (WhatsApp, Xero, DOKU, LEPU PC-303, face recognition) stay simulated, labelled "Demo" where the design does.

## 2. Repo map
```
packages/shared/src/   types.ts · util.ts · rules/* · seed/ · actions/* · notify.ts · users.ts · project.ts · i18n/{en,id}/*
apps/server/src/       Hono API · Postgres (Drizzle) · SSE · jobs · demo reset/clock · public form routes
apps/web/src/          app/ (router, nav, screens) · shell/ · components/ui (primitives) · store/ · lib/ · hooks/ · features/<area>/
design/                decoded design (read-only reference) · generated/ (converted JSX) · data.js
e2e/                   Playwright specs (one per area) · helpers.ts
```
- Run the stack: `pnpm dev` (API on 8787, web on 5173). The database is local Postgres 17 on port 5434, database `citrapremier`.
- Never edit `design/`. Never install new dependencies; ask in your final report if you need one.

## 3. Data and actions
- **Club state.** `ClubState` (`packages/shared/src/types.ts`) holds one `Record<id, Row>` per collection.
  - Read it with `useClub()` from `apps/web/src/store/replica.ts`.
  - Rows can be soft-deleted (`deletedAt`). Always read through `live(...)` or a selector.
- **Selectors.** Selectors live in `packages/shared/src/rules/*`:
  - `lobbyGroups` (`inClub`, `goneHome`, `others`), `nurseQueue`, `flexMonth`, `visitsInMonth`, `wouldBeExtra`, `extraDaysFor`, `conflictsOn`, `memberConflictsOn`, `lunchSafety`;
  - `invoiceStatus`, `balanceOf`, `runPreview`, `budgetWeek`;
  - `staffThreads`, `familyThreads`, `surveyStats`, `dayStatus`, `sessionsOn`, `menuOn`, `planOn`, `activeOn`;
  - `contactsOfMember`, `primaryContact`, `memberName`, `memberShort`, and more.

  **Reuse them; add new pure selectors in your own file** (`rules/<area>.ts`). Don't edit someone else's.
- **Changing data.** Data only changes through actions: `defineAction({ name, can, parse?, review?, run, afterApprove?, afterReject? })` in `packages/shared/src/actions/<area>.ts`.
  - **`run(draft, input, ctx)` must be pure and deterministic.**
    - No `Date.now()` and no `Math.random()`. Use `ctx.today`, `ctx.now`, `ctx.nowDT` and `ctx.id(prefix)`.
    - Simulated device values (PC-303, face match) are produced in the UI and passed in as input.
  - **`ctx.fail('err.code')`** for domain errors, using i18n keys. Area-specific errors go in your namespace, e.g. `ctx.fail('lobby.err.notExpected')`.
  - **`ctx.feed({ icon, key, params, memberId })`** for the activity feed (Live today, member History).
  - **`ctx.notify({ toUsers?, toRoles?, kind, params, link, memberId, severity })`** stores an "Update" notification. `kind` is an i18n key in your namespace, e.g. `'lobby.notif.absent'`.
  - **"Needs action" items are derived** in `packages/shared/src/notify.ts`. Don't store them. If your area needs a new derived item, describe it in your final report and the coordinator adds it.
  - **Review gate.** Use `review: { policy: 'gate' | 'flag', section, op, target }` for customer-detail changes made by non-management staff. `gate` waits for management approval; `flag` applies at once and is reviewed afterwards (health). Management is never gated.
  - **Registration.** Actions are registered in `actions/index.ts` (pre-wired). Export your array from your area file.
- **Calling actions in the UI.** `const act = useAct();` then `await act('area.verb', input, { ok: t('…') })`.
  - It runs optimistically, syncs with the server, and toasts errors.
  - When `r.reviewed === 'gate'` it shows a "sent for review" toast.
  - Check `r.ok` before closing sheets.
- **Helpers** in `actions/helpers.ts`: `ensureAttendance`, `familyUserIds`, `shortOf`, `requireMember`, `postMessage` (creates the thread if needed, marks the sender's side read).
- **Jobs.** `registerJob(name, (draft, ctx) => …)` in your actions file runs every 15 s on the server as the system user. Use it for scheduled things such as broadcasts at their time, the invoice run on the 21st, the daily hold/stop of memberships with an unpaid invoice, and simulated Xero/DOKU syncs.
- **Clock.** `useNow()` returns `{ today, nowMin, now }` from the shared demo clock (the demo day, from 09:58; tests pin it to Wed 21 Oct 2026). **Never hard-code `2026-10`, `October` or `2026`**; derive them from `today`.
- **Permissions.** `can(user, input, state)` is enforced on the server. Use the plan's permission table. For UI visibility, check the role (`useMe().role`) or call `getAction(name).can(...)`.

## 4. Web conventions
- **Primitives:** `apps/web/src/components/ui/index.tsx`. Prefer them over re-styling when the design markup matches:
  - icons and brand: `Icon`, `Logo`;
  - text and layout: `PageHead`, `Eyebrow`, `SectionLabel`, `Card`, `CardHead`, `Row`, `RowText`;
  - buttons and chips: `Button`, `IconButton`, `Chip`, `ChipGroup`, `InfoChip`, `StatusBadge`, `CountDot`, `Avatar`;
  - forms: `Toggle`, `TextField`, `Segmented`;
  - states and notes: `EmptyState`, `SkeletonRows`, `Pin`, `Note`, `StaffOnlyTag`;
  - overlays: `Sheet`, `Drawer`, `Dialog`.

  Overlays already handle Escape, focus trapping and scroll locking. Constants: `FONT_BODY`, `FONT_SMALL`, `TONES`, `photoBg`.
- **Device:** `const { device, isPhone, isTablet, isWide } = useDevice();` and `padFor(device)` for page padding.
  - Phone pages set CSS vars `--cp-body: 16px` and `--cp-small: 14px` (the shell does this), so design sizes like `max(14px, var(--cp-body, 0px))` behave exactly as in the design.
  - **Phone primary actions** that the design moved into the floating "pin" use `<Pin icon label onClick />`.
- **Text and dates:** `const t = useT();` and `const { fdl, fds, fdy, fmonth } = useFmt();` for dates (en-GB / id-ID, as in the design). Money: `rp(n)` from `@cp/shared`.
- **Routing:**
  - Screens are mounted by `app/screens.tsx` from `features/<area>/index.tsx` exports. **Keep the export names that are already there.**
  - Navigate with `useNavigate()` to `/<navKey>` (see `app/nav.ts`) or `/members/:id/:tab`.
  - Query parameters work for deep links, e.g. `/billing?f=overdue`, `/health?member=m46&tab=docs`.
  - If your screen needs a nav key or route that doesn't exist, ask in your report. Don't edit `app/nav.ts` or `app/App.tsx`.
- **Signed-in user:** `useMe()` returns `{ user, role, id }`. Family users have `user.kind === 'family'` and `user.memberIds`.
- **UI preferences** that should survive reloads per user (e.g. the family's member switcher): `readPref` / `writePref` in `store/session.ts`.
- **Toasts:** `say(text, { action: { label: t('common.undo'), run } })` from `store/ui.ts`.
- **Hover:** reuse `dhN` classes from the generated markup, or the helpers in `global.css` (`h-cream`, `h-bronze`, `h-row`, `h-border`). Inline `:hover` isn't possible.
- **Phone density (round 3).** 90% of users are on phones, so the first phone screen must show data, not chrome. Phone-only rules live in `styles/global.css` (`max-width: 767.98px`); tablet and laptop stay as designed.
  - Helper paragraphs: give them `className="cp-desc"` (or `cp-hide-phone`); `PageHead`'s `sub` already has it. Keep text a user needs to act (errors, locks that block an action).
  - Filters: use `FilterChips` (chips on tablet and laptop, one dropdown on phone) instead of a row of chips. In e2e use `pickFilter` from `e2e/kit.ts`.
  - Buttons and chips: use `Button` / `Chip` (or add `cp-btn` / `cp-chip` to a hand-rolled one) so they shrink on phone. Form fields use `var(--cp-field-h, 52px)`.
  - Tiles: `cp-tiles` + `cp-tile` make a stat grid two per row; `cp-card-pad` tightens a card; `cp-tabrow` makes a row of tabs or chips one swipeable line; `Row` and `fcard` (family) tighten by themselves.
  - `Pin` is a compact pill at the bottom right; the Demo button is a small round icon at the bottom left.
- **Accessibility:** buttons are `<button>`; targets are at least 44px; status is always icon + label; images have alt text; dialogs have labels. Never put interactive elements inside other buttons.

## 5. i18n
- **Your namespaces** are `packages/shared/src/i18n/en/<ns>.ts`, with an Indonesian twin `id/<ns>.ts` typed `Same<typeof EN>`. A missing key fails `tsc`.
  - The design's existing EN/ID texts are already in `lobby`, `health`, `family` and `core.ts`. **Reuse their keys.**
  - `core.ts` is owned by the coordinator; **don't edit it.** Shared keys you can use: `common.*`, `status.*`, `nav.*`, `roles.*`, `shell.*`, `err.*`, `review.*`, `inv.*`.
- **Indonesian** must be natural and polite, as in the design ("Oma", "Opa", "Ibu", "Bapak"; "Anda"). Keep sentences short.
- **Store keys, not English, in data:** reasons (`r_family`), moods, quick notes, statuses. Render with `t()`.
- **Pronouns** follow the member's gender (`pron(m)`, with i18n keys for she/he where needed).

## 6. File ownership (parallel work)
Edit **only**:
- your feature folder `apps/web/src/features/<area>/**`;
- your actions file(s) `packages/shared/src/actions/<file>.ts` and their `*.test.ts`;
- new rules files `packages/shared/src/rules/<area>*.ts`. Re-export them from your actions file if needed; **don't edit `rules/index.ts`**, import them by path;
- your i18n namespace files (en and id);
- `e2e/<area>.spec.ts`.

Anything else (types, seed, core i18n, nav, router, shell, primitives, other areas): **don't edit.** Write the exact change you need in your final report.

The one exception: if `types.ts` is missing a field your fix needs, you may **append optional fields** to existing interfaces (never rename or remove), and list them in your report.

## 7. Cross-area contracts
Build these exactly; other areas import them in parallel.

### Actions (name → owner file)

**Drop-in attendance (KC's correction, overrides the design).** Members come on any open date, at any time:
- There are no bookings, leave, "expected today", "not coming" or "running late".
- Flex is 10 visits a month, counted from check-ins; the 11th and later visits are extra days on next month's invoice. Gold is unlimited.
- Check-in and check-out don't record who brought or collected the member.

**Attendance** (`attendance.ts`, lobby):
- `attendance.checkIn` and `attendance.checkOut` (exist)
- `attendance.checkIn {memberId,method}`; `attendance.checkOut {memberId}`; `attendance.undoCheckIn {memberId}`; `attendance.undoCheckOut {memberId}`
- `attendance.askDeparture {memberId}`
- `guest.checkIn {guestId}`; `guest.checkOut {guestId}`; `guest.noShow {guestId}`

**Messages** (`messages.ts`, lobby):
- `thread.start {memberId,familyId,topic,text}`; `message.send {threadId,text,ref?}`; `thread.markRead {threadId}`

**Health** (`health.ts`, nurse):
- `reading.save {memberId?|guestId?,kind,values,noteKeys,note,shared,tellFamily,recheck,deferMonthly}`
- `reading.edit {readingId,values,reason}`; `reading.void {readingId,reason,note?}`
- `queue.add {memberId,kind,note?}`; `queue.dismiss {memberId,kind,reason}`

**Members and family contacts** (`members.ts` and `family.ts`, members):
- `members.create` (gate create)
- Gated: `members.updateDetails`, `members.setDocuments`, `members.setConsent`, `members.changePlan`
- Flagged: `members.setHealth`, `members.setAllergies`, `members.setMeds`, `members.setCareInstructions`, `members.setCognitive`
- `members.requestDocument`; `document.upload` (family, gated)
- `planChange.apply`; `planChange.decline`
- `members.end`; `members.cancelEnding`; `members.reactivate`
- `note.add`; `note.edit`; `note.delete`
- `family.addContact`; `family.updateContact`; `family.linkContact`; `family.unlinkContact`; `family.setPrimary`; `family.setAppAccess` (all gated)

**Care and photos** (`care.ts`, activity):
- `log.save {memberId,date,mood,lunch,joined,communicative,content,note,staffNote?}`; `log.saveAllNormal {date}`
- `photo.take {kind,memberIds,activity?,media,durationSec?}`; `photo.retag`; `photo.hide`; `photo.restore`; `photo.remove`

**Schedule and calendar** (`schedule.ts`, activity):
- `schedule.saveDraft`; `schedule.publish {effectiveFrom}`
- `calendarEvent.create`; `calendarEvent.update`; `calendarEvent.delete`
- `activity.upsert`; `room.upsert`

**Kitchen and stock** (`kitchen.ts`, kitchen):
- `dish.upsert`; `dish.delete`; `dish.reviewAllergens`
- `menu.publish`; `dayMenu.override`; `menu.postLunchPhoto {date}`
- `allergyPlan.set {date,person,dishId,alternative}`; `allergyPlan.clear`
- `feedback.submit {memberId,mealDate,dish,text}` (family); `feedback.log` (staff); `feedback.reply {feedbackId,text}`; `feedback.setStatus`
- `stock.request`; `stock.edit`; `stock.cancel`; `stock.approve`; `stock.reject`; `stock.receive`

**Finance** (`finance.ts`, finance):
- `run.issue {period}`
- `invoice.adjust`; `invoice.void`; `invoice.remind`; `invoice.callNote`
- `payment.record`; `payment.simulateVa {invoiceIds,bank}` (family primary or staff); `refund.record`; `xero.sync`
- `budget.request`; `budget.edit`; `budget.cancel`; `budget.approve`; `budget.reject`; `budget.setLimit`; `budget.addSection`; `budget.renameSection`
- `receipt.add`; `receipt.edit`; `receipt.void`; `receipt.approve`; `receipt.reject`
- `vendorInvoice.add`; `vendorInvoice.edit`; `vendorInvoice.approve`; `vendorInvoice.reject`; `vendorInvoice.markPaid`; `vendorInvoice.delete`

**Directory** (`directory.ts`, finance):
- `directory.add`; `directory.update`; `directory.delete`; `directory.togglePublic`

**Enquiries and form** (`enquiries.ts`, mgmt):
- `enquiry.create`; `enquiry.update`; `enquiry.move`; `enquiry.markLost`; `enquiry.reopen`; `enquiry.archive`
- `enquiry.bookVisit`; `enquiry.bookTrial`; `enquiry.convert` (gate create)
- `form.send`; `form.open`; `form.saveDraft`; `form.submit`; `form.approve`; `form.return`

**Club** (`club.ts`, mgmt):
- `venue.book`; `venue.update`; `venue.cancel`; `venue.askReview`; `venue.recordReview`
- `broadcast.send`; `broadcast.schedule`; `broadcast.cancel`; `template.upsert`
- `survey.create`; `survey.send`; `survey.close`; `survey.answer` (family)
- `prices.set`

**People** (`people.ts`, mgmt):
- `staff.create`; `staff.update`; `staff.deactivate`; `staff.setAppAccess`
- `hrNote.add`; `hrNote.delete`; `staffTime.upsert`

### Components (owner → used by)
- `features/activity/PhotoViewer.tsx` `PhotoViewer({ photos, startId, onClose, audience: 'staff' | 'family' })`. Used by family, the member profile and the photo library.
- `features/members/MemberProfile.tsx` `MemberProfile({ memberId?, audience?: 'staff' | 'family' })`. Staff get the route params; family health passes `memberId` and `audience="family"`.
- `features/finance/InvoiceSheet.tsx` `InvoiceSheet({ invoiceId, open, onClose, audience })`. Used by family billing and the profile Plan tab.
- `features/chat/StartThreadSheet.tsx` `StartThreadSheet({ memberId?, open, onClose })`. Used by the profile Family tab ("Message family").

## 8. Porting method (per screen)
1. Read the screen's region in `design/generated/` and the matching `xxxVals()` logic in the design file (line ranges in your brief).
2. Write a view-model hook (e.g. `useArrivalsVals()`) returning the values the markup needs, computed from `useClub()`, selectors and `useNow()`. Port the prototype logic, fixing the bugs listed for your area.
3. Paste the generated markup into a typed component and replace `v.x.y` with view-model values. Replace hard-coded English with `t()`. Keep styles exact.
4. Add the new UI the fix list needs, using the design's patterns.
5. Check phone, then tablet, then laptop.

## 9. Testing (required)
**Unit tests (Vitest)**, next to your code: `packages/shared/src/actions/<file>.test.ts` and `rules/<area>.test.ts`. Cover for each action:
- the happy path;
- permissions (a forbidden role throws `err.forbidden`);
- validation and domain errors;
- review gating (gate leaves data unchanged and creates a pending request; flag applies and creates a post-review request; management bypasses);
- notifications and feed side effects;
- date handling (no hard-coded month).

Use `buildSeed()` and `execute()` as in `actions/framework.test.ts`. Run with `pnpm exec vitest run --project shared`.

**E2E tests (Playwright)**, in `e2e/<area>.spec.ts`. Cover every screen of your area, using `signIn` and `resetDemo` from `e2e/helpers.ts`:
- it renders, with no console errors (`watchConsole`) and no horizontal scroll (`assertNoHorizontalScroll`);
- the key flows work end to end at **phone, tablet and laptop** (projects `phone`, `phone360`, `tablet`, `laptop`);
- toggling Indonesian shows no raw keys (no text matching `/\b[a-z]+\.[a-zA-Z]+\b/` from your namespace).

**Run e2e in your own isolated environment**, never against port 5173 or 8787:
```
pnpm e2e:env <area> <apiPort> <webPort>      # own DB citrapremier_e2e_<area>
E2E_BASE_URL=http://localhost:<webPort> pnpm exec playwright test e2e/<area>.spec.ts
pnpm e2e:env stop <area>
```
Ports:

| Area | API | Web |
|---|---|---|
| family | 8801 | 5201 |
| lobby | 8802 | 5202 |
| nurse | 8803 | 5203 |
| members | 8804 | 5204 |
| activity | 8805 | 5205 |
| kitchen | 8806 | 5206 |
| finance | 8807 | 5207 |
| mgmt | 8808 | 5208 |

Your env shares the source with everyone, so another area's half-finished code can break your page. If a failure isn't in your area, note it and move on.

**Typecheck:** `pnpm -r typecheck`. Other areas' in-progress errors may show; your files must be clean (`… | grep features/<area>` etc.).

## 10. Definition of done (put this checklist in your final report)
- [ ] Every screen in your brief is ported from the generated markup, and matches the design at phone, tablet and laptop.
- [ ] Every fix-list item for your area is implemented. Name each one and where.
- [ ] All actions in your contract exist, with `can`, validation, review policy, notifications and feed.
- [ ] EN and ID complete; no hard-coded text; no hard-coded dates or months.
- [ ] Unit tests and e2e specs written and **passing**. Paste the pass counts.
- [ ] Typecheck clean for your files.
- [ ] Requested shared-file changes (if any) listed precisely.
