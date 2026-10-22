// KC round 12 ("the dialog is too long, and the scan blocks the demo"): Join a lead and Add member are one six-step flow — Person, Family,
// Health, Plan, Form, Review. Next stays off until the step is complete (tapping it shows what is missing). Phone: a full screen with a thin
// progress bar; tablet and laptop: a dialog with the steps on a rail. What is typed is kept on this device until it is sent.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Plan } from '@cp/shared';
import { seniorName } from '@cp/shared/rules/enquiries';
import { Button, Dialog, Eyebrow, FONT_SMALL, Note, PhoneScreen, RailDot } from '../../../components/ui';
import { useDevice } from '../../../hooks/useDevice';
import { useAct } from '../../../lib/act';
import { useNow } from '../../../lib/clock';
import { useFmt, useT } from '../../../lib/i18n';
import { useMe } from '../../../lib/me';
import { useClub } from '../../../store/replica';
import { PillBtn } from '../../mgmt/common';
import { DialogBody } from '../dialogs/forms';
import { clearDraft, loadDraft, saveDraft } from './draft';
import { FamilyStep } from './FamilyStep';
import { HealthStep } from './HealthStep';
import { StepBar, joinLabel, type StepProps } from './parts';
import { PaperStep } from './PaperStep';
import { PersonStep } from './PersonStep';
import { PlanStep } from './PlanStep';
import { ReviewStep } from './ReviewStep';
import { REG_STEPS, STEP_ICON, firstOpenStep, initialState, stepIssues, type RegMode, type RegState, type RegStep } from './steps';
import { seniorChanged, toConvertInput, toCreateInput } from './submit';

export type { RegMode, RegStep, RegState } from './steps';

export function RegistrationFlow({ mode: startMode, onDone }: { mode: RegMode; onDone: (memberId?: string) => void }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const navigate = useNavigate();
  const { role } = useMe();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const [mode, setMode] = useState<RegMode>(startMode);
  const [st, setSt] = useState<RegState>(() => initialState(s, startMode, today));
  const [stepI, setStepI] = useState(0);
  const [tried, setTried] = useState<ReadonlySet<RegStep>>(new Set());
  const [pending, setPending] = useState<RegState | null>(() => loadDraft(startMode));
  const [busy, setBusy] = useState(false);
  const step = REG_STEPS[stepI];
  const last = REG_STEPS.length - 1;
  const top = useRef<HTMLDivElement>(null);

  // the device draft: saved 300 ms after the last change, flushed when the flow closes, never written again once sent
  const dirty = useRef(false);
  const done = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ mode, st });
  latest.current = { mode, st };
  const set = useCallback((p: Partial<RegState>) => { dirty.current = true; setPending(null); setSt((x) => ({ ...x, ...p })); }, []);
  useEffect(() => {
    if (!dirty.current || done.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = undefined; saveDraft(latest.current.mode, latest.current.st); }, 300);
  }, [st]);
  useEffect(() => () => {
    if (timer.current === undefined) return;
    clearTimeout(timer.current);
    if (!done.current) saveDraft(latest.current.mode, latest.current.st);
  }, []);
  /** came here with Edit on the review: Next goes straight back to it once everything is complete */
  const [fromReview, setFromReview] = useState(false);
  // a new step starts at the top of the screen (the step header and progress bar in view)
  useEffect(() => {
    const sc = top.current?.closest<HTMLElement>('.cp-noshrink');
    if (sc) sc.scrollTop = 0;
    if (stepI === last) setFromReview(false);
  }, [stepI, last]);

  const issuesOf = useCallback((k: RegStep) => stepIssues(k, st, mode, today, s), [st, mode, today, s]);
  const issues = useMemo(() => issuesOf(step), [issuesOf, step]);
  const reach = useMemo(() => firstOpenStep(st, mode, today, s), [st, mode, today, s]);
  const lead = mode.kind === 'lead' ? s.enquiries[mode.id] : undefined;
  const isTried = tried.has(step);
  const err = (...fields: string[]) => {
    if (!isTried) return '';
    const i = issues.find((x) => fields.includes(x.field));
    return i ? t(i.code, i.params) : '';
  };
  const markTried = () => setTried((x) => (x.has(step) ? x : new Set(x).add(step)));

  const close = () => onDone();
  const leave = (path: string) => { onDone(); navigate(path); };
  const goNext = () => {
    markTried();
    if (issues.length) return;
    if (fromReview && reach === last) { setFromReview(false); setStepI(last); } else setStepI((i) => Math.min(i + 1, last));
  };
  const goBack = () => (stepI ? setStepI(stepI - 1) : close());
  const resume = () => { if (!pending) return; dirty.current = true; setSt(pending); setStepI(firstOpenStep(pending, mode, today, s)); setPending(null); };
  const discard = () => { clearDraft(mode); setPending(null); };
  const pickLead = (id: string) => {
    clearTimeout(timer.current); timer.current = undefined;
    clearDraft({ kind: 'new' });
    const m: RegMode = { kind: 'lead', id };
    dirty.current = false;
    setMode(m); setSt(initialState(s, m, today)); setPending(loadDraft(m)); setTried(new Set()); setStepI(0);
  };

  const submit = async () => {
    markTried();
    if (busy || reach < last || issues.length) { if (reach < last) setStepI(reach); return; }
    setBusy(true);
    try {
      let r;
      if (mode.kind === 'lead') {
        if (!lead) return;
        if (seniorChanged(st, lead)) {
          const u = await act('enquiry.update', { enquiryId: lead.id, senior: { title: st.title, name: st.name.trim() } }, { silent: true });
          if (!u.ok) return;
        }
        const name = `${st.title} ${st.name.trim()}`;
        r = await act('enquiry.convert', toConvertInput(st, lead, st.plan as Plan, st.start), { ok: t('enq.joined', { name, date: fds(st.start), contact: lead.contact.name.split(' ')[0] }), reviewText: t('enq.joinSent', { name }) });
      } else {
        r = await act('members.create', toCreateInput(st), { ok: (res) => t('members.added', { n: st.name.trim(), id: String(res.memberId || '') }), reviewText: t('members.sentForReview') });
      }
      if (r.ok) {
        done.current = true;
        clearTimeout(timer.current); timer.current = undefined;
        clearDraft(mode);
        onDone(r.result.memberId ? String(r.result.memberId) : undefined);
      }
    } finally { setBusy(false); }
  };

  const p: StepProps = { st, set, mode, t, err, tried: isTried, issues, s, today, native: isPhone, leave };
  const body: Record<RegStep, ReactNode> = {
    person: <PersonStep p={p} onPickLead={pickLead} />,
    family: <FamilyStep p={p} />,
    health: <HealthStep p={p} />,
    plan: <PlanStep p={p} />,
    paper: <PaperStep p={p} />,
    review: <ReviewStep p={p} role={role} goTo={(k) => { setFromReview(true); setStepI(REG_STEPS.indexOf(k)); }} />,
  };
  const title = lead ? seniorName({ senior: { title: st.title, name: st.name.trim() || lead.senior.name } }) : st.name.trim() ? `${st.title} ${st.name.trim()}` : t('members.addTitle');
  const eyebrow = lead ? t('enq.jn_eyebrow') : t('members.newMember');
  const submitLabel = lead ? joinLabel(t, role, (st.plan || 'flex') as Plan) : t('members.create');
  const progress = `${stepI + 1}/${REG_STEPS.length}`;
  const stepOf = t('reg.stepOf', { n: stepI + 1, total: REG_STEPS.length, step: t('reg.' + step) });

  const resumeNote = pending ? (
    <Note icon="history">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span>{t('reg.resumeQ')}</span>
        <span style={{ display: 'flex', gap: 6 }}><PillBtn tone="primary" onClick={resume}>{t('reg.resume')}</PillBtn><PillBtn onClick={discard}>{t('reg.discard')}</PillBtn></span>
      </div>
    </Note>
  ) : null;
  // Next / Submit look off while the step has issues; a tap still shows what is missing
  const main = (style?: React.CSSProperties) => (
    <span style={{ display: 'contents' }} onClick={() => (stepI === last ? void submit() : goNext())}>
      <Button size={48} disabled={busy || issues.length > 0 || (stepI === last && reach < last)} style={style} iconRight={stepI === last ? undefined : 'chevron_right'}>{stepI === last ? submitLabel : fromReview && reach === last ? t('reg.review') : t('reg.next')}</Button>
    </span>
  );
  const backBtn = (style?: React.CSSProperties) => <Button variant="secondary" size={48} onClick={goBack} style={style}>{stepI ? t('reg.back') : t('common.cancel')}</Button>;
  const content = (
    <div ref={top} data-reg-step={step} style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 22 : 24, minWidth: 0, flexShrink: 0 }}>
      {resumeNote}
      {body[step]}
    </div>
  );

  if (isPhone) {
    return (
      <PhoneScreen open onClose={close} label={title} back={lead ? t('nav.enquiries') : t('nav.members')}
        footer={<div style={{ display: 'flex', gap: 10 }}>{backBtn({ flex: '1 1 0' })}{main({ flex: '1 1 0' })}</div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <Eyebrow>{stepOf}</Eyebrow>
          <h2 className="cp-serif" style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C', overflowWrap: 'anywhere' }}>{title}</h2>
          <StepBar n={stepI + 1} total={REG_STEPS.length} label={stepOf} />
        </div>
        {content}
      </PhoneScreen>
    );
  }
  return (
    <Dialog open onClose={close} eyebrow={eyebrow} title={title} maxWidth={760} footer={<>{backBtn()}{main()}</>}>
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexShrink: 0 }}>
        <nav aria-label={t('reg.steps')} data-progress={progress} style={{ flex: 'none', width: 150, position: 'sticky', top: 0, display: 'flex', flexDirection: 'column' }}>
          {REG_STEPS.map((k, j) => {
            const can = j <= reach || j < stepI;
            return (
              <button key={k} type="button" aria-current={j === stepI ? 'step' : undefined} aria-disabled={!can || undefined} onClick={() => { if (can) setStepI(j); }}
                style={{ display: 'flex', alignItems: 'stretch', gap: 10, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: can ? 'pointer' : 'default', fontFamily: 'Inter', color: j === stepI ? '#24201C' : j < stepI ? '#4A4038' : '#8A8078' }}>
                <RailDot state={j < stepI ? 'done' : j === stepI ? 'now' : 'up'} icon={j < stepI ? 'check' : STEP_ICON[k]} last={j === last} size={28} />
                <span style={{ paddingTop: 4, paddingBottom: 14, fontSize: 15, fontWeight: j === stepI ? 600 : 500, lineHeight: '20px' }}>{t('reg.' + k)}</span>
              </button>
            );
          })}
          <span style={{ fontSize: FONT_SMALL, color: '#6B6259', marginTop: 4 }}>{progress}</span>
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}><DialogBody>{content}</DialogBody></div>
      </div>
    </Dialog>
  );
}
