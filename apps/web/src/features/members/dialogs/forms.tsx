// Form building blocks for the member dialogs (design OvPe): sections, selects, the medicines list, allergy chips, and the field groups
// that the add dialog and the edit dialogs share.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { DIETS, FOODS, MED_TIMINGS, MOBILITIES, RELATIONS, TITLES } from '@cp/shared/rules/members';
import type { Diet, DrugAllergy, FoodAllergen, KtpKind, KtpUploads, MedTiming, MemberRegistration, Mobility, Relation, Title } from '@cp/shared';
import { KtpField, type PaperFile } from '../PaperForm';
import { MARITALS, REG_IDS, cleanRegistration, type Marital } from '@cp/shared/rules/applicationForm';
import { Button, Chip, ChipGroup, FONT_BODY, GROUP_HEAD, Icon, IconButton, Select, TimeField, Toggle } from '../../../components/ui';
import type { TFn } from '../../../lib/i18n';
import { dietLabel, foodLabel, mobLabel, relLabel, timingLabel } from '../lib';

/**
 * Same field as the shared TextField (round 8c input: 52px, grey var(--fill, #F4F4F5) fill, radius 12, no border) with one fix: the shared primitive gives a
 * single-line input `flex: 1` inside a column label, which collapses it to its text height (22px). Here it keeps its 52px.
 */
export function TextField({ label, value, onChange, placeholder, inputMode, type = 'text', error, hint, multiline, rows = 3, autoFocus, name, maxLength }: {
  label?: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: 'text' | 'tel' | 'numeric' | 'decimal' | 'email' | 'search'; type?: string;
  error?: string | false; hint?: ReactNode; multiline?: boolean; rows?: number; autoFocus?: boolean; name?: string; maxLength?: number;
}) {
  const common: CSSProperties = { border: 'none', borderRadius: 12, background: 'var(--fill, #F4F4F5)', boxShadow: error ? 'inset 0 0 0 2px #9A3D24' : undefined, padding: multiline ? '12px 14px' : '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', width: '100%', minWidth: 0 };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {label ? <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: '#4A4038' }}>{label}</span> : null}
      {multiline ? (
        <textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} autoFocus={autoFocus} maxLength={maxLength} aria-invalid={!!error || undefined} className="cp-input cp-fill" style={{ ...common, resize: 'vertical', lineHeight: '22px' }} />
      ) : (
        <input name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} autoFocus={autoFocus} maxLength={maxLength} aria-invalid={!!error || undefined} className="cp-input cp-fill" style={{ ...common, height: 'var(--cp-field-h, 52px)', flex: 'none' }} />
      )}
      {error ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#9A3D24', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{error}</span> : hint ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{hint}</span> : null}
    </label>
  );
}

/** The overlay primitive is a flex column that lets children shrink when the content is taller than the dialog (inputs get squashed). One wrapper that never shrinks keeps every control at its full height; the dialog scrolls instead. */
export const DialogBody = ({ children }: { children: ReactNode }) => <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flexShrink: 0 }}>{children}</div>;

export const PeSection = ({ label, children, hint, native }: { label: ReactNode; children: ReactNode; hint?: ReactNode; /** round 6, phone: an iOS grouped section (small grey header over a flat white group), for a form on a PhoneScreen */ native?: boolean }) => native ? (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }} data-pe-section>
    <div style={{ ...GROUP_HEAD, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', whiteSpace: 'normal', overflow: 'visible' }}>{label}</div>
    <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {hint ? <div style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{hint}</div> : null}
      {children}
    </div>
  </section>
) : (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 22, borderTop: '0.5px solid var(--hairline, #E2E2E6)' }} data-pe-section>
    <div style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: 'var(--eyebrow, #6E5A43)', lineHeight: '18px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{label}</div>
    {hint ? <div style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4, marginTop: -8 }}>{hint}</div> : null}
    {children}
  </div>
);

/** The kit's custom dropdown. A `placeholder` doubles as the "none" choice at the top of the list, so a chosen value can be cleared again. */
export function SelectField({ label, value, onChange, options, error, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; error?: string | false; placeholder?: string }) {
  return <Select<string> label={label} value={value} onChange={onChange} placeholder={placeholder} error={error} options={placeholder ? [{ value: '', label: placeholder }, ...options] : options} />;
}
/** An optional time of day: the kit's TimeField plus a "Clear" link once a time is chosen. */
export function OptionalTime({ label, value, onChange, min, max, error, hint, t }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string; error?: string | false; hint?: string; t: TFn }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'stretch' }}>
      <TimeField label={label} value={value} onChange={onChange} min={min} max={max} error={error} hint={hint} />
      {value ? <button type="button" onClick={() => onChange('')} className="h-cream" style={{ alignSelf: 'flex-start', height: 44, padding: '0 14px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--accent, #75624B)', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'Inter' }}>{t('common.clear')}</button> : null}
    </div>
  );
}

// ---------- medicines ----------
export interface MedRow { key: string; id?: string; name: string; dose: string; timing: MedTiming }
let medSeq = 0;
export const newMed = (): MedRow => ({ key: `new${++medSeq}`, name: '', dose: '', timing: 'asPrescribed' });
export function MedsEditor({ rows, onChange, t, showErrors }: { rows: MedRow[]; onChange: (r: MedRow[]) => void; t: TFn; showErrors?: boolean }) {
  const set = (i: number, patch: Partial<MedRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r, i) => (
        <div key={r.key} role="group" aria-label={t('profile.medN', { n: i + 1 })} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 0 14px', borderBottom: '0.5px solid var(--hairline, #E2E2E6)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 2, minWidth: 0 }}><TextField label={t('profile.medName')} value={r.name} onChange={(v) => set(i, { name: v })} error={showErrors && !r.name.trim() ? t('members.err.medNameRequired') : false} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><TextField label={t('profile.medDose')} value={r.dose} onChange={(v) => set(i, { dose: v })} placeholder="5 mg" /></div>
            <IconButton icon="close" label={t('profile.removeMed')} bordered={false} onClick={() => onChange(rows.filter((_, j) => j !== i))} />
          </div>
          <ChipGroup label={t('profile.medTiming')} value={r.timing} onChange={(v) => set(i, { timing: v as MedTiming })} options={MED_TIMINGS.map((x) => ({ value: x, label: timingLabel(t, x) }))} />
        </div>
      ))}
      <div><Button variant="secondary" size={44} icon="add" onClick={() => onChange([...rows, newMed()])}>{t('profile.addMed')}</Button></div>
    </div>
  );
}

// ---------- field groups ----------
export function TitleName({ d, set, t, errors }: { d: { title: Title; name: string }; set: (p: { title?: Title; name?: string }) => void; t: TFn; errors: Record<string, string> }) {
  return (
    <>
      <ChipGroup label={t('profile.f.title')} value={d.title} onChange={(v) => set({ title: v as Title })} options={TITLES.map((x) => ({ value: x, label: x }))} />
      <TextField label={t('profile.nameLabel')} value={d.name} onChange={(v) => set({ name: v })} error={errors.name} name="name" />
    </>
  );
}
export function RelationChips({ value, onChange, t }: { value: Relation; onChange: (v: Relation) => void; t: TFn }) {
  return <ChipGroup label={t('profile.f.relation')} value={value} onChange={(v) => onChange(v as Relation)} options={RELATIONS.map((x) => ({ value: x, label: relLabel(t, x) }))} />;
}

export interface AllergyDraft { food: FoodAllergen[]; foodOther: string; drug: string[]; drugOther: string }
export const splitDrugs = (drugs: DrugAllergy[]) => ({ drug: drugs.filter((x) => !x.startsWith('other:')) as string[], drugOther: drugs.filter((x) => x.startsWith('other:')).map((x) => x.slice(6)).join(', ') });
export const joinDrugs = (d: Pick<AllergyDraft, 'drug' | 'drugOther'>): DrugAllergy[] => [...d.drug, ...d.drugOther.split(',').map((x) => x.trim()).filter(Boolean).map((x) => `other:${x}`)] as DrugAllergy[];
export function AllergyFields({ d, set, t }: { d: AllergyDraft; set: (p: Partial<AllergyDraft>) => void; t: TFn }) {
  const drugs = ['penicillin', 'sulfa', 'aspirin', 'ibuprofen'];
  return (
    <>
      <ChipGroup label={t('profile.allergyFoodKitchen')} multi value={d.food} onChange={(v) => set({ food: v as FoodAllergen[] })} options={FOODS.map((x) => ({ value: x, label: foodLabel(t, x) }))} />
      <TextField label={t('profile.foodOther')} value={d.foodOther} onChange={(v) => set({ foodOther: v })} placeholder={t('profile.otherPh')} />
      <ChipGroup label={t('profile.allergyDrugRecord')} multi value={d.drug} onChange={(v) => set({ drug: v as string[] })} options={drugs.map((x) => ({ value: x, label: t('profile.drug.' + x) }))} />
      <TextField label={t('profile.drugOther')} value={d.drugOther} onChange={(v) => set({ drugOther: v })} placeholder={t('profile.otherPh')} hint={t('profile.commaHint')} />
    </>
  );
}
/** Conditions as a list: one row each, so a condition that contains a comma ("Hard of hearing, left ear") is never split. */
export function ConditionsEditor({ value, onChange, t }: { value: string[]; onChange: (v: string[]) => void; t: TFn }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const x = draft.trim();
    if (x && !value.includes(x)) onChange([...value, x]);
    setDraft('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="group" aria-label={t('profile.f.conditions')}>
      <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: '#4A4038' }}>{t('profile.f.conditions')}</span>
      {value.map((c, i) => (
        <div key={c + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '0.5px solid var(--hairline, #E2E2E6)' }}>
          <Icon name="clinical_notes" size={20} color="var(--accent, #75624B)" />
          <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: 1.4 }}>{c}</span>
          <IconButton icon="close" bordered={false} label={t('profile.removeCondition', { c })} onClick={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={add} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={t('profile.conditionsPh')} aria-label={t('profile.addCondition')} className="cp-input cp-fill"
          style={{ flex: 1, minWidth: 0, height: 52, border: 'none', borderRadius: 12, background: 'var(--fill, #F4F4F5)', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C' }} />
        <button type="button" onClick={add} className="h-fill cp-fill" style={{ height: 52, padding: '0 18px', borderRadius: 12, border: 'none', background: 'var(--fill, #F4F4F5)', color: '#24201C', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('common.add')}</button>
      </div>
    </div>
  );
}
export interface HealthDraft { conditions: string[]; diabetic: boolean; mobility: Mobility | 'none'; diet: Diet[] }
/**
 * Conditions, the Diabetic toggle, mobility and diet. KC round 10: on a REGISTRATION (Add member, Join, the online form) `instead` replaces the Diabetic
 * toggle — diabetes changes nothing at registration, dementia changes the monthly fee, so the dementia pair (DementiaFields) sits there; the nurse keeps the
 * Diabetic toggle on the profile's health edit.
 */
export function HealthFields({ d, set, t, instead }: { d: HealthDraft; set: (p: Partial<HealthDraft>) => void; t: TFn; instead?: ReactNode }) {
  return (
    <>
      <ConditionsEditor value={d.conditions} onChange={(v) => set({ conditions: v })} t={t} />
      {instead !== undefined ? instead : <Toggle on={d.diabetic} onClick={() => set({ diabetic: !d.diabetic })} label={t('profile.diabetic')} />}
      <ChipGroup label={t('profile.f.mobility')} value={d.mobility} onChange={(v) => set({ mobility: v as Mobility | 'none' })} options={[{ value: 'none' as const, label: mobLabel(t, null) }, ...MOBILITIES.map((x) => ({ value: x as Mobility | 'none', label: mobLabel(t, x) }))]} />
      <ChipGroup label={t('profile.f.diet')} multi value={d.diet} onChange={(v) => set({ diet: v as Diet[] })} options={DIETS.map((x) => ({ value: x, label: dietLabel(t, x) }))} />
    </>
  );
}

/** Two-way chips for "yes / no" questions. */
export function YesNo({ label, value, onChange, t }: { label: ReactNode; value: boolean; onChange: (v: boolean) => void; t: TFn }) {
  return <ChipGroup label={label} value={value} onChange={(v) => onChange(v as boolean)} options={[{ value: true, label: t('common.yes') }, { value: false, label: t('common.no') }]} />;
}
export function useDraft<T extends object>(init: () => T) {
  const [d, setD] = useState<T>(init);
  return [d, (p: Partial<T>) => setD((x) => ({ ...x, ...p }))] as const;
}

// ---------- the paper application form's extra answers (Panggilan, status, RT/RW, phones, the care questions, the IDs received) ----------
export type YN = boolean | null;
export type RegId = (typeof REG_IDS)[number];
export interface RegDraft { nickname: string; nik: string; guarantorNik: string; marital: Marital | ''; rtRw: string; city: string; postcode: string; phone: string; mobile: string; email: string; comm: YN; self: YN; bath: YN; dementia: YN; dementiaNote: string; ids: RegId[] }
export const regDraftOf = (r?: MemberRegistration): RegDraft => ({
  nickname: r?.nickname || '', nik: r?.nik || '', guarantorNik: r?.guarantorNik || '', marital: r?.marital || '', rtRw: r?.rtRw || '', city: r?.city || '', postcode: r?.postcode || '', phone: r?.phone || '', mobile: r?.mobile || '', email: r?.email || '',
  comm: r?.commDifficulty ?? null, self: r?.selfCare ?? null, bath: r?.bathroomHelp ?? null, dementia: r?.dementia ?? null, dementiaNote: r?.dementiaNote || '', ids: REG_IDS.filter((k) => r?.ids?.[k]),
});
/**
 * The draft as the answers that are saved (empty ones left out; undefined when nothing is filled in). KC round 10: the carer's ID is not ticked by hand any
 * more — `carer` (the member comes with a carer, whose NIK the carer fields hold) marks it; a NIK is kept only while its ID is ticked.
 */
export const regOfDraft = (d: RegDraft, carer = false): MemberRegistration | undefined => cleanRegistration({
  nickname: d.nickname, nik: d.ids.includes('member') ? d.nik : '', guarantorNik: d.ids.includes('guarantor') ? d.guarantorNik : '', marital: d.marital, rtRw: d.rtRw, city: d.city, postcode: d.postcode, phone: d.phone, mobile: d.mobile, email: d.email,
  commDifficulty: d.comm ?? undefined, selfCare: d.self ?? undefined, bathroomHelp: d.bath ?? undefined, dementia: d.dementia ?? undefined, dementiaNote: d.dementia ? d.dementiaNote : '',
  ids: { ...Object.fromEntries(d.ids.filter((k) => k !== 'carer').map((k) => [k, true])), ...(carer ? { carer: true } : {}) },
});
type RegSet = (p: Partial<RegDraft>) => void;
/** Called (Panggilan, what everyone calls them), status, RT/RW, city, postcode, phones, email. `err(...fields)` gives the message for a field that has one. */
export function RegPersonalFields({ d, set, t, err }: { d: RegDraft; set: RegSet; t: TFn; err: (...f: string[]) => string }) {
  return (
    <>
      <TextField label={t('profile.f.called')} value={d.nickname} onChange={(v) => set({ nickname: v })} name="nickname" maxLength={40} />
      <ChipGroup label={t('profile.f.marital')} value={d.marital || null} onChange={(v) => set({ marital: v === d.marital ? '' : (v as Marital) })} options={MARITALS.map((x) => ({ value: x, label: t('profile.marital.' + x) }))} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
        <TextField label={t('profile.f.rtRw')} value={d.rtRw} onChange={(v) => set({ rtRw: v })} name="rtRw" placeholder="004/002" error={err('rtRw')} maxLength={12} />
        <TextField label={t('profile.f.postcode')} value={d.postcode} onChange={(v) => set({ postcode: v })} name="postcode" inputMode="numeric" error={err('postcode')} maxLength={10} />
      </div>
      <TextField label={t('profile.f.city')} value={d.city} onChange={(v) => set({ city: v })} name="city" maxLength={60} />
      <TextField label={t('profile.f.memberMobile')} value={d.mobile} onChange={(v) => set({ mobile: v })} name="mobile" inputMode="tel" placeholder="+62" error={err('regMobile')} />
      <TextField label={t('profile.f.homePhone')} value={d.phone} onChange={(v) => set({ phone: v })} name="homePhone" inputMode="tel" placeholder="+62 21" error={err('regPhone')} />
      <TextField label={t('profile.f.email')} value={d.email} onChange={(v) => set({ email: v })} name="email" type="email" inputMode="email" error={err('email')} maxLength={100} />
    </>
  );
}
/** Yes / no, and still unanswered until one is tapped (tap the chosen one again to clear it). */
function YesNoOpen({ label, value, onChange, t }: { label: string; value: YN; onChange: (v: YN) => void; t: TFn }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
        {([true, false] as const).map((v) => <Chip key={String(v)} size={36} selected={value === v} onClick={() => onChange(value === v ? null : v)}>{v ? t('common.yes') : t('common.no')}</Chip>)}
      </div>
    </div>
  );
}
/** KC round 10: dementia as a yes / no (it affects the monthly fee), with an optional note once it is yes. */
export function DementiaFields({ d, set, t }: { d: RegDraft; set: RegSet; t: TFn }) {
  return (
    <>
      <YesNoOpen label={t('profile.q.dementia')} value={d.dementia} onChange={(v) => set({ dementia: v, ...(v ? {} : { dementiaNote: '' }) })} t={t} />
      {d.dementia ? <TextField label={t('profile.f.dementiaNote')} value={d.dementiaNote} onChange={(v) => set({ dementiaNote: v })} multiline rows={2} name="dementiaNote" maxLength={300} /> : null}
    </>
  );
}
/**
 * KC round 10: the IDs — tick the responsible family member's and the member's; each tick opens that person's NIK (16 digits). The carer's ID is not a tick
 * any more: it follows the carer fields (a carer always comes with a NIK). `label` names the block ("IDs received" at the club, just "ID" on the family's form).
 */
/** KC round 10: the photos of the ID cards a form collects, by kind, and how they are uploaded (the family's form has its own route). */
export interface KtpProps { ktp?: KtpUploads; setKtp?: (kind: KtpKind, f: PaperFile | null) => void; uploader?: (blob: Blob, name: string) => Promise<PaperFile> }
export function IdFields({ d, set, t, err, label, ktp, setKtp, uploader }: { d: RegDraft; set: RegSet; t: TFn; err: (...f: string[]) => string; label?: string } & KtpProps) {
  const ticked = d.ids.filter((k) => k !== 'carer');
  const nikField = (k: 'nik' | 'guarantorNik', lab: string) => <TextField label={lab} value={d[k]} onChange={(v) => set({ [k]: v.replace(/[^\d\s]/g, '') } as Partial<RegDraft>)} name={k} inputMode="numeric" placeholder={t('profile.nikPh')} error={err(k)} maxLength={16} />;
  const photo = (kind: KtpKind, who: string) => (setKtp ? <KtpField label={t('profile.ktpPhotoOf', { who })} value={ktp?.[kind] ?? null} onChange={(f) => setKtp(kind, f)} name={kind === 'ktp' ? 'ktp' : kind === 'guarantorKtp' ? 'ktp-family' : 'ktp-carer'} uploader={uploader} /> : null);
  return (
    <>
      <ChipGroup label={label ?? t('profile.f.idsReceived')} multi value={ticked} onChange={(v) => set({ ids: v as RegId[] })} options={REG_IDS.filter((x) => x !== 'carer').map((x) => ({ value: x, label: t('profile.ids.' + x) }))} />
      {ticked.includes('guarantor') ? <>{nikField('guarantorNik', t('profile.f.guarantorNik'))}{photo('guarantorKtp', t('profile.ids.guarantor'))}</> : null}
      {ticked.includes('member') ? <>{nikField('nik', t('profile.f.nik'))}{photo('ktp', t('profile.ids.member'))}</> : null}
    </>
  );
}
/** The three care questions and the IDs; `dementia` (default on) adds the dementia pair here — a registration shows it under Health instead. `ids={false}` leaves the IDs out (round 12: the stepped registration asks for each ID with its person). */
export function RegCareFields({ d, set, t, err, dementia = true, ids = true, idsLabel, ...ktp }: { d: RegDraft; set: RegSet; t: TFn; err?: (...f: string[]) => string; dementia?: boolean; ids?: boolean; idsLabel?: string } & KtpProps) {
  return (
    <>
      <YesNoOpen label={t('profile.q.comm')} value={d.comm} onChange={(v) => set({ comm: v })} t={t} />
      <YesNoOpen label={t('profile.q.self')} value={d.self} onChange={(v) => set({ self: v })} t={t} />
      <YesNoOpen label={t('profile.q.bath')} value={d.bath} onChange={(v) => set({ bath: v })} t={t} />
      {dementia ? <DementiaFields d={d} set={set} t={t} /> : null}
      {ids ? <IdFields d={d} set={set} t={t} err={err ?? (() => '')} label={idsLabel} {...ktp} /> : null}
    </>
  );
}

// ---------- KC round 10: the carer (suster) ----------
export interface CarerDraft { nanny: boolean; nannyName: string; nannyNik: string }
/** Comes with a carer? Then the carer's name and NIK (16 digits), both required; `phone` adds the optional mobile (the member dialogs keep it). */
export function CarerFields({ d, set, t, tried, phone, ktp, setKtp, uploader }: { d: CarerDraft; set: (p: Partial<CarerDraft>) => void; t: TFn; tried: boolean; phone?: ReactNode } & KtpProps) {
  const errName = tried && d.nanny && !d.nannyName.trim() ? t('members.err.nannyNameRequired') : '';
  const errNik = tried && d.nanny && !/^\d{16}$/.test(d.nannyNik.replace(/\s/g, '')) ? t('members.err.nannyNikRequired') : '';
  return (
    <>
      <YesNo label={t('profile.comesWithNanny')} value={d.nanny} onChange={(v) => set({ nanny: v })} t={t} />
      {d.nanny ? (
        <>
          <TextField label={t('profile.nannyName')} value={d.nannyName} onChange={(v) => set({ nannyName: v })} error={errName} name="nannyName" />
          <TextField label={t('profile.nannyNik')} value={d.nannyNik} onChange={(v) => set({ nannyNik: v.replace(/[^\d\s]/g, '') })} inputMode="numeric" placeholder={t('profile.nikPh')} error={errNik} name="nannyNik" maxLength={16} />
          {setKtp ? <KtpField label={t('profile.ktpPhotoOf', { who: t('profile.ids.carer') })} value={ktp?.nannyKtp ?? null} onChange={(f) => setKtp('nannyKtp', f)} name="ktp-carer" uploader={uploader} /> : null}
          {phone}
        </>
      ) : null}
    </>
  );
}
/** The carer as it is saved: null without one; the NIK with no spaces. */
export const carerOf = (d: CarerDraft) => (d.nanny ? { name: d.nannyName.trim(), nik: d.nannyNik.replace(/\s/g, '') } : null);
export const carerOk = (d: CarerDraft) => !d.nanny || (!!d.nannyName.trim() && /^\d{16}$/.test(d.nannyNik.replace(/\s/g, '')));

/** The uploaded ID cards that count for a registration: the member's and the family member's only while their ID is ticked, the carer's only with a carer. */
export const ktpFor = (ktp: KtpUploads, ids: RegId[], carer: boolean): KtpUploads | undefined => {
  const out: KtpUploads = {};
  if (ktp.ktp && ids.includes('member')) out.ktp = ktp.ktp;
  if (ktp.guarantorKtp && ids.includes('guarantor')) out.guarantorKtp = ktp.guarantorKtp;
  if (ktp.nannyKtp && carer) out.nannyKtp = ktp.nannyKtp;
  return Object.keys(out).length ? out : undefined;
};
