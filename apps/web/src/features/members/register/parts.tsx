// KC round 12: pieces the six registration steps share — the props every step gets, the section, the two-line choice chip (moved here from the
// enquiry dialogs), one ID at a time (with its person), read-only rows, and the "already on file" warning.
import type { ReactNode } from 'react';
import { listName, type ClubState, type ISODate, type KtpKind } from '@cp/shared';
import { findDuplicates, type FieldIssue } from '@cp/shared/rules/members';
import { seniorName } from '@cp/shared/rules/enquiries';
import { FONT_SMALL, HAIRLINE, Note, Toggle } from '../../../components/ui';
import type { TFn } from '../../../lib/i18n';
import { KtpField, type PaperFile } from '../PaperForm';
import { PeSection, TextField, type RegDraft } from '../dialogs/forms';
import type { RegMode, RegState } from './steps';

export interface StepProps {
  st: RegState;
  set: (p: Partial<RegState>) => void;
  mode: RegMode;
  t: TFn;
  /** the message for the first of these fields that has an issue, once Next was tried on this step */
  err: (...fields: string[]) => string;
  tried: boolean;
  issues: FieldIssue[];
  s: ClubState;
  today: ISODate;
  /** phone: iOS grouped sections */
  native: boolean;
  /** leave the flow for another screen (the draft is kept) */
  leave: (path: string) => void;
}
/** The thin progress bar under the step heading (the staff flow on a phone, the family's online form): step `n` of `total`. */
export function StepBar({ n, total, label }: { n: number; total: number; label: string }) {
  return (
    <div data-progress={`${n}/${total}`} role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={total} aria-valuenow={n} style={{ height: 4, borderRadius: 2, background: 'var(--track, #E8E8EB)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `calc(${n}/${total}*100%)`, background: '#24201C', borderRadius: 2, transition: 'width .2s' }} />
    </div>
  );
}
export const Sec = ({ p, label, children }: { p: StepProps; label: ReactNode; children: ReactNode }) => <PeSection native={p.native} label={label}>{children}</PeSection>;
export const setRegOf = (p: StepProps) => (x: Partial<RegDraft>) => p.set({ reg: { ...p.st.reg, ...x } });
export const setKtpOf = (p: StepProps) => (kind: KtpKind, f: PaperFile | null) => p.set({ ktp: { ...p.st.ktp, [kind]: f ?? undefined } });

/** The design's two-line choice chip (label + small sub line). */
export function StackChip({ label, sub, selected, off, onClick }: { label: ReactNode; sub?: ReactNode; selected?: boolean; off?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={!!selected} aria-disabled={off || undefined} onClick={() => { if (!off) onClick(); }} className={selected ? undefined : 'cp-fill'}
      style={{ minHeight: 52, minWidth: 88, padding: '6px 14px', borderRadius: 14, border: 'none', background: selected ? '#24201C' : off ? 'var(--press, #EEEEF0)' : 'var(--fill, #F4F4F5)', color: selected ? '#FFFFFF' : off ? '#5E5852' : '#24201C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}>
      <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, whiteSpace: 'nowrap' }}>{label}</span>
      {sub ? <span style={{ fontSize: FONT_SMALL, lineHeight: 1.4 }}>{sub}</span> : null}
    </button>
  );
}
/** What the submit button of a Join says: management creates the member, everyone else sends it to management. */
export const joinLabel = (t: TFn, role: string | null, plan: string) => t(role === 'mgmt' ? 'enq.createMember' : 'enq.sendForApproval', { plan });

export function Rows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: i ? HAIRLINE : undefined, fontSize: 15, lineHeight: '22px' }}>
          <span style={{ color: '#6B6259', flex: 'none' }}>{k}</span>
          <span style={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

/** One person's ID: received? then the NIK (16 digits) and a photo of the card. The member's sits on Person, the family member's on Family. */
export function OneId({ p, who }: { p: StepProps; who: 'member' | 'guarantor' }) {
  const { st, t } = p;
  const on = st.reg.ids.includes(who);
  const k = who === 'member' ? 'nik' : 'guarantorNik';
  const kind: KtpKind = who === 'member' ? 'ktp' : 'guarantorKtp';
  const setReg = setRegOf(p);
  return (
    <>
      <Toggle on={on} onClick={() => setReg({ ids: on ? st.reg.ids.filter((x) => x !== who) : [...st.reg.ids, who] })} label={t(who === 'member' ? 'reg.idMember' : 'reg.idGuarantor')} />
      {on ? (
        <>
          <TextField label={t(who === 'member' ? 'profile.f.nik' : 'profile.f.guarantorNik')} value={st.reg[k]} onChange={(v) => setReg({ [k]: v.replace(/[^\d\s]/g, '') })} name={k} inputMode="numeric" placeholder={t('profile.nikPh')} error={p.err(k)} maxLength={16} />
          <KtpField label={t('profile.ktpPhotoOf', { who: t('profile.ids.' + who) })} value={st.ktp[kind] ?? null} onChange={(f) => setKtpOf(p)(kind, f)} name={kind === 'ktp' ? 'ktp' : 'ktp-family'} />
        </>
      ) : null}
    </>
  );
}

/** "Oma Lina already has this phone number": members and open leads with the same phone or NIK, each with a link to look. */
export function DupNote({ p, phone, nik }: { p: StepProps; phone?: string; nik?: string }) {
  const { s, t, mode } = p;
  const hit = findDuplicates(s, { phone, nik });
  const leads = hit.leads.filter((e) => !(mode.kind === 'lead' && e.id === mode.id));
  const nikOf = (n?: string) => !!nik && (n || '').replace(/\D/g, '') === nik.replace(/\D/g, '');
  const rows = [
    ...hit.members.map((m) => ({ key: m.id, name: listName(m), what: t(nikOf(m.registration?.nik) ? 'reg.what.nik' : 'reg.what.phone'), path: `/members/${m.id}` })),
    ...leads.map((e) => ({ key: e.id, name: seniorName(e), what: t('reg.what.phone'), path: '/enquiries' })),
  ];
  if (!rows.length) return null;
  return (
    <Note tone="ochre" icon="content_copy">
      <div data-testid="reg-duplicate" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.slice(0, 3).map((r) => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span>{t('reg.duplicate', { name: r.name, what: r.what })}</span>
            <button type="button" onClick={() => p.leave(r.path)} style={{ border: 'none', background: 'transparent', padding: 0, color: 'inherit', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', fontFamily: 'Inter', fontSize: 'inherit', flex: 'none' }}>{t('reg.open')}</button>
          </div>
        ))}
      </div>
    </Note>
  );
}
