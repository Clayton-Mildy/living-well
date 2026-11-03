// Round 18 (Review Focus 4): the family's leave rows use the club's leave notice, not the default 14 days.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { produce } from 'immer';
import { buildSeed, type ClubState } from '@cp/shared';
import { useSession } from '../../store/session';
import { useFmt, useT } from '../../lib/i18n';
import { useFamilyLeave, useLeaveUi } from './LeaveSection';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = host = null;
});

const TODAY = '2026-11-05';
/** Lina (m1) has asked for December and January off; the club's leave notice is `leave` days. */
const club = (leave?: number): ClubState => produce(buildSeed().citra, (d) => {
  if (leave) d.club.settings.notice = { downgrade: 14, stop: 14, leave };
  d.members.m1.memberships.at(-1)!.leaves = [{ month: '2026-12', at: '2026-10-20T09:00', by: 'family:f1' }, { month: '2027-01', at: '2026-10-20T09:00', by: 'family:f1' }];
});
function Family({ s }: { s: ClubState }) {
  const t = useT(), fmt = useFmt();
  return <>{useFamilyLeave({ s, m: s.members.m1, today: TODAY, t, fmt, act: vi.fn() as never, canEdit: true }).rows}</>;
}
function Staff({ s }: { s: ClubState }) {
  const t = useT(), fmt = useFmt();
  return <>{useLeaveUi({ s, m: s.members.m1, today: TODAY, t, fmt, act: vi.fn() as never, canEdit: true, staff: true }).rows}</>;
}
async function show(el: React.ReactElement) {
  useSession.setState({ lang: 'en' } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(el); });
}
const row = (month: string) => host!.querySelector(`[data-testid="leave-row"][data-month="${month}"]`)!.textContent!;

describe.each([['family', Family], ['staff', Staff]])('leave rows (%s)', (_n, View) => {
  it('with leave notice 30, January can be taken back until 2 Dec and December is already confirmed', async () => {
    await show(<View s={club(30)} />);
    expect(row('2027-01')).toContain('until Wed 2 Dec');
    expect(row('2026-12')).toContain('confirmed');
  });
  it('with no setting it is 14 days: January until 18 Dec, December until 17 Nov', async () => {
    await show(<View s={club()} />);
    expect(row('2027-01')).toContain('until Fri 18 Dec');
    expect(row('2026-12')).toContain('until Tue 17 Nov');
  });
});

// Final review I-1: the sheet's sentence says the club's leave days (before the 1st of that month), not a hard-coded 14
function FamilySheet({ s }: { s: ClubState }) {
  const t = useT(), fmt = useFmt();
  const ui = useFamilyLeave({ s, m: s.members.m1, today: TODAY, t, fmt, act: vi.fn() as never, canEdit: true });
  return <>{ui.link}{ui.sheet}</>;
}
function StaffSheet({ s }: { s: ClubState }) {
  const t = useT(), fmt = useFmt();
  const ui = useLeaveUi({ s, m: s.members.m1, today: TODAY, t, fmt, act: vi.fn() as never, canEdit: true, staff: true });
  return <>{ui.button}{ui.sheet}</>;
}
describe.each([['family', FamilySheet], ['staff', StaffSheet]])('leave sheet text (%s)', (_n, View) => {
  it('with leave notice 30 the sheet says 30 days before the 1st', async () => {
    await show(<View s={club(30)} />);
    await act(async () => { (host!.querySelector('button') as HTMLButtonElement).click(); });
    expect(document.body.textContent).toContain('30 days before the 1st of that month');
    expect(document.body.textContent).not.toContain('14 days');
  });
});
