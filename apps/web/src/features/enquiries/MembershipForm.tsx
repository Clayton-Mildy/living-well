// Public membership form (design ShowForm): opened from a link (/form/:token) with no sign-in. Seven steps, phone first, EN/ID,
// simulated uploads, a signature pad, drafts saved as you go, a Done state. Talks to /api/form/:token and /api/form/:token/<open|saveDraft|submit>.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Enquiry, Member, MembershipForm as FormData, FormRequest, MedTiming, Relation, Title } from '@cp/shared';
import { fmtPhone } from '@cp/shared';
import { DIETS, DRUGS, FOODS, FORM_RELATIONS, MOBILITIES, TIMINGS, TITLES, draftFromEnquiry, draftFromMember, formErrors, stepValid } from '@cp/shared/rules/enquiries';
import { DateField, FONT_BODY, FONT_SMALL, Icon, IconButton, Logo, photoBg } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useT, useFmt } from '../../lib/i18n';
import { useSession } from '../../store/session';
import { SignaturePad } from './SignaturePad';

interface Payload { clubId: string; club: { name: string; fullName: string }; form: FormRequest; target: Enquiry | Member; clock: { today: string; now: string } }
type D = Partial<FormData>;
const STEPS = 7;
const label: React.CSSProperties = { fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' };
const input: React.CSSProperties = { height: 52, border: '1px solid #8A755B', borderRadius: 16, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none', width: '100%', minWidth: 0 };
const COMMON: [string, string, MedTiming][] = [['Amlodipine', '5 mg', 'morningHome'], ['Metformin', '500 mg', 'lunchClub'], ['Simvastatin', '20 mg', 'eveningHome'], ['Aspirin', '80 mg', 'morningHome'], ['Calcium + Vitamin D', '1 tablet', 'lunchClub'], ['Donepezil', '5 mg', 'eveningHome']];
let seq = 0;
const mutation = () => `form-${Date.now().toString(36)}-${(++seq).toString(36)}`;

export function MembershipForm() {
  const { token = '' } = useParams();
  const t = useT();
  const { fdl } = useFmt();
  const { lang, setLang, user } = useSession();
  const navigate = useNavigate();
  const [load, setLoad] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [data, setData] = useState<Payload | null>(null);
  const [d, setD] = useState<D>({});
  const [cond, setCond] = useState('');
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<'sent' | 'approved' | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [medName, setMedName] = useState('');
  const [drugOther, setDrugOther] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);

  // language: a family opening the link on their phone gets Indonesian when their phone is set to it
  useEffect(() => {
    try { if (!localStorage.getItem('cp.session') && navigator.language?.toLowerCase().startsWith('id')) setLang('id'); } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await api<Payload>(`/api/form/${encodeURIComponent(token)}`);
        if (!live) return;
        const f = r.form;
        const base: D = f.target.type === 'enquiry' ? draftFromEnquiry(r.target as Enquiry) : draftFromMember(r.target as Member, f.sentTo);
        const start: D = f.status === 'draft' || f.status === 'returned' ? { ...base, ...(f.draft || {}) } : base;
        setData(r);
        setD(start);
        setCond((start.conditions || []).join(', '));
        setStep(f.status === 'draft' || f.status === 'returned' ? Math.min(6, f.step ?? (f.status === 'returned' ? 6 : 0)) : 0);
        if (f.status === 'submitted') setDone('sent');
        if (f.status === 'approved') setDone('approved');
        setLoad('ready');
        if (f.status === 'sent') void api(`/api/form/${encodeURIComponent(token)}/open`, { body: { input: {}, mutationId: mutation() } }).catch(() => undefined);
      } catch (e) {
        if (live) setLoad(e instanceof ApiError && e.status === 404 ? 'missing' : 'error');
      }
    })();
    return () => { live = false; };
  }, [token]);

  const today = data?.clock.today || new Date().toISOString().slice(0, 10);
  const conds = useMemo(() => cond.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean), [cond]);
  const draft: D = useMemo(() => ({ ...d, conditions: conds }), [d, conds]);
  const set = (p: D) => { dirty.current = true; setD((x) => ({ ...x, ...p })); };
  const toTop = () => scroller.current?.scrollTo({ top: 0 });

  const save = useCallback(async (at: number, body: D) => {
    if (!token || done) return;
    try {
      await api(`/api/form/${encodeURIComponent(token)}/saveDraft`, { body: { input: { step: at, draft: body }, mutationId: mutation() } });
      dirty.current = false;
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'form.err.locked') setDone('sent');
    }
  }, [token, done]);
  // keep what was typed if the family switches app or closes the tab
  const latest = useRef({ step, draft });
  latest.current = { step, draft };
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden' && dirty.current && load === 'ready' && !done) void save(latest.current.step, latest.current.draft); };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [save, load, done]);

  if (load !== 'ready' || !data) {
    return (
      <Shell lang={lang} setLang={setLang} user={!!user} onClose={() => navigate('/enquiries')}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 28 }}>
          {load === 'loading' ? <span style={{ fontSize: 16, color: '#6A6967' }}>{t('common.loading')}</span> : (
            <>
              <div style={{ width: 72, height: 72, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A755B' }}><Icon name={load === 'missing' ? 'link_off' : 'cloud_off'} size={34} /></div>
              <h1 style={{ margin: 0, fontSize: 28, lineHeight: '36px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{load === 'missing' ? t('form.missingTitle') : t('err.network')}</h1>
              {load === 'missing' ? <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', maxWidth: 320 }}>{t('form.missingText')}</p> : null}
            </>
          )}
        </div>
      </Shell>
    );
  }

  const f = data.form;
  const isMember = f.target.type === 'member';
  const title = (d.title || 'Oma') as Title;
  const her = title === 'Oma' || title === 'Ibu';
  const first = (d.name || '').trim().split(/\s+/)[0] || '';
  const short = `${title} ${first}`.trim();
  const contactFirst = (d.contact?.name || '').trim().split(/\s+/)[0] || '';
  const o = t(her ? 'form.pronO_f' : 'form.pronO_m');
  const p = t(her ? 'form.pronP_f' : 'form.pronP_m');
  const valid = stepValid(draft, step, today);
  const errs = formErrors(draft, today);
  const bad = (k: string) => show && errs.some((x) => x.key === k);
  const H: [string, string][] = [
    [t('form.h0'), t('form.s0', { who: contactFirst || t('form.hello'), short: short || t('form.theMember') })],
    [t('form.h1'), t('form.s1', { p })], [t('form.h2'), t('form.s2')], [t('form.h3'), t('form.s3', { o })], [t('form.h4'), t('form.s4')], [t('form.h5'), t('form.s5')], [t('form.h6'), t('form.s6')],
  ];
  const stepName = [t('form.st0'), t('form.st1'), t('form.st2'), t('form.st3'), t('form.st4'), t('form.st5'), t('form.st6')];

  const go = (n: number) => {
    setShow(false);
    setErr('');
    setStep(n);
    void save(n, draft);
    toTop();
  };
  const next = async () => {
    if (!valid) { setShow(true); return; }
    if (step < STEPS - 1) { go(step + 1); return; }
    // send
    const all = formErrors(draft, today);
    if (all.length) { setShow(true); setStep(all[0].step); toTop(); return; }
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/api/form/${encodeURIComponent(token)}/submit`, { body: { input: { data: draft }, mutationId: mutation() } });
      dirty.current = false;
      setDone('sent');
      toTop();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'form.err.locked') setDone('sent');
        else {
          setErr(t(e.code, e.params));
          const at = Number(e.params.step);
          if (Number.isFinite(at)) { setStep(at); setShow(true); }
        }
      } else setErr(t('err.network'));
    } finally { setBusy(false); }
  };

  // ---------- pieces ----------
  const group = (lab: string, children: ReactNode, hint?: string, error?: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={label}>{lab}</span>
      {children}
      {hint ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{hint}</span> : null}
      {error ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{t('form.pickOne')}</span> : null}
    </div>
  );
  const chip = (text: ReactNode, sel: boolean, onClick: () => void, role: 'radio' | 'pressed' = 'pressed', pad = 16) => (
    <button key={String(text)} type="button" {...(role === 'radio' ? { role: 'radio', 'aria-checked': sel } : { 'aria-pressed': sel })} onClick={onClick}
      style={{ height: 44, padding: `0 ${pad}px`, borderRadius: 999, border: sel ? '1px solid #282828' : '1px solid #CAB8A2', background: sel ? '#282828' : '#FFFFFF', color: sel ? '#FFFFFF' : '#282828', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {sel ? <Icon name="check" size={18} /> : null}{text}
    </button>
  );
  const upTile = (on: boolean, toggle: () => void, tTitle: string, tSub: string, file: string, minH: number) => (
    <button type="button" onClick={toggle} style={{ minHeight: minH, borderRadius: 20, border: on ? '1px solid #CAB8A2' : '2px dashed #CAB8A2', background: on ? photoBg(2) : '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, cursor: 'pointer', color: '#282828', textAlign: 'center', fontFamily: 'Inter' }}>
      <Icon name={on ? 'check_circle' : 'add_a_photo'} size={34} color="#75624B" fill={1} />
      <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{on ? file : tTitle}</span>
      <span style={{ fontSize: FONT_BODY, lineHeight: 1.4 }}>{on ? t('form.uploadedTap') : tSub}</span>
    </button>
  );
  const yesNo = (v: boolean | undefined) => (v ? t('form.uploaded') : t('form.missing'));

  const meds = d.meds || [];
  const addMed = (name: string, dose: string, timing: MedTiming) => set({ meds: [...meds, { name, dose, timing }] });
  const addCustomMed = () => {
    const txt = medName.trim();
    if (!txt) return;
    const m = /^(.*?)\s+(\d.*)$/.exec(txt);
    addMed((m ? m[1] : txt).trim(), m ? m[2].trim() : '', 'asPrescribed');
    setMedName('');
  };
  const setMed = (i: number, patch: Partial<{ timing: MedTiming }>) => set({ meds: meds.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const drugs = d.drugs || [];
  const otherDrugs = drugs.filter((x) => x.startsWith('other:'));

  const stepBody = (
    <>
      {step === 0 ? (
        <>
          {group(t('form.title'), <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="radiogroup" aria-label={t('form.title')}>{TITLES.map((x) => chip(x, title === x, () => set({ title: x }), 'radio', 18))}</div>)}
          <Field lab={t('form.fullName')} error={bad('name') && t('err.invalid')}><input value={d.name || ''} onChange={(e) => set({ name: e.target.value })} autoComplete="off" style={input} /></Field>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={label}>{t('form.dob')}</span>
            <DateField ariaLabel={t('form.dob')} value={d.dob || ''} min="1890-01-01" max={today} startAt={`${+today.slice(0, 4) - 80}${today.slice(4)}`} onChange={(v) => set({ dob: v })} error={bad('dob') && t('form.dobErr')} />
          </div>
          <Field lab={t('form.address')}><input value={d.address || ''} onChange={(e) => set({ address: e.target.value })} placeholder={t('form.addressPh')} style={input} /></Field>
          <div style={{ height: 1, background: '#DBD7D6' }} />
          <Field lab={t('form.yourName')} error={bad('contactName') && t('err.invalid')}><input value={d.contact?.name || ''} onChange={(e) => set({ contact: { relation: 'daughter', phone: '', ...d.contact, name: e.target.value } })} autoComplete="name" style={input} /></Field>
          {group(t('form.youAreTheir'), <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="radiogroup" aria-label={t('form.relationship')}>{FORM_RELATIONS.map((r) => chip(t('enq.rel_' + r), (d.contact?.relation || 'daughter') === r, () => set({ contact: { name: '', phone: '', ...d.contact, relation: r as Relation } }), 'radio'))}</div>)}
          <Field lab={t('form.yourMobile')} error={bad('phone') && t('err.invalid')}><input value={d.contact?.phone || ''} onChange={(e) => set({ contact: { name: '', relation: 'daughter', ...d.contact, phone: e.target.value } })} inputMode="tel" autoComplete="tel" style={input} /></Field>
        </>
      ) : null}
      {step === 1 ? (
        <>
          {upTile(!!d.docs?.ktp, () => set({ docs: { ktp: !d.docs?.ktp, nannyKtp: !!d.docs?.nannyKtp, healthInfo: !!d.docs?.healthInfo } }), t('form.ktpTake'), t('form.ktpSub'), 'KTP_front.jpg', 200)}
          <div style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{t('form.ktpNote')}</div>
          <div style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{t('form.demoUpload')}</div>
        </>
      ) : null}
      {step === 2 ? (
        <>
          {group(t('form.nannyQ', { o }), <div style={{ display: 'flex', gap: 8 }} role="radiogroup" aria-label={t('form.nannyQ', { o })}>
            {([[t('common.yes'), true], [t('common.no'), false]] as [string, boolean][]).map(([l, v]) => {
              const sel = d.nanny === undefined ? false : v ? d.nanny !== null : d.nanny === null;
              return <button key={l} type="button" role="radio" aria-checked={sel} onClick={() => set({ nanny: v ? { name: d.nanny?.name || '' } : null })} style={{ flex: 1, height: 52, borderRadius: 999, border: sel ? '1px solid #282828' : '1px solid #CAB8A2', background: sel ? '#282828' : '#FFFFFF', color: sel ? '#FFFFFF' : '#282828', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{l}</button>;
            })}
          </div>, undefined, bad('nanny'))}
          {d.nanny ? (
            <>
              <Field lab={t('form.nannyName')} error={bad('nannyName') && t('err.invalid')}><input value={d.nanny.name} onChange={(e) => set({ nanny: { name: e.target.value } })} style={input} /></Field>
              {upTile(!!d.docs?.nannyKtp, () => set({ docs: { ktp: !!d.docs?.ktp, nannyKtp: !d.docs?.nannyKtp, healthInfo: !!d.docs?.healthInfo } }), t('form.nannyKtpTake'), t('form.nannyKtpSub'), 'KTP_nanny.jpg', 160)}
              <div style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{t('form.nannyNote')}</div>
            </>
          ) : null}
        </>
      ) : null}
      {step === 3 ? (
        <>
          {upTile(!!d.docs?.healthInfo, () => set({ docs: { ktp: !!d.docs?.ktp, nannyKtp: !!d.docs?.nannyKtp, healthInfo: !d.docs?.healthInfo } }), t('form.healthTake', { p }), t('form.healthSub'), 'health_summary.jpg', 160)}
          <Field lab={t('form.conditions')}><input value={cond} onChange={(e) => { dirty.current = true; setCond(e.target.value); }} placeholder={t('form.conditionsPh')} style={input} /></Field>
          {group(t('form.medicines'), (
            <>
              {meds.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 8px 12px 14px', borderRadius: 16, background: '#FFFFFF', border: '1px solid #DBD7D6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon name="medication" size={20} color="#75624B" />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 500, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{`${m.name} ${m.dose}`.trim()}</span>
                    <button type="button" aria-label={t('common.remove')} onClick={() => set({ meds: meds.filter((_, j) => j !== i) })} style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}><Icon name="close" size={20} /></button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label={t('form.when')}>
                    {TIMINGS.map((tm) => (
                      <button key={tm} type="button" role="radio" aria-checked={m.timing === tm} onClick={() => setMed(i, { timing: tm })}
                        style={{ height: 36, padding: '0 12px', borderRadius: 999, border: m.timing === tm ? '1px solid #75624B' : '1px solid #DBD7D6', background: m.timing === tm ? '#F4F0EE' : '#FFFFFF', color: '#282828', fontSize: FONT_BODY, fontWeight: m.timing === tm ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter', whiteSpace: 'nowrap' }}>{t('form.timing_' + tm)}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COMMON.filter((c) => !meds.some((m) => m.name === c[0])).map(([n, ds, tm]) => (
                  <button key={n} type="button" onClick={() => addMed(n, ds, tm)} style={{ height: 44, padding: '0 14px 0 10px', borderRadius: 999, border: '1px solid #CAB8A2', background: '#FFFFFF', color: '#282828', fontSize: FONT_BODY, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                    <Icon name="add" size={18} color="#75624B" />{n} {ds}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={medName} onChange={(e) => setMedName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomMed(); } }} placeholder={t('form.medOther')} aria-label={t('form.medOtherAria')} style={{ ...input, flex: 1 }} />
                <button type="button" onClick={addCustomMed} style={{ height: 52, padding: '0 18px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('common.add')}</button>
              </div>
            </>
          ))}
        </>
      ) : null}
      {step === 4 ? (
        <>
          {group(t('form.foodAllergies'), (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{FOODS.map((x) => chip(t('form.food_' + x), !!d.food?.includes(x), () => set({ food: d.food?.includes(x) ? d.food.filter((y) => y !== x) : [...(d.food || []), x] })))}</div>
              <input value={d.foodOther || ''} onChange={(e) => set({ foodOther: e.target.value })} placeholder={t('form.foodOther')} aria-label={t('form.foodOther')} style={input} />
            </>
          ), t('form.kitchenSees'))}
          {group(t('form.drugAllergies'), (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{DRUGS.map((x) => chip(t('form.drug_' + x), drugs.includes(x), () => set({ drugs: drugs.includes(x) ? drugs.filter((y) => y !== x) : [...drugs, x] })))}</div>
              {otherDrugs.map((x) => <div key={x} style={{ display: 'flex' }}>{chip(x.slice(6), true, () => set({ drugs: drugs.filter((y) => y !== x) }))}</div>)}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={drugOther} onChange={(e) => setDrugOther(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && drugOther.trim()) { e.preventDefault(); set({ drugs: [...drugs, `other:${drugOther.trim()}` as never] }); setDrugOther(''); } }} placeholder={t('form.drugOther')} aria-label={t('form.drugOther')} style={{ ...input, flex: 1 }} />
                <button type="button" onClick={() => { if (drugOther.trim()) { set({ drugs: [...drugs, `other:${drugOther.trim()}` as never] }); setDrugOther(''); } }} style={{ height: 52, padding: '0 18px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('common.add')}</button>
              </div>
            </>
          ), t('form.nurseOnly'))}
          {group(t('form.mobility'), <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="radiogroup" aria-label={t('form.mobility')}>
            {chip(t('form.mob_none'), d.mobility === null, () => set({ mobility: null }), 'radio')}
            {MOBILITIES.map((x) => chip(t('form.mob_' + x), d.mobility === x, () => set({ mobility: x }), 'radio'))}
          </div>, undefined, bad('mobility'))}
          {group(t('form.diet'), <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{DIETS.map((x) => chip(t('form.diet_' + x), !!d.diet?.includes(x), () => set({ diet: d.diet?.includes(x) ? d.diet.filter((y) => y !== x) : [...(d.diet || []), x] })))}</div>, t('form.dietHint'))}
        </>
      ) : null}
      {step === 5 ? (
        <>
          {([['data', t('form.consentData', { p }), t('form.consentDataSub', { o, p })], ['face', t('form.consentFace'), t('form.consentFaceSub', { o })]] as ['data' | 'face', string, string][]).map(([k, tt, sub]) => {
            const on = !!d.consent?.[k];
            return (
              <button key={k} type="button" role="switch" aria-checked={on} onClick={() => set({ consent: { data: !!d.consent?.data, face: !!d.consent?.face, [k]: !on } })}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 16, borderRadius: 20, border: k === 'data' && bad('consent') ? '2px solid #AF4B2F' : '1px solid #DBD7D6', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
                <span style={{ width: 44, height: 26, borderRadius: 999, background: on ? '#75624B' : '#6A6967', position: 'relative', flex: 'none', marginTop: 2 }}>
                  <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left .15s' }} />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{tt}</span>
                  <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{sub}</span>
                </span>
              </button>
            );
          })}
          {bad('consent') ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{t('form.err.consent')}</span> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={label}>{t('form.sigOf', { name: d.contact?.name || '' })}</span>
            <SignaturePad value={d.signature?.svgPath || ''} label={t('form.sigPad')} onChange={(path) => set({ signature: path ? { svgPath: path, at: '', by: '' } : null })} />
            {bad('signature') ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{t('form.err.signature')}</span> : null}
            <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{fdl(today)}</span>
          </div>
        </>
      ) : null}
      {step === 6 ? (
        <>
          {([
            [t('form.rvDetails'), 0, [[t('form.rvName'), `${title} ${d.name || ''}`], [t('form.dob'), d.dob || '—'], [t('form.address'), d.address || '—'], [t('form.rvContact'), `${d.contact?.name || ''} · ${t('enq.rel_' + (d.contact?.relation || 'other')).toLowerCase()}`], [t('form.rvMobile'), d.contact?.phone ? fmtPhone(d.contact.phone) : '—']]],
            [t('form.rvDocs'), 1, [['KTP', yesNo(d.docs?.ktp)], [t('form.rvNannyKtp'), d.nanny ? yesNo(d.docs?.nannyKtp) : t('form.noNanny')], [t('form.rvHealthPhoto'), yesNo(d.docs?.healthInfo)]]],
            [t('form.rvHealth'), 3, [[t('form.conditions'), conds.join(', ') || '—'], [t('form.medicines'), meds.map((m) => m.name).join(', ') || t('common.none')]]],
            [t('form.rvAllergies'), 4, [[t('form.rvFood'), [...(d.food || []).map((x) => t('form.food_' + x)), ...(d.foodOther ? [d.foodOther] : [])].join(', ') || t('common.none')], [t('form.rvDrugs'), drugs.map((x) => (x.startsWith('other:') ? x.slice(6) : t('form.drug_' + x))).join(', ') || t('common.none')], [t('form.mobility'), d.mobility ? t('form.mob_' + d.mobility) : t('form.mob_none')], [t('form.diet'), (d.diet || []).map((x) => t('form.diet_' + x)).join(', ') || t('common.none')]]],
            [t('form.rvConsent'), 5, [[t('form.rvUse'), d.consent?.data ? t('form.agreed') : t('form.notYet')], [t('form.rvFace'), d.consent?.face ? t('form.agreed') : t('form.faceNo')], [t('form.rvSignature'), d.signature?.svgPath ? t('form.signed') : t('form.missing')]]],
          ] as [string, number, [string, string][]][]).map(([lab, n, rows]) => (
            <div key={lab} style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={label}>{lab}</span>
                <button type="button" onClick={() => go(n)} aria-label={`${t('common.edit')}: ${lab}`} style={{ height: 44, padding: '0 12px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t('common.edit')}</button>
              </div>
              {rows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid #EFECEA', fontSize: 16, lineHeight: '22px' }}>
                  <span style={{ color: '#6A6967', flex: 'none' }}>{k}</span>
                  <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
          {err ? <div role="alert" style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 16, background: '#F7E4DD', color: '#AF4B2F', fontSize: 16, lineHeight: '22px' }}><Icon name="error" size={20} fill={1} /><span>{err}</span></div> : null}
        </>
      ) : null}
    </>
  );

  // ---------- Done ----------
  if (done) {
    const name = contactFirst || t('form.hello');
    return (
      <Shell lang={lang} setLang={setLang} user={!!user} onClose={() => navigate('/enquiries')}>
        <div ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 20px 28px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: '24px 8px' }}>
            <div style={{ width: 80, height: 80, borderRadius: 999, background: '#E6EFE8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check_circle" size={40} color="#3D6B4F" fill={1} /></div>
            <h1 data-testid="form-done" style={{ margin: 0, fontSize: 28, lineHeight: '36px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{t('form.doneTitle', { name })}</h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', maxWidth: 320, textWrap: 'pretty' } as React.CSSProperties}>
              {done === 'approved' ? t('form.doneApproved') : isMember ? t('form.doneMember', { short: short || t('form.theMember') }) : t('form.doneText', { short: short || t('form.theMember') })}
            </p>
            {user ? <button type="button" onClick={() => navigate('/enquiries')} style={{ marginTop: 8, height: 52, padding: '0 22px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('form.backStaff')}</button> : null}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell lang={lang} setLang={setLang} user={!!user} onClose={() => navigate('/enquiries')}
      progress={<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...label }}><span>{stepName[step]}</span><span style={{ color: '#6A6967' }}>{t('form.stepOf', { n: step + 1, total: STEPS })}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS},minmax(0,1fr))`, gap: 4 }} role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} aria-label={t('form.stepOf', { n: step + 1, total: STEPS })}>
          {Array.from({ length: STEPS }, (_, i) => <span key={i} style={{ height: 6, borderRadius: 999, background: i <= step ? '#75624B' : '#E8E1D8' }} />)}
        </div>
      </div>}
      footer={<div style={{ flex: 'none', display: 'flex', gap: 10, padding: '12px 20px 28px', borderTop: '1px solid #E8E1D8', background: '#FFFFFF' }}>
        {step > 0 ? <button type="button" onClick={() => go(step - 1)} style={{ height: 56, padding: '0 22px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('common.back')}</button> : null}
        <button type="button" data-testid="form-next" onClick={() => void next()} aria-disabled={!valid || busy || undefined} style={{ flex: 1, height: 56, borderRadius: 999, border: 'none', background: valid ? '#75624B' : '#E8E1D8', color: valid ? '#FFFFFF' : '#6A6967', fontSize: 17, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{step === STEPS - 1 ? t('form.send') : t('common.continue')}</button>
      </div>}>
      <div ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {f.status === 'returned' && f.returnNote ? (
          <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 16, background: '#F6ECD6', color: '#7A5510', fontSize: 16, lineHeight: '22px' }}>
            <Icon name="undo" size={20} fill={1} /><span>{t('form.returnedNote', { note: f.returnNote })}</span>
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: '36px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{H[step][0]}</h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', textWrap: 'pretty' } as React.CSSProperties}>{H[step][1]}</p>
        </div>
        {stepBody}
        {saved ? <span role="status" style={{ fontSize: FONT_BODY, color: '#3D6B4F', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="cloud_done" size={18} fill={1} />{t('form.draftSaved')}</span> : null}
      </div>
    </Shell>
  );
}

function Field({ lab, children, error }: { lab: ReactNode; children: ReactNode; error?: string | false }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={label}>{lab}</span>
      {children}
      {error ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{error}</span> : null}
    </label>
  );
}

/** Page frame: logo and language toggle on top, optional progress, scrolling body, footer. Centred column on larger screens. */
function Shell({ lang, setLang, user, onClose, progress, footer, children }: { lang: string; setLang: (l: 'en' | 'id') => void; user: boolean; onClose: () => void; progress?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  const t = useT();
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#F6F5F5', color: '#282828', display: 'flex', justifyContent: 'center', '--cp-body': '16px', '--cp-small': '14px' } as React.CSSProperties}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#F6F5F5', borderLeft: '1px solid #EFECEA', borderRight: '1px solid #EFECEA' }}>
        <header style={{ flex: 'none', padding: '8px 20px 14px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid #E8E1D8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}><Logo height={38} /></div>
            <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: '#E8E1D8', flex: 'none' }} role="group" aria-label={t('shell.language')}>
              {(['en', 'id'] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} style={{ height: 44, minWidth: 52, padding: '0 12px', borderRadius: 999, border: 'none', background: lang === l ? '#FFFFFF' : 'transparent', color: '#282828', fontSize: FONT_BODY, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' }}>{l.toUpperCase()}</button>
              ))}
            </div>
            {user ? <IconButton icon="close" label={t('form.closeForm')} onClick={onClose} /> : null}
          </div>
          {progress}
        </header>
        {children}
        {footer}
      </div>
    </div>
  );
}
