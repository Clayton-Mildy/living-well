// The reading form: every measurement on one form (blood pressure, oxygen and temperature, glucose, weight and grip), each with
// "Read PC-303" where the device measures it, the live result banner, tell the family and re-check, quick notes, and the sticky footer.
// One complete measurement is enough to save. The station starts waiting for the PC-303 when someone is opened; tapping a box to type
// stops the wait. Tablet and laptop: fields beside a 222px keypad. Phone: native inputs.
import { type KeyboardEvent as RKE } from 'react';
import { lastBefore, limitsOf, type ClubState } from '@cp/shared';
import { lastOfKind } from '@cp/shared/rules/healthStation';
import { Icon, TextField, FONT_BODY } from '../../components/ui';
import { useT, type TFn } from '../../lib/i18n';
import type { DeviceKind } from './device';
import { FIELD, FORM_GROUPS, GROUPS, canSave, effTell, evalDraft, flagged, groupStatus, partialGroups, press, typeText, type Draft, type FieldKey, type GroupDef } from './form';
import { Badge, NoteChip, PillSwitch } from './parts';
import { joinNames } from './ReadingCard';
import { smallCaps } from './lib';
import type { Who } from './who';

const QUICK = ['rested', 'medsTaken', 'dizzy', 'headache', 'rightArm'] as const;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];
/** Room kept beside the sticky footer for the shell's floating Demo button (bottom-right on tablet and laptop, bottom-left on the phone). */
const DEMO_CLEAR = 100;

export interface FormProps {
  who: Who; s: ClubState; today: string; draft: Draft; patch: (fn: (d: Draft) => Draft) => void; isPhone: boolean; busy: boolean;
  /** which earlier blood pressure to show as "Last …" (the departure one when it is time to go home) */
  lastBp: 'arrival' | 'departure';
  recipients: string[]; fds: (d: string) => string;
  /** someone else in the club still has no reading today: the save button says "Save and next" and opens them */
  hasNext: boolean;
  onMeasure: (kinds: DeviceKind[]) => void;
  /** the nurse types: stop waiting for the device */
  onManual: () => void;
  onSave: () => void; onClose: () => void;
}
export function ReadingForm({ who, s, today, draft, patch, isPhone, busy, lastBp, recipients, fds, hasNext, onMeasure, onManual, onSave, onClose }: FormProps) {
  const t = useT();
  const prevW = who.kind === 'member' ? lastBefore(s, who.id, today, 'weight')?.weight : undefined;
  const ev = evalDraft(draft, prevW, limitsOf(s));
  const ok = canSave(draft, ev);
  const field: FieldKey = draft.field;
  const partial = partialGroups(draft, ev);
  const overall = ev.overall;
  const isFlagged = flagged(ev);
  const tell = effTell(draft, ev);

  const lastTxt = (g: GroupDef): string => {
    if (who.kind !== 'member') return '';
    const L = (v: string, d: string) => t('health.lastL', { v, d: fds(d) });
    if (g.id === 'bp') { const r = lastOfKind(s, who.id, today, [lastBp], 'sys'); return r ? L(`${r.sys}/${r.dia}`, r.date) : ''; }
    if (g.id === 'vit') { const r = lastOfKind(s, who.id, today, ['arrival', 'spot', 'recheck', 'departure'], 'spo2'); return r ? L(`${r.spo2}%${r.temp ? ` · ${r.temp} °C` : ''}`, r.date) : ''; }
    if (g.id === 'glu') { const r = lastOfKind(s, who.id, today, ['monthly', 'arrival', 'departure', 'recheck', 'spot'], 'glucose'); return r ? L(`${r.glucose} mg/dL`, r.date) : ''; }
    const r = lastOfKind(s, who.id, today, ['monthly', 'arrival', 'departure', 'recheck', 'spot'], 'weight');
    return r ? L(`${r.weight} kg${r.grip ? ` · ${r.grip} kg ${t('health.grip').toLowerCase()}` : ''}`, r.date) : '';
  };

  const probs: string[] = [];
  if (ev.st.bp && ev.st.bp !== 'normal') probs.push(`${t('health.bp')} ${draft.v.sys}/${draft.v.dia}.`);
  if (ev.st.pulse && ev.st.pulse !== 'normal') probs.push(`${t('health.pulse')} ${draft.v.pulse}.`);
  if (ev.st.spo2 && ev.st.spo2 !== 'normal') probs.push(`SpO₂ ${draft.v.spo2}%.`);
  if (ev.st.temp && ev.st.temp !== 'normal') probs.push(`${t('health.temp')} ${draft.v.temp} °C.`);
  if (ev.st.glu && ev.st.glu !== 'normal') probs.push(`${t('health.glucose')} ${draft.v.glu} mg/dL.`);
  if (ev.st.wt && ev.st.wt !== 'normal') probs.push(`${t('health.weight')} ${draft.v.wt} kg.`);
  const bannerText = overall === 'normal' ? t('health.allNormal') : `${probs.join(' ')} ${overall === 'alert' ? t('health.alertCall') : t('health.watchCall')}`;
  const banner = overall === 'alert' ? { bg: '#FBEDE8', bd: '1px solid #AF4B2F' } : overall === 'watch' ? { bg: '#FBF5E8', bd: '1px solid #E3CF9F' } : { bg: '#FFFFFF', bd: '1px solid #DBD7D6' };

  const sh = isPhone ? 'Short' : '';
  const why = draft.meas ? t('health.whyWaiting' + sh)
    : ev.invalid.length ? t('health.whyRange' + sh)
      : partial.length ? t('health.whyPartial' + sh, { g: partial.map((id) => t(GROUPS[id].titleKey)).join(', ') })
        : ok ? '' : t('health.whyNone' + sh);

  const key = (k: string) => { onManual(); patch((d) => press({ ...d, field }, k)); };
  const onKey = (e: RKE) => {
    if (/^[0-9]$/.test(e.key)) key(e.key);
    else if (e.key === '.' || e.key === ',') key('.');
    else if (e.key === 'Backspace') key('back');
    else return;
    e.preventDefault();
  };
  const panel = (g: GroupDef) => (
    <GroupPanel key={g.id} g={g} t={t} draft={draft} field={field} ev={ev} last={lastTxt(g)} isPhone={isPhone} onKey={onKey}
      onField={(k) => { onManual(); patch((d) => ({ ...d, field: k })); }} onFocus={onManual}
      onType={(k, raw) => patch((d) => typeText(d, k, raw))} onRead={() => g.device && onMeasure([g.device])} onStop={onManual} />
  );
  const saveBg = ok && !busy ? '#75624B' : '#E8E1D8';
  const saveFg = ok && !busy ? '#FFFFFF' : '#6A6967';

  return (
    <>
      <div style={{ padding: isPhone ? '14px 16px 18px' : '20px 24px', display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {FORM_GROUPS.map(panel)}
        </div>
        {!isPhone ? (
          <div style={{ flex: '0 0 222px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={smallCaps()}>{t('health.keypad', { f: FIELD[field].key ? t(FIELD[field].key!) : FIELD[field].label })}</div>
            <div style={{ fontSize: 'max(13px, var(--cp-body, 0px))', lineHeight: '18px', color: '#6A6967' }}>{t('health.keypadNote')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {KEYS.map((k) => (
                <button key={k} type="button" className="dh23 da24" aria-label={k === 'back' ? t('common.delete') : k} onClick={() => key(k)}
                  style={{ height: 60, borderRadius: 16, border: 'none', background: '#F4F0EE', color: '#282828', fontSize: 24, fontWeight: 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter' }}>
                  {k === 'back' ? <Icon name="backspace" size={24} /> : k}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ padding: isPhone ? '0 16px 20px' : '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {overall ? (
          <>
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 18, background: banner.bg, border: banner.bd }}>
              <Badge kind={overall} size={32} />
              <span style={{ fontSize: 16, lineHeight: '22px', color: '#282828' }}>{bannerText}</span>
            </div>
            {isFlagged && who.kind === 'member' && recipients.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <PillSwitch on={tell} label={t('health.tellFam', { n: joinNames(recipients, t('common.and')) })} onClick={() => patch((d) => ({ ...d, tell: !tell }))} />
              </div>
            ) : null}
            {isFlagged && who.kind === 'member' && !recipients.length ? <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('health.noFamily', { n: who.short })}</div> : null}
          </>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={smallCaps('1.5px')}>{t('health.quickNotes')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK.map((k) => (
              <NoteChip key={k} on={draft.notes.includes(k)} onClick={() => patch((d) => ({ ...d, notes: d.notes.includes(k) ? d.notes.filter((x) => x !== k) : [...d.notes, k] }))}>{t('health.note.' + k)}</NoteChip>
            ))}
          </div>
          <TextField label={t('common.note')} value={draft.note} onChange={(v) => patch((d) => ({ ...d, note: v }))} placeholder={t('health.notePh')} multiline rows={2} maxLength={280} />
          <button type="button" role="switch" aria-checked={draft.share} onClick={() => patch((d) => ({ ...d, share: !d.share }))}
            style={{ alignSelf: 'flex-start', height: 44, padding: '0 4px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#282828', fontSize: 16, fontFamily: 'Inter' }}>
            <span style={{ width: 44, height: 26, borderRadius: 999, background: draft.share ? '#75624B' : '#6A6967', position: 'relative', flex: 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: draft.share ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
            </span>
            {t('health.shareNotes')}
          </button>
        </div>
      </div>
      <div style={{ position: 'sticky', bottom: 0, zIndex: 2, padding: `12px ${isPhone ? 16 : DEMO_CLEAR}px calc(14px + env(safe-area-inset-bottom, 0px)) 16px`, borderTop: '1px solid #EFECEA', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px 12px', background: '#FBFAF9' }}>
        {why ? (
          <div role="status" style={{ flexBasis: '100%', display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: FONT_BODY, lineHeight: 1.4, color: '#282828', paddingLeft: isPhone ? 46 : 0 }}>
            <Icon name="info" size={20} color="#7A5510" />
            <span>{why}</span>
          </div>
        ) : null}
        <button type="button" onClick={onClose} style={{ whiteSpace: 'nowrap', height: 48, padding: '0 10px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'Inter' }}>{t('common.close')}</button>
        <button type="button" onClick={() => ok && onSave()} aria-disabled={!ok || busy} style={{ whiteSpace: 'nowrap', height: 56, padding: '0 22px', borderRadius: 999, border: 'none', background: saveBg, color: saveFg, fontSize: 17, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: ok ? 'pointer' : 'not-allowed', fontFamily: 'Inter' }}>
          <Icon name="check" size={22} />
          {hasNext ? t('health.saveNext') : t('health.saveOnly')}
        </button>
      </div>
    </>
  );
}

interface GroupProps {
  g: GroupDef; t: TFn; draft: Draft; field: FieldKey; ev: ReturnType<typeof evalDraft>; last: string; isPhone: boolean;
  onField: (k: FieldKey) => void; onFocus: () => void; onKey: (e: RKE) => void; onType: (k: FieldKey, raw: string) => void; onRead: () => void; onStop: () => void;
}
function GroupPanel({ g, t, draft, field, ev, last, isPhone, onField, onFocus, onKey, onType, onRead, onStop }: GroupProps) {
  const st = groupStatus(g.id, ev);
  const measuring = draft.meas === g.device;
  return (
    <div style={{ padding: 14, borderRadius: 20, background: '#F4F0EE', display: 'flex', flexDirection: 'column', gap: 12 }} data-group={g.id} data-waiting={measuring || undefined} data-has={g.fields.some((k) => (draft.v[k] ?? '') !== '') || undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Icon name={g.icon} size={22} color="#75624B" />
        <span style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t(g.titleKey)}</span>
          <span style={{ fontSize: 'max(13px, var(--cp-small, 0px))', color: '#282828', lineHeight: 1.4 }}>{last}</span>
        </span>
        {st ? <Badge kind={st} size={32} /> : null}
        {g.device ? (
          <button type="button" onClick={() => (measuring ? onStop() : !draft.meas && onRead())} aria-disabled={!!draft.meas && !measuring} aria-label={measuring ? t('health.stopWaitingL') : undefined}
            style={{ height: isPhone ? 38 : 44, padding: isPhone ? '0 12px' : '0 16px', borderRadius: 999, border: 'none', background: measuring ? '#8A755B' : draft.meas ? '#B9AA97' : '#75624B', color: '#FFFFFF', fontSize: isPhone ? 15 : 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: draft.meas && !measuring ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
            <span style={{ display: 'inline-flex', animation: measuring ? 'cpPulse 1.2s ease-in-out infinite' : undefined }}><Icon name={measuring ? 'bluetooth_searching' : 'bluetooth'} size={isPhone ? 18 : 20} /></span>
            {measuring ? t('health.waiting') : t('health.readDevice')}
          </button>
        ) : (
          <span style={{ height: 36, padding: '0 14px 0 10px', borderRadius: 999, background: '#FFFFFF', border: '1px solid #DBD7D6', fontSize: FONT_BODY, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <Icon name="dialpad" size={18} color="#75624B" />
            {t('health.byHand')}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {g.fields.map((k) => {
          const f = FIELD[k];
          const label = f.key ? t(f.key) : f.label!;
          const bad = ev.invalid.includes(k);
          if (isPhone) {
            return (
              <label key={k} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 12px', borderRadius: 16, background: '#FFFFFF', border: bad ? '2px solid #AF4B2F' : '1px solid #8A755B' }}>
                <span style={{ fontSize: 'max(13px, var(--cp-small, 0px))', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' }}>{label}</span>
                <input value={draft.v[k] ?? ''} onFocus={onFocus} onChange={(e) => onType(k, e.target.value)} inputMode="decimal" aria-label={label} placeholder="—" aria-invalid={bad || undefined}
                  style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: 0, fontSize: 30, lineHeight: '38px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter', color: '#282828' }} />
                <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{f.unit}</span>
              </label>
            );
          }
          const focused = field === k;
          return (
            <button key={k} type="button" onClick={() => onField(k)} onKeyDown={onKey} aria-pressed={focused} aria-invalid={bad || undefined}
              style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 12px', borderRadius: 16, background: '#FFFFFF', border: bad ? '2px solid #AF4B2F' : focused ? '2px solid #75624B' : '1px solid #DBD7D6', boxShadow: focused ? '0 0 0 3px #E8E1D8' : 'none', cursor: 'pointer', color: '#282828', textAlign: 'left', fontFamily: 'Inter' }}>
              <span style={{ fontSize: 'max(13px, var(--cp-small, 0px))', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' }}>{label}</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                <span style={{ fontSize: 34, lineHeight: '40px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{draft.v[k] || '—'}</span>
                <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{f.unit}</span>
              </span>
            </button>
          );
        })}
      </div>
      {g.fields.some((k) => ev.invalid.includes(k)) ? <span role="alert" style={{ fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}>{t('health.whyRange')}</span> : null}
    </div>
  );
}
