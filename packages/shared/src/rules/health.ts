// Health thresholds and the nurse queue.
import type { ClubState, Health, HealthLimits, ISODate, HM, LimitKey, Reading, QueueKind, Member, GuestVisit } from '../types';
import { lobbyGroups, attOf, guestsOn } from './attendance';
import { live, sortBy, toMin, ym } from '../util';

export const worst = (a: Health[]): Health => (a.includes('alert') ? 'alert' : a.includes('watch') ? 'watch' : 'normal');

// ---------- Watch / Alert limits (a club setting the nurse or management can change) ----------
/** How a limit is compared: 'from' = at or above, 'above' = over, 'below' = under. */
export const LIMIT_CMP: Record<LimitKey, 'from' | 'above' | 'below'> = {
  sysHigh: 'from', diaHigh: 'from', sysLow: 'below', pulseHigh: 'above', pulseLow: 'below', spo2Low: 'below',
  tempHigh: 'from', tempLow: 'below', gluHigh: 'above', gluLow: 'below', weightChange: 'from',
};
export const LIMIT_KEYS = Object.keys(LIMIT_CMP) as LimitKey[];
export const DEFAULT_LIMITS: HealthLimits = {
  sysHigh: { watch: 140, alert: 160 }, diaHigh: { watch: 90, alert: 100 }, sysLow: { watch: 100, alert: 90 },
  pulseHigh: { watch: 100, alert: 120 }, pulseLow: { watch: 60, alert: 50 }, spo2Low: { watch: 95, alert: 92 },
  tempHigh: { watch: 37.5, alert: 38 }, tempLow: { watch: null, alert: 35.5 },
  gluHigh: { watch: 180, alert: 250 }, gluLow: { watch: null, alert: 70 }, weightChange: { watch: 3, alert: null },
};
/** Plausible values for each limit (what the settings form and the action accept). */
export const LIMIT_RANGE: Record<LimitKey, [number, number]> = {
  sysHigh: [100, 250], diaHigh: [60, 150], sysLow: [60, 140], pulseHigh: [60, 220], pulseLow: [20, 100], spo2Low: [70, 100],
  tempHigh: [36, 42], tempLow: [30, 37], gluHigh: [100, 600], gluLow: [20, 150], weightChange: [0.5, 20],
};
/** The club's limits (defaults for any not set). */
export const limitsOf = (s?: Pick<ClubState, 'club'> | null): HealthLimits => ({ ...DEFAULT_LIMITS, ...(s?.club?.settings.limits || {}) });
/**
 * A member's own limits (KC round 7): the club's limits, with any key the member has of their own taking over (the whole Watch + Alert pair of that key).
 * Takes the member row or its id; guests and anyone unknown follow the club. Every grade of a member goes through this.
 */
export function limitsFor(s: Pick<ClubState, 'club'> & Partial<Pick<ClubState, 'members'>>, member?: Pick<Member, 'limits'> | string | null): HealthLimits {
  const m = typeof member === 'string' ? s.members?.[member] : member;
  const out = limitsOf(s);
  for (const k of LIMIT_KEYS) { const own = m?.limits?.[k]; if (own) out[k] = { watch: own.watch ?? null, alert: own.alert ?? null }; }
  return out;
}
/** The limits a member has of their own (none = they follow the club's). */
export const ownLimitKeys = (m?: Pick<Member, 'limits'> | null): LimitKey[] => LIMIT_KEYS.filter((k) => !!m?.limits?.[k]);
/** Watch and Alert must be in order: for a high limit Alert is the higher one, for a low limit the lower one. */
export function limitOrderOk(k: LimitKey, l: { watch: number | null; alert: number | null }): boolean {
  if (l.watch == null || l.alert == null) return l.watch != null || l.alert != null;
  return LIMIT_CMP[k] === 'below' ? l.alert < l.watch : l.alert > l.watch;
}
function past(k: LimitKey, v: number, L: HealthLimits): Health {
  const cmp = LIMIT_CMP[k];
  const over = (x: number | null) => x != null && (cmp === 'from' ? v >= x : cmp === 'above' ? v > x : v < x);
  const l = L[k] ?? DEFAULT_LIMITS[k];
  return over(l.alert) ? 'alert' : over(l.watch) ? 'watch' : 'normal';
}
export const bpStatus = (s: number, d: number, L: HealthLimits = DEFAULT_LIMITS): Health => worst([past('sysHigh', s, L), past('diaHigh', d, L), past('sysLow', s, L)]);
export const spo2Status = (v: number, L: HealthLimits = DEFAULT_LIMITS): Health => past('spo2Low', v, L);
export const gluStatus = (v: number, L: HealthLimits = DEFAULT_LIMITS): Health => worst([past('gluHigh', v, L), past('gluLow', v, L)]);
export const tempStatus = (v: number, L: HealthLimits = DEFAULT_LIMITS): Health => worst([past('tempHigh', v, L), past('tempLow', v, L)]);
export const pulseStatus = (v: number, L: HealthLimits = DEFAULT_LIMITS): Health => worst([past('pulseHigh', v, L), past('pulseLow', v, L)]);
export const weightStatus = (w: number, prev?: number, L: HealthLimits = DEFAULT_LIMITS): Health => (prev != null ? past('weightChange', Math.abs(w - prev), L) : 'normal');

/** Overall status of a reading: worst single result. */
export function evaluateReading(r: Partial<Reading>, prevWeight?: number, L: HealthLimits = DEFAULT_LIMITS): Health {
  const st: Health[] = [];
  if (r.sys != null && r.dia != null) st.push(bpStatus(r.sys, r.dia, L));
  if (r.spo2 != null) st.push(spo2Status(r.spo2, L));
  if (r.temp != null) st.push(tempStatus(r.temp, L));
  if (r.glucose != null) st.push(gluStatus(r.glucose, L));
  if (r.pulse != null) st.push(pulseStatus(r.pulse, L));
  if (r.weight != null) st.push(weightStatus(r.weight, prevWeight, L));
  return worst(st);
}

export const validReadings = (s: ClubState) => live(s.readings).filter((r) => !r.voided);
export const readingsOf = (s: ClubState, memberId: string) =>
  sortBy(validReadings(s).filter((r) => r.memberId === memberId), (r) => r.date + r.time);
export const todayReading = (s: ClubState, memberId: string, date: ISODate, kind: Reading['kind']) => {
  const r = readingsOf(s, memberId).filter((x) => x.date === date && x.kind === kind);
  return r[r.length - 1];
};
export const latestBp = (s: ClubState, memberId: string) => readingsOf(s, memberId).filter((r) => r.sys != null).pop();
export const lastBefore = (s: ClubState, memberId: string, date: ISODate, field: keyof Reading) =>
  readingsOf(s, memberId).filter((r) => r.date < date && r[field] != null).pop();
export const monthlyDue = (s: ClubState, memberId: string, date: ISODate) =>
  !validReadings(s).some((r) => r.memberId === memberId && ym(r.date) === ym(date) && r.glucose != null);
export const weightDue = (s: ClubState, memberId: string, date: ISODate) =>
  !validReadings(s).some((r) => r.memberId === memberId && ym(r.date) === ym(date) && r.weight != null);

export interface QueueItem {
  key: string; // `${kind}:${personId}`
  person: { type: 'member'; m: Member } | { type: 'guest'; g: GuestVisit };
  personId: string;
  kind: QueueKind;
  due: HM;
  since: HM; // arrival time
  monthly: boolean; // glucose/weight also due this month
  note?: string;
}
export interface NurseQueue {
  todo: QueueItem[]; // due now
  later: QueueItem[]; // due later today (e.g. re-check at 10:23)
  done: Reading[]; // today's readings (non-monthly-only), newest first
}

/** @deprecated use `stationQueue` (rules/healthStation.ts), the corrected queue the app uses. Kept for older tests. */
export function nurseQueue(s: ClubState, date: ISODate, nowMin: number): NurseQueue {
  const g = lobbyGroups(s, date);
  const items: QueueItem[] = [];
  const depFrom = toMin(s.club.settings.departureFrom);
  for (const row of g.inClub) {
    const m = row.m;
    const a = attOf(s, date, m.id)!;
    const since = a.checkIn!.at;
    const dismissed = (k: QueueKind) => a.dismissed.some((d) => d.kind === k);
    const monthly = monthlyDue(s, m.id, date);
    const arr = todayReading(s, m.id, date, 'arrival');
    if (!arr && !dismissed('arrival')) items.push({ key: 'arrival:' + m.id, person: { type: 'member', m }, personId: m.id, kind: 'arrival', due: since, since, monthly });
    if (arr && a.recheckDueAt && !dismissed('recheck')) {
      const done = validReadings(s).some((r) => r.memberId === m.id && r.date === date && r.kind === 'recheck' && r.time >= arr.time);
      if (!done) items.push({ key: 'recheck:' + m.id, person: { type: 'member', m }, personId: m.id, kind: 'recheck', due: a.recheckDueAt, since, monthly: false });
    }
    const dep = todayReading(s, m.id, date, 'departure');
    if (arr && !dep && !dismissed('departure') && (a.departureAsked || nowMin >= depFrom)) {
      items.push({ key: 'departure:' + m.id, person: { type: 'member', m }, personId: m.id, kind: 'departure', due: a.departureAsked?.at || s.club.settings.departureFrom, since, monthly: false });
    }
    if (arr && a.monthlyDeferred && monthly && !dismissed('monthly')) items.push({ key: 'monthly:' + m.id, person: { type: 'member', m }, personId: m.id, kind: 'monthly', due: arr.time, since, monthly: true });
    for (const q of a.queueAdds) {
      if (q.kind !== 'spot' || dismissed('spot')) continue;
      const done = validReadings(s).some((r) => r.memberId === m.id && r.date === date && r.kind === 'spot' && r.time >= q.at);
      if (!done) items.push({ key: 'spot:' + m.id + ':' + q.at, person: { type: 'member', m }, personId: m.id, kind: 'spot', due: q.at, since, monthly: false, note: q.note });
    }
  }
  for (const gv of guestsOn(s, date)) {
    if (!gv.healthCheck || !gv.checkIn || gv.checkOut) continue;
    const done = validReadings(s).some((r) => r.guestId === gv.id && r.date === date);
    if (!done) items.push({ key: 'arrival:' + gv.id, person: { type: 'guest', g: gv }, personId: gv.id, kind: 'arrival', due: gv.checkIn.at, since: gv.checkIn.at, monthly: false });
  }
  const name = (q: QueueItem) => (q.person.type === 'member' ? q.person.m.firstName : q.person.g.name);
  const sorted = sortBy(items, (q) => q.due + name(q));
  const done = sortBy(validReadings(s).filter((r) => r.date === date && r.kind !== 'monthly'), (r) => r.time, -1);
  return { todo: sorted.filter((q) => toMin(q.due) <= nowMin), later: sorted.filter((q) => toMin(q.due) > nowMin), done };
}

/** Badge key + colours shared by health and payment statuses (design BADGE table). */
export const BADGE = {
  normal: ['check_circle', '#3D6B4F', '#E3EFE6'],
  watch: ['visibility', '#7A5510', '#F6ECD6'],
  alert: ['warning', '#FFFFFF', '#9A3D24'],
  paid: ['check_circle', '#3D6B4F', '#E3EFE6'],
  outstanding: ['schedule', '#24201C', '#E8E1D8'],
  partial: ['hourglass_top', '#24201C', '#E8E1D8'],
  overdue: ['error', '#FFFFFF', '#9A3D24'],
  pending: ['schedule', '#24201C', '#E8E1D8'],
  void: ['block', '#5E5852', '#F0EAE1'],
} as const;
export type BadgeKey = keyof typeof BADGE;
