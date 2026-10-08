// Family projection: what a family user's browser receives (their members only; no staff-only fields).
import type { ClubState, GuestHost, GuestSession, Member } from './types';
import { COLLECTIONS } from './types';
import { live, sortBy, uniq } from './util';
import { approvedDayMenu, logForFamily, menuVersionForFamily, noteForFamily, readingForFamily } from './rules/approvals';
import { firstOfRole, isPendingRow } from './rules/core';
import { replyTarget } from './rules/kitchenOps';
import { cameOn } from './rules/activity';

const pick = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r])) as Record<string, T>;
const present = <T>(x: T | null): x is T => x !== null;

/**
 * A change by staff that was applied at once (allergies, medicines, care) and still waits for management's review is not shown to the family:
 * they keep seeing the values from before it, until it is acknowledged (or it was reverted).
 */
function heldBack(s: ClubState, m: Member): Member {
  const flags = sortBy(live(s.changeRequests).filter((c) => c.kind === 'postReview' && c.status === 'pending' && c.target.type === 'member' && c.target.id === m.id), (c) => c.createdAt + c.id);
  if (!flags.length) return m;
  const out = { ...m } as unknown as Record<string, unknown>;
  const done = new Set<string>();
  for (const c of flags) for (const ch of c.changes) {
    if (done.has(ch.field)) continue; // the oldest waiting change holds the value the family last saw
    done.add(ch.field);
    if (ch.from === undefined || ch.from === null) delete out[ch.field]; else out[ch.field] = JSON.parse(JSON.stringify(ch.from));
  }
  return out as unknown as Member;
}

export function projectForFamily(s: ClubState, familyId: string): ClubState {
  const out = { clubId: s.clubId, rev: s.rev, club: s.club } as ClubState;
  for (const c of COLLECTIONS) (out as unknown as Record<string, unknown>)[c] = {};
  const links = live(s.familyLinks).filter((l) => l.familyId === familyId && !isPendingRow(l) && l.appAccess);
  const mids = uniq(links.map((l) => l.memberId));
  const strip = (m: Member): Member => ({ ...m, care: { instructions: '', by: m.care.by, at: m.care.at }, sim: { ...m.sim, script: undefined } });
  out.members = pick(mids.map((id) => s.members[id]).filter(Boolean).map((m) => strip(heldBack(s, m))));
  // co-tagged members in photos: short name stubs only
  const photos = live(s.photos).filter((p) => p.visibility === 'visible' && p.memberIds.some((id) => mids.includes(id)));
  for (const p of photos) for (const id of p.memberIds) if (!out.members[id] && s.members[id]) {
    const m = s.members[id];
    out.members[id] = { ...strip(m), dob: null, address: null, health: { conditions: [], diabetic: false, food: [], drugs: [], mobility: null, diet: [], meds: [], cognitive: { summary: '' } }, documents: [], consents: [], billing: { va: '' }, review: { status: 'approved', crId: 'stub' } } as Member;
  }
  // the kitchen's lunch photos (no member tags) show on the family's Today timeline
  const lunchIds = new Set(live(s.dayMenus).flatMap((d) => [...(d.photoIds || []), ...(d.teaPhotoIds || []), ...(d.photoId ? [d.photoId] : [])])); // KC round 7: the tea photos too
  const lunch = live(s.photos).filter((p) => lunchIds.has(p.id) && p.visibility === 'visible' && !photos.includes(p));
  // KC round 7: activity pictures (of a session, no member tags) reach the families of members who came to the club that day (any check-in that date)
  const sessionPics = live(s.photos).filter((p) => p.kind === 'activity' && p.visibility === 'visible' && !photos.includes(p) && cameOn(s, mids, p.date));
  out.photos = pick([...photos, ...lunch, ...sessionPics]);
  const householdLinks = live(s.familyLinks).filter((l) => mids.includes(l.memberId) && !isPendingRow(l));
  out.familyLinks = pick(householdLinks);
  // sign-in names: a family user sees only their own, never another contact's or a staff member's
  out.familyContacts = pick(uniq(householdLinks.map((l) => l.familyId)).map((id) => s.familyContacts[id]).filter(Boolean).map((c) => (c.id === familyId ? c : { ...c, username: undefined })));
  const mine = <T extends { memberId?: string | null }>(rows: T[]) => rows.filter((r) => r.memberId && mids.includes(r.memberId));
  out.memberNotes = pick(mine(live(s.memberNotes)).filter((n) => n.visibility === 'family').map(noteForFamily).filter(present));
  out.attendance = pick(mine(live(s.attendance)));
  out.readings = pick(mine(live(s.readings)).filter((r) => !r.voided).map(readingForFamily).filter(present));
  // daily logs, family notes and readings by staff wait for approval: a new entry is left out, an edit shows the last approved values
  out.dailyLogs = pick(mine(live(s.dailyLogs)).filter((l) => l.status === 'saved').map(logForFamily).filter(present).map((l) => ({ ...l, staffNote: undefined, approval: undefined })));
  out.planChangeRequests = pick(mine(live(s.planChangeRequests)));
  const invoices = mine(live(s.invoices)).map((i) => ({ ...i, xero: 'synced' as const, callNotes: [] }));
  out.invoices = pick(invoices);
  const invIds = new Set(invoices.map((i) => i.id));
  out.payments = pick(mine(live(s.payments)).map((p) => ({ ...p, xero: 'synced' as const })));
  out.refunds = pick(live(s.refunds).filter((r) => invIds.has(r.invoiceId)));
  // their own feedback, and feedback the kitchen logged from a phone call whose replies go to them (KC round 6: replies show in the family app)
  out.feedback = pick(live(s.feedback).filter((f) => f.familyId === familyId || (!f.familyId && replyTarget(s, f) === familyId)));
  out.calendarEvents = pick(live(s.calendarEvents));
  out.rooms = pick(live(s.rooms));
  out.activities = pick(live(s.activities));
  out.scheduleVersions = pick(live(s.scheduleVersions).filter((v) => v.status === 'published'));
  // KC round 7: one-day programme changes, and who leads a session that is on (a guest host's name and what they do; never fees, phones, bank details or notes)
  out.scheduleDays = pick(live(s.scheduleDays || {}).map(({ note: _note, ...d }) => d)); // the day's note ("… is off sick") is for staff
  const guestSessions = live(s.guestSessions || {}).filter((g) => g.status !== 'cancelled');
  out.guestSessions = pick(guestSessions.map((g): GuestSession => ({ ...g, fee: 0, vendorInvoiceId: undefined, note: undefined })));
  const hostIds = new Set(guestSessions.map((g) => g.hostId));
  out.guestHosts = pick(live(s.guestHosts || {}).filter((h) => hostIds.has(h.id)).map((h): GuestHost => ({ id: h.id, clubId: h.clubId, createdAt: h.createdAt, createdBy: h.createdBy, name: h.name, kind: h.kind, what: h.what, photoMediaId: h.photoMediaId, phone: '', fee: 0, active: true })));
  out.dishes = pick(live(s.dishes));
  out.menuVersions = pick(live(s.menuVersions).filter((v) => v.status === 'published').map(menuVersionForFamily).filter(present));
  // allergy alternatives: only the family's own members
  out.dayMenus = pick(live(s.dayMenus).map(approvedDayMenu).map((d) => ({ ...d, approval: undefined, allergyPlans: d.allergyPlans.filter((p) => mids.some((id) => p.person === `member:${id}`)) })));
  out.directory = pick(live(s.directory).filter((d) => d.public));
  out.prices = pick(live(s.prices));
  // the front desk's number is the one staff phone a family gets: "WhatsApp the club" opens a chat with it
  const desk = firstOfRole(s, 'lobby')?.id;
  out.staff = pick(live(s.staff).map((x) => ({ ...x, username: undefined, phone: x.id === desk ? x.phone : '', hr: { ...x.hr, salary: 0, allowance: 0, account: '', ktpLast4: '' } })));
  out.surveys = pick(live(s.surveys).filter((x) => x.recipients.includes(familyId) && x.status !== 'draft'));
  out.surveyResponses = pick(live(s.surveyResponses).filter((r) => r.familyId === familyId));
  out.notifications = pick(live(s.notifications).filter((n) => n.toUsers.includes(familyId)));
  out.changeRequests = pick(live(s.changeRequests).filter((c) => c.submittedBy === `family:${familyId}`));
  out.activity = pick(Object.values(s.activity).filter((a) => a.memberId && mids.includes(a.memberId) && ['feed.checkedIn', 'feed.checkedOut'].includes(a.key)));
  return out;
}
