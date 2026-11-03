// Family tab (round 15): a contact's photo shows on its row, and the member's carer is listed after the contacts (photo, name, phone, "Carer (suster)").
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { buildSeed, getUser, type ClubState } from '@cp/shared';
import { useReplica } from '../../../store/replica';
import { useSession } from '../../../store/session';
import { useT, useFmt } from '../../../lib/i18n';
import { useAct } from '../../../lib/act';
import { FamilyTab } from './FamilyTab';
import type { P } from './types';

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});

function Harness({ state, memberId, uid, role }: { state: ClubState; memberId: string; uid: string; role: string }) {
  const t = useT();
  const fmt = useFmt();
  const doAct = useAct();
  const me = getUser(buildSeed(), uid)!;
  const p = { s: state, m: state.members[memberId], today: T, nowMin: 600, t, fmt, lang: 'en', audience: 'staff', family: false, role, me, mgmt: role === 'mgmt', pending: [], mine: [], act: doAct, canEdit: true, isPhone: false, open: () => {}, go: () => {} } as unknown as P;
  return <FamilyTab p={p} />;
}
const acts: { name: string; input: unknown }[] = [];
async function show(state: ClubState, memberId = 'm1', uid = 's1', role = 'lobby') {
  acts.length = 0;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: uid, name: 'Front desk', clubId: 'citra' } as never });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async (name: string, input: unknown) => { acts.push({ name, input }); return { ok: true as const, result: {} }; }) as never });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><Harness state={state} memberId={memberId} uid={uid} role={role} /></MemoryRouter>); });
}

describe('Family tab: photos and the carer', () => {
  it('round 15 follow-up: the nanny has her own card under the family card, headed "Nanny", with name, phone, call, WhatsApp and the note', async () => {
    const s = produce(buildSeed().citra, (d) => { d.members.m1.nanny = { name: 'Mbak Sari', phone: '+6281211112222', note: 'Agency: Kasih Ibu, Mon–Wed' }; });
    await show(s);
    const card = document.querySelector('[data-testid="fam-nanny"]')!;
    expect(card).toBeTruthy();
    expect(card.textContent!.startsWith('Nanny')).toBe(true); // the heading
    expect(card.textContent).toContain('Mbak Sari');
    expect(card.textContent).toContain('Agency: Kasih Ibu, Mon–Wed');
    expect(card.textContent).toMatch(/812.?1111.?2222/);
    expect(card.querySelector('a[href="tel:+6281211112222"]')).toBeTruthy();
    expect(card.querySelector('a[href^="https://wa.me/"]')).toBeTruthy();
    const contacts = Array.from(document.querySelectorAll('[data-testid="fam-contact"]'));
    expect(contacts.length).toBeGreaterThan(0);
    for (const c of contacts) expect(card.contains(c)).toBe(false);
    expect(contacts.every((c) => !c.closest('[data-testid="fam-nanny"]'))).toBe(true);
    expect(contacts.at(-1)!.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(contacts.at(-1)!.parentElement!.contains(card)).toBe(false); // not in the family card
  });
  it('no carer, no carer row', async () => {
    await show(buildSeed().citra, 'm2');
    expect(document.querySelector('[data-testid="fam-nanny"]')).toBeNull();
  });
  it('a contact with a photo shows it on the row; the carer\'s photo shows too', async () => {
    const s = produce(buildSeed().citra, (d) => { d.familyContacts.f1.photoMediaId = 'md_contactphoto01'; d.members.m1.nanny = { name: 'Mbak Sari', photoMediaId: 'md_carerphoto0001' }; });
    await show(s);
    const f1Row = document.querySelector('[data-testid="fam-contact"][data-family-id="f1"]')!;
    expect(f1Row.innerHTML).toContain('md_contactphoto01');
    expect(document.querySelector('[data-testid="fam-contact"][data-family-id="f2"]')!.innerHTML).not.toContain('md_');
    expect(document.querySelector('[data-testid="fam-nanny"]')!.innerHTML).toContain('md_carerphoto0001');
  });
});

describe('round 17: Make billing contact', () => {
  const rowOf = (id: string) => document.querySelector(`[data-testid="fam-contact"][data-family-id="${id}"]`)!;
  const makeBtn = (id: string) => Array.from(rowOf(id).querySelectorAll<HTMLElement>('button')).find((b) => (b.textContent ?? '').includes('Make billing contact'));
  it('finance sees the button on Daniel\'s row, none on the billing contact; confirming runs family.setPrimary', async () => {
    await show(buildSeed().citra, 'm1', 's10', 'finance');
    expect(makeBtn('f1')).toBeUndefined();
    const b = makeBtn('f2')!;
    expect(b).toBeDefined();
    await act(async () => { b.click(); });
    expect(acts).toHaveLength(0); // asks first
    expect(document.body.textContent).toContain('Make Daniel the billing contact? Unpaid invoices move to Daniel.');
    const go = Array.from(document.querySelectorAll<HTMLElement>('button')).filter((x) => (x.textContent ?? '').trim() === 'Make billing contact').at(-1)!;
    await act(async () => { go.click(); });
    expect(acts).toEqual([{ name: 'family.setPrimary', input: { memberId: 'm1', familyId: 'f2' } }]);
  });
  it('cancelling the confirm runs nothing', async () => {
    await show(buildSeed().citra, 'm1', 's1', 'lobby');
    await act(async () => { makeBtn('f2')!.click(); });
    await act(async () => { Array.from(document.querySelectorAll<HTMLElement>('button')).find((x) => (x.textContent ?? '').trim() === 'Cancel')!.click(); });
    expect(acts).toHaveLength(0);
  });
  it('activity staff get no button', async () => {
    await show(buildSeed().citra, 'm1', 's5', 'activity');
    expect(document.querySelectorAll('[data-testid="fam-contact"]').length).toBeGreaterThan(1);
    expect(document.body.textContent).not.toContain('Make billing contact');
  });
  it('a contact waiting for approval has no button', async () => {
    const s = produce(buildSeed().citra, (d) => { for (const l of Object.values(d.familyLinks)) if (l.familyId === 'f2' && l.memberId === 'm1') l.review = { status: 'pending', crId: 'cr1' }; });
    await show(s, 'm1', 's10', 'finance');
    expect(rowOf('f2')).toBeTruthy();
    expect(makeBtn('f2')).toBeUndefined();
  });
});
