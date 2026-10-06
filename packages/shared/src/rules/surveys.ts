// Surveys: one live at a time; response rate = recipients who answered / recipients.
// A survey asks the preset questions that are switched on (overall, team, recommend, comment) and the custom questions management wrote
// (stars, yes or no, one option out of several, free text). Older surveys have no custom questions and still read the same.
import type { ClubState, ISODate, Survey, SurveyAnswer, SurveyCustomQuestion, SurveyQuestionKind } from '../types';
import { live, sortBy } from '../util';

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

export const liveSurvey = (s: ClubState): Survey | undefined => live(s.surveys).find((x) => x.status === 'live');
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

export function surveyStats(s: ClubState, sv: Survey) {
  const rs = responsesOf(s, sv.id).filter((r) => sv.recipients.includes(r.familyId));
  const families = new Set(rs.map((r) => r.familyId));
  const avg = avgOf;
  const team = sv.teamStaffIds.map((id) => ({ staffId: id, avg: avg(rs.map((r) => r.team[id]).filter((x): x is number => typeof x === 'number')), n: rs.filter((r) => typeof r.team[id] === 'number').length }));
  const overalls = rs.map((r) => r.overall).filter((x) => x > 0); // a survey without the overall question stores 0
  return {
    responses: rs,
    answered: families.size,
    recipients: sv.recipients.length,
    rate: sv.recipients.length ? Math.round((families.size / sv.recipients.length) * 100) : 0,
    overall: avg(overalls),
    /** families who gave an overall rating */
    overallN: overalls.length,
    recommend: rs.filter((r) => r.recommend === true).length,
    team,
    comments: sortBy(rs.filter((r) => r.comment.trim()), (r) => r.on, -1),
    custom: customResults(sv, rs),
  };
}
export const answeredBy = (s: ClubState, surveyId: string, familyId: string) => responsesOf(s, surveyId).some((r) => r.familyId === familyId);
