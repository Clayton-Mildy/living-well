// The lobby lists in a club with many members: the check-in list (members not in yet), the check-out list (members in the club),
// "Gone home", search, paging and the empty states. (The seed has only two members who are not in yet, so the browser tests cannot
// reach a long list.) Also the Check in | Check out switch, and the paging of the guests in "Also today".
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, lobbyGroups } from '@cp/shared';
import { checkoutCandidates, goneHomeRows, manualCandidates } from '@cp/shared/rules/lobby';
import { useReplica, useClub } from '../../store/replica';
import { useSession } from '../../store/session';
import { useT } from '../../lib/i18n';
import { AlsoToday, GUESTS_PER_PAGE, type GuestActions } from './AlsoToday';
import { MemberList, PAGE_SIZE } from './MemberList';
import { ModeToggle, type Mode } from './ModeToggle';

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  picked.length = 0;
  out.length = 0;
});

/** The seed plus `extra` more members who have not checked in (clones of Opa Budi with later usual arrivals). */
function openClub(extra: number, lang: 'en' | 'id' = 'en') {
  const state = buildSeed().citra;
  for (let i = 0; i < extra; i++) {
    const id = `mx${i}`;
    state.members[id] = { ...structuredClone(state.members.m46), id, firstName: `Tester${i}`, lastName: 'Clone', usualArrival: `11:${String(10 + i).padStart(2, '0')}`, consents: [], face: { enrolled: false } };
  }
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
}
/** Check `ids` in (and out, for `leave`) in the replica state. */
function arrive(ids: string[], leave: string[] = []) {
  const s = useReplica.getState().view!;
  for (const id of ids) s.attendance[`${T}:${id}`] = { id: `${T}:${id}`, clubId: 'citra', createdAt: `${T}T09:59`, createdBy: 'staff:s1', date: T, memberId: id, checkIn: { at: '09:59', by: 'staff:s1', method: 'manual' }, ...(leave.includes(id) ? { checkOut: { at: '11:30', by: 'staff:s1', method: 'manual' as const } } : {}), dismissed: [], queueAdds: [], edits: [] };
  useReplica.setState({ confirmed: s, view: s });
}

const picked: string[] = [];
const out: string[] = [];
/** Arrivals' three lists with their own search boxes, wired the way Arrivals wires them. */
function Lists({ which }: { which: 'in' | 'out' }) {
  const t = useT();
  const s = useClub();
  const [query, setQuery] = useState('');
  const g = lobbyGroups(s, T);
  const members = g.inClub.length + g.goneHome.length + g.others.length;
  return which === 'in' ? (
    <MemberList t={t} listId="checkin" title={t('lobby.checkInTitle')} rows={manualCandidates(s, T, query)} total={g.others.length} query={query} onQuery={setQuery}
      empty={{ icon: 'task_alt', title: t(members === 0 ? 'lobby.noMembers' : 'lobby.allIn') }} noMatch={(q) => t('lobby.noMatch', { q })} onOpen={() => undefined} onCheckIn={(id) => picked.push(id)} />
  ) : (
    <>
      <MemberList t={t} listId="inclub" title={t('lobby.inClub')} rows={checkoutCandidates(s, T, query)} total={g.inClub.length} query={query} onQuery={setQuery}
        empty={{ icon: 'chair', title: t('lobby.emptyIn') }} noMatch={(q) => t('lobby.noMatchIn', { q })} onOpen={() => undefined} onCheckOut={(id) => out.push(id)} />
      <MemberList t={t} listId="gonehome" title={t('lobby.goneHome')} rows={goneHomeRows(s, T, query)} total={g.goneHome.length} query={query}
        empty={{ icon: 'home', title: t('lobby.emptyOut') }} noMatch={(q) => t('lobby.noMatchGone', { q })} onOpen={() => undefined} />
    </>
  );
}
async function show(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{node}</MemoryRouter>); });
}
const names = (verb: string) => Array.from(host?.querySelectorAll(`button[aria-label^="${verb}: "]`) ?? []).map((b) => b.getAttribute('aria-label')!.replace(`${verb}: `, ''));
const rows = () => names('Check in');
async function type(value: string, nth = 0) {
  const input = host!.querySelectorAll('input')[nth];
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const nav = () => host?.querySelector('nav');
const pageButton = (label: string) => host!.querySelector(`nav button[aria-label="${label}"]`) as HTMLButtonElement;
const heading = (name: string) => Array.from(host?.querySelectorAll('h2') ?? []).find((h) => h.textContent === name);

describe('check-in list', () => {
  it('with two members not in yet, shows both in usual-arrival order with the count', async () => {
    openClub(0);
    await show(<Lists which="in" />);
    expect(rows()).toEqual(['Opa Budi Wijaya', 'Oma Lina Wijaya']);
    expect(host!.textContent).toContain('Est 10:05');
    expect(host!.querySelector('[data-testid="count-checkin"]')?.textContent).toBe('2');
  });
  it('a long list is paged: PAGE_SIZE rows in usual-arrival order, and a pager to the rest', async () => {
    openClub(18); // 20 members not in yet
    await show(<Lists which="in" />);
    expect(rows()).toHaveLength(PAGE_SIZE);
    expect(rows().slice(0, 2)).toEqual(['Opa Budi Wijaya', 'Oma Lina Wijaya']); // earliest usual arrival first
    expect(host!.textContent).toContain('Est 11:10');
    expect(host!.querySelector('[data-testid="count-checkin"]')?.textContent).toBe('20'); // the count is the whole list, not the page
    expect(nav()).toBeTruthy();
    expect(nav()!.getAttribute('aria-label')).toBe('Pages of Check in a member');
    await act(async () => { pageButton('Next page').click(); });
    expect(rows()).toHaveLength(PAGE_SIZE);
    expect(rows()[0]).toBe('Opa Tester8 Clone'); // the 11th member by usual arrival (10 are on page 1: Budi, Lina, Tester0..7)
    expect(rows()).not.toContain('Opa Budi Wijaya');
    await act(async () => { pageButton('Previous page').click(); });
    expect(rows()[0]).toBe('Opa Budi Wijaya');
  });
  it('a short list has no pager (exactly one page)', async () => {
    openClub(8); // 10 members not in yet = one page
    await show(<Lists which="in" />);
    expect(rows()).toHaveLength(PAGE_SIZE);
    expect(nav()).toBeNull();
  });
  it('searching goes back to page 1 and pages the matches', async () => {
    openClub(18);
    await show(<Lists which="in" />);
    await act(async () => { pageButton('Next page').click(); });
    expect(rows()[0]).toBe('Opa Tester8 Clone');
    await type('tester');
    expect(rows()[0]).toBe('Opa Tester0 Clone'); // back on page 1
    expect(rows()).toHaveLength(PAGE_SIZE);
    expect(host!.querySelector('[data-testid="count-checkin"]')?.textContent).toBe('18 of 20');
    await type('Tester17'); // a single match: one page, no pager
    expect(rows()).toEqual(['Opa Tester17 Clone']);
    expect(nav()).toBeNull();
  });
  it('a search lists matches, shows "n of total", and explains an empty result', async () => {
    openClub(8);
    await show(<Lists which="in" />);
    await type('tester');
    expect(rows()).toHaveLength(8);
    expect(host!.querySelector('[data-testid="count-checkin"]')?.textContent).toBe('8 of 10');
    await type('Tester3');
    expect(rows()).toEqual(['Opa Tester3 Clone']);
    await type('zzz');
    expect(rows()).toEqual([]);
    expect(host!.textContent).toContain('No member matches “zzz”.');
    await type('');
    expect(host!.querySelector('[data-testid="count-checkin"]')?.textContent).toBe('10');
  });
  it('tapping Check in hands the member to the screen', async () => {
    openClub(0);
    await show(<Lists which="in" />);
    await act(async () => { (host!.querySelector('button[aria-label="Check in: Oma Lina Wijaya"]') as HTMLButtonElement).click(); });
    expect(picked).toEqual(['m1']);
  });
  it('with no members at all (an empty clubhouse), it says there is nobody to check in', async () => {
    const adina = buildSeed().adina;
    useSession.setState({ lang: 'en', club: 'adina', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra', 'adina'] } });
    useReplica.setState({ club: 'adina', userId: 's9', confirmed: adina, view: adina, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
    await show(<Lists which="in" />);
    expect(rows()).toEqual([]);
    expect(host!.textContent).toContain('There are no active members yet.');
  });
  it('when everyone is in, it says so', async () => {
    openClub(0);
    arrive(['m1', 'm46']);
    await show(<Lists which="in" />);
    expect(rows()).toEqual([]);
    expect(host!.textContent).toContain('Everyone has checked in today.');
  });
});

describe('check-out list and gone home', () => {
  it('lists the members in the club, each with a Check out button, and an empty "Gone home"', async () => {
    openClub(0);
    await show(<Lists which="out" />);
    expect(names('Check out')).toEqual(['Bapak Bambang Purnomo', 'Opa Hendra Gunawan', 'Opa Tjahjadi Lim']);
    expect(heading('In the club')).toBeTruthy();
    expect(host!.querySelector('[data-testid="count-inclub"]')?.textContent).toBe('3');
    expect(heading('Gone home')).toBeTruthy();
    expect(host!.textContent).toContain('Nobody has gone home yet');
    expect(rows()).toEqual([]); // nobody here can be checked in
  });
  it('Check out hands the member to the screen', async () => {
    openClub(0);
    await show(<Lists which="out" />);
    await act(async () => { (host!.querySelector('button[aria-label="Check out: Opa Hendra Gunawan"]') as HTMLButtonElement).click(); });
    expect(out).toEqual(['m2']);
  });
  it('one search narrows both lists: by name, by family name; and says when nobody matches', async () => {
    openClub(0);
    arrive(['m1'], ['m1']); // Oma Lina came and left
    await show(<Lists which="out" />);
    expect(names('Check out')).toHaveLength(3);
    expect(host!.textContent).toContain('Arrived 09:59 · left 11:30');
    await type('hendra', 0);
    expect(names('Check out')).toEqual(['Opa Hendra Gunawan']);
    expect(host!.textContent).toContain('Nobody who has gone home matches “hendra”.');
    await type('maria', 0); // Oma Lina's daughter: she is on the gone-home list
    expect(names('Check out')).toEqual([]);
    expect(host!.textContent).toContain('Nobody in the club matches “maria”.');
    expect(host!.textContent).toContain('Oma Lina Wijaya');
    await type('');
    expect(names('Check out')).toHaveLength(3);
  });
  it('a long in-club list is paged, and so is Gone home; each pager is named after its list', async () => {
    openClub(24);
    arrive(Array.from({ length: 24 }, (_, i) => `mx${i}`), Array.from({ length: 12 }, (_, i) => `mx${i + 6}`)); // 12 of them have left again
    await show(<Lists which="out" />);
    expect(host!.querySelector('[data-testid="count-inclub"]')?.textContent).toBe('15'); // 3 in the seed + 12 who stayed
    expect(host!.querySelector('[data-testid="count-gonehome"]')?.textContent).toBe('12');
    expect(names('Check out')).toHaveLength(PAGE_SIZE);
    const navs = Array.from(host!.querySelectorAll('nav')).map((n) => n.getAttribute('aria-label'));
    expect(navs).toEqual(['Pages of In the club', 'Pages of Gone home']);
    const goneNav = host!.querySelectorAll('nav')[1];
    await act(async () => { (goneNav.querySelector('button[aria-label="Next page"]') as HTMLButtonElement).click(); });
    expect(host!.textContent).toContain('Arrived 09:59 · left 11:30');
    expect(names('Check out')).toHaveLength(PAGE_SIZE); // the in-club page did not move
  });
});

describe('Also today: guests', () => {
  const noop: GuestActions = { onIn: () => undefined, onOut: () => undefined, onNoShow: () => undefined, onUndoNoShow: () => undefined };
  it(`shows ${GUESTS_PER_PAGE} guests at a time with a pager`, async () => {
    openClub(0);
    const s = useReplica.getState().view!;
    for (let i = 0; i < 10; i++) s.guestVisits[`gx${i}`] = { ...structuredClone(s.guestVisits['g-e2']), id: `gx${i}`, name: `Guest ${String(i).padStart(2, '0')}`, time: `11:${String(10 + i).padStart(2, '0')}` };
    useReplica.setState({ confirmed: s, view: s });
    await show(<AlsoToday guest={noop} />);
    const guests = () => Array.from(host!.querySelectorAll('button[aria-label^="Check in: "]')).map((b) => b.getAttribute('aria-label')!.replace('Check in: ', ''));
    expect(guests()).toHaveLength(GUESTS_PER_PAGE);
    expect(host!.querySelector('nav')?.getAttribute('aria-label')).toBe('Pages of Also today');
    await act(async () => { pageButton('Next page').click(); });
    expect(guests()).toHaveLength(GUESTS_PER_PAGE);
    await act(async () => { pageButton('Next page').click(); });
    expect(guests()).toHaveLength(2); // 12 guests: 5 + 5 + 2
    expect(host!.textContent).not.toMatch(/unread|message/i); // Messages is gone: Also today lists guests only
  });
  it('a trial guest without a time shows "Trial day" and the name with no time, before the timed visit', async () => {
    openClub(0);
    const s = useReplica.getState().view!;
    delete (s.guestVisits['g-e1'] as { time?: string }).time;
    useReplica.setState({ confirmed: s, view: s });
    await show(<AlsoToday guest={noop} />);
    const text = host!.textContent || '';
    expect(text).toContain('Trial day: Oma Siu Lan Tjandra');
    expect(text).not.toContain('10:30');
    expect(text).toContain('14:00'); // the visit keeps its time
    expect(text.indexOf('Trial day: Oma Siu Lan Tjandra')).toBeLessThan(text.indexOf('Visit: Bapak Yusuf Hamid'));
    expect(host!.querySelector('button[aria-label="Check in: Oma Siu Lan Tjandra"]')).toBeTruthy(); // she can still be checked in
  });
  it('a day with a couple of guests has no pager', async () => {
    openClub(0);
    await show(<AlsoToday guest={noop} />);
    expect(host!.querySelector('nav')).toBeNull();
    expect(host!.textContent).toContain('Trial day: Oma Siu Lan Tjandra');
  });
});

describe('number tabs: Not in yet / In the club / Gone home', () => {
  function Switch() {
    const t = useT();
    const [mode, setMode] = useState<Mode>('in');
    return <ModeToggle t={t} mode={mode} counts={{ in: 2, out: 3, gone: 1 }} onChange={setMode} />;
  }
  const tabs = () => Array.from(host!.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
  const selected = () => tabs().map((b) => b.getAttribute('aria-selected'));
  it('has three tabs with their numbers; the selected one is the only tab stop; the names keep "Check in" / "Check out"', async () => {
    openClub(0);
    await show(<Switch />);
    expect(tabs().map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-selected'), b.tabIndex])).toEqual([
      ['Check in · Not in yet (2)', 'true', 0], ['Check out · In the club (3)', 'false', -1], ['Gone home (1)', 'false', -1]]);
    expect(tabs().map((b) => b.querySelector('[data-testid^="tile-"]')?.textContent)).toEqual(['2', '3', '1']);
    expect(host!.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Check in or check out');
  });
  it('clicking a tab selects it; the arrow keys move between the tabs and focus follows', async () => {
    openClub(0);
    await show(<Switch />);
    await act(async () => { tabs()[1].click(); });
    expect(selected()).toEqual(['false', 'true', 'false']);
    tabs()[1].focus();
    await act(async () => { tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(selected()).toEqual(['false', 'false', 'true']);
    expect(document.activeElement).toBe(tabs()[2]);
    await act(async () => { tabs()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    expect(selected()).toEqual(['false', 'true', 'false']);
    expect(document.activeElement).toBe(tabs()[1]);
    await act(async () => { tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); });
    expect(selected()).toEqual(['true', 'false', 'false']);
    await act(async () => { tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
    expect(selected()).toEqual(['false', 'false', 'true']);
    expect(document.activeElement).toBe(tabs()[2]);
  });
  it('speaks Indonesian', async () => {
    openClub(0, 'id');
    await show(<Switch />);
    expect(tabs().map((b) => b.getAttribute('aria-label'))).toEqual(['Check-in · Belum masuk (2)', 'Check-out · Di klub (3)', 'Sudah pulang (1)']);
    expect(host!.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Check-in atau check-out');
  });
});

describe('quiet rows', () => {
  it('a row shows the name, one sub line and one button: no walking-stick / diet tags (they are in the drawer); an allergy shows as a dot item', async () => {
    openClub(0);
    await show(<Lists which="out" />);
    const text = host!.textContent || '';
    expect(text).not.toMatch(/Walker|Walking stick|Wheelchair|Soft food|Low salt/);
    const row = host!.querySelector('button[aria-label="Check out: Opa Hendra Gunawan"]')!.parentElement!;
    expect(row.querySelectorAll('button')).toHaveLength(2); // the name button (opens the drawer) and the one pill button
  });
  it('the check-in list shows an allergy as a dot item (Oma Lina: shellfish)', async () => {
    openClub(0);
    await show(<Lists which="in" />);
    const lina = host!.querySelector('button[aria-label="Check in: Oma Lina Wijaya"]')!.parentElement!;
    expect(lina.textContent).toMatch(/allergy/);
  });
});
