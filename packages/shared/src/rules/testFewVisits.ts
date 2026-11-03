// Test fixture (round 17): the seed on 15 Nov 2026, the day the few-visits list opens, with the visit days of November laid out by hand.
// The five seeded members each came 5 times (not flagged). Six more members (Fajar … Kartika, copies of Oma Lina's record) came 4, 3, 3, 2, 1 and 0 times
// (flagged) · Joko has a call logged this month. Visit days: Fajar 2 3 4 5 · Gita 2 3 4 · Hasan 2 5 9 · Indah 2 3 · Joko 4 · Kartika none.
import { produce } from 'immer';
import { buildSeed } from '../index';
import type { ClubState } from '../types';

export const FEW_DAY = '2026-11-15';
export const FEW_MONTH = '2026-11';
/** The six flagged members in the order of their visits: fv1 has 4 visits, fv6 has none. */
export const FEW_IDS = ['fv1', 'fv2', 'fv3', 'fv4', 'fv5', 'fv6'] as const;
const NAMES = ['Fajar', 'Gita', 'Hasan', 'Indah', 'Joko', 'Kartika'];
const VISITS: string[][] = [['02', '03', '04', '05'], ['02', '03', '04'], ['02', '05', '09'], ['02', '03'], ['04'], []];

export const withFewVisits = (): ClubState => {
  const base = buildSeed().citra;
  return produce(base, (d) => {
    const visit = (memberId: string, day: string) => {
      const date = `2026-11-${day}`;
      d.attendance[`${date}:${memberId}`] = { id: `${date}:${memberId}`, clubId: d.clubId, createdAt: `${date}T09:00`, createdBy: 'staff:s1', memberId, date, checkIn: { at: '09:00', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] };
    };
    for (const id of Object.keys(d.members)) {
      for (const day of ['02', '03', '04', '05', '06']) visit(id, day);
      // the five carry on, whatever the seed has for them
      d.members[id].memberships.forEach((ms) => { ms.leaves = (ms.leaves ?? []).filter((l) => l.month > FEW_MONTH); delete ms.lastDay; });
    }
    FEW_IDS.forEach((id, i) => {
      const m = structuredClone(base.members.m1);
      Object.assign(m, { id, firstName: NAMES[i], lastName: 'Visitor' });
      delete m.registration; // no nickname: the list shows the full name
      m.memberships = [{ start: '2025-03-03' }];
      m.plans = [{ from: '2025-03-03', plan: 'flex', by: 'staff:s1' }];
      d.members[id] = m;
      // the same family as Oma Lina, so each has a billing contact to call
      for (const l of Object.values(base.familyLinks).filter((x) => x.memberId === 'm1')) d.familyLinks[`${l.id}-${id}`] = { ...l, id: `${l.id}-${id}`, memberId: id };
      for (const day of VISITS[i]) visit(id, day);
    });
    d.visitCalls['vc-fv5'] = { id: 'vc-fv5', clubId: d.clubId, createdAt: `${FEW_DAY}T09:30`, createdBy: 'staff:s1', memberId: 'fv5', month: FEW_MONTH, outcome: 'noAnswer', by: 'staff:s1', at: `${FEW_DAY}T09:30` };
  });
};
