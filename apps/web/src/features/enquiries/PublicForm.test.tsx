// Round 13 (KC): the family's online registration form as five steps (Who is joining, Family contact, Health, Plan, Review and send) with a
// per-step check, a draft kept on the device and on the lead (the newer wins), and Send as before.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicForm } from './PublicForm';
import { blankOnline, formDraftKey, fromOnline, pickDraft, resumeStep, saveDevice } from './onlineForm';
import type { OnlineRegistration } from '@cp/shared';

const TOKEN = 'tok-abc';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null; host = null;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const lead = (): OnlineRegistration => ({ ...blankOnline(), title: 'Oma', name: 'Rosa Santoso', contact: { name: 'Dina Santoso', relation: 'daughter', phone: '+6281255550101' } });
interface Server { dementiaFee?: number; state?: string; draft?: OnlineRegistration; step?: number | null; savedAt?: string | null; rev?: number; /** a save that comes in with a different `expect` is answered 409 */ strict?: boolean; /** answer the draft POST only when released (a save in flight) */ hold?: boolean }
/** The public routes: GET gives the link, POST …/draft saves, POST … opens or sends. Returns the calls made. */
let release: () => void = () => undefined;
function serve(srv: Server = {}) {
  const calls: { url: string; method: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ url, method, body });
    if (method === 'GET') return { ok: true, status: 200, json: async () => ({ state: srv.state ?? 'sent', club: 'CitraPremier', today: '2026-10-22', draft: srv.draft ?? lead(), step: srv.step ?? null, savedAt: srv.savedAt ?? null, draftRev: srv.rev ?? (srv.savedAt ? 1 : 0), submittedAt: null, expiresAt: '2026-11-05T09:00', prices: { flex: 2500000, gold: 4500000, flexQuota: 8 }, ...(srv.dementiaFee != null ? { dementiaFee: srv.dementiaFee } : {}) }) };
    if (url.endsWith('/draft')) {
      if (srv.hold) await new Promise<void>((r) => { release = r; });
      const cur = srv.rev ?? (srv.savedAt ? 1 : 0);
      if (srv.strict && (body.expect ?? 0) !== cur) return { ok: false, status: 409, json: async () => ({ code: 'enq.err.formConflict', draft: srv.draft ?? lead(), step: srv.step ?? null, savedAt: srv.savedAt ?? null, draftRev: cur }) };
      srv.rev = cur + 1; srv.draft = body.draft as OnlineRegistration; srv.step = body.step as number; srv.savedAt = '2026-10-22T10:00';
      return { ok: true, status: 200, json: async () => ({ ok: true, rev: 5, savedAt: srv.savedAt, draftRev: srv.rev }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, rev: 6 }) };
  }));
  return calls;
}
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[`/form/${TOKEN}`]}><Routes><Route path="/form/:token" element={<PublicForm />} /></Routes></MemoryRouter>); });
  await settle();
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const textOf = (b: HTMLElement) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim() || b.getAttribute('aria-label') || ''; };
const button = (label: string | RegExp, within: ParentNode = document) =>
  Array.from(within.querySelectorAll<HTMLElement>('button')).find((b) => { const x = textOf(b); return typeof label === 'string' ? x === label : label.test(x); });
const click = async (el: Element | undefined | null) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); await settle(); };
async function type(el: HTMLInputElement | null, v: string) {
  expect(el, 'input').toBeTruthy();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v); el!.dispatchEvent(new Event('input', { bubbles: true })); });
}
const stepEl = () => document.querySelector<HTMLElement>('[data-form-step]');
const step = () => stepEl()?.dataset.formStep;
const input = (name: string) => stepEl()?.querySelector<HTMLInputElement>(`input[name="${name}"]`) ?? null;
const drafts = (calls: ReturnType<typeof serve>) => calls.filter((c) => c.url.endsWith('/draft'));
const stored = () => JSON.parse(localStorage.getItem(formDraftKey(TOKEN)) ?? 'null') as { d: { name: string }; step: number; base: number | null; dirty: boolean; lang?: string } | null;

describe('the online form: five steps', () => {
  it('opens on Who is joining with the step bar; Continue waits for the step, then moves on and saves to the lead', async () => {
    const calls = serve();
    await show();
    expect(step()).toBe('who');
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Step 1 of 5 · Who is joining');
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
    expect(button('Back')).toBeUndefined(); // nothing before the first step
    await type(input('name'), '');
    await click(button('Continue'));
    expect(step()).toBe('who'); // the name is needed
    expect(stepEl()?.querySelector('[aria-invalid="true"]')).toBeTruthy();
    expect(drafts(calls)).toHaveLength(0);
    await type(input('name'), 'Rosa Santoso');
    await click(button('Continue'));
    expect(step()).toBe('family');
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Step 2 of 5 · Family contact');
    expect(drafts(calls)).toHaveLength(1);
    expect(drafts(calls)[0].body).toMatchObject({ step: 2, expect: null, draft: { name: 'Rosa Santoso', contact: { name: 'Dina Santoso' } } });
    await click(button('Back'));
    expect(step()).toBe('who');
  });
  it('the family step needs a contact name and a whole phone number', async () => {
    serve();
    await show();
    await click(button('Continue'));
    expect(step()).toBe('family');
    await type(input('contact'), '');
    await type(input('phone'), '0812');
    await click(button('Continue'));
    expect(step()).toBe('family');
    await type(input('contact'), 'Dina Santoso');
    await type(input('phone'), '0812 5555 0101');
    await click(button('Continue'));
    expect(step()).toBe('health');
    await click(button('Continue')); // health asks nothing that must be answered
    expect(step()).toBe('plan');
    await click(button('Continue')); // the plan can stay "not sure yet"
    expect(step()).toBe('review');
  });
  it('the review shows what was typed with Edit links back, and Send posts the answers once, clears the device draft and says thanks', async () => {
    const calls = serve();
    await show();
    await type(input('name'), 'Rosa S');
    for (let i = 0; i < 4; i++) await click(button('Continue'));
    expect(step()).toBe('review');
    const groups = Array.from(document.querySelectorAll('[data-review-group]'));
    expect(groups).toHaveLength(4);
    expect(groups[2].textContent).toContain('Dementia (plus Rp 750.000 monthly fee)?'); // the payload's fee, else the default (round 15)
    expect(document.body.textContent).not.toContain('{fee}');
    expect(document.body.textContent).toContain('Rosa S');
    expect(document.body.textContent).toContain('Dina Santoso');
    await click(button('Edit', groups[0] as HTMLElement));
    expect(step()).toBe('who');
    await click(button('Review'));
    expect(step()).toBe('review');
    await click(button('Send to the club'));
    const sent = calls.filter((c) => c.method === 'POST' && !c.url.endsWith('/draft') && c.body.action === 'submit');
    expect(sent).toHaveLength(1);
    expect(sent[0].body.draft).toMatchObject({ title: 'Oma', name: 'Rosa S', contact: { name: 'Dina Santoso' }, lang: 'en' });
    expect(document.querySelector('[data-testid="public-form-message"]')?.textContent).toContain('Thank you, Dina');
    expect(localStorage.getItem(formDraftKey(TOKEN))).toBeNull();
  });
});

describe('the online form: the dementia question (round 15)', () => {
  it('names the fee from the link\'s own payload', async () => {
    serve({ dementiaFee: 900000 });
    await show();
    await click(button('Continue')); // who -> family
    await click(button('Continue')); // family -> health
    expect(step()).toBe('health');
    expect(stepEl()?.textContent).toContain('Dementia (plus Rp 900.000 monthly fee)?');
    expect(document.body.textContent).not.toContain('affects the monthly fee');
  });
});

describe('the online form: the draft', () => {
  it('is kept on the device as the family types, with the step', async () => {
    serve();
    await show();
    await type(input('name'), 'Rosa Typed');
    expect(stored()).toMatchObject({ d: { name: 'Rosa Typed' }, step: 1, dirty: true });
    await click(button('Continue'));
    expect(stored()).toMatchObject({ step: 2 });
  });
  it('comes back from the device: same step, same answers', async () => {
    serve();
    saveDevice(TOKEN, { d: { ...fromOnline(lead()), name: 'Rosa Device', address: 'Jl. Melati 3' }, step: 3, base: null, dirty: true });
    await show();
    expect(step()).toBe('health'); // Health is step 3 of 5
    expect(document.body.textContent).toContain('Welcome back');
    await click(button('Back'));
    await click(button('Back'));
    expect(input('name')?.value).toBe('Rosa Device');
  });
  it('the lead’s draft wins when it is newer than what this device last saved, and the device wins when it has unsaved typing', async () => {
    const server = { ...lead(), name: 'Rosa Server', address: 'Jl. Server' };
    serve({ state: 'inProgress', draft: server, step: 2, savedAt: '2026-10-22T09:30', rev: 3 });
    saveDevice(TOKEN, { d: { ...fromOnline(lead()), name: 'Rosa Device' }, step: 1, base: 2, dirty: false });
    await show();
    expect(step()).toBe('family'); // resumes at the saved step, 2
    await click(button('Back'));
    expect(input('name')?.value).toBe('Rosa Server');
  });
  it('the device wins when it holds typing and the lead has nothing newer than what it last synced', async () => {
    serve({ state: 'inProgress', draft: { ...lead(), name: 'Rosa Server' }, step: 2, savedAt: '2026-10-22T09:30', rev: 2 });
    saveDevice(TOKEN, { d: { ...fromOnline(lead()), name: 'Rosa Device' }, step: 1, base: 2, dirty: true });
    await show();
    expect(step()).toBe('who');
    expect(input('name')?.value).toBe('Rosa Device');
    expect(document.querySelector('[data-testid="form-conflict"]')).toBeNull();
  });
  it('a phone with unsent typing that opens after another phone saved gets the choice, and nothing is written until it picks', async () => {
    const calls = serve({ state: 'inProgress', draft: { ...lead(), name: 'Rosa Laptop' }, step: 2, savedAt: '2026-10-22T09:30', rev: 3, strict: true });
    saveDevice(TOKEN, { d: { ...fromOnline(lead()), name: 'Rosa Offline' }, step: 1, base: 1, dirty: true });
    await show();
    expect(document.querySelector('[data-testid="form-conflict"]')?.textContent).toContain('This form was continued on another phone');
    expect(document.querySelector('[data-form-step]')).toBeNull();
    expect(stored()).toMatchObject({ d: { name: 'Rosa Offline' }, dirty: true, base: 1 }); // the phone's copy is untouched
    expect(drafts(calls)).toHaveLength(0);
    await click(button('Use the saved one'));
    expect(step()).toBe('family');
    await click(button('Back'));
    expect(input('name')?.value).toBe('Rosa Laptop');
    expect(stored() === null || stored()!.dirty === false).toBe(true);
    expect(drafts(calls)).toHaveLength(0);
  });
  it('Keep this phone’s resends against the lead’s counter and the lead then holds this phone’s answers', async () => {
    const calls = serve({ state: 'inProgress', draft: { ...lead(), name: 'Rosa Laptop' }, step: 2, savedAt: '2026-10-22T09:30', rev: 3, strict: true });
    saveDevice(TOKEN, { d: { ...fromOnline(lead()), name: 'Rosa Offline' }, step: 1, base: 1, dirty: true });
    await show();
    await click(button('Keep this phone’s'));
    await settle();
    expect(step()).toBe('who');
    expect(input('name')?.value).toBe('Rosa Offline');
    expect(drafts(calls)).toHaveLength(1);
    expect(drafts(calls)[0].body).toMatchObject({ expect: 3, step: 1, draft: { name: 'Rosa Offline' } });
    expect(stored()).toMatchObject({ base: 4, dirty: false });
  });
  it('A types, B saves, A continues: a 409 gives the choice and nothing is lost until the family picks', async () => {
    const srv: Server = { state: 'opened', rev: 0 };
    const calls = serve(srv);
    await show();
    await type(input('name'), 'Rosa A typed');
    // phone B saves meanwhile
    srv.draft = { ...lead(), name: 'Rosa B' }; srv.step = 2; srv.savedAt = '2026-10-22T09:50'; srv.rev = 2; srv.strict = true;
    await click(button('Continue'));
    expect(drafts(calls)).toHaveLength(1);
    expect(document.querySelector('[data-testid="form-conflict"]')).toBeTruthy();
    expect(srv.draft.name).toBe('Rosa B'); // not overwritten
    expect(stored()).toMatchObject({ d: { name: 'Rosa A typed' }, dirty: true }); // this phone's typing is still on the phone
    await click(button('Keep this phone’s'));
    await settle();
    expect(drafts(calls)).toHaveLength(2);
    expect(drafts(calls)[1].body).toMatchObject({ expect: 2, draft: { name: 'Rosa A typed' } });
    expect(srv.draft.name).toBe('Rosa A typed');
    expect(document.querySelector('[data-testid="form-conflict"]')).toBeNull();
  });
  it('a saved draft brings back the language it was filled in', async () => {
    serve({ state: 'inProgress', draft: { ...lead(), lang: 'id' }, step: 2, savedAt: '2026-10-22T09:30', rev: 1 });
    await show();
    const idBtn = Array.from(document.querySelectorAll<HTMLElement>('[role="group"] button')).find((b) => b.textContent === 'ID');
    expect(idBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(step()).toBe('family');
  });
  it('Save for later tapped while a push is in flight still ends with "Saved."', async () => {
    const calls = serve({ hold: true });
    await show();
    await type(input('name'), 'Rosa Busy');
    await click(button('Continue')); // push 1 flies (held)
    await click(button('Save for later')); // tapped meanwhile
    expect(button('Saving…')).toBeTruthy();
    await act(async () => { release(); });
    await settle();
    await act(async () => { release(); });
    await settle();
    expect(document.body.textContent).toContain('Saved.');
    expect(drafts(calls).length).toBeGreaterThanOrEqual(1);
  });
  it('an answer to a draft save that comes after Send is ignored (Thanks stays)', async () => {
    const srv: Server = {};
    serve(srv);
    await show();
    srv.hold = true;
    await click(button('Continue')); // a push is in flight
    for (let i = 0; i < 3; i++) await click(button('Continue'));
    expect(step()).toBe('review');
    await click(button('Send to the club'));
    expect(document.querySelector('[data-testid="public-form-message"]')?.textContent).toContain('Thank you');
    await act(async () => { release(); });
    await settle();
    expect(document.querySelector('[data-testid="public-form-message"]')?.textContent).toContain('Thank you');
    expect(localStorage.getItem(formDraftKey(TOKEN))).toBeNull();
  });
  it('Save for later posts the draft to the lead and says it is saved', async () => {
    const calls = serve();
    await show();
    await type(input('name'), 'Rosa Later');
    await click(button('Save for later'));
    expect(drafts(calls)).toHaveLength(1);
    expect(drafts(calls)[0].body).toMatchObject({ step: 1, draft: { name: 'Rosa Later' } });
    expect(document.body.textContent).toContain('Saved.');
    expect(stored()).toMatchObject({ base: 1, dirty: false });
  });
  it('pickDraft and resumeStep: the lead alone, a device alone, in step, newer lead, both changed; never past the first incomplete step', () => {
    const dev = { d: fromOnline(lead()), step: 3, base: 1, dirty: false };
    const srv = (rev: number) => ({ rev, step: 2, draft: lead() });
    expect(pickDraft(null, srv(0))).toMatchObject({ from: 'lead', step: null });
    expect(pickDraft(null, srv(2)).from).toBe('server');
    expect(pickDraft(dev, srv(0)).from).toBe('device');
    expect(pickDraft(dev, srv(1)).from).toBe('device'); // in step with the lead
    expect(pickDraft(dev, srv(2))).toMatchObject({ from: 'server', step: 2 });
    expect(pickDraft({ ...dev, dirty: true }, srv(1)).from).toBe('device');
    expect(pickDraft({ ...dev, dirty: true }, srv(2)).from).toBe('conflict'); // typed here, saved elsewhere
    expect(pickDraft({ ...dev, dirty: true, base: null }, srv(1)).from).toBe('conflict'); // never synced, the lead has one
    const empty = fromOnline({ ...lead(), name: '' });
    expect(resumeStep(fromOnline(lead()), null)).toBe(0);
    expect(resumeStep(empty, 4)).toBe(0); // the name is missing: back to step 1
    expect(resumeStep({ ...fromOnline(lead()), phone: '0812 5555 0101' }, 3)).toBe(2);
  });
});
