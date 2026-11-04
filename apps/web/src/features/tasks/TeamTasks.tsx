// tasks-view-edit (KC): a role with Tasks on Edit (Admin › Roles) sees its team's additional tasks under its own day, each with who made it
// ("by you" / "by Ega"), and an ink "Add task". Its own tasks open in the edit sheet (For fixed to the team); the others open read-only. No Manage, scores or duty settings.
import { useMemo, useState } from 'react';
import { actorName, type StaffRole, type TaskTemplate } from '@cp/shared';
import { Button, Icon, Pin, Sheet } from '../../components/ui';
import { Lines } from '../../components/roleparts';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { TemplateSheet } from './TemplateSheet';
import { useTaskMeta } from './parts';

const MUTED = '#6B6259';

export function TeamTasks({ role }: { role: StaffRole }) {
  const t = useT();
  const s = useClub();
  const { id: me } = useMe();
  const { isPhone } = useDevice();
  const meta = useTaskMeta();
  const [editing, setEditing] = useState<{ tpl?: TaskTemplate } | null>(null);
  const [viewing, setViewing] = useState<TaskTemplate | null>(null);
  const rows = useMemo(() => Object.values(s?.taskTemplates ?? {}).filter((x) => !x.deletedAt && x.role === role)
    .sort((a, b) => a.every.localeCompare(b.every) || (a.dueBy ?? '99:99').localeCompare(b.dueBy ?? '99:99') || a.title.localeCompare(b.title)), [s?.taskTemplates, role]);
  if (!s) return null;
  const team = t('mgmt.access.role.' + role);
  const mine = (x: TaskTemplate) => x.createdBy === `staff:${me}`;
  const by = (x: TaskTemplate) => (mine(x) ? t('tasks.byYou') : t('tasks.byName', { name: actorName(s, x.createdBy) }));

  return (
    <div data-team-tasks style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.length ? (
        <Lines title={t('tasks.teamTasks', { team })} meta={rows.length}>
          {rows.map((x, i) => (
            <button key={x.id} type="button" className="cp-bleed cp-tap-self" data-template={x.id} data-mine={mine(x) || undefined} onClick={() => (mine(x) ? setEditing({ tpl: x }) : setViewing(x))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 20px', minHeight: 52, border: 'none', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', backgroundColor: 'transparent', backgroundImage: i ? 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)' : 'none', backgroundSize: 'calc(100% - 20px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' }}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, opacity: x.active ? 1 : 0.6 }}>
                <span style={{ fontSize: 15, lineHeight: '21px', fontWeight: 500, overflowWrap: 'anywhere' }}>{x.title}</span>
                <span style={{ fontSize: 13, lineHeight: '18px', color: MUTED }}>{meta(x)} · {by(x)}</span>
              </span>
              {x.active ? null : <span className="cp-fill" style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: '#5E5852', background: 'var(--fill, #F4F4F5)', borderRadius: 8, padding: '2px 8px' }}>{t('tasks.paused')}</span>}
              <Icon name={mine(x) ? 'chevron_right' : 'visibility'} size={20} color="#A89C8E" />
            </button>
          ))}
        </Lines>
      ) : null}
      {isPhone ? <Pin icon="add" label={t('tasks.add')} onClick={() => setEditing({})} /> : <div><Button size={44} icon="add" onClick={() => setEditing({})}>{t('tasks.add')}</Button></div>}
      {editing ? <TemplateSheet key={editing.tpl?.id ?? 'new'} tpl={editing.tpl} team={role} onClose={() => setEditing(null)} /> : null}
      {viewing ? (
        <Sheet open onClose={() => setViewing(null)} title={viewing.title}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 15, lineHeight: '22px', color: '#24201C' }}>
            <span>{meta(viewing)}{viewing.active ? '' : ` · ${t('tasks.paused')}`}</span>
            <span style={{ color: MUTED }}>{team} · {by(viewing)}</span>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
