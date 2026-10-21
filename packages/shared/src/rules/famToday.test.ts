// Family Today helpers (round 8): the day strip, the rail's progress, the list's label, the notification kinds.
import { describe, it, expect } from 'vitest';
import { buildSeed } from '../index';
import { isOpen } from './core';
import { dailyLogBlocks, dayDigest, listItems, listKind, noticeKind, openDayStrip, planDay, railFill } from './famToday';
import { dayStory, END_OF_DAY, latestNote, visitDays, type TlItem } from './family';

const T = '2026-10-21';
const seed = () => buildSeed().citra;
const item = (kind: TlItem['kind'], state: TlItem['state']) => ({ id: kind, kind, state }) as unknown as TlItem;

describe('openDayStrip', () => {
  it('is today and the days they came before it, six in all, oldest first', () => {
    const s = seed();
    const days = openDayStrip(s, ['m1', 'm46'], T);
    expect(days).toHaveLength(6);
    expect(days[5].date).toBe(T);
    expect(days.slice(0, 5).every((d) => d.visited)).toBe(true); // KC round 10: a day they stayed home is left out
    expect(days.every((d) => d.date === T || isOpen(s, d.date))).toBe(true);
    expect(days.map((d) => d.date)).toEqual([...days.map((d) => d.date)].sort());
  });
  it('keeps today when the club is closed, and adds an older day being read', () => {
    const s = seed();
    const sat = '2026-10-17';
    const closed = openDayStrip(s, ['m1'], sat);
    expect(closed[closed.length - 1].date).toBe(sat);
    expect(closed).toHaveLength(6);
    const older = openDayStrip(s, ['m1'], T, '2026-09-01');
    expect(older[0].date).toBe('2026-09-01');
    expect(older).toHaveLength(7);
  });
});

describe('railFill', () => {
  it('runs up to the step now, else the last done step', () => {
    expect(railFill([])).toBe(0);
    expect(railFill(['done', 'done', 'now', 'up', 'up'])).toBe(0.5);
    expect(railFill(['done', 'done', 'up', 'up', 'up'])).toBe(0.25);
    expect(railFill(['done', 'done', 'done'])).toBe(1);
    expect(railFill(['up', 'up'])).toBe(0);
  });
});

describe('the day list', () => {
  const day = [item('arrival', 'done'), item('health', 'done'), item('session', 'done'), item('lunch', 'now'), item('home', 'up')];
  it('is Next while something is still to come today, then the whole day', () => {
    expect(listKind(true, true, day)).toBe('next');
    expect(listItems('next', day).map((i) => i.kind)).toEqual(['lunch', 'home']);
    const over = day.map((i) => ({ ...i, state: 'done' }) as TlItem);
    expect(listKind(true, true, over)).toBe('today');
    expect(listKind(false, true, over)).toBe('thatDay');
    expect(listItems('thatDay', over).map((i) => i.kind)).not.toContain('arrival');
  });
  it('is "what was on" for a day nobody came, today or before', () => {
    expect(listKind(false, false, day)).toBe('wasOn');
    expect(listKind(true, false, day.map((i) => ({ ...i, state: 'done' }) as TlItem))).toBe('wasOn');
    expect(listKind(true, false, [item('lunch', 'up')])).toBe('next');
  });
});

describe('the daily log on Today', () => {
  const s = seed();
  const m1 = s.members.m1;
  const lastVisit = visitDays(s, 'm1', T).filter((d) => d < T).pop()!;
  const visited = () => dayStory(s, m1, lastVisit, END_OF_DAY);
  const away = () => dayStory(s, m1, T, 9 * 60); // today, before she has come
  /** a day she came with nothing approved logged: no log, no lunch amount, no session marks */
  const bare = (date = lastVisit) => {
    const v = visited();
    return { ...v, date, log: null, lunch: v.lunch ? { ...v.lunch, amount: null } : null, sessions: v.sessions.map((x) => ({ ...x, took: null })) };
  };

  it('boils an approved log down round by round: lunch, every session with its mark, mood and the note', () => {
    const d = dayDigest(visited());
    expect(d.any).toBe(true);
    expect(d.lunch).toBeTruthy();
    expect(d.sessions.length).toBe(visited().sessions.length); // EACH session of the day, marked or not
    expect(d.sessions.every((x) => ['joined', 'satOut', null].includes(x.took))).toBe(true);
    expect(d.sessions.some((x) => x.took)).toBe(true);
    expect(d.mood).toBeTruthy();
    expect(new Set(d.joined).size).toBe(d.joined.length); // an activity once
    expect(d.joined.some((a) => d.satOut.includes(a))).toBe(false);
  });
  it('lists a session that has no mark as null, and keeps the sessions in time order', () => {
    const d = dayDigest(bare());
    expect(d.sessions.length).toBeGreaterThan(0);
    expect(d.sessions.every((x) => x.took === null)).toBe(true);
    expect(d.sessions.map((x) => x.time)).toEqual([...d.sessions.map((x) => x.time)].sort());
    expect(d).toMatchObject({ lunch: null, mood: null, note: null, joined: [], satOut: [], any: false });
  });
  it('holds nothing for a day the member did not come', () => {
    const d = dayDigest(away());
    expect(d).toMatchObject({ mood: null, lunch: null, joined: [], satOut: [], note: null, any: false });
    expect(d.sessions.every((x) => x.took === null)).toBe(true);
    expect(dailyLogBlocks([away()], false)).toEqual([]);
  });
  it('a parent who came gets one block with every round, logged or not; a day nobody came has none', () => {
    const blocks = dailyLogBlocks([visited()], false);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'day', memberId: 'm1' });
    // came, nothing approved yet: still a block (every round reads "not logged")
    const empty = dailyLogBlocks([bare()], false);
    expect(empty).toHaveLength(1);
    expect(empty[0]).toMatchObject({ kind: 'day', memberId: 'm1', digest: { any: false } });
    // an older note is only for today
    const notCame = { ...away(), date: lastVisit };
    expect(dailyLogBlocks([notCame], false, [latestNote(s, 'm1', T)])).toEqual([]);
  });
  it('both parents: a block each, in the order of the stories', () => {
    const m46 = s.members.m46;
    const both = visitDays(s, 'm1', T).filter((d) => d < T && visitDays(s, 'm46', T).includes(d)).pop()!;
    const blocks = dailyLogBlocks([dayStory(s, m1, both, END_OF_DAY), dayStory(s, m46, both, END_OF_DAY)], false);
    expect(blocks.map((b) => b.memberId)).toEqual(['m1', 'm46']);
  });
  it('today: a parent who is in gets all the rounds as not logged yet; one who has not come falls back to the newest written note', () => {
    const inNothing = bare(T);
    const blocks = dailyLogBlocks([inNothing], true);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'day', memberId: 'm1', digest: { lunch: null, mood: null, note: null } });
    const note = latestNote(s, 'm1', T);
    expect(note?.note).toBeTruthy();
    expect(dailyLogBlocks([away()], true, [note])).toEqual([{ kind: 'older', memberId: 'm1', log: note }]);
    expect(dailyLogBlocks([away()], true, [undefined])).toEqual([]);
  });
});

describe('noticeKind', () => {
  it('sorts the family notifications', () => {
    const k = noticeKind;
    expect(k('notif.checkedIn')).toBe('arrived');
    expect(k('notif.checkedOut')).toBe('home');
    expect(k('notif.newPhotos')).toBe('photos');
    expect(k('activity.notif.newVideo')).toBe('photos');
    expect(k('activity.notif.logSaved')).toBe('note');
    expect(k('health.notif.fam.void')).toBe('health');
    expect(k('notif.act.invoiceDue')).toBe('billing');
    expect(k('finance.notif.paid')).toBe('billing');
    expect(k('notif.act.survey')).toBe('survey');
    expect(k('notif.act.docRequested')).toBe('document');
    expect(k('members.notif.docRequested')).toBe('document');
    expect(k('kitchen.notif.feedbackReply')).toBe('kitchen');
    expect(k('cal.notif.schedulePublished')).toBe('calendar');
    expect(k('members.notif.planApplied')).toBe('plan');
    expect(k('family.notif.leaveOverrunFamily')).toBe('plan');
    expect(k('members.notif.welcome')).toBe('club');
  });
});


// KC round 9: the day ahead
describe('the plan day (tomorrow)', () => {
  it('is the next open day after today, last in the strip when asked for, and its list is the plan', () => {
    const s = seed();
    const next = planDay(s, T);
    expect(next > T).toBe(true);
    const days = openDayStrip(s, ['m1'], T, undefined, 6, true);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ date: next, plan: true, visited: false });
    expect(openDayStrip(s, ['m1'], T)).toHaveLength(6); // without it, as before
    expect(listKind(false, false, [{ state: 'up' }], true)).toBe('plan');
  });
});
