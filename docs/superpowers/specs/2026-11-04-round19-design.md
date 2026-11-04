# Round 19: editable upgrade and leave rules, one Contacts menu, field trips in the weekly schedule, a Few visits button

Date: 4 November 2026. Status: designed with KC in chat. Both sections were approved from mockups. Written here for KC's review.
Branch: `round19`, cut from `main` after round 18 was merged and pushed (d017afe).

## Why

KC tried round 18 and sent four points:
1. Upgrade and Leave in a row should be editable in Settings › Membership rules.
2. Why have both Contacts and Directory? Make one.
3. A field trip is confusing: it shows in the Calendar list, but the weekly schedule still shows that day's activities.
4. Few visits should be a button on the Next month page that lists the few-visits members, styled differently from the filter chips.

KC's answers:
- Upgrade gets a **notice days** field.
- Leave in a row is a **setting, 2 for now**.
- The merged menu is called **Contacts**.
- On a field trip day, the weekly schedule shows **one trip block** in place of the activities.

What the code showed before designing:
- Contacts and Directory are already **one screen** (`features/finance/Directory.tsx`), reached through two nav keys (`contacts`, `directory`) with two labels. Front desk, nurse, activity and kitchen see "Contacts". Finance and management see "Directory".
- The weekly schedule builder (`features/calendar/ScheduleBuilder.tsx`) never reads calendar events. List, month and year already treat an outing day as "no sessions" (`dayInfo`, `sessionsOn`, `cal.err.dayOuting`). The builder still shows the day's activity cells, and that mismatch is the confusion.

## Conventions

As in rounds 12–18:
- Shared immer actions live in `packages/shared/src/actions` and pure rules in `rules`. Role checks run server-side through `can` and `permit()`.
- The UI is dense and phone-first with 44 px targets: ink, grey and white on the warm staff skin. No pastel tints and no descriptive filler text. Phones use iOS grouped lists, and tablets must work.
- Every string exists in EN and ID.
- The seed stays RNG-neutral, `CP_SEED_SMALL=1` keeps working, and club state stays under the 7,500,000-character cap.
- Tests stay minimal: typecheck, unit tests for new rules and actions, one e2e spec on phone, and screenshots at phone, tablet and laptop.
- The API dev port is 8788 (never 8787).

## 1. Upgrade notice days

- `NOTICE_KINDS` gains `'upgrade'`. `ClubSettings.notice.upgrade` takes 1–60 days and defaults to **1**: an upgrade for December is asked by 30 Nov, the same as today.
- The deadline is the 1st of the month minus the upgrade days, inclusive, the same formula as the other kinds. `inTime` for an upgrade becomes `today <= noticeDeadline(s, month, 'upgrade')`. `noticeCheck` reports the upgrade's days.
- Unchanged:
  - Moving back to the plan in force the day before still needs no notice. `changeKind` already calls that an `'upgrade'`, and it must keep working whatever the upgrade days are, so the take-back case stays separate from a real upgrade.
  - Management's direct plan change from the member dialog may still start an upgrade today.
- Settings: the Upgrade row gets the number field and a live "starts the next 1st · ask by {date}" line, like the other rows. It is one of the notice kinds, so Management's change waits for the Owner ("Upgrade · N days" in the approval).
- The terms placeholder `{upgradeDays}` is added.

## 2. Leave in a row as a setting

- `ClubSettings.leaveMaxMonths` takes 1–6 and defaults to **2**. `leaveMaxMonths(s)` replaces the constant `LEAVE_MAX_MONTHS` everywhere:
  - `leaveCheck` (`err.leaveMax`);
  - `leaveOverrunMonth`;
  - `leaveMonthsCheck`;
  - the `followUp.record` parse;
  - Settings;
  - LeaveSection's `{max}`.
- The places that assume 2 without the constant follow the setting too:
  - `leaveMonthChoices` offers up to `leaveMaxMonths` months;
  - `leaveNeedsWord` asks for word when the next month would go over the setting;
  - the copy in `family.leaveWord`, `notif.leaveOverrun` (EN and ID) and their staff versions uses `{max}`.
- The rule stays: after the last allowed month with no word, the daily job ends the membership (`endReason 'leaveOverrun'`). It follows the setting.
- Settings: the Leave in a row row gets a number field, "months", with the line "no word after that ends the membership". It goes through the owner gate like notice days.
- Terms: the placeholder `{leaveMaxMonths}` is added. The seeded terms v1 says "up to {leaveMaxMonths} months in a row" (EN and ID). It stays version 1.

## 3. One Contacts menu

- The nav key `directory` is retired, and `contacts` is the only key. Every role whose menu or link list had `directory` gets `contacts` in the same place:
  - finance in its Club group;
  - management and the Owner in their menu.
- Label: **Contacts** / **Kontak**.
- The access grid (round 16/17) stores cells per menu key. A stored `directory` cell is read as `contacts`, keeping the more permissive value: Edit beats View beats Hidden. Roles then shows one Contacts row. The menu count drops by one, from 32 to 31.
- Search: one Contacts screen entry with the keywords of both ("contacts, directory, suppliers, doctors, phone numbers"). Supplier records open `/contacts?q=<name>`.
- `/directory` redirects to `/contacts` so old links keep working.
- The screen and its rules don't change:
  - front desk, finance and management can edit;
  - nurse, activity and kitchen see public entries read-only;
  - the family page `fcontacts` is unchanged.

## 4. Field trips in the weekly schedule

- **Builder grid**: for each date column, if `eventsOn` has an outing that day, the column shows one **trip block** across the activity rows. The block has a bus icon, "Field trip", the title, "{from}–{to}" and "no sessions". The day header reads "Fri 6 · Field trip". Lunch and afternoon tea rows skip that day. The block opens the trip in the event editor for those who may edit events, and is read-only for everyone else.
- The template's activities for that weekday are kept and only hidden for that date. They come back if the trip moves or is deleted.
- "Add an activity" isn't offered on a trip day (the server already refuses with `cal.err.dayOuting`).
- A multi-day trip blocks each of its days in the weeks it covers.
- **Publish note**: publishing a week that has a trip day shows a one-line note in the publish confirm: "Fri 6 Nov is a field trip: no sessions". It warns only; it doesn't block.
- List, month, year and the family calendar already hide sessions on a trip day and need no change.

## 5. Few visits as a button on Next month

- The full-width `FewVisitsCard` above the tabs is removed.
- On the **Members** tab, a **Few visits** button sits first in the chip row, then a thin divider, then the plan chips.
- **Style**: an ink button with a phone icon and a chevron, a rounded rectangle of 10 px radius, distinct from the round outlined filter chips. Before the alert day it is grey.
- **Text by phase**, from the round 18 window:
  - before: "Few visits · opens {alertDay}";
  - open: "Few visits · {n}", with " · {c} called" once anyone is called;
  - closed: "Few visits · {n} · {c} called".
- **Tap**: it opens the existing `FewVisitsSheet` (the drawer on wide screens, a full screen on phone), with the call log and "Called" tags as today. The `?few=1` deep link (notification, Also today) still opens it.
- **Visibility**: shown for the current and next month only, not for past months. It hides when nobody is flagged (round 17 ruling).

## Testing

- **Unit:**
  - upgrade notice: the default is 1 day, so 30 Nov for December; with 5 days, an upgrade on 27 Nov is late and gives `err.noticeLate` with days 5; the take-back case still needs no notice;
  - `leaveMaxMonths` 3: three months in a row are allowed, a fourth is refused, and the job ends the membership after the third with no word;
  - the access grid reads a stored `directory` cell as `contacts` (the more permissive value);
  - the builder shows a trip block on an outing date and no cells there;
  - the publish note;
  - the Few visits button's text per phase, and that it opens the sheet;
  - the terms placeholders are filled.
- **e2e** (`e2e/round19.spec.ts`, phone; screenshots at phone, tablet and laptop):
  - Benjamin sets Upgrade 3 and Leave in a row 3 in Settings;
  - Fransiska and Caca each see one Contacts menu item;
  - the weekly schedule shows the Bogor trip block on its day;
  - the Next month Few visits button opens the list.
- Existing specs and tests that use `/directory`, the `directory` key, `LEAVE_MAX_MONTHS` or the old few-visits card are updated.

## Not in this round

- Choosing whether an upgrade starts right away or the next 1st.
- A Field trips list page.
- Merging member family contacts into the Contacts screen.
