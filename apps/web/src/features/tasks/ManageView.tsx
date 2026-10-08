// Manage (management): the roles in a list, and the chosen role's details beside it, like the health station. Tabs: its general duties, each with an on/off switch and
// the time it is due (an off duty disappears from the tracker, the reminders and the badge), and its additional tasks (tap one to edit or archive it; "Add task").
import { useMemo, useState } from 'react';
import type { StaffRole, TaskTemplate } from '@cp/shared';
import { DUTIES, TASK_ROLES, dutyCfg, dutyDueBy, type DutyDef } from '@cp/shared/rules/tasks';
import { Button, FONT_SMALL, Icon, Pin, Segmented, TimeField } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { TemplateSheet } from './TemplateSheet';
import { RoleHead, RoleSplit, type RoleItem } from './RoleSplit';
import { Lines } from './TeamView';

/** One general duty: its name, the switch, and (while on) the time it is due. The time left empty means the duty's own (after each session, before each visit). */
function DutyConfig({ def, first }: { def: DutyDef; first: boolean }) {
  const t = useT();
  const s = useClub()!;
  const act = useAct();
  const cfg = dutyCfg(s, def.id);
  const on = !cfg.off;
  const natural = dutyDueBy(s, def); // management's time, else the default
  const title = t(def.titleKey);
  const save = (input: Record<string, unknown>) => void act('duty.configure', { id: def.id, ...input }, { silent: true });
  return (
    <div data-duty={def.id} data-on={on || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px 12px', minHeight: 58, backgroundColor: '#FFFFFF', backgroundImage: first ? 'none' : 'linear-gradient(#EFEAE3, #EFEAE3)', backgroundSize: 'calc(100% - 16px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 999, background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', opacity: on ? 1 : 0.55 }}><Icon name={def.icon} size={18} fill={1} /></span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, opacity: on ? 1 : 0.6 }}>
          <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{title}</span>
          {def.todayOnly ? <span style={{ fontSize: FONT_SMALL, lineHeight: '18px', color: '#6B6259' }}>{t('tasks.todayOnly')}</span> : null}
        </span>
        <button type="button" role="switch" aria-checked={on} aria-label={t('tasks.dutyOn', { title })} onClick={() => save({ off: on })} className="cp-press"
          style={{ width: 52, height: 44, flex: 'none', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <span aria-hidden="true" style={{ width: 44, height: 26, borderRadius: 999, background: on ? '#24201C' : '#CDC2B5', position: 'relative', flex: 'none', transition: 'background .15s' }}>
            <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left .15s' }} />
          </span>
        </button>
      </div>
      {on ? (
        <div style={{ paddingLeft: 40, maxWidth: 260 }}>
          <TimeField ariaLabel={`${t('tasks.dueTime')}: ${title}`} value={cfg.dueBy ?? natural ?? ''} onChange={(v) => save({ dueBy: v || null })} clearable={!!cfg.dueBy} step={5}
            placeholder={def.every === 'guest' ? t('tasks.beforeVisit') : t('tasks.afterSession')} />
        </div>
      ) : null}
    </div>
  );
}

export function ManageView() {
  const t = useT();
  const fmt = useFmt();
  const s = useClub();
  const { isPhone } = useDevice();
  const [editing, setEditing] = useState<{ tpl?: TaskTemplate; role?: StaffRole } | null>(null);
  const [tabOf, setTab] = useState<'all' | 'duties' | 'extra'>('all');
  const templates = useMemo(() => Object.values(s?.taskTemplates ?? {}).filter((x) => !x.deletedAt), [s?.taskTemplates]);
  const tasksOf = (role: StaffRole) => templates.filter((x) => x.role === role).sort((a, b) => a.every.localeCompare(b.every) || (a.dueBy ?? '99:99').localeCompare(b.dueBy ?? '99:99') || a.title.localeCompare(b.title));
  const dutiesOf = (role: StaffRole) => DUTIES.filter((d) => d.role === role);

  /** "Daily · by 08:30 · Photo": how often, when, and the photo hint, on one line. */
  const meta = (x: TaskTemplate) => {
    const parts: string[] = [];
    if (x.every === 'daily') parts.push(t('tasks.daily'));
    else if (x.every === 'weekly') parts.push(`${t('tasks.weekly')} · ${fmt.fd(`2026-10-${18 + (x.weekday ?? 1)}`, { weekday: 'short' })}`); // 19 Oct 2026 is a Monday
    else parts.push(`${t('tasks.monthly')} · ${x.dayOfMonth === 31 ? t('tasks.lastDay') : t('tasks.dayN', { n: x.dayOfMonth ?? 1 })}`);
    if (x.dueBy) parts.push(t('tasks.by', { t: x.dueBy }));
    if (x.proof === 'photo') parts.push(t('tasks.photoProof'));
    return parts.join(' · ');
  };
  if (!s) return null;

  // the role list: what each role has (duties switched on, additional tasks)
  const items: RoleItem[] = TASK_ROLES.map((role) => {
    const duties = dutiesOf(role);
    const on = duties.filter((d) => !dutyCfg(s, d.id).off).length;
    const tasks = tasksOf(role).length;
    const sub = [duties.length ? t('tasks.dutiesOn', { on, n: duties.length }) : '', tasks ? t('tasks.tasksN', { n: tasks }) : ''].filter(Boolean).join(' · ') || t('tasks.nothingYet');
    return { role, sub };
  });

  const detail = (role: StaffRole) => {
    const duties = dutiesOf(role);
    const rows = tasksOf(role);
    // KC round 7: everything at once by default, the general duties and the additional tasks in their own sections; the tabs narrow it down
    const both = duties.length > 0;
    const shown = both ? tabOf : 'extra';
    const titled = shown === 'all' && both;
    return (
      <>
        <RoleHead role={role} sub={items.find((x) => x.role === role)?.sub ?? ''} />
        {both ? <Segmented<'all' | 'duties' | 'extra'> label={t('roles.' + role)} value={shown} onChange={setTab}
          items={[{ value: 'all', label: t('tasks.allTab') }, { value: 'duties', label: t('tasks.generalDuties'), count: duties.length }, { value: 'extra', label: t('tasks.additional'), count: rows.length }]} /> : null}
        {shown !== 'extra' ? (
          <Lines title={titled ? t('tasks.generalDuties') : undefined} meta={titled ? duties.length : undefined}>{duties.map((d, i) => <DutyConfig key={d.id} def={d} first={i === 0} />)}</Lines>
        ) : null}
        {shown !== 'duties' ? (
          <>
            {rows.length ? (
              <Lines title={titled ? t('tasks.additional') : undefined} meta={titled ? rows.length : undefined}>
                {rows.map((x, i) => (
                  <button key={x.id} type="button" className="cp-bleed cp-tap-self" data-template={x.id} onClick={() => setEditing({ tpl: x })}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 10px 20px', minHeight: 58, border: 'none', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', backgroundColor: '#FFFFFF', backgroundImage: i ? 'linear-gradient(#EFEAE3, #EFEAE3)' : 'none', backgroundSize: 'calc(100% - 20px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' }}>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, opacity: x.active ? 1 : 0.6 }}>
                      <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{x.title}</span>
                      <span style={{ fontSize: 13, lineHeight: '19px', color: '#6B6259' }}>{meta(x)}</span>
                    </span>
                    {x.active ? null : <span style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: '#5E5852', background: '#F0EAE1', borderRadius: 8, padding: '2px 8px' }}>{t('tasks.paused')}</span>}
                    <Icon name="chevron_right" size={22} color="#C2B8AB" />
                  </button>
                ))}
              </Lines>
            ) : <Lines title={titled ? t('tasks.additional') : undefined} meta={titled ? 0 : undefined}><div style={{ padding: '14px 20px', fontSize: 15, color: '#6B6259' }}>{t('tasks.manageEmptyRole')}</div></Lines>}
            <div><Button size={44} variant="secondary" icon="add" onClick={() => setEditing({ role })}>{t('tasks.addFor', { role: t('roles.' + role) })}</Button></div>
          </>
        ) : null}
      </>
    );
  };

  return (
    <>
      <RoleSplit items={items} listTitle={t('tasks.rolesList')} back={t('tasks.manage')} render={detail} />
      {isPhone ? <Pin icon="add" label={t('tasks.add')} onClick={() => setEditing({})} /> : null}
      {editing ? <TemplateSheet key={editing.tpl?.id ?? 'new-' + (editing.role ?? '')} tpl={editing.tpl} role={editing.role} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
