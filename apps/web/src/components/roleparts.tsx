// The parts of a role list and a role's details (round 7's Tasks › Team and Manage; round 18: Admin › Roles uses them too, R3):
// the role's icon, its thin score bar, a list row, the head of its details, and the sections of rows under it.
import type { CSSProperties, ReactNode } from 'react';
import type { StaffRole } from '@cp/shared';
import { TASK_ROLE_ICON } from '@cp/shared/rules/tasks';
import { Group, Icon } from './ui';
import { useDevice } from '../hooks/useDevice';
import { useT } from '../lib/i18n';

const RUST = '#9A3D24';
const GREEN = '#3D6B4F';
const INK = '#24201C';
export const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

export interface RoleItem {
  role: StaffRole;
  /** the people, or what the role has */
  sub: string;
  /** the score on the right ("1 of 3 done", "90%") */
  right?: string;
  late?: boolean;
  done?: number;
  total?: number;
  /** the role's name when it is not `roles.<role>` (Admin › Roles names them as the grid does: "Front desk") */
  title?: string;
  /** the icon when it is not the role's own */
  icon?: string;
  /** a row that cannot be picked (Admin › Roles' Owner): a lock before the right text, no chevron */
  locked?: boolean;
  /** the bar stays ink when full (a share, not a score) */
  ink?: boolean;
}

/** The grey card of a role list or a role's details (tablet and laptop). */
export const roleCard: CSSProperties = { background: 'var(--fill, #F4F4F5)', borderRadius: 20, overflow: 'hidden' };

export function RoleIcon({ role, size = 36, icon }: { role: StaffRole; size?: number; icon?: string }) {
  return (
    <span aria-hidden="true" className="cp-fill" style={{ width: size, height: size, borderRadius: 999, background: 'var(--fill, #F4F4F5)', color: 'var(--accent, #75624B)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name={icon ?? TASK_ROLE_ICON[role]} size={Math.round(size * 0.55)} fill={1} />
    </span>
  );
}

/** A thin score bar: green once everything is done (unless `ink`). */
export function ScoreBar({ done = 0, total = 0, h = 3, ink }: { done?: number; total?: number; h?: number; ink?: boolean }) {
  if (!total) return null;
  const complete = done >= total && !ink;
  return (
    <span aria-hidden="true" className="cp-fill" style={{ display: 'block', height: h, borderRadius: 999, background: 'var(--press, #EEEEF0)', overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: `${pct(done, total)}%`, background: complete ? GREEN : INK }} />
    </span>
  );
}

export function RoleRow({ it, on, first, phone, onClick }: { it: RoleItem; on: boolean; first: boolean; phone: boolean; onClick: () => void }) {
  const t = useT();
  const complete = !!it.total && (it.done ?? 0) >= it.total && !it.ink;
  const style: CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px 12px 16px', minHeight: 64, border: 'none', textAlign: 'left', cursor: it.locked ? 'default' : 'pointer', color: INK, fontFamily: 'Inter',
    backgroundColor: on ? 'var(--press, #EEEEF0)' : 'transparent', boxShadow: on ? `inset 3px 0 0 ${INK}` : 'none',
    backgroundImage: first ? 'none' : 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)', backgroundSize: 'calc(100% - 64px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat',
  };
  const body = (
    <>
      <RoleIcon role={it.role} icon={it.icon} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{it.title ?? t('roles.' + it.role)}</span>
          {it.right ? (
            <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, lineHeight: '18px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: complete ? GREEN : it.late ? RUST : it.locked ? '#6B6259' : '#4A4038' }}>
              {it.late ? <span aria-hidden="true" data-late style={{ width: 6, height: 6, borderRadius: 999, background: RUST }} /> : null}
              {it.locked ? <Icon name="lock" size={15} fill={1} /> : null}
              {it.right}
            </span>
          ) : null}
        </span>
        {it.sub ? <span style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.sub}</span> : null}
        <ScoreBar done={it.done} total={it.total} ink={it.ink} />
      </span>
      {phone && !it.locked ? <Icon name="chevron_right" size={22} color="#A89C8E" /> : null}
    </>
  );
  if (it.locked) return <div data-role-row={it.role} style={style}>{body}</div>;
  return (
    <button type="button" data-role-row={it.role} aria-current={on ? 'true' : undefined} onClick={onClick} className={phone ? 'cp-tap-self' : 'h-row'} style={style}>
      {body}
    </button>
  );
}

/** The top of a role's details: its icon, name, a line under it, and the score with its bar. */
export function RoleHead({ role, sub, right, late, done, total, title, icon, ink }: Omit<RoleItem, 'role'> & { role: StaffRole }) {
  const t = useT();
  const complete = !!total && (done ?? 0) >= total && !ink;
  return (
    <div data-role-head style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <RoleIcon role={role} size={44} icon={icon} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 20, lineHeight: '26px', fontWeight: 500, letterSpacing: '-0.2px' }}>{title ?? t('roles.' + role)}</span>
          {sub ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259', overflowWrap: 'anywhere' }}>{sub}</span> : null}
        </span>
        {right ? (
          <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, lineHeight: '20px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: complete ? GREEN : late ? RUST : INK }}>
            {late ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: RUST }} /> : null}
            {right}
          </span>
        ) : null}
      </div>
      <ScoreBar done={done} total={total} h={4} ink={ink} />
    </div>
  );
}

/** The rows of a role's details: a white grouped list on a phone, edge to edge inside the details card on wider screens. */
export function Lines({ title, meta, children }: { /** a section title above the rows (the "All" view: duties, then additional tasks) */ title?: string; meta?: ReactNode; children: ReactNode }) {
  const { isPhone } = useDevice();
  if (isPhone) return <Group title={title} meta={meta} pad={0} gap={0}>{children}</Group>;
  return (
    <section data-section={title ? 'titled' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {title ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '4px 0 2px' }}>
          <span style={{ fontSize: 12, lineHeight: '16px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: 'var(--eyebrow, #6E5A43)' }}>{title}</span>
          {meta != null ? <span style={{ fontSize: 13, color: '#6B6259' }}>{meta}</span> : null}
        </div>
      ) : null}
      <div style={{ margin: '0 -20px' }}>{children}</div>
    </section>
  );
}
