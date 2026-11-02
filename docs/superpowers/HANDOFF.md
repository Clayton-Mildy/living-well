# Handoff — where round 16 stands (updated 2 Nov 2026)

Read this first when picking the work up in a new session.

## Done (branch `round16`, not pushed)
- **Phase 1** (spec `specs/2026-10-30-round16-design.md`, plan `plans/2026-10-30-round16-phase1.md`): all 10 tasks, ends at `89cfb6a`. Notice period, family emails + simulated outbox, billing-contact switch, birthday invoices, pick-up and field-trip fees, proof of payment, seed and `e2e/round16p1.spec.ts`.
- **Phase 2** (`plans/2026-10-30-round16-phase2.md`): all 7 tasks plus final-review fixes, `bcb78ee..053be7f`.
  - Owner **Benjamin Cass** (`s11`, login `benjamin` / `citra123`) counts as Management everywhere; only he edits his own row or gives the Owner role.
  - Access grid: `packages/shared/src/rules/access.ts`; the server check is `permit()` in `actions/framework.ts` with `actions/areas.ts`; the web side is `apps/web/src/lib/access.tsx` and `nav.ts`.
  - Admin › Roles screen (`features/mgmt/Roles.tsx`): Owner only.
  - Owner approvals (`actions/ownerGate.ts`): Management's pricing, holiday and weekly-budget changes wait in Approvals › Owner. The seeded request is "Staff training day", Mon 14 Dec.
  - Tests: typecheck clean, vitest 2502 pass, `e2e/round16p1` + `round16p2` pass on phone.

## Rulings made without KC (easy to reverse)
1. Each role keeps its old sidebar grouping. The plan said to use Management's grouping for everyone.
2. A grid cell that is off by default and never set falls back to the action's own `can`, so cross-screen paths still work (e.g. Caca records cash from a member's invoice). The Roles screen shows these cells as "—". Choosing Hidden there stores an explicit off, which blocks the action.
3. On Receipts, Management keeps Snap and can edit or void their own receipts. Only Approve and Reject are removed.

## Next steps
1. Hide the "Add note" form for non-Owners on Benjamin's staff row (`apps/web/src/features/mgmt/People.tsx`, `NotesTab` `addBody`, when `locked`). The server already refuses the save.
2. Reset the dev database so the local demo has Benjamin: `pnpm db:reset` (API on port 8788).
3. Push `round16` and open a PR to `main` once KC agrees.
4. Tell KC:
   - Edit grants on Plans, Budget or Calendar to Finance or Front desk skip owner approval unless their switch is turned on.
   - Duplicate owner requests both wait for Benjamin.
   - About 45 older phone e2e tests (lobby, activity, kitchen, calendar, family…) were already failing before round 16.

## How to run e2e
`E2E_NAME=x E2E_PORT=8921 scripts/e2e-all.sh 1 phone round16p1 round16p2` builds the app and starts isolated servers (demo date 2026-10-21, small seed, Postgres on 5434).
