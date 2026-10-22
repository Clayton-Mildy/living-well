// KC round 10: the public registration page (/form/:token). A family opens the link the front desk sent on WhatsApp, no sign-in, on their phone.
// It is a PRE-FILL for the paper process, not a replacement: the same fields staff type in when joining (who is joining, the family contact, the plan they
// lean to, the application form's personal details, health and allergies, the care questions), reusing the member form's own field groups so the
// answers map 1:1 onto Join. Sending it stores the answers on the lead; the front desk prints the application form from them for signing at the club.
// KC round 13: it is five steps (Who is joining, Family contact, Health, Plan, Review and send) like the staff registration, with Back / Continue, a check
// per step and a draft: kept on this device as the family types (cp.form.<token>) and on the lead through the link (on Continue and Save for later), so
// reopening the link on any phone continues where they stopped; the newer of the two wins (onlineForm.pickDraft). No Paper step: they sign at the club.
// English or Indonesian (the phone's language, with a switch). Language lives only in this tab: the session store is not persisted from here.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { fmtPhone, rp, type KtpKind, type Lang, type OnlineRegistration, type Plan } from '@cp/shared';
import { FORM_STEPS } from '@cp/shared/rules/enquiries';
import { MAX_PDF_BYTES, MAX_UPLOAD_BYTES, downscaleImage, isPdfFile, toBase64 } from '../../lib/media';
import { ApiError } from '../../lib/api';
import type { PaperFile } from '../members/PaperForm';
import { Button, ChipGroup, DateField, Eyebrow, Group, Icon, Logo, Note } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { useSession } from '../../store/session';
import { foodLabel, mobLabel, relLabel } from '../members/lib';
import { Rows, StepBar } from '../members/register/parts';
import { AllergyFields, CarerFields, DementiaFields, HealthFields, IdFields, PeSection, RegCareFields, RegPersonalFields, RelationChips, TextField, TitleName, type RegDraft } from '../members/dialogs/forms';
import { ONLINE_STEPS, STEP_NAME_KEY, blankOnline, clearDevice, firstOpenOnlineStep, fromOnline, loadDevice, onlineIssues, pickDraft, resumeStep, saveDevice, toOnline, type FDraft, type OnlineStep } from './onlineForm';

interface Info { state: 'sent' | 'opened' | 'inProgress' | 'submitted' | 'expired'; club: string; today: string; draft: OnlineRegistration; step: number | null; savedAt: string | null; draftRev: number; submittedAt: string | null; expiresAt: string; prices: { flex: number; gold: number; extra: number; flexQuota: number } }
type View = { kind: 'loading' } | { kind: 'ready'; info: Info } | { kind: 'bad' } | { kind: 'network' } | { kind: 'expired' } | { kind: 'done'; date: string } | { kind: 'thanks'; name: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
/** This phone's answers and the lead's, when both changed since they last met: the family picks one. */
interface Choice { mine: { d: FDraft; step: number; lang?: Lang }; server: { d: FDraft; step: number | null; rev: number; lang: Lang } }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const initialLang = (): Lang => (typeof navigator !== 'undefined' && /^(id|in)\b/i.test(navigator.language || '') ? 'id' : 'en');
/** The family's own upload route: the form token is the key (no sign-in). Images are shrunk like any photo; a PDF goes as it is. */
const publicUploader = (token: string) => async (blob: Blob, name: string): Promise<PaperFile> => {
  const pdf = isPdfFile(blob, name);
  if (pdf && blob.size > MAX_PDF_BYTES) throw new ApiError(413, 'common.docTooBig');
  const file = pdf ? blob : await downscaleImage(blob);
  if (!pdf && file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'common.mediaTooBig');
  const res = await fetch(`/api/public/form/${encodeURIComponent(token)}/media`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mime: pdf ? 'application/pdf' : 'image/jpeg', data: await toBase64(file) }) });
  const data = (await res.json().catch(() => ({}))) as { id?: string; code?: string };
  if (!res.ok || !data.id) throw new ApiError(res.status, data.code || 'common.mediaFailed');
  return { mediaId: data.id, fileName: pdf ? (name || 'document.pdf') : `${(name || 'ktp').replace(/\.[A-Za-z0-9]{1,5}$/, '')}.jpg` };
};

/** The route element: sets this tab's language (without saving it), then shows the page. */
export function PublicForm() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [synced, setSynced] = useState(false);
  useLayoutEffect(() => { useSession.setState({ lang }); setSynced(true); }, [lang]);
  if (!synced) return null;
  return <FormInner lang={lang} setLang={setLang} />;
}

function FormInner({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = useT();
  const { fds, fdy } = useFmt();
  const { isPhone } = useDevice();
  const { token = '' } = useParams();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [d, setD] = useState<FDraft>(() => fromOnline(blankOnline()));
  const [stepI, setStepI] = useState(0);
  const [tried, setTried] = useState<ReadonlySet<OnlineStep>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [resumed, setResumed] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const step = ONLINE_STEPS[stepI];
  const last = ONLINE_STEPS.length - 1;
  const top = useRef<HTMLDivElement>(null);

  // the draft: `touched` once the family typed or moved (an untouched, lead-filled form is never written to the device), `dirty` = typed since the
  // lead last had it, `base` = the lead's save counter this copy was last in step with
  const live = useRef({ d, stepI, lang });
  live.current = { d, stepI, lang };
  const ready = useRef(false);
  const touched = useRef(false);
  const dirty = useRef(false);
  const finished = useRef(false);
  const base = useRef<number | null>(null);
  const submitting = useRef(false);
  const feedback = useRef(false);
  const pushAfter = useRef(false);
  const flight = useRef(false);
  const again = useRef(false);
  const lastPush = useRef(0);
  const set = useCallback((p: Partial<FDraft>) => { touched.current = true; dirty.current = true; setSaveState('idle'); setD((x) => ({ ...x, ...p })); }, []);
  const setReg = (p: Partial<RegDraft>) => set({ reg: { ...d.reg, ...p } });
  const setKtp = (kind: KtpKind, f: PaperFile | null) => set({ ktp: { ...d.ktp, [kind]: f ?? undefined } });
  const uploader = publicUploader(token);
  const writeDevice = useCallback(() => {
    if (!ready.current || finished.current || !touched.current) return;
    saveDevice(token, { d: live.current.d, step: live.current.stepI + 1, base: base.current, dirty: dirty.current, lang: live.current.lang });
  }, [token]);
  useEffect(() => { writeDevice(); }, [d, stepI, writeDevice]); // on every change

  /**
   * The draft to the lead through the link. One at a time (a change made while it flies goes in a second round, and a Save for later tapped meanwhile
   * still ends with "Saved."); a tap within a second of the last is ignored. The save names the counter this page last saw (`expect`): if another phone
   * saved since, the lead answers 409 and the family chooses (nothing is overwritten). A 429 waits and tries again.
   */
  const pushDraft = useCallback(async (explicit: boolean, stepNo?: number) => {
    if (!ready.current || finished.current || submitting.current) return;
    if (!flight.current && explicit && Date.now() - lastPush.current < 1000) return;
    if (explicit) { feedback.current = true; setSaveState('saving'); }
    if (flight.current) { again.current = true; return; }
    flight.current = true; lastPush.current = Date.now();
    let ok = false;
    let first = stepNo;
    let waits = 0;
    try {
      for (;;) {
        again.current = false;
        const sent = live.current;
        const at = first ?? sent.stepI + 1;
        first = undefined;
        const res = await fetch(`/api/public/form/${encodeURIComponent(token)}/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ step: at, expect: base.current, draft: toOnline(sent.d, sent.lang) }) });
        if (finished.current || submitting.current) return; // an answer that arrives after Send is none of our business
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { draftRev?: number };
          if (typeof data.draftRev === 'number' && data.draftRev > 0) base.current = data.draftRev;
          dirty.current = live.current.d !== sent.d; // typed while it flew: still unsaved
          ok = true;
          writeDevice();
          if (again.current) continue;
          break;
        }
        const data = (await res.json().catch(() => ({}))) as { code?: string; draft?: OnlineRegistration; step?: number | null; draftRev?: number };
        if (res.status === 429 && waits++ < 3) { await sleep(2100); if (finished.current || submitting.current) return; continue; }
        if (res.status === 409 && data.draft) {
          ready.current = false; feedback.current = false; setSaveState('idle');
          setChoice({ mine: { d: live.current.d, step: live.current.stepI + 1, lang: live.current.lang }, server: { d: fromOnline(data.draft), step: data.step ?? null, rev: data.draftRev ?? 0, lang: data.draft.lang } });
          return;
        }
        if (data.code === 'enq.err.formExpired') { setView({ kind: 'expired' }); return; }
        if (data.code === 'enq.err.formDone') { setView({ kind: 'done', date: '' }); return; }
        break;
      }
    } catch { ok = false; } finally { flight.current = false; }
    if (feedback.current) { feedback.current = false; setSaveState(ok ? 'saved' : 'failed'); }
  }, [token, writeDevice]);

  const load = useCallback(async () => {
    setView({ kind: 'loading' });
    try {
      const res = await fetch(`/api/public/form/${encodeURIComponent(token)}`);
      if (res.status === 404) { setView({ kind: 'bad' }); return; }
      if (!res.ok) { setView({ kind: 'network' }); return; }
      const info = (await res.json()) as Info;
      if (info.state === 'submitted') { clearDevice(token); setView({ kind: 'done', date: info.submittedAt ? info.submittedAt.slice(0, 10) : info.today }); return; }
      if (info.state === 'expired') { setView({ kind: 'expired' }); return; }
      const device = loadDevice(token);
      const rev = info.draftRev ?? 0;
      const pick = pickDraft(device, { rev, step: info.step, draft: info.draft });
      const at = resumeStep(pick.d, pick.step);
      base.current = pick.from === 'device' || pick.from === 'conflict' ? device!.base : rev || null;
      dirty.current = pick.from === 'device' || pick.from === 'conflict' ? device!.dirty : false;
      touched.current = pick.from === 'device';
      setD(pick.d); setStepI(at); setTried(new Set()); setResumed(pick.from !== 'lead' && pick.from !== 'conflict' && at > 0);
      if (pick.from === 'conflict') setChoice({ mine: { d: pick.d, step: pick.step, lang: pick.lang }, server: pick.server }); // both changed: the family chooses first, nothing is written until then
      else { setChoice(null); ready.current = true; if (pick.from !== 'lead' && pick.lang) setLang(pick.lang); } // a saved draft brings back the language it was filled in
      setView({ kind: 'ready', info });
      if (info.state === 'sent') void fetch(`/api/public/form/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'open' }) }).catch(() => undefined);
    } catch { setView({ kind: 'network' }); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const was = document.title;
    document.title = `${t('enq.pf_tab')} · CitraPremier`;
    return () => { document.title = was; };
  }, [t]);
  const adoptSaved = () => {
    if (!choice) return;
    const sv = choice.server;
    clearDevice(token);
    base.current = sv.rev; dirty.current = false; touched.current = false;
    setD(sv.d); setStepI(resumeStep(sv.d, sv.step)); setTried(new Set()); setResumed(true); setChoice(null); ready.current = true; setLang(sv.lang);
  };
  const keepMine = () => {
    if (!choice) return;
    const m = choice.mine;
    base.current = choice.server.rev; dirty.current = true; touched.current = true; // sent against the counter the lead is at now
    setD(m.d); setStepI(resumeStep(m.d, m.step)); setTried(new Set()); setChoice(null); ready.current = true; pushAfter.current = true;
    if (m.lang) setLang(m.lang);
  };
  useEffect(() => { if (pushAfter.current && ready.current) { pushAfter.current = false; void pushDraft(false); } }, [d, stepI, choice, pushDraft]);
  // a new step starts at the top of the page
  useEffect(() => { top.current?.closest<HTMLElement>('[data-testid="public-form"]')?.scrollTo?.({ top: 0 }); }, [stepI]);

  const issues = onlineIssues(step, d);
  const isTried = tried.has(step);
  const errFor = (...fields: string[]) => {
    if (!isTried) return '';
    const i = issues.find((x) => fields.includes(x.field));
    return i ? t(i.code, i.params) : '';
  };
  const markTried = () => setTried((x) => (x.has(step) ? x : new Set(x).add(step)));
  const goTo = (i: number) => { touched.current = true; setResumed(false); setSaveState('idle'); setStepI(i); if (i === last) setFromReview(false); };
  /** came here with Edit on the review: Continue goes straight back to it once everything is complete */
  const [fromReview, setFromReview] = useState(false);
  const next = () => {
    markTried();
    if (issues.length) return;
    const to = fromReview && firstOpenOnlineStep(d) === last ? last : Math.min(stepI + 1, last);
    goTo(to);
    void pushDraft(false, to + 1); // on Continue the lead gets the draft, with the step the family is going to
  };
  const submit = async () => {
    const open = firstOpenOnlineStep(d);
    if (open < last) { setTried((x) => new Set(x).add(ONLINE_STEPS[open])); goTo(open); return; }
    if (busy) return;
    setBusy(true); setErr(''); submitting.current = true;
    try {
      const res = await fetch(`/api/public/form/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'submit', draft: toOnline(d, lang) }) });
      if (res.ok) { finished.current = true; clearDevice(token); setView({ kind: 'thanks', name: d.cName.trim().split(' ')[0] }); window.scrollTo?.({ top: 0 }); return; }
      const data = (await res.json().catch(() => ({}))) as { code?: string; params?: Record<string, string | number> };
      if (data.code === 'enq.err.formExpired') { setView({ kind: 'expired' }); return; }
      if (data.code === 'enq.err.formDone') { finished.current = true; clearDevice(token); setView({ kind: 'done', date: '' }); return; }
      setErr(data.code ? t(data.code, data.params) : t('err.invalid'));
    } catch { setErr(t('mgmt.rtNetText')); }
    submitting.current = false;
    setBusy(false);
  };

  const sec = (label: ReactNode, children: ReactNode) => <PeSection label={label}>{children}</PeSection>;
  const stepBody = (info: Info): ReactNode => {
    const { prices } = info;
    if (step === 'who') {
      return (
        <>
          {sec(t('enq.pf_who'), <>
            <TitleName d={d} set={set} t={t} errors={{ title: errFor('title'), name: errFor('name') }} />
            <DateField label={t('profile.f.dob')} value={d.dob} onChange={(v) => set({ dob: v })} max={info.today} startAt={`${+info.today.slice(0, 4) - 80}${info.today.slice(4)}`} />
            <TextField label={t('profile.f.address')} value={d.address} onChange={(v) => set({ address: v })} placeholder={t('profile.addressPh')} name="address" />
          </>)}
          {sec(t('profile.sec.regPersonal'), <RegPersonalFields d={d.reg} set={setReg} t={t} err={errFor} />)}
        </>
      );
    }
    if (step === 'family') {
      return (
        <>
          {sec(t('enq.pf_contact'), <>
            <TextField label={t('enq.fContactName')} value={d.cName} onChange={(v) => set({ cName: v })} error={errFor('contact')} name="contact" />
            <RelationChips value={d.rel} onChange={(v) => set({ rel: v })} t={t} />
            <TextField label={t('common.phone')} value={d.phone} onChange={(v) => set({ phone: v })} inputMode="tel" placeholder="+62" error={errFor('phone')} name="phone" />
          </>)}
          {sec(t('profile.sec.nanny'), <CarerFields d={d} set={set} t={t} tried={isTried} ktp={d.ktp} setKtp={setKtp} uploader={uploader} />)}
          {sec(t('profile.f.idsCustomer'), <IdFields d={d.reg} set={setReg} t={t} err={errFor} label={t('profile.f.idsReceived')} ktp={d.ktp} setKtp={setKtp} uploader={uploader} />)}
        </>
      );
    }
    if (step === 'health') {
      return (
        <>
          {sec(t('profile.sec.health'), <>
            <HealthFields d={d} set={set} t={t} instead={<DementiaFields d={d.reg} set={setReg} t={t} />} />
            <AllergyFields d={d} set={set} t={t} />
          </>)}
          {sec(t('profile.sec.regCare'), <RegCareFields d={d.reg} set={setReg} t={t} err={errFor} dementia={false} ids={false} />)}
        </>
      );
    }
    if (step === 'plan') {
      return sec(t('enq.pf_plan'), <>
        <ChipGroup label={t('enq.plan')} value={d.plan || 'unsure'} onChange={(v) => set({ plan: v === 'unsure' ? '' : (v as Plan) })}
          options={[{ value: 'flex', label: `${t('mgmt.plan_flex')} · ${rp(prices.flex)}` }, { value: 'gold', label: `${t('mgmt.plan_gold')} · ${rp(prices.gold)}` }, { value: 'unsure', label: t('enq.pf_planUnsure') }]} />
        <div style={{ fontSize: 14, lineHeight: '21px', color: '#5E5852' }}>{d.plan === 'gold' ? t('profile.planNoteGold') : d.plan === 'flex' ? t('profile.planNoteFlex', { q: prices.flexQuota, p: rp(prices.extra) }) : null}</div>
      </>);
    }
    // review: what was typed, one group per step with an Edit link back to it
    const none = t('enq.pf_none');
    const allergies = [...d.food.map((x) => foodLabel(t, x)), d.foodOther.trim(), ...d.drug.map((x) => t('profile.drug.' + x)), d.drugOther.trim()].filter(Boolean);
    const rows: Record<Exclude<OnlineStep, 'review'>, [ReactNode, ReactNode][]> = {
      who: [[t('common.name'), `${d.title} ${d.name.trim()}`], [t('profile.f.called'), d.reg.nickname.trim() || none], [t('profile.f.dob'), d.dob ? fdy(d.dob) : none], [t('profile.f.address'), d.address.trim() || none]],
      family: [[t('common.name'), d.cName.trim() || none], [t('profile.f.relation'), relLabel(t, d.rel)], [t('common.phone'), d.phone.trim() ? (d.phone.replace(/\D/g, '').length >= 8 ? fmtPhone(d.phone) : d.phone) : none], [t('profile.sec.nanny'), d.nanny ? d.nannyName.trim() || none : none]],
      health: [[t('profile.f.conditions'), d.conditions.join(', ') || none], [t('profile.f.mobility'), mobLabel(t, d.mobility === 'none' ? null : d.mobility)], [t('profile.sec.allergies'), allergies.join(', ') || none], [t('profile.q.dementia'), d.reg.dementia === null ? none : t(d.reg.dementia ? 'common.yes' : 'common.no')]],
      plan: [[t('enq.plan'), d.plan ? `${t('mgmt.plan_' + d.plan)} · ${rp(prices[d.plan])}` : t('enq.pf_planUnsure')]],
    };
    const edit = (k: OnlineStep) => (
      <button type="button" onClick={() => { goTo(ONLINE_STEPS.indexOf(k)); setFromReview(true); }} style={{ border: 'none', background: 'transparent', padding: 0, minHeight: 32, color: 'var(--accent, #75624B)', fontWeight: 500, fontSize: 14, cursor: 'pointer', fontFamily: 'Inter' }}>{t('reg.edit')}</button>
    );
    return (
      <>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#5E5852' }}>{t('enq.pf_reviewIntro')}</p>
        {ONLINE_STEPS.filter((k): k is Exclude<OnlineStep, 'review'> => k !== 'review').map((k) => (
          <div key={k} data-review-group={k}><Group title={t(STEP_NAME_KEY[k])} meta={edit(k)} gap={0} pad="6px 16px"><Rows rows={rows[k]} /></Group></div>
        ))}
        <Note icon="draw">{t('enq.pf_paperNote')}</Note>
        <span style={{ fontSize: 13, lineHeight: '18px', color: '#8A8078', textAlign: 'center' }}>{t('enq.pf_privacy')}</span>
      </>
    );
  };

  const body = ((): ReactNode => {
    if (view.kind === 'loading') return <Loading />;
    if (view.kind === 'bad') return <Message icon="link_off" title={t('enq.pf_badTitle')} text={t('enq.pf_badText')} />;
    if (view.kind === 'expired') return <Message icon="lock_clock" title={t('enq.pf_expiredTitle')} text={t('enq.pf_expiredText')} />;
    if (view.kind === 'network') return <Message icon="cloud_off" title={t('mgmt.rtNetTitle')} text={t('mgmt.rtNetText')} action={<Button size={48} onClick={() => void load()}>{t('common.retry')}</Button>} />;
    if (view.kind === 'done') return <Message icon="task_alt" tone="sage" title={t('enq.pf_doneTitle')} text={view.date ? t('enq.pf_doneText', { date: fds(view.date) }) : t('enq.pf_doneText', { date: '' })} />;
    if (view.kind === 'thanks') return <Message icon="favorite" tone="sage" title={t('enq.pf_thanksTitle', { name: view.name })} text={t('enq.pf_thanksText')} />;
    if (choice) {
      return (
        <div data-testid="form-conflict" role="alertdialog" aria-label={t('enq.pf_conflictTitle')} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 16px', borderRadius: 20, background: 'var(--fill, #F4F4F5)' }}>
          <Icon name="devices" size={32} weight={300} color="#75624B" />
          <span style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.25, color: '#24201C' }}>{t('enq.pf_conflictTitle')}</span>
          <span style={{ fontSize: 15, lineHeight: 1.5, color: '#5E5852' }}>{t('enq.pf_conflictText')}</span>
          <Button size={48} full onClick={adoptSaved}>{t('enq.pf_useSaved')}</Button>
          <Button size={48} full variant="secondary" onClick={keepMine}>{t('enq.pf_keepMine')}</Button>
        </div>
      );
    }
    const stepOf = t('reg.stepOf', { n: stepI + 1, total: FORM_STEPS, step: t(STEP_NAME_KEY[step]) });
    const isLast = stepI === last;
    return (
      <>
        <div ref={top} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: 'var(--eyebrow, #6E5A43)' }}>{t('enq.pf_eyebrow')} · {view.info.club}</span>
          <h1 className="cp-serif" style={{ margin: 0, fontSize: isPhone ? 28 : 32, lineHeight: 1.15, fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C', overflowWrap: 'anywhere' }}>{d.title.trim() ? `${d.title} ${d.name || '…'}` : d.name || '…'}</h1>
          {stepI === 0 ? <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#5E5852' }}>{t('enq.pf_intro')}</p> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>{stepOf}</Eyebrow>
          <StepBar n={stepI + 1} total={FORM_STEPS} label={stepOf} />
        </div>
        {resumed ? <Note icon="history">{t('enq.pf_resumed')}</Note> : null}
        <div data-form-step={step} style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
          {stepBody(view.info)}
        </div>
        {isTried && issues.length ? <Note tone="rust" icon="error"><span role="alert">{t('err.invalid')}</span></Note> : null}
        {err ? <Note tone="rust" icon="error">{err}</Note> : null}
        <div data-testid="public-form-footer" style={{ position: 'sticky', bottom: 0, zIndex: 2, margin: '0 -16px', padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', background: '#FFFFFF', boxShadow: '0 -1px 0 var(--track, #E8E8EB)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {stepI ? <Button variant="secondary" size={48} onClick={() => goTo(stepI - 1)} style={{ flex: '1 1 0' }}>{t('reg.back')}</Button> : null}
            {isLast
              ? <Button size={48} icon="send" disabled={busy} onClick={() => void submit()} style={{ flex: '2 1 0' }}>{busy ? t('enq.pf_sending') : t('enq.pf_submit')}</Button>
              : <Button size={48} iconRight="chevron_right" onClick={next} style={{ flex: '2 1 0' }}>{fromReview && firstOpenOnlineStep(d) === last ? t('reg.review') : t('enq.pf_continue')}</Button>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 36 }}>
            <Button variant="quiet" size={44} disabled={saveState === 'saving'} onClick={() => void pushDraft(true)} style={{ fontSize: 14, minHeight: 44 }}>{saveState === 'saving' ? t('enq.pf_saving') : t('enq.pf_saveLater')}</Button>
          </div>
          {saveState === 'saved' || saveState === 'failed' ? <span role="status" style={{ fontSize: 13, lineHeight: '18px', textAlign: 'center', color: saveState === 'saved' ? '#3D6B4F' : '#9A3D24' }}>{t(saveState === 'saved' ? 'enq.pf_saved' : 'enq.pf_saveFailed')}</span> : null}
        </div>
      </>
    );
  })();

  return (
    <div data-testid="public-form" style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#FFFFFF', ...({ '--cp-body': isPhone ? '16px' : '0px', '--cp-small': isPhone ? '14px' : '0px' } as CSSProperties) }}>
      {/* the family's phone: true size (no UI zoom) so every tap target is 44 px or more */}
      <style>{'html { zoom: 1 !important; } [data-testid="public-form"] .cp-chip { min-height: 44px; }'}</style>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: isPhone ? '14px 16px 0' : '28px 20px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Logo height={isPhone ? 40 : 48} />
          <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 9, background: 'var(--track, #E8E8EB)', flex: 'none' }} role="group" aria-label={t('shell.language')}>
            {(['en', 'id'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} style={{ height: 44, minWidth: 48, padding: '0 12px', borderRadius: 9, border: 'none', background: lang === l ? '#FFFFFF' : 'transparent', boxShadow: lang === l ? '0 1px 3px rgba(40,30,20,.14)' : 'none', color: '#24201C', fontSize: 14, fontWeight: lang === l ? 600 : 500, cursor: 'pointer', fontFamily: 'Inter' }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        {body}
        <div style={{ height: view.kind === 'ready' ? 0 : isPhone ? 40 : 56 }} />
      </div>
    </div>
  );
}

function Loading() {
  const t = useT();
  return <div role="status" style={{ padding: '48px 0', textAlign: 'center', color: '#8A8078', fontSize: 15 }}>{t('common.loading')}</div>;
}
function Message({ icon, title, text, action, tone }: { icon: string; title: string; text: string; action?: ReactNode; tone?: 'sage' }) {
  return (
    <div data-testid="public-form-message" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 16px', textAlign: 'center', borderRadius: 20, background: tone === 'sage' ? '#E3EFE6' : 'var(--fill, #F4F4F5)' }}>
      <Icon name={icon} size={40} weight={300} color={tone === 'sage' ? '#3D6B4F' : '#75624B'} />
      <span style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.25, color: '#24201C' }}>{title}</span>
      <span style={{ fontSize: 15, lineHeight: 1.5, color: '#5E5852', maxWidth: 420 }}>{text}</span>
      {action}
    </div>
  );
}
