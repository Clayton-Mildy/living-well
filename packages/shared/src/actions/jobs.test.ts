// The daily jobs that are not about money (round 14): the birthday reminder two weeks ahead.
import { describe, it, expect } from 'vitest';
import { addDays, buildSeed, execute, getUser, systemUser, updatesFor, type ClubState } from '../index';
import { produce } from 'immer';
import { withFewVisits } from '../rules/testFewVisits';

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
    for (const x of Object.values(s.notifications)) if (x.kind === 'occ.notif.birthdaySoon') delete s.notifications[x.id]; // the seed's own reminder (Bapak Bambang)
    s.members.m2.dob = `1942-${addDays(T, 13).slice(5)}`;
    s.members.m10.dob = `1944-${addDays(T, 15).slice(5)}`;
    expect(told(tick(s, T), 's9')).toHaveLength(0);
  });
  it('the seed already holds the reminder for Bapak Bambang, two weeks out, and the job does not send it again', () => {
    const date = addDays(T, 14);
    const after = tick(buildSeed(T).citra, T);
    for (const uid of ['s5', 's1', 's9']) {
      const mine = told(after, uid).filter((x) => x.ref?.id === `bday:m10:${date}`);
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ link: `/celebrations?new=m10&date=${date}`, params: { name: 'Bapak Bambang', years: 78, date: '4/11' } });
    }
  });
});

describe('fewVisits.daily', () => {
  const fewTold = (s: ClubState, uid: string) => updatesFor(s, getUser({ citra: s }, uid)!).filter((x) => x.kind === 'renewals.few.notif');
  it('says nothing the day before the alert day', () => {
    const after = tick(withFewVisits(), '2026-11-14');
    for (const uid of ['s1', 's9', 's11']) expect(fewTold(after, uid)).toHaveLength(0);
  });
  it('on the alert day tells the front desk and management (and the Owner) once, and again on later days of the month it stays one', () => {
    let s = tick(withFewVisits(), '2026-11-15');
    for (const uid of ['s1', 's9', 's11']) {
      const mine = fewTold(s, uid);
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ link: '/renewals?few=1', params: { n: 6, max: 4, d: '2026-11-17' }, ref: { type: 'fewVisits', id: 'few:2026-11' } });
    }
    for (const uid of ['s8', 's2', 's5']) expect(fewTold(s, uid)).toHaveLength(0); // nurse, kitchen, activity
    s = tick(s, '2026-11-15');
    s = tick(s, '2026-11-16');
    for (const uid of ['s1', 's9']) expect(fewTold(s, uid)).toHaveLength(1);
  });
  it('is not sent when nobody is flagged on the alert day, nor after the deadline', () => {
    const s = produce(withFewVisits(), (d) => { for (const id of ['fv1', 'fv2', 'fv3', 'fv4', 'fv5', 'fv6']) delete d.members[id]; });
    expect(fewTold(tick(s, '2026-11-15'), 's9')).toHaveLength(0);
    expect(fewTold(tick(withFewVisits(), '2026-11-18'), 's9')).toHaveLength(0);
  });
  it('uses the club setting: fewer than 3 reads "2 times or fewer"', () => {
    const s = produce(withFewVisits(), (d) => { d.club.settings.fewVisits = { below: 3, daysBeforeMonth: 16 }; });
    expect(fewTold(tick(s, '2026-11-15'), 's1')[0]).toMatchObject({ params: { n: 3, max: 2 } });
  });
  it('a new month is told again', () => {
    const s = tick(withFewVisits(), '2026-11-15');
    const dec = produce(s, (d) => { for (const id of Object.keys(d.members)) { d.members[id].memberships.forEach((ms) => { delete ms.lastDay; }); } });
    expect(fewTold(tick(dec, '2026-12-16'), 's9').map((x) => x.ref?.id).sort()).toEqual(['few:2026-11', 'few:2026-12']);
  });
});
