# CitraPremier (living-well) — every round, your inputs and what was built

Compiled 22 Oct 2026 from the session notes. "You said" = KC's asks and decisions; "Built" = what landed.

## Round 1 — the first build (5 Oct)
**You said:** build the CitraPremier ops app from the Claude Design prototype; fix its ~100 audited bugs; phone first then tablet then laptop, no pauses; real Postgres; EN + ID; small seed; integrations (WhatsApp, Xero, DOKU, LEPU PC-303, face recognition) simulated. **Correction:** attendance is drop-in — members come any open day, any time; no "expected today", bookings, escorts or running-late. Flex = 10 visits a month from real check-ins, extra day after that on next month's invoice; Gold unlimited.
**Built:** pnpm monorepo (React + Vite web, Hono server, Drizzle + Postgres, shared immer actions with SSE live sync); 5 scripted members; management reviews non-management profile edits; notification bell per role; the logo.

## Round 2 — login and approvals (6 Oct)
**You said:** username + password login (first names, `citra123`); management lands on Arrivals; every non-management photo needs approval; health station lists all members (no queue); custom dropdowns, date pickers, pagination; a notify toggle on every publish; real camera with uploads; demo clock = real Jakarta time.
**Built:** all of it (brief in docs/ROUND2.md).

## Round 3 — health station, profile photo, names (6 Oct)
**You said:** nothing is "due" at the health station; one form, one complete measurement saves; auto-wait for the PC-303; nurse/management edit Watch/Alert limits; care log with inline daily log; member profile photo (front desk's change goes to review); staff renamed Ega (mgmt), Caca (lobby), Dinar (activity); one clubhouse; demo date = today; trials are day passes.
**Built:** all of it; guided demo hidden.

## Round 4 — v3 premium restyle (6 Oct)
**You said:** restyle the whole app to Prototype v3 ("the old UI felt like a notebook"); look only, our features win; later "white grey-ish" page instead of cream.
**Built:** new tokens, type, cards, shell, per-screen layouts; quiet rows (only the allergy dot); ink primary buttons.

## Round 5 — smaller UI, paper registration, approvals for everything (6 Oct)
**You said:** UI zoom .8 (.875 on phones); strip helper text; 45 members in the demo; members list shows subscription start/end; subscriptions month to month; registration on paper only with a required scan; everything non-management staff enter needs management approval and is hidden from families until approved, one approval tab per type with bulk approve/reject.
**Built:** all of it (`projectForFamily` redaction, ChangeRequest machinery).

## Round 6 — native phone look and a long list (7 Oct)
**You said (client):** the phone "still looks like a dashboard". **You chose:** iOS grouped lists, native top bar, keep the floating tab bar, keep "All modules" sheet (icon grid tried and rejected), phone-only changes; "Also today" above the camera; Family Today without photo/plan cards (plan line under the name); teachers can't change the schedule; Today as a progress bar; no in-app Messages (WhatsApp instead); kitchen feedback replies shown in the family app; approvals per person; activity images; laptop pages full width; activity photos as their own kind; emergency button built then removed (Contacts everywhere instead); member health limits; brochure prices and billing calendar (invoice 21st, due 28th, hold on the 1st, stop on the 3rd), leave rules, printed application form with answers overlaid; front desk sees Menu read-only; F&B has no Stock page; Join as member asks the form questions.
**Built:** all of it. **Still open from then:** the first bill for members starting after the 21st; whether the 21st invoice bills the current or coming month; the extra-day price is a sample.

## Round 7 — operations depth (8–9 Oct)
**You said:** Renewals page (Caca records, Ega approves, applies from the 1st); charts with tap/hover dates and custom ranges; one-day activity change; surveys with templates, drafts and log; venue renters rate via a no-login link; daily log in rounds (lunch, per-session activity, mood & notes); guest hosts linked to sessions, paid before performing; family day story + monthly Memories; Insights (overall / by plan / per person / membership later); Tasks as a duty TRACKER per role with late reminders, Ega can switch duties off or retime; 6-month seed history; free Unsplash photos for scenes only, members keep initials; quick camera "shoot first, sort later" with simulated AI drafts; photo type = head count; housekeeping and driver roles removed; schedule editable from today with extra sessions; renewals "Call back" removed; daily report.
**Built:** all of it. **Open:** a renewal "stop" approved after its last day is refused.

## Round 8 — family app redesign (13–14 Oct)
**You said:** redesign the family app from the Family App prototype, phone first: tabs Today · Photos · Calendar · Health · Me; immersive Today header from your own mock; family edits go to approvals; Instagram-style story; desktop = sidebar + wide pages; white desktop page for every role; then (8c) the prototype's desktop colours for all roles — grey card sidebar, #F4F4F5 fills, hairlines, layouts stay; then (8e) "the colour looks dead, add soft colours" → built, then **rolled back**: "not premium, it used to be simple and elegant"; controls get a thin edge + soft shadow (kept).
**Built:** all of it, with the pastel pass removed. Lesson kept: no pastel tints.

## Round 9 — v4 warm management skin, schedule builder (14–15 Oct)
**You said:** use the v4 MANAGEMENT design's colours for all staff (family stays white/grey): espresso floating sidebar, serif titles, cream page (you tried white and rolled it back); preview one screen then roll out to every page; schedule builder: tap an empty slot to pick an activity, touch drag; Insights Membership tab, drop "Net change".
**Built:** all of it (`data-skin=warm`, ~810 colour literals converted).

## Round 9b — family: fewer taps (16 Oct)
**You said (reviewer):** too many taps. Scope = family only. Approved stock portraits for the 5 demo parents; no blank placeholder images; member page "like Today".
**Built:** Photos as a swipeable feed with gallery toggle, big cards on Today, the hero picture grows to full screen and swipes through recent photos, one-tap parent switch, Tomorrow chip, back-gesture and swipe-down close, portraits for 5 parents.

## Round 10 — phone review items (19–21 Oct)
**You said:** the hero keeps the parent's own picture first with a swipe hint; Photos date filter with quick picks (not month chips); staff quick-tasks popup beside the camera; save to gallery and long-press multi-select; UX analysis quick fixes (last-visit card, week dots, stale readings muted, tab labels, text size); online registration link restored as a PRE-FILL for the paper form; dementia Yes/No on registration; NIK and carer fields with KTP uploads; day strip = visit days only.
**Built:** all of it. **Proposed, not built:** web push / add-to-home-screen, messaging the team, weekly digest, onboarding, Indonesian by device.

## Round 11 — two parents, video limits (21 Oct)
**You said:** improve navigation between the two parents; video clips up to 60 s / 100 MB.
**Built:** one ParentSwitch on Today/Photos/Calendar/Health with a shared selection, tiny faces on calendar cells, the limits raised. **Also asked:** what real photo AI would cost → estimate: Rekognition for faces + Claude for scenes, under ~$20/month to run, ~2 weeks to build.

## Round 12 — the owner's priorities (21–22 Oct)
**Context:** your boss had you and a colleague each build the app; the owner reviews both. **You chose:** build all, roll back later if needed. Mood as 5 faces at check-in/out, health form and per session; nickname as the display name; "Check on" welfare calls; front desk Venue + Celebrations (visitor book and call log declined); one stepped registration flow with a sample form; Month report with "Send to owner"; birthdays/anniversaries; Mood insight; Undo on photo send (incident log and owner digest declined).
**Built:** all of it, reviewed, on main.

## Round 13 — after your midnight walk-through (22 Oct)
**You said:** quick wins first, the rest after the review. Decisions: lobby plan change from next month as a management-approved request + record cash/transfer payment reviewed by finance (invoices stay finance); lobby surveys = send the live family survey + see results; Month report hero numbers with 6-month sparklines; People Attendance tab → Leave (5 days a year, any staff asks with a reason, management approves); "section the plan and pricing better" = the Manage → Plans page (clarified this morning: Plans / Extra charges / One-off fees / Changes / preview). This morning you also: freed the disk when it filled; merged round 12 + phase 1 into main.
**Built, phase 1 (on main):** renames "Health attention" / "Haven't come lately"; approvals bottom bar; title "Other"; lobby duty counts; guest hosts for the front desk; portraits for all 40 members.
**Built, phase 2 (branch round13, final step running):** Plans page sections; lead history + History view; front-desk plan change + payment recording with finance confirmation; Month report hero tiles; lobby surveys; staff leave with a Leave tab (Attendance kept as "Hours").
**My rulings for you to confirm:** gender guessed from the title; Check-ins duty done once anyone is in; demo-day guest takes over the 10:30 slot on non-Wednesdays; revenue hero tile says "so far this month" instead of a delta on a partial month; monthly lead rows count what happened that month, conversion = leads opened in the 3 months before; the Hours tab kept; "N of 5 days left" counts approved leave only.

## Standing preferences you gave along the way
Questions before building; phone first (90% of users on phones), dense UI with no descriptions and key numbers only; small clean seed; minimal testing for demos (typecheck + unit + one e2e pass); no pastel tints; soft unclipped hovers; API on 8788 (8787 belongs to another project). Full detail per round: `docs/superpowers/specs/` and `docs/superpowers/plans/`.
