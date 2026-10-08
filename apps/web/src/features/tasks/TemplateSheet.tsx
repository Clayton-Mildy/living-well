// Add or edit a recurring task (management): its name, the role, how often (daily / weekly on a weekday / monthly on a day), a time it is due by,
// whether ticking it off needs a photo, and whether it is active. Archiving stops it showing from today; what was ticked off stays on record.
import { useState } from 'react';
import type { StaffRole, TaskEvery, TaskTemplate } from '@cp/shared';
import { LAST_DAY, TASK_ROLES } from '@cp/shared/rules/tasks';
import { Button, Dialog, Select, Sheet, TextField, TimeField, Toggle } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useFmt, useT } from '../../lib/i18n';

export function TemplateSheet({ tpl, role: forRole, onClose }: { /** the task being edited; none = a new one */ tpl?: TaskTemplate; /** a new task: the role it starts on */ role?: StaffRole; onClose: () => void }) {
  const t = useT();
  const fmt = useFmt();
  const act = useAct();
  const [title, setTitle] = useState(tpl?.title ?? '');
  const [role, setRole] = useState<StaffRole>(tpl?.role ?? forRole ?? 'lobby');
  const [every, setEvery] = useState<TaskEvery>(tpl?.every ?? 'daily');
  const [weekday, setWeekday] = useState(String(tpl?.weekday ?? 1));
  const [day, setDay] = useState(String(tpl?.dayOfMonth ?? 1));
  const [dueBy, setDueBy] = useState(tpl?.dueBy ?? '');
  const [proof, setProof] = useState(tpl?.proof === 'photo');
  const [active, setActive] = useState(tpl?.active ?? true);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const save = async () => {
    setTried(true);
    if (!title.trim() || busy) return;
    setBusy(true);
    const r = await act('task.saveTemplate', {
      ...(tpl ? { id: tpl.id } : {}), title: title.trim(), role, every,
      ...(every === 'weekly' ? { weekday: +weekday } : {}), ...(every === 'monthly' ? { dayOfMonth: +day } : {}),
      ...(dueBy ? { dueBy } : {}), proof: proof ? 'photo' : 'none', active,
    }, { ok: t('tasks.saved') });
    setBusy(false);
    if (r.ok) onClose();
  };
  const archive = async () => {
    if (!tpl) return;
    setBusy(true);
    const r = await act('task.archiveTemplate', { id: tpl.id }, { ok: t('tasks.archived') });
    setBusy(false);
    if (r.ok) onClose();
  };
  // 19 Oct 2026 is a Monday: weekday names in the reader's language
  const weekdays = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: fmt.fd(`2026-10-${18 + n}`, { weekday: 'long' }) }));
  const days = [...Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: t('tasks.dayN', { n: i + 1 }) })), { value: String(LAST_DAY), label: t('tasks.lastDay') }];

  return (
    <>
      <Sheet open onClose={onClose} title={t(tpl ? 'tasks.editTitle' : 'tasks.newTitle')}
        footer={(
          <div style={{ display: 'flex', gap: 10 }}>
            {tpl ? <Button variant="secondary" icon="inventory_2" disabled={busy} onClick={() => setArchiving(true)}>{t('tasks.archive')}</Button> : null}
            <Button full disabled={busy} onClick={() => void save()}>{t('tasks.save')}</Button>
          </div>
        )}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TextField label={t('tasks.fTitle')} value={title} onChange={setTitle} maxLength={120} autoFocus={!tpl} error={tried && !title.trim() && t('tasks.titleRequired')} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
            <Select label={t('tasks.fRole')} value={role} onChange={setRole} options={TASK_ROLES.map((r) => ({ value: r, label: t('roles.' + r) }))} />
            <Select label={t('tasks.fEvery')} value={every} onChange={setEvery} options={(['daily', 'weekly', 'monthly'] as const).map((e) => ({ value: e, label: t('tasks.' + e) }))} />
          </div>
          {every === 'weekly' ? <Select label={t('tasks.fWeekday')} value={weekday} onChange={setWeekday} options={weekdays} /> : null}
          {every === 'monthly' ? <Select label={t('tasks.fDay')} value={day} onChange={setDay} options={days} searchable={false} /> : null}
          <TimeField label={t('tasks.fDueBy')} value={dueBy} onChange={setDueBy} clearable />
          <Toggle on={proof} onClick={() => setProof((x) => !x)} label={t('tasks.fProof')} sub={t('tasks.fProofSub')} />
          <Toggle on={active} onClick={() => setActive((x) => !x)} label={t('tasks.fActive')} />
        </div>
      </Sheet>
      {archiving && tpl ? (
        <Dialog open onClose={() => setArchiving(false)} title={t('tasks.archiveTitle')} maxWidth={420}
          footer={<><Button variant="secondary" onClick={() => setArchiving(false)}>{t('tasks.keep')}</Button><Button variant="danger" disabled={busy} onClick={() => void archive()}>{t('tasks.archive')}</Button></>}>
          <div style={{ fontSize: 15, lineHeight: '22px', color: '#4A4038' }}>{t('tasks.archiveAsk', { title: tpl.title })}</div>
        </Dialog>
      ) : null}
    </>
  );
}
