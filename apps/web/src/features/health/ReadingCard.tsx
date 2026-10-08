// One saved reading as a card that opens: the header says what it was (value, kind, time, status); opened, it shows every number,
// who took it, the notes, who was told and the corrections, with the buttons to correct or remove it. Used for "today" in the
// station and for any day in Readings.
import { useState } from 'react';
import { bpStatus, gluStatus, lastBefore, limitsFor, pulseStatus, spo2Status, staffCall, tempStatus, weightStatus, type ClubState, type Health, type Reading } from '@cp/shared';
import { Button, Icon } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { PendingMark } from '../../components/PendingMark';
import { useDevice } from '../../hooks/useDevice';
import { smallCaps } from './lib';
import { Badge } from './parts';

export const CHECK_KEY: Record<Reading['kind'], string> = { arrival: 'health.arrivalCheck', departure: 'health.departureCheck', recheck: 'health.recheckL', spot: 'health.spotCheck', monthly: 'health.monthlyCheck' };
export const joinNames = (n: string[], and: string) => (n.length > 1 ? `${n.slice(0, -1).join(', ')} ${and} ${n[n.length - 1]}` : n[0] ?? '');

/** "122/73 · pulse 70 · SpO₂ 97% · 36.6 °C", or the monthly values for a monthly reading. */
export function readingTitle(r: Reading, t: TFn) {
  if (r.sys == null || r.dia == null) {
    return [r.glucose != null ? `${t('health.glucose')} ${r.glucose}` : '', r.weight != null ? `${t('health.weight').toLowerCase()} ${r.weight} kg` : '', r.grip != null ? `${t('health.grip').toLowerCase()} ${r.grip} kg` : ''].filter(Boolean).join(' · ');
  }
  return `${r.sys}/${r.dia}` + (r.pulse != null ? ` · ${t('health.pulse').toLowerCase()} ${r.pulse}` : '') + (r.spo2 != null ? ` · SpO₂ ${r.spo2}%` : '') + (r.temp != null ? ` · ${r.temp} °C` : '');
}

export function ReadingCard({ r, s, t, meta, name, defaultOpen, first, onEdit, onVoid }: { r: Reading; s: ClubState; t: TFn; meta?: string; name?: string; defaultOpen?: boolean; /** phone: the first row of a group has no hairline above it */ first?: boolean; onEdit: () => void; onVoid: () => void }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const { isPhone } = useDevice();
  // round 6, phone: a row of an iOS group (16px inset, a hairline from the text on, a tint while pressed); it sits in a Group with pad 0
  const wrap: React.CSSProperties = isPhone
    ? { backgroundColor: '#FFFFFF', backgroundImage: first ? 'none' : 'linear-gradient(#EFEAE3, #EFEAE3)', backgroundSize: 'calc(100% - 16px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat', overflow: 'hidden' }
    : { borderTop: '1px solid #F0EAE1', background: '#FFFFFF', overflow: 'hidden' };
  return (
    <div data-testid="reading-card" data-reading={r.id} style={wrap}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={isPhone ? 'cp-tap-self' : 'h-row cp-bleed'}
        style={{ width: '100%', minHeight: 60, padding: isPhone ? '12px 16px' : '12px 0', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {name ? <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{name}</span> : null}
          <span style={{ fontSize: 16, fontWeight: name ? 400 : 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>{readingTitle(r, t)}</span>
          <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{`${t(CHECK_KEY[r.kind])} · ${meta ?? r.time}`}</span>
          <PendingMark row={r} />
        </span>
        <Badge kind={r.status} icon={17} />
        <Icon name={open ? 'expand_less' : 'expand_more'} size={22} weight={300} color={isPhone ? '#A89C8E' : '#6B6259'} />
      </button>
      {open ? <ReadingBody r={r} s={s} t={t} onEdit={onEdit} onVoid={onVoid} /> : null}
    </div>
  );
}

/** Every number of one reading with its status, then who saved it, notes, who was told, corrections and the two buttons. */
export function ReadingBody({ r, s, t, onEdit, onVoid }: { r: Reading; s: ClubState; t: TFn; onEdit: () => void; onVoid: () => void }) {
  const { isPhone } = useDevice();
  const prevW = r.memberId ? lastBefore(s, r.memberId, r.date, 'weight')?.weight : undefined;
  const L = limitsFor(s, r.memberId); // the member's own limits first
  const tiles: { label: string; value: string; st: Health | null }[] = [];
  if (r.sys != null && r.dia != null) tiles.push({ label: t('health.bp'), value: `${r.sys}/${r.dia}`, st: bpStatus(r.sys, r.dia, L) });
  if (r.pulse != null) tiles.push({ label: t('health.pulse'), value: String(r.pulse), st: pulseStatus(r.pulse, L) });
  if (r.spo2 != null) tiles.push({ label: 'SpO₂', value: `${r.spo2}%`, st: spo2Status(r.spo2, L) });
  if (r.temp != null) tiles.push({ label: t('health.temp'), value: `${r.temp} °C`, st: tempStatus(r.temp, L) });
  if (r.glucose != null) tiles.push({ label: `${t('health.glucose')} · mg/dL`, value: String(r.glucose), st: gluStatus(r.glucose, L) });
  if (r.weight != null) tiles.push({ label: `${t('health.weight')} · kg`, value: String(r.weight), st: weightStatus(r.weight, prevW, L) });
  if (r.grip != null) tiles.push({ label: `${t('health.grip')} · kg`, value: String(r.grip), st: null });
  const who = (id: string) => staffCall(s.staff[id]) || id;
  const told = r.familyTold ? r.familyTold.familyIds.map((id) => s.familyContacts[id]?.firstName).filter(Boolean) : [];
  return (
    <div style={{ padding: isPhone ? '4px 16px 16px' : '4px 0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
        {tiles.map((v) => (
          <div key={v.label} style={{ padding: '10px 12px', borderRadius: isPhone ? 10 : 8, background: isPhone ? '#F5F5F3' : '#FFFFFF', border: isPhone ? 'none' : '1px solid #DDD1C2', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...smallCaps('1.2px'), fontWeight: 600, color: '#5E5852' }}>{v.label}</span>
            <span style={{ fontSize: 26, lineHeight: '30px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{v.value}</span>
            {v.st ? <span style={{ alignSelf: 'flex-start' }}><Badge kind={v.st} /></span> : null}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('health.savedBy', { t: r.time, n: who(r.takenBy) })}</div>
      {r.noteKeys.length || r.note ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {r.noteKeys.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {r.noteKeys.map((k) => <span key={k} style={{ minHeight: 30, padding: '3px 12px', borderRadius: 12, background: '#F3EEE8', fontSize: 14, lineHeight: 1.3, display: 'inline-flex', alignItems: 'center' }}>{t('health.note.' + k)}</span>)}
            </div>
          ) : null}
          {r.note ? <div style={{ fontSize: 15, lineHeight: '22px', padding: '10px 14px', borderRadius: 8, background: '#FBF8F4' }}>{r.note}</div> : null}
        </div>
      ) : null}
      {r.approval?.status === 'pending' && r.approval.prev ? <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('approvals.familiesSeeEarlier')}</div> : null}
      {r.shared ? <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, color: '#6B6259' }}><Icon name="family_restroom" size={18} weight={300} />{t('common.sharedFam')}</div> : null}
      {r.familyTold ? <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}><Icon name="mark_email_read" size={18} style={{ paddingTop: 1 }} />{t('health.toldAt', { t: r.familyTold.at.slice(11, 16), f: joinNames(told as string[], t('common.and')) })}</div> : null}
      {r.edits.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>
          <Icon name="edit" size={18} style={{ paddingTop: 1 }} />
          {e.reason ? t('health.editedAt', { t: e.at.slice(11, 16), n: who(e.by), r: t('health.er.' + e.reason) }) : t('health.editedNoReason', { t: e.at.slice(11, 16), n: who(e.by) })}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="secondary" size={48} icon="edit" onClick={onEdit}>{t('health.editBtn')}</Button>
        <Button variant="quiet" size={48} icon="delete" onClick={onVoid}>{t('health.voidBtn')}</Button>
      </div>
    </div>
  );
}
