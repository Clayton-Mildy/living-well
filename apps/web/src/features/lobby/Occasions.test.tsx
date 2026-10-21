// Birthdays and anniversaries (round 12): the "This week" block in the Arrivals rail and the cake on the member row.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, translate } from '@cp/shared';
import { addOpenDays } from '@cp/shared/seed/r7/celebrations';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { AlsoToday, type GuestActions } from './AlsoToday';
import { MemberList } from './MemberList';

const T = '2026-10-21';
const tt = (key: string, vars?: Record<string, string | number | undefined | null>) => translate('en', key, vars);
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); document.body.innerHTML = ''; root = null; host = null; });

const noop: GuestActions = { onIn: () => undefined, onOut: () => undefined, onNoShow: () => undefined, onUndoNoShow: () => undefined };
function setup(today: string) {
  const state = buildSeed(T, 598, { roster: true }).citra;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today, startMin: 598, realStart: Date.now(), offset: 0 } });
  return state;
}
async function show(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{node}</MemoryRouter>); });
}

describe('occasions on Arrivals', () => {
  it('the rail lists Opa Budi turning 80 and the anniversary this week', async () => {
    setup(T);
    await show(<AlsoToday guest={noop} />);
    const block = host!.querySelector('[data-testid="occasions-week"]')!;
    expect(block.querySelector('[data-member="m46"]')!.textContent).toContain('Opa Budi turns 80 on Monday');
    expect(block.textContent).toContain('1 year with the club on Friday');
  });

  it('the list puts a cake on the row of today\'s birthday and on no other day', async () => {
    const s = setup(T);
    const list = () => <MemberList t={tt} title="Check in" rows={[{ m: s.members.m46 }, { m: s.members.m2 }]} total={2} query="" empty={{ icon: 'x', title: 'none' }} noMatch={() => ''} onOpen={() => undefined} listId="in" />;
    await show(list());
    expect(host!.querySelector('[data-testid="occasion-icon"]')).toBeNull();
    await act(async () => { root!.unmount(); });
    host!.remove();
    useReplica.setState({ clock: { today: addOpenDays(s, T, 3), startMin: 598, realStart: Date.now(), offset: 0 } });
    await show(list());
    const icons = host!.querySelectorAll('[data-testid="occasion-icon"]');
    expect(icons).toHaveLength(1);
    expect(icons[0].getAttribute('aria-label')).toBe('Birthday today');
    expect(icons[0].closest('button')!.textContent).toContain('Budi');
  });
});
