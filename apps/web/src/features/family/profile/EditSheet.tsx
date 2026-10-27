// Round 8: the family edits a parent's personal and contact details (address, area, phones, email, nanny, usual arrival). Send calls
// family.updateDetails with only what changed; the club approves it first, so until then the current details stay. While a request waits, the
// profile shows a card with "Withdraw".
import { useState, type ReactNode } from 'react';
import { e164, fmtPhone, live, toHM, toMin, type ChangeRequest, type ClubState, type Member } from '@cp/shared';
import { Icon, TimeField } from '../../../components/ui';
import { useAct } from '../../../lib/act';
import { ProfilePhotoField } from '../../members/ProfilePhoto';
import type { TFn } from '../../../lib/i18n';
import { F, FamSheet, FillCard, Switch } from '../kit';

type Draft = { address: string; rtRw: string; city: string; postcode: string; phone: string; mobile: string; email: string; nanny: boolean; nannyName: string; nannyPhone: string; /** the carer's picture (a media id), '' = none; absent = as it is */ nannyPhoto?: string; usual: string };
type Patch = Record<string, unknown>;
const TEXT_KEYS = ['address', 'rtRw', 'city', 'postcode', 'phone', 'mobile', 'email'] as const;
const FIELD_LABEL: Record<string, string> = {
  address: 'profile.f.address', usualArrival: 'profile.f.usual', nanny: 'profile.f.nanny', nickname: 'profile.f.nickname', rtRw: 'profile.f.rtRw', city: 'profile.f.city',
  postcode: 'profile.f.postcode', phone: 'profile.f.homePhone', mobile: 'profile.f.memberMobile', email: 'profile.f.email',
};

/** The family's own waiting "details" requests for this parent. */
export const pendingDetails = (s: ClubState, memberId: string, userId: string): ChangeRequest[] =>
  live(s.changeRequests).filter((c) => c.status === 'pending' && c.section === 'details' && c.target.id === memberId && c.submittedBy === `family:${userId}`);
const patchOf = (cr: ChangeRequest): Patch => ((cr.input as { patch?: Patch } | undefined)?.patch) || {};

/** The draft a sheet opens with: the current details, with any change already waiting on top (so a second send keeps the first). */
function draftOf(m: Member, waiting: Patch): Draft {
  const reg = m.registration || {};
  const pick = (k: (typeof TEXT_KEYS)[number], cur: string) => (typeof waiting[k] === 'string' ? (waiting[k] as string) : cur);
  const wn = 'nanny' in waiting ? (waiting.nanny as Member['nanny']) : m.nanny;
  return {
    address: pick('address', m.address || ''), rtRw: pick('rtRw', reg.rtRw || ''), city: pick('city', reg.city || ''), postcode: pick('postcode', reg.postcode || ''),
    phone: pick('phone', reg.phone || ''), mobile: pick('mobile', reg.mobile || ''), email: pick('email', reg.email || ''),
    nanny: !!wn, nannyName: wn?.name || '', nannyPhone: wn?.phone ? fmtPhone(wn.phone) : '', nannyPhoto: wn?.photoMediaId || '',
    usual: typeof waiting.usualArrival === 'string' && waiting.usualArrival ? (waiting.usualArrival as string) : m.usualArrival || '',
  };
}

/** Only what differs from the current details. */
export function changesOf(m: Member, d: Draft): Patch {
  const reg = m.registration || {};
  const cur: Record<(typeof TEXT_KEYS)[number], string> = { address: m.address || '', rtRw: reg.rtRw || '', city: reg.city || '', postcode: reg.postcode || '', phone: reg.phone || '', mobile: reg.mobile || '', email: reg.email || '' };
  const patch: Patch = {};
  for (const k of TEXT_KEYS) if (d[k].trim() !== cur[k]) patch[k] = d[k].trim();
  if (d.usual && d.usual !== m.usualArrival) patch.usualArrival = d.usual;
  // the carer's note is the club's to edit and stays for the same person; the picture is what the sheet shows (a different person starts without the old note)
  const keep = (n: NonNullable<Member['nanny']> | null) => (n ? { ...(n.photoMediaId ? { photoMediaId: n.photoMediaId } : {}), ...(n.note ? { note: n.note } : {}) } : {});
  const same = !!m.nanny && m.nanny.name.trim().toLowerCase() === d.nannyName.trim().toLowerCase();
  const photo = d.nannyPhoto === undefined ? (same ? m.nanny?.photoMediaId : undefined) : d.nannyPhoto || undefined;
  const nanny = d.nanny && d.nannyName.trim() ? { name: d.nannyName.trim(), ...(d.nannyPhone.trim() ? { phone: e164(d.nannyPhone) } : {}), ...(photo ? { photoMediaId: photo } : {}), ...(same && m.nanny?.note ? { note: m.nanny.note } : {}) } : null;
  if (JSON.stringify(nanny) !== JSON.stringify(m.nanny ? { name: m.nanny.name, ...(m.nanny.phone ? { phone: m.nanny.phone } : {}), ...keep(m.nanny) } : null)) patch.nanny = nanny;
  return patch;
}

function Field({ label, value, onChange, inputMode, type = 'text', error, multiline }: { label: string; value: string; onChange: (v: string) => void; inputMode?: 'text' | 'tel' | 'email' | 'numeric'; type?: string; error?: string; multiline?: boolean }) {
  const box = { width: '100%', boxSizing: 'border-box', border: error ? `1.5px solid ${F.rust}` : 'none', borderRadius: 14, background: F.fill, padding: multiline ? '12px 14px' : '0 14px', fontSize: 16, color: F.text, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', minWidth: 0 } as const;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 13, color: F.muted }}>{label}</span>
      {multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} maxLength={200} style={{ ...box, resize: 'none', lineHeight: 1.4 }} />
        : <input type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} maxLength={120} style={{ ...box, height: 46 }} />}
      {error ? <span style={{ fontSize: 13, color: F.rust }}>{error}</span> : null}
    </label>
  );
}
const Two = ({ children }: { children: ReactNode }) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>;

export function ProfileEditSheet({ m, s, t, userId, onClose }: { m: Member; s: ClubState; t: TFn; userId: string; onClose: () => void }) {
  const act = useAct();
  const waiting = pendingDetails(s, m.id, userId).reduce<Patch>((all, cr) => ({ ...all, ...patchOf(cr) }), {});
  const [d, setD] = useState<Draft>(() => draftOf(m, waiting));
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const patch = changesOf(m, d);
  const badEmail = !!d.email.trim() && !/^\S+@\S+\.\S+$/.test(d.email.trim());
  const noName = d.nanny && !d.nannyName.trim();
  const { open, close } = s.club.settings;
  const last = toHM(toMin(close) - 1);
  const send = async () => {
    if (busy || !Object.keys(patch).length || badEmail || noName) return;
    setBusy(true);
    const r = await act('family.updateDetails', { memberId: m.id, patch }, { reviewText: t('fhealth.sentToast'), ok: t('fhealth.sentToast') });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <FamSheet open onClose={onClose} title={t('fhealth.editTitle')} testId="edit-sheet" action={{ label: t('fam.send'), onClick: () => void send(), disabled: busy || !Object.keys(patch).length || badEmail || !!noName }}>
      <span style={{ fontSize: 13, lineHeight: 1.4, color: F.muted }}>{t('fhealth.editNote')}</span>
      <Field label={t('profile.f.address')} value={d.address} onChange={(v) => set({ address: v })} multiline />
      <Two>
        <Field label={t('profile.f.rtRw')} value={d.rtRw} onChange={(v) => set({ rtRw: v })} />
        <Field label={t('profile.f.postcode')} value={d.postcode} onChange={(v) => set({ postcode: v })} inputMode="numeric" />
      </Two>
      <Field label={t('profile.f.city')} value={d.city} onChange={(v) => set({ city: v })} />
      <Two>
        <Field label={t('profile.f.homePhone')} value={d.phone} onChange={(v) => set({ phone: v })} inputMode="tel" type="tel" />
        <Field label={t('profile.f.memberMobile')} value={d.mobile} onChange={(v) => set({ mobile: v })} inputMode="tel" type="tel" />
      </Two>
      <Field label={t('profile.f.email')} value={d.email} onChange={(v) => set({ email: v })} inputMode="email" type="email" error={badEmail ? t('fhealth.errEmail') : undefined} />
      <TimeField label={t('profile.f.usual')} value={d.usual} onChange={(v) => set({ usual: v })} min={open} max={last} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }}>
        <span style={{ fontSize: 16, color: F.text }}>{t('profile.comesWithNanny')}</span>
        <Switch on={d.nanny} onClick={() => set({ nanny: !d.nanny })} label={t('profile.comesWithNanny')} />
      </div>
      {d.nanny ? (
        <ProfilePhotoField name={d.nannyName || t('profile.f.nanny')} value={d.nannyPhoto || null} onChange={(id) => set({ nannyPhoto: id ?? '' })} size={64} />
      ) : null}
      {d.nanny ? (
        <Two>
          <Field label={t('profile.nannyName')} value={d.nannyName} onChange={(v) => set({ nannyName: v })} error={noName ? t('members.err.nannyNameRequired') : undefined} />
          <Field label={t('profile.nannyPhone')} value={d.nannyPhone} onChange={(v) => set({ nannyPhone: v })} inputMode="tel" type="tel" />
        </Two>
      ) : null}
    </FamSheet>
  );
}

/** "Your changes are waiting for the club" with what was asked and a Withdraw button. */
export function PendingDetailsCard({ requests, t }: { requests: ChangeRequest[]; t: TFn }) {
  const act = useAct();
  const [busy, setBusy] = useState(false);
  if (!requests.length) return null;
  const keys = Array.from(new Set(requests.flatMap((cr) => Object.keys(patchOf(cr)))));
  const what = keys.map((k) => t(FIELD_LABEL[k] || 'profile.f.address')).join(', ');
  const withdraw = async () => {
    setBusy(true);
    for (const cr of requests) await act('review.withdraw', { crId: cr.id }, { ok: t('profile.withdrawn') });
    setBusy(false);
  };
  return (
    <FillCard testId="pf-pending" gap={8} style={{ background: F.ochreBg }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: F.ochre }}>
        <Icon name="hourglass_top" size={20} fill={1} color={F.ochre} />
        {t('fhealth.pendingTitle')}
      </span>
      {what ? <span style={{ fontSize: 13, lineHeight: 1.4, color: F.ochre }}>{t('fhealth.pendingFields', { f: what })}</span> : null}
      <button type="button" onClick={() => void withdraw()} disabled={busy} className="cp-press" data-testid="pf-withdraw"
        style={{ alignSelf: 'flex-start', height: 36, padding: '0 16px', border: 'none', borderRadius: 999, background: '#FFFFFF', color: F.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', opacity: busy ? 0.6 : 1 }}>
        {t('profile.withdraw')}
      </button>
    </FillCard>
  );
}
