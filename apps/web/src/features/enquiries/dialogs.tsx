// Lead dialogs (design OvEnq + new ones): new / edit lead, book a visit, book a trial, review the family's form, join as a member,
// mark lost, and the form link (copy, simulated WhatsApp, fill as family).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDays, dayStatus, fmtPhone, priceOn, rp, toHM, toMin, type Diet, type DrugAllergy, type Enquiry, type FoodAllergen, type Mobility, type Plan, type Relation, type Title,
} from '@cp/shared';
import {
  ALL_RELATIONS, DIETS, ENQ_SOURCES, FOODS, LOST_REASONS, MOBILITIES, TITLES, bookableDays, bookingDayCheck, enquiryForm, formLink, isOpenStage, openGuest, seniorName, startMondays,
} from '@cp/shared/rules/enquiries';
import { Button, DateField, Dialog, Icon, Note, SectionLabel, TextField, TimeField, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { tn } from '../mgmt/common';
import { SignatureView } from './SignaturePad';

export type Dlg =
  | { mode: 'new' }
  | { mode: 'edit' | 'visit' | 'trial' | 'review' | 'join' | 'lost' | 'link'; id: string };

const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };

/** The design's two-line choice chip (label + small sub line). */
export function StackChip({ label, sub, selected, off, onClick }: { label: ReactNode; sub?: ReactNode; selected?: boolean; off?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={!!selected} aria-disabled={off || undefined} onClick={() => { if (!off) onClick(); }}
      style={{ minHeight: 52, minWidth: 88, padding: '6px 14px', borderRadius: 16, border: selected ? '1px solid #282828' : off ? '1px solid #EFECEA' : '1px solid #CAB8A2', background: selected ? '#282828' : off ? '#F4F0EE' : '#FFFFFF', color: selected ? '#FFFFFF' : off ? '#6A6967' : '#282828', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}>
      <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, whiteSpace: 'nowrap' }}>{label}</span>
      {sub ? <span style={{ fontSize: FONT_SMALL, lineHeight: 1.4 }}>{sub}</span> : null}
    </button>
  );
}
/** One-line pill chip (design chips: 44px). */
function Pick({ selected, onClick, children, off }: { selected?: boolean; onClick: () => void; children: ReactNode; off?: boolean }) {
  return (
    <button type="button" aria-pressed={!!selected} aria-disabled={off || undefined} onClick={() => { if (!off) onClick(); }}
      style={{ height: 44, padding: '0 16px', borderRadius: 999, border: selected ? '1px solid #282828' : off ? '1px solid #EFECEA' : '1px solid #CAB8A2', background: selected ? '#282828' : off ? '#F4F0EE' : '#FFFFFF', color: selected ? '#FFFFFF' : off ? '#6A6967' : '#282828', fontSize: 16, fontWeight: 500, cursor: off ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter' }}>
      {selected ? <Icon name="check" size={18} /> : null}
      {children}
    </button>
  );
}
function Sec({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}
function Rows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid #EFECEA', fontSize: 16, lineHeight: '22px' }}>
          <span style={{ color: '#6A6967', flex: 'none' }}>{k}</span>
          <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

export function EnquiryDialogs({ dlg, onClose }: { dlg: Dlg | null; onClose: () => void }) {
  if (!dlg) return null;
  const key = dlg.mode + ('id' in dlg ? dlg.id : '');
  if (dlg.mode === 'new') return <LeadDialog key={key} onClose={onClose} />;
  if (dlg.mode === 'edit') return <LeadDialog key={key} id={dlg.id} onClose={onClose} />;
  if (dlg.mode === 'visit' || dlg.mode === 'trial') return <BookDialog key={key} kind={dlg.mode} id={dlg.id} onClose={onClose} />;
  if (dlg.mode === 'review') return <ReviewDialog key={key} id={dlg.id} onClose={onClose} />;
  if (dlg.mode === 'join') return <JoinDialog key={key} id={dlg.id} onClose={onClose} />;
  if (dlg.mode === 'lost') return <LostDialog key={key} id={dlg.id} onClose={onClose} />;
  return <LinkDialog key={key} id={dlg.id} onClose={onClose} />;
}

// ---------- new / edit lead ----------
function LeadDialog({ id, onClose }: { id?: string; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const e = id ? s.enquiries[id] : undefined;
  const [title, setTitle] = useState<Title>(e?.senior.title ?? 'Oma');
  const [name, setName] = useState(e?.senior.name ?? '');
  const [cName, setCName] = useState(e?.contact.name ?? '');
  const [rel, setRel] = useState<Relation>(e?.contact.relation ?? 'daughter');
  const [phone, setPhone] = useState(e ? fmtPhone(e.contact.phone) : '');
  const [source, setSource] = useState<Enquiry['source']>(e?.source ?? 'referral');
  const [notes, setNotes] = useState(e?.notes ?? '');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const phoneOk = phone.replace(/\D/g, '').length >= 8;
  const ok = !!name.trim() && !!cName.trim() && phoneOk;
  const rels = ALL_RELATIONS.filter((r) => ['daughter', 'son', 'spouse', 'daughterInLaw', 'sonInLaw', 'grandson', 'granddaughter', 'sibling', 'other'].includes(r));
  const save = async () => {
    setTouched(true);
    if (!ok || busy) return;
    setBusy(true);
    try {
      const body = { senior: { title, name: name.trim() }, contact: { name: cName.trim(), relation: rel, phone }, source, notes: notes.trim() };
      if (e) {
        const r = await act('enquiry.update', { enquiryId: e.id, ...body }, { ok: t('enq.leadSaved') });
        if (r.ok) onClose();
      } else {
        const r = await act('enquiry.create', body, { ok: t('enq.leadCreated', { name: `${title} ${name.trim()}` }) });
        if (r.ok) onClose();
      }
    } finally { setBusy(false); }
  };
  const archive = async () => {
    if (!e) return;
    const r = await act('enquiry.archive', { enquiryId: e.id }, { ok: t('enq.archived', { name: seniorName(e) }) });
    if (r.ok) onClose();
  };
  return (
    <Dialog open onClose={onClose} eyebrow={e ? t('enq.editEyebrow') : t('enq.newEyebrow')} title={e ? seniorName(e) : t('enq.newLead')} maxWidth={600}
      footer={<>
        {e && !e.archivedAt ? <Button variant="secondary" icon="inventory_2" onClick={archive}>{t('enq.archive')}</Button> : null}
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={save} disabled={busy}>{e ? t('common.saveChanges') : t('enq.addLead')}</Button>
      </>}>
      <Sec label={t('enq.fSenior')}>
        <div style={row} role="radiogroup" aria-label={t('enq.fSeniorTitle')}>
          {TITLES.map((x) => <Pick key={x} selected={title === x} onClick={() => setTitle(x)}>{x}</Pick>)}
        </div>
        <TextField label={t('enq.fSeniorName')} value={name} onChange={setName} error={touched && !name.trim() && t('err.invalid')} />
      </Sec>
      <Sec label={t('enq.fContact')}>
        <TextField label={t('enq.fContactName')} value={cName} onChange={setCName} error={touched && !cName.trim() && t('err.invalid')} />
        <div style={row} role="radiogroup" aria-label={t('enq.fRelation')}>
          {rels.map((r) => <Pick key={r} selected={rel === r} onClick={() => setRel(r)}>{t('enq.rel_' + r)}</Pick>)}
        </div>
        <TextField label={t('common.phone')} value={phone} onChange={setPhone} inputMode="tel" placeholder="812 1090 4471" error={touched && !phoneOk && t('err.invalid')} />
      </Sec>
      <Sec label={t('enq.fSource')}>
        <div style={row} role="radiogroup" aria-label={t('enq.fSource')}>
          {ENQ_SOURCES.map((x) => <Pick key={x} selected={source === x} onClick={() => setSource(x)}>{t('enq.src_' + x)}</Pick>)}
        </div>
      </Sec>
      <TextField label={t('enq.fNotes')} multiline rows={3} value={notes} onChange={setNotes} />
    </Dialog>
  );
}

// ---------- visit and trial ----------
const TIMES = ['09:00', '10:00', '10:30', '11:00', '13:30', '14:00', '15:00'];

function DayTime({ kind, date, time, onDate, onTime }: { kind: 'visit' | 'trial'; date: string; time: string; onDate: (d: string) => void; onTime: (t: string) => void }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const { today, now } = useNow();
  const days = bookableDays(s, kind === 'trial' ? addDays(today, 1) : today, 8);
  const { open, close } = s.club.settings;
  const times = TIMES.filter((x) => toMin(x) >= toMin(open) && toMin(x) < toMin(close) && !(date === today && x < now));
  const check = date && (kind === 'trial' || time) ? bookingDayCheck(s, kind, date, kind === 'trial' ? undefined : time, today, now) : null;
  const st = date ? dayStatus(s, date) : null;
  return (
    <>
      <Sec label={t('enq.pickDay')}>
        <div style={row} role="radiogroup" aria-label={t('enq.pickDay')}>
          {days.map((d) => (
            <StackChip key={d} selected={date === d} label={fds(d).replace(/,/g, '')} sub={d === today ? t('common.today') : d === addDays(today, 1) ? t('common.tomorrow') : ''} onClick={() => onDate(d)} />
          ))}
        </div>
        <DateField label={t('enq.otherDate')} value={date} min={kind === 'trial' ? addDays(today, 1) : today} onChange={onDate} disabledDate={(d) => { const x = dayStatus(s, d); return !x.open || !!x.outing; }}
          error={date && st && !st.open ? t('err.closedDay') : false} />
      </Sec>
      {kind === 'visit' ? (
        <Sec label={t('enq.pickTime')}>
          <div style={row} role="radiogroup" aria-label={t('enq.pickTime')}>
            {times.map((x) => <StackChip key={x} selected={time === x} label={x} onClick={() => onTime(x)} />)}
          </div>
          <TimeField label={t('enq.otherTime')} value={time} onChange={onTime} min={date === today && now > open ? now : open} max={toHM(toMin(close) - 1)} />
        </Sec>
      ) : null}
      {check && !check.ok ? <div role="alert" style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 16, background: '#F7E4DD', color: '#AF4B2F', fontSize: 16, lineHeight: '22px' }}><Icon name="error" size={20} fill={1} /><span>{t(check.code, check.params)}</span></div> : null}
    </>
  );
}

function BookDialog({ kind, id, onClose }: { kind: 'visit' | 'trial'; id: string; onClose: () => void }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const { today, now } = useNow();
  const e = s.enquiries[id];
  const existing = e ? openGuest(s, id, kind) : undefined;
  // a lead can have a visit or trial written in its next step without a guest row yet: start from that day and time
  const planned = e?.next && e.next.kind === kind && e.next.date ? { date: e.next.date, time: e.next.time ?? '' } : undefined;
  const form = e ? enquiryForm(s, e) : undefined;
  const fd = form && (form.status === 'submitted' || form.status === 'approved') ? form.data : undefined;
  const [date, setDate] = useState(existing?.date ?? planned?.date ?? '');
  const [time, setTime] = useState(kind === 'visit' ? existing?.time ?? planned?.time ?? '' : '');
  const [food, setFood] = useState<FoodAllergen[] | null>(existing ? existing.food : fd ? fd.food : null);
  const [drugs] = useState<DrugAllergy[]>(existing?.drugs ?? fd?.drugs ?? []);
  const [mob, setMob] = useState<Mobility | null>(existing?.mobility ?? fd?.mobility ?? null);
  const [diet, setDiet] = useState<Diet[]>(existing?.diet ?? fd?.diet ?? []);
  const [busy, setBusy] = useState(false);
  if (!e) return null;
  // a trial is a day pass (lunch and the health check included): a day is all it needs. A visit needs a day and a time.
  const check = date && (kind === 'trial' || time) ? bookingDayCheck(s, kind, date, kind === 'trial' ? undefined : time, today, now) : null;
  const ok = !!date && (kind === 'trial' || !!time) && !!check?.ok;
  const book = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const ok2 = t(kind === 'visit' ? 'enq.visitBooked' : 'enq.trialBooked', { name: seniorName(e), date: fds(date), time, contact: e.contact.name.split(' ')[0] });
      const r = kind === 'visit'
        ? await act('enquiry.bookVisit', { enquiryId: id, date, time }, { ok: ok2 })
        : await act('enquiry.bookTrial', { enquiryId: id, date, food, drugs, mobility: mob, diet }, { ok: ok2 });
      if (r.ok) onClose();
    } finally { setBusy(false); }
  };
  const label = existing || planned ? (kind === 'visit' ? t('enq.visitChange') : t('enq.trialChange')) : kind === 'visit' ? t('enq.visitTitle') : t('enq.trialTitle');
  return (
    <Dialog open onClose={onClose} eyebrow={label} title={seniorName(e)} maxWidth={600}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={book} disabled={!ok || busy}>{ok ? t(kind === 'visit' ? 'enq.bookVisitFor' : 'enq.bookTrialFor', { date: fds(date), time }) : t(kind === 'visit' ? 'enq.pickDayTime' : 'enq.pickADay')}</Button></>}>
      <div style={{ fontSize: 16, lineHeight: '22px', padding: '12px 14px', borderRadius: 16, background: '#F4F0EE' }}>{kind === 'visit' ? t('enq.visitText', { contact: e.contact.name }) : t('enq.trialText', { contact: e.contact.name })}</div>
      <DayTime kind={kind} date={date} time={time} onDate={setDate} onTime={setTime} />
      {kind === 'trial' ? (
        <>
          <Note tone="cream" icon="restaurant">{t('enq.trialPass')}</Note>
          {fd ? <Note tone="sage" icon="assignment_turned_in">{t('enq.prefilled')}</Note> : null}
          <Sec label={t('enq.foodAllergies')}>
            <div style={row}>
              <Pick selected={food === null} onClick={() => setFood(null)}>{t('enq.notKnown')}</Pick>
              <Pick selected={food !== null && food.length === 0} onClick={() => setFood([])}>{t('common.none')}</Pick>
              {FOODS.map((x) => <Pick key={x} selected={!!food?.includes(x)} onClick={() => setFood(food?.includes(x) ? food.filter((y) => y !== x) : [...(food || []), x])}>{t('form.food_' + x)}</Pick>)}
            </div>
            <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('enq.foodHint')}</span>
          </Sec>
          <Sec label={t('enq.mobility')}>
            <div style={row} role="radiogroup" aria-label={t('enq.mobility')}>
              <Pick selected={mob === null} onClick={() => setMob(null)}>{t('form.mob_none')}</Pick>
              {MOBILITIES.map((x) => <Pick key={x} selected={mob === x} onClick={() => setMob(x)}>{t('form.mob_' + x)}</Pick>)}
            </div>
          </Sec>
          <Sec label={t('enq.diet')}>
            <div style={row}>
              {DIETS.map((x) => <Pick key={x} selected={diet.includes(x)} onClick={() => setDiet(diet.includes(x) ? diet.filter((y) => y !== x) : [...diet, x])}>{t('form.diet_' + x)}</Pick>)}
            </div>
          </Sec>
        </>
      ) : null}
    </Dialog>
  );
}

// ---------- joining: plan and first day (shared by "Approve and join" and the Join button) ----------
function useJoinPick() {
  const s = useClub();
  const { today } = useNow();
  const mondays = useMemo(() => startMondays(s, today, 4), [s, today]);
  const [plan, setPlan] = useState<Plan>('flex');
  const [start, setStart] = useState(mondays[0] ?? '');
  const st = start ? dayStatus(s, start) : null;
  const startOk = !!start && start >= today && !!st?.open;
  return { plan, setPlan, start, setStart, mondays, startOk, today };
}
function JoinPick({ pick }: { pick: ReturnType<typeof useJoinPick> }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const { plan, setPlan, start, setStart, mondays, startOk, today } = pick;
  const price = priceOn(s, today);
  return (
    <>
      <Sec label={t('enq.plan')}>
        <div style={row} role="radiogroup" aria-label={t('enq.plan')}>
          <StackChip selected={plan === 'flex'} label={t('mgmt.plan_flex')} sub={`${rp(price.flex)} · ${tn(t, 'enq.jn_visits', s.club.settings.flexQuota)}`} onClick={() => setPlan('flex')} />
          <StackChip selected={plan === 'gold'} label={t('mgmt.plan_gold')} sub={`${rp(price.gold)} · ${t('mgmt.plUnlimited').toLowerCase()}`} onClick={() => setPlan('gold')} />
        </div>
      </Sec>
      <Sec label={t('enq.start')}>
        <div style={row} role="radiogroup" aria-label={t('enq.start')}>
          {mondays.map((m) => <StackChip key={m} selected={start === m} label={fds(m).replace(/,/g, '')} onClick={() => setStart(m)} />)}
        </div>
        <DateField label={t('enq.otherDate')} value={start} min={today} onChange={setStart} disabledDate={(d) => !dayStatus(s, d).open} error={start && !startOk ? (start < today ? t('enq.err.startPast') : t('err.closedDay')) : false} />
      </Sec>
    </>
  );
}
/** What the footer button of the join step says: management creates the member, everyone else sends it to management. */
const joinLabel = (t: ReturnType<typeof useT>, role: string | null, plan: Plan, approving: boolean) =>
  t(role === 'mgmt' ? (approving ? 'enq.rv_createBtn' : 'enq.createMember') : approving ? 'enq.rv_sendBtn' : 'enq.sendForApproval', { plan: t('mgmt.plan_' + plan) });

// ---------- review the family's form: step 1 the form, step 2 plan and first day (approving a lead's form joins them) ----------
function ReviewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const { fdy, fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const navigate = useNavigate();
  const { role } = useMe();
  const e = s.enquiries[id];
  const f = e ? enquiryForm(s, e) : undefined;
  const d = f?.data;
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'form' | 'join'>('form');
  const [busy, setBusy] = useState(false);
  const pick = useJoinPick();
  if (!e || !f || !d) return null;
  const ready = f.status === 'submitted';
  const member = e.stage === 'joined' && e.memberId ? s.members[e.memberId] : undefined;
  const pending = !!member && member.review?.status === 'pending';
  // a form that was approved before joining existed is never a dead end: the lead can still be joined from it
  const canJoin = ready || (f.status === 'approved' && isOpenStage(e.stage));
  const contactFirst = d.contact.name.split(' ')[0];
  const doc = (label: string, has: boolean) => (
    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ aspectRatio: '4/3', borderRadius: 12, background: has ? 'linear-gradient(135deg, #FBF8F4 0%, #EADFD3 60%, #DCCFC0 100%)' : '#F6F5F5', border: has ? '1px solid #DBD7D6' : '1px dashed #CAB8A2' }} />
      <span style={{ fontSize: FONT_SMALL, lineHeight: '18px' }}>{label + (has ? '' : ` · ${t('enq.rv_missing')}`)}</span>
    </div>
  );
  const list = (a: string[]) => (a.length ? a.join(', ') : t('common.none'));
  const food = [...d.food.map((x) => t('form.food_' + x)), ...(d.foodOther ? [d.foodOther] : [])];
  const drugs = d.drugs.map((x) => (x.startsWith('other:') ? x.slice(6) : t('form.drug_' + x)));
  const join = async () => {
    if (!pick.startOk || busy) return;
    setBusy(true);
    try {
      const r = await act('enquiry.convert', { enquiryId: id, plan: pick.plan, start: pick.start }, { ok: t('enq.joined', { name: seniorName(e), date: fds(pick.start), contact: contactFirst }), reviewText: t('enq.joinSent', { name: seniorName(e) }) });
      if (r.ok) onClose();
    } finally { setBusy(false); }
  };
  const sendBack = async () => {
    const r = await act('form.return', { formId: f.id, note: note.trim() }, { ok: t('enq.formReturned', { name: contactFirst }) });
    if (r.ok) onClose();
  };
  const title = `${d.title} ${d.name}`;
  if (step === 'join') {
    return (
      <Dialog open onClose={onClose} eyebrow={t('enq.rv_step2')} title={title} maxWidth={600}
        footer={<><Button variant="secondary" onClick={() => setStep('form')}>{t('enq.rv_backForm')}</Button><Button icon="check" onClick={join} disabled={!pick.startOk || busy}>{joinLabel(t, role, pick.plan, ready)}</Button></>}>
        <Note tone="sage" icon="task_alt">{t('enq.rv_joinIntro', { name: title, contact: contactFirst })}</Note>
        <JoinPick pick={pick} />
        {role !== 'mgmt' ? <Note tone="ochre" icon="hourglass_top">{t('enq.joinReviewNote')}</Note> : null}
      </Dialog>
    );
  }
  return (
    <Dialog open onClose={onClose} eyebrow={t(ready ? 'enq.rv_eyebrow' : 'enq.rv_eyebrowDone', { date: f.submittedAt ? `${fds(f.submittedAt.slice(0, 10))}, ${f.submittedAt.slice(11, 16)}` : '' })} title={title} maxWidth={640}
      footer={ready ? (returning ? (
        <><Button variant="secondary" onClick={() => setReturning(false)}>{t('common.back')}</Button><Button disabled={!note.trim()} onClick={sendBack}>{t('enq.rv_sendBack')}</Button></>
      ) : (
        <><Button variant="secondary" icon="undo" onClick={() => setReturning(true)}>{t('enq.rv_return')}</Button><Button icon="check" onClick={() => setStep('join')}>{t('enq.rv_approveJoin')}</Button></>
      )) : (
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
          {canJoin ? <Button onClick={() => setStep('join')}>{t('enq.join')}</Button> : null}
          {member && !pending ? <Button onClick={() => { onClose(); navigate(`/members/${member.id}`); }}>{t('enq.openProfile')}</Button> : null}
        </>
      )}>
      {!ready ? <Note tone={pending ? 'ochre' : 'sage'} icon={pending ? 'hourglass_top' : 'check_circle'}>{member ? (pending ? t('enq.rv_joinedPending') : t('enq.rv_joinedNote', { name: title })) : t('enq.rv_approvedNote')}</Note> : null}
      {f.returnNote && ready ? <Note tone="ochre" icon="undo">{f.returnNote}</Note> : null}
      <Sec label={t('enq.rv_details')}>
        <Rows rows={[[t('enq.rv_dob'), d.dob ? fdy(d.dob) : '—'], [t('enq.rv_address'), d.address || '—'], [t('enq.rv_by'), `${d.contact.name} · ${t('enq.rel_' + d.contact.relation).toLowerCase()}`], [t('common.phone'), fmtPhone(d.contact.phone)]]} />
      </Sec>
      <Sec label={t('enq.rv_docs')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
          {doc('KTP', d.docs.ktp)}
          {doc(d.nanny ? t('enq.rv_nannyKtp', { name: d.nanny.name }) : t('enq.rv_noNanny'), d.nanny ? d.docs.nannyKtp : true)}
          {doc(t('enq.rv_healthPhoto'), d.docs.healthInfo)}
          {doc(t('enq.rv_signature'), !!d.signature)}
        </div>
      </Sec>
      <Sec label={t('enq.rv_health')}>
        <Rows rows={[
          [t('enq.rv_conditions'), list(d.conditions)], [t('enq.rv_meds'), d.meds.length ? d.meds.map((m) => `${m.name} ${m.dose}`.trim() + ` (${t('form.timing_' + m.timing).toLowerCase()})`).join(', ') : t('common.none')],
          [t('enq.rv_food'), list(food)], [t('enq.rv_drugs'), list(drugs)], [t('enq.rv_mobility'), d.mobility ? t('form.mob_' + d.mobility) : t('form.mob_none')], [t('enq.rv_diet'), list(d.diet.map((x) => t('form.diet_' + x)))],
        ]} />
      </Sec>
      <Sec label={t('enq.rv_consent')}>
        <Rows rows={[[t('enq.rv_consentData'), d.consent.data ? t('enq.rv_agreed') : t('enq.rv_notGiven')], [t('enq.rv_consentFace'), d.consent.face ? t('enq.rv_agreed') : t('enq.rv_declined')]]} />
      </Sec>
      {d.signature ? (
        <Sec label={t('enq.rv_signature')}>
          <SignatureView path={d.signature.svgPath} />
          <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{d.signature.by}{d.signature.at ? ` · ${fds(d.signature.at.slice(0, 10))}, ${d.signature.at.slice(11, 16)}` : ''}</span>
        </Sec>
      ) : null}
      {returning ? <TextField label={t('enq.rv_note')} multiline rows={3} value={note} onChange={setNote} autoFocus hint={t('enq.rv_noteHint', { name: contactFirst })} /> : null}
    </Dialog>
  );
}

// ---------- join as a member (a lead without a form, or one that is not ready to review) ----------
function JoinDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const { fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const { role } = useMe();
  const e = s.enquiries[id];
  const pick = useJoinPick();
  const [busy, setBusy] = useState(false);
  if (!e) return null;
  const form = enquiryForm(s, e);
  const fd = form && (form.status === 'submitted' || form.status === 'approved') ? form.data : undefined;
  const docs = fd ? [fd.docs.ktp && 'KTP', fd.nanny && fd.docs.nannyKtp && t('enq.jn_nannyKtp'), fd.docs.healthInfo && t('enq.jn_healthPhoto'), fd.signature && t('enq.jn_signedForm')].filter(Boolean).join(', ') : '';
  const allergies = fd ? [...fd.food.map((x) => t('form.food_' + x)), ...(fd.foodOther ? [fd.foodOther] : []), ...fd.drugs.map((x) => (x.startsWith('other:') ? x.slice(6) : t('form.drug_' + x)))] : [];
  const rows: [string, string][] = fd
    ? [
        [t('enq.jn_member'), `${fd.title} ${fd.name}`], [t('enq.jn_contact'), `${fd.contact.name} · ${fmtPhone(fd.contact.phone)}`], [t('enq.rv_dob'), fd.dob || '—'], [t('enq.jn_allergies'), allergies.length ? allergies.join(', ') : t('common.none')],
        [t('enq.rv_mobility'), fd.mobility ? t('form.mob_' + fd.mobility) : t('form.mob_none')], [t('enq.rv_diet'), fd.diet.length ? fd.diet.map((x) => t('form.diet_' + x)).join(', ') : t('common.none')],
        [t('enq.rv_meds'), fd.meds.length ? fd.meds.map((m) => m.name).join(', ') : t('common.none')], [t('enq.jn_docs'), docs || '—'], [t('enq.rv_consentFace'), fd.consent.face ? t('enq.rv_agreed') : t('enq.rv_declined')],
      ]
    : [[t('enq.jn_member'), seniorName(e)], [t('enq.jn_contact'), `${e.contact.name} · ${fmtPhone(e.contact.phone)}`]];
  const go = async () => {
    if (!pick.startOk || busy) return;
    setBusy(true);
    try {
      const r = await act('enquiry.convert', { enquiryId: id, plan: pick.plan, start: pick.start }, { ok: t('enq.joined', { name: seniorName(e), date: fds(pick.start), contact: (fd?.contact.name ?? e.contact.name).split(' ')[0] }), reviewText: t('enq.joinSent', { name: seniorName(e) }) });
      if (r.ok) onClose();
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} eyebrow={t('enq.jn_eyebrow')} title={fd ? `${fd.title} ${fd.name}` : seniorName(e)} maxWidth={600}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={go} disabled={!pick.startOk || busy}>{joinLabel(t, role, pick.plan, false)}</Button></>}>
      <Sec label={fd ? t('enq.jn_fromForm') : t('enq.jn_fromEnquiry')}>
        <Rows rows={rows} />
        <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{fd ? t('enq.jn_noRetype') : t('enq.jn_noForm')}</span>
      </Sec>
      <JoinPick pick={pick} />
      {role !== 'mgmt' ? <Note tone="ochre" icon="hourglass_top">{t('enq.joinReviewNote')}</Note> : null}
    </Dialog>
  );
}

// ---------- lost ----------
function LostDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const e = s.enquiries[id];
  const [reason, setReason] = useState<(typeof LOST_REASONS)[number] | null>(null);
  const [note, setNote] = useState('');
  if (!e) return null;
  const go = async () => {
    if (!reason) return;
    const r = await act('enquiry.markLost', { enquiryId: id, reason, note: note.trim() }, { ok: t('enq.markedLost', { name: seniorName(e) }) });
    if (r.ok) onClose();
  };
  return (
    <Dialog open onClose={onClose} eyebrow={t('enq.lostEyebrow')} title={seniorName(e)} maxWidth={560}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!reason} onClick={go}>{t('enq.lostBtn')}</Button></>}>
      <Sec label={t('enq.reason')}>
        <div style={row} role="radiogroup" aria-label={t('enq.reason')}>
          {LOST_REASONS.map((r) => <Pick key={r} selected={reason === r} onClick={() => setReason(r)}>{t('enq.lost.' + r)}</Pick>)}
        </div>
      </Sec>
      <TextField label={t('common.note')} multiline rows={2} value={note} onChange={setNote} />
    </Dialog>
  );
}

// ---------- the form link ----------
export function formUrl(token: string) {
  return `${window.location.origin}${formLink(token)}`;
}
function LinkDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const navigate = useNavigate();
  const e = s.enquiries[id];
  const f = e ? enquiryForm(s, e) : undefined;
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const x = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(x); }, [copied]);
  if (!e || !f) return null;
  const url = formUrl(f.token);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(el);
    }
    setCopied(true);
    say(t('enq.copied'));
  };
  return (
    <Dialog open onClose={onClose} eyebrow={t('enq.linkEyebrow')} title={e.contact.name} maxWidth={560}
      footer={<><Button variant="ghost" onClick={() => { onClose(); navigate(formLink(f.token)); }}>{t('enq.fillAsFamily')}</Button><Button variant="secondary" onClick={onClose}>{t('common.close')}</Button></>}>
      <div style={{ fontSize: 16, lineHeight: '22px', padding: '12px 14px', borderRadius: 16, background: '#F4F0EE' }}>{t('enq.linkSent', { contact: e.contact.name, phone: fmtPhone(f.sentTo) })}</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('enq.linkLabel')}</span>
        <input readOnly value={url} onFocus={(ev) => ev.currentTarget.select()} aria-label={t('enq.linkLabel')} data-testid="form-link"
          style={{ height: 52, border: '1px solid #8A755B', borderRadius: 16, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none', width: '100%', minWidth: 0 }} />
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button icon={copied ? 'check' : 'content_copy'} onClick={copy}>{copied ? t('enq.copied') : t('enq.copyLink')}</Button>
        <Button variant="secondary" icon="send" onClick={() => say(t('enq.waSent', { contact: e.contact.name.split(' ')[0] }))}>{t('enq.sendWa')}</Button>
      </div>
      <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('enq.linkNote')}</span>
    </Dialog>
  );
}
