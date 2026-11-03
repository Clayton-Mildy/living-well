// Round 18 seed (KC): a member who has just joined, to show the family's first sign-in. Oma Sri Rahayu (Flex) started 2 open days before T from a paper
// form; her daughter Ratna Rahayu (primary and billing, with app access) has never signed in, so she meets the welcome + terms page with Oma Sri's name.
// The roster only (the small seed keeps its 5 members). Fixed values, no random draws. Runs after round 17 (so Ratna has no termsAgreed) and before the mood
// marks (so today's check-in gets its faces).
//
// Her first invoice follows the app's own rule: the invoice run bills every member active on its issue day, and the run job does not run a month twice.
// So when this month's run was issued after she joined (the demo day itself is the 21st), she is on it, with the registration fee, as the job would have
// billed her; otherwise (any day between runs) the fee waits for the next run, where runLinesFor() adds it with her first plan fee.
import type { ClubState, FamilyContact, FamilyLink, Invoice, ISODate, Member } from '../../types';
import { addDays, e164, live, toMin } from '../../util';
import { displayName, isOpen } from '../../rules/core';
import { dueDateFor, nextInvoiceNumber, runLinesFor } from '../../rules/billing';
import { invoiceVa } from '../../rules/finance';

export const SRI = 'm_sri';
export const RATNA = 'f_ratna';
const VA = '8808' + String(1203440000 + 90 * 7919).padStart(12, '0'); // the roster's VA formula, the next free index (0–89 are taken)
const CHECK_IN = '09:05';
const dmy = (d: ISODate) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`; // as actions/members.ts writes the welcome's date

/** The open day `n` open days before `T`. */
function openDaysBefore(s: ClubState, T: ISODate, n: number): ISODate {
  let d = T;
  for (let k = 0; k < n; k++) {
    d = addDays(d, -1);
    for (let i = 0; i < 14 && !isOpen(s, d); i++) d = addDays(d, -1);
  }
  return d;
}

export function seedRound18(s: ClubState, T: ISODate, nowMin: number): void {
  if (!s.members.m51) return; // the roster only
  if (Object.values(s.familyContacts).some((c) => c.username === 'ratna')) return; // never take someone else's sign-in name
  const C = s.clubId;
  const start = openDaysBefore(s, T, 2);
  const at = `${start}T10:00`;
  const byFam = `family:${RATNA}` as const;

  const ratna: FamilyContact = {
    id: RATNA, clubId: C, createdAt: at, createdBy: 'staff:s1', username: 'ratna', name: 'Ratna Rahayu', firstName: 'Ratna',
    phone: e164('+62 812-7045-3318'), lang: 'en', email: 'ratna.rahayu@example.com', activatedAt: at, // no termsAgreed: she has never signed in
  };
  s.familyContacts[RATNA] = ratna;
  const link: FamilyLink = { id: `${RATNA}:${SRI}`, clubId: C, createdAt: at, createdBy: 'staff:s1', familyId: RATNA, memberId: SRI, relation: 'daughter', primary: true, appAccess: true, healthAlerts: true };
  s.familyLinks[link.id] = link;

  // the paper form, entered by the front desk on her first day (like the roster's members); no photo yet, so the app shows her initials
  const m: Member = {
    id: SRI, clubId: C, createdAt: at, createdBy: 'staff:s1', title: 'Oma', firstName: 'Sri', lastName: 'Rahayu', gender: 'f', dob: '1949-04-12', ageYears: null,
    address: 'Jl. Kemang Timur no. 21, Kemang, Jakarta Selatan', photoTone: 2,
    memberships: [{ start }], plans: [{ from: start, plan: 'flex', by: 'staff:s1' }], usualArrival: CHECK_IN, nanny: null, spouseId: null,
    health: {
      conditions: ['High blood pressure'], diabetic: false, food: [], drugs: [], mobility: 'walkingStick', diet: ['lowSalt'],
      meds: [{ id: `${SRI}-med1`, name: 'Amlodipine', dose: '5 mg', timing: 'morningHome' }],
      cognitive: { summary: 'Alert and oriented', reviewedBy: 's8', reviewedOn: start },
    },
    care: { instructions: 'Walks with a stick; offer her an arm on the stairs.', by: 'staff:s8', at: `${start}T10:45` },
    consents: [{ kind: 'data', granted: true, by: byFam, byName: ratna.name, at: `${start}T09:00`, via: 'paper' }, { kind: 'face', granted: true, by: byFam, byName: ratna.name, at: `${start}T09:00`, via: 'paper' }],
    documents: [
      { id: `${SRI}-doc-ktp`, type: 'ktp', status: 'onFile', fileName: 'ktp.jpg', on: start, via: 'staff', by: byFam },
      { id: `${SRI}-doc-form`, type: 'membershipForm', status: 'onFile', fileName: 'membership-form.pdf', on: start, via: 'staff', by: byFam },
      { id: `${SRI}-doc-health`, type: 'healthInfo', status: 'onFile', fileName: 'health-info.jpg', on: start, via: 'staff', by: byFam },
    ],
    face: { enrolled: false }, billing: { va: VA },
    sim: { sys: 132, dia: 80, pulse: 72, spo2: 97, glucose: 104, weight: 56, temp: 36.6, grip: 16 },
  };
  s.members[SRI] = m;
  s.activity[`act-${SRI}-created`] = { id: `act-${SRI}-created`, clubId: C, at, actor: 'staff:s1', action: 'members.create', memberId: SRI, icon: 'person_add', key: 'feed.memberCreatedForm', params: {} };
  // the welcome activateMember() sends to the family's app accounts
  s.notifications[`nt-welcome-${SRI}`] = {
    id: `nt-welcome-${SRI}`, clubId: C, createdAt: at, createdBy: 'staff:s1', toUsers: [RATNA], toRoles: [], kind: 'members.notif.welcome',
    params: { name: displayName(m), date: dmy(start) }, severity: 'info', action: false, link: '/today', memberId: SRI, readBy: [],
  };

  // her lead, as seedLeads() writes one for every member who joined in the last six months (it ran before her): a visit, a trial, then the paper form
  const by = 'staff:s1' as const;
  const lead = `e-h-${SRI}`;
  s.enquiries[lead] = {
    id: lead, clubId: C, createdAt: `${addDays(start, -21)}T10:00`, createdBy: by, senior: { title: 'Oma', name: 'Sri Rahayu' },
    contact: { name: ratna.name, relation: 'daughter', phone: ratna.phone }, source: 'referral', stage: 'joined', memberId: SRI,
    history: [
      { stage: 'new', at: `${addDays(start, -21)}T10:00`, by },
      { stage: 'visit', at: `${addDays(start, -14)}T10:00`, by },
      { stage: 'trial', at: `${addDays(start, -8)}T10:00`, by },
      { stage: 'joined', at: `${addDays(start, -3)}T10:00`, by },
    ],
  };

  // one visit so far: today (the front desk checked her in by name, no face enrolled yet)
  if (toMin(CHECK_IN) <= nowMin) {
    s.attendance[`${T}:${SRI}`] = {
      id: `${T}:${SRI}`, clubId: C, createdAt: `${T}T${CHECK_IN}`, createdBy: 'staff:s1', memberId: SRI, date: T,
      checkIn: { at: CHECK_IN, by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [{ at: `${T}T${CHECK_IN}`, by: 'staff:s1', what: 'checkIn' }],
    };
  }

  // a run issued after she joined would have billed her (see the top): her first invoice, with the registration fee, unpaid so far
  const run = live(s.invoiceRuns).find((r) => r.issueDate > start && r.issueDate <= T);
  if (run) {
    const lines = runLinesFor(s, m, run.period, T);
    if (!lines.length) return;
    let number = nextInvoiceNumber(s, run.period, SRI);
    for (let n = 2; s.invoices[number]; n++) number = `${nextInvoiceNumber(s, run.period, SRI)}-${n}`;
    const inv: Invoice = {
      id: number, clubId: C, createdAt: `${run.issueDate}T08:00`, createdBy: 'system', number, memberId: SRI, payerFamilyId: RATNA, kind: 'monthly', period: run.period,
      issueDate: run.issueDate, dueDate: dueDateFor(s, run.period), lines, va: invoiceVa(VA, run.period), xero: 'awaitingPayment', reminders: [], callNotes: [],
    };
    s.invoices[number] = inv;
    run.invoiceIds.push(number);
  }
}
