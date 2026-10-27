// One receipt capture for every buyer (round 14 p2): the photo is uploaded and read, the fields and the lines fill in, the buyer checks them and sends.
// The camera, the upload, the reader and the action are mocked; the screen runs against the seed.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type OcrResult, type ReceiptLine } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { ReceiptCapture } from './ReceiptCapture';

const h = vi.hoisted(() => ({ act: vi.fn(), upload: vi.fn(), read: vi.fn(), capture: null as null | ((b: Blob) => void) }));
vi.mock('../../lib/act', () => ({ useAct: () => h.act }));
vi.mock('../../lib/media', async (orig) => ({ ...(await orig<typeof import('../../lib/media')>()), uploadMedia: h.upload }));
vi.mock('../../lib/ocr', () => ({ readReceipt: h.read }));
// no camera in jsdom: the dialog is a single button that hands over a photo
vi.mock('../../components/ui/CameraCapture', () => ({
  CameraCapture: ({ open, onCapture, onClose }: { open: boolean; onCapture: (b: Blob) => void; onClose: () => void }) => {
    h.capture = onCapture; // lets a test hand over two photos without the dialog in between
    return open ? <button type="button" data-testid="shot" onClick={() => { onCapture(new Blob(['x'], { type: 'image/jpeg' })); onClose(); }}>shot</button> : null;
  },
}));

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => {
  h.act.mockReset(); h.upload.mockReset(); h.read.mockReset(); h.capture = null;
  let n = 0;
  h.upload.mockImplementation(async () => `md_${++n}`);
  h.act.mockResolvedValue({ ok: true, result: {} });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});

const line = (id: string, name: string, qty: number, unitPrice: number, category: ReceiptLine['category'] = 'hygiene'): ReceiptLine => ({ id, name, brand: 'Sensi', qty, unit: 'box', unitPrice, amount: qty * unitPrice, category });
const LINES = [line('l1', 'Sarung tangan lateks', 2, 50_000, 'medical'), line('l2', 'Tisu basah', 5, 10_000), line('l3', 'Underpad (isi 10)', 1, 35_000)]; // 185,000
const reading = (over: Partial<OcrResult> = {}): OcrResult => ({ supplier: 'Bersih Prima', source: 'tokopedia', orderNo: 'INV/20261021/MPL/0042', date: '2026-10-20', lines: LINES, total: 185_000, confidence: 0.9, ...over });
function deferred<V>() {
  let resolve!: (v: V) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<V>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

async function show(ui: ReactElement, tweak?: (st: ReturnType<typeof buildSeed>['citra']) => void) {
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's5', name: 'Teacher', role: 'activity', clubId: 'citra', clubs: ['citra'] } });
  const state = buildSeed().citra;
  tweak?.(state);
  useReplica.setState({ club: 'citra', userId: 's5', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const mount = () => show(<ReceiptCapture defaultSectionId="activities" onDone={() => {}} onCancel={() => {}} />);
const textOf = (b: Element) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim(); };
const button = (label: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => textOf(b) === label);
const text = () => document.body.textContent ?? '';
const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
const typeInto = async (el: HTMLInputElement, v: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const supplierInput = () => Array.from(document.querySelectorAll('label')).find((l) => l.querySelector('span')?.textContent === 'Supplier')!.querySelector('input')!;
const totalInput = () => document.querySelector<HTMLInputElement>('input[aria-label="Amount (Rp)"]')!;
const lineRows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-line]'));
const nameInputs = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[aria-label="Item"]'));
const send = () => button('Send to finance')!;
/** Button marks itself off with aria-disabled (it stays focusable). */
const off = (b: Element) => b.getAttribute('aria-disabled') === 'true';
/** Tap "Tap to take the photo" (or Retake), take the shot, and let the upload settle. */
async function snap(retake = false) {
  await click(button(retake ? 'Retake' : 'Tap to take the photo'));
  await click(document.querySelector('[data-testid="shot"]'));
}

describe('ReceiptCapture', () => {
  it('shows "Reading the receipt…" with Send off, then fills the supplier and lists the three lines', async () => {
    const r = deferred<OcrResult>();
    h.read.mockReturnValue(r.promise);
    await mount();
    expect(off(send())).toBe(true);
    await snap();
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.read.mock.calls[0][0]).toBe('md_1');
    expect(text()).toContain('Reading the receipt…');
    expect(off(send())).toBe(true);
    expect(supplierInput().matches(':disabled')).toBe(true); // every field waits for the reader
    await act(async () => { r.resolve(reading()); });
    expect(text()).not.toContain('Reading the receipt…');
    expect(text()).toContain('Filled in automatically: check before sending.');
    expect(lineRows()).toHaveLength(3);
    expect(nameInputs().map((i) => i.value)).toEqual(['Sarung tangan lateks', 'Tisu basah', 'Underpad (isi 10)']);
    expect(supplierInput().value).toBe('Bersih Prima');
    expect(supplierInput().matches(':disabled')).toBe(false);
    expect(totalInput().value).toBe('185.000');
    expect(text()).not.toContain('short of the total');
    expect(off(send())).toBe(false);
  });

  it('a total above the lines is a warning, not a block', async () => {
    h.read.mockResolvedValue(reading({ total: 200_000 }));
    await mount();
    await snap();
    expect(text()).toContain('Items add up to Rp 185.000: Rp 15.000 short of the total');
    expect(off(send())).toBe(false);
  });

  it('a total below the lines says "over the total"', async () => {
    h.read.mockResolvedValue(reading({ total: 180_000 }));
    await mount();
    await snap();
    expect(text()).toContain('Items add up to Rp 185.000: Rp 5.000 over the total');
    expect(off(send())).toBe(false);
  });

  it('clearing a line\'s name turns Send off and marks that line invalid', async () => {
    h.read.mockResolvedValue(reading());
    await mount();
    await snap();
    expect(nameInputs().every((i) => !i.hasAttribute('aria-invalid'))).toBe(true);
    await typeInto(nameInputs()[1], '');
    expect(nameInputs()[1].getAttribute('aria-invalid')).toBe('true');
    expect(nameInputs()[0].hasAttribute('aria-invalid')).toBe(false);
    expect(off(send())).toBe(true);
    await typeInto(nameInputs()[1], 'Tisu');
    expect(off(send())).toBe(false);
  });

  it('Add item appends a blank line (invalid until named) and the remove button drops a line', async () => {
    h.read.mockResolvedValue(reading());
    await mount();
    await snap();
    await click(button('Add item'));
    expect(lineRows()).toHaveLength(4);
    expect(off(send())).toBe(true);
    await click(document.querySelector('button[aria-label="Remove Tisu basah"]'));
    expect(lineRows()).toHaveLength(3);
  });

  it('retaking replaces the lines, and a first read that finishes after the second is ignored', async () => {
    const first = deferred<OcrResult>();
    const second = deferred<OcrResult>();
    h.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await mount();
    await snap();
    await snap(true); // retake while the first is still being read
    expect((h.read.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
    expect(h.read.mock.calls[1][0]).toBe('md_2');
    await act(async () => { second.resolve(reading({ supplier: 'Gramedia Kemang', lines: LINES.slice(0, 2), total: 150_000 })); });
    expect(lineRows()).toHaveLength(2);
    await act(async () => { first.resolve(reading({ supplier: 'Bersih Prima', lines: LINES, total: 185_000 })); });
    expect(lineRows()).toHaveLength(2);
    expect(supplierInput().value).toBe('Gramedia Kemang');
    expect(totalInput().value).toBe('150.000');
  });

  it('an unreadable photo says so, leaves no lines, and the buyer can still fill it in by hand', async () => {
    h.read.mockRejectedValue(new Error('boom'));
    await mount();
    await snap();
    expect(text()).toContain("Couldn't read the receipt. Fill it in by hand.");
    expect(text()).not.toContain('Filled in automatically');
    expect(lineRows()).toHaveLength(0);
    expect(off(send())).toBe(true);
    await typeInto(supplierInput(), 'Warung Bu Tini');
    await typeInto(totalInput(), '45000');
    expect(off(send())).toBe(false);
  });

  it('Send adds the receipt once, with the source, the order number, the lines with their categories and the total field as the amount', async () => {
    h.read.mockResolvedValue(reading({ total: 200_000 }));
    await mount();
    await snap();
    await typeInto(totalInput(), '198000');
    await click(send());
    expect(h.act).toHaveBeenCalledTimes(1);
    const [name, input] = h.act.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe('receipt.add');
    expect(input).toMatchObject({ source: 'tokopedia', orderNo: 'INV/20261021/MPL/0042', supplier: 'Bersih Prima', directoryId: 'd9', amount: 198_000, sectionId: 'activities', date: '2026-10-20', mediaId: 'md_1' });
    const lines = input.lines as ReceiptLine[];
    expect(lines.map((l) => [l.name, l.qty, l.unitPrice, l.amount, l.category])).toEqual([
      ['Sarung tangan lateks', 2, 50_000, 100_000, 'medical'], ['Tisu basah', 5, 10_000, 50_000, 'hygiene'], ['Underpad (isi 10)', 1, 35_000, 35_000, 'hygiene'],
    ]);
  });

  it('a reading dated after today is brought back to today', async () => {
    h.read.mockResolvedValue(reading({ date: '2026-10-25' }));
    await mount();
    await snap();
    await click(send());
    expect((h.act.mock.calls[0][1] as { date: string }).date).toBe(T);
  });
  it('a retake whose read fails starts from a clean form: the first photo\'s supplier and total are gone', async () => {
    h.read.mockResolvedValueOnce(reading()).mockRejectedValueOnce(new Error('boom'));
    await mount();
    await snap();
    expect(supplierInput().value).toBe('Bersih Prima');
    expect(totalInput().value).toBe('185.000');
    await snap(true);
    expect(text()).toContain("Couldn't read the receipt. Fill it in by hand.");
    expect(supplierInput().value).toBe('');
    expect(totalInput().value).toBe('');
    expect(lineRows()).toHaveLength(0);
    expect(off(send())).toBe(true);
  });

  it('a reading with no supplier or total leaves those blank (not the previous photo\'s)', async () => {
    h.read.mockResolvedValueOnce(reading()).mockResolvedValueOnce({ lines: [], confidence: 0.5 });
    await mount();
    await snap();
    await snap(true);
    expect(supplierInput().value).toBe('');
    expect(totalInput().value).toBe('');
    expect(text()).not.toContain('Order no.');
  });

  it('the last photo wins: an upload that finishes after a newer one is ignored, and only the newer photo is read', async () => {
    const u1 = deferred<string>();
    const u2 = deferred<string>();
    h.upload.mockReset();
    h.upload.mockReturnValueOnce(u1.promise).mockReturnValueOnce(u2.promise);
    h.read.mockResolvedValue(reading());
    await mount();
    await click(button('Tap to take the photo'));
    await act(async () => { h.capture!(new Blob(['a'])); h.capture!(new Blob(['b'])); });
    await act(async () => { u2.resolve('md_second'); });
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.read.mock.calls[0][0]).toBe('md_second');
    await act(async () => { u1.resolve('md_first'); });
    expect(h.read).toHaveBeenCalledTimes(1);
    await click(send());
    expect((h.act.mock.calls[0][1] as { mediaId: string }).mediaId).toBe('md_second');
  });

  it('the photo buttons are off while a photo uploads', async () => {
    const u = deferred<string>();
    h.upload.mockReset();
    h.upload.mockReturnValueOnce(u.promise);
    h.read.mockResolvedValue(reading());
    await mount();
    await snap();
    expect(document.querySelector<HTMLButtonElement>('button[aria-busy="true"]')?.disabled).toBe(true);
    await act(async () => { u.resolve('md_1'); });
    expect(button('Retake')?.getAttribute('aria-disabled')).toBeNull();
  });

  it('an upload that finishes after leaving the screen starts no read', async () => {
    const u = deferred<string>();
    h.upload.mockReset();
    h.upload.mockReturnValueOnce(u.promise);
    await mount();
    await click(button('Tap to take the photo'));
    await act(async () => { h.capture!(new Blob(['a'])); });
    await act(async () => { root!.unmount(); });
    root = null;
    await act(async () => { u.resolve('md_1'); });
    expect(h.read).not.toHaveBeenCalled();
  });

  it('Send leaves the order number out when the source is Shop', async () => {
    h.read.mockResolvedValue(reading());
    await mount();
    await snap();
    await click(button('Shop'));
    await click(send());
    const input = h.act.mock.calls[0][1] as Record<string, unknown>;
    expect(input.source).toBe('shop');
    expect('orderNo' in input).toBe(false);
  });

  it('a club with no budget sections says so (Send has nothing to go to)', async () => {
    h.read.mockResolvedValue(reading());
    await show(<ReceiptCapture onDone={() => {}} onCancel={() => {}} />, (st) => { st.budgetSections = {}; });
    expect(text()).toContain('No budget sections yet. Ask finance to add one.');
  });
});
