// Family Today (round 8, the Family App prototype; round 8b: the list as a timeline, the daily log, the laptop's two columns): the hero (both parents, one parent), the
// day strip, the day's timeline, the daily log and lunch feedback render against the seed (a smoke test: no browser is needed to catch a crash).
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { produce } from 'immer';
import { buildSeed, limitsFor, moodId, projectForFamily, type ClubState } from '@cp/shared';
import { dayStory, END_OF_DAY, visitDays } from '@cp/shared/rules/family';
import { withMarks } from '@cp/shared/rules/testMarks';
import { dayChecks } from '@cp/shared/rules/famHealth';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { FamilyToday } from './FamilyToday';

let root: Root | null = null;
let host: HTMLElement | null = null;
const actMock = vi.fn(async () => ({ ok: true as const, result: {} }));
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
});
// the family pages switch to their desktop layout from 1024px: the phone / tablet tests run at 800
beforeEach(() => widthOf(800));
afterEach(async () => {
  widthOf(800);
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  actMock.mockClear();
});

const T = '2026-10-21';
function open(familyId: string, lang: 'en' | 'id' = 'en', min = 598, base?: ClubState) {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ } // the member switcher is remembered per user
  const full = base ?? buildSeed().citra;
  const view = projectForFamily(full, familyId);
  useSession.setState({ lang, club: 'citra', user: { kind: 'family', id: familyId, name: 'Maria', clubId: 'citra' } as never });
  useReplica.setState({ club: 'citra', userId: familyId, confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: min, realStart: Date.now(), offset: 0 }, act: actMock as never });
  return view;
}
/** Shows where the router is, so a button that navigates can be checked. */
function Where() { const l = useLocation(); return <span data-testid="where">{l.pathname + l.search}</span>; }
async function show(ui: ReactElement, url: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}>{ui}<Where /></MemoryRouter>); });
}
const q = (sel: string) => document.querySelector(sel);
const qa = (sel: string) => Array.from(document.querySelectorAll(sel));
/** The window's width decides phone / tablet / laptop (useDevice reads it when a screen mounts). */
const widthOf = (w: number) => { (window as unknown as { innerWidth: number }).innerWidth = w; };
const text = () => document.body.textContent || '';
const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };

describe('family Today', () => {
  it('today, one parent: six days ending today, her card, what is next, and the newest note from the team', async () => {
    open('f1');
    await show(<FamilyToday />, '/today?member=m1');
    const strip = q('[data-testid="day-strip"]')!;
    const days = Array.from(strip.querySelectorAll('[data-date]')).map((x) => x.getAttribute('data-date'));
    expect(days).toHaveLength(7); // KC round 9: six days ending today, then the day ahead
    expect(days[5]).toBe(T);
    expect(strip.querySelector('[data-plan]')?.getAttribute('data-date')).toBe(days[6]);
    expect(strip.querySelector('[data-selected="true"]')?.getAttribute('data-date')).toBe(T);
    const hero = q('[data-testid="story-hero"]')!;
    expect(hero.getAttribute('data-mode')).toBe('single');
    expect(hero.textContent).toContain('Oma Lina isn’t at the club');
    expect(hero.textContent).not.toMatch(/Usually arrives/); // KC round 8b: no "usually arrives around" on Today (the profile keeps the field)
    expect(q('[data-testid="all-parents"]')?.getAttribute('aria-label')).toBe('Both parents'); // she is focused: one tap back to both (KC round 9: the switch)
    expect(q('[data-testid="timeline"]')?.getAttribute('data-kind')).toBe('next');
    // the daily log: she has not come today, so the newest note the team wrote stands in, labelled with its day, inside the one "Daily log" section
    expect(q('[data-testid="daily-log"] [data-testid="team-note"] [data-testid="team-log"]')).toBeTruthy();
    expect(q('[data-testid="team-note"]')?.getAttribute('data-own')).toBe('false');
    expect(q('[data-testid="note-open-day"]')).toBeTruthy();
    expect(qa('[data-testid="team-log"]')).toHaveLength(1);
    expect(q('[data-testid="log-mood"]')).toBeNull(); // nothing of today's is logged
    expect(q('[data-testid="timeline"]')!.compareDocumentPosition(q('[data-testid="daily-log"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // right below the timeline
    expect(q('[data-testid="today-health"]')).toBeNull(); // she has not come: no health section either
    expect(q('[data-testid="memories-teaser"]')).toBeNull(); // memories live in Photos now
    expect(q('[data-testid="wa-club"]')).toBeNull(); // the club's links live in Me
    expect(q('[role="tablist"]')).toBeNull(); // no segmented parent switch
  });

  it('an earlier visit day (?date=): arrived and home, her mood and sessions, the whole day done, the rail full', async () => {
    const view = open('f1');
    const day = visitDays(view, 'm1', T).filter((d) => d < T).pop()!;
    await show(<FamilyToday />, `/today?member=m1&date=${day}`);
    expect(q('[data-testid="today-header"]')?.getAttribute('data-date')).toBe(day);
    expect(q('[data-testid="day-strip"] [data-selected="true"]')?.getAttribute('data-date')).toBe(day);
    expect(q('[data-testid="story-hero"]')?.textContent).toMatch(/Arrived \d\d:\d\d · Home \d\d:\d\d/);
    expect(q('[data-testid="story-hero"] h1')?.textContent).toMatch(/Oma Lina/); // the day's title ("Yesterday with Oma Lina", "Oma Lina’s Monday")
    expect(q('[data-testid="back-to-today"]')).toBeTruthy();
    expect(q('[data-testid="hero-sub"]')).toBeTruthy();
    const steps = Array.from(document.querySelectorAll('[data-testid="hero-rail"] [data-step]'));
    expect(steps.length).toBeGreaterThan(3);
    expect(steps.every((x) => x.getAttribute('data-state') === 'done')).toBe(true);
    expect(q('[data-testid="timeline"]')?.getAttribute('data-kind')).toBe('thatDay');
    const rows = Array.from(document.querySelectorAll('[data-tl]'));
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.every((x) => x.getAttribute('data-state') === 'done')).toBe(true);
    expect(q('[data-testid="took"]')).toBeTruthy();
    expect(q('[data-testid="survey-card"]')).toBeNull(); // the survey is for today
    // the timeline is a rail: a dot per step (bronze for a step that is over) beside the time and title
    expect(qa('[data-tl]').every((x) => x.children.length === 2 && x.firstElementChild?.getAttribute('aria-hidden') === 'true')).toBe(true);
    // round 14: the Lunch card follows the timeline (dishes and how much she ate); the daily log below it no longer has a Lunch round
    const card = q('[data-testid="lunch-card"]')!;
    expect(card.textContent).toContain('Lunch');
    expect(card.querySelector('[data-testid="lunch-amount"]')?.getAttribute('data-amount')).toBeTruthy();
    expect(card.querySelector('[data-testid="lunch-card-dishes"]')?.textContent).toBeTruthy();
    expect(q('[data-testid="timeline"]')!.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // the daily log below it, every round in the same order: mood (round 14: first), each session, then the team's note (once)
    const log = q('[data-testid="daily-log"]')!;
    expect(log.textContent).toContain('Daily log');
    expect(log.querySelector('[data-testid="log-lunch"]')).toBeNull();
    const sessions = Array.from(log.querySelectorAll('[data-testid="log-session"]'));
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.length).toBe(qa('[data-tl^="session-"]').length); // each session of that day, the same as the list above
    expect(sessions.every((x) => ['joined', 'satOut', 'none'].includes(x.getAttribute('data-took') || ''))).toBe(true);
    expect(sessions.some((x) => x.getAttribute('data-took') !== 'none')).toBe(true);
    expect(log.querySelector('[data-testid="log-mood"]')?.getAttribute('data-mood')).toBeTruthy();
    const order = ['log-mood', 'log-activities'].map((id) => log.querySelector(`[data-testid="${id}"]`)!);
    expect(order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(qa('[data-testid="team-log"]').length).toBeLessThanOrEqual(1); // the note is not shown twice
    expect(qa('[data-testid="log-block"]')).toHaveLength(1);
  });

  it('round 15: the check-out is a row of "That day" with its time on a past day they came, and on today once they have gone home', async () => {
    const view = open('f1');
    const day = visitDays(view, 'm1', T).filter((d) => d < T).pop()!;
    const out = view.attendance[`${day}:m1`].checkOut!.at;
    await show(<FamilyToday />, `/today?member=m1&date=${day}`);
    expect(q('[data-testid="timeline"]')?.getAttribute('data-kind')).toBe('thatDay');
    const home = q('[data-tl="home"]')!;
    expect(home.textContent).toContain('Home time');
    expect(home.textContent).toContain(out);
    // today, once she has gone home (the clock after her check-out): the whole day is listed, ending with the home time
    const gone = produce(buildSeed().citra, (d) => {
      d.attendance[`${T}:m1`] = { id: `${T}:m1`, clubId: 'citra', createdAt: `${T}T10:00`, createdBy: 'staff:s1', memberId: 'm1', date: T, checkIn: { at: '10:00', by: 'staff:s1', method: 'manual' }, checkOut: { at: '15:40', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] };
    });
    await act(async () => { root?.unmount(); });
    host?.remove();
    open('f1', 'en', 17 * 60, gone);
    await show(<FamilyToday />, '/today?member=m1');
    expect(q('[data-tl="home"]')?.textContent).toContain('15:40');
  });
  it('round 15: Both mode lists a home time per parent who has gone home', async () => {
    const gone = produce(buildSeed().citra, (d) => {
      for (const id of ['m1', 'm46']) d.attendance[`${T}:${id}`] = { id: `${T}:${id}`, clubId: 'citra', createdAt: `${T}T10:00`, createdBy: 'staff:s1', memberId: id, date: T, checkIn: { at: '10:00', by: 'staff:s1', method: 'manual' }, checkOut: { at: id === 'm1' ? '15:40' : '15:55', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] };
    });
    open('f1', 'en', 17 * 60, gone);
    await show(<FamilyToday />, '/today');
    const homes = qa('[data-tl^="home-"]');
    expect(homes.map((x) => x.textContent)).toEqual([expect.stringContaining('15:40'), expect.stringContaining('15:55')]);
  });
  it('round 14: the lunch pictures and the portion show once, on the Lunch card; the timeline row keeps its time and title only', async () => {
    const view = open('f1');
    const day = visitDays(view, 'm1', T).filter((d) => d < T).pop()!;
    const photo = { id: 'ph-r14-lunch', clubId: 'citra', createdAt: `${day}T12:10`, createdBy: 'staff:s9', date: day, time: '12:10', kind: 'lunch', media: 'photo', memberIds: [], tone: 1, takenBy: 's9', visibility: 'visible', mediaId: 'md_test_lunch' };
    (view.photos as Record<string, unknown>)[photo.id] = photo;
    view.dayMenus[day] = { ...view.dayMenus[day], photoIds: [...(view.dayMenus[day]?.photoIds ?? []), photo.id] } as never;
    await show(<FamilyToday />, `/today?member=m1&date=${day}`);
    expect(qa('[data-testid="lunch-photos"]')).toHaveLength(1);
    expect(qa('[data-testid="lunch-photos"] [data-photo-id]').length).toBeGreaterThan(0);
    expect(qa('[data-testid="lunch-amount"]')).toHaveLength(1);
    const tl = q('[data-testid="timeline"]')!;
    expect(tl.querySelector('[data-testid="lunch-photos"]')).toBeNull();
    expect(tl.querySelector('[data-testid="lunch-amount"]')).toBeNull();
    expect(tl.querySelector('[data-tl="lunch"]')?.textContent).toContain('Lunch');
    expect(q('[data-testid="lunch-card"]')!.contains(q('[data-testid="lunch-photos"]'))).toBe(true);
  });

  it('a weekday she did not come: a gentle sentence, the programme as "what was on", a way to her last visit', async () => {
    const view = open('f1');
    const came = new Set(visitDays(view, 'm1', T));
    const missed = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 20 - i)).toISOString().slice(0, 10)).find((d) => !came.has(d) && ![0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay()))!;
    await show(<FamilyToday />, `/today?member=m1&date=${missed}`);
    expect(q('[data-testid="story-hero"]')?.textContent).toMatch(/Oma Lina didn’t come on /);
    expect(q('[data-testid="timeline"]')?.getAttribute('data-kind')).toBe('wasOn');
    expect(text()).toContain('What was on');
    expect(q('[data-testid="last-visit"]')).toBeTruthy();
    expect(q('[data-testid="hero-rail"]')).toBeNull();
    expect(Array.from(document.querySelectorAll('[data-tl]')).every((x) => x.getAttribute('data-state') === 'up')).toBe(true);
    expect(q('[data-testid="daily-log"]')).toBeNull(); // a day she did not come has no log
  });

  it('both parents: one card with a row each; a row focuses on that parent and "Both parents" goes back', async () => {
    open('f1');
    await show(<FamilyToday />, '/today');
    expect(document.querySelectorAll('[data-testid="story-hero"]')).toHaveLength(1);
    expect(q('[data-testid="story-hero"]')?.getAttribute('data-mode')).toBe('both');
    const rows = document.querySelectorAll('[data-testid="parent-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Oma Lina');
    expect(rows[1].textContent).toContain('Opa Budi');
    expect(q('[data-testid="all-parents"]')?.getAttribute('aria-pressed')).toBe('true'); // KC round 9: the switch is always there
    await click(rows[1]);
    expect(q('[data-testid="story-hero"]')?.getAttribute('data-mode')).toBe('single');
    expect(q('[data-testid="story-hero"]')?.getAttribute('data-member')).toBe('m46');
    await click(q('[data-testid="all-parents"]'));
    expect(q('[data-testid="story-hero"]')?.getAttribute('data-mode')).toBe('both');
  });

  it('one parent at the club: LIVE, since when, the rail up to now, and Next from the step now', async () => {
    open('fm10_0', 'en', 10 * 60 + 40); // 10:40, Bapak Bambang checked in at 09:48
    await show(<FamilyToday />, '/today');
    expect(q('[data-testid="all-parents"]')).toBeNull(); // one parent: nothing to switch
    const hero = q('[data-testid="story-hero"]')!;
    expect(hero.getAttribute('data-mode')).toBe('single');
    expect(hero.textContent).toContain('At the club since 09:48');
    expect(q('[data-testid="hero-pill"]')?.textContent).toBe('Live');
    const states = Array.from(document.querySelectorAll('[data-testid="hero-rail"] [data-step]')).map((x) => x.getAttribute('data-state'));
    expect(states[0]).toBe('done');
    expect(states).toContain('now');
    expect(states).toContain('up');
    expect(q('[data-testid="timeline"]')?.getAttribute('data-kind')).toBe('next');
    expect(q('[data-testid="timeline"] [data-state="now"]')).toBeTruthy();
    expect(Array.from(document.querySelectorAll('[data-tl]')).some((x) => x.getAttribute('data-state') === 'done')).toBe(false); // what is over is not listed under Next
  });

  it('both parents on a day both came: the daily log names each parent, one card each', async () => {
    const view = open('f1');
    const both = visitDays(view, 'm1', T).filter((d) => d < T && visitDays(view, 'm46', T).includes(d)).pop()!;
    await show(<FamilyToday />, `/today?date=${both}`);
    const blocks = qa('[data-testid="daily-log"] [data-testid="log-block"]');
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(b.textContent).toMatch(/Oma Lina|Opa Budi/);
    expect(new Set(blocks.map((b) => b.getAttribute('data-member'))).size).toBe(blocks.length);
  });

  it('in the club today before the team has logged anything: every round is there, each reading "Not logged yet" (lunch on its own card)', async () => {
    open('fm10_0', 'en', 10 * 60 + 40);
    await show(<FamilyToday />, '/today');
    const log = q('[data-testid="daily-log"]')!;
    expect(log.querySelectorAll('[data-testid="log-block"]')).toHaveLength(1);
    expect(q('[data-testid="lunch-amount"]')?.textContent).toContain('Not logged yet'); // the Lunch card carries how much was eaten
    expect(q('[data-testid="lunch-amount"]')?.getAttribute('data-amount')).toBe('');
    expect(log.querySelector('[data-testid="log-lunch"]')).toBeNull();
    const sessions = Array.from(log.querySelectorAll('[data-testid="log-session"]'));
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((x) => x.getAttribute('data-took') === 'none' && /Not logged yet/.test(x.textContent || ''))).toBe(true);
    // round 14: the door's Check-in face is already the day's mood (the other rounds are not logged yet)
    expect(log.querySelector('[data-testid="log-mood"]')?.getAttribute('data-logged')).toBe('1');
    expect(log.querySelector('[data-testid="log-mood"]')?.getAttribute('data-mood')).toBeTruthy();
    expect(log.querySelector('[data-moment]')).toBeNull(); // one face only, no face per moment
    expect(log.querySelector('[data-testid="log-note-none"]')?.textContent).toContain('Not logged yet');
    expect(log.querySelector('[data-testid="team-note"]')).toBeNull();
    expect(log.textContent).not.toContain('The team fills this in');
  });

  it('round 14: the Mood row at the top of the daily log: one face, the average of the marked moments, with its word and meaning; no face per moment anywhere', async () => {
    const full = produce(buildSeed().citra, (d) => {
      d.attendance[`${T}:m1`] = { id: `${T}:m1`, clubId: d.clubId, createdAt: `${T}T10:00`, createdBy: 'staff:s1', memberId: 'm1', date: T, checkIn: { at: '10:00', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] };
      for (const [moment, time, face] of [['arrival', '10:00', 5], ['morning', '10:30', 3]] as const) {
        const id = moodId(T, 'm1', moment);
        d.moodMarks[id] = { id, clubId: d.clubId, createdAt: `${T}T${time}`, createdBy: 'staff:s1', memberId: 'm1', date: T, time, moment, face, by: 'staff:s1' };
      }
    });
    open('f1', 'en', 11 * 60, full);
    await show(<FamilyToday />, '/today?member=m1');
    const log = q('[data-testid="daily-log"]')!;
    const mood = log.querySelector('[data-testid="log-mood"]')!;
    expect(mood.getAttribute('data-mood')).toBe('4');
    expect(mood.textContent).toContain('Good');
    expect(mood.textContent).toContain('Engaged and content');
    expect(q('[data-moment]')).toBeNull(); // no face per moment
    expect(document.body.textContent).not.toContain('feeling'); // the timeline names no moment's face either
    expect(log.querySelector('[data-testid="log-block"]')!.firstElementChild!.firstElementChild).toBe(mood); // the first row of the card
    expect(q('[data-testid="hero-mood"]')?.textContent).toContain('Good'); // the hero shows the face too
    expect(q('[data-testid="hero-mood"]')?.textContent).toContain('Engaged and content');
  });
  it('round 14: both parents: each row that came shows the face and its word (no hint)', async () => {
    const full = produce(buildSeed().citra, (d) => {
      d.attendance[`${T}:m1`] = { id: `${T}:m1`, clubId: d.clubId, createdAt: `${T}T10:00`, createdBy: 'staff:s1', memberId: 'm1', date: T, checkIn: { at: '10:00', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] };
      const id = moodId(T, 'm1', 'arrival');
      d.moodMarks[id] = { id, clubId: d.clubId, createdAt: `${T}T10:00`, createdBy: 'staff:s1', memberId: 'm1', date: T, time: '10:00', moment: 'arrival', face: 4, by: 'staff:s1' };
    });
    open('f1', 'en', 11 * 60, full);
    await show(<FamilyToday />, '/today');
    expect(q('[data-testid="story-hero"]')?.getAttribute('data-mode')).toBe('both');
    const rows = qa('[data-testid="parent-row"]');
    const lina = rows.find((r) => r.getAttribute('data-member') === 'm1')!;
    expect(lina.querySelector('[data-testid="row-mood"]')?.textContent).toContain('Good');
    expect(lina.querySelector('[data-testid="row-mood"]')?.textContent).not.toContain('Engaged');
    expect(lina.querySelector('[data-testid="row-mood"] [data-face]')?.getAttribute('data-face')).toBe('4');
    expect(rows.find((r) => r.getAttribute('data-member') === 'm46')!.querySelector('[data-testid="row-mood"]')).toBeNull(); // Opa Budi has not come
  });

  it('both parents on a past day: one block each with every round; a round with nothing approved reads "Not logged" (no "yet")', async () => {
    const view = open('f1');
    const m1 = view.members.m1;
    // a day she came where the team wrote no note
    const noNote = visitDays(view, 'm1', T).filter((d) => d < T).find((d) => !dayStory(view, m1, d, END_OF_DAY).log?.note);
    expect(noNote).toBeTruthy();
    await show(<FamilyToday />, `/today?member=m1&date=${noNote}`);
    const log = q('[data-testid="daily-log"]')!;
    expect(log.querySelector('[data-testid="log-note-none"]')?.textContent).toMatch(/Not logged$/);
    expect(log.querySelector('[data-testid="team-note"]')).toBeNull();
    expect(log.textContent).not.toContain('Not logged yet');
  });

  it('the Health section: after the daily log, a card per parent who came with the day’s checks, status pills and a button to the Health tab', async () => {
    const view = open('f1');
    const both = visitDays(view, 'm1', T).filter((d) => d < T && visitDays(view, 'm46', T).includes(d)).pop()!;
    await show(<Routes><Route path="/today" element={<FamilyToday />} /><Route path="/health" element={<Where />} /></Routes>, `/today?date=${both}`);
    const sec = q('[data-testid="today-health"]')!;
    expect(sec).toBeTruthy();
    expect(q('[data-testid="daily-log"]')!.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // right after the daily log
    const blocks = Array.from(sec.querySelectorAll('[data-testid="health-block"]'));
    expect(blocks.map((b) => b.getAttribute('data-member'))).toEqual(['m1', 'm46']);
    const checks = Array.from(sec.querySelectorAll('[data-testid="health-check"]'));
    expect(checks.length).toBeGreaterThan(1);
    expect(checks.every((c) => ['arrival', 'departure', 'recheck', 'spot', 'monthly'].includes(c.getAttribute('data-kind') || ''))).toBe(true);
    expect(sec.querySelector('[data-testid="health-pill"]')?.getAttribute('data-status')).toMatch(/normal|watch|alert/);
    expect(['Normal', 'Watch', 'Alert'].some((w) => sec.textContent?.includes(w))).toBe(true);
    expect(sec.querySelector('[data-metric="bp"]')?.textContent).toMatch(/\d{2,3}\/\d{2,3}/); // blood pressure
    expect(sec.textContent).toMatch(/checked by/);
    const open1 = sec.querySelector('[data-testid="health-open"][data-member="m46"]') as HTMLElement;
    expect(open1.textContent).toContain('Opa Budi’s health');
    await click(open1);
    expect(q('[data-testid="where"]')?.textContent).toBe('/health?member=m46');
  });

  it('the Health section for one parent: "Open Health"; a day she came with no check says so in one quiet line', async () => {
    const view = open('f1');
    const day = visitDays(view, 'm1', T).filter((d) => d < T).pop()!;
    view.readings = Object.fromEntries(Object.entries(view.readings).filter(([, r]) => !(r.memberId === 'm1' && r.date === day))); // she came, but no check was approved that day
    expect(dayChecks(view, 'm1', day, limitsFor(view, view.members.m1))).toEqual([]);
    await show(<FamilyToday />, `/today?member=m1&date=${day}`);
    const sec = q('[data-testid="today-health"]')!;
    expect(sec.querySelectorAll('[data-testid="health-block"]')).toHaveLength(1);
    expect(sec.querySelector('[data-testid="health-check"]')).toBeNull();
    expect(sec.querySelector('[data-testid="health-none"]')?.textContent).toBe('No health check that day');
    expect((sec.querySelector('[data-testid="health-open"]') as HTMLElement).textContent).toContain('Open Health');
    expect(sec.textContent).not.toContain('Oma Lina’s health'); // one parent in view: no name
  });

  it('on a laptop: a heading above two columns; the picture (a rounded card) and the day strip tiles on the left, the day on the right, and the bell stays with the sidebar', async () => {
    widthOf(1440);
    open('f1');
    await show(<FamilyToday />, '/today?member=m1');
    const hero = q('[data-testid="story-hero"]') as HTMLElement;
    expect(hero.style.borderRadius).toBe('30px');
    expect(hero.style.position).toBe('relative');
    const panel = q('[data-testid="today-panel"]') as HTMLElement;
    expect(panel.style.marginTop).toBe(''); // no white panel over the picture
    expect(panel.querySelector('[aria-hidden="true"][style*="width: 36px"]')).toBeNull(); // no grab handle
    expect(hero.parentElement?.parentElement).toBe(panel.parentElement); // the picture's column and the day are the two columns of one grid
    expect(hero.parentElement).not.toBe(panel);
    expect(qa('[data-bell-anchor]')).toHaveLength(0); // the sidebar has Notifications
    expect(q('[data-testid="today-heading"] h1')?.textContent).toMatch(/^Good (morning|afternoon|evening), Maria$/);
    expect(hero.querySelector('h1')).toBeNull(); // the heading is the page's h1; the picture's title is an h2
    expect(hero.querySelector('h2')?.textContent).toMatch(/Oma Lina/);
    const strip = q('[data-testid="day-strip"]') as HTMLElement; // six tiles under the picture, not in the day's column
    expect(strip.getAttribute('data-layout')).toBe('tiles');
    expect(hero.parentElement?.contains(strip)).toBe(true);
    expect(panel.contains(strip)).toBe(false);
    expect(panel.contains(q('[data-testid="timeline"]'))).toBe(true);
  });

  it('on a phone: the picture is full-bleed under a sliding white panel, with the bell on it', async () => {
    widthOf(390);
    open('f1');
    await show(<FamilyToday />, '/today?member=m1');
    expect((q('[data-testid="story-hero"]') as HTMLElement).style.position).toBe('sticky');
    expect((q('[data-testid="today-panel"]') as HTMLElement).style.marginTop).toBe('-28px');
    expect(qa('[data-bell-anchor]')).toHaveLength(1);
  });

  it('tell the kitchen about lunch: a grey row opens the sheet; Send needs a few words', async () => {
    const view = open('f1');
    const day = visitDays(view, 'm1', T).filter((d) => d < T).sort().reverse()[0]; // the row shows only on a day one of them came (and had lunch)
    await show(<FamilyToday />, `/today?member=m1&date=${day}`);
    await click(q('[data-testid="lunch-feedback-row"]'));
    const dialog = q('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Lunch feedback');
    const send = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Send') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    const ta = dialog.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, 'The soup was a little salty');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(send.disabled).toBe(false);
    await click(send);
    expect(actMock).toHaveBeenCalledTimes(1);
    expect((actMock.mock.calls[0] as unknown[])[0]).toBe('feedback.submit');
  });

  it('in Indonesian: warm wording, no raw keys', async () => {
    const view = open('f1', 'id');
    const day = visitDays(view, 'm1', T).filter((d) => d < T).pop()!;
    await show(<FamilyToday />, `/today?member=m1&date=${day}`);
    expect(q('[data-testid="story-hero"] h1')?.textContent).toMatch(/Oma Lina/); // the day's title, in Indonesian
    expect(q('[data-testid="back-to-today"]')?.textContent).toBe('Hari ini');
    expect(text()).toMatch(/Tiba \d\d:\d\d · Pulang \d\d:\d\d/);
    expect(text()).toContain('Hari itu');
    expect(text()).not.toMatch(/\b(family|ftoday|fam)\.[a-z]/i);
  });
});

describe('family Today: the face at the door (round 12)', () => {
  it('the hero shows the day\u2019s mood once, as a face, its word and its meaning under the status ("At the club since 10:00"), not as "feeling okay" in it', async () => {
    const view = projectForFamily(withMarks, 'f1');
    open('f1');
    useReplica.setState({ confirmed: view, view, clock: { today: T, startMin: 16 * 60, realStart: Date.now(), offset: 0 } });
    await show(<FamilyToday />, '/today?member=m1');
    const hero = q('[data-testid="story-hero"]')!;
    expect(q('[data-testid="hero-status"]')?.textContent).toBe('At the club since 10:00');
    expect(hero.textContent).not.toContain('feeling');
    const mood = q('[data-testid="hero-mood"]')!; // her marks: Okay at the door, Great leaving: the day is Good
    expect(mood.getAttribute('data-testid')).toBe('hero-mood');
    expect(mood.textContent).toContain('Good');
    expect(mood.textContent).toContain('Engaged and content'); // the hint is small text, not a tooltip
    expect(mood.querySelector('[title]')).toBeNull();
  });
});
