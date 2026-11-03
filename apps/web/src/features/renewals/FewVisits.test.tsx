// Few visits (round 17): the card on Next month, the list, logging a call, and the Also today block on Arrivals.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ClubState } from '@cp/shared';
import { withFewVisits } from '@cp/shared/rules/testFewVisits';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { AlsoToday, type GuestActions } from '../lobby/AlsoToday';
import { Renewals } from './index';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  document.body.innerHTML = '';
  root = null;
  host = null;
});

const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: {} }));
function openClub(today: string, uid = 's1', role = 'lobby', name = 'Caca', state: ClubState = withFewVisits()) {
  actMock.mockClear();
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: uid, name, role, clubId: 'citra', clubs: ['citra'] } as never });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today, startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
}
const Where = () => <span data-testid="where">{useLocation().pathname + useLocation().search}</span>;
async function show(ui: ReactElement, at = '/renewals') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[at]}>{ui}<Where /></MemoryRouter>); });
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const btn = (re: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent || '') || re.test(b.getAttribute('aria-label') || ''));
const card = () => document.querySelector<HTMLElement>('[data-testid="few-card"]');
const cardText = () => card()?.querySelector('[data-testid="few-card-text"]')?.textContent;
const rowIds = () => Array.from(document.querySelectorAll('[data-few]')).map((r) => r.getAttribute('data-few'));
const where = () => document.querySelector('[data-testid="where"]')!.textContent;

describe('the Few visits card on Next month', () => {
  it('reads "Few visits · 6 · 1 called · changes close 17 Nov" from the alert day, and opens the list', async () => {
    openClub('2026-11-15');
    await show(<Renewals />);
    expect(cardText()).toBe('Few visits · 6 · 1 called · changes close 17 Nov');
    expect(card()?.getAttribute('data-phase')).toBe('open');
    expect(document.querySelector('[data-testid="few-list"]')).toBeNull();
    await click(card());
    expect(where()).toBe('/renewals?few=1');
    expect(document.querySelector('[data-testid="few-list"]')).toBeTruthy();
  });

  it('the list has the not-yet-called first, each row says its visits and last visit and has Call and WhatsApp, and the called one is tagged', async () => {
    openClub('2026-11-15');
    await show(<Renewals />, '/renewals?few=1');
    expect(rowIds()).toEqual(['fv6', 'fv4', 'fv2', 'fv3', 'fv1', 'fv5']);
    const row = (id: string) => document.querySelector(`[data-few="${id}"]`)!;
    expect(row('fv2').querySelector('[data-testid="few-visits-line"]')?.textContent).toBe('3 visits · last 4 Nov');
    expect(row('fv5').querySelector('[data-testid="few-visits-line"]')?.textContent).toBe('1 visit · last 4 Nov');
    expect(row('fv6').querySelector('[data-testid="few-visits-line"]')?.textContent).toBe('No visits yet');
    for (const id of rowIds()) {
      expect(row(id!).querySelector<HTMLAnchorElement>('[data-testid="few-call"]')?.getAttribute('href')).toMatch(/^tel:/);
      expect(row(id!).querySelector<HTMLAnchorElement>('[data-testid="few-wa"]')?.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
    }
    expect(row('fv5').querySelector('[data-testid="few-called"]')?.textContent).toContain('Called');
    expect(row('fv6').querySelector('[data-testid="few-called"]')).toBeNull();
  });

  it('a tap on a row opens Log a call; choosing No answer and saving calls visitCall.log', async () => {
    openClub('2026-11-15');
    await show(<Renewals />, '/renewals?few=1');
    await click(document.querySelector('[data-log="fv6"]'));
    expect(document.body.textContent).toContain('Log a call');
    expect(document.querySelector('[data-testid="few-earlier"]')).toBeNull(); // nobody has called Kartika this month
    expect(btn(/Save$/)?.getAttribute('aria-disabled')).toBe('true'); // nothing chosen yet
    await click(btn(/^No answer$/));
    await click(btn(/Save$/));
    expect(actMock).toHaveBeenCalledWith('visitCall.log', { memberId: 'fv6', outcome: 'noAnswer' });
  });

  it('the call sheet lists the earlier calls with who, when and the outcome, and sends the note', async () => {
    openClub('2026-11-15');
    await show(<Renewals />, '/renewals?few=1');
    await click(document.querySelector('[data-log="fv5"]'));
    const earlier = document.querySelectorAll('[data-testid="few-earlier"]');
    expect(earlier).toHaveLength(1);
    expect(earlier[0].textContent).toContain('No answer');
    expect(earlier[0].textContent).toContain('Today 09:30');
    await click(btn(/^Reached$/));
    const note = document.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(note, 'Back from hospital');
      note.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(btn(/Save$/));
    expect(actMock).toHaveBeenCalledWith('visitCall.log', { memberId: 'fv5', outcome: 'reached', note: 'Back from hospital' });
  });

  it('before the alert day the card is grey and says when the list opens, and still opens the list', async () => {
    openClub('2026-11-10');
    await show(<Renewals />);
    expect(cardText()).toBe('Few visits · list opens 15 Nov');
    expect(card()?.getAttribute('data-phase')).toBe('before');
    await click(card());
    expect(document.querySelector('[data-testid="few-list"]')).toBeTruthy();
  });

  it('after the last change day the card keeps its counts and says "changes closed"', async () => {
    openClub('2026-11-20');
    await show(<Renewals />);
    expect(cardText()).toBe('Few visits · 6 · 1 called · changes closed');
    expect(card()?.getAttribute('data-phase')).toBe('closed');
  });

  it('management logs calls too; finance only reads the list', async () => {
    openClub('2026-11-15', 's9', 'mgmt', 'Ega');
    await show(<Renewals />, '/renewals?few=1');
    expect(document.querySelector('[data-log="fv6"]')).toBeTruthy();
    await act(async () => { root?.unmount(); });
    host?.remove();
    openClub('2026-11-15', 's10', 'finance', 'Fransiska');
    await show(<Renewals />, '/renewals?few=1');
    expect(document.querySelector('[data-few="fv6"]')).toBeTruthy();
    expect(document.querySelector('[data-log="fv6"]')).toBeNull();
  });

  it('no card when nobody is flagged', async () => {
    const none: ClubState = { ...withFewVisits(), visitCalls: {}, attendance: Object.fromEntries(Object.entries(withFewVisits().attendance).filter(([, a]) => !a.memberId.startsWith('fv'))) };
    none.members = Object.fromEntries(Object.entries(none.members).filter(([id]) => !id.startsWith('fv')));
    openClub('2026-11-15', 's1', 'lobby', 'Caca', none);
    await show(<Renewals />);
    expect(card()).toBeNull();
  });
});

const noop: GuestActions = { onIn: () => undefined, onOut: () => undefined, onNoShow: () => undefined, onUndoNoShow: () => undefined };
describe('Also today', () => {
  it('on the alert day a "Few visits · 5 to call" block opens the list on Next month', async () => {
    openClub('2026-11-15');
    await show(<AlsoToday guest={noop} />, '/');
    const b = btn(/^Few visits · 5 to call$/);
    expect(b).toBeTruthy();
    await click(b);
    expect(where()).toBe('/renewals?few=1');
  });
  it('no block before the alert day or after the last change day', async () => {
    openClub('2026-11-10');
    await show(<AlsoToday guest={noop} />, '/');
    expect(btn(/Few visits/)).toBeUndefined();
    await act(async () => { root?.unmount(); });
    host?.remove();
    openClub('2026-11-18');
    await show(<AlsoToday guest={noop} />, '/');
    expect(btn(/Few visits/)).toBeUndefined();
  });
});

describe('on a phone', () => {
  it('the list and the call sheet are pushed full screens, and a call still saves', async () => {
    const before = window.innerWidth;
    window.innerWidth = 390;
    try {
      openClub('2026-11-15');
      await show(<Renewals />, '/renewals?few=1');
      expect(document.querySelector('[data-testid="few-list"]')).toBeTruthy();
      expect(document.querySelectorAll('[role="dialog"].cp-native')).toHaveLength(1);
      await click(document.querySelector('[data-log="fv4"]'));
      expect(document.querySelectorAll('[role="dialog"].cp-native')).toHaveLength(2); // the call screen over the list
      await click(btn(/^Staying$/));
      await click(btn(/^Save$/));
      expect(actMock).toHaveBeenCalledWith('visitCall.log', { memberId: 'fv4', outcome: 'staying' });
    } finally {
      window.innerWidth = before;
    }
  });
});
