// Round 17 seed: the terms and conditions (version 1, English and Indonesian; the text is in terms.ts), every seeded family contact has agreed to it except Sinta Halim (the demo contact who
// meets the first-sign-in gate), and a handful of active members who came fewer than 5 days this month, with one call already logged (Caca reached Opa Hendra's family).
// Fixed values, no random draws; the same ids for 5 and 45 members. Runs before the mood marks (which are written for every visit left).
import type { ClubState, FamilyContact, ISODate, TermsVersion } from '../../types';
import { e164, live, ym } from '../../util';
import { TERMS_V1_EN, TERMS_V1_ID } from './terms';

/** Active members who come fewer than 5 days this month on the demo day (the roster ones join Endang, Hendrik and Rizal, who are quiet already). Their last three visits before today stay (the days the daily reports and charts already show), and today's (so the day's check-ins are untouched). */
export const FEW_VISITS_IDS = ['m2', 'm20', 'm46', 'm53', 'm54', 'm62'];
const KEPT_VISITS = 3;

/** Remove a member's visits on `days` with everything that hangs off them (readings, logs, photo tags), so nothing dangles. */
function dropDays(s: ClubState, memberId: string, days: Set<ISODate>): void {
  for (const [k, a] of Object.entries(s.attendance)) if (a.memberId === memberId && days.has(a.date)) delete s.attendance[k];
  for (const [k, r] of Object.entries(s.readings)) if (r.memberId === memberId && days.has(r.date) && r.kind !== 'monthly') delete s.readings[k];
  for (const [k, l] of Object.entries(s.dailyLogs)) if (l.memberId === memberId && days.has(l.date)) delete s.dailyLogs[k];
  for (const [k, p] of Object.entries(s.photos)) {
    if (!days.has(p.date) || !p.memberIds.includes(memberId)) continue;
    p.memberIds = p.memberIds.filter((id) => id !== memberId);
    if (!p.memberIds.length && p.kind === 'arrival') delete s.photos[k];
  }
  for (const [k, m] of Object.entries(s.moodMarks)) if (m.memberId === memberId && days.has(m.date)) delete s.moodMarks[k];
}

export function seedRound17(s: ClubState, T: ISODate): void {
  // terms v1, published by Ega on the seed's first day; every contact has agreed to it (at the later of the day they were added and the day it was published)
  const publishedAt = s.club.createdAt;
  const v1: TermsVersion = { version: 1, en: TERMS_V1_EN, id: TERMS_V1_ID, publishedAt, publishedBy: s.staff.s9 ? 's9' : 'system' };
  s.club.settings = { ...s.club.settings, terms: [v1] }; // a copy: SETTINGS is shared by every build
  for (const c of Object.values(s.familyContacts)) c.termsAgreed = { version: 1, at: c.createdAt > publishedAt ? c.createdAt : publishedAt };

  // Sinta Halim: Opa Hendra's second daughter, not primary. Her account was opened on 19 Oct and she has never signed in, so she meets the terms gate
  if (s.members.m2) {
    const at = '2026-10-19T10:00';
    const sinta: FamilyContact = {
      id: 'f_sinta', clubId: s.clubId, createdAt: at, createdBy: 'staff:s1', username: 'sinta', name: 'Sinta Halim', firstName: 'Sinta',
      phone: e164('+62 817-3340-9026'), lang: 'en', activatedAt: at,
    };
    s.familyContacts[sinta.id] = sinta;
    s.familyLinks['f_sinta:m2'] = { id: 'f_sinta:m2', clubId: s.clubId, createdAt: at, createdBy: 'staff:s1', familyId: sinta.id, memberId: 'm2', relation: 'daughter', primary: false, appAccess: true, healthAlerts: true };
  }

  // the few-visits list: these members came 3 days this month before today (4 with today), so they are on it
  const month = ym(T);
  for (const id of FEW_VISITS_IDS) {
    if (!s.members[id] || s.members[id].deletedAt) continue;
    const days = live(s.attendance).filter((a) => a.memberId === id && a.checkIn && ym(a.date) === month && a.date < T).map((a) => a.date).sort();
    // kept: a day with an Alert reading (Opa Hendra's 164/98 is on the health pages and the daily report), then the latest days
    const alert = new Set(live(s.readings).filter((r) => r.memberId === id && r.status === 'alert' && ym(r.date) === month).map((r) => r.date));
    const keep = new Set<ISODate>(days.filter((d) => alert.has(d)).slice(-KEPT_VISITS));
    for (const d of [...days].reverse()) if (keep.size < KEPT_VISITS) keep.add(d);
    const drop = new Set(days.filter((d) => !keep.has(d)));
    if (drop.size) dropDays(s, id, drop);
  }
  // Caca already phoned Opa Hendra's family: reached
  if (s.members.m2 && s.staff.s1) {
    const at = `${T}T09:25`;
    s.visitCalls ??= {};
    s.visitCalls['vcall-seed-1'] = { id: 'vcall-seed-1', clubId: s.clubId, createdAt: at, createdBy: 'staff:s1', memberId: 'm2', month, outcome: 'reached', note: "Cynthia says he'll come more after his check-up", by: 'staff:s1', at };
  }
}
