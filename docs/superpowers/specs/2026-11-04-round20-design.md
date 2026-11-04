# Round 20: field trip days work end to end

Date: 4 November 2026. Status: designed with KC in chat and approved from a mockup. Written here for KC's review.
Branch: `round20`, cut from `main` after round 19 was merged and pushed (fb7fbb5).

## Why

KC asked what the app looks like on closed days and field trip days, including tasks and photos. A read-only check of every role found:

- **Closed days are consistent.** Duties, Tasks, the front desk, the nurse, the kitchen, the activity team and the family all show "Club closed". The only gap is that the camera can still take photos.
- **Field trip days are treated as ordinary open days**, which causes these gaps:
  1. Ticking "Who went" doesn't count as a visit, so a trip-only member can be flagged as a few-visits quitter.
  2. The front desk shows a normal day with no trip notice.
  3. "Who went" is a separate manual list, so the fee depends on someone remembering to tick it.
  4. Trip photos reach families only if the member checked in.
  5. Also today and the kitchen show "Menu today" with blank times.
  6. Lunch duties and allergen alerts can run on a day with no club lunch.

KC's answers:
- **Arrivals stays the same:** members check in at the club before the bus and when they come back. The difference is the activities, which the trip replaces.
- **Meals are optional:** the kitchen may record what they'll eat on the trip so families can see it.
- **The nurse is the same as any day:** checks on arrival and before going home.

## Conventions

As in rounds 12–19:
- shared rules and actions, role checks through `can`/`permit()`;
- dense phone-first UI in ink, grey and white, no pastel tints and no filler text, and the tablet must work;
- EN and ID strings;
- an RNG-neutral seed under the size cap;
- minimal tests;
- API port 8788.

**Keep the CPU low** (KC's laptop crashed under load):
- one implementer runs tests at a time;
- `vitest --maxWorkers=2`;
- one e2e group;
- clean up the e2e databases afterwards.

## Design

### 1. Check-in on a trip day puts the member on the trip

- On a day with a field trip (`eventsOn(s, date)` has a `kind 'outing'`), `attendance.checkIn` works as on any open day. It also adds the member to that trip's `wentIds` and creates the trip fee charge, as `calendarEvent.setWent` does.
- Undoing a check-in that day removes the member from `wentIds` and drops their un-invoiced trip charge.
- If several trips fall on one day, the member joins the first trip by start time.
- "Who went" in Calendar stays editable, for someone who joined the bus late or a check-in mistake. It shows the checked-in members ticked.
- Multi-day trips: each day's check-in adds the member to the trip once (one fee per trip, as today).

### 2. A trip counts as a visit day

- `visitDaysOf(s, memberId, month)` is one shared rule: the days with a check-in, plus the days of trips where the member is in `wentIds`.
- Few visits (`fewVisitMembers`) and the Month report visit counts use it.
- Flex quota and extra-day billing keep counting check-ins only, unchanged, so a trip-only tick never bills an extra Flex day.

### 3. Front desk and nurse banner

- On a trip day, Arrivals and the nurse's health station show a banner at the top. It has an ink 1.5 px border, a bus icon, "Field trip today", "{title} · {from}–{to}" and "{n} going", where n is the trip's `wentIds` count.
- Check-in, check-out and health checks work as on any day. Checked-in rows read "{time} · on the trip".

### 4. Optional meals

- On a trip day, `menuOn` returns nothing unless the kitchen added a menu for that date.
- The kitchen's menu page shows the banner "Field trip · menu optional" and an "Add what they'll eat" row. The row creates a one-day menu, using the existing date override: dish lines, free text allowed.
- **When a menu is set:** families see it, lunch duties, the lunch round and allergen alerts run as usual, and lunch photos are expected.
- **When no menu is set:** Also today shows the trip instead of "Menu today", there are no lunch or tea duties, no lunch round and no allergen alerts, and the family timeline has no meal row.

### 5. Activity team, daily log, camera

- Activity Today keeps its "Field trip today" card. No session rounds run; the arrival and going-home mood rounds work as usual.
- Camera: on a trip day the tag picker offers members checked in or in `wentIds`, and photos carry the trip label (as today).
- On a **closed** day `photo.take` is refused with `err.closedDay`, and the camera shows the closed state.

### 6. Family Today on a trip day

- **A parent who checked in, or is in `wentIds`:**
  - the hero reads "On the field trip · {title}";
  - the timeline shows: arrival with mood, then "Field trip · {title}" at its start time, then lunch with the dish if a menu was set, then "Back at the club · going home" at check-out;
  - trip photos tagged to the parent show in Today, Photos, the day strip and memories.
- **A parent who didn't check in:** "stayed home today", as now.

### 7. Seed

- The past seeded trip already ticks Oma Lina and Opa Budi in `wentIds`. Give them check-ins that day if they have none, plus one or two trip photos tagged to them (from the existing stock photos; no new placeholder photos).
- That trip has no meal set, so the optional state shows.

## Testing

**Unit tests:**
- a check-in on a trip day adds the member to `wentIds` and creates the fee charge;
- undoing the check-in removes both;
- `visitDaysOf` counts a trip-only day for few visits but not for Flex billing;
- `menuOn` on a trip day is empty unless a menu is set;
- lunch duties are off on a trip day with no menu and on when one is set;
- `photo.take` is refused on a closed day;
- the family day state on a trip day reads "On the field trip".

**e2e** (`e2e/round20.spec.ts`, phone; screenshots at phone, tablet and laptop):
- Caca sees the trip banner and checks in Oma Lina on the trip day, and "Who went" shows her;
- the kitchen sees "menu optional";
- Maria's Today reads "On the field trip".

## Not in this round

- A separate "boarding" step or bus seat list.
- Trip-specific duties, such as a headcount on the bus.
- A packed-lunch planner.
