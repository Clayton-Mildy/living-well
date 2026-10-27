// The daily jobs that are not about money (round 14): the birthday reminder two weeks ahead.
import { describe, it, expect } from 'vitest';
import { addDays, buildSeed, execute, getUser, systemUser, updatesFor, type ClubState } from '../index';

const T = '2026-10-21';
let n = 0;
const tick = (s: ClubState, today: string) => execute(s, 'jobs.tick', {}, systemUser('citra'), { today, nowMin: 600 }, `jb${++n}`).state;
const told = (s: ClubState, uid: string) => updatesFor(s, getUser({ citra: s }, uid)!).filter((x) => x.kind === 'occ.notif.birthdaySoon');

describe('occasions.daily', () => {
  it('tells activity, the front desk and management once when a birthday is exactly 14 days away', () => {
    const s = buildSeed().citra;
    const date = addDays(T, 14);
    s.members.m2.dob = `1942-${date.slice(5)}`;
    const after = tick(s, T);
    for (const uid of ['s5', 's1', 's9']) {
      const mine = told(after, uid).filter((x) => x.ref?.id === `bday:m2:${date}`);
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ link: `/celebrations?new=m2&date=${date}`, params: { years: 84, date: '4/11' } });
    }
    expect(told(after, 's8')).toHaveLength(0); // the nurse is not told
    const again = tick(after, T);
    for (const uid of ['s5', 's1', 's9']) expect(told(again, uid).filter((x) => x.ref?.id === `bday:m2:${date}`)).toHaveLength(1);
  });
  it('says nothing for a birthday 13 or 15 days away', () => {
    const s = buildSeed().citra;
    for (const m of Object.values(s.members)) m.dob = null;
    s.members.m2.dob = `1942-${addDays(T, 13).slice(5)}`;
    s.members.m10.dob = `1944-${addDays(T, 15).slice(5)}`;
    expect(told(tick(s, T), 's9')).toHaveLength(0);
  });
});
