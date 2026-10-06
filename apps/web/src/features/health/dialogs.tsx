// Dialogs of the health station: correct a reading, remove a reading, clear a reminder that is not needed after all.
// They use the design's edit-dialog pattern (Dialog, chips, toggles, 44px actions) and the shared actions.
import { useMemo, useState } from 'react';
import { memberName, type Reading, type QueueKind } from '@cp/shared';
import { READING_FIELDS, READING_RANGES, inRange, type ReadingField } from '@cp/shared/rules/healthStation';
import type { DismissReason, EditReason, VoidReason } from '@cp/shared/actions/health';
import { Button, ChipGroup, Dialog, Note, TextField, Toggle, FONT_BODY } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { Field } from './parts';
import { CHECK_KEY } from './ReadingCard';

const FIELD_LABEL: Record<ReadingField, { key?: string; label?: string; unit: string }> = {
  sys: { key: 'health.systolic', unit: 'mmHg' }, dia: { key: 'health.diastolic', unit: 'mmHg' }, pulse: { key: 'health.pulse', unit: 'bpm' }, spo2: { label: 'SpO₂', unit: '%' },
  temp: { key: 'health.temp', unit: '°C' }, glucose: { key: 'health.glucose', unit: 'mg/dL' }, weight: { key: 'health.weight', unit: 'kg' }, grip: { key: 'health.grip', unit: 'kg' },
};
const nameOf = (s: ReturnType<typeof useClub>, r: Reading) => (r.memberId && s.members[r.memberId] ? memberName(s.members[r.memberId]) : s.guestVisits[r.guestId || '']?.name || '');
const footerBtns = (cancel: string, onCancel: () => void, ok: React.ReactNode) => (<><Button variant="secondary" size={48} onClick={onCancel}>{cancel}</Button>{ok}</>);

// ---------- correct a reading ----------
export function EditReadingDialog({ readingId, onClose }: { readingId: string; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const r = s.readings[readingId];
  const fields = useMemo(() => READING_FIELDS.filter((f) => r && r[f] != null), [r]);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f, String(r?.[f] ?? '')])));
  const [reason, setReason] = useState<EditReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!r) return null;
  const parsed = fields.map((f) => ({ f, n: vals[f] === '' ? NaN : Number(vals[f]) }));
  const bad = parsed.filter(({ f, n }) => !inRange(f, n));
  const changed = parsed.filter(({ f, n }) => !bad.some((b) => b.f === f) && n !== r[f]);
  const dia = parsed.find((p) => p.f === 'dia'), sys = parsed.find((p) => p.f === 'sys');
  const flip = !!dia && !!sys && Number.isFinite(dia.n) && Number.isFinite(sys.n) && dia.n >= sys.n;
  const can = !!reason && changed.length > 0 && !bad.length && !flip && !busy;
  const save = async () => {
    if (!can || !reason) return;
    setBusy(true);
    const res = await act('reading.edit', { readingId, values: Object.fromEntries(changed.map((c) => [c.f, c.n])), reason, note: note.trim() || undefined }, { ok: t('health.edited') });
    setBusy(false);
    if (res.ok) onClose();
  };
  const label = (f: ReadingField) => FIELD_LABEL[f].label ?? t(FIELD_LABEL[f].key!);
  return (
    <Dialog open onClose={onClose} eyebrow={`${nameOf(s, r)} · ${t(CHECK_KEY[r.kind])} · ${r.time}`} title={t('health.editTitle')} maxWidth={560}
      footer={footerBtns(t('common.cancel'), onClose, <Button size={48} disabled={!can} onClick={save}>{t('health.editSave')}</Button>)}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {fields.map((f) => {
          const outOfRange = bad.some((b) => b.f === f);
          const isFlip = f === 'dia' && flip && !outOfRange;
          return (
            <Field key={f} label={`${label(f)} · ${FIELD_LABEL[f].unit}`} value={vals[f] ?? ''} inputMode="decimal" onChange={(v) => setVals((x) => ({ ...x, [f]: v.replace(',', '.').replace(/[^0-9.]/g, '') }))}
              error={outOfRange ? t('health.rangeHint', { lo: READING_RANGES[f][0], hi: READING_RANGES[f][1] }) : isFlip ? t('health.err.diaSys') : false} />
          );
        })}
      </div>
      <ChipGroup label={t('health.editWhy')} value={reason} onChange={(v) => setReason(v as EditReason)} options={(['typo', 'deviceError', 'remeasured', 'other'] as EditReason[]).map((k) => ({ value: k, label: t('health.er.' + k) }))} />
      <TextField label={t('common.note')} value={note} onChange={setNote} multiline rows={2} maxLength={280} placeholder={t('health.notePh')} />
      <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('health.editHint')}</div>
    </Dialog>
  );
}

// ---------- remove a reading ----------
export function VoidReadingDialog({ readingId, onClose, onDone }: { readingId: string; onClose: () => void; onDone?: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const r = s.readings[readingId];
  const [reason, setReason] = useState<VoidReason | null>(null);
  const [note, setNote] = useState('');
  const [withMonthly, setWithMonthly] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!r) return null;
  const twin = r.kind !== 'monthly' && Object.values(s.readings).some((x) => x !== r && !x.deletedAt && !x.voided && x.kind === 'monthly' && x.date === r.date && x.time === r.time && x.memberId === r.memberId && x.guestId === r.guestId);
  const can = !!reason && (reason !== 'other' || !!note.trim()) && !busy;
  const go = async () => {
    if (!can || !reason) return;
    setBusy(true);
    const res = await act('reading.void', { readingId, reason, note: note.trim() || undefined, withMonthly: twin && withMonthly }, { ok: t('health.voided') });
    setBusy(false);
    if (res.ok) { onClose(); onDone?.(); }
  };
  return (
    <Dialog open onClose={onClose} eyebrow={`${nameOf(s, r)} · ${t(CHECK_KEY[r.kind])} · ${r.time}`} title={t('health.voidTitle')} maxWidth={560}
      footer={footerBtns(t('common.cancel'), onClose, <Button variant="danger" size={48} disabled={!can} onClick={go}>{t('health.voidConfirm')}</Button>)}>
      <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('health.voidSub')}</div>
      <ChipGroup label={t('common.reason')} value={reason} onChange={(v) => setReason(v as VoidReason)} options={(['wrongPerson', 'deviceError', 'duplicate', 'other'] as VoidReason[]).map((k) => ({ value: k, label: t('health.vr.' + k) }))} />
      <TextField label={reason === 'other' ? `${t('common.note')} · ${t('common.required').toLowerCase()}` : t('common.note')} value={note} onChange={setNote} multiline rows={2} maxLength={280} placeholder={t('health.notePh')} />
      {twin ? <Toggle on={withMonthly} onClick={() => setWithMonthly(!withMonthly)} label={t('health.voidMonthly')} /> : null}
      {r.familyTold ? <Note tone="ochre" icon="info">{t('health.voidFamily')}</Note> : null}
    </Dialog>
  );
}

// ---------- clear a reminder (a check that is not needed after all) ----------
export function DismissDialog({ personId, kind, guest, name, onClose, onDone }: { personId: string; kind: QueueKind; guest: boolean; name: string; onClose: () => void; onDone?: () => void }) {
  const t = useT();
  const act = useAct();
  const [reason, setReason] = useState<DismissReason | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!reason || busy) return;
    setBusy(true);
    const res = await act('queue.dismiss', { ...(guest ? { guestId: personId } : { memberId: personId }), kind, reason }, { ok: t('health.removed', { n: name }) });
    setBusy(false);
    if (res.ok) { onClose(); onDone?.(); }
  };
  return (
    <Dialog open onClose={onClose} title={t('health.dismissTitle', { n: name })} maxWidth={520}
      footer={footerBtns(t('common.cancel'), onClose, <Button variant="danger" size={48} disabled={!reason || busy} onClick={go}>{t('health.dismissConfirm')}</Button>)}>
      <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('health.dismissSub')}</div>
      <ChipGroup label={t('common.reason')} value={reason} onChange={(v) => setReason(v as DismissReason)} options={(['declined', 'notNeeded', 'leftEarly', 'other'] as DismissReason[]).map((k) => ({ value: k, label: t('health.dr.' + k) }))} />
    </Dialog>
  );
}

