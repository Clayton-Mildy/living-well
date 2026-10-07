// "This date only": change one date's lunch, soft option or tea without touching the weekly template.
import { useState } from 'react';
import { dayStatus, menuOn } from '@cp/shared';
import { COURSES, sameIds, type Course } from '@cp/shared/rules/kitchenOps';
import { Button, DateField, Sheet, Note, FONT_BODY } from '../../components/ui';
import { PendingMark } from '../../components/PendingMark';
import { useMe } from '../../lib/me';
import { useT } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { DishField, DishPicker } from './dish';
import { TextButton, useResetOn } from './parts';

export function OverrideSheet({ open, onClose, initialDate }: { open: boolean; onClose: () => void; initialDate: string }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { today } = useNow();
  const { role } = useMe();
  const [date, setDate] = useState(initialDate);
  const [edits, setEdits] = useState<Partial<Record<Course, string[]>>>({});
  const [picker, setPicker] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
  useResetOn(open ? initialDate : null, () => { if (open) { setDate(initialDate); setEdits({}); setPicker(null); } });
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date + 'T00:00:00Z'));
  const past = validDate && date < today;
  const menu = validDate && !past ? menuOn(s, date) : null; // null on closed days and weekends
  const row = validDate ? s.dayMenus[date] : undefined;
  const cur = (c: Course) => edits[c] ?? menu?.[c] ?? [];
  const changed = COURSES.filter((c) => edits[c] && !sameIds(edits[c]!, menu?.[c] ?? []));
  const setCourse = (c: Course, ids: string[]) => setEdits((e) => ({ ...e, [c]: ids }));
  const save = async () => {
    if (!changed.length || busy) return;
    setBusy(true);
    const r = await act('dayMenu.override', { date, ...Object.fromEntries(changed.map((c) => [c, edits[c]])) }, { ok: t('kitchen.override.done') });
    setBusy(false);
    if (r.ok) onClose();
  };
  const reset = async (c: Course) => {
    setBusy(true);
    const r = await act('dayMenu.override', { date, [c]: null }, { ok: t('kitchen.override.reset') });
    setBusy(false);
    if (r.ok) setEdits((e) => { const n = { ...e }; delete n[c]; return n; });
  };
  const error = !validDate ? t('err.invalid') : past ? t('kitchen.err.pastDate') : !menu ? t('err.closedDay') : undefined;
  return (
    <>
      <Sheet open={open && !picker} onClose={onClose} title={t('kitchen.override.title')}
        footer={<Button full style={{ flex: 'none' }} onClick={save} disabled={!changed.length || busy || !!error}>{t('kitchen.override.save')}</Button>}>
        {role !== 'mgmt' ? <Note tone="ochre" icon="hourglass_top">{t('approvals.menuNeeds')}</Note> : null}
        <PendingMark row={row} />
        <DateField label={t('common.date')} value={date} onChange={(v) => { setDate(v); setEdits({}); }} min={today} disabledDate={(d) => !dayStatus(s, d).open} error={error} />
        {menu ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {COURSES.map((c) => (
              <div key={c} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <DishField label={t('kitchen.course.' + c)} course={c} ids={cur(c)} flex="1 1 auto" onRemove={(id) => setCourse(c, cur(c).filter((x) => x !== id))} onAdd={() => setPicker(c)} testId={'override-' + c} />
                {row?.[c] && !edits[c] ? <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: FONT_BODY, color: '#7A5510' }}>{t('kitchen.override.isChanged')}</span><TextButton onClick={() => reset(c)}>{t('kitchen.override.backToWeekly')}</TextButton></div> : null}
              </div>
            ))}
          </div>
        ) : error ? <Note tone="cream" icon="event_busy">{error}</Note> : null}
      </Sheet>
      {picker ? (
        <DishPicker open onClose={() => setPicker(null)} title={t('kitchen.picker.title', { course: t('kitchen.course.' + picker) })} course={picker} picked={cur(picker)}
          onToggle={(id) => setCourse(picker, cur(picker).includes(id) ? cur(picker).filter((x) => x !== id) : [...cur(picker), id])}
          onCreated={(id) => setCourse(picker, [...cur(picker), id])} />
      ) : null}
    </>
  );
}
