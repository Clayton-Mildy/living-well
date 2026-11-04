// Mine: the signed-in role's day. First the general duties ("Today's duties": a picture of each session, the lunch photo, the checks…): late ones on top with a rust dot, then
// those waiting for their time, done ones last; tap one to go where it is done. Then the additional tasks (management's checklist: tap the circle to tick; proof tasks open
// the camera first), then "This week" and "This month" (weekly and monthly tasks, visible until done, rust dot once past their day).
import { useMemo, useState } from 'react';
import type { ClubState, ISODate, StaffRole, TaskTemplate } from '@cp/shared';
import { dayStatus } from '@cp/shared';
import { partLate, roleSummary, type DutyPart } from '@cp/shared/rules/tasks';
import { EmptyState, Group, Icon } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { MyLeave } from '../staffLeave/MyLeave';
import { TemplateSheet } from './TemplateSheet';
import { DutyRow, Progress, TaskRow, TaskSheet, useTick, whoIs } from './parts';

/** A role with Tasks on Edit: its own paused task, greyed at the bottom of its group; no tick circle, tap opens the edit sheet to switch it back on. */
function PausedRow({ tpl, first, onOpen }: { tpl: TaskTemplate; first: boolean; onOpen: () => void }) {
  const t = useT();
  return (
    <button type="button" className="cp-bleed cp-tap-self" data-paused={tpl.id} onClick={onOpen}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px 4px 16px', minHeight: 56, border: 'none', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', backgroundColor: 'transparent', backgroundImage: first ? 'none' : 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)', backgroundSize: 'calc(100% - 16px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere', opacity: 0.55 }}>{tpl.title}</span>
      <span className="cp-fill" style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: '#5E5852', background: 'var(--fill, #F4F4F5)', borderRadius: 8, padding: '2px 8px' }}>{t('tasks.paused')}</span>
    </button>
  );
}

export function MineView({ s, role, canEdit = false, today, nowMin }: { s: ClubState; role: StaffRole; /** Tasks on Edit: "+ Add" in Additional tasks, Edit on one's own tasks, one's paused tasks */ canEdit?: boolean; today: ISODate; nowMin: number }) {
  const t = useT();
  const { isPhone } = useDevice();
  const { id: me, role: myRole, realRole } = useMe();
  const tick = useTick();
  const [openKey, setOpenKey] = useState<{ id: string; period: string } | null>(null);
  const sum = useMemo(() => roleSummary(s, role, today, today, nowMin, { owner: realRole === 'owner' }), [s, role, today, nowMin, realRole]); // round 16: the Owner's approvals duty counts his requests
  const who = (id: string) => whoIs(s, id);
  const status = dayStatus(s, today);
  // late first, then by the time they are due; done ones go last
  const parts = useMemo(() => {
    const rank = (p: DutyPart) => (p.done ? 2 : partLate(p, today, today, nowMin) ? 0 : 1);
    return sum.duties.flatMap((d) => d.parts.map((p) => ({ def: d.def, part: p }))).sort((a, b) => rank(a.part) - rank(b.part) || a.part.due.localeCompare(b.part.due));
  }, [sum.duties, today, nowMin]);
  const [editing, setEditing] = useState<{ tpl?: TaskTemplate } | null>(null);
  const mine = (x: TaskTemplate) => x.createdBy === `staff:${me}`;
  const paused = useMemo(() => (canEdit ? Object.values(s.taskTemplates).filter((x) => !x.deletedAt && x.active === false && x.role === role && x.createdBy === `staff:${me}`)
    .sort((a, b) => a.title.localeCompare(b.title)) : []), [s.taskTemplates, canEdit, role, me]);
  const groups = [
    { key: 'additional', every: 'daily', title: t('tasks.additional') },
    { key: 'week', every: 'weekly', title: t('tasks.thisWeek') },
    { key: 'month', every: 'monthly', title: t('tasks.thisMonth') },
  ].map((g) => ({ ...g, items: sum.custom.filter((i) => i.template.every === g.every), paused: paused.filter((x) => x.every === g.every) }))
    .filter((g) => g.items.length || g.paused.length || (canEdit && g.key === 'additional'));
  const open = openKey ? sum.custom.find((i) => i.template.id === openKey.id && i.period === openKey.period) : undefined;
  // the progress line is the duties' score (the tracker); a role with no duties shows its additional tasks instead
  const done = sum.total ? sum.done : sum.customDone;
  const total = sum.total ? sum.total : sum.customTotal;

  // round 13: the last group is your own leave (what is left this year, ask for days off), also on a closed or empty day
  const leave = <Group title={t('tasks.leaveGroup')} pad="14px 16px" gap={0}><MyLeave /></Group>;
  if (!status.open) return <><EmptyState icon="event_busy" title={t('tasks.closed')} />{leave}</>;
  if (!parts.length && !sum.custom.length && !groups.length) return <><EmptyState icon="checklist" title={t('tasks.empty')} />{leave}</>;
  return (
    <>
      <Progress done={done} total={total} />
      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))', gap: isPhone ? 22 : 24, alignItems: 'start' }}>
        {parts.length ? (
          <Group title={t('tasks.duties')} pad={0} gap={0}>
            {parts.map(({ def, part }, i) => <DutyRow key={def.id + part.key} s={s} def={def} part={part} date={today} today={today} nowMin={nowMin} first={i === 0} />)}
          </Group>
        ) : null}
        {groups.map((g) => (
          <Group key={g.key} title={g.title} pad={0} gap={0} meta={canEdit && g.key === 'additional' ? (
            <button type="button" className="cp-press" onClick={() => setEditing({})}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent', padding: '2px 0 2px 8px', margin: '-2px 0', cursor: 'pointer', fontFamily: 'Inter', fontSize: 14, fontWeight: 600, lineHeight: '18px', color: '#24201C' }}>
              <Icon name="add" size={18} />{t('common.add')}
            </button>
          ) : undefined}>
            {g.items.length || g.paused.length ? null : <div style={{ padding: '16px', fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{t('tasks.noneYet')}</div>}
            {g.items.map((item, i) => (
              <TaskRow key={item.template.id} item={item} date={today} first={i === 0} who={who} canTick busy={tick.busy === item.template.id}
                onTick={() => void tick.tick(item.template)} onOpen={() => setOpenKey({ id: item.template.id, period: item.period })} />
            ))}
            {g.paused.map((x, i) => <PausedRow key={x.id} tpl={x} first={!g.items.length && i === 0} onOpen={() => setEditing({ tpl: x })} />)}
          </Group>
        ))}
        {leave}
      </div>
      {open ? (
        <TaskSheet key={open.template.id + open.period} item={open} date={today} who={who} canTick canUndo={!!open.done && (myRole === 'mgmt' || (open.done.by === me && open.done.date === today))}
          tick={tick} onClose={() => setOpenKey(null)}
          onEdit={canEdit && mine(open.template) ? () => { setOpenKey(null); setEditing({ tpl: open.template }); } : undefined} />
      ) : null}
      {editing ? <TemplateSheet key={editing.tpl?.id ?? 'new'} tpl={editing.tpl} team={role} onClose={() => setEditing(null)} /> : null}
      {tick.camera}
    </>
  );
}
