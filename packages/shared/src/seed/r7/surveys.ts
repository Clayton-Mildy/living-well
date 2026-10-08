// KC round 7 seed: survey templates, the survey log, and a live venue survey with answers from renters. Runs after the main seed (and the roster),
// so every member, staff row, booking and survey already exists. Everything here is on past days (relative to T), so nothing is "done today".
import type { Actor, ClubState, DT, ISODate, Row, Survey, SurveyCustomQuestion, SurveyResponse, SurveyTemplate, VenueBooking } from '../../types';
import { addDays, dow, e164 } from '../../util';
import { ratingTokenOf } from '../../rules/surveys';

const row = (clubId: string, id: string, createdAt: DT, createdBy: Actor): Row => ({ id, clubId, createdAt, createdBy });

export function seedSurveys(s: ClubState, T: ISODate): void {
  const C = s.clubId;
  const mgmt: Actor = 'staff:s9';
  const lastDow = (w: number) => { let x = addDays(T, -1); while (dow(x) !== w) x = addDays(x, -1); return x; };
  const lastSat = lastDow(6);

  // ----- templates -----
  const q = (id: string, kind: SurveyCustomQuestion['kind'], text: string, extra: Partial<SurveyCustomQuestion> = {}): SurveyCustomQuestion => ({ id, kind, text, required: false, ...extra });
  const tpl = (id: string, title: string, kind: SurveyTemplate['kind'], questions: SurveyTemplate['questions'], custom: SurveyCustomQuestion[], teamStaffIds?: string[]): SurveyTemplate => ({
    ...row(C, id, `${addDays(T, -40)}T10:00`, mgmt), title, kind, questions, custom, ...(teamStaffIds ? { teamStaffIds } : {}),
  });
  const OWN = (t: SurveyTemplate) => { s.surveyTemplates[t.id] = t; };
  OWN(tpl('st1', 'Monthly family satisfaction', 'family', ['overall', 'team', 'recommend', 'comment'], [q('q1', 'rating', 'How easy is it to reach the team when you need us?')], ['s1', 's8', 's5', 's3']));
  OWN(tpl('st2', 'Activities feedback', 'family', ['overall', 'comment'], [
    q('q1', 'choice', 'Which activity does your parent enjoy most?', { options: ['Music and singing', 'Art and craft', 'Gentle exercise', 'Games and puzzles', 'Gardening'] }),
    q('q2', 'rating', 'How do you rate the variety of activities?'),
  ]));
  OWN(tpl('st3', 'Lunch and menu', 'family', ['overall', 'comment'], [
    q('q1', 'rating', 'How do you rate the lunch menu?'),
    q('q2', 'yesno', 'Are the portions right for your parent?'),
    q('q3', 'text', 'Is there a dish you would like to see more often?'),
  ]));
  OWN({ ...tpl('st4', 'Venue rating', 'venue', ['overall', 'recommend', 'comment'], [
    q('q1', 'yesno', 'Was the room ready on time?'),
    q('q2', 'text', 'What could we do better?'),
  ]), builtIn: true }); // the venue is always there, so its rating template can't be deleted

  // ----- the history of the two surveys the main seed made -----
  type Log = NonNullable<Survey['log']>;
  const by = (sv: Survey): Actor => sv.createdBy;
  const sv0 = s.surveys.sv0, sv1 = s.surveys.sv1;
  if (sv0) {
    const log: Log = [{ at: sv0.createdAt, by: by(sv0), what: 'created' }, { at: `${sv0.sentOn}T10:00`, by: by(sv0), what: 'sent', note: String(sv0.recipients.length) }];
    if (sv0.closedOn) log.push({ at: `${sv0.closedOn}T10:00`, by: by(sv0), what: 'closed', note: 'replaced' });
    sv0.log = log;
    sv0.kind = 'family';
  }
  if (sv1) {
    sv1.log = [{ at: sv1.createdAt, by: by(sv1), what: 'created' }, { at: `${sv1.sentOn}T10:00`, by: by(sv1), what: 'sent', note: String(sv1.recipients.length) }];
    sv1.kind = 'family';
  }

  // ----- the venue survey and renters who answered through their rating links -----
  // Ids that do not look like v1, v2 … so a new booking or survey still takes the next free number.
  const vt = s.surveyTemplates.st4;
  const svId = 'svv1';
  const sentDay = addDays(lastSat, -14);
  s.surveys[svId] = {
    ...row(C, svId, `${sentDay}T13:30`, mgmt), title: vt.title, kind: 'venue', templateId: 'st4', questions: [...vt.questions], custom: vt.custom.map((c) => ({ ...c })), teamStaffIds: [], recipients: [], sentOn: sentDay, status: 'live',
    log: [{ at: `${sentDay}T13:30`, by: mgmt, what: 'created', note: vt.title }, { at: `${sentDay}T13:30`, by: mgmt, what: 'sent' }],
  };

  const book = (id: string, org: string, contactName: string, phone: string, guests: number, roomId: string, date: ISODate, from: string, to: string, price: number): VenueBooking => {
    const b: VenueBooking = { ...row(C, id, `${addDays(date, -25)}T10:00`, mgmt), org, contactName, phone: e164(phone), guests, roomId, date, from, to, status: 'confirmed', price, deposit: Math.round(price / 3 / 50000) * 50000 };
    s.venueBookings[id] = b;
    return b;
  };
  const link = (b: VenueBooking, askedAt: DT) => {
    b.surveyId = svId;
    b.ratingToken = ratingTokenOf(`seed|${C}|${b.id}|${b.createdAt}`);
    b.reviewAskedAt = askedAt;
  };
  const answer = (b: VenueBooking, name: string, at: DT, overall: number, recommend: boolean, comment: string, ready: boolean, better: string) => {
    const r: SurveyResponse = {
      ...row(C, `sr-${svId}-${b.id}`, at, 'system'), surveyId: svId, familyId: '', venueBookingId: b.id, respondentName: name, overall, team: {}, recommend, comment,
      answers: { q1: ready, ...(better ? { q2: better } : {}) }, on: at.slice(0, 10),
    };
    s.surveyResponses[r.id] = r;
    b.review = { stars: overall, text: comment };
  };

  const a = book('vr1', 'Alumni SMA 3 Jakarta reunion tea', 'Ibu Ratna Dewi', '+62 813-1190-4420', 45, 'room-whole', addDays(lastSat, -14), '09:00', '13:00', 4200000);
  link(a, `${a.date}T13:30`);
  answer(a, 'Ratna Dewi', `${addDays(a.date, 1)}T19:20`, 4, true, 'Lovely space and the team looked after our elders very well. The projector took a while to set up.', false, 'Have the projector ready before we arrive.');
  const b = book('vr2', 'Komunitas Batik Nusantara workshop', 'Bapak Hendra Salim', '+62 812-7760-3318', 28, 'room-garden-room', addDays(lastSat, -7), '08:00', '12:00', 3000000);
  link(b, `${b.date}T12:30`);
  answer(b, 'Hendra Salim', `${addDays(b.date, 2)}T08:45`, 5, true, 'Perfect for our batik workshop. The kue were delicious.', true, '');
  // asked, waiting for the renter to answer
  const c = book('vr3', 'Paguyuban Warga RW 05 Kemang evening gathering', 'Ibu Siska Lestari', '+62 811-9921-6604', 60, 'room-lounge', lastDow(5), '17:00', '20:00', 2400000);
  link(c, `${c.date}T20:30`);
  // finished, not asked yet: the Venue page offers "Ask for rating"
  book('vr4', 'Yayasan Pelita Hati charity bazaar', 'Bapak Andri Kusuma', '+62 813-8800-2571', 50, 'room-music', addDays(lastSat, -21), '09:00', '14:00', 3800000);
}
