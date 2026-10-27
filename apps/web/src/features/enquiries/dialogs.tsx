// Lead dialogs (design OvEnq + new ones): new / edit lead, book a visit, book a trial, join as a member (KC round 12: the stepped registration
// shared with Add member, members/register), and mark lost. Registration is on paper: staff type the key details in and attach a photo or PDF of the signed form.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  addDays, dayStatus, feeOf, fmtPhone, priceOn, rp, toHM, toMin, waUrl, type Diet, type DrugAllergy, type Enquiry, type FoodAllergen, type Mobility, type Relation,
} from '@cp/shared';
import {
  ALL_RELATIONS, DIETS, ENQ_SOURCES, FOODS, LOST_REASONS, MOBILITIES, bookableDays, bookingDayCheck, formLinkState, formPath, openGuest, seniorName, trialDays,
} from '@cp/shared/rules/enquiries';
import { Button, DateField, Dialog, Icon, Note, TimeField } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { RegistrationFlow } from '../members/register/RegistrationFlow';
import { StackChip } from '../members/register/parts';
import { DialogBody, PeSection, TextField } from '../members/dialogs/forms';
import { TitleField } from '../members/dialogs/TitleField';

export type Dlg =
  | { mode: 'new' }
  | { mode: 'edit' | 'visit' | 'trial' | 'join' | 'lost' | 'link'; id: string };

const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };

export { StackChip };
/** One-line pill chip (design chips: 44px). */
function Pick({ selected, onClick, children, off }: { selected?: boolean; onClick: () => void; children: ReactNode; off?: boolean }) {
  return (
    <button type="button" aria-pressed={!!selected} aria-disabled={off || undefined} onClick={() => { if (!off) onClick(); }} className={selected ? undefined : 'cp-fill'}
      style={{ height: 44, padding: '0 16px', borderRadius: 999, border: 'none', background: selected ? '#24201C' : off ? 'var(--press, #EEEEF0)' : 'var(--fill, #F4F4F5)', color: selected ? '#FFFFFF' : off ? '#8A8078' : '#24201C', fontSize: 15, fontWeight: 500, cursor: off ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter' }}>
      {selected ? <Icon name="check" size={18} /> : null}
      {children}
    </button>
  );
}
/** KC round 10 ("the forms look different"): the same section as Add member (members/dialogs/forms PeSection), so shared fields sit the same way in both. */
function Sec({ label, children }: { label: ReactNode; children: ReactNode }) {
  const { isPhone } = useDevice();
  return <PeSection native={isPhone} label={label}>{children}</PeSection>;
}
function Rows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '0.5px solid var(--hairline, #E2E2E6)', fontSize: 15, lineHeight: '22px' }}>
          <span style={{ color: '#6B6259', flex: 'none' }}>{k}</span>
          <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

export function EnquiryDialogs({ dlg, onClose, onSwitch }: { dlg: Dlg | null; onClose: () => void; /** open another dialog for the same lead (the form link's "Open in Join") */ onSwitch?: (d: Dlg) => void }) {
  if (!dlg) return null;
  const key = dlg.mode + ('id' in dlg ? dlg.id : '');
  if (dlg.mode === 'new') return <LeadDialog key={key} onClose={onClose} />;
  if (dlg.mode === 'edit') return <LeadDialog key={key} id={dlg.id} onClose={onClose} />;
  if (dlg.mode === 'visit' || dlg.mode === 'trial') return <BookDialog key={key} kind={dlg.mode} id={dlg.id} onClose={onClose} />;
  if (dlg.mode === 'join') return <JoinDialog key={key} id={dlg.id} onClose={onClose} />;
  if (dlg.mode === 'link') return <FormLinkDialog key={key} id={dlg.id} onClose={onClose} onJoin={() => (onSwitch ? onSwitch({ mode: 'join', id: dlg.id }) : onClose())} />;
  return <LostDialog key={key} id={dlg.id} onClose={onClose} />;
}

// ---------- new / edit lead ----------
function LeadDialog({ id, onClose }: { id?: string; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const e = id ? s.enquiries[id] : undefined;
  const [title, setTitle] = useState<string>(e?.senior.title ?? 'Oma');
  const [name, setName] = useState(e?.senior.name ?? '');
  const [cName, setCName] = useState(e?.contact.name ?? '');
  const [rel, setRel] = useState<Relation>(e?.contact.relation ?? 'daughter');
  const [phone, setPhone] = useState(e ? fmtPhone(e.contact.phone) : '');
  const [source, setSource] = useState<Enquiry['source']>(e?.source ?? 'referral');
  const [sourceOther, setSourceOther] = useState(e?.sourceOther ?? '');
  const [notes, setNotes] = useState(e?.notes ?? '');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const phoneOk = phone.replace(/\D/g, '').length >= 8;
  const ok = !!title.trim() && !!name.trim() && !!cName.trim() && phoneOk;
  const rels = ALL_RELATIONS.filter((r) => ['daughter', 'son', 'spouse', 'daughterInLaw', 'sonInLaw', 'grandson', 'granddaughter', 'sibling', 'other'].includes(r));
  const save = async () => {
    setTouched(true);
    if (!ok || busy) return;
    setBusy(true);
    try {
      const body = { senior: { title: title.trim(), name: name.trim() }, contact: { name: cName.trim(), relation: rel, phone }, source, ...(source === 'other' ? { sourceOther: sourceOther.trim() } : {}), notes: notes.trim() };
      if (e) {
        const r = await act('enquiry.update', { enquiryId: e.id, ...body }, { ok: t('enq.leadSaved') });
        if (r.ok) onClose();
      } else {
        const r = await act('enquiry.create', body, { ok: t('enq.leadCreated', { name: `${title.trim()} ${name.trim()}` }) });
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
      <DialogBody>
      <Sec label={t('enq.fSenior')}>
        <TitleField value={title} onChange={setTitle} error={touched && !title.trim() ? t('enq.err.titleRequired') : undefined} />
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
        {source === 'other' ? <TextField label={t('enq.sourceOther')} value={sourceOther} onChange={(v) => setSourceOther(v.slice(0, 80))} /> : null}
      </Sec>
      <TextField label={t('enq.fNotes')} multiline rows={3} value={notes} onChange={setNotes} />
      </DialogBody>
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
  // a trial is 2 days in a row, so a start day whose second day is an outing is left out
  const days = bookableDays(s, kind === 'trial' ? addDays(today, 1) : today, kind === 'trial' ? 12 : 8).filter((d) => kind !== 'trial' || bookingDayCheck(s, 'trial', d, undefined, today, now).ok).slice(0, 8);
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
      {check && !check.ok ? <div role="alert" style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#F9E3DB', color: '#9A3D24', fontSize: 16, lineHeight: '22px' }}><Icon name="error" size={20} fill={1} /><span>{t(check.code, check.params)}</span></div> : null}
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
  const [date, setDate] = useState(existing?.date ?? planned?.date ?? '');
  const [time, setTime] = useState(kind === 'visit' ? existing?.time ?? planned?.time ?? '' : '');
  const [food, setFood] = useState<FoodAllergen[] | null>(existing ? existing.food : null);
  const [drugs] = useState<DrugAllergy[]>(existing?.drugs ?? []);
  const [mob, setMob] = useState<Mobility | null>(existing?.mobility ?? null);
  const [diet, setDiet] = useState<Diet[]>(existing?.diet ?? []);
  const [busy, setBusy] = useState(false);
  if (!e) return null;
  // a trial is a day pass (lunch and the health check included): a day is all it needs. A visit needs a day and a time.
  const check = date && (kind === 'trial' || time) ? bookingDayCheck(s, kind, date, kind === 'trial' ? undefined : time, today, now) : null;
  const ok = !!date && (kind === 'trial' || !!time) && !!check?.ok;
  const book = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const ok2 = t(kind === 'visit' ? 'enq.visitBooked' : 'enq.trialBooked', { name: seniorName(e), date: fds(date), date2: date ? fds(trialDays(s, date)[1]) : '', price: trialPrice, time, contact: e.contact.name.split(' ')[0] });
      const r = kind === 'visit'
        ? await act('enquiry.bookVisit', { enquiryId: id, date, time }, { ok: ok2 })
        : await act('enquiry.bookTrial', { enquiryId: id, date, food, drugs, mobility: mob, diet }, { ok: ok2 });
      if (r.ok) onClose();
    } finally { setBusy(false); }
  };
  const trialPrice = rp(feeOf(priceOn(s, today), 'trial')); // KC round 6 (the brochure): 2 days in a row for one fee, paid at the front desk
  const second = kind === 'trial' && date ? trialDays(s, date)[1] : '';
  const label = existing || planned ? (kind === 'visit' ? t('enq.visitChange') : t('enq.trialChange')) : kind === 'visit' ? t('enq.visitTitle') : t('enq.trialTitle');
  return (
    <Dialog open onClose={onClose} eyebrow={label} title={seniorName(e)} maxWidth={600}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={book} disabled={!ok || busy}>{ok ? t(kind === 'visit' ? 'enq.bookVisitFor' : 'enq.bookTrialFor', { date: fds(date), date2: second ? fds(second) : '', price: trialPrice, time }) : t(kind === 'visit' ? 'enq.pickDayTime' : 'enq.pickADay')}</Button></>}>
      <div style={{ fontSize: 15, lineHeight: '22px', padding: '12px 14px', borderRadius: 14, background: 'var(--fill, #F4F4F5)' }}>{kind === 'visit' ? t('enq.visitText', { contact: e.contact.name }) : t('enq.trialText', { contact: e.contact.name, price: trialPrice })}</div>
      <DayTime kind={kind} date={date} time={time} onDate={setDate} onTime={setTime} />
      {second && ok ? <div data-testid="trial-days" style={{ fontSize: 15, lineHeight: '22px', padding: '12px 14px', borderRadius: 10, background: '#E3EFE6', color: '#2F5A40', display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontWeight: 600 }}>{t('enq.trialDays', { a: fds(date), b: fds(second) })} · {trialPrice}</span><span>{t('enq.trialPass')} {t('enq.trialPrice', { price: trialPrice })}</span></div> : null}
      {kind === 'trial' ? (
        <>
          <Sec label={t('enq.foodAllergies')}>
            <div style={row}>
              <Pick selected={food === null} onClick={() => setFood(null)}>{t('enq.notKnown')}</Pick>
              <Pick selected={food !== null && food.length === 0} onClick={() => setFood([])}>{t('common.none')}</Pick>
              {FOODS.map((x) => <Pick key={x} selected={!!food?.includes(x)} onClick={() => setFood(food?.includes(x) ? food.filter((y) => y !== x) : [...(food || []), x])}>{t('form.food_' + x)}</Pick>)}
            </div>
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

// ---------- join as a member: KC round 12, the stepped registration shared with Add member (plan, first day, the application form's answers and the
// signed paper form), pre-filled from the lead, the family's online form, or the trial day ----------
function JoinDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useClub();
  if (!s.enquiries[id]) return null;
  return <RegistrationFlow mode={{ kind: 'lead', id }} onDone={() => onClose()} />;
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

// ---------- KC round 10: the online registration link ----------
/**
 * The link for a lead: made on opening when there is none (or the old one expired), then shown with Copy and Send on WhatsApp, and where it stands
 * (sent, opened, filled in). Once the family has sent the form, the answers are summarised and "Open in Join" carries on with them filled in.
 */
function FormLinkDialog({ id, onClose, onJoin }: { id: string; onClose: () => void; onJoin: () => void }) {
  const t = useT();
  const { fds, fdy } = useFmt();
  const s = useClub();
  const act = useAct();
  const { today, now } = useNow();
  const e = s.enquiries[id];
  const [busy, setBusy] = useState(false);
  const state = e ? formLinkState(e.form, `${today}T${now}`) : null;
  const send = useCallback(async () => {
    setBusy(true);
    const r = await act('enquiry.sendForm', { enquiryId: id }, { silent: true });
    setBusy(false);
    if (r.ok && e) say(t('enq.formSentToast', { contact: e.contact.name.split(' ')[0] }), { icon: 'send' });
  }, [act, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (e && (!state || state === 'expired')) void send(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!e) return null;
  const f = e.form;
  const url = f && state !== 'expired' ? `${window.location.origin}${formPath(f.token)}` : '';
  const day = (dt: string) => fds(dt.slice(0, 10));
  const copy = async () => { try { await navigator.clipboard.writeText(url); say(t('enq.formLinkCopied'), { icon: 'content_copy' }); } catch { /* clipboard blocked */ } };
  const wa = () => window.open(`${waUrl(e.contact.phone)}?text=${encodeURIComponent(t('enq.formLinkWaText', { contact: e.contact.name.split(' ')[0], name: seniorName(e), link: url }))}`, '_blank', 'noopener');
  const line = !f || !state ? '' : state === 'submitted' ? t('enq.formFilledBy', { name: f.filledBy || e.contact.name, date: day(f.submittedAt!) })
    : state === 'expired' ? t('enq.formExpiredOn', { until: day(f.expiresAt) }) : state === 'inProgress' ? t('enq.formSavedOn', { n: f.step ?? 1, date: day(f.savedAt ?? f.sentAt), until: day(f.expiresAt) }) : t(state === 'opened' ? 'enq.formOpenedOn' : 'enq.formSentOn', { date: day(f.sentAt), until: day(f.expiresAt) });
  const dr = state === 'submitted' ? f?.draft : undefined;
  const summary: [string, string][] = dr ? [
    [t('enq.jn_member'), `${dr.title} ${dr.name}`], ...(dr.dob ? [[t('profile.f.dob'), fdy(dr.dob)] as [string, string]] : []), ...(dr.address ? [[t('profile.f.address'), dr.address] as [string, string]] : []),
    [t('enq.jn_contact'), `${dr.contact.name} · ${fmtPhone(dr.contact.phone)}`], ...(dr.plan ? [[t('enq.plan'), t('mgmt.plan_' + dr.plan)] as [string, string]] : []),
  ] : [];
  return (
    <Dialog open onClose={onClose} eyebrow={t('enq.formLinkEyebrow')} title={seniorName(e)} maxWidth={560}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
        {state === 'submitted' ? <Button icon="person_add" onClick={onJoin}>{t('enq.formOpenJoin')}</Button> : <Button icon="chat" onClick={wa} disabled={!url || busy}>{t('enq.formLinkWa')}</Button>}
      </>}>
      <DialogBody>
        <Note>{t('enq.formLinkIntro')}</Note>
        {line ? <div data-testid="form-link-state" data-state={state} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: state === 'submitted' ? '#3D6B4F' : '#5E5852' }}><Icon name={state === 'submitted' ? 'assignment_turned_in' : state === 'expired' ? 'link_off' : state === 'inProgress' ? 'edit_note' : state === 'opened' ? 'drafts' : 'send'} size={18} />{line}</div> : null}
        {dr ? <Sec label={t('enq.jn_fromOnline')}><Rows rows={summary} /></Sec> : null}
        {state !== 'submitted' ? (
          <Sec label={t('enq.formLinkLabel')}>
            {url ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input readOnly value={url} aria-label={t('enq.formLinkLabel')} data-testid="form-link-url" onFocus={(ev) => ev.currentTarget.select()} className="cp-input cp-fill" style={{ flex: 1, minWidth: 0, height: 48, border: 'none', borderRadius: 12, background: 'var(--fill, #F4F4F5)', padding: '0 14px', fontSize: 14, fontFamily: 'Inter', color: '#24201C' }} />
                <Button variant="secondary" size={48} icon="content_copy" onClick={() => void copy()}>{t('enq.formLinkCopy')}</Button>
              </div>
            ) : <span style={{ fontSize: 14, color: '#6B6259' }}>{t('enq.formLinkMaking')}</span>}
            {url ? <div><Button variant="quiet" size={44} icon="refresh" disabled={busy} onClick={() => void send()} style={{ fontSize: 13 }}>{t('enq.formLinkAgain')}</Button></div> : null}
          </Sec>
        ) : null}
      </DialogBody>
    </Dialog>
  );
}
