// The public rating page: a renter opens the link, sees their event and the venue survey, rates, and gets a thank-you; the link is checked
// by the server (here a stand-in for fetch). Already answered, closed and unknown links show a friendly message.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useSession } from '../../store/session';
import { RatePage } from './RatePage';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
const INFO = {
  state: 'open', club: 'CitraPremier',
  booking: { org: 'PT Arunika Farma caregiver seminar', contactName: 'Ibu Santi Wirjo', date: '2026-10-24', from: '09:00', to: '13:00', room: 'Whole club', roomNameId: 'Seluruh klub' },
  survey: { title: 'Venue rating', questions: ['overall', 'recommend', 'comment'], custom: [{ id: 'q1', kind: 'yesno', text: 'Was the room ready on time?', required: true }, { id: 'q2', kind: 'text', text: 'What could we do better?', required: false }] },
};
const posts: { url: string; body: Record<string, unknown> }[] = [];
function serve(get: { status: number; body?: unknown }, post: { status: number; body?: unknown } = { status: 200, body: { ok: true } }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const isPost = init?.method === 'POST';
    if (isPost) posts.push({ url, body: JSON.parse(String(init?.body)) });
    const r = isPost ? post : get;
    return { ok: r.status < 400, status: r.status, json: async () => r.body ?? {} } as Response;
  }));
}
beforeEach(() => { posts.length = 0; useSession.setState({ lang: 'en', user: null }); });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});
async function show(ui: ReactElement, at = '/rate/tok123') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[at]}><Routes><Route path="/rate/:token" element={ui} /></Routes></MemoryRouter>); });
  await act(async () => { await Promise.resolve(); });
}
const textOf = (b: HTMLElement) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim() || b.getAttribute('aria-label') || ''; };
const button = (label: string | RegExp) => Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => { const x = textOf(b); return typeof label === 'string' ? x === label || b.getAttribute('aria-label') === label : label.test(x); });
const click = async (el: Element | undefined) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const body = () => document.body.textContent ?? '';

describe('the public rating page', () => {
  it('shows the event and the survey, asks for the stars and required answers, sends once and says thank you', async () => {
    serve({ status: 200, body: INFO });
    await show(<RatePage />);
    expect(body()).toContain('How was your event at CitraPremier?');
    expect(body()).toContain('PT Arunika Farma caregiver seminar');
    expect(body()).toContain('Whole club');
    expect(body()).toContain('09:00–13:00');
    expect((document.querySelector('input[name="name"]') as HTMLInputElement).value).toBe('Ibu Santi Wirjo'); // the booking's contact
    expect(button('Send my rating')?.getAttribute('aria-disabled')).toBe('true');
    await click(button('5 of 5'));
    expect(button('Send my rating')?.getAttribute('aria-disabled')).toBe('true'); // the yes or no is required
    await click(Array.from(document.querySelectorAll<HTMLElement>('[data-q="q1"] button')).find((b) => textOf(b) === 'Yes'));
    expect(button('Send my rating')?.getAttribute('aria-disabled')).toBeNull();
    await click(button('Send my rating'));
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe('/api/public/rate/tok123');
    expect(posts[0].body).toMatchObject({ name: 'Ibu Santi Wirjo', overall: 5, recommend: null, comment: '', answers: { q1: true } });
    expect(body()).toContain('Thank you, Ibu Santi Wirjo');
    expect(body()).not.toContain('Send my rating');
  });
  it('already answered, closed, and an unknown link each get a friendly message', async () => {
    serve({ status: 200, body: { ...INFO, state: 'answered' } });
    await show(<RatePage />);
    expect(body()).toContain('You have already sent your rating');
    await act(async () => { root?.unmount(); }); host?.remove();
    serve({ status: 200, body: { ...INFO, state: 'closed' } });
    await show(<RatePage />);
    expect(body()).toContain('This rating is closed');
    await act(async () => { root?.unmount(); }); host?.remove();
    serve({ status: 404, body: { code: 'err.notFound' } });
    await show(<RatePage />);
    expect(body()).toContain('This link is not valid');
    expect(body()).not.toContain('Send my rating');
  });
  it('an answer sent twice (someone else answered meanwhile) shows the thank-you, not an error; the language switch is local to the page', async () => {
    serve({ status: 200, body: INFO }, { status: 422, body: { code: 'mgmt.err.alreadyAnswered' } });
    await show(<RatePage />);
    await click(button('4 of 5'));
    await click(Array.from(document.querySelectorAll<HTMLElement>('[data-q="q1"] button')).find((b) => textOf(b) === 'Yes'));
    await click(button('Send my rating'));
    expect(body()).toContain('You have already sent your rating');
    await click(button('ID'));
    expect(body()).toContain('Anda sudah mengirim penilaian');
    expect(useSession.getState().user).toBeNull();
    expect(localStorage.getItem('cp.session')).toBeNull(); // nothing is saved for a signed-in staff tab to pick up
  });
});
