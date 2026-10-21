// Round 12 seed: two roster members who have gone quiet, so the "Check on" list is not empty on the demo day.
// Endang Suryani (m57, Flex) last came 20 days ago; Hendrik Wongso (m90, Gold) 22 days ago. Their later visits are removed with everything that hangs off them
// (readings, logs, photo tags), so nothing dangles. Caca phoned Endang's family a week ago: travelling, ask again in five days, so she is not on the list yet.
// Runs before the mood marks (which are written for every seeded visit), and does nothing in the 5-member test world (no roster). No random draws.
import type { ClubState, ISODate } from '../../types';
import { addDays, live } from '../../util';
import { renewalContact } from '../../rules/renewals';

const QUIET: [string, number][] = [['m57', 20], ['m90', 22]];

function goQuiet(s: ClubState, memberId: string, lastDay: ISODate): void {
  for (const [k, a] of Object.entries(s.attendance)) if (a.memberId === memberId && a.date > lastDay) delete s.attendance[k];
  for (const [k, r] of Object.entries(s.readings)) if (r.memberId === memberId && r.date > lastDay && r.kind !== 'monthly') delete s.readings[k];
  for (const [k, l] of Object.entries(s.dailyLogs)) if (l.memberId === memberId && l.date > lastDay) delete s.dailyLogs[k];
  for (const [k, p] of Object.entries(s.photos)) {
    if (p.date <= lastDay || !p.memberIds.includes(memberId)) continue;
    p.memberIds = p.memberIds.filter((id) => id !== memberId);
    if (!p.memberIds.length && p.kind === 'arrival') delete s.photos[k];
  }
  for (const [k, m] of Object.entries(s.moodMarks)) if (m.memberId === memberId && m.date > lastDay) delete s.moodMarks[k];
}

export function seedCheckOn(s: ClubState, T: ISODate): void {
  const quiet = QUIET.filter(([id]) => live(s.members).some((m) => m.id === id));
  for (const [id, days] of quiet) goQuiet(s, id, addDays(T, -days));
  const first = quiet[0]?.[0];
  const who = first ? renewalContact(s, first) : undefined;
  if (!first || !who) return;
  const date = addDays(T, -7);
  s.careCalls['cc-seed-1'] = {
    id: 'cc-seed-1', clubId: s.clubId, createdAt: `${date}T10:40`, createdBy: 'staff:s1', memberId: first, date, at: `${date}T10:40`, by: 'staff:s1',
    contactName: who.contact.name, phone: who.contact.phone, outcome: 'travelling', note: 'Visiting family in Surabaya', checkAgainOn: addDays(T, 5),
  };
}
