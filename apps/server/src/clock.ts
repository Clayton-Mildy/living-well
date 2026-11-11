// Shared demo clock: the demo day (today in Jakarta, or the next open day), starting 09:58, running in real time.
// Stored in meta so every device agrees. CP_DEMO_DATE pins the day (tests use 2026-10-21, the seed's own date).
import { DEMO_START_MIN, demoDateFor, demoNowMinFor, toHM, type ClockInfo } from '@cp/shared';

/** The day a fresh demo starts on. */
export const demoDate = () => demoDateFor(new Date(), process.env.CP_DEMO_DATE);
/** The time a fresh demo starts at: now in Jakarta (pinned tests start at 09:58). */
export const demoNowMin = () => (process.env.CP_DEMO_DATE ? DEMO_START_MIN : demoNowMinFor(new Date()));
import { getMeta, setMeta } from './db/store';

/** `custom`: the demo tools set the time (it runs on from there); `trip`: the demo was rebuilt as the field trip day (seed/tripToday.ts). */
export interface ClockState { realStart: number; startMin: number; date: string; custom?: boolean; trip?: boolean; /** the real demo day when this demo started (the clock's own date may be moved by the tests) */ realDay?: string }
let clock: ClockState = { realStart: Date.now(), startMin: demoNowMin(), date: demoDate(), realDay: demoDate() };

export async function loadClock() {
  const c = await getMeta<ClockState>('clock');
  if (c) clock = c;
  else await setMeta('clock', clock);
}
export function clockInfo(): ClockInfo & { now: string; realStart: number; startMin: number; custom: boolean; trip: boolean } {
  const nowMin = Math.min(23 * 60 + 59, clock.startMin + Math.floor((Date.now() - clock.realStart) / 60000));
  return { today: clock.date, nowMin, now: toHM(nowMin), realStart: clock.realStart, startMin: clock.startMin, custom: !!clock.custom, trip: !!clock.trip };
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
/** A fresh demo day: now in Jakarta, or (the demo tools) a chosen minute of the day, running on from there. */
/** The real day moved on since this demo started (a server left running overnight). Never with CP_DEMO_DATE: the pinned day does not move, whatever date the tests move the clock to. */
export const realDayChanged = () => demoDate() !== (clock.realDay ?? clock.date);
export async function resetClock(opts: { startMin?: number; trip?: boolean } = {}) {
  const custom = opts.startMin !== undefined;
  clock = { realStart: Date.now(), startMin: custom ? opts.startMin! : demoNowMin(), date: demoDate(), realDay: demoDate(), ...(custom ? { custom: true } : {}), ...(opts.trip ? { trip: true } : {}) };
  await setMeta('clock', clock);
  return clockInfo();
}
