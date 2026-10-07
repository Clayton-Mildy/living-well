// Edit dialogs (design OvPe): details, health record, cognitive status, plan, consent, family contact, end membership, reactivate.
// Each dialog builds the smallest change it can and sends it through the right action: gated for the front desk, applied now for health.
import { useMemo, useState } from 'react';
import {
  addMonths, e164, execute, fmtPhone, isOpen, live, memberName, nextOpenDay, openDaysInMonth, planOn, priceOn, rp, sortBy, toHM, toMin, ym, linksOfMember, isPendingRow, contactsOfMember,
  type Plan, type Title, type Relation, type EndReason,
} from '@cp/shared';
import { END_REASONS, consentOf, firstOfNextMonth, isPhone, openBalance, plainName } from '@cp/shared/rules/members';
import { Button, ChipGroup, DateField, Dialog, Note, StaffOnlyTag, Toggle } from '../../../components/ui';
import { say } from '../../../store/ui';
import { endReasonLabel } from '../lib';
import { ProfilePhotoField } from '../ProfilePhoto';
import { AllergyFields, DialogBody, TextField, HealthFields, MedsEditor, OptionalTime, PeSection, RelationChips, SelectField, TitleName, YesNo, joinDrugs, splitDrugs, useDraft, type MedRow } from './forms';
import type { DialogKind, P } from '../profile/types';

type Props = { p: P; kind: DialogKind; familyId?: string; onClose: () => void };
const dialogTitle: Record<DialogKind, string> = { details: 'profile.dlg.details', health: 'profile.dlg.health', care: 'profile.dlg.care', plan: 'profile.dlg.plan', consent: 'profile.dlg.consent', contact: 'profile.dlg.contactAdd', end: 'profile.dlg.end', reactivate: 'profile.dlg.reactivate' };

export function MemberDialog({ p, kind, familyId, onClose }: Props) {
  const { t, m } = p;
  const title = kind === 'contact' && familyId ? t('profile.dlg.contactEdit') : t(dialogTitle[kind]);
  return (
    <Dialog open onClose={onClose} eyebrow={kind === 'end' || kind === 'reactivate' ? t('profile.membership') : memberName(m)} title={title}>
      <DialogBody>
      {kind === 'details' ? <DetailsForm p={p} onClose={onClose} /> : null}
      {kind === 'health' ? <HealthForm p={p} onClose={onClose} /> : null}
      {kind === 'care' ? <CognitiveForm p={p} onClose={onClose} /> : null}
      {kind === 'plan' ? <PlanForm p={p} onClose={onClose} /> : null}
      {kind === 'consent' ? <ConsentForm p={p} onClose={onClose} /> : null}
      {kind === 'contact' ? <ContactForm p={p} familyId={familyId} onClose={onClose} /> : null}
      {kind === 'end' ? <EndForm p={p} onClose={onClose} /> : null}
      {kind === 'reactivate' ? <ReactivateForm p={p} onClose={onClose} /> : null}
      </DialogBody>
    </Dialog>
  );
}

// ---------- shared footer ----------
function Footer({ onClose, label, onSave, busy, danger, t }: { onClose: () => void; label: string; onSave: () => void; busy?: boolean; danger?: boolean; t: P['t'] }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', position: 'sticky', bottom: -28, margin: '0 -28px -28px', padding: '16px 28px 24px', background: '#FFFFFF', borderTop: '1px solid #F0EAE1' }}>
      <Button variant="secondary" size={48} onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant={danger ? 'danger' : 'primary'} size={48} disabled={busy} onClick={onSave}>{label}</Button>
    </div>
  );
}
const GateNote = ({ p, flagged }: { p: P; flagged?: boolean }) => (p.mgmt ? null : <Note icon={flagged ? 'fact_check' : 'hourglass_top'}>{flagged ? p.t('profile.noteFlagged') : p.t('profile.noteGated')}</Note>);
const MgmtNote = ({ p, v, set }: { p: P; v: string; set: (v: string) => void }) => (p.mgmt ? null : <TextField label={p.t('profile.noteForMgmt')} value={v} onChange={set} multiline rows={2} />);

// ---------- details ----------
function DetailsForm({ p, onClose }: { p: P; onClose: () => void }) {
  const { s, m, t, today } = p;
  const hours = { open: s.club.settings.open, last: toHM(toMin(s.club.settings.close) - 1) };
  const [d, set] = useDraft(() => ({
    title: m.title as Title, name: plainName(m), dob: m.dob || '', address: m.address || '', usual: m.usualArrival || '', nanny: !!m.nanny, nannyName: m.nanny?.name || '', nannyPhone: m.nanny?.phone ? fmtPhone(m.nanny.phone) : '',
    spouseId: m.spouseId || '', note: '', photo: m.photoMediaId || '',
  }));
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const members = sortBy(live(s.members).filter((x) => x.id !== m.id && !isPendingRow(x)), (x) => x.firstName);
  const errName = tried && d.name.trim().length < 2 ? t('members.err.nameRequired') : '';
  const errNanny = tried && d.nanny && !d.nannyName.trim() ? t('members.err.nannyNameRequired') : '';
  const save = async () => {
    setTried(true);
    if (d.name.trim().length < 2 || (d.nanny && !d.nannyName.trim()) || busy) return;
    const patch: Record<string, unknown> = {};
    if (d.title !== m.title) patch.title = d.title;
    if (d.name.trim() !== plainName(m)) patch.name = d.name.trim();
    if (d.dob && d.dob !== (m.dob || '')) patch.dob = d.dob;
    if (d.address.trim() !== (m.address || '')) patch.address = d.address.trim();
    if (d.usual !== (m.usualArrival || '')) patch.usualArrival = d.usual;
    const nanny = d.nanny ? { name: d.nannyName.trim(), ...(d.nannyPhone.trim() ? { phone: e164(d.nannyPhone) } : {}) } : null;
    if (JSON.stringify(nanny) !== JSON.stringify(m.nanny)) patch.nanny = nanny;
    if ((d.spouseId || null) !== m.spouseId) patch.spouseId = d.spouseId || null;
    if ((d.photo || undefined) !== m.photoMediaId) patch.photoMediaId = d.photo || null;
    if (!Object.keys(patch).length) { say(t('err.noChanges')); return; }
    setBusy(true);
    const r = await p.act('members.updateDetails', { memberId: m.id, patch, ...(d.note.trim() ? { note: d.note.trim() } : {}) }, { ok: t('profile.savedDetails', { n: memberName(m) }), reviewText: t('profile.sentForReview') });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <>
      <GateNote p={p} />
      <PeSection label={t('profile.sec.details')}>
        <ProfilePhotoField name={memberName(m)} tone={m.photoTone} value={d.photo || null} onChange={(id) => set({ photo: id || '' })} />
        <TitleName d={d} set={set} t={t} errors={{ name: errName }} />
        <DateField label={t('profile.f.dob')} value={d.dob} onChange={(v) => set({ dob: v })} max={today} startAt={`${+today.slice(0, 4) - 80}${today.slice(4)}`} />
        <TextField label={t('profile.f.address')} value={d.address} onChange={(v) => set({ address: v })} placeholder={t('profile.addressPh')} name="address" />
        <OptionalTime label={t('profile.f.usualOpt')} value={d.usual} onChange={(v) => set({ usual: v })} min={hours.open} max={hours.last} t={t} />
        <SelectField label={t('profile.f.spouse')} value={d.spouseId} onChange={(v) => set({ spouseId: v })} placeholder={t('profile.noSpouse')} options={members.map((x) => ({ value: x.id, label: memberName(x) }))} />
      </PeSection>
      <PeSection label={t('profile.sec.nanny')}>
        <YesNo label={t('profile.comesWithNanny')} value={d.nanny} onChange={(v) => set({ nanny: v })} t={t} />
        {d.nanny ? (
          <>
            <TextField label={t('profile.nannyName')} value={d.nannyName} onChange={(v) => set({ nannyName: v })} error={errNanny} />
            <TextField label={t('profile.nannyPhone')} value={d.nannyPhone} onChange={(v) => set({ nannyPhone: v })} inputMode="tel" placeholder="+62" />
          </>
        ) : null}
      </PeSection>
      <MgmtNote p={p} v={d.note} set={(v) => set({ note: v })} />
      <Footer t={t} onClose={onClose} onSave={save} busy={busy} label={p.mgmt ? t('common.saveChanges') : t('common.submitReview')} />
    </>
  );
}

// ---------- health (applied now, management reviews it afterwards) ----------
function HealthForm({ p, onClose }: { p: P; onClose: () => void }) {
  const { m, t } = p;
  const h = m.health;
  const [d, set] = useDraft(() => ({
    conditions: [...h.conditions], diabetic: h.diabetic, mobility: (h.mobility || 'none') as import('@cp/shared').Mobility | 'none', diet: [...h.diet],
    food: [...h.food], foodOther: h.foodOther || '', ...splitDrugs(h.drugs), meds: h.meds.map((x): MedRow => ({ key: x.id, id: x.id, name: x.name, dose: x.dose, timing: x.timing })), care: m.care.instructions,
  }));
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const save = async () => {
    setTried(true);
    if (busy || d.meds.some((x) => !x.name.trim())) return;
    setBusy(true);
    let any = false;
    let ok = true;
    const run = async (name: string, input: Record<string, unknown>) => { if (!ok) return; const r = await p.act(name, { memberId: m.id, ...input }, { silent: true }); if (!r.ok && r.code !== 'err.noChanges') ok = false; else if (r.ok) any = true; };
    const conditions = d.conditions;
    const mobility = d.mobility === 'none' ? null : d.mobility;
    if (JSON.stringify(conditions) !== JSON.stringify(h.conditions) || d.diabetic !== h.diabetic || mobility !== h.mobility || JSON.stringify(d.diet) !== JSON.stringify(h.diet)) await run('members.setHealth', { conditions, diabetic: d.diabetic, mobility, diet: d.diet });
    if (JSON.stringify(d.food) !== JSON.stringify(h.food) || d.foodOther.trim() !== (h.foodOther || '') || JSON.stringify(joinDrugs(d)) !== JSON.stringify(h.drugs)) await run('members.setAllergies', { food: d.food, foodOther: d.foodOther.trim(), drugs: joinDrugs(d) });
    const meds = d.meds.filter((x) => x.name.trim()).map((x) => ({ ...(x.id ? { id: x.id } : {}), name: x.name.trim(), dose: x.dose.trim(), timing: x.timing }));
    if (JSON.stringify(meds.map((x) => ({ name: x.name, dose: x.dose, timing: x.timing }))) !== JSON.stringify(h.meds.map((x) => ({ name: x.name, dose: x.dose, timing: x.timing })))) await run('members.setMeds', { meds });
    if (d.care.trim() !== m.care.instructions) await run('members.setCareInstructions', { text: d.care.trim() });
    setBusy(false);
    if (!ok) return;
    if (!any) { say(t('err.noChanges')); return; }
    say(p.mgmt ? t('profile.savedHealth', { n: memberName(m) }) : t('profile.savedHealthFlagged', { n: memberName(m) }));
    onClose();
  };
  return (
    <>
      <GateNote p={p} flagged />
      <PeSection label={t('profile.sec.health')}>
        <HealthFields d={d} set={set} t={t} />
        <div style={{ fontWeight: 500 }}>{t('profile.medicines')}</div>
        <MedsEditor rows={d.meds} onChange={(meds) => set({ meds })} t={t} showErrors={tried} />
      </PeSection>
      <PeSection label={t('profile.sec.allergies')}>
        <AllergyFields d={d} set={set} t={t} />
      </PeSection>
      <PeSection label={<>{t('profile.careInstructions')}<StaffOnlyTag /></>}>
        <TextField label={<span className="sr-only">{t('profile.careInstructions')}</span>} value={d.care} onChange={(v) => set({ care: v })} multiline rows={4} name="care" />
      </PeSection>
      <Footer t={t} onClose={onClose} onSave={save} busy={busy} label={t('common.saveChanges')} />
    </>
  );
}

// ---------- cognitive status ----------
function CognitiveForm({ p, onClose }: { p: P; onClose: () => void }) {
  const { m, t } = p;
  const [v, setV] = useState(m.health.cognitive.summary);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy) return;
    if (v.trim() === m.health.cognitive.summary) { say(t('err.noChanges')); return; }
    setBusy(true);
    const r = await p.act('members.setCognitive', { memberId: m.id, summary: v.trim() }, { silent: true });
    setBusy(false);
    if (r.ok) { say(p.mgmt ? t('profile.savedCognitive', { n: memberName(m) }) : t('profile.savedHealthFlagged', { n: memberName(m) })); onClose(); }
  };
  return (
    <>
      <GateNote p={p} flagged />
      <PeSection label={t('profile.cognitive')}>
        <TextField label={t('profile.cognitiveLabel')} value={v} onChange={setV} multiline rows={3} name="cognitive" />
      </PeSection>
      <Footer t={t} onClose={onClose} onSave={save} busy={busy} label={t('common.saveChanges')} />
    </>
  );
}

// ---------- plan ----------
function PlanForm({ p, onClose }: { p: P; onClose: () => void }) {
  const { s, m, t, fmt, today } = p;
  const cur = planOn(m, today);
  const price = priceOn(s, today);
  const [d, set] = useDraft(() => ({ plan: cur.plan as Plan, effective: firstOfNextMonth(today), note: '' }));
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const errEff = tried && (!d.effective || d.effective < today) ? t('members.err.effectiveInvalid') : '';
  const save = async () => {
    setTried(true);
    if (!d.effective || d.effective < today || busy) return;
    if (planOn(m, d.effective).plan === d.plan) { say(t('err.noChanges')); return; }
    setBusy(true);
    const r = await p.act('members.changePlan', { memberId: m.id, plan: d.plan, effective: d.effective, ...(d.note.trim() ? { note: d.note.trim() } : {}) }, { ok: t('profile.savedPlan', { n: memberName(m), d: fmt.fdy(d.effective) }), reviewText: t('profile.sentForReview') });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <>
      <GateNote p={p} />
      <PeSection label={t('profile.sec.plan')}>
        <ChipGroup label={t('profile.sec.plan')} value={d.plan} onChange={(v) => set({ plan: v as Plan })} options={[{ value: 'flex', label: `${t('profile.planFlex')} · ${rp(price.flex)}` }, { value: 'gold', label: `${t('profile.planGold')} · ${rp(price.gold)}` }]} />
        <div style={{ fontSize: 16, lineHeight: '22px', color: '#5E5852' }}>{d.plan === 'flex' ? t('profile.planNoteFlex', { q: s.club.settings.flexQuota, p: rp(price.extra) }) : t('profile.planNoteGold')}</div>
        <DateField label={t('profile.effective')} value={d.effective} onChange={(v) => set({ effective: v })} min={today} error={errEff} />
      </PeSection>
      <MgmtNote p={p} v={d.note} set={(v) => set({ note: v })} />
      <Footer t={t} onClose={onClose} onSave={save} busy={busy} label={p.mgmt ? t('common.saveChanges') : t('common.submitReview')} />
    </>
  );
}

// ---------- consent ----------
function ConsentForm({ p, onClose }: { p: P; onClose: () => void }) {
  const { m, t } = p;
  const data = consentOf(m, 'data');
  const face = consentOf(m, 'face');
  const [d, set] = useDraft(() => ({ data: data?.granted !== false, face: face?.granted !== false, via: 'staff' as 'staff' | 'paper', note: '' }));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const input: Record<string, unknown> = { memberId: m.id, via: d.via };
    if (d.data && !data?.granted) input.data = true;
    if (d.face !== (face ? face.granted : true)) input.face = d.face;
    if (input.data === undefined && input.face === undefined) { say(t('err.noChanges')); return; }
    if (d.note.trim()) input.note = d.note.trim();
    setBusy(true);
    const r = await p.act('members.setConsent', input, { ok: t('profile.savedConsent', { n: memberName(m) }), reviewText: t('profile.sentForReview') });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <>
      <GateNote p={p} />
      <PeSection label={t('profile.consentTitle')}>
        <Toggle on={d.data} disabled={data?.granted === true} onClick={() => set({ data: !d.data })} label={t('profile.consent.data')} sub={data?.granted ? t('profile.consentDataLocked') : t('profile.consentSub.data')} />
        <Toggle on={d.face} onClick={() => set({ face: !d.face })} label={t('profile.consent.face')} sub={t('profile.consentSub.face')} />
        <ChipGroup label={t('profile.consentHow')} value={d.via} onChange={(v) => set({ via: v as 'staff' | 'paper' })} options={[{ value: 'staff', label: t('profile.cvia_staff') }, { value: 'paper', label: t('profile.cvia_paper') }]} />
      </PeSection>
      <MgmtNote p={p} v={d.note} set={(v) => set({ note: v })} />
      <Footer t={t} onClose={onClose} onSave={save} busy={busy} label={p.mgmt ? t('common.saveChanges') : t('common.submitReview')} />
    </>
  );
}

// ---------- family contact (add, link an existing one, edit, remove) ----------
function ContactForm({ p, familyId, onClose }: { p: P; familyId?: string; onClose: () => void }) {
  const { s, m, t } = p;
  const link = familyId ? linksOfMember(s, m.id).find((l) => l.familyId === familyId) : undefined;
  const c = familyId ? s.familyContacts[familyId] : undefined;
  const linked = new Set(linksOfMember(s, m.id).map((l) => l.familyId));
  const others = sortBy(live(s.familyContacts).filter((x) => !linked.has(x.id) && !isPendingRow(x)), (x) => x.name);
  const [d, set] = useDraft(() => ({
    mode: 'new' as 'new' | 'existing', existingId: '', name: c?.name || '', phone: c ? fmtPhone(c.phone) : '', rel: (link?.relation || 'daughter') as Relation,
    primary: link ? link.primary : contactsOfMember(s, m.id).length === 0, appAccess: link ? link.appAccess : true, note: '',
  }));
  const [step, setStep] = useState<'form' | 'remove'>('form');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const edit = !!c && !!link;
  const phone = d.phone.trim() ? e164(d.phone) : '';
  const errName = tried && d.mode === 'new' && d.name.trim().length < 2 ? t('members.err.contactRequired') : '';
  const errPhone = tried && d.mode === 'new' ? (!d.phone.trim() ? t('members.err.phoneRequired') : !isPhone(phone) ? t('members.err.phoneInvalid') : '') : '';
  const errExisting = tried && d.mode === 'existing' && !d.existingId ? t('members.err.contactRequired') : '';
  const only = contactsOfMember(s, m.id).length <= 1;
  const save = async () => {
    setTried(true);
    if (busy) return;
    if (!edit) {
      if (errName || errPhone || errExisting || (d.mode === 'new' && (d.name.trim().length < 2 || !isPhone(phone))) || (d.mode === 'existing' && !d.existingId)) return;
      setBusy(true);
      const base = { memberId: m.id, relation: d.rel, primary: d.primary, appAccess: d.appAccess, ...(d.note.trim() ? { note: d.note.trim() } : {}) };
      const r = d.mode === 'new'
        ? await p.act('family.addContact', { ...base, name: d.name.trim(), phone }, { ok: t('profile.contactAdded', { n: d.name.trim() }), reviewText: t('profile.sentForReview') })
        : await p.act('family.linkContact', { ...base, familyId: d.existingId }, { ok: t('profile.contactLinked', { n: s.familyContacts[d.existingId]?.name || '' }), reviewText: t('profile.sentForReview') });
      setBusy(false);
      if (r.ok) onClose();
      return;
    }
    if (errName || d.name.trim().length < 2 || !isPhone(phone)) { setTried(true); return; }
    setBusy(true);
    let ok = true, any = false, gated = false;
    const run = async (name: string, input: Record<string, unknown>) => { if (!ok) return; const r = await p.act(name, { familyId, memberId: m.id, ...input, ...(d.note.trim() ? { note: d.note.trim() } : {}) }, { silent: true }); if (!r.ok) ok = false; else { any = true; if (r.reviewed === 'gate') gated = true; } };
    if (d.rel !== link!.relation) await run('family.updateContact', { relation: d.rel });
    const body: Record<string, unknown> = {};
    if (d.name.trim() !== c!.name) body.name = d.name.trim();
    if (phone !== c!.phone) body.phone = phone;
    if (Object.keys(body).length) await run('family.updateContact', body);
    if (d.primary && !link!.primary) await run('family.setPrimary', {});
    if (d.appAccess !== link!.appAccess) await run('family.setAppAccess', { appAccess: d.appAccess });
    setBusy(false);
    if (!ok) return;
    if (!any) { say(t('err.noChanges')); return; }
    say(gated ? t('common.reviewNote') : t('profile.contactSaved', { n: d.name.trim() }), gated ? { icon: 'hourglass_top' } : undefined);
    onClose();
  };
  const remove = async () => {
    setBusy(true);
    const r = await p.act('family.unlinkContact', { memberId: m.id, familyId, ...(d.note.trim() ? { note: d.note.trim() } : {}) }, { ok: t('profile.contactRemoved', { n: c?.name || '' }), reviewText: t('profile.sentForReview') });
    setBusy(false);
    if (r.ok) onClose();
  };
  if (step === 'remove' && c) {
    return (
      <>
        <Note tone="rust" icon="person_remove">{t('profile.removeContactSub', { n: c.name, m: memberName(m) })}</Note>
        <MgmtNote p={p} v={d.note} set={(v) => set({ note: v })} />
        <Footer t={t} onClose={() => setStep('form')} onSave={remove} busy={busy} danger label={t('profile.removeContact')} />
      </>
    );
  }
  return (
    <>
      <GateNote p={p} />
      <PeSection label={t('profile.sec.contact')}>
        {!edit && others.length ? (
          <ChipGroup label={t('members.contactMode')} value={d.mode} onChange={(v) => set({ mode: v as 'new' | 'existing' })} options={[{ value: 'new', label: t('members.newContact') }, { value: 'existing', label: t('members.existingContact') }]} />
        ) : null}
        {d.mode === 'existing' && !edit ? (
          <SelectField label={t('members.pickContact')} value={d.existingId} onChange={(v) => set({ existingId: v })} placeholder={t('members.pickContactPh')} error={errExisting} options={others.map((x) => ({ value: x.id, label: `${x.name} · ${fmtPhone(x.phone)}` }))} />
        ) : (
          <>
            <TextField label={t('common.name')} value={d.name} onChange={(v) => set({ name: v })} error={errName} name="contact" />
            <TextField label={t('common.phone')} value={d.phone} onChange={(v) => set({ phone: v })} inputMode="tel" placeholder="+62" error={errPhone} name="phone" />
          </>
        )}
        <RelationChips value={d.rel} onChange={(v) => set({ rel: v })} t={t} />
        <Toggle on={d.primary} disabled={edit && link!.primary} onClick={() => set({ primary: !d.primary })} label={t('profile.primaryBilling')} sub={edit && link!.primary ? t('profile.primaryAlready') : undefined} />
        <Toggle on={d.appAccess} onClick={() => set({ appAccess: !d.appAccess })} label={t('profile.appAccess')} />
      </PeSection>
      <MgmtNote p={p} v={d.note} set={(v) => set({ note: v })} />
      {edit ? (
        <div>
          <Button variant="ghost" size={44} icon="person_remove" disabled={only} onClick={() => setStep('remove')} style={{ color: '#9A3D24' }}>{t('profile.removeContact')}</Button>
          {only ? <div style={{ fontSize: 14, color: '#5E5852', marginTop: 4 }}>{t('members.err.lastContact')}</div> : null}
        </div>
      ) : null}
      <Footer t={t} onClose={onClose} onSave={save} busy={busy} label={edit ? (p.mgmt ? t('common.saveChanges') : t('common.submitReview')) : t('profile.addContactBtn')} />
    </>
  );
}

// ---------- end membership ----------
function EndForm({ p, onClose }: { p: P; onClose: () => void }) {
  const { s, m, t, fmt, today, nowMin } = p;
  const monthEnd = (month: string) => { const od = openDaysInMonth(s, month); return od[od.length - 1]; };
  const [d, set] = useDraft(() => ({ reason: null as EndReason | null, last: isOpen(s, today) ? today : nextOpenDay(s, today), note: '' }));
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const quick = Array.from(new Set([isOpen(s, today) ? today : '', monthEnd(ym(today)), monthEnd(addMonths(ym(today), 1))].filter((x) => x && x >= today)));
  const preview = useMemo(() => {
    if (!d.last || !d.reason) return null;
    try {
      const r = execute(s, 'members.end', { memberId: m.id, lastDay: d.last, reason: d.reason }, p.me, { today, nowMin }, 'preview');
      return { ok: true as const, inv: r.result.finalInvoice as { number: string; total: number } | undefined };
    } catch (e) { const x = e as { code?: string; params?: Record<string, string | number> }; return { ok: false as const, code: x.code || 'err.invalid', params: x.params || {} }; }
  }, [s, m.id, d.last, d.reason, p.me, today, nowMin]);
  const errLast = d.last && !isOpen(s, d.last) ? t('err.closedDay') : d.last && d.last < today ? t('members.err.lastDayPast') : preview && !preview.ok && preview.code !== 'members.err.reasonRequired' ? t(preview.code, preview.params) : '';
  const balance = openBalance(s, m.id, today);
  const save = async () => {
    setTried(true);
    if (!d.reason || errLast || busy) return;
    setBusy(true);
    const r = await p.act('members.end', { memberId: m.id, lastDay: d.last, reason: d.reason, ...(d.note.trim() ? { note: d.note.trim() } : {}) }, { ok: t('profile.ended', { n: memberName(m), d: fmt.fdy(d.last) }) });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <>
      <Note icon="info">{t('profile.endNote')}</Note>
      <PeSection label={t('common.reason')}>
        <ChipGroup label={<span className="sr-only">{t('common.reason')}</span>} value={d.reason} onChange={(v) => set({ reason: v as EndReason })} options={END_REASONS.map((r) => ({ value: r, label: endReasonLabel(t, r) }))} />
        {tried && !d.reason ? <Note tone="rust" icon="error">{t('members.err.reasonRequired')}</Note> : null}
      </PeSection>
      <PeSection label={t('profile.lastClubDay')}>
        <ChipGroup label={<span className="sr-only">{t('profile.lastClubDay')}</span>} value={d.last} onChange={(v) => set({ last: v as string })} options={quick.map((x) => ({ value: x, label: x === today ? t('common.today') : fmt.fds(x) }))} />
        <DateField label={t('profile.otherDate')} value={d.last} onChange={(v) => set({ last: v })} min={today} disabledDate={(x) => !isOpen(s, x)} error={errLast} />
        <TextField label={t('profile.endNoteLabel')} value={d.note} onChange={(v) => set({ note: v })} multiline rows={2} />
      </PeSection>
      {preview?.ok ? (
        <Note tone="cream" icon="receipt_long">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>{preview.inv ? t('profile.endFinal', { a: rp(preview.inv.total) }) : t('profile.endNoFinal')}</span>
            {balance > 0 ? <span>{t('profile.endOpen', { a: rp(balance) })}</span> : null}
            <span>{t('profile.endLobby', { d: fmt.fdy(d.last) })}</span>
          </div>
        </Note>
      ) : null}
      <Footer t={t} onClose={onClose} onSave={save} busy={busy} danger label={t('profile.endMembership')} />
    </>
  );
}

// ---------- reactivate ----------
function ReactivateForm({ p, onClose }: { p: P; onClose: () => void }) {
  const { s, m, t, fmt, today } = p;
  const [start, setStart] = useState(isOpen(s, today) ? today : nextOpenDay(s, today));
  const [busy, setBusy] = useState(false);
  const err = !isOpen(s, start) ? t('err.closedDay') : start < today ? t('members.err.startInvalid') : '';
  const save = async () => {
    if (err || busy) return;
    setBusy(true);
    const r = await p.act('members.reactivate', { memberId: m.id, start }, { ok: t('profile.reactivated', { n: memberName(m), d: fmt.fdy(start) }) });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <>
      <PeSection label={t('profile.f.start')}>
        <DateField label={t('profile.f.start')} value={start} onChange={setStart} min={today} disabledDate={(x) => !isOpen(s, x)} error={err} />
      </PeSection>
      <Footer t={t} onClose={onClose} onSave={save} busy={busy} label={t('profile.reactivate')} />
    </>
  );
}
