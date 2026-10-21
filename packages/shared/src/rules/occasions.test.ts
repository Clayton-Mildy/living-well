import { describe, it, expect } from 'vitest';
import { addDays, buildSeed, type ClubState } from '../index';
import { addOpenDays } from '../seed/r7/celebrations';
import { dayInfo } from './calendar';
import { famDay } from './famCalendar';
import { occasionsInRange, occasionsThisWeek } from './occasions';

const T = '2026-10-21';
const roster = () => buildSeed(T, 598, { roster: true }).citra;

describe('occasions (birthdays and anniversaries)', () => {
  it('Opa Budi turns 80 three open days from today', () => {
    const s = buildSeed().citra;
    const o = occasionsThisWeek(s, T).find((x) => x.member.id === 'm46' && x.kind === 'birthday');
    expect(o).toMatchObject({ years: 80, date: addOpenDays(s, T, 3) });
  });

  it('a member without a date of birth never appears; inactive members are left out', () => {
    const s = buildSeed().citra;
    const od = addOpenDays(s, T, 3);
    s.members.m46.dob = null;
    expect(occasionsInRange(s, T, addDays(T, 30)).some((x) => x.member.id === 'm46' && x.kind === 'birthday')).toBe(false);
    s.members.m46.dob = `1946-${od.slice(5)}`;
    s.members.m46.memberships[0].lastDay = addDays(T, 1);
    expect(occasionsInRange(s, T, addDays(T, 7)).some((x) => x.member.id === 'm46')).toBe(false);
  });

  it('runs across a year boundary and keeps 29 February on the 28th in other years', () => {
    const s = buildSeed().citra;
    s.members.m2.dob = '1942-01-02';
    s.members.m10.dob = '1948-02-29';
    const o = occasionsInRange(s, '2026-12-28', '2027-01-04').find((x) => x.member.id === 'm2');
    expect(o).toMatchObject({ kind: 'birthday', date: '2027-01-02', years: 85 });
    expect(occasionsInRange(s, '2027-02-26', '2027-03-02').find((x) => x.member.id === 'm10')).toMatchObject({ date: '2027-02-28', years: 79 });
    expect(occasionsInRange(s, '2028-02-26', '2028-03-02').find((x) => x.member.id === 'm10')).toMatchObject({ date: '2028-02-29', years: 80 });
  });

  it('sorts by date then name, and counts anniversaries from the first start (one year and more)', () => {
    const s: ClubState = roster();
    const week = occasionsThisWeek(s, T);
    const ds = week.map((x) => x.date);
    expect(ds).toEqual([...ds].sort());
    const ann = week.find((x) => x.kind === 'anniversary');
    expect(ann).toMatchObject({ years: 1, date: addDays(T, 2) });
    expect(ann!.member.memberships[0].start).toBe('2025-10-23');
    // a membership that began this year has no anniversary yet
    expect(occasionsInRange(s, '2026-01-01', '2026-12-31').filter((x) => x.kind === 'anniversary').every((x) => x.years >= 1)).toBe(true);
  });

  it('the calendar shows the birthday to staff, and to a family only for its own parent', () => {
    const s = buildSeed().citra;
    const day = addOpenDays(s, T, 3);
    expect(dayInfo(s, day, 'staff').items.find((i) => i.kind === 'birthday')).toMatchObject({ memberId: 'm46', years: 80, time: null });
    expect(dayInfo(s, day, 'family').items.some((i) => i.kind === 'birthday')).toBe(false);
    expect(famDay(s, ['m46'], day, T, 598).rows.find((r) => r.kind === 'birthday')).toMatchObject({ memberId: 'm46', years: 80 });
    expect(famDay(s, ['m2'], day, T, 598).rows.some((r) => r.kind === 'birthday')).toBe(false);
  });
});
