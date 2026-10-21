// Round 12: each row of an activity round carries five faces. A face on a row that is still unmarked marks the session joined and the face together
// (one log.mark); on a marked row it rides with the existing value. The Mood & notes round shows each person's day arc.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, moodId, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { DailyLog } from './DailyLog';

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

function openClub(edit?: (s: ClubState) => void) {
  const state = buildSeed().citra;
  edit?.(state);
  const mock = vi.fn(async () => ({ ok: true, result: {} }));
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's5', name: 'Dinar', role: 'activity', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's5', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 630, realStart: Date.now(), offset: 0 }, act: mock as never });
  return mock;
}
async function show(path: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[path]}><DailyLog /></MemoryRouter>); });
}
const row = (id: string) => document.querySelector<HTMLElement>(`[data-testid="log-row"][data-member="${id}"]`)!;
const faceBtn = (id: string, f: number) => row(id).querySelector<HTMLElement>(`[role=radio][data-face="${f}"]`)!;

describe('DailyLog faces', () => {
  it('a face on an unmarked row marks the session joined and the face in one log.mark', async () => {
    const mock = openClub();
    await show('/log?round=10:30');
    expect(row('m2')).toBeTruthy();
    await act(async () => { faceBtn('m2', 5).click(); });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith('log.mark', { date: T, memberIds: ['m2'], session: { slot: '10:30', value: 'joined' }, face: 5 });
  });

  it('on a marked row the face is sent with the existing value, and the chosen face shows', async () => {
    const mock = openClub((s) => {
      s.dailyLogs[`${T}:m2`] = { ...(s.dailyLogs[`${T}:m2`] ?? { id: `${T}:m2`, clubId: 'citra', createdAt: `${T}T10:00`, createdBy: 'staff:s5', memberId: 'm2', date: T, status: 'saved', edits: [] }), sessions: { '10:30': 'satOut' } } as never;
      s.moodMarks[moodId(T, 'm2', 'activity', '10:30')] = { id: moodId(T, 'm2', 'activity', '10:30'), clubId: 'citra', createdAt: `${T}T10:05`, createdBy: 'staff:s5', memberId: 'm2', date: T, time: '10:05', moment: 'activity', slot: '10:30', face: 3, by: 'staff:s5' };
    });
    await show('/log?round=10:30');
    expect(faceBtn('m2', 3).getAttribute('aria-checked')).toBe('true');
    await act(async () => { faceBtn('m2', 1).click(); });
    expect(mock).toHaveBeenCalledWith('log.mark', { date: T, memberIds: ['m2'], session: { slot: '10:30', value: 'satOut' }, face: 1 });
  });

  it('the Mood & notes round shows the arc of a person with faces', async () => {
    openClub((s) => {
      s.moodMarks[moodId(T, 'm2', 'arrival')] = { id: moodId(T, 'm2', 'arrival'), clubId: 'citra', createdAt: `${T}T09:30`, createdBy: 'staff:s1', memberId: 'm2', date: T, time: '09:30', moment: 'arrival', face: 3, by: 'staff:s1' };
    });
    await show('/log?round=mood&member=m2');
    const arc = row('m2').querySelector('[data-testid="mood-arc"]');
    expect(arc).toBeTruthy();
    expect(arc!.textContent).toContain('Arrival');
  });
});
