// Family Calendar selectors: the day's agenda (banner, sessions, meals, who joined in, pictures), the month grid and the browsing range.
import { describe, it, expect } from 'vitest';
import { buildSeed, projectForFamily, type ClubState } from '../index';
import { addDays, dow } from '../util';
import { visitDays } from './family';
import { famDay, famMonth, famRange, famWeek } from './famCalendar';
import { menuOn } from './kitchen';
import { produce } from 'immer';

const T = '2026-10-21';
const NOW = 14 * 60; // after both sessions started
const WHO = ['m1', 'm46'];
const seed = () => buildSeed().citra;

/** The first past open day a parent came, going back from yesterday. */
function visitDay(s: ClubState, who = WHO) {
  const all = who.flatMap((id) => visitDays(s, id, addDays(T, -1))).sort().reverse();
  const d = all.find((x) => famDay(s, who, x, T, NOW).rows.some((r) => r.kind === 'session'));
  if (!d) throw new Error('the seed has no visit day with sessions');
  return d;
}

describe('famDay: the agenda of one date', () => {
  it('a weekend is a grey banner with no rows; a closure is an ochre banner with its title', () => {
    const s = seed();
    let sat = T;
    while (dow(sat) !== 6) sat = addDays(sat, 1);
    const w = famDay(s, WHO, sat, T, NOW);
    expect(w.banner).toEqual({ kind: 'weekend' });
    expect(w.rows).toEqual([]);
    const closed = Object.values(s.calendarEvents).find((e) => e.kind === 'closed')!;
    const c = famDay(s, WHO, closed.date, T, NOW);
    expect(c.state).toBe('closed');
    expect(c.banner?.kind).toBe('closed');
    expect(c.banner?.title).toBe(closed.title);
    expect(c.rows).toEqual([]);
  });

  it('an open day lists sessions, lunch and tea in time order with the menu dishes, and no banner', () => {
    const s = seed();
    const d = visitDay(s);
    const day = famDay(s, WHO, d, T, NOW);
    expect(day.banner).toBeNull();
    const kinds = day.rows.map((r) => r.kind);
    expect(kinds).toContain('session');
    expect(kinds).toContain('lunch');
    expect(kinds).toContain('tea');
    expect(day.rows.map((r) => r.time)).toEqual([...day.rows.map((r) => r.time)].sort());
    for (const r of day.rows.filter((x) => x.kind === 'lunch' || x.kind === 'tea')) expect(r.dishes?.[0].names.length).toBeGreaterThan(0);
  });

  it('round 15: a row is passed once its time has gone by, whether or not a parent came; rows still ahead are not', () => {
    const s = seed();
    const past = addDays(T, -1); // Tuesday
    const before = famDay(s, ['m1'], past, T, NOW);
    expect(before.rows.some((r) => r.kind === 'session')).toBe(true);
    expect(before.rows.every((r) => r.passed)).toBe(true);
    const nobody = famDay(s, [], past, T, NOW); // nobody came
    expect(nobody.rows.every((r) => r.passed)).toBe(true);
    const ahead = famDay(s, WHO, addDays(T, 1), T, NOW);
    expect(ahead.rows.length).toBeGreaterThan(0);
    expect(ahead.rows.some((r) => r.passed)).toBe(false);
    // today at 14:00: the morning session and lunch are over, the 13:30 session is still running, tea is ahead
    const today = famDay(s, WHO, T, T, NOW);
    expect(today.rows.filter((r) => r.kind === 'session' && r.time < '12:00').every((r) => r.passed)).toBe(true);
    expect(today.rows.find((r) => r.kind === 'lunch')?.passed).toBe(true);
    expect(today.rows.find((r) => r.kind === 'tea')?.passed).toBe(false);
    expect(famDay(s, WHO, T, T, 9 * 60).rows.some((r) => r.passed)).toBe(false);
  });

  it('on a day a parent came, a finished session says who joined in or sat out and holds the approved pictures once per activity', () => {
    const s = seed();
    const days = WHO.flatMap((id) => visitDays(s, id, addDays(T, -1))).sort().reverse();
    const withTook = days.map((d) => famDay(s, WHO, d, T, NOW)).find((x) => x.rows.some((r) => r.took.length));
    expect(withTook).toBeTruthy();
    for (const r of withTook!.rows.filter((x) => x.took.length)) for (const t of r.took) expect(withTook!.came).toContain(t.memberId);
    const withPhotos = days.map((d) => famDay(s, WHO, d, T, NOW)).find((x) => x.rows.some((r) => r.kind === 'session' && r.photos.length));
    expect(withPhotos).toBeTruthy();
    const ids = withPhotos!.rows.flatMap((r) => r.photos.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of withPhotos!.rows.flatMap((r) => r.photos)) expect(p.visibility).toBe('visible');
    // the leftovers never repeat a row's picture
    for (const p of withPhotos!.others) expect(ids).not.toContain(p.id);
  });

  it('a day nobody came (and any day in the future) has no joined lines and no pictures', () => {
    const s = seed();
    const future = addDays(T, 7);
    const f = famDay(s, WHO, future, T, NOW);
    expect(f.came).toEqual([]);
    for (const r of f.rows) { expect(r.took).toEqual([]); expect(r.photos).toEqual([]); }
    expect(f.others).toEqual([]);
    const away = WHO.flatMap((id) => visitDays(s, id, T));
    let d = addDays(T, -1);
    while (dow(d) === 0 || dow(d) === 6 || away.includes(d)) d = addDays(d, -1);
    const n = famDay(s, WHO, d, T, NOW);
    expect(n.came).toEqual([]);
    for (const r of n.rows) { expect(r.took).toEqual([]); expect(r.photos).toEqual([]); }
  });

  it('a session still to come today has nothing joined yet', () => {
    const s = seed();
    const d = visitDay(s);
    const early = famDay(s, WHO, d, d, 9 * 60); // read as "today" at 09:00: nothing has started
    for (const r of early.rows) { expect(r.took).toEqual([]); expect(r.photos).toEqual([]); }
  });

  it('a venue booking shows as a private event: no client', () => {
    const s = seed();
    const v = Object.values(s.venueBookings).find((b) => b.status === 'confirmed' && dow(b.date) >= 1 && dow(b.date) <= 5);
    if (!v) return; // the seed has none on a weekday
    const row = famDay(s, WHO, v.date, T, NOW).rows.find((r) => r.kind === 'venue');
    expect(JSON.stringify(row)).not.toContain(v.org);
  });

  it('reads the same on a family projection as on the full state', () => {
    const s = seed();
    const p = projectForFamily(s, 'f1');
    const d = visitDay(s);
    expect(JSON.stringify(famDay(p, WHO, d, T, NOW))).toBe(JSON.stringify(famDay(s, WHO, d, T, NOW)));
  });
});

describe('famMonth: the month grid', () => {
  it('starts on Monday, marks closed days, and gives a photo only on a day a parent came', () => {
    const s = seed();
    const cells = famMonth(s, WHO, '2026-10', T);
    const first = cells.findIndex((c) => !!c);
    expect(first).toBe((dow('2026-10-01') + 6) % 7);
    const real = cells.filter((c): c is NonNullable<typeof c> => !!c);
    expect(real).toHaveLength(31);
    expect(real.find((c) => c.date === '2026-10-03')?.state).toBe('weekend');
    expect(real.find((c) => c.date === '2026-10-30')?.state).toBe('closed');
    const visits = new Set(WHO.flatMap((id) => visitDays(s, id, T)));
    for (const c of real) {
      expect(c.visited).toBe(visits.has(c.date));
      if (!c.visited) expect(c.photo).toBeNull();
      if (c.photo) expect(c.photo.media).toBe('photo');
    }
    expect(real.some((c) => c.photo)).toBe(true);
    expect(real.find((c) => c.date > T)?.visited).toBe(false);
  });
});

describe('famRange: how far to browse', () => {
  it('runs from the month of the first visit to at least two months ahead', () => {
    const s = seed();
    const first = WHO.map((id) => visitDays(s, id, T)[0]).sort()[0];
    const r = famRange(s, WHO, T);
    expect(r.min).toBe(first.slice(0, 7));
    expect(r.max >= '2026-12').toBe(true);
    expect(r.max <= '2027-10').toBe(true);
  });
  it('a family with no visits yet browses from this month', () => {
    expect(famRange(seed(), [], T).min).toBe('2026-10');
  });
});

describe('famWeek: the five open days the desktop lists', () => {
  it('Monday to Friday, each the same as that day on its own', () => {
    const s = seed();
    const week = famWeek(s, WHO, '2026-10-19', T, NOW);
    expect(week.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
    expect(week[2]).toEqual(famDay(s, WHO, '2026-10-21', T, NOW));
  });
});

describe('famDay: a celebration on a closed day', () => {
  it('a confirmed weekend celebration is a row under the weekend banner, only for its own member; a requested one is not shown', () => {
    const s = seed();
    let sat = T;
    while (dow(sat) !== 6) sat = addDays(sat, 1);
    const cel = { id: 'c-wk', clubId: s.clubId, createdAt: `${T}T09:00`, createdBy: 'staff:s1', memberId: 'm46', kind: 'birthday', title: "Opa Budi's birthday", date: sat, from: '14:00', to: '16:00', roomId: 'room-garden-room', guests: 8, status: 'confirmed', requestedBy: 'staff:s1' } as const;
    s.celebrations['c-wk'] = { ...cel };
    const day = famDay(s, WHO, sat, T, NOW);
    expect(day.banner).toMatchObject({ kind: 'weekend' });
    expect(day.rows).toHaveLength(1);
    expect(day.rows[0]).toMatchObject({ kind: 'celebration', celebrationId: 'c-wk', memberId: 'm46', time: '14:00', to: '16:00', title: "Opa Budi's birthday" });
    expect(famDay(s, ['m1'], sat, T, NOW).rows).toHaveLength(0);
    s.celebrations['c-wk'] = { ...cel, status: 'requested' };
    expect(famDay(s, WHO, sat, T, NOW).rows).toHaveLength(0);
  });
});

describe('famDay: the lunch picture (round 15)', () => {
  const NEXT = '2026-10-22';
  const withDishPhoto = (s: ClubState, date: string) => produce(s, (d) => { d.dishes[menuOn(s, date)!.lunch[0]].photoMediaId = 'md_dish_photo_1'; });
  it('tomorrow\'s lunch row carries the dish photo; a day with no dish photo carries none', () => {
    const s = produce(seed(), (d) => { for (const x of Object.values(d.dishes)) delete x.photoMediaId; }); // the seed\'s main dishes have demo pictures
    expect(famDay(s, WHO, NEXT, T, NOW).rows.find((r) => r.kind === 'lunch')?.picture).toBeUndefined();
    const row = famDay(projectForFamily(withDishPhoto(s, NEXT), 'f1'), WHO, NEXT, T, NOW).rows.find((r) => r.kind === 'lunch');
    expect(row?.picture).toEqual({ mediaId: 'md_dish_photo_1', source: 'dish' });
  });
});
