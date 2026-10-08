// Shared demo clock: the demo day (today in Jakarta, or the next open day), starting 09:58, running in real time.
// Stored in meta so every device agrees. CP_DEMO_DATE pins the day (tests use 2026-10-21, the seed's own date).
import { DEMO_START_MIN, demoDateFor, demoNowMinFor, toHM, type ClockInfo } from '@cp/shared';

/** The day a fresh demo starts on. */
export const demoDate = () => demoDateFor(new Date(), process.env.CP_DEMO_DATE);
/** The time a fresh demo starts at: now in Jakarta (pinned tests start at 09:58). */
export const demoNowMin = () => (process.env.CP_DEMO_DATE ? DEMO_START_MIN : demoNowMinFor(new Date()));
import { getMeta, setMeta } from './db/store';

export interface ClockState { realStart: number; startMin: number; date: string }
let clock: ClockState = { realStart: Date.now(), startMin: demoNowMin(), date: demoDate() };

export async function loadClock() {
  const c = await getMeta<ClockState>('clock');
  if (c) clock = c;
  else await setMeta('clock', clock);
}
export function clockInfo(): ClockInfo & { now: string; realStart: number; startMin: number } {
  const nowMin = Math.min(23 * 60 + 59, clock.startMin + Math.floor((Date.now() - clock.realStart) / 60000));
  return { today: clock.date, nowMin, now: toHM(nowMin), realStart: clock.realStart, startMin: clock.startMin };
}
/** Move the clock to hh:mm (demo only; never backwards unless reset). With a `date` it moves to that day too (the demo tools and the tests use it to reach the 1st and the 3rd of a month). */
export async function setClock(hm: string, allowBack = false, date?: string) {
  const [h, m] = hm.split(':').map(Number);
  const target = h * 60 + m;
  const newDay = !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date !== clock.date;
  if (!allowBack && !newDay && target < clockInfo().nowMin) return clockInfo();
  clock = { ...clock, ...(newDay ? { date } : {}), realStart: Date.now(), startMin: target };
  await setMeta('clock', clock);
  return clockInfo();
}
export async function resetClock() {
  clock = { realStart: Date.now(), startMin: demoNowMin(), date: demoDate() };
  await setMeta('clock', clock);
  return clockInfo();
}
