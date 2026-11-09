// Reviews: a change to the application-form answers reads as one "old → new" row per answer (not "[object Object]").
import { describe, expect, it } from 'vitest';
import { buildSeed, execute, getUser, translate } from '@cp/shared';
import { describeCr } from './reviewDiff';

const fmt = { fdy: (d: string) => d, fds: (d: string) => d, fd: (d: string) => d };
const t = (k: string, v?: Record<string, string | number | undefined | null>) => translate('en', k, v);

describe('describeCr: application form answers', () => {
  const c = buildSeed();
  const s = c.citra;
  const lobby = getUser(c, 's1')!;
  const send = (registration: unknown) => {
    const r = execute(s, 'members.updateDetails', { memberId: 'm1', patch: { registration } }, lobby, { today: '2026-10-21', nowMin: 600 }, 'rd1');
    return { state: r.state, cr: r.state.changeRequests[r.result.changeRequestId as string] };
  };
  it('shows each changed answer with its old and new value', () => {
    const { state, cr } = send({ ...s.members.m1.registration, nickname: 'Oma L', marital: 'widowed', commDifficulty: true, ids: { guarantor: true }, dementiaNote: 'Repeats questions' });
    const rows = describeCr(cr, state, t, fmt).rows;
    expect(rows).toEqual(expect.arrayContaining([
      { label: 'Nickname (Panggilan)', from: 'Oma Lina', to: 'Oma L' },
      { label: 'Marital status', from: 'Married', to: 'Widowed' },
      { label: 'Difficulty communicating?', from: 'No', to: 'Yes' },
      { label: 'Dementia notes', from: '—', to: 'Repeats questions' },
      { label: 'IDs received', from: 'Responsible family member, Member, Carer (suster)', to: 'Responsible family member' },
    ]));
    expect(rows.every((r) => !/object Object/.test(`${r.from} ${r.to}`))).toBe(true);
    expect(rows.find((r) => r.label === 'Postcode')).toBeUndefined(); // unchanged answers are not listed
  });
  it('clearing every answer lists them as removed', () => {
    const { state, cr } = send(null);
    const rows = describeCr(cr, state, t, fmt).rows;
    expect(rows.find((r) => r.label === 'Nickname (Panggilan)')).toEqual({ label: 'Nickname (Panggilan)', from: 'Oma Lina', to: '—' });
  });
});

describe('describeCr: the home pin (round 21)', () => {
  it('reads as the area, not the coordinates', () => {
    const c = buildSeed();
    const s = c.citra;
    delete s.members.m1.location;
    const r = execute(s, 'members.updateDetails', { memberId: 'm1', patch: { location: { lat: -6.136, lng: 106.731, kelurahan: 'Kalideres', kecamatan: 'Kalideres' } } }, getUser(c, 's1')!, { today: '2026-10-21', nowMin: 600 }, 'rd9');
    const rows = describeCr(r.state.changeRequests[r.result.changeRequestId as string], r.state, t, fmt).rows;
    expect(rows).toContainEqual({ label: 'Location', from: '—', to: 'Kalideres, Kalideres' });
  });
});
