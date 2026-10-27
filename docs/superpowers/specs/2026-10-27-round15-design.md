# Round 15: what KC asked for after the round 14 walk-through

Date: 27 October 2026. Status: the first 8 points were designed with KC in chat and approved; the 13 added points are written here for KC's review.

## Why

KC walked through the round 14 build and listed what still gets in the way of the operations team's day: reviewing the programme where it is planned, plans that aren't only Flex or Gold, seeing who continues next month, check-out times, the nanny and family faces, closed days at a glance, and a set of smaller fixes in the family app, the front desk, the directory and the kitchen.

KC's answers that shaped the scope:
- Custom memberships are a **reusable catalogue** (not one-off deals), with two types: **days per month** (a quota; extra days charged) or **unlimited**.
- Birthdays stay as they are: a notification 14 days ahead (front desk, activity, management) plus the lobby and activity Today lists. This round only shows where to find them in the demo.
- Round 14 is merged into main (A–E); DOKU (D4) stays deferred.

## Conventions

As in rounds 12–14:
- shared immer actions in `packages/shared/src/actions`, pure rules in `rules`;
- role checks server-side through `can`;
- dense phone-first UI, 44 px targets, ink, grey and white with the warm staff skin, no pastel tints;
- every string in EN and ID;
- family edits go through approvals;
- seed RNG-neutral, `CP_SEED_SMALL=1` working, club state under the 7,500,000-character cap at the real date and at 2026-12-30;
- minimal tests (typecheck, unit tests for new rules and actions, one e2e pass per phase).

## Phase 1 — the day-to-day fixes

### 1. Check-out wherever check-in shows
- **Insights:**
  - Overall: a departures-by-hour chart next to arrivals-by-hour.
  - By plan: average departure next to average arrival.
  - Person detail: average departure and the departure time on the trend.
- **Member profile → Attendance:** each day reads "In 09:58 · Out 15:30" (and the tooltip too).
- **Family app:**
  - Me: "At the club since 10:00" or "Went home 15:40".
  - The day's timeline ("That day") shows the check-out row with its time on past days and today once they've gone home.
- Any other arrival-only spot found while building is fixed the same way. The lobby's "Arrived {t}" while someone is still in stays as is.

### 2. Past activities look done in the family timeline
In the family day timeline, a session that has already happened shows the brown "done" line, whatever the member did. Today it shows only for some sessions, such as the Angklung ensemble on 26 Oct. Upcoming items keep the neutral line.

### 3. Search on phones: a floating button
- On phones the search opens from a round button in the floating stack at the bottom right, at the top of that stack:
  - above the Tasks button (Caca);
  - above the camera button (Dinar);
  - still above Tasks where a page has its own add button, e.g. Members.
- It opens the search as a modal sheet. The top-bar icon goes away; the laptop sidebar field and ⌘K stay.

### 4. "Haven't come lately": choose how long
- The Check on list (members who've gone quiet) gets a "Not seen for" dropdown in its header: **Automatic** (today's rule, 10–14 days from each member's usual gap), or 7, 14, 21 or 30 days.
- The choice is kept on the device.

### 5. Enquiry source "Other" asks where from
Choosing **Other** as an enquiry's source shows a short text field ("Where from?"). It is saved with the enquiry and shown in the lead's details and history.

### 6. The nanny at the door and in the members list
The lobby's arrival rows and the Members list rows show the member's nanny, with the photo and name, next to the member, so staff can recognise who brought them. Rows without a nanny show nothing extra.

### 7. The nanny among the family, and family photos
- The staff Family tab and the family app's Family section list the nanny as a row: photo, name, phone, "Nanny".
- `FamilyContact` gains a photo:
  - the front desk and management upload it on the member's Family tab;
  - families upload their own and the nanny's in the family app, and these wait for approval like other family edits.
- Avatars show the photo wherever a family contact appears.

### 8. Members "In the club": filter by plan
The Members list's In the club filter gets a plan dropdown (All plans, then each active plan from the catalogue). The count line follows it.

### 9. Lunch round: a smaller photo area
The F&B Lunch round's photo area becomes a compact strip: small thumbnails and an Add photo button. People's lunch rows move up the screen.

### 10. Dementia question wording
In the registration form and the online form, the dementia question reads "Dementia (plus Rp {fee} monthly fee)?". The fee comes from Plans and pricing → Extra charges; ID: "Demensia (tambahan Rp {fee} per bulan)?".

### 11. Year view summary and closed days
- **Year view:** under the 12 months, a list of the year's days when the club is closed or away. Each entry shows the date (or range), the reason (holiday name, club closure, outing) and the number of days. Tapping an entry opens that day.
- **Month calendar:**
  - Closed days (holidays and club closures) get one restrained marker: a warm sand fill and the reason as text. Weekends without a programme stay plain, so the two no longer look alike.
  - Outings keep their own marker, because the club is away that day.

### 12. Next month: every member and their plan
- A new first list on Next month shows each active member with their plan for next month.
  - The default is "Continues". A member with a change recorded anywhere shows it: → {plan}, On leave, or Stops.
  - A dropdown filters All / Continues / Changing, with a count line on top ("38 continue · 4 change").
- Tapping a member opens the existing Record a change sheet with that member already chosen.
- Changes and Unpaid stay as they are.

## Phase 2 — the bigger features

### 13. Reviewing the programme inside the Calendar
- When the activity team sends a weekly schedule or a one-day change, management reviews it in the Calendar:
  - The schedule builder draws the **proposed** week. Each changed slot shows before (struck through) → after. Approve and Return (with a reason) buttons sit on the waiting bar.
  - Day and week views show a pending day's proposed programme, marked "Proposed", with before → after. Approve and Return are in the day sheet.
- The activity team sees its own proposal the same way, without the buttons.
- Approvals keeps working, through the same actions.
- **Seed:** the week two weeks after the demo date has no activities. The normal programme resumes the week after, so the activity team can plan a week live in the demo.

### 14. Custom membership plans (a catalogue)
- **The catalogue:** Plans and pricing gets a Plans list, edited by management. A plan has:
  - a name in EN and ID;
  - a type: **Days per month** with a quota (1–23), or **Unlimited**;
  - a monthly price that changes from a chosen date, like the price list today;
  - an Active switch.
- **Flex and Gold** are the catalogue's first two plans. Their prices stay in the price list, so existing invoices don't change. **Quick add:** "Start from Flex" or "Start from Gold" prefills type, quota and price.
- **Every plan picker** lists the active plans: Add member and Join a lead, the profile Plan tab, the family's plan change request, Next month's Record a change, and renewals follow-ups.
- **Billing:**
  - It charges the plan's own monthly price, prorated as today.
  - A days plan uses its own quota; extra days are charged at the club's extra-day price.
  - Invoice lines and every screen show the plan's name.
- **Retiring a plan:** a retired (inactive) plan leaves the pickers, and members on it keep it.
- Insights, the Members filter (point 8) and Next month group by plan.

### 15. Sign at registration
- The last step of Add member and Join a lead gets a signature pad. The family member who is present signs the membership form there; it is the same pad as the family app's.
- The signature fills the signature boxes when the form is printed.
- The member's membership form is recorded as **signed in person**: signer = the billing contact, form snapshot = the registration data. It then goes to management's countersign in Approvals and the e-Meterai stamp, exactly like a form signed online.
- Skipping the pad keeps today's paper route (print, sign, scan).

### 16. Directory grouped by category
- **The use case:** the AC breaks. Open Contacts, find the "AC" group, call the first vendor, and if they can't come, call the next one in the same group.
- Contacts are grouped by category, with a call button on each contact.
  - The category list is editable by the front desk, finance and management: add, rename, retire. It is seeded with service groups such as AC and electrical, plumbing, transport and medical, alongside the purchasing groups.
  - Each contact can sit in one category.
  - A search or the category dropdown narrows the list.
- Suppliers keep their **spending category** for Spending (round 14 C3). The directory category is a separate, free grouping for finding someone to call.

### 17. Dish photos
- Each dish in the kitchen's dish library can have a photo, uploaded by the kitchen and management.
- The dish photo shows:
  - in the menu plan;
  - in the staff calendar's day view;
  - in the family app's tomorrow timeline;
  - in the family calendar.
- On the day, once F&B uploads a lunch photo, that photo replaces the dish photo for that day.

## Testing
Per phase:
- typecheck;
- unit tests for the new rules and actions (plan catalogue pricing and quota, the Next month plan list, closed-day summary, Check on threshold, signing at registration, directory categories, dish photo choice);
- one e2e pass of the phase's main story on a phone viewport.

## Out of scope
- DOKU (D4).
- Per-member one-off plan deals.
- A pay-per-visit plan type.
- Birthday tasks.
- Real image recognition for dish photos.

## Assumptions to confirm in review
1. Sign at registration counts as **signed in person**, so it still goes to management's countersign and the e-Meterai stamp (point 15).
2. The directory category is separate from a supplier's spending category (point 16).
3. The phone top-bar search icon is replaced by the floating button (point 3).
4. The "Not seen for" choice is per device, not a club setting (point 4).
5. The last line of KC's message ("meiciivurkanuvrow enoa iei neua theis aunownv uanfnr a") looked like accidental typing and is not in this spec; KC to say if it was meant to be a request.
