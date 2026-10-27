// Round 15 (1): the Attendance calendar shows the check-out wherever it shows the check-in: "In 09:58 · Out 15:30", and "In 09:58" alone while the member is still in.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { buildSeed, type Attendance, type ClubState } from '@cp/shared';
import { useReplica } from '../../../store/replica';
import { useSession } from '../../../store/session';
import { useT, useFmt } from '../../../lib/i18n';
import { AttendanceTab } from './AttendanceTab';
import type { P } from './types';

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});

const att = (date: string, inAt: string, outAt?: string): Attendance => ({
  id: `${date}:m1`, clubId: 'citra', createdAt: `${date}T${inAt}`, createdBy: 'staff:s1', memberId: 'm1', date,
  checkIn: { at: inAt, by: 'staff:s1', method: 'manual' }, ...(outAt ? { checkOut: { at: outAt, by: 'staff:s1', method: 'manual' as const } } : {}),
  queueAdds: [], dismissed: [], edits: [],
});
function Harness({ state }: { state: ClubState }) {
  const t = useT();
  const fmt = useFmt();
  const p = { s: state, m: state.members.m1, today: T, nowMin: 600, t, fmt, lang: 'en', isPhone: false } as unknown as P;
  return <AttendanceTab p={p} />;
}
async function show(lang: 'en' | 'id') {
  // m1's days of October 2026 are replaced by two: the 5th (in and out) and the 6th (still in)
  const state = produce(buildSeed().citra, (d) => {
    for (const k of Object.keys(d.attendance)) if (d.attendance[k].memberId === 'm1') delete d.attendance[k];
    for (const a of [att('2026-10-05', '09:58', '15:30'), att('2026-10-06', '09:58')]) d.attendance[a.id] = a;
  });
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id: 's1', name: 'Staff', clubId: 'citra', role: 'lobby' } as never });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<Harness state={state} />); });
}
const visits = () => Array.from(document.querySelectorAll('[data-visit]')) as HTMLElement[];

describe('Attendance tab', () => {
  it('a day with a check-in and a check-out reads "In 09:58 · Out 15:30"; a day without a check-out reads "In 09:58" only', async () => {
    await show('en');
    const [done, still] = visits();
    expect(done.title).toBe('In 09:58 · Out 15:30');
    expect(done.textContent).toContain('In 09:58');
    expect(done.textContent).toContain('Out 15:30');
    expect(still.title).toBe('In 09:58');
    expect(still.textContent).not.toContain('Out');
  });
  it('in Indonesian', async () => {
    await show('id');
    expect(visits()[0].title).toBe('Masuk 09:58 · Pulang 15:30');
  });
});
