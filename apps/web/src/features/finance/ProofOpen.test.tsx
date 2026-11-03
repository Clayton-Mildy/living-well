// Round 18: the proof of a payment opens: a photo in the viewer, a PDF in a new tab. A payment from before round 18 has no kind: the server is asked once (HEAD).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '../../store/session';
import { ProofOpen, clearProofKinds } from './ProofOpen';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { useSession.setState({ lang: 'en' }); clearProofKinds(); });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function show(ui: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(ui); });
}
const proof = () => document.querySelector<HTMLElement>('[data-testid="proof-open"]')!;

describe('ProofOpen', () => {
  it('a PDF shows a PDF tile and opens in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await show(<ProofOpen mediaId="md_slip01" kind="pdf" />);
    expect(proof().textContent).toContain('PDF');
    expect(document.querySelector('img')).toBeNull();
    await act(async () => { proof().click(); });
    expect(open).toHaveBeenCalledWith('/api/media/md_slip01', '_blank');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('a photo shows a 38 px thumbnail and opens in the viewer', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await show(<ProofOpen mediaId="md_slip02" kind="image" />);
    const thumb = proof().querySelector('img')!;
    expect(thumb.getAttribute('src')).toBe('/api/media/md_slip02');
    expect(proof().style.width).toBe('38px');
    await act(async () => { proof().click(); });
    expect(document.querySelector('[role="dialog"] img')).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
  });
  it('no kind (a payment from before round 18): HEAD once, application/pdf opens a new tab; the answer is remembered', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const fetchMock = vi.fn(async () => new Response(null, { status: 200, headers: { 'content-type': 'application/pdf' } }));
    vi.stubGlobal('fetch', fetchMock);
    await show(<ProofOpen mediaId="md_old01" />);
    await act(async () => { proof().click(); });
    expect(fetchMock).toHaveBeenCalledWith('/api/media/md_old01', { method: 'HEAD' });
    expect(open).toHaveBeenCalledWith('/api/media/md_old01', '_blank');
    await act(async () => { root!.unmount(); });
    root = createRoot(host!);
    await act(async () => { root!.render(<ProofOpen mediaId="md_old01" />); });
    await act(async () => { proof().click(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(2);
  });
  it('no kind and an image answer opens the viewer; a failed HEAD is treated as a photo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200, headers: { 'content-type': 'image/jpeg' } })));
    await show(<ProofOpen mediaId="md_old02" />);
    await act(async () => { proof().click(); });
    expect(document.querySelector('[role="dialog"] img')).toBeTruthy();
    await act(async () => { root!.unmount(); });
    clearProofKinds();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    root = createRoot(host!);
    await act(async () => { root!.render(<ProofOpen mediaId="md_old03" />); });
    await act(async () => { proof().click(); });
    expect(document.querySelector('[role="dialog"] img')).toBeTruthy();
  });
});
