# CitraPremier: operations app

The operations app for **CitraPremier | Premium Seniors Club** (Living Well Seniors Communities), built from the Claude Design prototype *CitraPremier App.dc.html*.
- **Who uses it:** six staff roles (lobby, nurse, activity teacher, kitchen, finance, management) and families.
- **Languages:** English and Bahasa Indonesia.
- **Screens:** phone first, then tablet and laptop.
- **Data:** one shared Postgres database with live updates across every device.

## Run it
Requirements: Node 22, pnpm 10, PostgreSQL 17. On this Mac that's the Homebrew install on **port 5434** with trust auth (`.env` has the URL).

```bash
pnpm install
pnpm db:setup          # creates the citrapremier database, runs migrations, seeds the demo club (45 members)
pnpm dev               # API on :8787, web on :5173 → open http://localhost:5173
```

Sign in with a username and the demo password `citra123` (e.g. `caca` for the lobby, `maria` for a family), or tap a demo account on the login page. See [Signing in](#signing-in).

### Share it through a Cloudflare tunnel
One port serves both the app and the API, so a quick tunnel needs no configuration:

```bash
pnpm demo              # builds the web app, starts the API + app on :8787, opens a trycloudflare.com URL
```

Or run the parts yourself:

```bash
pnpm start             # build + serve app and API on http://localhost:8787
pnpm tunnel            # cloudflared tunnel --url http://localhost:8787  (prints the public https URL)
```

Live updates use Server-Sent Events, which pass through the tunnel. Anyone with the link sees the same data, live. To tunnel the dev server with hot reload instead, use `pnpm dev:tunnel`.

On the same Wi-Fi without a tunnel, `pnpm dev:host` exposes the dev server to phones on the network.

### A frozen review copy
For checking by hand while the code keeps changing, `pnpm review` builds the app and runs it on **http://localhost:8790**. It has its own database, and edits to the source don't restart it or change what you're looking at.

```bash
pnpm review            # rebuild and restart (keeps the review data)
pnpm review reset      # rebuild, restart and reset the demo data
scripts/review.sh stop
```

### Reset
- **In the app:** Demo pill → **Reset demo data**. Everyone connected sees the reset.
- **From the terminal:** `pnpm db:reset`.
- **What a reset does:** rebuilds the demo around **today** (in Jakarta; on a weekend or holiday, the next open day) and puts the shared clock at **09:58**. The clock then runs in real time, the same on every device.
- **A new day:** when the server starts on a later day than the stored demo, it starts a fresh demo for today.
- **The story adapts to the date:**
  - From mid-month, Oma Lina's check-in today is her 11th visit, an extra day, live.
  - Earlier in a month, her extra day is last month's 11th visit, on this month's invoice.
  - Today's lunch is always the fish soup, so Bambang's seafood allergy shows.
- **Pinning the date:** set `CP_DEMO_DATE=2026-10-21` to pin the demo to a fixed date. The tests do this; it is the date the seed was written for.
- **Club size:** the demo club has 45 members: the 5 hand-made ones below, who carry the scripted stories, plus 40 background members (`packages/shared/src/seed/roster.ts`). Set `CP_SEED_SMALL=1` on the API (and on `pnpm db:setup`) to seed only the 5; the e2e scripts do this.

## Demo script: "Oma Lina's day"
Open the **Demo** pill (bottom right) and run the guided steps in order.

| Time | Step | What it shows |
|---|---|---|
| 10:00 | Face check-in | Lobby board; it's Lina's 11th visit in October, so an extra day; Maria and Daniel get a message |
| 10:08 | Health check | PC-303 reads 152/94 → Watch; shared with family; re-check queued |
| 10:50 | Photos | Solo and group photos, tagged to families |
| 12:02 | Lunch photo | Kitchen posts lunch; Bambang's fish allergy has an alternative |
| 13:15 | Daily log | "Ate half of lunch" feeds Maria's Today page |
| 15:45 | Home time | Departure BP, check-out, family told |
| 17:10 | Maria's Today | The team's log and photos; "WhatsApp the club" opens the front desk |
| 17:15 | Extra visit | Flex includes 10 visits a month; today's 11th visit shows on Maria's plan card |
| 15 Nov | Invoice | Issued early with the extra day, paid by DOKU VA, synced to Xero (demo) |
| Live | Overview | Management sees the live feed and everything waiting |
| Live | Pricing | Set the Flex price |

The Demo pill can also switch account and show the design system. Registration is on paper: joining a lead or adding a member needs a photo or PDF of the signed paper form.

### Cast (seed data)
- **Members:**
  - Oma Lina (Flex): the demo anchor. She has used all 10 October visits, so today's visit is an extra day.
  - Opa Budi (Gold): her husband.
  - Opa Hendra: blood-pressure Watch.
  - Opa Tjahjadi: diabetic, monthly check due, overdue invoice.
  - Bapak Bambang (Flex): seafood allergy vs Wednesday's fish lunch, Flex→Gold upgrade request.
- **Families:** Maria (primary for Lina and Budi), Daniel, Cynthia, Stephanie, Laras, Yohana.
- **Staff (10):**
  - Caca (lobby), Ns. Dewi (nurse), Dinar and Kak Dimas (activity).
  - Chef Agus and Pak Yohanes (kitchen; Yohanes is the F&B supervisor).
  - Bu Fransiska (finance), Ega (management, can switch to the empty Adina clubhouse).
  - Bu Siti (housekeeping) and Pak Joko (driver) have no app access until management switches it on.

## Signing in
Staff and families sign in on the same page with a **username and password**.

| Who | Usernames (lowercase first names) |
|---|---|
| Staff | `caca` (lobby), `dewi` (nurse), `dinar` and `dimas` (activity), `agus` and `yohanes` (kitchen), `fransiska` (finance), `ega` (management), `siti` and `joko` (no app access until management switches it on) |
| Families | `maria`, `daniel` (Oma Lina and Opa Budi), `cynthia`, `stephanie` (Opa Hendra), `laras` (Bapak Bambang), `yohana` (Opa Tjahjadi) |

- **Demo password:** `citra123` for every seed account. Usernames ignore capitals.
- **Demo accounts:** the one-tap buttons on the login page and the Demo panel (**Switch account**) sign in without a password.
- **Change your password or name:** open **Account**. Your username is shown but can't change. A family member's name change goes to management for approval, like other family details.
- **New accounts:** a new staff member with app access, or a family contact once they are active, gets a username automatically (first name, plus a number if taken: `rina2`) and the default password.
- **Reset:** management can reset someone's password to the default (`POST /api/account/reset-password`, management only). **Reset demo data** puts every account back to the seed and the default password.
- **Storage:** passwords are salted scrypt hashes in the server-only `credentials` table. They never appear in club state, snapshots, actions, the audit log or the console.
- **Sessions:** sign-in returns an HMAC-signed token (30 days) that the browser sends on every request, and as `?token=` on the live event stream. The signing secret is `SESSION_SECRET` from the environment, or a random value created once and kept in the `meta` table. The server ignores a bare `x-user-id` header unless `CP_TRUST_USER_HEADER=1`, which only the test scripts set (`scripts/e2e-all.sh`, `scripts/e2e-env.sh`, and the server tests). `CP_DEMO_LOGIN=0` switches off the passwordless demo sign-in (`POST /api/verify`).

## How attendance works
Members drop in on any open day, at any time:
- **No expected list.** Nobody is expected, booked, on leave, absent or late. The lobby sees who is in the club and who has gone home. It checks people in by the door camera or from a searchable list of all active members, which shows each member's usual arrival time as a hint.
- **Flex is 10 visits a month,** counted from actual check-ins. From the 11th visit in a month, each visit is an extra day (Rp 650,000) on the next month's invoice, and the lobby sees a note when checking someone in. Gold is unlimited.
- **No escort records.** Check-in doesn't record who brought them, and check-out doesn't record who collected them.
- **Kitchen covers** are the members checked in plus booked guests, so allergy conflicts appear as allergic members arrive.

## What changed from the design
The prototype was audited before building (about 100 issues). All of them are fixed:
- details with no entry point;
- information that couldn't be added, edited or deleted;
- logic, safety and crash bugs.

KC's additions:
- non-management changes to customer details go to management **Reviews** (health edits apply at once and are reviewed afterwards);
- drop-in attendance, as described above;
- a **notification centre** for every role;
- a small seed, a real database, the brand logo, full Indonesian.

The full list is in the approved plan; `docs/BUILD_GUIDE.md` describes the architecture.

## Round 7 (KC, 2026-10-08)
- **Renewals** (`/renewals`, front desk and management): the month-end follow-up of every member for the coming month (continue, upgrade, downgrade, leave, stop, no answer, call back). Caca records the answer; a change waits in **Approvals → Renewals** for Ega, then applies from the 1st. Leave keeps its 14-day notice rule.
- **Charts you can hover or tap** (`components/ui/TrendChart.tsx`) show the date and value. The member Health tab has a trend with 1M / 3M / 6M / All and lists **every** reading by month.
- **One-day activity changes:** on the calendar, "Edit activity" → **Just this day** (today included) changes one session without touching the weekly plan. Teachers and families are told. Stored in `scheduleDays`.
- **Guest hosts** (`/guests`, management; finance sees what to pay): outside teachers and entertainers booked for a session. They show as the session's host in the calendar, on the teacher's Today and in the family timeline. The fee becomes a vendor invoice as soon as the guest is booked, so finance can pay before or after the session. "Mark as done" records that it took place, and cancelling withdraws an unpaid invoice (a paid one is flagged for finance).
- **Surveys:** templates, drafts, a **Log** of every survey sent (responses and history), one live family survey plus one live venue survey.
- **Venue rating link:** "Ask for rating" on a past booking gives a no-login page at `/rate/<token>` (EN/ID). Answers land in Surveys and on the booking.
- **Daily log in rounds:** Lunch (one tap: all / most / half / little / none), each activity session (joined / sat out), then Mood & notes. Families hear about a log once its Mood & notes round is approved.
- **Family app:** Today is a **day story** you can browse back through (day strip and calendar), and **Memories** (`/memories`) recaps each month.
- **Visit insights** (`/insights`, management): overall, by plan, per person and Flex quota use, with busiest days and hours.
- **Tasks** (`/tasks`, every staff role): a tracker of each role's **general duties**, worked out from the data, e.g. a picture of every activity session, the lunch and afternoon-tea photos, the lunch round, arrival checks and everyone checked out. A late duty puts a reminder in that person's bell. Ega's **Team** view scores any day, week or month per role. Under **Manage** she can switch a duty off or change its time, and add her own tasks (daily, weekly or monthly, some needing a photo).
- **Charts and insights** take a custom From / To date range as well as 1M / 3M / 6M / All.
- **Survey templates:** the Venue rating template is built in, so its questions can change but it can't be deleted.
- **Demo photos:** 32 free Unsplash photos (`apps/web/public/demo/`, sources in `SOURCES.md`) of activity sessions, food and club moments. They're scenes only: no member's profile picture is a stranger's face.
- **Daily report** (`/report`, management; `?date=YYYY-MM-DD`, `&view=members`): one page for what was done on any day, today live. A date control (‹ previous open day, date picker, next ›, Today), one summary line ("18 came · 2 trials · 16 lunches · 31 checks · 24 photos") and two views. **Summary**: who came (times, plan, Flex visit n of the quota, extra-day dot, trials and guests), the activities (teacher or guest host, one-day changes with their note, joined and sat-out names, pictures), lunch and tea (menu, allergy alternatives, photos, how much each ate, who ate little), health checks (Watch and Alert with values), mood and the notes written, each role's duty score. **By member**: a row per member with in–out, lunch, activities, mood and the arrival blood pressure (a table on wide screens). Entries still waiting for approval show the usual pending marker. Rules are `rules/dailyReport.ts`; it reads existing helpers and stores nothing.
- **Seed history:** about 6 months of visits, health readings, daily logs and paid invoices for all 45 members (`seed/history.ts`). Round-7 seed data is in `seed/r7/`.

## Architecture
```
packages/shared   types · seed · business rules · actions (pure immer recipes) · permissions · review · notifications · i18n
apps/server       Hono · Drizzle · Postgres · actions pipeline (persist → SSE broadcast) · jobs · demo clock · public form routes
apps/web          React 18 · router · zustand replica (optimistic, reconciled) · primitives · shell · features/<area>
design/           decoded design source + generated reference JSX (read-only)
```
- **Actions run on the server.** Every change is an action that runs on the server (`POST /api/actions/:name`). It is persisted per row and broadcast to every device.
- **The browser runs it first.** The browser runs the same action optimistically, so the UI responds instantly.
- **Family privacy.** Family users receive a privacy-filtered projection: no staff notes, salaries or other members' details.

## Tests
```bash
pnpm test                                   # unit + server tests (Vitest)
pnpm typecheck
pnpm e2e:all                                # every e2e spec in 4 parallel groups against production builds (about 10 minutes)
pnpm e2e:all 4 "phone laptop" family lobby  # choose screen sizes and specs
pnpm exec playwright test e2e/smoke.spec.ts --workers=4 --fully-parallel   # every account × screen × tab in EN and ID (needs a running app)
```
- **Screen sizes:** phone (390), phone360, tablet (1024) and laptop (1440).
- **What every spec checks:** no console errors and no sideways scroll.
- **Smoke spec:** also fails on raw translation keys and on English left on Indonesian screens.
- **Guided demo:** `e2e/demo.spec.ts` plays "Oma Lina's day" from the Demo panel.
