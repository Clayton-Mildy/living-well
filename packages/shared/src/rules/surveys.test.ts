// Survey rules: options typed one per line, question checks, ids, answers against a question's kind, required answers, results per question.
import { describe, it, expect } from 'vitest';
import { answerValue, assignQuestionIds, customResults, customOf, draftSurveys, liveSurvey, liveSurveys, missingRequired, parseOptions, questionProblem, ratingLinkOf, ratingTokenOf, responseRows, responseWho, surveyLog, surveyStats, surveyTemplatesOf, venueLinksOf, SURVEY_LIMITS } from './surveys';
import { buildSeed } from '../seed';
import type { Survey, SurveyCustomQuestion } from '../types';

const q = (over: Partial<SurveyCustomQuestion> & Pick<SurveyCustomQuestion, 'kind'>): SurveyCustomQuestion => ({ id: 'q1', text: 'A question?', required: false, ...over });
const rating = q({ kind: 'rating' });
const yesno = q({ id: 'q2', kind: 'yesno' });
const choice = q({ id: 'q3', kind: 'choice', options: ['Friday', 'Saturday', 'Sunday'] });
const text = q({ id: 'q4', kind: 'text' });

describe('parseOptions', () => {
  it('one option per line, trimmed, no blanks, no repeats (any case), order kept', () => {
    expect(parseOptions('Friday\n  Saturday  \n\n\nfriday\r\nSunday\n')).toEqual(['Friday', 'Saturday', 'Sunday']);
    expect(parseOptions('')).toEqual([]);
    expect(parseOptions('   \n  ')).toEqual([]);
  });
});

describe('questionProblem', () => {
  it('text is needed and short enough', () => {
    expect(questionProblem({ kind: 'rating', text: 'Fine?' })).toBeNull();
    expect(questionProblem({ kind: 'yesno', text: '   ' })).toBe('text');
    expect(questionProblem({ kind: 'text', text: 'x'.repeat(SURVEY_LIMITS.text) })).toBeNull();
    expect(questionProblem({ kind: 'text', text: 'x'.repeat(SURVEY_LIMITS.text + 1) })).toBe('text');
  });
  it('a choice needs 2 to 8 different options, each short; other kinds ignore options', () => {
    const c = (options: string[]) => questionProblem({ kind: 'choice', text: 'Pick', options });
    expect(c(['a', 'b'])).toBeNull();
    expect(c(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])).toBeNull();
    expect(c(['a'])).toBe('options');
    expect(c([])).toBe('options');
    expect(c(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])).toBe('options');
    expect(c(['a', 'A'])).toBe('options');
    expect(c(['a', ' '])).toBe('options');
    expect(c(['a', 'b'.repeat(SURVEY_LIMITS.option + 1)])).toBe('optionLong');
    expect(questionProblem({ kind: 'choice', text: 'Pick' })).toBe('options');
    expect(questionProblem({ kind: 'text', text: 'Pick', options: ['a'] })).toBeNull();
  });
});

describe('assignQuestionIds', () => {
  it('keeps valid unique ids and order; new, invalid and repeated ones take the lowest free number', () => {
    expect(assignQuestionIds([{}, {}, {}]).map((x) => x.id)).toEqual(['q1', 'q2', 'q3']);
    expect(assignQuestionIds([{ id: 'q3' }, { id: 'new1' }, { id: 'q1' }, {}]).map((x) => x.id)).toEqual(['q3', 'q2', 'q1', 'q4']);
    expect(assignQuestionIds([{ id: 'q2' }, { id: 'q2' }, { id: '' }, { id: 'Q1' }]).map((x) => x.id)).toEqual(['q2', 'q1', 'q3', 'q4']);
    expect(assignQuestionIds([])).toEqual([]);
    expect(assignQuestionIds([{ id: 'q1', k: 'kept' }])[0]).toEqual({ id: 'q1', k: 'kept' });
  });
});

describe('answerValue', () => {
  it('stars are whole numbers 1 to 5', () => {
    for (const v of [1, 3, 5]) expect(answerValue(rating, v)).toEqual({ ok: true, value: v });
    for (const v of [0, 6, 2.5, '4', true, {}, NaN]) expect(answerValue(rating, v)).toEqual({ ok: false });
  });
  it('yes or no is a boolean', () => {
    expect(answerValue(yesno, true)).toEqual({ ok: true, value: true });
    expect(answerValue(yesno, false)).toEqual({ ok: true, value: false });
    for (const v of ['yes', 1, 0, 'true']) expect(answerValue(yesno, v)).toEqual({ ok: false });
  });
  it('a choice is one of the options, exactly', () => {
    expect(answerValue(choice, 'Saturday')).toEqual({ ok: true, value: 'Saturday' });
    for (const v of ['saturday', 'Monday', 2, true]) expect(answerValue(choice, v)).toEqual({ ok: false });
    expect(answerValue(choice, '')).toEqual({ ok: true, value: undefined });
  });
  it('text is trimmed and cut to the limit; blank means no answer', () => {
    expect(answerValue(text, '  hi  ')).toEqual({ ok: true, value: 'hi' });
    expect(answerValue(text, '   ')).toEqual({ ok: true, value: undefined });
    expect((answerValue(text, 'x'.repeat(SURVEY_LIMITS.answer + 50)) as { value: string }).value).toHaveLength(SURVEY_LIMITS.answer);
    expect(answerValue(text, 5)).toEqual({ ok: false });
  });
  it('nothing given is no answer, for every kind', () => {
    for (const k of [rating, yesno, choice, text]) {
      expect(answerValue(k, undefined)).toEqual({ ok: true, value: undefined });
      expect(answerValue(k, null)).toEqual({ ok: true, value: undefined });
    }
  });
});

describe('missingRequired', () => {
  const sv = { custom: [{ ...rating, required: true }, yesno, { ...choice, required: true }, { ...text, required: true }] };
  it('lists the required questions without a usable answer', () => {
    expect(missingRequired(sv, {}).map((x) => x.id)).toEqual(['q1', 'q3', 'q4']);
    expect(missingRequired(sv, { q1: 4, q3: 'Friday', q4: 'ok' })).toEqual([]);
    expect(missingRequired(sv, { q1: 4, q3: 'Monday', q4: '  ' }).map((x) => x.id)).toEqual(['q3', 'q4']); // not an option, blank
    expect(missingRequired(sv, { q1: 9, q3: 'Friday', q4: 'ok' }).map((x) => x.id)).toEqual(['q1']);
  });
  it('an older survey has none', () => {
    expect(missingRequired({}, {})).toEqual([]);
    expect(customOf({})).toEqual([]);
  });
});

describe('results per question', () => {
  const sv = { custom: [rating, yesno, choice, text] } as unknown as Survey;
  const resp = (id: string, on: string, answers?: Record<string, number | boolean | string>) => ({ id, familyId: `f-${id}`, on, answers });
  it('counts each kind', () => {
    const [r, y, c, t] = customResults(sv, [
      resp('a', '2026-10-20', { q1: 5, q2: true, q3: 'Friday', q4: 'First' }),
      resp('b', '2026-10-22', { q1: 4, q2: true, q3: 'Sunday', q4: 'Later' }),
      resp('c', '2026-10-21', { q1: 4, q2: false, q3: 'Friday' }),
      resp('d', '2026-10-21'), // an older response without answers
    ]);
    expect(r).toMatchObject({ n: 3, avg: 4.3 });
    expect(y).toMatchObject({ n: 3, yes: 2, no: 1 });
    expect(c.counts).toEqual([{ option: 'Friday', n: 2 }, { option: 'Saturday', n: 0 }, { option: 'Sunday', n: 1 }]);
    expect(t.n).toBe(2);
    expect(t.texts.map((x) => x.text)).toEqual(['Later', 'First']); // newest first
  });
  it('ignores answers that do not fit the question and answers to questions the survey does not have', () => {
    const [r, , c] = customResults(sv, [resp('a', '2026-10-20', { q1: 9, q3: 'Monday', q7: 1 })]);
    expect(r.n).toBe(0);
    expect(c.counts.every((x) => x.n === 0)).toBe(true);
  });
  it('no custom questions, no results; the seed surveys still add up', () => {
    expect(customResults({} as Survey, [resp('a', '2026-10-20', { q1: 1 })])).toEqual([]);
    const s = buildSeed().citra;
    const st = surveyStats(s, s.surveys.sv1);
    expect(st).toMatchObject({ answered: 3, rate: 75, overallN: 3, custom: [] });
    expect(st.overall).toBeGreaterThan(0);
  });
});

describe('two live surveys, the log and venue surveys (round 7)', () => {
  const s = buildSeed('2026-10-21').citra;
  it('a family survey and a venue survey are live together; liveSurvey asks for the family one unless told otherwise', () => {
    expect(liveSurvey(s)?.id).toBe('sv1');
    expect(liveSurvey(s, 'family')?.id).toBe('sv1');
    expect(liveSurvey(s, 'venue')?.id).toBe('svv1');
    expect(liveSurveys(s).map((x) => x.id)).toEqual(['sv1', 'svv1']);
    expect(draftSurveys(s)).toEqual([]);
  });
  it('the log lists every survey sent, newest first, with sent, answered, rate and the average rating', () => {
    const log = surveyLog(s);
    expect(log.map((r) => r.survey.id)).toEqual(['sv1', 'svv1', 'sv0']);
    expect(log[0]).toMatchObject({ kind: 'family', sent: 4, answered: 3, rate: 75 });
    expect(log[0].closedOn).toBeUndefined();
    expect(log[1]).toMatchObject({ kind: 'venue', sent: 3, answered: 2, rate: 67, avg: 4.5, avgN: 2 });
    expect(log[2].closedOn).toBe(s.surveys.sv0.closedOn);
    // every survey of the seed keeps its history, oldest first
    expect(s.surveys.sv0.log!.map((l) => l.what)).toEqual(['created', 'sent', 'closed']);
    expect(s.surveys.sv1.log!.map((l) => l.what)).toEqual(['created', 'sent']);
    expect(s.surveys.svv1.log!.map((l) => l.what)).toEqual(['created', 'sent']);
  });
  it('a venue survey counts rating links sent and bookings that answered, and shows the renter as who answered', () => {
    const sv = s.surveys.svv1;
    expect(venueLinksOf(s, sv.id).map((b) => b.id).sort()).toEqual(['vr1', 'vr2', 'vr3']);
    const st = surveyStats(s, sv);
    expect(st).toMatchObject({ answered: 2, recipients: 3, overall: 4.5, overallN: 2, recommend: 2 });
    const rows = responseRows(s, sv);
    expect(rows.map((r) => responseWho(s, r))).toEqual(['Hendra Salim', 'Ratna Dewi']); // newest first
    expect(st.custom.map((r) => r.n)).toEqual([2, 1]); // "ready on time", "what could we do better" (one answered)
    expect(st.custom[0]).toMatchObject({ yes: 1, no: 1 });
    // the seeded bookings keep the rating too (as venue.rate does), the other past bookings stay open for the Venue page
    expect(s.venueBookings.vr1.review).toMatchObject({ stars: 4 });
    expect(s.venueBookings.v4.review).toMatchObject({ stars: 5 });
    expect(s.venueBookings.vr4.ratingToken).toBeUndefined();
  });
  it('rating links: a token reads back its booking and survey; unknown or empty tokens match nothing; answered shows as answered', () => {
    const open = ratingLinkOf(s, s.venueBookings.vr3.ratingToken);
    expect(open).toMatchObject({ state: 'open' });
    expect(open!.booking.id).toBe('vr3');
    expect(ratingLinkOf(s, s.venueBookings.vr1.ratingToken)).toMatchObject({ state: 'answered' });
    expect(ratingLinkOf(s, 'nothing')).toBeNull();
    expect(ratingLinkOf(s, undefined)).toBeNull();
    const closed = { ...s, surveys: { ...s.surveys, svv1: { ...s.surveys.svv1, status: 'closed' as const } } };
    expect(ratingLinkOf(closed, s.venueBookings.vr3.ratingToken)).toMatchObject({ state: 'closed' });
  });
  it('tokens are long, plain letters and digits, the same for the same seed and different for another', () => {
    const t = ratingTokenOf('a|b|c');
    expect(t).toMatch(/^[a-z0-9]{22}$/);
    expect(ratingTokenOf('a|b|c')).toBe(t);
    expect(ratingTokenOf('a|b|d')).not.toBe(t);
    expect(new Set(Object.values(s.venueBookings).map((b) => b.ratingToken).filter(Boolean)).size).toBe(3);
  });
  it('the four seed templates, with a venue one that asks about the room and what to do better', () => {
    expect(surveyTemplatesOf(s).map((x) => `${x.kind}:${x.title}`)).toEqual(['family:Activities feedback', 'family:Lunch and menu', 'family:Monthly family satisfaction', 'venue:Venue rating']);
    const venue = s.surveyTemplates.st4;
    expect(venue.questions).toEqual(['overall', 'recommend', 'comment']);
    expect(venue.custom.map((q) => [q.kind, q.text])).toEqual([['yesno', 'Was the room ready on time?'], ['text', 'What could we do better?']]);
    expect(s.surveyTemplates.st1.custom).toHaveLength(1);
    // the same in the 45-member world
    const big = buildSeed('2026-10-21', 598, { roster: true }).citra;
    expect(Object.keys(big.surveyTemplates).sort()).toEqual(['st1', 'st2', 'st3', 'st4']);
    expect(surveyStats(big, big.surveys.svv1)).toMatchObject({ answered: 2, recipients: 3 });
  });
});
