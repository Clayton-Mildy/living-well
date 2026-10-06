// Family projection: what a family user's browser receives (their members only; no staff-only fields).
import type { ClubState, Member } from './types';
import { COLLECTIONS } from './types';
import { live, uniq } from './util';
import { isPendingRow } from './rules/core';

const pick = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r])) as Record<string, T>;

export function projectForFamily(s: ClubState, familyId: string): ClubState {
  const out = { clubId: s.clubId, rev: s.rev, club: s.club } as ClubState;
  for (const c of COLLECTIONS) (out as unknown as Record<string, unknown>)[c] = {};
  const links = live(s.familyLinks).filter((l) => l.familyId === familyId && !isPendingRow(l) && l.appAccess);
  const mids = uniq(links.map((l) => l.memberId));
  const strip = (m: Member): Member => ({ ...m, care: { instructions: '', by: m.care.by, at: m.care.at }, sim: { ...m.sim, script: undefined } });
  out.members = pick(mids.map((id) => s.members[id]).filter(Boolean).map(strip));
  // co-tagged members in photos: short name stubs only
  const photos = live(s.photos).filter((p) => p.visibility === 'visible' && p.memberIds.some((id) => mids.includes(id)));
  for (const p of photos) for (const id of p.memberIds) if (!out.members[id] && s.members[id]) {
    const m = s.members[id];
    out.members[id] = { ...strip(m), dob: null, address: null, health: { conditions: [], diabetic: false, food: [], drugs: [], mobility: null, diet: [], meds: [], cognitive: { summary: '' } }, documents: [], consents: [], billing: { va: '' }, review: { status: 'approved', crId: 'stub' } } as Member;
  }
  // the kitchen's lunch photos (no member tags) show on the family's Today timeline
  const lunchIds = new Set(live(s.dayMenus).flatMap((d) => [...(d.photoIds || []), ...(d.photoId ? [d.photoId] : [])]));
  const lunch = live(s.photos).filter((p) => lunchIds.has(p.id) && p.visibility === 'visible' && !photos.includes(p));
  out.photos = pick([...photos, ...lunch]);
  const householdLinks = live(s.familyLinks).filter((l) => mids.includes(l.memberId) && !isPendingRow(l));
  out.familyLinks = pick(householdLinks);
  // sign-in names: a family user sees only their own, never another contact's or a staff member's
  out.familyContacts = pick(uniq(householdLinks.map((l) => l.familyId)).map((id) => s.familyContacts[id]).filter(Boolean).map((c) => (c.id === familyId ? c : { ...c, username: undefined })));
  const mine = <T extends { memberId?: string | null }>(rows: T[]) => rows.filter((r) => r.memberId && mids.includes(r.memberId));
  out.memberNotes = pick(mine(live(s.memberNotes)).filter((n) => n.visibility === 'family'));
  out.attendance = pick(mine(live(s.attendance)));
  out.readings = pick(mine(live(s.readings)).filter((r) => !r.voided));
  out.dailyLogs = pick(mine(live(s.dailyLogs)).filter((l) => l.status === 'saved').map((l) => ({ ...l, staffNote: undefined })));
  out.planChangeRequests = pick(mine(live(s.planChangeRequests)));
  const invoices = mine(live(s.invoices)).map((i) => ({ ...i, xero: 'synced' as const, callNotes: [] }));
  out.invoices = pick(invoices);
  const invIds = new Set(invoices.map((i) => i.id));
  out.payments = pick(mine(live(s.payments)).map((p) => ({ ...p, xero: 'synced' as const })));
  out.refunds = pick(live(s.refunds).filter((r) => invIds.has(r.invoiceId)));
  out.threads = pick(live(s.threads).filter((t) => t.familyId === familyId));
  const tids = new Set(Object.keys(out.threads));
  out.messages = pick(live(s.messages).filter((m) => tids.has(m.threadId)));
  out.feedback = pick(live(s.feedback).filter((f) => f.familyId === familyId));
  out.calendarEvents = pick(live(s.calendarEvents));
  out.rooms = pick(live(s.rooms));
  out.activities = pick(live(s.activities));
  out.scheduleVersions = pick(live(s.scheduleVersions).filter((v) => v.status === 'published'));
  out.dishes = pick(live(s.dishes));
  out.menuVersions = pick(live(s.menuVersions).filter((v) => v.status === 'published'));
  // allergy alternatives: only the family's own members
  out.dayMenus = pick(live(s.dayMenus).map((d) => ({ ...d, allergyPlans: d.allergyPlans.filter((p) => mids.some((id) => p.person === `member:${id}`)) })));
  out.directory = pick(live(s.directory).filter((d) => d.public));
  out.prices = pick(live(s.prices));
  out.staff = pick(live(s.staff).map((x) => ({ ...x, username: undefined, phone: '', hr: { ...x.hr, salary: 0, allowance: 0, account: '', ktpLast4: '' } })));
  out.surveys = pick(live(s.surveys).filter((x) => x.recipients.includes(familyId) && x.status !== 'draft'));
  out.surveyResponses = pick(live(s.surveyResponses).filter((r) => r.familyId === familyId));
  out.notifications = pick(live(s.notifications).filter((n) => n.toUsers.includes(familyId)));
  out.changeRequests = pick(live(s.changeRequests).filter((c) => c.submittedBy === `family:${familyId}`));
  out.activity = pick(Object.values(s.activity).filter((a) => a.memberId && mids.includes(a.memberId) && ['feed.checkedIn', 'feed.checkedOut'].includes(a.key)));
  return out;
}
