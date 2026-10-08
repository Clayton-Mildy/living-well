// Surveys: one live family survey and one live venue survey at a time; response rate = recipients who answered / recipients.
// A survey asks the preset questions that are switched on (overall, team, recommend, comment) and the custom questions management wrote
// (stars, yes or no, one option out of several, free text). Older surveys have no custom questions and still read the same.
// KC round 7: a 'venue' survey is answered by people who rented the venue, through the no-login rating link of their booking (/rate/:token);
// 'recipients' of a venue survey is empty and its "sent" count is the number of bookings whose link points at it.
import type { ClubState, ISODate, Survey, SurveyAnswer, SurveyCustomQuestion, SurveyQuestionKind, SurveyResponse, SurveyTemplate, VenueBooking } from '../types';
import { live, sortBy } from '../util';

export type SurveyKind = NonNullable<Survey['kind']>;
export const SURVEY_KIND_LIST: SurveyKind[] = ['family', 'venue'];
export const surveyKind = (sv: Pick<Survey, 'kind'>): SurveyKind => sv.kind ?? 'family';
/** The preset questions a kind of survey can ask: renters have no team to rate. */
export const presetsFor = (kind: SurveyKind): Survey['questions'] => (kind === 'venue' ? ['overall', 'recommend', 'comment'] : ['overall', 'team', 'recommend', 'comment']);

export const SURVEY_BUILTINS: Survey['questions'] = ['overall', 'team', 'recommend', 'comment'];
export const SURVEY_KINDS: SurveyQuestionKind[] = ['rating', 'yesno', 'choice', 'text'];
/** Limits on a survey's own questions: how many, how long, how many options, how long an answer can be. */
export const SURVEY_LIMITS = { custom: 12, text: 200, optionsMin: 2, optionsMax: 8, option: 60, answer: 1000 } as const;

export const customOf = (sv: Pick<Survey, 'custom'>): SurveyCustomQuestion[] => sv.custom ?? [];

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Options typed one per line: trimmed, blank lines dropped, repeats dropped (compared ignoring case). */
export function parseOptions(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const o = line.trim();
    if (o && !out.some((x) => same(x, o))) out.push(o);
  }
  return out;
}

export type QuestionProblem = 'text' | 'options' | 'optionLong';
/** What is wrong with a question as typed (null = fine): no text, text too long, a choice without 2 to 8 different options, an option too long. */
export function questionProblem(q: { kind: SurveyQuestionKind; text: string; options?: string[] }): QuestionProblem | null {
  const text = q.text.trim();
  if (!text || text.length > SURVEY_LIMITS.text) return 'text';
  if (q.kind !== 'choice') return null;
  const o = q.options ?? [];
  if (o.length < SURVEY_LIMITS.optionsMin || o.length > SURVEY_LIMITS.optionsMax || o.some((x, i) => !x.trim() || o.findIndex((y) => same(y, x)) !== i)) return 'options';
  if (o.some((x) => x.length > SURVEY_LIMITS.option)) return 'optionLong';
  return null;
}

/** Ids for a list of questions: a valid unique id (q1, q2, …) is kept, every other question gets the lowest unused one. Order is kept. */
export function assignQuestionIds<T extends { id?: string }>(list: T[]): (T & { id: string })[] {
  const used = new Set<string>();
  for (const q of list) if (q.id && /^q\d{1,3}$/.test(q.id) && !used.has(q.id)) used.add(q.id);
  const taken = new Set<string>();
  let n = 0;
  return list.map((q) => {
    if (q.id && /^q\d{1,3}$/.test(q.id) && !taken.has(q.id)) {
      taken.add(q.id);
      return { ...q, id: q.id };
    }
    do n++; while (used.has(`q${n}`));
    used.add(`q${n}`);
    taken.add(`q${n}`);
    return { ...q, id: `q${n}` };
  });
}

export type AnswerResult = { ok: true; value: SurveyAnswer | undefined } | { ok: false };
/** One answer checked against its question. `value` is undefined when nothing was answered; `ok: false` when it does not fit the question's kind. */
export function answerValue(q: SurveyCustomQuestion, v: unknown): AnswerResult {
  if (v === undefined || v === null) return { ok: true, value: undefined };
  switch (q.kind) {
    case 'rating':
      return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5 ? { ok: true, value: v } : { ok: false };
    case 'yesno':
      return typeof v === 'boolean' ? { ok: true, value: v } : { ok: false };
    case 'choice':
      if (typeof v !== 'string') return { ok: false };
      return v === '' ? { ok: true, value: undefined } : (q.options ?? []).includes(v) ? { ok: true, value: v } : { ok: false };
    default: {
      if (typeof v !== 'string') return { ok: false };
      const s = v.trim().slice(0, SURVEY_LIMITS.answer);
      return { ok: true, value: s || undefined };
    }
  }
}
/** Required custom questions that have no answer yet (an answer that does not fit counts as missing). */
export function missingRequired(sv: Pick<Survey, 'custom'>, answers: Record<string, unknown>): SurveyCustomQuestion[] {
  return customOf(sv).filter((q) => {
    if (!q.required) return false;
    const r = answerValue(q, answers[q.id]);
    return !r.ok || r.value === undefined;
  });
}

/** The live survey of a kind (one family survey and one venue survey can be live together). Without a kind: the family survey. */
export const liveSurvey = (s: ClubState, kind: SurveyKind = 'family'): Survey | undefined => live(s.surveys).find((x) => x.status === 'live' && surveyKind(x) === kind);
export const responsesOf = (s: ClubState, surveyId: string) => live(s.surveyResponses).filter((r) => r.surveyId === surveyId);

/** What the families answered to one custom question. Only the fields of the question's kind are filled. */
export interface CustomResult {
  q: SurveyCustomQuestion;
  /** families who answered it */
  n: number;
  /** rating: average stars (one decimal), 0 when nobody answered */
  avg: number;
  /** yes or no: counts */
  yes: number;
  no: number;
  /** choice: how many picked each option, in the order of the options */
  counts: { option: string; n: number }[];
  /** text: the answers, newest first */
  texts: { id: string; text: string; familyId: string; on: ISODate }[];
}
const avgOf = (a: number[]) => (a.length ? Math.round((a.reduce((t, x) => t + x, 0) / a.length) * 10) / 10 : 0);
type ResponseLike = { id: string; familyId: string; on: ISODate; answers?: Record<string, SurveyAnswer> };
export function customResults(sv: Survey, rs: ResponseLike[]): CustomResult[] {
  return customOf(sv).map((q) => {
    const got: { r: ResponseLike; v: SurveyAnswer }[] = [];
    for (const r of rs) {
      const a = answerValue(q, r.answers?.[q.id]);
      if (a.ok && a.value !== undefined) got.push({ r, v: a.value });
    }
    const vals = got.map((x) => x.v);
    return {
      q,
      n: got.length,
      avg: q.kind === 'rating' ? avgOf(vals as number[]) : 0,
      yes: q.kind === 'yesno' ? vals.filter((v) => v === true).length : 0,
      no: q.kind === 'yesno' ? vals.filter((v) => v === false).length : 0,
      counts: q.kind === 'choice' ? (q.options ?? []).map((option) => ({ option, n: vals.filter((v) => v === option).length })) : [],
      texts: q.kind === 'text' ? sortBy(got.map((x) => ({ id: x.r.id, text: String(x.v), familyId: x.r.familyId, on: x.r.on })), (x) => x.on + x.id, -1) : [],
    };
  });
}

/** The bookings whose rating link points at a venue survey (the renters it was "sent" to). */
export const venueLinksOf = (s: ClubState, surveyId: string): VenueBooking[] => live(s.venueBookings).filter((b) => b.surveyId === surveyId && !!b.ratingToken);

/** The numbers of one survey. A family survey counts families (recipients); a venue survey counts rating links sent and bookings that answered. */
export function surveyStats(s: ClubState, sv: Survey) {
  const venue = surveyKind(sv) === 'venue';
  const rs = responsesOf(s, sv.id).filter((r) => (venue ? !!r.venueBookingId : sv.recipients.includes(r.familyId)));
  const who = new Set(rs.map((r) => (venue ? r.venueBookingId : r.familyId)));
  const sent = venue ? venueLinksOf(s, sv.id).length : sv.recipients.length;
  const avg = avgOf;
  const team = sv.teamStaffIds.map((id) => ({ staffId: id, avg: avg(rs.map((r) => r.team[id]).filter((x): x is number => typeof x === 'number')), n: rs.filter((r) => typeof r.team[id] === 'number').length }));
  const overalls = rs.map((r) => r.overall).filter((x) => x > 0); // a survey without the overall question stores 0
  return {
    responses: rs,
    answered: who.size,
    /** how many it went to: families, or rating links sent for a venue survey */
    recipients: sent,
    rate: sent ? Math.min(100, Math.round((who.size / sent) * 100)) : 0,
    overall: avg(overalls),
    /** answers that gave an overall rating */
    overallN: overalls.length,
    recommend: rs.filter((r) => r.recommend === true).length,
    team,
    comments: sortBy(rs.filter((r) => r.comment.trim()), (r) => r.on, -1),
    custom: customResults(sv, rs),
  };
}
export const answeredBy = (s: ClubState, surveyId: string, familyId: string) => responsesOf(s, surveyId).some((r) => r.familyId === familyId);

/** Who answered: the family contact, or the renter's name (what they typed on the rating page, else the booking's contact). */
export const responseWho = (s: ClubState, r: Pick<SurveyResponse, 'familyId' | 'venueBookingId' | 'respondentName'>): string =>
  r.venueBookingId ? r.respondentName || s.venueBookings[r.venueBookingId]?.contactName || '' : s.familyContacts[r.familyId]?.name || r.familyId;

/** The answers to one survey, newest first (the Responses list). */
export function responseRows(s: ClubState, sv: Survey): SurveyResponse[] {
  return sortBy(surveyStats(s, sv).responses, (r) => r.createdAt + r.id, -1);
}

// ---------- the survey log ----------
export interface SurveyLogRow {
  survey: Survey;
  kind: SurveyKind;
  sentOn: ISODate;
  /** closed surveys: the day it closed; live ones: undefined */
  closedOn?: ISODate;
  sent: number;
  answered: number;
  rate: number;
  /** average overall rating, 0 when nobody gave one */
  avg: number;
  avgN: number;
}
/** Every survey ever sent (live and closed), newest first. */
export function surveyLog(s: ClubState): SurveyLogRow[] {
  const rows = live(s.surveys).filter((x) => x.status !== 'draft').map((sv): SurveyLogRow => {
    const st = surveyStats(s, sv);
    return { survey: sv, kind: surveyKind(sv), sentOn: sv.sentOn, ...(sv.status === 'closed' ? { closedOn: sv.closedOn } : {}), sent: st.recipients, answered: st.answered, rate: st.rate, avg: st.overall, avgN: st.overallN };
  });
  return sortBy(rows, (r) => r.sentOn + r.survey.createdAt + r.survey.id, -1);
}
/** Drafts, newest first. */
export const draftSurveys = (s: ClubState): Survey[] => sortBy(live(s.surveys).filter((x) => x.status === 'draft'), (x) => x.createdAt + x.id, -1);
/** Live surveys: the family one first, then the venue one. */
export const liveSurveys = (s: ClubState): Survey[] => SURVEY_KIND_LIST.map((k) => liveSurvey(s, k)).filter((x): x is Survey => !!x);

// ---------- templates ----------
/** Templates, family ones first, each group by title. */
export const surveyTemplatesOf = (s: ClubState): SurveyTemplate[] => sortBy(live(s.surveyTemplates), (t) => (t.kind === 'family' ? '0' : '1') + t.title.toLowerCase());

// ---------- the venue rating link ----------
// Not secret in the cryptographic sense (this is a demo): a long string nobody would guess, the same on the browser and the server for one mutation.
function cyrb53(str: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
/** A rating-link token (22 or so lower-case letters and digits) made from any seed text. */
export const ratingTokenOf = (seed: string): string => cyrb53(seed, 7).toString(36).padStart(11, '0') + cyrb53(seed, 31).toString(36).padStart(11, '0');
/** The path of a booking's rating page. */
export const ratePath = (token: string) => `/rate/${token}`;

export type RatingLinkState = 'open' | 'answered' | 'closed';
export interface RatingLink { booking: VenueBooking; survey: Survey; state: RatingLinkState }
/** What a rating link points at: the booking, its venue survey and whether it can still be answered. Null for a token that matches nothing. */
export function ratingLinkOf(s: ClubState, token: string | undefined | null): RatingLink | null {
  if (!token) return null;
  const booking = live(s.venueBookings).find((b) => b.ratingToken === token);
  const survey = booking?.surveyId ? s.surveys[booking.surveyId] : undefined;
  if (!booking || !survey || survey.deletedAt || surveyKind(survey) !== 'venue') return null;
  const answered = !!booking.review || responsesOf(s, survey.id).some((r) => r.venueBookingId === booking.id);
  return { booking, survey, state: answered ? 'answered' : survey.status === 'live' ? 'open' : 'closed' };
}
/** The answer a booking's renter gave through the link, if any. */
export const venueResponseOf = (s: ClubState, bookingId: string): SurveyResponse | undefined =>
  sortBy(live(s.surveyResponses).filter((r) => r.venueBookingId === bookingId), (r) => r.createdAt, -1)[0];

// ---------- the history of a survey ----------
export type SurveyLogEntry = NonNullable<Survey['log']>[number];
export const surveyHistory = (sv: Pick<Survey, 'log'>): SurveyLogEntry[] => sv.log ?? [];
