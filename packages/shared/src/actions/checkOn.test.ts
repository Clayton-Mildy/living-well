import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, DomainError, type ClubState } from '../index';

const T = '2026-10-21';
const clock = { today: T, nowMin: 10 * 60 };
let n = 0;
const seed = (): ClubState => buildSeed().citra;
const run = (s: ClubState, name: string, input: unknown, uid: string) => execute(s, name, input, getUser({ [s.clubId]: s }, uid)!, clock, `cc${++n}`);
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string) => {
  try { run(s, name, input, uid); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const input = { memberId: 'm1', contactName: 'Ibu Maria', phone: '+62 812-1090-4471', outcome: 'fine' };

describe('member.logCall', () => {
  it('stores the call dated today', () => {
    const s = run(seed(), 'member.logCall', { ...input, note: 'Back from Bali', checkAgainOn: '2026-10-30' }, 's1').state;
    const rows = Object.values(s.careCalls).filter((c) => c.memberId === 'm1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: T, by: 'staff:s1', outcome: 'fine', note: 'Back from Bali', checkAgainOn: '2026-10-30', contactName: 'Ibu Maria' });
  });
  it('hospital notifies management once (attention) and adds a staff-only note', () => {
    const before = seed();
    const s = run(before, 'member.logCall', { ...input, outcome: 'hospital', note: 'In RS Pondok Indah' }, 's1').state;
    const added = Object.values(s.notifications).filter((x) => x.kind === 'checkOn.notif.unwell' && !Object.values(before.notifications).some((o) => o.id === x.id));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ severity: 'attention', link: '/members/m1' });
    expect(Object.values(s.memberNotes).some((x) => x.memberId === 'm1' && x.visibility === 'staff' && x.text.includes('In RS Pondok Indah'))).toBe(true);
  });
  it('a fine call raises no notification', () => {
    const before = seed();
    const s = run(before, 'member.logCall', input, 's8').state;
    expect(Object.values(s.notifications).filter((x) => x.kind === 'checkOn.notif.unwell')).toHaveLength(0);
  });
  it('a family user is forbidden; an unknown outcome is invalid', () => {
    fails(seed(), 'member.logCall', input, 'f1', 'err.forbidden');
    fails(seed(), 'member.logCall', { ...input, outcome: 'nope' }, 's1', 'err.invalid');
  });
});
