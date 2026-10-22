// Round 13: a rejected activity picture stays dimmed in the teacher's list but still opens full size (the staff PhotoViewer drops removed photos).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { pictureSessions } from '@cp/shared/rules/activity';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { ActivityPicturesBody } from './ActivityPictures';

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});

describe('ActivityPictures', () => {
  it('a rejected picture is dimmed and opens full size', async () => {
    const state = buildSeed().citra;
    const name = pictureSessions(state, T)[0]!.activity!.name;
    state.photos.rej1 = { id: 'rej1', clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s5', date: T, time: '09:00', kind: 'activity', media: 'photo', activity: name, memberIds: [], tone: 1, takenBy: 's5', visibility: 'removed', mediaId: 'med-rej', moderated: { at: `${T}T09:30`, by: 's9', reason: 'Blurry' } } as never;
    useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's5', name: 'Dinar', role: 'activity', clubId: 'citra', clubs: ['citra'] } });
    useReplica.setState({ club: 'citra', userId: 's5', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 630, realStart: Date.now(), offset: 0 }, act: (async () => ({ ok: true, result: {} })) as never });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter initialEntries={[`/?tab=activity&date=${T}&act=${encodeURIComponent(name)}`]}><ActivityPicturesBody /></MemoryRouter>); });
    const row = document.querySelector<HTMLElement>('[data-picture="rej1"]')!;
    expect(row.getAttribute('data-state')).toBe('rejected');
    const opener = row.querySelector<HTMLButtonElement>('button[aria-label]')!;
    expect(opener).toBeTruthy();
    expect((opener.parentElement as HTMLElement).style.opacity).toBe('0.45');
    await act(async () => { opener.click(); });
    expect(document.querySelector('[data-testid="image-lightbox-img"]')?.getAttribute('src')).toMatch(/med-rej$/);
  });
});
