// Family sheets: the survey and feedback on lunch (round 8: FamSheets). Paying happens on the Billing page's card.
import { useMemo, useState, type CSSProperties } from 'react';
import { liveSurvey, answeredBy, customOf, displayName, menuOn, missingRequired, staffCall, type ISODate, type SurveyAnswer } from '@cp/shared';
import { dishNamesOf, servedLunch } from '@cp/shared/rules/family';
import { useT, useFmt } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { Chips, F, FamSheet, HAIR, TextLink } from './kit';
import { Stars } from './parts';
import { SurveyQuestion } from './SurveyQuestion';
import { useStableFn } from './useFamily';

const label: CSSProperties = { fontSize: 13, letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 600, lineHeight: '18px', color: F.muted };
const greyBox: CSSProperties = { width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: 16, background: F.fill, padding: 14, fontSize: 16, lineHeight: '23px', fontFamily: 'Inter', color: F.text, resize: 'none', outline: 'none' };
const pillBtn = (on: boolean): CSSProperties => ({ flex: 1, height: 44, border: 'none', borderRadius: 999, background: on ? F.ink : F.fill, color: on ? '#FFFFFF' : F.text, fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' });

export function SurveySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <SurveyInner onClose={onClose} /> : null;
}
function SurveyInner({ onClose }: { onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const { user } = useMe();
  const act = useAct();
  const close = useStableFn(onClose);
  const [overall, setOverall] = useState(0);
  const [team, setTeam] = useState<Record<string, number>>({});
  const [rec, setRec] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [busy, setBusy] = useState(false);
  const sv = liveSurvey(s);
  if (!sv || !user || user.kind !== 'family') return null;
  const asks = (q: 'overall' | 'team' | 'recommend' | 'comment') => (sv.questions as string[]).includes(q);
  const custom = customOf(sv);
  const setAnswer = (id: string, v: SurveyAnswer | undefined) => setAnswers((x) => { const n = { ...x }; if (v === undefined) delete n[id]; else n[id] = v; return n; });
  const done = !answeredBy(s, sv.id, user.id);
  const ready = (!asks('overall') || overall > 0) && missingRequired(sv, answers).length === 0;
  const ok = ready && done;
  const send = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const r = await act('survey.answer', { surveyId: sv.id, overall: asks('overall') ? overall : 0, team: asks('team') ? team : {}, recommend: asks('recommend') ? rec : null, comment: asks('comment') ? comment.trim() : '', answers }, { ok: t('family.surveyThanks') });
    setBusy(false);
    if (r.ok) close();
  };
  return (
    <FamSheet open onClose={close} title={t('ftoday.surveyTitle')} testId="survey-sheet" action={{ label: t('fam.send'), onClick: send, disabled: !ok || busy }}>
      <span style={{ fontSize: 20, lineHeight: 1.3, fontWeight: 500, color: F.text }}>{sv.title}</span>
      {asks('overall') ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={label}>{t('family.surveyQ1')}</span>
          <Stars value={overall} onChange={setOverall} size="big" group={t('family.surveyOverall')} />
        </div>
      ) : null}
      {asks('team') && sv.teamStaffIds.length ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ ...label, paddingBottom: 4 }}>{t('family.surveyTeam')}</span>
          {sv.teamStaffIds.map((id, i) => {
            const st = s.staff[id];
            if (!st) return null;
            return (
              <div key={id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', padding: '10px 0', borderTop: i ? HAIR : 'none' }}>
                <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, color: F.text }}>{staffCall(st)}</span>
                  <span style={{ fontSize: 14, lineHeight: '20px', color: F.muted }}>{st.title}</span>
                </div>
                <Stars value={team[id] || 0} onChange={(n) => setTeam((x) => ({ ...x, [id]: n }))} size="small" group={staffCall(st)} />
              </div>
            );
          })}
        </div>
      ) : null}
      {asks('recommend') ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={label}>{t('family.surveyRec')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {([[true, t('common.yes')], [false, t('family.surveyNotYet')]] as [boolean, string][]).map(([v, text]) => (
              <button key={String(v)} type="button" aria-pressed={rec === v} onClick={() => setRec(v)} style={pillBtn(rec === v)}>{text}</button>
            ))}
          </div>
        </div>
      ) : null}
      {custom.map((q) => <SurveyQuestion key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />)}
      {asks('comment') ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={label}>{t('family.surveyCmt')}</span>
          <textarea aria-label={t('family.surveyCmt')} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('common.optional')} rows={3} maxLength={1000} style={greyBox} />
        </div>
      ) : null}
      {!ready && custom.some((q) => q.required) ? <span style={{ fontSize: 14, lineHeight: 1.4, color: F.muted }}>{t('family.surveyNeed')}</span> : null}
    </FamSheet>
  );
}

// ---------- feedback on lunch ----------
/** `date`: the meal day to start on (the day being read on Today); the family can still pick today or a recent visit. */
export function LunchFeedbackSheet({ memberIds, open, onClose, date }: { memberIds: string[]; open: boolean; onClose: () => void; date?: ISODate }) {
  return open ? <FeedbackInner memberIds={memberIds} date={date} onClose={onClose} /> : null;
}
function FeedbackInner({ memberIds, date, onClose }: { memberIds: string[]; date?: ISODate; onClose: () => void }) {
  const t = useT();
  const { fds, fdl } = useFmt();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const close = useStableFn(onClose);
  const [memberId, setMemberId] = useState(memberIds[0]);
  const [picked, setPicked] = useState<ISODate>(date ?? today);
  const [dish, setDish] = useState<string>('');
  const [text, setText] = useState('');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const m = s.members[memberId];
  const days = useMemo(() => {
    const past = Object.values(s.attendance).filter((a) => a.memberId === memberId && a.checkIn && a.date < today).map((a) => a.date).sort().reverse().slice(0, 2);
    return Array.from(new Set([today, ...past, ...(date && date <= today ? [date] : [])])).sort().reverse();
  }, [s, memberId, today, date]);
  const mealDate = days.includes(picked) ? picked : days[0];
  const lunchNames = useMemo(() => (m ? dishNamesOf(s, servedLunch(s, m, mealDate)) : []), [s, m, mealDate]);
  const dishes = useMemo(() => {
    if (!m) return [];
    const menu = menuOn(s, mealDate, { approvedOnly: true }); // what families may see: a menu waiting for approval is left out
    return menu ? Array.from(new Set(dishNamesOf(s, [...servedLunch(s, m, mealDate), ...menu.tea]))) : [];
  }, [s, m, mealDate]);
  if (!m) return null;
  const whole = t('family.tLunch');
  const chosen = dish && dishes.includes(dish) ? dish : whole;
  const ok = text.trim().length > 0;
  const what = chosen === whole ? lunchNames.slice(0, 2).join(', ') || whole : chosen;
  const send = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const r = await act('feedback.submit', { memberId, mealDate, dish: chosen, text: text.trim() }, { ok: t('family.fbSent') });
    setBusy(false);
    if (r.ok) close();
  };
  return (
    <FamSheet open onClose={close} title={t('ftoday.fbTitle')} testId="feedback-sheet" action={{ label: t('fam.send'), onClick: send, disabled: !ok || busy }}>
      <span style={{ fontSize: 15, lineHeight: '21px', color: F.muted }}>{t('ftoday.fbLine', { what, d: fdl(mealDate) })}</span>
      {memberIds.length > 1 ? <Chips label={t('family.fbMember')} bleed={18} value={memberId} onChange={(id) => { setMemberId(id); setDish(''); }} items={memberIds.map((id) => ({ value: id, label: displayName(s.members[id]) }))} /> : null}
      {days.length > 1 || dishes.length > 1 ? (
        more ? (
          <>
            {days.length > 1 ? <Chips label={t('family.fbDay')} bleed={18} value={mealDate} onChange={(d) => { setPicked(d); setDish(''); }} items={days.map((d) => ({ value: d, label: d === today ? t('common.today') : fds(d) }))} /> : null}
            {dishes.length > 1 ? <Chips label={t('family.fbDish')} bleed={18} value={dish && dishes.includes(dish) ? dish : ''} onChange={setDish} items={[{ value: '', label: t('family.fbWhole') }, ...dishes.map((n) => ({ value: n, label: n }))]} /> : null}
          </>
        ) : <TextLink size={14} onClick={() => setMore(true)} style={{ alignSelf: 'flex-start' }} testId="fb-change">{t('ftoday.fbChange')}</TextLink>
      ) : null}
      <textarea aria-label={t('family.fbText')} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ftoday.fbPh', { n: displayName(m) })} rows={5} maxLength={1000} style={greyBox} autoFocus />
    </FamSheet>
  );
}
