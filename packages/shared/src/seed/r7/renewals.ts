// KC round 7 seed: renewals. Runs after the main seed (and the roster), so every member, staff row and activity already exists.
// Caca has started the month-end follow-up for the coming month: a few families said they continue, one wants Gold (waiting for management), one has not
// picked up twice, one asked to be called back; in the full roster there is also a downgrade and a leave waiting. Members whose family already asked in the app
// (Bambang's request for Gold) stay untouched, they show as "Asked in the app". Every call is on an earlier day or before the demo start (09:58).
import type { ClubState, FollowUp, FollowUpCall, FollowUpOutcome, ISODate, Member, Plan, YM } from '../../types';
import { addDays, addMonths, monthStart, rng } from '../../util';
import { planOn } from '../../rules/core';
import { askedInApp, followUpId, leaveMonthsCheck, renewalMembers, renewalMonth } from '../../rules/renewals';

type Slot = { kind: FollowUpOutcome; plan?: Plan; calls?: number };
/** In this order, each takes the next member who fits: the 5-member world uses the first four, the full roster all eight. */
const SLOTS: Slot[] = [
  { kind: 'upgrade', plan: 'flex' }, { kind: 'noAnswer', calls: 2 }, { kind: 'callBack' }, { kind: 'continue' }, { kind: 'continue' },
  { kind: 'downgrade', plan: 'gold' }, { kind: 'continue' }, { kind: 'leave' },
];
const NOTES: Partial<Record<FollowUpOutcome, string>> = {
  upgrade: 'Wants the unlimited days; the daughter will pay the difference on the next invoice.',
  callBack: 'Asked to be called after 2 pm.',
  downgrade: 'Comes only twice a week now.',
  leave: 'Away with family for the month.',
};

const idNum = (m: Member) => parseInt(m.id.replace(/\D/g, ''), 10) || 0;

export function seedRenewals(s: ClubState, T: ISODate): void {
  const month: YM = renewalMonth(T);
  const first = monthStart(month);
  const rand = rng(7211);
  const pool = renewalMembers(s, month)
    .filter((m) => !askedInApp(s, m, month))
    .sort((a, b) => idNum(a) - idNum(b) || (a.id < b.id ? -1 : 1));
  const take = (plan?: Plan): Member | undefined => {
    const i = pool.findIndex((m) => !plan || planOn(m, first).plan === plan);
    return i < 0 ? undefined : pool.splice(i, 1)[0];
  };
  /** a call time: an earlier day, or this morning before the demo starts */
  const callAt = (daysBack: number): string => {
    const hh = daysBack === 0 ? 9 : 10 + Math.floor(rand() * 5);
    const mm = daysBack === 0 ? 5 + Math.floor(rand() * 40) : Math.floor(rand() * 60);
    return `${addDays(T, -daysBack)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  s.followUps ??= {};
  let step = 0;
  for (const slot of SLOTS) {
    const m = take(slot.plan);
    if (!m) continue;
    let leaveMonths: YM[] | undefined;
    if (slot.kind === 'leave') {
      // only a leave the rules allow today: the month itself while its notice is open, else the one after
      leaveMonths = [month, addMonths(month, 1)].map((x) => [x]).find((x) => leaveMonthsCheck(s, m, x, T).ok);
      if (!leaveMonths) continue;
    }
    const nCalls = slot.calls ?? 1;
    const lastBack = step % 3; // 0 = this morning, before the demo starts
    const calls: FollowUpCall[] = Array.from({ length: nCalls }, (_, i) => ({
      at: callAt(lastBack + (nCalls - 1 - i) * 2), by: 'staff:s1' as const, outcome: slot.kind, ...(i === nCalls - 1 && NOTES[slot.kind] ? { note: NOTES[slot.kind]! } : {}),
    }));
    step++;
    const last = calls[calls.length - 1];
    const waiting = slot.kind === 'upgrade' || slot.kind === 'downgrade' || slot.kind === 'leave';
    const id = followUpId(month, m.id);
    const row: FollowUp = {
      id, clubId: s.clubId, createdAt: calls[0].at, createdBy: 'staff:s1', memberId: m.id, month, outcome: slot.kind, calls,
      status: waiting ? 'pending' : slot.kind === 'continue' ? 'done' : 'open',
      ...(last.note ? { note: last.note } : {}), ...(leaveMonths ? { leaveMonths } : {}),
      ...(waiting ? { approval: { status: 'pending' as const, by: 'staff:s1' as const, at: last.at } } : {}),
    };
    s.followUps[id] = row;
  }
}
