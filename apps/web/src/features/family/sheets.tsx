// Family sheets: pay by virtual account, the survey, and feedback on lunch. (The club is drop-in: there are no booking, leave or
// absence sheets.)
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { liveSurvey, answeredBy, customOf, memberShort, menuOn, missingRequired, rp, staffCall, type Bank, type ISODate, type SurveyAnswer } from '@cp/shared';
import { BANKS, combinedVa, dishNamesOf, invoiceRows, isOpenStatus, servedLunch } from '@cp/shared/rules/family';
import { Avatar, Button, Sheet, TextField, chipStyle, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { Stars } from './parts';
import { SurveyQuestion } from './SurveyQuestion';
import { useStableFn } from './useFamily';
import { memberPhoto } from '../../lib/media';

// ---------- small shared pieces ----------
/**
 * The overlay primitive is a flex column that lets its children shrink when the content is taller than the sheet, which squashes
 * buttons. One wrapper that does not shrink keeps every sheet's controls at their full height; the sheet scrolls instead.
 */
function FSheet({ onClose, title, children }: { onClose: () => void; title: string; children: ReactNode }) {
  const { isPhone } = useDevice();
  // the overlay renders outside the app frame, so give it the phone type sizes the page uses (16px body, 14px small)
  const vars = { '--cp-body': isPhone ? '16px' : '0px', '--cp-small': isPhone ? '14px' : '0px' } as CSSProperties;
  return (
    <Sheet open onClose={onClose} title={title}>
      <div style={{ ...vars, display: 'flex', flexDirection: 'column', gap: 18, flexShrink: 0 }}>{children}</div>
    </Sheet>
  );
}
const capStyle: CSSProperties = { fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' };
const NoteBox = ({ children }: { children: ReactNode }) => <div style={{ padding: '14px 16px', borderRadius: 16, background: '#F4F0EE', fontSize: 16, lineHeight: '22px' }}>{children}</div>;

/** "For Oma Lina": who the sheet is about (families with two parents, and staff acting on a family's behalf). */
function ForMember({ memberId }: { memberId: string }) {
  const t = useT();
  const s = useClub();
  const m = s.members[memberId];
  if (!m) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: -6 }}>
      <Avatar name={`${m.title} ${m.firstName} ${m.lastName}`} tone={m.photoTone} src={memberPhoto(m)} size={36} />
      <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('family.forMember', { n: memberShort(m) })}</span>
    </div>
  );
}

// ---------- pay by virtual account ----------
export function PaySheet({ invoiceIds, open, onClose }: { invoiceIds: string[]; open: boolean; onClose: () => void }) {
  return open ? <PayInner invoiceIds={invoiceIds} onClose={onClose} /> : null;
}
function PayInner({ invoiceIds, onClose }: { invoiceIds: string[]; onClose: () => void }) {
  const t = useT();
  const { fmonth } = useFmt();
  const s = useClub();
  const { today } = useNow();
  const { user } = useMe();
  const act = useAct();
  const close = useStableFn(onClose);
  const [bank, setBank] = useState<Bank>('BCA');
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => {
    const ids = Array.from(new Set(invoiceIds.map((id) => s.invoices[id]?.memberId).filter(Boolean) as string[]));
    return invoiceRows(s, ids, today).filter((r) => invoiceIds.includes(r.inv.id) && isOpenStatus(r.status));
  }, [s, invoiceIds, today]);
  const total = rows.reduce((a, r) => a + r.balance, 0);
  const va = combinedVa(rows.map((r) => r.inv.va), bank);
  const first = user?.kind === 'family' ? user.contact.firstName : '';
  const copy = () => { try { void navigator.clipboard.writeText(va.replace(/\s/g, '')); } catch { /* clipboard blocked */ } say(t('family.copied')); };
  const simulate = async () => {
    if (busy || !rows.length) return;
    setBusy(true);
    const r = await act('payment.simulateVa', { invoiceIds: rows.map((x) => x.inv.id), bank }, { ok: t('family.paidT', { n: first }) });
    setBusy(false);
    if (r.ok) close();
  };
  return (
    <FSheet onClose={close} title={t('family.sPay')}>
      {rows.length ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r) => (
              <div key={r.inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 16, lineHeight: 1.4 }}>{rows.length > 1 ? `${memberShort(r.member)} · ` : ''}{t('family.invL', { p: fmonth(r.period, true) })} · {r.inv.number}</span>
                <span style={{ fontSize: rows.length > 1 ? 18 : 26, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rp(r.balance)}</span>
              </div>
            ))}
            {rows.length > 1 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingTop: 8, borderTop: '1px solid #EFECEA' }}>
                <span style={{ fontSize: 16, fontWeight: 500 }}>{t('family.payTotal')}</span>
                <span style={{ fontSize: 26, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{rp(total)}</span>
              </div>
            ) : null}
          </div>
          <div style={capStyle}>{t('family.bank')}</div>
          <div role="radiogroup" aria-label={t('family.bank')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {BANKS.map((b) => {
              const c = chipStyle(bank === b, false);
              return <button key={b} type="button" role="radio" aria-checked={bank === b} onClick={() => setBank(b)} style={{ height: 44, padding: '0 18px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{b}</button>;
            })}
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: '#F4F0EE', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={capStyle}>{t('family.vaNumber')} · DOKU</span>
              <span style={{ fontSize: 24, letterSpacing: '1px', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }} data-testid="va-number">{va}</span>
            </div>
            <Button variant="secondary" size={44} icon="content_copy" onClick={copy}>{t('common.copy')}</Button>
          </div>
          <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('family.autoConfirm')}</div>
          <button type="button" onClick={simulate} disabled={busy} style={{ height: 48, borderRadius: 999, border: '1px dashed #8A755B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('family.simPay')}</button>
        </>
      ) : <NoteBox>{t('family.invAllPaidSub')}</NoteBox>}
    </FSheet>
  );
}

// ---------- survey ----------
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
    <FSheet onClose={close} title={sv.title}>
      {asks('overall') ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={capStyle}>{t('family.surveyQ1')}</span>
          <Stars value={overall} onChange={setOverall} size="big" group={t('family.surveyOverall')} />
        </div>
      ) : null}
      {asks('team') && sv.teamStaffIds.length ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={capStyle}>{t('family.surveyTeam')}</span>
          {sv.teamStaffIds.map((id) => {
            const st = s.staff[id];
            if (!st) return null;
            return (
              <div key={id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', padding: '10px 0', borderBottom: '1px solid #EFECEA' }}>
                <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{staffCall(st)}</span>
                  <span style={{ fontSize: 14, lineHeight: '20px', color: '#6A6967' }}>{st.title}</span>
                </div>
                <Stars value={team[id] || 0} onChange={(n) => setTeam((x) => ({ ...x, [id]: n }))} size="small" group={staffCall(st)} />
              </div>
            );
          })}
        </div>
      ) : null}
      {asks('recommend') ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={capStyle}>{t('family.surveyRec')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {([[true, t('common.yes')], [false, t('family.surveyNotYet')]] as [boolean, string][]).map(([v, label]) => {
              const c = chipStyle(rec === v, false);
              return <button key={String(v)} type="button" aria-pressed={rec === v} onClick={() => setRec(v)} style={{ flex: 1, height: 48, borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{label}</button>;
            })}
          </div>
        </div>
      ) : null}
      {custom.map((q) => <SurveyQuestion key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />)}
      {asks('comment') ? <TextField label={t('family.surveyCmt')} value={comment} onChange={setComment} multiline rows={3} placeholder={t('common.optional')} maxLength={1000} /> : null}
      <div style={{ position: 'sticky', bottom: 0, paddingTop: 8, background: 'linear-gradient(to top, #FFFFFF 70%, rgba(255,255,255,0))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!ready && custom.some((q) => q.required) ? <span style={{ fontSize: FONT_BODY, lineHeight: 1.4, color: '#6A6967' }}>{t('family.surveyNeed')}</span> : null}
        <Button size={56} full disabled={!ok || busy} onClick={send}>{t('family.surveySend')}</Button>
      </div>
    </FSheet>
  );
}

// ---------- feedback on lunch ----------
export function LunchFeedbackSheet({ memberIds, open, onClose }: { memberIds: string[]; open: boolean; onClose: () => void }) {
  return open ? <FeedbackInner memberIds={memberIds} onClose={onClose} /> : null;
}
function FeedbackInner({ memberIds, onClose }: { memberIds: string[]; onClose: () => void }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const close = useStableFn(onClose);
  const [memberId, setMemberId] = useState(memberIds[0]);
  const [mealDate, setMealDate] = useState<ISODate>(today);
  const [dish, setDish] = useState<string>('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const m = s.members[memberId];
  const days = useMemo(() => {
    const past = Object.values(s.attendance).filter((a) => a.memberId === memberId && a.checkIn && a.date < today).map((a) => a.date).sort().reverse().slice(0, 2);
    return [today, ...past];
  }, [s, memberId, today]);
  const dishes = useMemo(() => {
    if (!m) return [];
    const menu = menuOn(s, mealDate);
    return menu ? Array.from(new Set(dishNamesOf(s, [...servedLunch(s, m, mealDate), ...menu.tea]))) : [];
  }, [s, m, mealDate]);
  if (!m) return null;
  const whole = t('family.tLunch');
  const chosen = dish || whole;
  const ok = text.trim().length > 0;
  const chip = (sel: boolean, label: string, onClick: () => void, key: string) => {
    const c = chipStyle(sel, false);
    return <button key={key} type="button" role="radio" aria-checked={sel} onClick={onClick} style={{ height: 44, padding: '0 16px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{label}</button>;
  };
  const send = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const r = await act('feedback.submit', { memberId, mealDate, dish: chosen, text: text.trim() }, { ok: t('family.fbSent') });
    setBusy(false);
    if (r.ok) close();
  };
  return (
    <FSheet onClose={close} title={t('family.fbTitle')}>
      {memberIds.length > 1 ? (
        <>
          <div style={capStyle}>{t('family.fbMember')}</div>
          <div role="radiogroup" aria-label={t('family.fbMember')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {memberIds.map((id) => chip(memberId === id, memberShort(s.members[id]), () => { setMemberId(id); setDish(''); setMealDate(today); }, id))}
          </div>
        </>
      ) : <ForMember memberId={memberId} />}
      <div style={capStyle}>{t('family.fbDay')}</div>
      <div role="radiogroup" aria-label={t('family.fbDay')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {days.map((d) => chip(mealDate === d, d === today ? t('common.today') : fds(d), () => { setMealDate(d); setDish(''); }, d))}
      </div>
      <div style={capStyle}>{t('family.fbDish')}</div>
      <div role="radiogroup" aria-label={t('family.fbDish')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {chip(chosen === whole, t('family.fbWhole'), () => setDish(''), 'whole')}
        {dishes.map((n) => chip(chosen === n, n, () => setDish(n), n))}
      </div>
      <TextField label={t('family.fbText')} value={text} onChange={setText} multiline rows={4} placeholder={t('family.fbPh')} maxLength={1000} />
      <Button size={56} full disabled={!ok || busy} onClick={send}>{t('family.fbSend')}</Button>
    </FSheet>
  );
}

