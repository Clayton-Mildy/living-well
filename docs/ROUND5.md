# Round 5: approvals for everything, paper registration, subscriptions (KC, 2026-10-06)

Read `docs/ROUND4-DESIGN.md` for the visual language (Prototype v3). It still applies to every new UI.

**The UI is CSS-zoomed.** `global.css` sets `html { zoom: .8 }` (`.875` on phone). Any code that reads DOM coordinates must divide by `uiZoom()` (from `components/ui`).

## A. Management approves everything staff enter
KC: "turns out all of the things need to be approved by manager, including daily log, health care, etc. so management need to separate each approval and should be able to do bulk approve/reject".

**Rules**
- Anything a non-management staff member creates or changes in the covered types is **pending** until management approves it.
- **Families don't see pending entries.** Staff still see them, with a small "Pending approval" dot-and-text marker.
- **Management's own entries are approved at once** (same as `isMgmt` in `actions/framework.ts`).
- **Family notifications wait for approval.** That covers the log-saved notice, the reading notice, the health-alert chat message, the menu-published notice and the photo notice; send them when management approves.
- **Staff alerts stay immediate.** For safety, a health ALERT reading still notifies the nurse and management straight away.
- **Rejecting needs a reason.** A rejected entry is never shown to the family, and the author gets a notification with the reason.
- **Approved, then edited by non-management:** it goes back to pending. Families keep seeing the last approved version (store an approved snapshot, or keep the previous values) until the edit is approved.

**Covered types.** Each one gets its own tab in the management Approvals screen.
1. **Profile changes:** the existing ChangeRequests (gate sections) and today's post-review "flag" sections (allergies, medicines, care, health).
   - Flag sections still apply immediately for staff, because the kitchen needs allergies at once.
   - In `projectForFamily`, any field with a pending postReview CR shows the family its `from` value until it is acknowledged.
   - For management, "acknowledge" is this tab's approve and "revert" is its reject.
2. **Daily logs (care log):** `DailyLog` entries, plus family-visible `MemberNote`s written by staff.
3. **Health readings:** `Reading`s saved by the nurse.
4. **Photos:** the existing `visibility: 'pending'` flow, moved into this hub.
5. **Menu:** `menu.publish` (weekly `MenuVersion`) and `dayMenu.override` (`DayMenu`) by kitchen staff. Families see the last approved menu.
6. **Stock:** existing `StockRequest`s with status `requested`. Show them in the hub with bulk approve/reject. Keep the existing approvers (finance, kitchen supervisor) able to approve from the Stock screen as today.

**Approvals screen** (management only; it replaces or extends `apps/web/src/features/members/Reviews.tsx`, nav key `reviews`, renamed "Approvals")
- **Tabs:** one per type, each with a pending count. A History tab lists handled items.
- **Rows:** v3 quiet rows, each with a checkbox. Each row shows:
  - who and when;
  - the member;
  - a short summary of the entry, or the old → new diff for profile changes;
  - an expandable full view.
- **Bulk actions:** "Select all" and "Clear", then Approve (N) and Reject (N). Reject asks for one reason that applies to all selected. They sit in a sticky bar, like today's Photos tab.
- **Single actions:** per-row Approve and Reject stay.
- **Server-side bulk:** add bulk actions in shared, either one generic `approval.approve {type, ids[]}` / `approval.reject {type, ids[], reason}` or one per type. Each must be a single server action, so one SSE update covers the whole batch. Items already handled or stale are skipped and reported back.
- **Badge and notification:** the nav badge counts all pending items. Management gets a notification when items are waiting, batched rather than one per entry.

**Family-side hiding** happens on the server in `packages/shared/src/project.ts` (`projectForFamily`). Also check the client rules that families use: `latestLog`, the family `CareTab`/`HealthTab` through `MemberProfile audience="family"`, `menuOn`, `isFamilyPhoto`. They must not show pending items if a family snapshot ever contained them.

## B. Registration is on paper only
KC: "we cant do online registration, the registration needs to be on paper, so can have upload document on the registration file or paper".
- **Remove the online form:**
  - the `/form/:token` route and `MembershipForm` screen, and `SignaturePad`;
  - the "Send form" buttons (Enquiries, profile Docs tab);
  - the DemoPanel "Family membership form" link.
  - Remove or retire the `form.*` actions and `/api/form` endpoints as well, and fix the tests that use them.
- **Enquiry → member conversion and Add member:**
  - Staff type in the key details from the paper, as today.
  - They must attach the signed paper registration form: a photo through `CameraCapture`, or a PDF/image file picker. It uploads through `lib/media.ts` → `POST /api/media` (allow `application/pdf`, up to 10 MB).
  - The member's documents get `membershipForm` `onFile` with a `mediaId`. Add `mediaId?: string` to `MemberDocument`.
- **Profile Docs tab:**
  - Each document type gets Upload / Replace (photo or file) and View: images open in a viewer, PDFs in a new tab via `/api/media/:id`.
  - "Request via form" goes away.
  - A non-management upload follows the existing docs review rule.
- **Seed:** existing members keep their `membershipForm` `onFile`. Without a `mediaId`, View shows "Paper copy on file".

## C. Members list: subscription start and end, sortable
KC: "member list should show when they start the subs and when it will end, this can be sorted". Subscriptions are month to month: at each month's end the family continues, upgrades, downgrades or freezes.
- **Start** is the current `Membership.start`.
- **End** is the current period's end: the last day of this month. If the membership is ending, it is `lastDay`; for ended members it is the `lastDay` they had.
- **Row display:** add to the sub line as quiet text, e.g. "Since 12 Mar 2025 · Renews 31 Oct", "Ends 31 Oct" for ending members, and "Ended 30 Sep" for ended ones.
- **Sort control** (a `Select`, phone friendly): Name (default), Start date (newest/oldest), End date (soonest). Keep the filters.
- **Rules:** add `subStart`/`subEnd` helpers in `packages/shared/src/rules/members.ts` with unit tests. Add i18n keys in EN and ID (`packages/shared/src/i18n/{en,id}/*.ts`).

## General
- All strings go through `t()`, in both EN and ID.
- Keep accessible names, roles and test ids where the feature survives.
- Update unit tests in your area, and e2e specs where your change intentionally alters behaviour.
- **Don't run e2e, start servers or use the browser.** The lead does that.
- **Verify** with `pnpm -s typecheck`, `pnpm -s lint` and `pnpm vitest run <your folders>`.
- **Report back:** files changed, new actions or fields, anything you were unsure about.
