// Mine: the signed-in role's day. First the general duties ("Today's duties": a picture of each session, the lunch photo, the checks…): late ones on top with a rust dot, then
// those waiting for their time, done ones last; tap one to go where it is done. Then the additional tasks (management's checklist: tap the circle to tick; proof tasks open
// the camera first), then "This week" and "This month" (weekly and monthly tasks, visible until done, rust dot once past their day).
import { useMemo, useState } from 'react';
import type { ClubState, ISODate, StaffRole } from '@cp/shared';
import { dayStatus } from '@cp/shared';
import { partLate, roleSummary, type DutyPart } from '@cp/shared/rules/tasks';
import { EmptyState, Group } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { DutyRow, Progress, TaskRow, TaskSheet, useTick, whoIs } from './parts';

export function MineView({ s, role, today, nowMin }: { s: ClubState; role: StaffRole; today: ISODate; nowMin: number }) {
  const t = useT();
  const { isPhone } = useDevice();
  const { id: me, role: myRole } = useMe();
  const tick = useTick();
  const [openKey, setOpenKey] = useState<{ id: string; period: string } | null>(null);
  const sum = useMemo(() => roleSummary(s, role, today, today, nowMin), [s, role, today, nowMin]);
  const who = (id: string) => whoIs(s, id);
  const status = dayStatus(s, today);
  // late first, then by the time they are due; done ones go last
  const parts = useMemo(() => {
    const rank = (p: DutyPart) => (p.done ? 2 : partLate(p, today, today, nowMin) ? 0 : 1);
    return sum.duties.flatMap((d) => d.parts.map((p) => ({ def: d.def, part: p }))).sort((a, b) => rank(a.part) - rank(b.part) || a.part.due.localeCompare(b.part.due));
  }, [sum.duties, today, nowMin]);
  const groups = [
    { key: 'additional', title: t('tasks.additional'), items: sum.custom.filter((i) => i.template.every === 'daily') },
    { key: 'week', title: t('tasks.thisWeek'), items: sum.custom.filter((i) => i.template.every === 'weekly') },
    { key: 'month', title: t('tasks.thisMonth'), items: sum.custom.filter((i) => i.template.every === 'monthly') },
  ].filter((g) => g.items.length);
  const open = openKey ? sum.custom.find((i) => i.template.id === openKey.id && i.period === openKey.period) : undefined;
  // the progress line is the duties' score (the tracker); a role with no duties (housekeeping, the driver) shows its additional tasks instead
  const done = sum.total ? sum.done : sum.customDone;
  const total = sum.total ? sum.total : sum.customTotal;

  if (!status.open) return <EmptyState icon="event_busy" title={t('tasks.closed')} />;
  if (!parts.length && !sum.custom.length) return <EmptyState icon="checklist" title={t('tasks.empty')} />;
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
          <Group key={g.key} title={g.title} pad={0} gap={0}>
            {g.items.map((item, i) => (
              <TaskRow key={item.template.id} item={item} date={today} first={i === 0} who={who} canTick busy={tick.busy === item.template.id}
                onTick={() => void tick.tick(item.template)} onOpen={() => setOpenKey({ id: item.template.id, period: item.period })} />
            ))}
          </Group>
        ))}
      </div>
      {open ? (
        <TaskSheet key={open.template.id + open.period} item={open} date={today} who={who} canTick canUndo={!!open.done && (myRole === 'mgmt' || (open.done.by === me && open.done.date === today))}
          tick={tick} onClose={() => setOpenKey(null)} />
      ) : null}
      {tick.camera}
    </>
  );
}
