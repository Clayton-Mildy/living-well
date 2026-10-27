// Round 15, phase 2: every plan picker lists the catalogue's active plans ("Flex 8") and never a retired one ("Private"):
// the registration's Plan step, the profile's Plan tab and its change dialog, the family's plan request, the Next month follow-up sheet, and Insights By plan.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { produce } from 'immer';
import { buildSeed, getUser, projectForFamily, type ClubState, type PlanDef } from '@cp/shared';
import { periodFor, visitInsights } from '@cp/shared/rules/insights';
import { useReplica } from '../store/replica';
import { useSession } from '../store/session';
import { useT, useFmt } from '../lib/i18n';
import { RegistrationFlow } from './members/register/RegistrationFlow';
import { MemberDialog } from './members/dialogs/MemberDialog';
import { PlanTab } from './members/profile/PlanTab';
import type { P } from './members/profile/types';
import { PlanAsk } from './family/PlanCard';
import { FollowUpSheet } from './renewals/FollowUpSheet';
import { ByPlan } from './insights/ByPlan';

const T = '2026-10-21';
const FLEX8: PlanDef = { id: 'plan_1', name: 'Flex 8', nameId: 'Fleks 8', kind: 'days', quota: 8, active: true };
const PRIVATE: PlanDef = { id: 'plan_2', name: 'Private', kind: 'unlimited', active: false };
const catalogue = (): ClubState => produce(buildSeed().citra, (d) => { d.club.settings.plans = [FLEX8, PRIVATE]; });

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
});
beforeEach(() => { (window as unknown as { innerWidth: number }).innerWidth = 800; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null; host = null;
  document.body.innerHTML = '';
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ }
});

const actMock = vi.fn(async (_name: string, _input: unknown, _opts?: unknown) => ({ ok: true as const, result: {} as Record<string, unknown> }));
function openStaff(state: ClubState, uid = 's9', role = 'mgmt') {
  actMock.mockClear();
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: uid, name: 'Staff', role, clubId: 'citra', clubs: ['citra'] } as never });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock as never });
}
async function show(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const click = async (el: Element | null | undefined) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const text = () => document.body.textContent || '';
/** a button's words without its icon glyph */
const label = (b: Element) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim(); };
const btn = (name: string) => Array.from(document.querySelectorAll('button')).find((b) => label(b) === name);

function Tab({ state, memberId, dialog }: { state: ClubState; memberId: string; dialog?: boolean }) {
  const t = useT();
  const fmt = useFmt();
  const me = getUser(buildSeed(), 's9')!;
  const p = { s: state, m: state.members[memberId], today: T, nowMin: 600, t, fmt, lang: 'en', audience: 'staff', family: false, role: 'mgmt', me, mgmt: true, pending: [], mine: [], act: actMock, canEdit: true, isPhone: false, open: () => {}, go: () => {} } as unknown as P;
  return dialog ? <MemberDialog p={p} kind="plan" onClose={() => {}} /> : <PlanTab p={p} />;
}

describe('the plan pickers use the catalogue', () => {
  it('Add member / Join: the Plan step lists Flex 8 with its quota, and not a retired plan', async () => {
    openStaff(catalogue(), 's1', 'lobby');
    await show(<RegistrationFlow mode={{ kind: 'lead', id: 'e3' }} onDone={() => {}} />);
    const next = () => btn('Next');
    for (let i = 0; i < 3; i++) await click(next());
    expect(document.querySelector<HTMLElement>('[data-reg-step]')!.dataset.regStep).toBe('plan');
    const radios = Array.from(document.querySelectorAll<HTMLElement>('[role="radiogroup"] [role="radio"]')).map((r) => r.textContent ?? '');
    expect(radios.some((r) => r.startsWith('Flex 8') && r.includes('8 visits a month'))).toBe(true);
    expect(radios.some((r) => r.startsWith('Flex') && !r.startsWith('Flex 8'))).toBe(true);
    expect(radios.some((r) => r.startsWith('Gold'))).toBe(true);
    expect(radios.some((r) => r.startsWith('Private'))).toBe(false);
  });

  it('the profile Plan tab names a catalogue plan and its quota', async () => {
    const s = produce(catalogue(), (d) => { d.members.m1.plans = [{ from: '2020-01-01', plan: 'plan_1', by: 'staff:s9' }]; });
    openStaff(s);
    await show(<Tab state={s} memberId="m1" />);
    expect(text()).toContain('Flex 8 · 8 visits a month');
  });

  it('the Change plan dialog offers Flex 8 and not a retired plan', async () => {
    const s = catalogue();
    openStaff(s);
    await show(<Tab state={s} memberId="m1" dialog />);
    const chips = Array.from(document.querySelectorAll<HTMLElement>('[role="radio"], button')).map((b) => b.textContent ?? '');
    expect(chips.some((c) => c.startsWith('Flex 8'))).toBe(true);
    expect(chips.some((c) => c.startsWith('Gold'))).toBe(true);
    expect(chips.some((c) => c.startsWith('Private'))).toBe(false);
  });

  it('the family can pick Flex 8 when asking to change the plan, and the request carries it', async () => {
    const full = catalogue();
    const view = projectForFamily(full, 'f1');
    const acts: { name: string; input: unknown }[] = [];
    useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'family', id: 'f1', name: 'Maria', clubId: 'citra' } as never });
    useReplica.setState({ club: 'citra', userId: 'f1', confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async (name: string, input: unknown) => { acts.push({ name, input }); return { ok: true as const, result: {} }; }) as never });
    await show(<PlanAsk m={view.members.m1} />);
    await click(document.querySelector('[data-testid="plan-ask-link"]'));
    const sheet = document.querySelector('[data-testid="plan-sheet"]')!;
    const chips = Array.from(sheet.querySelectorAll('[data-testid="plan-pick"] button')).map((b) => b.textContent);
    expect(chips).toEqual(['Gold', 'Flex 8']); // Oma Lina is on Flex; the retired plan is not offered
    await click(sheet.querySelector('[data-value="plan_1"]'));
    expect(sheet.textContent).toContain('Flex 8: 8 visits a month');
    await click(Array.from(sheet.querySelectorAll('button')).find((b) => b.textContent === 'Send'));
    expect(acts.at(-1)).toMatchObject({ name: 'planChange.request', input: { memberId: 'm1', to: 'plan_1' } });
  });

  it('the Next month follow-up sheet offers a switch to Flex 8, records it with the plan, and never offers a retired plan', async () => {
    openStaff(catalogue(), 's1', 'lobby');
    await show(<FollowUpSheet memberId="m1" month="2026-11" onClose={() => {}} />);
    const chips = Array.from(document.querySelectorAll('button')).map(label);
    expect(chips).toContain('Upgrade to Gold');
    expect(chips).toContain('Switch to Flex 8');
    expect(chips.some((c) => c.includes('Private'))).toBe(false);
    await click(btn('Switch to Flex 8'));
    await click(btn('Save'));
    expect(actMock).toHaveBeenCalledWith('followUp.record', expect.objectContaining({ memberId: 'm1', month: '2026-11', outcome: 'switch', plan: 'plan_1' }));
  });

  it('Insights By plan shows a Flex 8 group', async () => {
    const s = produce(catalogue(), (d) => { d.members.m1.plans = [{ from: '2020-01-01', plan: 'plan_1', by: 'staff:s9' }]; });
    openStaff(s);
    const data = visitInsights(s, periodFor('thisMonth', T), T, { todayDone: true });
    expect(data.plans).toEqual(['flex', 'gold', 'plan_1']);
    await show(<ByPlan data={data} today={T} onOpen={() => {}} />);
    const seg = Array.from(document.querySelectorAll('[role="radio"], [role="tab"], button')).map((b) => b.textContent ?? '');
    expect(seg.some((x) => x.startsWith('Flex 8'))).toBe(true);
    expect(document.querySelector('[data-testid="plan-stats-plan_1"]')).toBeTruthy();
    expect(text()).not.toContain('Private');
  });
});
