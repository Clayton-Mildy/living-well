// The reading form: every measurement on one form (blood pressure, oxygen and temperature, glucose, weight and grip), each with
// "Read PC-303" where the device measures it, the live result banner, tell the family and re-check, quick notes, and the sticky footer.
// One complete measurement is enough to save. The station starts waiting for the PC-303 when someone is opened; tapping a box to type
// stops the wait. Tablet and laptop: fields beside a 222px keypad. Phone: native inputs.
import { type KeyboardEvent as RKE } from 'react';
import { lastBefore, limitsFor, type ClubState } from '@cp/shared';
import { lastOfKind } from '@cp/shared/rules/healthStation';
import { GROUP_HEAD, Group, Icon, TextField } from '../../components/ui';
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
  const ev = evalDraft(draft, prevW, limitsFor(s, who.kind === 'member' ? who.id : null)); // the member's own limits first
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
  const banner = overall === 'alert' ? { bg: '#FBEDE8', bd: '1px solid #9A3D24' } : overall === 'watch' ? { bg: '#FBF5E8', bd: '1px solid #E3CF9F' } : { bg: '#FBFAF8', bd: '1px solid #EFE7DC' };

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
  const saveBg = ok && !busy ? '#24201C' : '#EDE5DA';
  const saveFg = ok && !busy ? '#FFFFFF' : '#8A8078';

  // round 6, phone: one grouped section per measurement (title outside, flat white group), the result banner, the quick notes as a group, and the
  // Close / Save pair pinned at the bottom of the sheet. The sections sit in the sheet's 22px column.
  if (isPhone) {
    return (
      <>
        {FORM_GROUPS.map(panel)}
        {overall ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, background: overall === 'normal' ? '#FFFFFF' : banner.bg, border: overall === 'normal' ? 'none' : banner.bd }}>
              <Badge kind={overall} size={32} />
              <span style={{ fontSize: 15, lineHeight: '22px', color: '#24201C' }}>{bannerText}</span>
            </div>
            {isFlagged && who.kind === 'member' && recipients.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <PillSwitch on={tell} label={t('health.tellFam', { n: joinNames(recipients, t('common.and')) })} onClick={() => patch((d) => ({ ...d, tell: !tell }))} />
              </div>
            ) : null}
            {isFlagged && who.kind === 'member' && !recipients.length ? <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, padding: '0 16px' }}>{t('health.noFamily', { n: who.short })}</div> : null}
          </div>
        ) : null}
        <Group title={t('health.quickNotes')} gap={12}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK.map((k) => (
              <NoteChip key={k} on={draft.notes.includes(k)} onClick={() => patch((d) => ({ ...d, notes: d.notes.includes(k) ? d.notes.filter((x) => x !== k) : [...d.notes, k] }))}>{t('health.note.' + k)}</NoteChip>
            ))}
          </div>
          <TextField label={t('common.note')} value={draft.note} onChange={(v) => patch((d) => ({ ...d, note: v }))} placeholder={t('health.notePh')} multiline rows={2} maxLength={280} />
          <button type="button" role="switch" aria-checked={draft.share} onClick={() => patch((d) => ({ ...d, share: !d.share }))} className="cp-press"
            style={{ width: '100%', height: 48, padding: 0, border: 'none', borderTop: '1px solid #EFEAE3', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', color: '#24201C', fontSize: 16, fontFamily: 'Inter', textAlign: 'left' }}>
            {t('health.shareNotes')}
            <span style={{ width: 44, height: 26, borderRadius: 999, background: draft.share ? '#24201C' : '#B9AA97', position: 'relative', flex: 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: draft.share ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
            </span>
          </button>
        </Group>
        <div style={{ position: 'sticky', bottom: 0, zIndex: 2, margin: '0 -16px', padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid #E6E1DA', background: '#F5F5F3', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {why ? (
            <div role="status" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.4, color: '#24201C', paddingLeft: 46 }}>
              <Icon name="info" size={19} weight={300} color="#7A5510" />
              <span>{why}</span>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="cp-press" style={{ flex: 'none', whiteSpace: 'nowrap', height: 50, padding: '0 22px', borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('common.close')}</button>
            <button type="button" onClick={() => ok && onSave()} aria-disabled={!ok || busy} className="cp-press" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', height: 50, padding: '0 16px', borderRadius: 999, border: 'none', background: saveBg, color: saveFg, fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: ok ? 'pointer' : 'not-allowed', fontFamily: 'Inter' }}>
              <Icon name="check" size={20} weight={300} />
              {hasNext ? t('health.saveNext') : t('health.saveOnly')}
            </button>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <div style={{ padding: isPhone ? '14px 16px 16px' : '20px clamp(18px, 2.4vw, 28px)', display: 'flex', flexWrap: 'wrap', gap: 'clamp(16px, 2vw, 24px)' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 14 }}>
          {FORM_GROUPS.map(panel)}
        </div>
        {!isPhone ? (
          <div style={{ flex: '0 0 222px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...smallCaps('2px'), color: '#6E5A43' }}>{t('health.keypad', { f: FIELD[field].key ? t(FIELD[field].key!) : FIELD[field].label })}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
              {KEYS.map((k) => (
                <button key={k} type="button" className="dh23 da24" aria-label={k === 'back' ? t('common.delete') : k} onClick={() => key(k)}
                  style={{ height: 54, borderRadius: 8, border: 'none', background: '#F3EEE8', color: '#24201C', fontSize: 22, fontWeight: 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter' }}>
                  {k === 'back' ? <Icon name="backspace" size={22} weight={300} /> : k}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ padding: isPhone ? '0 16px 16px' : '0 clamp(18px, 2.4vw, 28px) 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {overall ? (
          <>
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: banner.bg, border: banner.bd }}>
              <Badge kind={overall} size={32} />
              <span style={{ fontSize: 15, lineHeight: '22px', color: '#24201C' }}>{bannerText}</span>
            </div>
            {isFlagged && who.kind === 'member' && recipients.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <PillSwitch on={tell} label={t('health.tellFam', { n: joinNames(recipients, t('common.and')) })} onClick={() => patch((d) => ({ ...d, tell: !tell }))} />
              </div>
            ) : null}
            {isFlagged && who.kind === 'member' && !recipients.length ? <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('health.noFamily', { n: who.short })}</div> : null}
          </>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...smallCaps('2px'), color: '#6E5A43' }}>{t('health.quickNotes')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK.map((k) => (
              <NoteChip key={k} on={draft.notes.includes(k)} onClick={() => patch((d) => ({ ...d, notes: d.notes.includes(k) ? d.notes.filter((x) => x !== k) : [...d.notes, k] }))}>{t('health.note.' + k)}</NoteChip>
            ))}
          </div>
          <TextField label={t('common.note')} value={draft.note} onChange={(v) => patch((d) => ({ ...d, note: v }))} placeholder={t('health.notePh')} multiline rows={2} maxLength={280} />
          <button type="button" role="switch" aria-checked={draft.share} onClick={() => patch((d) => ({ ...d, share: !d.share }))}
            style={{ alignSelf: 'flex-start', height: 44, padding: '0 4px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#24201C', fontSize: 15, fontFamily: 'Inter' }}>
            <span style={{ width: 44, height: 26, borderRadius: 999, background: draft.share ? '#24201C' : '#B9AA97', position: 'relative', flex: 'none' }}>
              <span style={{ position: 'absolute', top: 3, left: draft.share ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
            </span>
            {t('health.shareNotes')}
          </button>
        </div>
      </div>
      <div style={{ position: 'sticky', bottom: 0, zIndex: 2, padding: `12px ${isPhone ? 16 : DEMO_CLEAR}px calc(14px + env(safe-area-inset-bottom, 0px)) ${isPhone ? 16 : 'clamp(18px, 2.4vw, 28px)'}`, borderTop: '1px solid #F0EAE1', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px 12px', background: '#FFFFFF', borderRadius: '0 0 24px 24px' }}>
        {why ? (
          <div role="status" style={{ flexBasis: '100%', display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.4, color: '#24201C', paddingLeft: isPhone ? 46 : 0 }}>
            <Icon name="info" size={19} weight={300} color="#7A5510" />
            <span>{why}</span>
          </div>
        ) : null}
        <button type="button" onClick={onClose} style={{ whiteSpace: 'nowrap', height: 44, padding: '0 10px', borderRadius: 12, border: 'none', background: 'transparent', color: '#75624B', fontSize: 15, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'Inter' }}>{t('common.close')}</button>
        <button type="button" onClick={() => ok && onSave()} aria-disabled={!ok || busy} style={{ whiteSpace: 'nowrap', height: 48, padding: '0 22px', borderRadius: 12, border: 'none', background: saveBg, color: saveFg, fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: ok ? 'pointer' : 'not-allowed', fontFamily: 'Inter' }}>
          <Icon name="check" size={20} weight={300} />
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
  // round 6, phone: the title sits outside a flat white group; the device button (or "by hand") and the status badge on top, then big native inputs. The
  // device wait is unchanged: the same button, the same data-waiting / data-has marks on the wrapper.
  if (isPhone) {
    return (
      <div data-group={g.id} data-waiting={measuring || undefined} data-has={g.fields.some((k) => (draft.v[k] ?? '') !== '') || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ padding: '0 16px' }}><h2 style={GROUP_HEAD}>{t(g.titleKey)}</h2></div>
        <div style={{ background: measuring ? '#FBF8F4' : '#FFFFFF', borderRadius: 14, boxShadow: measuring ? 'inset 0 0 0 1.5px #2B231C' : 'none', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {g.device ? (
              <button type="button" className="cp-press" onClick={() => (measuring ? onStop() : !draft.meas && onRead())} aria-disabled={!!draft.meas && !measuring} aria-label={measuring ? t('health.stopWaitingL') : undefined}
                style={{ height: 38, padding: '0 16px 0 12px', borderRadius: 999, border: 'none', background: measuring ? '#24201C' : draft.meas ? '#EDE5DA' : '#2B231C', color: draft.meas && !measuring ? '#8A8078' : '#F7F3EE', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: draft.meas && !measuring ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                <span style={{ display: 'inline-flex', animation: measuring ? 'cpPulse 1.2s ease-in-out infinite' : undefined }}><Icon name={measuring ? 'bluetooth_searching' : 'bluetooth'} size={18} /></span>
                {measuring ? t('health.waiting') : t('health.readDevice')}
              </button>
            ) : (
              <span style={{ height: 32, padding: '0 12px 0 8px', borderRadius: 999, background: '#F3EEE8', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', color: '#24201C' }}>
                <Icon name="dialpad" size={17} weight={300} color="#75624B" />
                {t('health.byHand')}
              </span>
            )}
            <span style={{ flex: 1 }} />
            {st ? <Badge kind={st} size={28} /> : null}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {g.fields.map((k) => {
              const f = FIELD[k];
              const label = f.key ? t(f.key) : f.label!;
              const bad = ev.invalid.includes(k);
              return (
                <label key={k} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: '9px 12px 8px', borderRadius: 10, background: '#F5F5F3', border: bad ? '2px solid #9A3D24' : '2px solid transparent' }}>
                  <span style={{ fontSize: 'max(12px, var(--cp-small, 0px))', letterSpacing: '1.2px', textTransform: 'uppercase', fontWeight: 600, lineHeight: '16px', color: '#5E5852' }}>{label}</span>
                  <input value={draft.v[k] ?? ''} onFocus={onFocus} onChange={(e) => onType(k, e.target.value)} inputMode="decimal" aria-label={label} placeholder="—" aria-invalid={bad || undefined}
                    style={{ width: '100%', minWidth: 0, height: 38, border: 'none', outline: 'none', background: 'transparent', padding: 0, fontSize: 28, lineHeight: '38px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter', color: '#24201C' }} />
                  <span style={{ fontSize: 'max(12px, var(--cp-small, 0px))', color: '#6B6259', lineHeight: 1.3 }}>{f.unit}</span>
                </label>
              );
            })}
          </div>
          {g.fields.some((k) => ev.invalid.includes(k)) ? <span role="alert" style={{ fontSize: 14, color: '#9A3D24', lineHeight: 1.4 }}>{t('health.whyRange')}</span> : null}
          {last ? <span style={{ fontSize: 'max(13px, var(--cp-small, 0px))', color: '#6B6259', lineHeight: 1.4 }}>{last}</span> : null}
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: isPhone ? 12 : 14, borderRadius: 12, background: measuring ? '#FBF8F4' : '#FFFFFF', border: measuring ? '1px solid #2B231C' : '1px solid #EFE7DC', display: 'flex', flexDirection: 'column', gap: 10 }} data-group={g.id} data-waiting={measuring || undefined} data-has={g.fields.some((k) => (draft.v[k] ?? '') !== '') || undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Icon name={g.icon} size={21} weight={300} color="#75624B" />
        <span style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t(g.titleKey)}</span>
          <span style={{ fontSize: 'max(13px, var(--cp-small, 0px))', color: '#6B6259', lineHeight: 1.4 }}>{last}</span>
        </span>
        {st ? <Badge kind={st} size={28} /> : null}
        {g.device ? (
          <button type="button" onClick={() => (measuring ? onStop() : !draft.meas && onRead())} aria-disabled={!!draft.meas && !measuring} aria-label={measuring ? t('health.stopWaitingL') : undefined}
            style={{ height: 38, padding: '0 14px', borderRadius: 12, border: 'none', background: measuring ? '#24201C' : draft.meas ? '#EDE5DA' : '#2B231C', color: draft.meas && !measuring ? '#8A8078' : '#F7F3EE', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: draft.meas && !measuring ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
            <span style={{ display: 'inline-flex', animation: measuring ? 'cpPulse 1.2s ease-in-out infinite' : undefined }}><Icon name={measuring ? 'bluetooth_searching' : 'bluetooth'} size={18} /></span>
            {measuring ? t('health.waiting') : t('health.readDevice')}
          </button>
        ) : (
          <span style={{ height: 32, padding: '0 12px 0 8px', borderRadius: 8, background: '#F3EEE8', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', color: '#24201C' }}>
            <Icon name="dialpad" size={17} weight={300} color="#75624B" />
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
              <label key={k} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderRadius: 8, background: '#FFFFFF', border: bad ? '2px solid #9A3D24' : '1px solid #DDD1C2' }}>
                <span style={{ fontSize: 'max(12px, var(--cp-small, 0px))', letterSpacing: '1.2px', textTransform: 'uppercase', fontWeight: 600, lineHeight: '16px', color: '#5E5852' }}>{label}</span>
                <input value={draft.v[k] ?? ''} onFocus={onFocus} onChange={(e) => onType(k, e.target.value)} inputMode="decimal" aria-label={label} placeholder="—" aria-invalid={bad || undefined}
                  style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: 0, fontSize: 26, lineHeight: '32px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter', color: '#24201C' }} />
                <span style={{ fontSize: 'max(12px, var(--cp-small, 0px))', color: '#6B6259', lineHeight: 1.3 }}>{f.unit}</span>
              </label>
            );
          }
          const focused = field === k;
          return (
            <button key={k} type="button" onClick={() => onField(k)} onKeyDown={onKey} aria-pressed={focused} aria-invalid={bad || undefined}
              style={{ flex: '1 1 0', minWidth: 0, minHeight: 76, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4, padding: focused || bad ? '7px 9px' : '8px 10px', borderRadius: 8, background: '#FFFFFF', border: bad ? '2px solid #9A3D24' : focused ? '2px solid #2B231C' : '1px solid #DDD1C2', cursor: 'pointer', color: '#24201C', textAlign: 'left', fontFamily: 'Inter' }}>
              <span style={{ fontSize: 'max(12px, var(--cp-small, 0px))', letterSpacing: '1.2px', textTransform: 'uppercase', fontWeight: 600, lineHeight: '16px', color: '#5E5852' }}>{label}</span>
              <span style={{ fontSize: 28, lineHeight: '32px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                {draft.v[k] || '—'}
                <span style={{ fontSize: 'max(12px, var(--cp-small, 0px))', fontWeight: 400, letterSpacing: 0, color: '#6B6259', marginLeft: 4 }}>{f.unit}</span>
              </span>
            </button>
          );
        })}
      </div>
      {g.fields.some((k) => ev.invalid.includes(k)) ? <span role="alert" style={{ fontSize: 14, color: '#9A3D24', lineHeight: 1.4 }}>{t('health.whyRange')}</span> : null}
    </div>
  );
}
