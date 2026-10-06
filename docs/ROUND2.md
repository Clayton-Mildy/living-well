# Round 2: KC's feedback (applies on top of docs/BUILD_GUIDE.md)

Read docs/BUILD_GUIDE.md first; its rules still hold (ownership, i18n EN+ID, no hard-coded text, tests).
The drop-in attendance model (no expected list, Flex = 10 visits/month counted from check-ins, no escorts) stays.

## KC's decisions
- **Login.** Username + password for staff and family. Seed usernames are lowercase first names (caca, dewi, dinar, dimas, agus, yohanes, fransiska, ega, siti, joko, maria, daniel, cynthia, stephanie, laras, yohana); the demo password for every seed account is `citra123`. Everyone can change their password and their display name; the username can't change. New staff and new family logins get a username from the server automatically (first name, plus a number if taken) and the default password `citra123`; management can reset a password to the default. The one-tap demo account buttons stay on the login page.
- **Leads.** Approving a lead's membership form goes straight into Join: the same flow asks for plan and first day, then creates the member and the family login. A lobby approval still goes to management Reviews (existing gated create).
- **Photo review.** Every photo taken by non-management (activity solo and group photos, member profile photos, the kitchen's lunch photos) is `visibility: 'pending'` until management approves it in Reviews. Families never see pending photos (the family projection only includes `visible`). Management's own photos publish immediately.
- **Health checks.** No queue. The station lists ALL active members, in the club first, searchable and paginated; anyone can be checked at any time.

## Shared contracts (build exactly; other agents code against them)
### UI kit (owner: UI-kit agent; exported from `apps/web/src/components/ui/index.tsx`)
- `Select<T extends string>({ label?, value, onChange, options: { value: T; label: string; hint?: string }[], placeholder?, error?, disabled?, searchable? })`: custom dropdown (button + popover list, keyboard and screen-reader friendly, searchable when long). Replaces every native `<select>`.
- `DateField({ label?, value /* 'YYYY-MM-DD' | '' */, onChange, min?, max?, disabledDate?: (d) => boolean, error?, placeholder? })`: custom calendar popover (month grid, prev/next month, today). Replaces every `<input type="date">` and `type="month"` (a `MonthField` for months).
- `TimeField({ label?, value /* 'HH:MM' */, onChange, min?, max?, step? /* minutes, default 5 */, error? })`: replaces every `<input type="time">`.
- `usePaged<T>(items: T[], pageSize = 10, resetKey?)` → `{ page, pages, rows, setPage }` and `<Pager page pages onPage label? />`. Every list that can hold more than one page uses it (search resets to page 1).
- `CameraCapture({ open, onClose, onCapture: (blob: Blob) => void, facing?: 'user' | 'environment', allowUpload? })`: real camera via `getUserMedia` (works on localhost and HTTPS, e.g. the Cloudflare tunnel), shutter, retake, use photo; falls back to a file picker when there is no camera or permission is denied.
- `uploadMedia(blob): Promise<string>` in `apps/web/src/lib/media.ts` → POST `/api/media` (JPEG/PNG/WebP, max ~4 MB after client downscale to 1600px) → returns `mediaId`. `mediaUrl(id)` → `/api/media/<id>`.
- `<PhotoImg photo={Photo} size? />`: shows the real image when `photo.mediaId`, else the design's tone placeholder (existing look).
### Photos (owner: activity agent, new file `packages/shared/src/actions/photos.ts`, registered in actions/index.ts)
- `photo.take` gains `mediaId?` and sets `visibility: 'pending'` for non-management (management: `'visible'`).
- `photo.approve { photoIds: string[], notify: boolean }` and `photo.reject { photoIds: string[], reason: string }` (management only). Approve sets `visible` + `approved`; families are told only on approve and only if `notify`. For `kind: 'lunch'` photos approve calls `announceLunchPhoto(d, ctx, photoId)` exported by the kitchen agent from `actions/kitchen.ts`.
- `DayMenu.photoIds: string[]` replaces `photoId` (kitchen migrates its code; `photoId` is deprecated and will be removed).
### Notify toggle
Every action that publishes something takes `notify?: boolean` (default `true`) and its dialog shows a "Notify families" / "Notify the team" toggle, on by default: `schedule.publish`, `calendarEvent.create/update`, `menu.publish`, `menu.postLunchPhoto` (management), `photo.approve`, `prices.set`.
### Accounts (owner: auth agent)
- Server-only table `credentials (user_id, username unique, password_hash)` (migration 0002 exists). Never put passwords or hashes in club state, actions, patches or logs.
- `POST /api/login { username, password }`, `POST /api/account/password { current, next }`, `POST /api/account/reset-password { userId }` (management), `GET /api/account` → `{ username }`. Name changes keep using `account.updateStaff` / `account.updateFamily`.
- `Staff.username` / `FamilyContact.username` are set by the server (system action) when an account gets access; areas only display them.

## Area task lists
### UI kit agent (+ finance controls)
1. Build the kit above (new files under `components/ui/`, `lib/media.ts`, server `/api/media` routes in `apps/server/src/app.ts`, an `apps/server/src/media.ts` helper), unit tests where it makes sense (pager, date math), a kit page section is NOT needed (the design system page is gone from the demo).
2. As soon as the kit works (typecheck clean, exported), tell the coordinator with SendMessage to "main" (one short message with the final signatures), then continue with step 3.
3. Then replace native selects/date/time inputs and add pagination in `features/finance/*` and in the shell (`AccountSheet`, `Notifications` lists, `DemoPanel` account list).
### Auth agent
Login page (username + password, show/hide password, errors, the demo account buttons kept), `AccountSheet` (change password with current/new/confirm, change name; username shown read-only), server routes and credential seeding at boot/reset (`citra123`), username assignment for new staff/family contacts with access, a session token so the server no longer trusts a bare `x-user-id` header from the browser (demo buttons may still sign in without a password via `/api/verify`), README login section, unit/server tests, e2e `e2e/auth.spec.ts`.
### Lobby agent
Arrivals: the member check-in list goes on top; "Also today" moves below it. A **Check-in | Check-out** toggle at the top: check-in mode shows the face camera + the check-in list; check-out mode hides the camera and shows a searchable list of members in the club with Check-out buttons. Pagination and custom controls in lobby + chat.
### Nurse agent
Health station without a queue (all active members, in the club first, search, pagination; due re-checks/departure checks shown as chips on the rows, not a queue). Readings: pick any date (DateField) to see that day's readings, and a member's record day by day back in time. Custom controls, pagination.
### Members + reviews agent
Members list: compact rows (less detail, more members at a glance), pagination. Profile Photos tab: "Take photo" (CameraCapture → uploadMedia → `photo.take` kind solo, pending for non-management). Reviews: a **Photos** section (pending photos grid, approve selected / approve all with the notify toggle, reject with reason). Show `username` on the Family tab (read-only) with a management "Reset password" button (`/api/account/reset-password`). Custom controls, pagination.
### Activity + calendar agent
Daily log: member search. Camera: real camera (CameraCapture), member search to choose who; group photos: pick members with search (no wall of everyone); photos pending for non-management; `actions/photos.ts` (approve/reject). Calendar: the days list shows only the next 3 days, each item with an "Edit activity" button; clicking a date in the month calendar opens that week in the weekly schedule (e.g. 4 Nov → week of 2–6 Nov); weekly schedule shows the date under each day name, with previous/next week. Schedule builder: a quick ✕ to remove a placed activity. Activity editor: room has "Other" with free text. Notify toggle on schedule publish and calendar events. Custom controls, pagination.
### Kitchen agent (+ family timeline lunch photos)
Lunch photos: several per day (`DayMenu.photoIds`), taken with CameraCapture; pending for non-management; export `announceLunchPhoto`. Weekly menu plan: plan next week (week switcher), the date under each day. Notify toggle on menu publish. Family Today timeline (`features/family/Timeline.tsx`, narrow edit): show all approved lunch photos. Custom controls, pagination.
### Management + enquiries + surveys agent
The Overview is hidden (nav done by the coordinator; management lands on Arrivals): update/remove overview e2e. Surveys: choose recipients (all families, families of chosen members, or chosen contacts) with search. Leads: Approve → Join in one flow. People: show `username` and a "Reset password" button. Notify toggle on prices. Custom controls, pagination in all management and enquiry lists.

## How to work this round
- Your isolated e2e: `E2E_NAME=<area> E2E_PORT=<port> scripts/e2e-all.sh 1 "phone laptop" <your specs>` (production build, own DB). Ports: uikit 8891, auth 8901, lobby 8831, nurse 8841, members 8851, activity 8861, kitchen 8871, mgmt 8881. Don't use 5173/8787/8790 (the coordinator's and KC's).
- Don't run vite dev servers for e2e; the frozen build avoids breakage from other agents' edits.
- Shared files are the coordinator's: ask in your report. Exception: you may export new helpers from your own area files for others (as specified above).
- Run your unit tests, `pnpm -r typecheck` and your e2e at phone + laptop; the coordinator runs the full matrix.
