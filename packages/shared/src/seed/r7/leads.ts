// Round 13 seed: the lead history (Enquiries -> History, the lead timeline, the Month report pipeline). No random draws: everything is derived from the leads' own
// fields and fixed tables, so no seeded stream shifts.
//   1. every live lead without a history gets one from its fields (the guest rows it booked, its stage, its lost reason, its member's start)
//   2. roster only: a joined lead for each member who joined in the last six months, and eight lost or stalled leads spread over the months before T
// Seeded past leads carry no `next` (a lead's next step is a future date), and the ids start with `e-h` so they never match the numbered `e1, e2…` that new leads continue from.
import type { ClubState, DT, Enquiry, FamilyLink, ISODate, LeadMove, LostReason } from '../../types';
import { currentMembership, linksOfMember, memberName, primaryContact } from '../../rules/core';
import { ENQ_SOURCES } from '../../rules/enquiries';
import { addDays, addMonths, e164, live, sortBy, ym } from '../../util';

const at = (date: ISODate, hm = '10:00'): DT => `${date}T${hm}`;
const dayOf = (dt: DT): ISODate => dt.slice(0, 10);

/** The history of a lead that has none, read from what the lead looks like now. */
function derive(s: ClubState, e: Enquiry): LeadMove[] {
  const moves: LeadMove[] = [{ stage: 'new', at: e.createdAt, by: e.createdBy }];
  const guests = sortBy(live(s.guestVisits).filter((g) => g.enquiryId === e.id && g.status !== 'cancelled'), (g) => g.createdAt + g.date);
  let trialSeen = false;
  for (const g of guests) {
    if (g.kind === 'trial') { if (trialSeen) continue; trialSeen = true; } // day 2 of a trial is the same booking
    moves.push({ stage: g.kind, at: g.createdAt, by: g.createdBy, date: g.date });
  }
  const seen = new Set(moves.map((m) => m.stage));
  if ((e.stage === 'visit' || e.stage === 'trial') && !seen.has(e.stage)) {
    moves.push({ stage: e.stage, at: at(addDays(dayOf(e.createdAt), 1)), by: e.createdBy, ...(e.next?.date ? { date: e.next.date } : {}) });
  }
  if (e.stage === 'lost') {
    const prev = e.lost?.prevStage;
    if (prev && prev !== 'new' && prev !== 'lost' && !seen.has(prev)) moves.push({ stage: prev, at: at(addDays(dayOf(e.createdAt), 3)), by: e.createdBy });
    moves.push({ stage: 'lost', at: at(addDays(dayOf(e.createdAt), 10)), by: e.createdBy, ...(e.lost ? { reason: e.lost.reason, ...(e.lost.note ? { note: e.lost.note } : {}) } : {}) });
  }
  if (e.stage === 'joined') {
    const m = e.memberId ? s.members[e.memberId] : undefined;
    const start = m ? currentMembership(m)?.start : undefined;
    moves.push({ stage: 'joined', at: at(start ? addDays(start, -3) : addDays(dayOf(e.createdAt), 1)), by: e.createdBy });
  }
  return moves;
}

/** Eight leads that did not join: [months before T, day of month, senior, contact, source, reason, furthest stage]. Fixed phone numbers outside the staff and contact ranges. */
const LOST: [number, number, [Enquiry['senior']['title'], string], [string, Enquiry['contact']['relation'], string], Enquiry['source'], LostReason, 'visit' | 'trial'][] = [
  [5, 6, ['Opa', 'Gunawan Setiadi'], ['Rina Setiadi', 'daughter', '+62 811-3300-1101'], 'referral', 'price', 'visit'],
  [5, 19, ['Oma', 'Lie Mei Hwa'], ['Darmawan Lie', 'son', '+62 811-3300-1102'], 'instagram', 'distance', 'trial'],
  [4, 11, ['Ibu', 'Ketut Suryani'], ['Putu Suryani', 'daughter', '+62 811-3300-1103'], 'walkIn', 'notReady', 'visit'],
  [4, 24, ['Bapak', 'Sutrisno Adi'], ['Wahyu Adi', 'son', '+62 811-3300-1104'], 'website', 'distance', 'visit'],
  [3, 15, ['Oma', 'Tan Giok Lan'], ['Stella Tan', 'granddaughter', '+62 811-3300-1105'], 'referral', 'otherPlace', 'trial'],
  [2, 7, ['Opa', 'Hasan Basri'], ['Nurul Basri', 'daughter', '+62 811-3300-1106'], 'instagram', 'price', 'trial'],
  [2, 21, ['Ibu', 'Sri Wahyuni'], ['Bambang Wahyuni', 'son', '+62 811-3300-1107'], 'other', 'health', 'visit'],
  [1, 4, ['Bapak', 'Anton Wijaya'], ['Lestari Wijaya', 'daughter', '+62 811-3300-1108'], 'walkIn', 'other', 'trial'],
];

export function seedLeads(s: ClubState, T: ISODate): void {
  const C = s.clubId;
  // 1. a history for every lead that has none
  for (const e of live(s.enquiries)) if (!e.history) e.history = derive(s, e);
  if (!s.members.m51) return; // the roster only: the small seed (tests, e2e) keeps its leads

  // 2. leads that joined in the last six months (the first of the month five months before T onward), with the moves a typical lead makes
  const since = `${addMonths(ym(T), -5)}-01`;
  const led = new Set(live(s.enquiries).map((e) => e.memberId).filter(Boolean));
  for (const m of sortBy(live(s.members), (x) => Number(x.id.slice(1)))) {
    const start = currentMembership(m)?.start;
    const link: FamilyLink | undefined = linksOfMember(s, m.id).find((l) => l.primary);
    const contact = primaryContact(s, m.id);
    if (!start || start < since || start > T || led.has(m.id) || !link || !contact) continue;
    const num = Number(m.id.slice(1));
    const id = `e-h-${m.id}`;
    const created = at(addDays(start, -21));
    const by = 'staff:s1' as const;
    const full = memberName(m);
    s.enquiries[id] = {
      id, clubId: C, createdAt: created, createdBy: by,
      senior: { title: m.title, name: full.slice(m.title.length + 1) }, contact: { name: contact.name, relation: link.relation, phone: contact.phone },
      source: ENQ_SOURCES[num % 5], stage: 'joined', memberId: m.id,
      history: [
        { stage: 'new', at: created, by },
        { stage: 'visit', at: at(addDays(start, -14)), by },
        { stage: 'trial', at: at(addDays(start, -8)), by },
        { stage: 'joined', at: at(addDays(start, -3)), by },
      ],
    };
  }

  // 3. leads that did not join, one or two a month
  LOST.forEach(([back, day, senior, contact, source, reason, furthest], i) => {
    const date = `${addMonths(ym(T), -back)}-${String(day).padStart(2, '0')}`;
    const by = 'staff:s1' as const;
    const id = `e-h-l${i + 1}`;
    const history: LeadMove[] = [{ stage: 'new', at: at(date), by }, { stage: 'visit', at: at(addDays(date, 3)), by }];
    if (furthest === 'trial') history.push({ stage: 'trial', at: at(addDays(date, 6)), by });
    history.push({ stage: 'lost', at: at(addDays(date, 10)), by, reason });
    s.enquiries[id] = {
      id, clubId: C, createdAt: at(date), createdBy: by, senior: { title: senior[0], name: senior[1] },
      contact: { name: contact[0], relation: contact[1], phone: e164(contact[2]) }, source, stage: 'lost', lost: { reason, prevStage: furthest }, history,
    };
  });
}
