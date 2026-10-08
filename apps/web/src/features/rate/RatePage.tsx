// The public rating page (/rate/:token): a renter opens the link from WhatsApp on their phone, no sign-in. It shows their event, the venue
// survey's questions (stars, yes or no, the survey's own questions, a comment) and their name (the booking's contact, to change). Sent once:
// opening the link again, or a closed survey, shows a friendly message. English or Indonesian (the phone's language, with a switch).
// Language lives only in this tab's memory: the session store is not persisted from here, so a signed-in staff tab is never changed.
import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { missingRequired, type Lang, type Survey, type SurveyAnswer, type SurveyCustomQuestion } from '@cp/shared';
import { Button, Icon, Logo, TextField, chipStyle } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { useSession } from '../../store/session';
import { SurveyQuestion } from '../family/SurveyQuestion';
import { Stars } from '../family/parts';

interface RateInfo {
  state: 'open' | 'answered' | 'closed';
  club: string;
  booking: { org: string; contactName: string; date: string; from: string; to: string; room: string; roomNameId: string };
  survey: { title: string; questions: Survey['questions']; custom: SurveyCustomQuestion[] };
}
type View = { kind: 'loading' } | { kind: 'ready'; info: RateInfo } | { kind: 'bad' } | { kind: 'network' } | { kind: 'thanks'; already: boolean; name: string };

const initialLang = (): Lang => (typeof navigator !== 'undefined' && /^(id|in)\b/i.test(navigator.language || '') ? 'id' : 'en');
const cap: CSSProperties = { fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#24201C' };

/** The route element: sets this tab's language (without saving it), then shows the page. */
export function RatePage() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [synced, setSynced] = useState(false);
  useLayoutEffect(() => { useSession.setState({ lang }); setSynced(true); }, [lang]);
  if (!synced) return null;
  return <RateInner lang={lang} setLang={setLang} />;
}

function RateInner({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = useT();
  const { fdl } = useFmt();
  const { isPhone } = useDevice();
  const { token = '' } = useParams();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [overall, setOverall] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setView({ kind: 'loading' });
    try {
      const res = await fetch(`/api/public/rate/${encodeURIComponent(token)}`);
      if (res.status === 404) { setView({ kind: 'bad' }); return; }
      if (!res.ok) { setView({ kind: 'network' }); return; }
      const info = (await res.json()) as RateInfo;
      setName((n) => n || info.booking.contactName);
      setView(info.state === 'answered' ? { kind: 'thanks', already: true, name: info.booking.contactName } : { kind: 'ready', info });
    } catch { setView({ kind: 'network' }); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const was = document.title;
    document.title = `${t('mgmt.rtTab')} · CitraPremier`;
    return () => { document.title = was; };
  }, [t]);

  const body = ((): ReactNode => {
    if (view.kind === 'loading') return <Loading />;
    if (view.kind === 'bad') return <Message icon="link_off" title={t('mgmt.rtBadTitle')} text={t('mgmt.rtBadText')} />;
    if (view.kind === 'network') return <Message icon="cloud_off" title={t('mgmt.rtNetTitle')} text={t('mgmt.rtNetText')} action={<Button size={48} onClick={() => void load()}>{t('common.retry')}</Button>} />;
    if (view.kind === 'thanks') return <Message icon="favorite" tone="sage" title={view.already ? t('mgmt.rtAlreadyTitle') : view.name ? t('mgmt.rtThanksTitle', { name: view.name }) : t('mgmt.rtThanksAnon')} text={view.already ? t('mgmt.rtAlreadyText') : t('mgmt.rtThanksText')} />;
    const { info } = view;
    if (info.state === 'closed') return <Message icon="lock_clock" title={t('mgmt.rtClosedTitle')} text={t('mgmt.rtClosedText')} />;
    const sv = info.survey;
    const asks = (q: Survey['questions'][number]) => sv.questions.includes(q);
    const ready = (!asks('overall') || overall > 0) && missingRequired(sv, answers).length === 0;
    const setAnswer = (id: string, v: SurveyAnswer | undefined) => setAnswers((x) => { const n = { ...x }; if (v === undefined) delete n[id]; else n[id] = v; return n; });
    const send = async () => {
      if (!ready || busy) return;
      setBusy(true);
      setErr('');
      try {
        const res = await fetch(`/api/public/rate/${encodeURIComponent(token)}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), overall: asks('overall') ? overall : 0, recommend: asks('recommend') ? recommend : null, comment: asks('comment') ? comment.trim() : '', answers }),
        });
        const data = (await res.json().catch(() => ({}))) as { code?: string };
        if (res.ok) setView({ kind: 'thanks', already: false, name: name.trim() });
        else if (data.code === 'mgmt.err.alreadyAnswered') setView({ kind: 'thanks', already: true, name: name.trim() });
        else if (data.code === 'mgmt.err.notLive') setView({ kind: 'ready', info: { ...info, state: 'closed' } });
        else if (data.code === 'err.notFound') setView({ kind: 'bad' });
        else setErr(data.code === 'mgmt.err.answerRequired' ? t('mgmt.rtNeed') : t('mgmt.rtError'));
      } catch { setErr(t('err.network')); } finally { setBusy(false); }
    };
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: isPhone ? 30 : 36, lineHeight: 1.15, fontWeight: 500, letterSpacing: '-0.8px', color: '#5E4E3B', textWrap: 'balance' } as CSSProperties}>{t('mgmt.rtHello')}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '14px 16px', borderRadius: 14, background: '#FFFFFF' }}>
          <span style={{ fontSize: 17, lineHeight: '24px', fontWeight: 500, overflowWrap: 'anywhere' }}>{info.booking.org}</span>
          <span style={{ fontSize: 15, lineHeight: '22px', color: '#24201C' }}>{fdl(info.booking.date)} · {info.booking.from}–{info.booking.to}</span>
          <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{lang === 'id' && info.booking.roomNameId ? info.booking.roomNameId : info.booking.room}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '18px 16px', borderRadius: 14, background: '#FFFFFF' }}>
          {asks('overall') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={cap}>{t('mgmt.rtQOverall')}</span>
              <Stars value={overall} onChange={setOverall} size="big" group={t('mgmt.rtQOverall')} />
            </div>
          ) : null}
          {asks('recommend') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={cap}>{t('mgmt.rtQRecommend')}</span>
              <div role="radiogroup" aria-label={t('mgmt.rtQRecommend')} style={{ display: 'flex', gap: 8 }}>
                {([[true, t('common.yes')], [false, t('family.surveyNotYet')]] as [boolean, string][]).map(([v, label]) => {
                  const c = chipStyle(recommend === v, false);
                  return <button key={String(v)} type="button" role="radio" aria-checked={recommend === v} onClick={() => setRecommend(v)} style={{ flex: 1, height: 48, borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{label}</button>;
                })}
              </div>
            </div>
          ) : null}
          {sv.custom.map((q) => <SurveyQuestion key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />)}
          {asks('comment') ? <TextField label={t('mgmt.rtQComment')} value={comment} onChange={setComment} multiline rows={3} placeholder={t('common.optional')} maxLength={1000} /> : null}
          <TextField label={t('mgmt.rtName')} value={name} onChange={setName} maxLength={80} name="name" />
        </div>
        {err ? <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: '#F9E3DB', color: '#9A3D24', fontSize: 15, lineHeight: '22px' }}><Icon name="error" size={20} fill={1} /><span>{err}</span></div> : null}
        {!ready && (sv.custom.some((q) => q.required) || asks('overall')) ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#5E5852' }}>{t('mgmt.rtNeedHint')}</span> : null}
        <Button size={56} full disabled={!ready || busy} onClick={send}>{t('mgmt.rtSend')}</Button>
      </>
    );
  })();

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#F5F5F3', ...({ '--cp-body': isPhone ? '16px' : '0px', '--cp-small': isPhone ? '14px' : '0px' } as CSSProperties) }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: isPhone ? '14px 16px 36px' : '28px 20px 48px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Logo height={isPhone ? 40 : 48} />
          <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: '#EDE5DA', flex: 'none' }} role="group" aria-label={t('shell.language')}>
            {(['en', 'id'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} style={{ height: 40, minWidth: 48, padding: '0 12px', borderRadius: 12, border: 'none', background: lang === l ? '#FFFFFF' : 'transparent', boxShadow: lang === l ? '0 1px 3px rgba(40,30,20,.14)' : 'none', color: '#24201C', fontSize: 14, fontWeight: lang === l ? 600 : 500, cursor: 'pointer', fontFamily: 'Inter' }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        {body}
        <span style={{ fontSize: 13, lineHeight: '18px', color: '#8A8078', textAlign: 'center' }}>{t('mgmt.rtFooter')}</span>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[120, 84, 260].map((h, i) => <div key={i} style={{ height: h, borderRadius: 14, background: 'linear-gradient(90deg,#EFE9E1 0,#F7F3EE 40%,#EFE9E1 80%)', backgroundSize: '800px 100%', animation: 'cpShimmer 1.4s linear infinite' }} />)}
    </div>
  );
}

function Message({ icon, title, text, action, tone }: { icon: string; title: string; text: string; action?: ReactNode; tone?: 'sage' }) {
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '36px 22px', borderRadius: 16, background: '#FFFFFF' }}>
      <span style={{ width: 72, height: 72, borderRadius: 999, background: tone === 'sage' ? '#E3EFE6' : '#F3EEE8', color: tone === 'sage' ? '#3D6B4F' : '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={32} weight={300} /></span>
      <h1 style={{ margin: 0, fontSize: 26, lineHeight: '32px', fontWeight: 500, letterSpacing: '-0.5px', color: '#5E4E3B', textWrap: 'balance' } as CSSProperties}>{title}</h1>
      <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', color: '#4A4038', maxWidth: 380 }}>{text}</p>
      {action}
    </div>
  );
}
