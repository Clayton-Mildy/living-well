// One saved reading as a card that opens: the header says what it was (value, kind, time, status); opened, it shows every number,
// who took it, the notes, who was told and the corrections, with the buttons to correct or remove it. Used for "today" in the
// station and for any day in Readings.
import { useState } from 'react';
import { bpStatus, gluStatus, lastBefore, limitsOf, pulseStatus, spo2Status, staffCall, tempStatus, weightStatus, type ClubState, type Health, type Reading } from '@cp/shared';
import { Button, FONT_BODY, Icon } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
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

export function ReadingCard({ r, s, t, meta, name, defaultOpen, onEdit, onVoid }: { r: Reading; s: ClubState; t: TFn; meta?: string; name?: string; defaultOpen?: boolean; onEdit: () => void; onVoid: () => void }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div data-testid="reading-card" data-reading={r.id} style={{ borderRadius: 18, border: '1px solid #DBD7D6', background: '#FFFFFF', overflow: 'hidden' }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="h-row"
        style={{ width: '100%', minHeight: 64, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: open ? '#F4F0EE' : '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {name ? <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{name}</span> : null}
          <span style={{ fontSize: 16, fontWeight: name ? 400 : 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>{readingTitle(r, t)}</span>
          <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{`${t(CHECK_KEY[r.kind])} · ${meta ?? r.time}`}</span>
        </span>
        <Badge kind={r.status} icon={17} />
        <Icon name={open ? 'expand_less' : 'expand_more'} size={24} color="#6A6967" />
      </button>
      {open ? <ReadingBody r={r} s={s} t={t} onEdit={onEdit} onVoid={onVoid} /> : null}
    </div>
  );
}

/** Every number of one reading with its status, then who saved it, notes, who was told, corrections and the two buttons. */
export function ReadingBody({ r, s, t, onEdit, onVoid }: { r: Reading; s: ClubState; t: TFn; onEdit: () => void; onVoid: () => void }) {
  const prevW = r.memberId ? lastBefore(s, r.memberId, r.date, 'weight')?.weight : undefined;
  const L = limitsOf(s);
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
    <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid #EFECEA' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {tiles.map((v) => (
          <div key={v.label} style={{ padding: '12px 14px', borderRadius: 16, background: '#F4F0EE', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={smallCaps('1.5px')}>{v.label}</span>
            <span style={{ fontSize: 30, lineHeight: '34px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{v.value}</span>
            {v.st ? <span style={{ alignSelf: 'flex-start' }}><Badge kind={v.st} /></span> : null}
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('health.savedBy', { t: r.time, n: who(r.takenBy) })}</div>
      {r.noteKeys.length || r.note ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {r.noteKeys.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {r.noteKeys.map((k) => <span key={k} style={{ minHeight: 32, padding: '4px 12px', borderRadius: 999, background: '#E8E1D8', fontSize: FONT_BODY, lineHeight: 1.3, display: 'inline-flex', alignItems: 'center' }}>{t('health.note.' + k)}</span>)}
            </div>
          ) : null}
          {r.note ? <div style={{ fontSize: 16, lineHeight: '22px', padding: '12px 14px', borderRadius: 16, background: '#F4F0EE' }}>{r.note}</div> : null}
        </div>
      ) : null}
      {r.shared ? <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: FONT_BODY, color: '#6A6967' }}><Icon name="family_restroom" size={18} />{t('common.sharedFam')}</div> : null}
      {r.familyTold ? <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}><Icon name="mark_email_read" size={18} style={{ paddingTop: 1 }} />{t('health.toldAt', { t: r.familyTold.at.slice(11, 16), f: joinNames(told as string[], t('common.and')) })}</div> : null}
      {r.edits.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>
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
