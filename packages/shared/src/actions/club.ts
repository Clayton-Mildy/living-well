// Club management: venue bookings, WhatsApp broadcasts (and the job that sends scheduled ones), surveys, prices and club rules.
import type { Draft } from 'immer';
import type { Broadcast, ClubState, HM, ISODate, Survey, SurveyAnswer, SurveyCustomQuestion, User, VenueBooking } from '../types';
import { defineAction, isFamily, isMgmt, type Ctx } from './framework';
import { registerJob } from './jobs';
import { priceOn } from '../rules/billing';
import {
  AUDIENCES, SURVEY_AUDIENCE_MODES, appFamilies, broadcastRecipients, checkVenueSlot, resolveSurveyAudience, venueIsPast, type AudienceKey, type SurveyAudience,
} from '../rules/mgmt';
import { arr, bad, bool, dm, hm, int, isoDate, nextNumId, obj, oneOf, phone, str, uniq } from '../rules/mgmtParse';
import { SURVEY_BUILTINS, SURVEY_KINDS, SURVEY_LIMITS, answerValue, assignQuestionIds, customOf, questionProblem } from '../rules/surveys';
import { live, rp, sortBy } from '../util';

const mgmtOnly = (u: User) => isMgmt(u);
const S = (d: Draft<ClubState>) => d as unknown as ClubState;
const id80 = (v: unknown, field: string) => str(v, 80, { required: true, field });
/** Explicitly typed so TypeScript narrows after ctx.fail. */
function need<T>(v: T | null | undefined | false, ctx: Ctx, code = 'err.notFound'): T {
  if (!v) ctx.fail(code);
  return v as T;
}

// ---------- venue ----------
interface VenueIn { org: string; contactName: string; phone: string; guests: number; roomId: string; date: ISODate; from: HM; to: HM; price?: number; deposit?: number }
interface VenueUpdateIn { venueId: string; org?: string; contactName?: string; phone?: string; guests?: number; roomId?: string; date?: ISODate; from?: HM; to?: HM; price?: number | null; deposit?: number | null }
const money = (v: unknown, field: string) => (v === undefined || v === null || v === '' ? undefined : int(v, 0, 10_000_000_000, field));

// ---------- broadcast ----------
type Template = Broadcast['template'];
const TEMPLATES: Template[] = ['update', 'closure', 'event', 'custom'];
interface BcIn { template: Template; message: string; audiences: AudienceKey[] }
const DT_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const dtStr = (v: unknown, field: string) => (typeof v === 'string' && DT_RE.test(v) ? v : bad(field));
const parseBc = (raw: unknown): BcIn => {
  const o = obj(raw);
  const audiences = uniq(arr(o.audiences, (x) => oneOf(x, AUDIENCES, 'audiences')));
  if (!audiences.length) bad('audiences');
  return { template: oneOf(o.template, TEMPLATES, 'template'), message: str(o.message, 1000, { required: true, field: 'message' }), audiences };
};

/** The notification (and feed) a sent broadcast leaves: families and staff with the app get the message, management a confirmation. */
function announce(ctx: Ctx, b: { template: Template; message: string }, recipients: ReturnType<typeof broadcastRecipients>) {
  const users = uniq(recipients.map((r) => r.userId).filter((x): x is string => !!x));
  if (users.length) ctx.notify({ toUsers: users, kind: `mgmt.notif.bc_${b.template}`, params: { text: b.message }, link: '/today' });
  ctx.notify({ toRoles: ['mgmt'], kind: 'mgmt.notif.broadcastSent', params: { n: recipients.length }, link: '/broadcast' });
  ctx.feed({ icon: 'campaign', key: 'mgmt.feed.broadcast', params: { n: recipients.length } });
}

// The job the server runs every 15 s: scheduled broadcasts whose time has come are sent (simulated WhatsApp).
registerJob('broadcast.fire', (d, ctx) => {
  for (const b of sortBy(Object.values(d.broadcasts), (x) => x.sendAt + x.id)) {
    if (b.deletedAt || b.status !== 'scheduled' || b.sendAt > ctx.nowDT) continue;
    const rec = broadcastRecipients(S(d), b.audiences, ctx.today);
    b.status = 'sent';
    b.sentAt = ctx.nowDT;
    b.recipients = rec.length;
    announce(ctx, b, rec);
  }
});

// ---------- surveys ----------
/** A custom question as sent: `id` is kept when it is a valid unused one (q1, q2, …) and given by the server otherwise. */
type CustomIn = Omit<SurveyCustomQuestion, 'id'> & { id?: string };
interface SurveyIn { title: string; questions: Survey['questions']; custom?: CustomIn[]; teamStaffIds: string[]; audience?: SurveyAudience }
/** Who a survey is for: every family with the app, the families of chosen members, or chosen contacts. */
const parseAudience = (v: unknown): SurveyAudience => {
  const o = obj(v, 'audience');
  const mode = oneOf(o.mode, SURVEY_AUDIENCE_MODES, 'audience.mode');
  if (mode === 'members') return { mode, memberIds: uniq(arr(o.memberIds, (x) => id80(x, 'audience.memberIds'), 300)) };
  if (mode === 'contacts') return { mode, contactIds: uniq(arr(o.contactIds, (x) => id80(x, 'audience.contactIds'), 300)) };
  return { mode };
};
/** One custom question: its kind, its text, the options of a choice, and whether families must answer it. */
const parseCustomQuestion = (v: unknown): CustomIn => {
  const o = obj(v, 'custom');
  const kind = oneOf(o.kind, SURVEY_KINDS, 'custom.kind');
  const text = str(o.text, SURVEY_LIMITS.text, { required: true, field: 'custom.text' });
  const options = kind === 'choice' ? arr(o.options, (x) => str(x, SURVEY_LIMITS.option + 1, { required: true, field: 'custom.options' }), SURVEY_LIMITS.optionsMax + 1) : undefined;
  if (questionProblem({ kind, text, options })) bad('custom');
  const id = typeof o.id === 'string' ? o.id.trim().slice(0, 12) : undefined;
  return { id, kind, text, ...(options ? { options } : {}), required: bool(o.required) };
};
const parseSurvey = (o: Record<string, unknown>, partial = false): Partial<SurveyIn> => {
  const out: Partial<SurveyIn> = {};
  if (o.audience !== undefined) out.audience = parseAudience(o.audience);
  if (!partial || o.title !== undefined) out.title = str(o.title, 80, { required: true, field: 'title' });
  if (!partial || o.questions !== undefined) {
    const picked = uniq(arr(o.questions, (x) => oneOf(x, SURVEY_BUILTINS, 'questions')));
    out.questions = SURVEY_BUILTINS.filter((q) => picked.includes(q));
  }
  if (o.custom !== undefined) {
    const list = arr(o.custom, parseCustomQuestion, SURVEY_LIMITS.custom + 1);
    if (list.length > SURVEY_LIMITS.custom) bad('custom');
    out.custom = list;
  }
  if (!partial || o.teamStaffIds !== undefined) out.teamStaffIds = uniq(arr(o.teamStaffIds, (x) => id80(x, 'teamStaffIds'), 30));
  return out;
};
/** A survey has to ask something: a preset question or one of its own. */
function checkAsks(ctx: Ctx, questions: Survey['questions'], custom: unknown[]) {
  if (!questions.length && !custom.length) ctx.fail('mgmt.err.noQuestions');
}
/** The team asked about is real, active staff; with no "team" question there is no team. */
function checkTeam(d: Draft<ClubState>, ctx: Ctx, questions: Survey['questions'], team: string[]): string[] {
  if (!questions.includes('team')) return [];
  if (!team.length) ctx.fail('mgmt.err.teamRequired');
  for (const id of team) {
    const st = d.staff[id];
    if (!st || st.deletedAt || !st.active) ctx.fail('err.invalid', { field: 'teamStaffIds' });
  }
  return team;
}
/** Chosen members exist, and chosen contacts really can use the app (only they can answer). */
function checkAudience(d: Draft<ClubState>, ctx: Ctx, a: SurveyAudience): SurveyAudience {
  if (a.mode === 'members') {
    for (const id of a.memberIds ?? []) {
      const m = d.members[id];
      if (!m || m.deletedAt) ctx.fail('err.invalid', { field: 'audience.memberIds' });
    }
  }
  if (a.mode === 'contacts') {
    const ok = new Set(appFamilies(S(d), ctx.today).map((c) => c.id));
    for (const id of a.contactIds ?? []) {
      const c = d.familyContacts[id];
      if (!c || c.deletedAt) ctx.fail('err.invalid', { field: 'audience.contactIds' });
      if (!ok.has(id)) ctx.fail('mgmt.err.contactNoApp');
    }
  }
  return a;
}
function survey(d: Draft<ClubState>, id: string, ctx: Ctx) {
  const sv = d.surveys[id];
  if (!sv || sv.deletedAt) ctx.fail('err.notFound');
  return sv;
}

export const clubActions = [
  // ----- venue -----
  defineAction<VenueIn>({
    name: 'venue.book',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      return {
        org: str(o.org, 120, { required: true, field: 'org' }), contactName: str(o.contactName, 80, { required: true, field: 'contactName' }), phone: phone(o.phone, 'phone', false),
        guests: int(o.guests, 1, 500, 'guests'), roomId: id80(o.roomId, 'roomId'), date: isoDate(o.date, 'date'), from: hm(o.from, 'from'), to: hm(o.to, 'to'),
        price: money(o.price, 'price'), deposit: money(o.deposit, 'deposit'),
      };
    },
    run(d, i, ctx) {
      const chk = checkVenueSlot(S(d), i, ctx.today, ctx.now);
      if (!chk.ok) ctx.fail(chk.code, chk.params);
      const id = nextNumId(d.venueBookings, 'v');
      d.venueBookings[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, org: i.org, contactName: i.contactName, phone: i.phone, guests: i.guests, roomId: i.roomId, date: i.date, from: i.from, to: i.to,
        status: 'confirmed', ...(i.price !== undefined ? { price: i.price } : {}), ...(i.deposit !== undefined ? { deposit: i.deposit } : {}),
      };
      ctx.result.venueId = id;
      ctx.feed({ icon: 'storefront', key: 'mgmt.feed.venueBooked', params: { org: i.org, date: dm(i.date) } });
    },
  }),
  defineAction<VenueUpdateIn>({
    name: 'venue.update',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      return {
        venueId: id80(o.venueId, 'venueId'),
        ...(o.org !== undefined ? { org: str(o.org, 120, { required: true, field: 'org' }) } : {}),
        ...(o.contactName !== undefined ? { contactName: str(o.contactName, 80, { required: true, field: 'contactName' }) } : {}),
        ...(o.phone !== undefined ? { phone: phone(o.phone, 'phone', false) } : {}),
        ...(o.guests !== undefined ? { guests: int(o.guests, 1, 500, 'guests') } : {}),
        ...(o.roomId !== undefined ? { roomId: id80(o.roomId, 'roomId') } : {}),
        ...(o.date !== undefined ? { date: isoDate(o.date, 'date') } : {}),
        ...(o.from !== undefined ? { from: hm(o.from, 'from') } : {}),
        ...(o.to !== undefined ? { to: hm(o.to, 'to') } : {}),
        ...(o.price !== undefined ? { price: o.price === null ? null : money(o.price, 'price') } : {}),
        ...(o.deposit !== undefined ? { deposit: o.deposit === null ? null : money(o.deposit, 'deposit') } : {}),
      };
    },
    run(d, i, ctx) {
      const v = need(d.venueBookings[i.venueId], ctx);
      if (v.deletedAt) ctx.fail('err.notFound');
      if (v.status === 'cancelled') ctx.fail('mgmt.err.venueCancelled');
      const slot = { roomId: i.roomId ?? v.roomId, date: i.date ?? v.date, from: i.from ?? v.from, to: i.to ?? v.to };
      if (slot.roomId !== v.roomId || slot.date !== v.date || slot.from !== v.from || slot.to !== v.to) {
        const chk = checkVenueSlot(S(d), slot, ctx.today, ctx.now, v.id);
        if (!chk.ok) ctx.fail(chk.code, chk.params);
      }
      if (i.org !== undefined) v.org = i.org;
      if (i.contactName !== undefined) v.contactName = i.contactName;
      if (i.phone !== undefined) v.phone = i.phone;
      if (i.guests !== undefined) v.guests = i.guests;
      Object.assign(v, slot);
      for (const k of ['price', 'deposit'] as const) {
        if (i[k] === undefined) continue;
        if (i[k] === null) delete v[k];
        else v[k] = i[k] as number;
      }
      ctx.feed({ icon: 'storefront', key: 'mgmt.feed.venueUpdated', params: { org: v.org, date: dm(v.date) } });
    },
  }),
  defineAction<{ venueId: string }>({
    name: 'venue.cancel',
    can: mgmtOnly,
    parse: (raw) => ({ venueId: id80(obj(raw).venueId, 'venueId') }),
    run(d, i, ctx) {
      const v = need(d.venueBookings[i.venueId], ctx);
      if (v.deletedAt) ctx.fail('err.notFound');
      if (v.status === 'cancelled') ctx.fail('mgmt.err.venueCancelled');
      if (venueIsPast(v as unknown as VenueBooking, ctx.today, ctx.now)) ctx.fail('mgmt.err.venueDone');
      v.status = 'cancelled';
      ctx.feed({ icon: 'event_busy', key: 'mgmt.feed.venueCancelled', params: { org: v.org, date: dm(v.date) } });
    },
  }),
  defineAction<{ venueId: string }>({
    name: 'venue.askReview',
    can: mgmtOnly,
    parse: (raw) => ({ venueId: id80(obj(raw).venueId, 'venueId') }),
    run(d, i, ctx) {
      const v = need(d.venueBookings[i.venueId], ctx);
      if (v.deletedAt || v.status === 'cancelled') ctx.fail('err.notFound');
      if (!venueIsPast(v as unknown as VenueBooking, ctx.today, ctx.now)) ctx.fail('mgmt.err.venueNotDone');
      if (v.review) ctx.fail('mgmt.err.venueReviewed');
      if (v.reviewAskedAt) ctx.fail('mgmt.err.venueAsked');
      v.reviewAskedAt = ctx.nowDT;
      ctx.feed({ icon: 'rate_review', key: 'mgmt.feed.venueReviewAsked', params: { org: v.org } });
    },
  }),
  defineAction<{ venueId: string; stars: number; text: string }>({
    name: 'venue.recordReview',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      return { venueId: id80(o.venueId, 'venueId'), stars: int(o.stars, 1, 5, 'stars'), text: str(o.text, 500) };
    },
    run(d, i, ctx) {
      const v = need(d.venueBookings[i.venueId], ctx);
      if (v.deletedAt || v.status === 'cancelled') ctx.fail('err.notFound');
      if (v.date > ctx.today) ctx.fail('mgmt.err.venueNotDone');
      v.review = { stars: i.stars, text: i.text };
      if (!v.reviewAskedAt) v.reviewAskedAt = ctx.nowDT;
      ctx.feed({ icon: 'rate_review', key: 'mgmt.feed.venueReviewed', params: { org: v.org, stars: i.stars } });
    },
  }),
  // Simulated: records an invoice reference for the booking (the real invoice comes from Xero).
  defineAction<{ venueId: string }>({
    name: 'venue.createInvoice',
    can: mgmtOnly,
    parse: (raw) => ({ venueId: id80(obj(raw).venueId, 'venueId') }),
    run(d, i, ctx) {
      const v = need(d.venueBookings[i.venueId], ctx);
      if (v.deletedAt || v.status === 'cancelled') ctx.fail('err.notFound');
      const price = v.price ?? 0;
      if (price <= 0) ctx.fail('mgmt.err.venuePrice');
      if (v.invoiceRef) ctx.fail('mgmt.err.venueInvoiced');
      const prefix = `VEN-${v.date.slice(2, 4)}${v.date.slice(5, 7)}-`;
      const n = Object.values(d.venueBookings).filter((x) => x.invoiceRef?.startsWith(prefix)).length + 1;
      v.invoiceRef = prefix + String(n).padStart(3, '0');
      ctx.result.invoiceRef = v.invoiceRef;
      ctx.feed({ icon: 'receipt_long', key: 'mgmt.feed.venueInvoice', params: { org: v.org, ref: v.invoiceRef } });
      ctx.notify({ toRoles: ['finance'], kind: 'mgmt.notif.venueInvoice', params: { org: v.org, ref: v.invoiceRef, amount: rp(price) }, link: '/billing' });
    },
  }),

  // ----- broadcast -----
  defineAction<BcIn>({
    name: 'broadcast.send',
    can: mgmtOnly,
    parse: parseBc,
    run(d, i, ctx) {
      const rec = broadcastRecipients(S(d), i.audiences, ctx.today);
      if (!rec.length) ctx.fail('mgmt.err.noRecipients');
      const id = ctx.id('bc');
      d.broadcasts[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, template: i.template, message: i.message, audiences: i.audiences, recipients: rec.length, sendAt: ctx.nowDT, status: 'sent', sentAt: ctx.nowDT };
      ctx.result.broadcastId = id;
      ctx.result.recipients = rec.length;
      announce(ctx, i, rec);
    },
  }),
  defineAction<BcIn & { sendAt: string }>({
    name: 'broadcast.schedule',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      return { ...parseBc(raw), sendAt: dtStr(o.sendAt, 'sendAt') };
    },
    run(d, i, ctx) {
      if (i.sendAt <= ctx.nowDT) ctx.fail('mgmt.err.pastTime');
      const rec = broadcastRecipients(S(d), i.audiences, ctx.today);
      if (!rec.length) ctx.fail('mgmt.err.noRecipients');
      const id = ctx.id('bc');
      d.broadcasts[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, template: i.template, message: i.message, audiences: i.audiences, recipients: rec.length, sendAt: i.sendAt, status: 'scheduled' };
      ctx.result.broadcastId = id;
      ctx.result.recipients = rec.length;
      ctx.feed({ icon: 'schedule_send', key: 'mgmt.feed.broadcastScheduled', params: { n: rec.length, date: dm(i.sendAt.slice(0, 10)), time: i.sendAt.slice(11, 16) } });
    },
  }),
  defineAction<{ broadcastId: string }>({
    name: 'broadcast.cancel',
    can: mgmtOnly,
    parse: (raw) => ({ broadcastId: id80(obj(raw).broadcastId, 'broadcastId') }),
    run(d, i, ctx) {
      const b = need(d.broadcasts[i.broadcastId], ctx);
      if (b.deletedAt) ctx.fail('err.notFound');
      if (b.status !== 'scheduled') ctx.fail('mgmt.err.notScheduled');
      b.status = 'cancelled';
      ctx.feed({ icon: 'cancel_schedule_send', key: 'mgmt.feed.broadcastCancelled', params: {} });
    },
  }),
  defineAction<{ broadcastId: string } & Partial<BcIn> & { sendAt?: string }>({
    name: 'broadcast.update',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      return {
        broadcastId: id80(o.broadcastId, 'broadcastId'),
        ...(o.template !== undefined ? { template: oneOf(o.template, TEMPLATES, 'template') } : {}),
        ...(o.message !== undefined ? { message: str(o.message, 1000, { required: true, field: 'message' }) } : {}),
        ...(o.audiences !== undefined ? { audiences: uniq(arr(o.audiences, (x) => oneOf(x, AUDIENCES, 'audiences'))) } : {}),
        ...(o.sendAt !== undefined ? { sendAt: dtStr(o.sendAt, 'sendAt') } : {}),
      };
    },
    run(d, i, ctx) {
      const b = need(d.broadcasts[i.broadcastId], ctx);
      if (b.deletedAt) ctx.fail('err.notFound');
      if (b.status !== 'scheduled') ctx.fail('mgmt.err.notScheduled');
      if (i.template) b.template = i.template;
      if (i.message) b.message = i.message;
      if (i.audiences) {
        if (!i.audiences.length) ctx.fail('err.invalid', { field: 'audiences' });
        b.audiences = i.audiences;
      }
      if (i.sendAt) {
        if (i.sendAt <= ctx.nowDT) ctx.fail('mgmt.err.pastTime');
        b.sendAt = i.sendAt;
      }
      const rec = broadcastRecipients(S(d), b.audiences, ctx.today);
      if (!rec.length) ctx.fail('mgmt.err.noRecipients');
      b.recipients = rec.length;
    },
  }),
  defineAction<{ id?: string; title: string; text: string }>({
    name: 'template.upsert',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      const text = str(o.text, 600, { required: true, field: 'text' });
      if (!text.includes('{msg}')) bad('text', 'mgmt.err.tplMsg');
      return { ...(o.id ? { id: id80(o.id, 'id') } : {}), title: str(o.title, 60, { required: true, field: 'title' }), text };
    },
    run(d, i, ctx) {
      const list = d.club.settings.broadcastTemplates;
      if (i.id) {
        const t = need(list.find((x) => x.id === i.id), ctx);
        t.title = i.title;
        t.text = i.text;
        return;
      }
      const n = list.filter((x) => x.key === 'custom').length + 1;
      let id = `tpl-custom-${n}`;
      for (let k = n; list.some((x) => x.id === id); k++) id = `tpl-custom-${k + 1}`;
      list.push({ id, key: 'custom', title: i.title, text: i.text });
      ctx.result.templateId = id;
    },
  }),
  defineAction<{ id: string }>({
    name: 'template.remove',
    can: mgmtOnly,
    parse: (raw) => ({ id: id80(obj(raw).id, 'id') }),
    run(d, i, ctx) {
      const list = d.club.settings.broadcastTemplates;
      const at = list.findIndex((x) => x.id === i.id);
      if (at < 0) ctx.fail('err.notFound');
      if (list[at].key !== 'custom') ctx.fail('mgmt.err.tplBuiltIn');
      list.splice(at, 1);
    },
  }),

  // ----- surveys -----
  defineAction<SurveyIn>({
    name: 'survey.create',
    can: mgmtOnly,
    parse: (raw) => parseSurvey(obj(raw)) as SurveyIn,
    run(d, i, ctx) {
      const custom = assignQuestionIds(i.custom ?? []);
      checkAsks(ctx, i.questions, custom);
      const team = checkTeam(d, ctx, i.questions, i.teamStaffIds);
      const audience = checkAudience(d, ctx, i.audience ?? { mode: 'all' });
      const id = nextNumId(d.surveys, 'sv');
      // a draft already shows who it would go to; the list is worked out again when it is sent
      d.surveys[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, title: i.title, questions: i.questions, custom, teamStaffIds: team, recipients: resolveSurveyAudience(S(d), audience, ctx.today), audience, sentOn: '', status: 'draft' };
      ctx.result.surveyId = id;
      ctx.result.recipients = d.surveys[id].recipients.length;
    },
  }),
  defineAction<{ surveyId: string } & Partial<SurveyIn>>({
    name: 'survey.update',
    can: mgmtOnly,
    parse: (raw) => ({ surveyId: id80(obj(raw).surveyId, 'surveyId'), ...parseSurvey(obj(raw), true) }),
    run(d, i, ctx) {
      const sv = survey(d, i.surveyId, ctx);
      if (sv.status !== 'draft') ctx.fail('mgmt.err.notDraft');
      const questions = i.questions ?? (sv.questions as Survey['questions']);
      const custom = i.custom !== undefined ? assignQuestionIds(i.custom) : customOf(sv as Survey);
      checkAsks(ctx, questions, custom);
      const team = checkTeam(d, ctx, questions, i.teamStaffIds ?? (sv.teamStaffIds as string[]));
      if (i.title !== undefined) sv.title = i.title;
      sv.questions = questions;
      if (i.custom !== undefined) sv.custom = custom;
      sv.teamStaffIds = team;
      if (i.audience) sv.audience = checkAudience(d, ctx, i.audience);
      sv.recipients = resolveSurveyAudience(S(d), (sv.audience as SurveyAudience | undefined) ?? { mode: 'all' }, ctx.today);
      ctx.result.recipients = sv.recipients.length;
    },
  }),
  defineAction<{ surveyId: string }>({
    name: 'survey.delete',
    can: mgmtOnly,
    parse: (raw) => ({ surveyId: id80(obj(raw).surveyId, 'surveyId') }),
    run(d, i, ctx) {
      const sv = survey(d, i.surveyId, ctx);
      if (sv.status !== 'draft') ctx.fail('mgmt.err.notDraft');
      sv.deletedAt = ctx.nowDT;
    },
  }),
  defineAction<{ surveyId: string }>({
    name: 'survey.send',
    can: mgmtOnly,
    parse: (raw) => ({ surveyId: id80(obj(raw).surveyId, 'surveyId') }),
    run(d, i, ctx) {
      const sv = survey(d, i.surveyId, ctx);
      if (sv.status !== 'draft') ctx.fail('mgmt.err.notDraft');
      const rec = resolveSurveyAudience(S(d), sv.audience as SurveyAudience | undefined, ctx.today);
      if (!rec.length) ctx.fail('mgmt.err.noRecipients');
      for (const other of Object.values(d.surveys)) {
        if (other.id !== sv.id && !other.deletedAt && other.status === 'live') {
          other.status = 'closed';
          other.closedOn = ctx.today;
        }
      }
      sv.recipients = rec;
      sv.sentOn = ctx.today;
      sv.status = 'live';
      ctx.result.recipients = rec.length;
      ctx.feed({ icon: 'rate_review', key: 'mgmt.feed.surveySent', params: { title: sv.title, n: rec.length } });
    },
  }),
  defineAction<{ surveyId: string }>({
    name: 'survey.close',
    can: mgmtOnly,
    parse: (raw) => ({ surveyId: id80(obj(raw).surveyId, 'surveyId') }),
    run(d, i, ctx) {
      const sv = survey(d, i.surveyId, ctx);
      if (sv.status !== 'live') ctx.fail('mgmt.err.notLive');
      sv.status = 'closed';
      sv.closedOn = ctx.today;
      ctx.feed({ icon: 'rate_review', key: 'mgmt.feed.surveyClosed', params: { title: sv.title } });
    },
  }),
  defineAction<{ surveyId: string; overall: number; team: Record<string, number>; recommend: boolean | null; comment: string; answers: Record<string, SurveyAnswer> }>({
    name: 'survey.answer',
    can: (u, i, s) => isFamily(u) && !!s.surveys[i.surveyId] && s.surveys[i.surveyId].recipients.includes(u.id),
    parse(raw) {
      const o = obj(raw);
      const team: Record<string, number> = {};
      if (o.team !== undefined && o.team !== null) {
        for (const [k, v] of Object.entries(obj(o.team, 'team'))) team[str(k, 80)] = int(v, 1, 5, 'team');
      }
      // answers to the survey's own questions, by question id; each is checked against its question's kind in run
      const answers: Record<string, SurveyAnswer> = {};
      if (o.answers !== undefined && o.answers !== null) {
        const entries = Object.entries(obj(o.answers, 'answers'));
        if (entries.length > SURVEY_LIMITS.custom * 2) bad('answers');
        for (const [k, v] of entries) {
          if (typeof v !== 'number' && typeof v !== 'boolean' && typeof v !== 'string') bad('answers');
          answers[str(k, 12)] = v as SurveyAnswer;
        }
      }
      // 0 = not given; the survey decides whether the overall rating was asked
      const overall = o.overall === undefined || o.overall === null || o.overall === 0 ? 0 : int(o.overall, 1, 5, 'overall');
      return { surveyId: id80(o.surveyId, 'surveyId'), overall, team, recommend: o.recommend === true ? true : o.recommend === false ? false : null, comment: str(o.comment, 1000), answers };
    },
    run(d, i, ctx) {
      const sv = survey(d, i.surveyId, ctx);
      if (sv.status !== 'live') ctx.fail('mgmt.err.notLive');
      const me = ctx.user.id;
      if (!sv.recipients.includes(me)) ctx.fail('err.forbidden');
      if (Object.values(d.surveyResponses).some((r) => !r.deletedAt && r.surveyId === sv.id && r.familyId === me)) ctx.fail('mgmt.err.alreadyAnswered');
      const asks = (q: Survey['questions'][number]) => (sv.questions as string[]).includes(q);
      if (asks('overall') && !i.overall) ctx.fail('err.invalid', { field: 'overall' });
      const team: Record<string, number> = {};
      if (asks('team')) for (const [k, v] of Object.entries(i.team)) if ((sv.teamStaffIds as string[]).includes(k)) team[k] = v;
      // custom questions: every answer fits its kind, a required one cannot be left out; answers to unknown questions are dropped
      const custom = customOf(sv as Survey);
      const answers: Record<string, SurveyAnswer> = {};
      for (const q of custom) {
        const r = answerValue(q, i.answers[q.id]);
        if (!r.ok) ctx.fail('err.invalid', { field: `answers.${q.id}` });
        else if (r.value !== undefined) answers[q.id] = r.value;
        else if (q.required) ctx.fail('mgmt.err.answerRequired', { q: q.text });
      }
      const id = `sr-${sv.id}-${me}`;
      d.surveyResponses[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, surveyId: sv.id, familyId: me, overall: asks('overall') ? i.overall : 0, team, recommend: asks('recommend') ? i.recommend : null, comment: asks('comment') ? i.comment : '',
        ...(custom.length ? { answers } : {}), on: ctx.today,
      };
      const name = d.familyContacts[me]?.firstName || me;
      if (asks('overall')) ctx.feed({ icon: 'rate_review', key: 'mgmt.feed.surveyAnswered', params: { name, overall: i.overall } });
      else ctx.feed({ icon: 'rate_review', key: 'mgmt.feed.surveyAnsweredPlain', params: { name } });
    },
  }),

  // ----- prices and rules -----
  defineAction<{ flex: number; gold: number; extra: number; from: ISODate; notify?: boolean }>({
    name: 'prices.set',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      const price = (v: unknown, f: string) => {
        const n = int(v, 1, 1_000_000_000, f);
        return n;
      };
      return { flex: price(o.flex, 'flex'), gold: price(o.gold, 'gold'), extra: price(o.extra, 'extra'), from: isoDate(o.from, 'from'), notify: o.notify === undefined ? true : bool(o.notify) };
    },
    run(d, i, ctx) {
      if (i.from < ctx.today) ctx.fail('mgmt.err.pricePast');
      const s = S(d);
      const cur = priceOn(s, i.from);
      const exact = live(s.prices).find((p) => p.from === i.from);
      if (!exact && cur.flex === i.flex && cur.gold === i.gold && cur.extra === i.extra) ctx.fail('err.noChanges');
      if (exact && exact.flex === i.flex && exact.gold === i.gold && exact.extra === i.extra) ctx.fail('err.noChanges');
      const sample = { flex: cur.sample.flex && cur.flex === i.flex, gold: cur.sample.gold && cur.gold === i.gold, extra: cur.sample.extra && cur.extra === i.extra };
      if (exact) {
        const row = d.prices[exact.id];
        Object.assign(row, { flex: i.flex, gold: i.gold, extra: i.extra, sample, by: ctx.actor });
      } else {
        const id = ctx.id('price');
        d.prices[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, from: i.from, flex: i.flex, gold: i.gold, extra: i.extra, sample, by: ctx.actor };
      }
      ctx.feed({ icon: 'sell', key: 'mgmt.feed.prices', params: { date: dm(i.from) } });
      if (i.notify !== false) ctx.notify({ toRoles: ['finance'], kind: 'mgmt.notif.pricesChanged', params: { date: dm(i.from) }, link: '/billing' });
    },
  }),
  // The one club rule: how many visits a month a Flex member gets before a visit is an extra day. Counted from check-ins.
  defineAction<{ flexQuota: number }>({
    name: 'club.updateSettings',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      return { flexQuota: int(o.flexQuota, 1, 23, 'flexQuota') };
    },
    run(d, i, ctx) {
      const st = d.club.settings;
      if (i.flexQuota === st.flexQuota) ctx.fail('err.noChanges');
      st.flexQuota = i.flexQuota;
      ctx.feed({ icon: 'tune', key: 'mgmt.feed.rules', params: { quota: st.flexQuota } });
    },
  }),
];
