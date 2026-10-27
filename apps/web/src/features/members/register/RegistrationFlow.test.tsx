// KC round 12: one stepped registration for Add member and Join (Person, Family, Health, Plan, Form, Review), Next off until a step is complete,
// the demo's "Use sample form" in place of a real scan, a draft kept on the device, and the lead's online form filling the Join in.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type ClubState } from '@cp/shared';
import { useReplica } from '../../../store/replica';
import { useSession } from '../../../store/session';
import { RegistrationFlow } from './RegistrationFlow';
import { saveDraft } from './draft';
import { initialState } from './steps';

const h = vi.hoisted(() => ({
  act: vi.fn(async (_name: string, _input: unknown, _opts?: unknown) => ({ ok: true as const, result: { memberId: 'm99' } as Record<string, unknown> })),
  upload: vi.fn(async () => ({ mediaId: 'med-sample', fileName: 'registration-form.jpg' })),
  uploadMedia: vi.fn(async (_b: Blob) => 'md_signaturetest0001'),
}));
vi.mock('../../../lib/act', () => ({ useAct: () => h.act }));
vi.mock('../../../lib/media', async (orig) => ({ ...(await orig<typeof import('../../../lib/media')>()), uploadDocument: h.upload, uploadMedia: h.uploadMedia }));
vi.mock('../../../shell/demoAccounts', () => ({ useDemoLogin: () => true, useDemoAccounts: () => [] }));

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  // jsdom draws nothing: a recording 2D context and a canvas that "encodes" a PNG blob
  const g = { beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {}, arc() {}, fill() {} };
  HTMLCanvasElement.prototype.getContext = (() => g) as unknown as HTMLCanvasElement['getContext'];
  HTMLCanvasElement.prototype.toBlob = ((cb: BlobCallback) => cb(new Blob(['png'], { type: 'image/png' }))) as HTMLCanvasElement['toBlob'];
  HTMLCanvasElement.prototype.setPointerCapture = () => {};
  HTMLCanvasElement.prototype.releasePointerCapture = () => {};
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null; host = null;
  document.body.innerHTML = '';
  localStorage.clear();
  h.act.mockClear(); h.upload.mockClear(); h.uploadMedia.mockClear();
  vi.unstubAllGlobals();
});

function openClub(as: 'mgmt' | 'lobby') {
  const state: ClubState = buildSeed().citra;
  const uid = as === 'mgmt' ? 's9' : 's1';
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: uid, name: as === 'mgmt' ? 'Ega' : 'Caca', role: as, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
  return state;
}
async function show(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const textOf = (b: HTMLElement) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim() || b.getAttribute('aria-label') || ''; };
const button = (label: string | RegExp, within: ParentNode = document) =>
  Array.from(within.querySelectorAll<HTMLElement>('button')).find((b) => { const x = textOf(b); return typeof label === 'string' ? x === label : label.test(x); });
const click = async (el: Element | undefined | null) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
async function type(el: HTMLInputElement | null, v: string) {
  expect(el, 'input').toBeTruthy();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v); el!.dispatchEvent(new Event('input', { bubbles: true })); });
}
const flow = () => document.querySelector<HTMLElement>('[data-reg-step]')!;
const next = () => button('Next'); // the footer sits outside the step body
const off = (b: HTMLElement | undefined) => b?.getAttribute('aria-disabled') === 'true';
const input = (name: string) => flow().querySelector<HTMLInputElement>(`input[name="${name}"]`);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('Add member: the stepped flow', () => {
  it('walks the six steps, Next waits for each step, the sample form stands in for a scan, and Create member sends it once', async () => {
    openClub('mgmt');
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) })));
    const onDone = vi.fn();
    await show(<RegistrationFlow mode={{ kind: 'new' }} onDone={onDone} />);
    expect(flow().dataset.regStep).toBe('person');
    expect(off(next())).toBe(true);
    expect(flow().querySelector('[role="alert"]')).toBeNull();
    await click(next()); // shows what is missing, stays here
    expect(flow().dataset.regStep).toBe('person');
    expect(flow().querySelector('[role="alert"]')).toBeTruthy();
    await type(input('name'), 'Ratna Dewi');
    await click(button('Ibu', flow()));
    await click(flow().querySelector('[aria-haspopup="dialog"]'));
    await click(document.querySelector('[data-date="1946-10-14"]'));
    expect(off(next())).toBe(false);
    await click(next());
    expect(flow().dataset.regStep).toBe('family');
    expect(off(next())).toBe(true);
    await type(input('contact'), 'Sari Dewi');
    await type(input('phone'), '0812 5555 0101');
    await click(next());
    expect(flow().dataset.regStep).toBe('health');
    await click(next());
    expect(flow().dataset.regStep).toBe('plan');
    expect(document.querySelector('[data-progress]')?.getAttribute('data-progress')).toBe('4/6');
    expect(off(next())).toBe(true); // no plan picked yet
    await click(Array.from(flow().querySelectorAll<HTMLElement>('[role="radio"]')).find((r) => /^Flex/.test(r.textContent ?? '')));
    expect(off(next())).toBe(false); // the first day is the next Monday already
    await click(next());
    expect(flow().dataset.regStep).toBe('paper');
    expect(off(next())).toBe(true);
    await click(button('Use sample form'));
    await settle();
    expect(h.upload).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/forms/application-1.jpg');
    expect(off(next())).toBe(false);
    await click(next());
    expect(flow().dataset.regStep).toBe('review');
    expect(flow().querySelectorAll('[data-review-group]')).toHaveLength(6);
    expect(flow().querySelector('[data-review-group="health"]')!.textContent).toContain('Dementia (plus Rp 750.000 monthly fee)?'); // not a bare {fee} (round 15)
    await click(button('Edit', flow().querySelector('[data-review-group="family"]')!)); // Edit goes back to that step, and Next straight back to the review
    expect(flow().dataset.regStep).toBe('family');
    expect(button('Next')).toBeUndefined();
    await click(Array.from(document.querySelectorAll<HTMLElement>('button')).filter((b) => textOf(b) === 'Review').pop()); // the footer's (the rail has one too)
    expect(flow().dataset.regStep).toBe('review');
    const create = button('Create member');
    expect(off(create)).toBe(true); // consent to data use first
    await click(flow().querySelector('[role="switch"]'));
    await click(button('Create member'));
    await settle();
    expect(h.act).toHaveBeenCalledOnce();
    const [name, sent] = h.act.mock.calls[0];
    expect(name).toBe('members.create');
    expect(sent).toMatchObject({ title: 'Ibu', name: 'Ratna Dewi', dob: '1946-10-14', plan: 'flex', formMediaId: 'med-sample', formFileName: 'registration-form.jpg', contact: { name: 'Sari Dewi', phone: '+6281255550101' }, consent: { data: true } });
    expect(onDone).toHaveBeenCalledWith('m99');
    expect(localStorage.getItem('cp.reg.new')).toBeNull();
  });
  it('the Health step asks about dementia with the fee in force (round 15)', async () => {
    openClub('mgmt');
    await show(<RegistrationFlow mode={{ kind: 'new' }} onDone={vi.fn()} />);
    await type(input('name'), 'Ratna Dewi');
    await click(button('Ibu', flow()));
    await click(flow().querySelector('[aria-haspopup="dialog"]'));
    await click(document.querySelector('[data-date="1946-10-14"]'));
    await click(next());
    await type(input('contact'), 'Sari Dewi');
    await type(input('phone'), '0812 5555 0101');
    await click(next());
    expect(flow().dataset.regStep).toBe('health');
    expect(flow().textContent).toContain('Dementia (plus Rp 750.000 monthly fee)?');
  });

  it('offers to continue a draft left on this device', async () => {
    const s = openClub('mgmt');
    saveDraft({ kind: 'new' }, { ...initialState(s, { kind: 'new' }, T), name: 'Ratna Dewi' });
    await show(<RegistrationFlow mode={{ kind: 'new' }} onDone={() => {}} />);
    expect(flow().textContent).toContain('Continue where you left off?');
    expect(input('name')?.value).toBe('');
    await click(button('Resume'));
    expect(input('name')?.value).toBe('Ratna Dewi');
    expect(flow().textContent).not.toContain('Continue where you left off?');
  });
  it('on a phone: a full screen with a progress bar', async () => {
    openClub('mgmt');
    const w = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    try {
      await show(<RegistrationFlow mode={{ kind: 'new' }} onDone={() => {}} />);
      expect(document.querySelector('[data-progress]')?.getAttribute('data-progress')).toBe('1/6');
      expect(document.querySelector('.cp-native')).toBeTruthy(); // PhoneScreen
    } finally { Object.defineProperty(window, 'innerWidth', { configurable: true, value: w }); }
  });
});

describe('Join a lead: the same flow, filled in from the online form', () => {
  it('pre-fills the person, shows the lead contact read-only, and sends enquiry.convert', async () => {
    openClub('lobby');
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) })));
    const onDone = vi.fn();
    await show(<RegistrationFlow mode={{ kind: 'lead', id: 'e3' }} onDone={onDone} />);
    expect(input('name')?.value).toBe('Ellen Sutanto');
    expect(input('nickname')?.value).toBe('Oma Ellen');
    expect(off(next())).toBe(false);
    await click(next());
    expect(flow().dataset.regStep).toBe('family');
    expect(flow().textContent).toContain('Kevin Sutanto');
    expect(input('contact')).toBeNull(); // the lead's contact, read-only
    await click(next());
    await click(next());
    expect(flow().dataset.regStep).toBe('plan');
    expect(off(next())).toBe(false); // Flex from the online form, next Monday
    await click(next());
    await click(button('Use sample form'));
    await settle();
    await click(next());
    expect(flow().dataset.regStep).toBe('review');
    await click(button('Send to management · Flex'));
    await settle();
    expect(h.act).toHaveBeenCalledOnce();
    const [name, sent] = h.act.mock.calls[0];
    expect(name).toBe('enquiry.convert');
    expect(sent).toMatchObject({ enquiryId: 'e3', plan: 'flex', formMediaId: 'med-sample', dob: '1948-03-14', registration: { nickname: 'Oma Ellen' } });
    expect(onDone).toHaveBeenCalledWith('m99');
  });
});

describe('Join a lead: a half-filled online form pre-fills too (round 13)', () => {
  it('the person, address and plan come from the saved draft; health stays with the trial day until the family answered it', async () => {
    const st = openClub('lobby');
    const e = st.enquiries.e5;
    const view = { ...st, enquiries: { ...st.enquiries, e5: { ...e, stage: 'trial' as const, form: { token: 'tok-e5', sentAt: `${T}T09:00`, sentBy: 'staff:s1' as const, expiresAt: '2026-11-04T09:00', openedAt: `${T}T09:30`, savedAt: `${T}T09:40`, step: 2, draft: { title: e.senior.title, name: e.senior.name, dob: '1950-04-02', address: 'Jl. Melati 3', contact: { ...e.contact }, plan: 'gold' as const, registration: { nickname: 'Oma Lin' }, health: { conditions: [], diabetic: false, food: [], foodOther: '', drugs: [], mobility: null, diet: [] }, lang: 'en' as const } } } } };
    useReplica.setState({ confirmed: view, view });
    await show(<RegistrationFlow mode={{ kind: 'lead', id: 'e5' }} onDone={() => {}} />);
    expect(input('nickname')?.value).toBe('Oma Lin');
    expect(input('address')?.value).toBe('Jl. Melati 3');
    expect(flow().textContent).not.toContain('Filled in online by'); // only a sent form says so
  });
});

describe('the family signs the form at registration (round 15)', () => {
  const ptr = (type: string, x: number, y: number) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true, buttons: type === 'pointerup' ? 0 : 1, button: 0 });
    act(() => { document.querySelector('canvas')!.dispatchEvent(e); });
  };
  const stroke = () => { ptr('pointerdown', 10, 10); ptr('pointermove', 40, 30); ptr('pointermove', 80, 20); ptr('pointerup', 80, 20); };
  /** a finished registration kept as a device draft: Resume lands on the review */
  async function atReview(mode: { kind: 'new' } | { kind: 'lead'; id: string }, as: 'mgmt' | 'lobby') {
    const s = openClub(as);
    const base = initialState(s, mode, T);
    saveDraft(mode, mode.kind === 'new'
      ? { ...base, title: 'Ibu', name: 'Ratna Dewi', dob: '1946-10-14', contact: 'Sari Dewi', phone: '0812 5555 0101', plan: 'flex', form: { mediaId: 'md_scan0000000001', fileName: 'scan.jpg' }, consentData: true }
      : { ...base, plan: 'flex', form: { mediaId: 'md_scan0000000001', fileName: 'scan.jpg' } });
    await show(<RegistrationFlow mode={mode} onDone={() => {}} />);
    await click(button('Resume'));
    expect(flow().dataset.regStep).toBe('review');
  }
  it('Add member: the pad is labelled with the billing contact; a stroke is uploaded and sent as signatureMediaId', async () => {
    await atReview({ kind: 'new' }, 'mgmt');
    expect(flow().querySelector('[data-reg-sign]')!.textContent).toContain('Sari Dewi signs the form here');
    expect(flow().querySelector('[data-reg-sign]')!.textContent).toContain('Or print the form and sign on paper');
    expect(flow().querySelectorAll('[data-review-group]')).toHaveLength(6);
    stroke();
    await click(button('Create member'));
    await settle();
    expect(h.uploadMedia).toHaveBeenCalledOnce();
    expect(h.act).toHaveBeenCalledOnce();
    const [name, sent] = h.act.mock.calls[0];
    expect(name).toBe('members.create');
    expect(sent).toMatchObject({ name: 'Ratna Dewi', formMediaId: 'md_scan0000000001', signatureMediaId: 'md_signaturetest0001' });
  });
  it('Add member without a stroke: nothing is uploaded and no signatureMediaId is sent (the paper route)', async () => {
    await atReview({ kind: 'new' }, 'mgmt');
    await click(button('Create member'));
    await settle();
    expect(h.uploadMedia).not.toHaveBeenCalled();
    expect(h.act.mock.calls[0][1]).not.toHaveProperty('signatureMediaId');
  });
  it('Join a lead: the same pad, and enquiry.convert gets the signature', async () => {
    await atReview({ kind: 'lead', id: 'e3' }, 'lobby');
    expect(flow().querySelector('[data-reg-sign]')!.textContent).toContain('Kevin Sutanto signs the form here');
    stroke();
    await click(button(/^Send to management/));
    await settle();
    const [name, sent] = h.act.mock.calls[0];
    expect(name).toBe('enquiry.convert');
    expect(sent).toMatchObject({ enquiryId: 'e3', signatureMediaId: 'md_signaturetest0001' });
  });
  it('going back to another step and returning gives an empty pad: an earlier stroke is not sent', async () => {
    await atReview({ kind: 'new' }, 'mgmt');
    stroke();
    await click(button('Edit', flow().querySelector('[data-review-group="family"]')!));
    await click(Array.from(document.querySelectorAll<HTMLElement>('button')).filter((b) => textOf(b) === 'Review').pop());
    expect(flow().dataset.regStep).toBe('review');
    await click(button('Create member'));
    await settle();
    expect(h.uploadMedia).not.toHaveBeenCalled();
    expect(h.act.mock.calls[0][1]).not.toHaveProperty('signatureMediaId');
  });
});
