// Turns a change request into readable "old → new" rows (translated field labels) and, for creates, a summary of what is being added.
import { fmtPhone, memberName, type ChangeRequest, type ClubState, type Member, type MemberRegistration, type Plan, type PlanEntry } from '@cp/shared';
import { plainName } from '@cp/shared/rules/members';
import type { TFn } from '../../lib/i18n';
import { dietLabel, docLabel, drugLabel, foodLabel, mobLabel, relLabel, timingLabel } from './lib';
import { mediaUrl } from '../../lib/media';

export interface DiffRow { label: string; from?: string; to?: string; /** photos shown instead of the words (profile picture) */ fromImg?: string; toImg?: string }
export interface Described {
  /** Short headline, e.g. "Details", "Allergies". */
  title: string;
  /** Per-field old → new rows (updates). */
  rows: DiffRow[];
  /** What is being added (creates), or a sentence for actions that change another row. */
  summary: DiffRow[];
}
interface Fmt { fdy: (d: string) => string; fds: (d: string) => string; fd: (d: string, o: Intl.DateTimeFormatOptions) => string }

const dash = '—';
const yn = (t: TFn, v: boolean | undefined) => (v ? t('common.yes') : t('common.no'));
/** "Flex" or "Gold". The plan has no usual days: members drop in on any open day. */
export const planText = (t: TFn, p: Pick<PlanEntry, 'plan'>) => (p.plan === 'gold' ? t('profile.planGold') : t('profile.planFlex'));
const list = (a: string[]) => (a.length ? a.join(', ') : dash);
const medText = (t: TFn, x: { name: string; dose: string; timing: Parameters<typeof timingLabel>[1] }) => `${`${x.name} ${x.dose}`.trim()} · ${timingLabel(t, x.timing)}`;

function healthRows(t: TFn, from: Member['health'] | undefined, to: Member['health'] | undefined): DiffRow[] {
  const a = from, b = to;
  if (!a || !b) return [];
  const out: DiffRow[] = [];
  const same = (x: unknown, y: unknown) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
  const food = (h: Member['health']) => list([...h.food.map((x) => foodLabel(t, x)), ...(h.foodOther ? [h.foodOther] : [])]);
  if (!same(a.conditions, b.conditions)) out.push({ label: t('profile.f.conditions'), from: list(a.conditions), to: list(b.conditions) });
  if (a.diabetic !== b.diabetic) out.push({ label: t('profile.f.diabetic'), from: yn(t, a.diabetic), to: yn(t, b.diabetic) });
  if (!same(a.food, b.food) || (a.foodOther || '') !== (b.foodOther || '')) out.push({ label: t('profile.f.food'), from: food(a), to: food(b) });
  if (!same(a.drugs, b.drugs)) out.push({ label: t('profile.f.drugs'), from: list(a.drugs.map((x) => drugLabel(t, x))), to: list(b.drugs.map((x) => drugLabel(t, x))) });
  if (a.mobility !== b.mobility) out.push({ label: t('profile.f.mobility'), from: mobLabel(t, a.mobility), to: mobLabel(t, b.mobility) });
  if (!same(a.diet, b.diet)) out.push({ label: t('profile.f.diet'), from: list(a.diet.map((x) => dietLabel(t, x))), to: list(b.diet.map((x) => dietLabel(t, x))) });
  if (!same(a.meds, b.meds)) out.push({ label: t('profile.f.meds'), from: a.meds.length ? a.meds.map((x) => medText(t, x)).join('\n') : dash, to: b.meds.length ? b.meds.map((x) => medText(t, x)).join('\n') : dash });
  if (!same(a.cognitive, b.cognitive)) out.push({ label: t('profile.f.cognitive'), from: a.cognitive?.summary || dash, to: b.cognitive?.summary || dash });
  return out;
}

/** The answers of the paper application form that changed: one row each, old to new. */
function registrationRows(t: TFn, from: MemberRegistration | undefined, to: MemberRegistration | undefined): DiffRow[] {
  const a = from || {}, b = to || {};
  const out: DiffRow[] = [];
  const row = (label: string, x: string, y: string) => { if (x !== y) out.push({ label, from: x || dash, to: y || dash }); };
  const text = (k: 'nickname' | 'rtRw' | 'city' | 'postcode' | 'phone' | 'mobile' | 'email' | 'dementiaNote', label: string) => row(t(label), a[k] || '', b[k] || '');
  const ask = (k: 'commDifficulty' | 'selfCare' | 'bathroomHelp', label: string) => row(t(label), a[k] === undefined ? '' : yn(t, a[k]), b[k] === undefined ? '' : yn(t, b[k]));
  const ids = (r: MemberRegistration) => (['guarantor', 'member', 'carer'] as const).filter((k) => r.ids?.[k]).map((k) => t('profile.ids.' + k)).join(', ');
  text('nickname', 'profile.f.nickname');
  row(t('profile.f.marital'), a.marital ? t('profile.marital.' + a.marital) : '', b.marital ? t('profile.marital.' + b.marital) : '');
  text('rtRw', 'profile.f.rtRw'); text('city', 'profile.f.city'); text('postcode', 'profile.f.postcode');
  text('mobile', 'profile.f.memberMobile'); text('phone', 'profile.f.homePhone'); text('email', 'profile.f.email');
  ask('commDifficulty', 'profile.q.comm'); ask('selfCare', 'profile.q.self'); ask('bathroomHelp', 'profile.q.bath');
  text('dementiaNote', 'profile.f.dementiaShort');
  row(t('profile.f.idsShort'), ids(a), ids(b));
  return out;
}

const docText = (t: TFn, d: Member['documents'][number] | undefined) => (!d ? t('profile.docMissing') : d.status === 'onFile' ? d.fileName || t('profile.docOnFile') : d.status === 'requested' ? t('profile.docRequested') : t('profile.docPending'));
const consentText = (t: TFn, c: Member['consents'][number] | undefined) => (!c ? dash : c.granted ? t('profile.consentGranted') : t('profile.consentOptOut'));

/** Describe a change request. `m` is the member row now (for names the diff needs). */
export function describeCr(cr: ChangeRequest, s: ClubState, t: TFn, fmt: Fmt): Described {
  const m = cr.target.memberId ? s.members[cr.target.memberId] : undefined;
  const title = t(`reviews.title.${cr.action}`) === `reviews.title.${cr.action}` ? t('review.' + cr.section) : t(`reviews.title.${cr.action}`);
  const rows: DiffRow[] = [];
  const summary: DiffRow[] = [];
  const ch = (f: string) => cr.changes.find((x) => x.field === f);
  const input = (cr.input || {}) as Record<string, unknown>;
  const famName = (id: unknown) => (typeof id === 'string' ? s.familyContacts[id]?.name || '' : '');

  // a new member (added by the front desk) or a lead that joins (enquiry.convert): summarise the rows that were created. When the member row
  // cannot be found (a handled request whose rows are gone), the lead and the request input still give the name, plan and first day.
  const createdMemberId = cr.createdRows?.find((r) => r.coll === 'members')?.id;
  const lead = cr.target.type === 'enquiry' ? s.enquiries[cr.target.id] : undefined;
  const newMember = (): Described => {
    const nm = s.members[createdMemberId || cr.target.memberId || lead?.memberId || cr.target.id];
    const planRaw = input.plan;
    const planIn = planRaw === 'gold' || planRaw === 'flex' ? { plan: planRaw as Plan } : undefined;
    const pl = nm ? nm.plans[nm.plans.length - 1] : planIn;
    const first = nm ? nm.memberships[0].start : typeof input.start === 'string' ? input.start : '';
    const name = nm ? memberName(nm) : lead ? `${lead.senior.title} ${lead.senior.name}` : '';
    if (name) summary.push({ label: t('profile.f.name'), to: name });
    if (nm?.dob) summary.push({ label: t('profile.f.dob'), to: fmt.fdy(nm.dob) });
    if (pl) summary.push({ label: t('profile.f.plan'), to: planText(t, pl) });
    if (first) summary.push({ label: t('profile.f.start'), to: fmt.fdy(first) });
    if (nm?.address) summary.push({ label: t('profile.f.address'), to: nm.address });
    const regLine = nm?.registration ? [nm.registration.nickname, nm.registration.mobile, nm.registration.email].filter(Boolean).join(' · ') : '';
    if (regLine) summary.push({ label: t('profile.f.regForm'), to: regLine });
    const fam = nm ? Object.values(s.familyLinks).find((l) => l.memberId === nm.id && !l.deletedAt) : undefined;
    const c = fam ? s.familyContacts[fam.familyId] : undefined;
    if (c && fam) summary.push({ label: t('profile.f.contact'), to: `${c.name} · ${relLabel(t, fam.relation)} · ${fmtPhone(c.phone)}${fam.primary ? ' · ' + t('profile.primaryBilling') : ''}` });
    else if (lead) summary.push({ label: t('profile.f.contact'), to: `${lead.contact.name} · ${relLabel(t, lead.contact.relation)} · ${fmtPhone(lead.contact.phone)}` });
    if (nm) {
      const allergies = [...nm.health.food.map((x) => foodLabel(t, x)), ...(nm.health.foodOther ? [nm.health.foodOther] : []), ...nm.health.drugs.map((x) => drugLabel(t, x))];
      if (allergies.length) summary.push({ label: t('profile.f.allergies'), to: allergies.join(', ') });
      const consent = nm.consents.map((c2) => `${t('profile.consent.' + c2.kind)}: ${consentText(t, c2)}`).join(' · ');
      if (consent) summary.push({ label: t('profile.consentTitle'), to: consent });
    }
    return { title, rows, summary };
  };
  if (cr.op === 'create' && (cr.action === 'members.create' || createdMemberId)) return newMember();

  switch (cr.action) {
    case 'enquiry.convert': // a lead joining as a member: shown like a new member, with the lead's name and plan
      return newMember();
    case 'family.addContact':
    case 'family.linkContact': {
      const lid = cr.createdRows?.find((r) => r.coll === 'familyLinks')?.id;
      const l = lid ? s.familyLinks[lid] : undefined;
      const c = l ? s.familyContacts[l.familyId] : cr.action === 'family.linkContact' ? s.familyContacts[String(input.familyId || '')] : undefined;
      summary.push({ label: t('profile.f.contact'), to: c ? `${c.name} · ${fmtPhone(c.phone)}` : String(input.name || '') });
      if (l) summary.push({ label: t('profile.f.relation'), to: relLabel(t, l.relation) });
      if (l?.primary || input.primary) summary.push({ label: t('profile.f.primary'), to: t('common.yes') });
      if (l) summary.push({ label: t('profile.f.appAccess'), to: yn(t, l.appAccess) });
      return { title, rows, summary };
    }
    case 'family.unlinkContact':
      summary.push({ label: t('profile.f.contact'), from: famName(input.familyId), to: t('reviews.removed') });
      return { title, rows, summary };
    case 'family.setPrimary': {
      // the contact who is the billing contact now (while the request waits); unknown once it has been handled
      const cur = Object.values(s.familyLinks).find((l) => l.memberId === cr.target.memberId && l.primary && !l.deletedAt && l.familyId !== input.familyId);
      summary.push({ label: t('profile.f.primary'), from: cur ? famName(cur.familyId) : dash, to: famName(input.familyId) });
      return { title, rows, summary };
    }
    case 'family.setAppAccess':
      summary.push({ label: `${t('profile.f.appAccess')} · ${famName(input.familyId)}`, from: yn(t, !input.appAccess), to: yn(t, !!input.appAccess) });
      return { title, rows, summary };
    case 'planChange.decline': {
      const req = s.planChangeRequests[String(input.requestId || '')];
      if (req) summary.push({ label: t('profile.f.upgrade'), from: `${t('profile.plan.' + req.to)} · ${fmt.fdy(req.from)}`, to: t('reviews.declined') });
      return { title, rows, summary };
    }
    default:
      break;
  }

  // field-by-field updates
  for (const c of cr.changes) {
    switch (c.field) {
      case 'firstName': case 'lastName': case 'gender': case 'ageYears': case 'createdAt': break;
      case 'transport': case 'escortDefaults': break; // gone with the drop-in model; a request made before that has nothing to show
      case 'title': rows.push({ label: t('profile.f.title'), from: String(c.from ?? dash), to: String(c.to ?? dash) }); break;
      case 'dob': rows.push({ label: t('profile.f.dob'), from: c.from ? fmt.fdy(String(c.from)) : dash, to: c.to ? fmt.fdy(String(c.to)) : dash }); break;
      case 'address': rows.push({ label: t('profile.f.address'), from: String(c.from || dash), to: String(c.to || dash) }); break;
      case 'usualArrival': rows.push({ label: t('profile.f.usual'), from: String(c.from || dash), to: String(c.to || dash) }); break;
      case 'nanny': rows.push({ label: t('profile.f.nanny'), from: (c.from as Member['nanny'])?.name || dash, to: (c.to as Member['nanny'])?.name || dash }); break;
      case 'photoMediaId': rows.push({ label: t('profile.f.photo'), from: c.from ? t('profile.photoOld') : dash, to: c.to ? t('profile.photoNew') : t('reviews.removed'), fromImg: c.from ? mediaUrl(String(c.from)) : undefined, toImg: c.to ? mediaUrl(String(c.to)) : undefined }); break;
      case 'spouseId': rows.push({ label: t('profile.f.spouse'), from: c.from && s.members[String(c.from)] ? memberName(s.members[String(c.from)]) : dash, to: c.to && s.members[String(c.to)] ? memberName(s.members[String(c.to)]) : dash }); break;
      case 'documents': {
        const a = (c.from as Member['documents'] | undefined) || [], b = (c.to as Member['documents'] | undefined) || [];
        const types = Array.from(new Set([...a, ...b].map((d) => d.type)));
        for (const ty of types) {
          const da = a.find((d) => d.type === ty), db = b.find((d) => d.type === ty);
          if (JSON.stringify(da ?? null) !== JSON.stringify(db ?? null)) rows.push({ label: docLabel(t, ty), from: docText(t, da), to: docText(t, db) });
        }
        break;
      }
      case 'consents': {
        const a = (c.from as Member['consents'] | undefined) || [], b = (c.to as Member['consents'] | undefined) || [];
        for (const kind of ['data', 'face'] as const) {
          const ca = a.find((x) => x.kind === kind), cb = b.find((x) => x.kind === kind);
          if (JSON.stringify(ca ?? null) !== JSON.stringify(cb ?? null)) rows.push({ label: t('profile.consent.' + kind), from: consentText(t, ca), to: consentText(t, cb) });
        }
        break;
      }
      case 'plans': {
        const a = (c.from as PlanEntry[] | undefined) || [], b = (c.to as PlanEntry[] | undefined) || [];
        const nw = b.find((p) => !a.some((q) => JSON.stringify(q) === JSON.stringify(p))) || b[b.length - 1];
        const cur = nw ? [...a].filter((p) => p.from <= nw.from).pop() || a[0] : a[a.length - 1];
        if (nw) rows.push({ label: t('profile.f.plan'), from: cur ? planText(t, cur) : dash, to: `${planText(t, nw)} · ${t('profile.fromDate', { d: fmt.fdy(nw.from) })}` });
        break;
      }
      case 'health': rows.push(...healthRows(t, c.from as Member['health'], c.to as Member['health'])); break;
      case 'registration': rows.push(...registrationRows(t, c.from as MemberRegistration | undefined, c.to as MemberRegistration | undefined)); break;
      case 'care': rows.push({ label: t('profile.f.care'), from: (c.from as Member['care'])?.instructions || dash, to: (c.to as Member['care'])?.instructions || dash }); break;
      case 'name': rows.push({ label: t('profile.f.name'), from: String(c.from ?? dash), to: String(c.to ?? dash) }); break;
      case 'phone': rows.push({ label: t('profile.f.phone'), from: c.from ? fmtPhone(String(c.from)) : dash, to: c.to ? fmtPhone(String(c.to)) : dash }); break;
      case 'lang': rows.push({ label: t('profile.f.language'), from: c.from ? t('profile.lang.' + String(c.from)) : dash, to: c.to ? t('profile.lang.' + String(c.to)) : dash }); break;
      case 'relation': rows.push({ label: t('profile.f.relation'), from: c.from ? relLabel(t, c.from as never) : dash, to: c.to ? relLabel(t, c.to as never) : dash }); break;
      case 'primary': rows.push({ label: t('profile.f.primary'), from: yn(t, !!c.from), to: yn(t, !!c.to) }); break;
      case 'appAccess': rows.push({ label: t('profile.f.appAccess'), from: yn(t, !!c.from), to: yn(t, !!c.to) }); break;
      case 'deletedAt': break;
      default: rows.push({ label: c.field, from: String(c.from ?? dash), to: String(c.to ?? dash) });
    }
  }
  // first and last name are one "Name" row
  if (ch('firstName') || ch('lastName')) {
    const f0 = (ch('firstName')?.from ?? m?.firstName ?? '') as string, l0 = (ch('lastName')?.from ?? m?.lastName ?? '') as string;
    const f1 = (ch('firstName')?.to ?? m?.firstName ?? '') as string, l1 = (ch('lastName')?.to ?? m?.lastName ?? '') as string;
    rows.unshift({ label: t('profile.f.name'), from: plainName({ firstName: f0, lastName: l0 }), to: plainName({ firstName: f1, lastName: l1 }) });
  }
  // sentence-style rows for changes that live on another row than the diff shows
  if (cr.action === 'family.updateContact' && !rows.length) rows.push({ label: t('profile.f.contact'), from: famName(input.familyId), to: famName(input.familyId) });
  if ((cr.action === 'family.updateContact' || cr.action === 'family.setPrimary') && cr.changes.some((c) => c.field === 'deletedAt')) return { title, rows, summary };
  return { title, rows, summary };
}
