// Admin › Settings › Terms and conditions (round 17): the row, the page (text, version line, Not agreed yet) and the editor (EN / ID, Publish with a confirm).
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, execute, getUser, live, type ClubState } from '@cp/shared';
import { termsAgreement } from '@cp/shared/rules/terms';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Settings } from './Settings';

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
const clock = { today: '2026-11-03', startMin: 598, realStart: Date.now(), offset: 0 };
const actMock = vi.fn();
let n = 0;

const V1 = { version: 1, en: '# Billing\n- Invoices are issued on the {issueDay}\nNotice is {noticeDays} days.', id: '# Tagihan\n- Tagihan terbit tanggal {issueDay}', publishedAt: '2026-10-20T09:00', publishedBy: 's9' };
/** A club with terms v1; every contact with a login has agreed except Sinta Halim (f_sinta, daughter of m2). The seed gets terms in Task 10, so the state is built by hand. */
function world(withTerms = true): ClubState {
  const s = structuredClone(buildSeed().citra);
  if (withTerms) s.club.settings.terms = [{ ...V1 }];
  for (const c of Object.values(s.familyContacts)) if (c.username && withTerms) c.termsAgreed = { version: 1, at: '2026-10-21T10:00' };
  s.familyContacts.f_sinta = { id: 'f_sinta', clubId: s.clubId, createdAt: '2026-10-01T09:00', createdBy: 'system', username: 'sinta', name: 'Sinta Halim', firstName: 'Sinta', phone: '+6281200000099', lang: 'en', activatedAt: '2026-10-01T09:00' };
  s.familyLinks['f_sinta:m2'] = { id: 'f_sinta:m2', clubId: s.clubId, createdAt: '2026-10-01T09:00', createdBy: 'system', familyId: 'f_sinta', memberId: 'm2', relation: 'daughter', primary: false, appAccess: true, healthAlerts: true };
  return s;
}
function openClub(state: ClubState, who: 's9' | 's11' = 's9') {
  const user = who === 's9' ? { kind: 'staff' as const, id: 's9', name: 'Ega', role: 'mgmt' as const, clubId: 'citra', clubs: ['citra'] }
    : { kind: 'staff' as const, id: 's11', name: 'Benjamin Cass', role: 'owner' as const, clubId: 'citra', clubs: ['citra'] };
  useSession.setState({ lang: 'en', club: 'citra', user });
  actMock.mockReset();
  useReplica.setState({ club: 'citra', userId: user.id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock, act: actMock } as never);
  actMock.mockImplementation(async (name: string, input: unknown) => {
    const view = useReplica.getState().view!;
    try {
      const r = execute(view, name, input, getUser({ citra: view }, who)!, { today: clock.today, nowMin: clock.startMin }, `tp${++n}`);
      useReplica.setState({ view: r.state } as never);
      return { ok: true, result: r.result, reviewed: r.reviewed };
    } catch (e) { return { ok: false, code: (e as { code: string }).code, params: (e as { params?: Record<string, string> }).params ?? {} }; }
  });
}
async function show(ui: ReactElement, width: number) {
  (window as { innerWidth: number }).innerWidth = width;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={['/settings']}>{ui}</MemoryRouter>); });
}
const setValue = async (el: HTMLTextAreaElement, v: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const section = (name: string) => document.querySelector<HTMLElement>(`section[aria-label="${name}"]`)!;
const buttons = () => Array.from(document.querySelectorAll<HTMLElement>('button'));
const button = (text: string, within: ParentNode = document) => Array.from(within.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent?.trim() === text);
const click = async (el: Element | undefined | null) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const textarea = () => document.querySelector<HTMLTextAreaElement>('textarea')!;
const dialog = (name: string) => document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${name}"]`);
const tab = (text: string) => Array.from(dialog('Edit terms')!.querySelectorAll<HTMLElement>('[role="tab"]')).find((b) => b.textContent?.startsWith(text))!; // the editor's own tabs; the page behind has EN / ID too
const openPage = async () => click(buttons().find((b) => b.getAttribute('data-row') === 'terms'));

describe.each([['phone', 390], ['wide', 1280]])('Terms in Settings (%s)', (_n, width) => {
  it('the Terms row reads the version line with the agreed count, and opens the page', async () => {
    const s = world();
    openClub(s);
    await show(<Settings />, width);
    const a = termsAgreement(s);
    expect(a.total - a.agreed).toBe(1);
    const row = section('Terms and conditions').textContent!;
    expect(row).toContain(`Version 1 · published 20 Oct by Ega · ${a.agreed} of ${a.total} agreed`);
    await openPage();
    expect(document.body.textContent).toContain('Not agreed yet');
  });

  it('the Not agreed yet list shows Sinta Halim with her parent, and only her', async () => {
    const s = world();
    openClub(s);
    await show(<Settings />, width);
    await openPage();
    const list = document.querySelector<HTMLElement>('section[aria-label="Not agreed yet"]')!;
    expect(list).toBeTruthy();
    expect(list.textContent).toContain('Sinta Halim');
    expect(list.textContent).toContain(s.members.m2.firstName);
    expect(live(s.familyContacts).filter((c) => c.username && c.id !== 'f_sinta').some((c) => list.textContent!.includes(c.name))).toBe(false);
  });

  it('a "# Billing" line renders as a heading and a "- " line as a bullet, with the settings filled in', async () => {
    const s = world();
    openClub(s);
    await show(<Settings />, width);
    await openPage();
    const h = Array.from(document.querySelectorAll('h3')).find((x) => x.textContent === 'Billing');
    expect(h, 'Billing heading').toBeTruthy();
    expect(document.body.textContent).toContain(`Invoices are issued on the ${s.club.settings.issueDay}`);
    expect(document.body.textContent).toContain('Notice is 14 days.');
    expect(document.body.textContent).not.toContain('# Billing');
  });

  it('Edit → change the English text → Publish → confirm sends both texts and makes version 2', async () => {
    const s = world();
    openClub(s);
    await show(<Settings />, width);
    await openPage();
    await click(button('Edit'));
    expect(dialog('Edit terms')).toBeTruthy();
    expect(textarea().value).toBe(V1.en); // the raw text, placeholders unfilled
    expect(document.body.textContent).toContain('# heading · - bullet');
    await setValue(textarea(), '# Billing\n- Pay by the due day');
    await click(button('Publish'));
    expect(actMock).not.toHaveBeenCalled(); // the confirm comes first
    expect(document.body.textContent).toContain('Families will be asked to agree again');
    const confirm = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find((d) => d.textContent?.includes('Families will be asked to agree again'))!;
    await click(button('Publish', confirm));
    expect(actMock).toHaveBeenCalledWith('terms.publish', { en: '# Billing\n- Pay by the due day', id: V1.id });
    const terms = useReplica.getState().view!.club.settings.terms!;
    expect(terms).toHaveLength(2);
    expect(terms[1].version).toBe(2);
    expect(dialog('Edit terms')).toBeNull(); // the editor closes
    expect(document.body.textContent).toContain('Pay by the due day');
  });

  it('the Indonesian tab holds its own text', async () => {
    const s = world();
    openClub(s);
    await show(<Settings />, width);
    await openPage();
    await click(button('Edit'));
    await click(tab('ID'));
    expect(textarea().value).toBe(V1.id);
    await setValue(textarea(), '# Tagihan baru');
    await click(tab('EN'));
    expect(textarea().value).toBe(V1.en);
    await click(button('Publish'));
    const confirm = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find((d) => d.textContent?.includes('Families will be asked to agree again'))!;
    await click(button('Publish', confirm));
    expect(actMock).toHaveBeenCalledWith('terms.publish', { en: V1.en, id: '# Tagihan baru' });
  });

  it('empty English text is not sent; the EN tab is marked', async () => {
    openClub(world());
    await show(<Settings />, width);
    await openPage();
    await click(button('Edit'));
    await setValue(textarea(), '   ');
    await click(button('Publish'));
    expect(actMock).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Families will be asked to agree again');
    expect(tab('EN').querySelector('[role="img"]')).toBeTruthy();
    expect(tab('ID').querySelector('[role="img"]')).toBeNull();
    expect(document.body.textContent).toContain('Write the English text');
  });

  it('a refusal that names the Indonesian text marks the ID tab', async () => {
    openClub(world());
    await show(<Settings />, width);
    await openPage();
    await click(button('Edit'));
    await setValue(textarea(), '# Changed');
    actMock.mockImplementationOnce(async () => ({ ok: false, code: 'err.invalid', params: { field: 'id' } }));
    await click(button('Publish'));
    const confirm = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find((d) => d.textContent?.includes('Families will be asked to agree again'))!;
    await click(button('Publish', confirm));
    expect(actMock).toHaveBeenCalledTimes(1);
    expect(dialog('Edit terms')).toBeTruthy(); // stays open
    expect(tab('ID').querySelector('[role="img"]')).toBeTruthy();
    expect(tab('EN').querySelector('[role="img"]')).toBeNull();
  });

  it('closing the editor after a change asks first; Discard keeps the terms as published', async () => {
    openClub(world());
    await show(<Settings />, width);
    await openPage();
    await click(button('Edit'));
    await setValue(textarea(), '# Something else');
    await click(document.querySelector('[role="dialog"][aria-label="Edit terms"] button[aria-label="Close"], [role="dialog"][aria-label="Edit terms"] button[aria-label="Terms and conditions"]'));
    expect(document.body.textContent).toContain('Discard your changes?');
    await click(button('Discard'));
    expect(dialog('Edit terms')).toBeNull();
    expect(actMock).not.toHaveBeenCalled();
  });

  it('with no terms yet: the row says so, and the first Publish makes version 1', async () => {
    openClub(world(false));
    await show(<Settings />, width);
    expect(section('Terms and conditions').textContent).toContain('No terms yet');
    await openPage();
    expect(document.body.textContent).toContain('No terms published yet.');
    await click(button('Write the terms'));
    await setValue(textarea(), '# First');
    await click(button('Publish'));
    const confirm = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find((d) => d.textContent?.includes('Families will be asked to agree again'))!;
    await click(button('Publish', confirm));
    expect(actMock).toHaveBeenCalledWith('terms.publish', { en: '# First', id: '' });
    expect(useReplica.getState().view!.club.settings.terms![0].version).toBe(1);
  });
});
