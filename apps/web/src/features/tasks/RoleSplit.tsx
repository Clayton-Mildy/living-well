// Tasks, Team and Manage (KC round 7): a list of the roles and the chosen role's details, laid out like the health station. On tablet and laptop the list sits on
// the left and the details on the right; on a phone the list is a grouped list and a role opens full screen. The details have tabs (duties, additional tasks).
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { StaffRole } from '@cp/shared';
import { TASK_ROLE_ICON } from '@cp/shared/rules/tasks';
import { Group, Icon, PhoneScreen } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';

const RUST = '#9A3D24';
const GREEN = '#3D6B4F';
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
}

const card: CSSProperties = { background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden' };

function RoleIcon({ role, size = 36 }: { role: StaffRole; size?: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name={TASK_ROLE_ICON[role]} size={Math.round(size * 0.55)} fill={1} />
    </span>
  );
}

/** A thin score bar: green once everything is done. */
export function ScoreBar({ done = 0, total = 0, h = 3 }: { done?: number; total?: number; h?: number }) {
  if (!total) return null;
  const complete = done >= total;
  return (
    <span aria-hidden="true" style={{ display: 'block', height: h, borderRadius: 999, background: '#EFEAE3', overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: `${pct(done, total)}%`, background: complete ? GREEN : '#24201C' }} />
    </span>
  );
}

function RoleRow({ it, on, first, phone, onClick }: { it: RoleItem; on: boolean; first: boolean; phone: boolean; onClick: () => void }) {
  const t = useT();
  const complete = !!it.total && (it.done ?? 0) >= it.total;
  return (
    <button type="button" data-role-row={it.role} aria-current={on ? 'true' : undefined} onClick={onClick} className={phone ? 'cp-tap-self' : 'h-row'}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px 12px 16px', minHeight: 64, border: 'none', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter',
        backgroundColor: on ? '#F7F6F3' : '#FFFFFF', boxShadow: on ? 'inset 3px 0 0 #24201C' : 'none',
        backgroundImage: first ? 'none' : 'linear-gradient(#EFEAE3, #EFEAE3)', backgroundSize: 'calc(100% - 64px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat',
      }}>
      <RoleIcon role={it.role} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{t('roles.' + it.role)}</span>
          {it.right ? (
            <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, lineHeight: '18px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: complete ? GREEN : it.late ? RUST : '#4A4038' }}>
              {it.late ? <span aria-hidden="true" data-late style={{ width: 6, height: 6, borderRadius: 999, background: RUST }} /> : null}
              {it.right}
            </span>
          ) : null}
        </span>
        {it.sub ? <span style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.sub}</span> : null}
        <ScoreBar done={it.done} total={it.total} />
      </span>
      {phone ? <Icon name="chevron_right" size={22} color="#C2B8AB" /> : null}
    </button>
  );
}

/** The top of a role's details: its icon, name, a line under it, and the score with its bar. */
export function RoleHead({ role, sub, right, late, done, total }: Omit<RoleItem, 'role'> & { role: StaffRole }) {
  const t = useT();
  const complete = !!total && (done ?? 0) >= total;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <RoleIcon role={role} size={44} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 20, lineHeight: '26px', fontWeight: 500, letterSpacing: '-0.2px' }}>{t('roles.' + role)}</span>
          {sub ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259', overflowWrap: 'anywhere' }}>{sub}</span> : null}
        </span>
        {right ? (
          <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, lineHeight: '20px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: complete ? GREEN : late ? RUST : '#24201C' }}>
            {late ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: RUST }} /> : null}
            {right}
          </span>
        ) : null}
      </div>
      <ScoreBar done={done} total={total} h={4} />
    </div>
  );
}

export function RoleSplit({ items, listTitle, back, render, initial }: {
  items: RoleItem[];
  listTitle: string;
  /** the back label of the full-screen details on a phone */
  back: string;
  /** the details of a role */
  render: (role: StaffRole) => ReactNode;
  /** tablet and laptop: the role chosen first (default: the first late one, else the first) */
  initial?: StaffRole;
}) {
  const t = useT();
  const { isPhone } = useDevice();
  const [picked, setPicked] = useState<StaffRole | null>(null);
  const first = initial ?? items.find((x) => x.late)?.role ?? items[0]?.role;
  const cur = picked && items.some((x) => x.role === picked) ? picked : isPhone ? null : first ?? null;

  if (isPhone) {
    return (
      <>
        <Group title={listTitle} meta={items.length} pad={0} gap={0}>
          {items.map((it, i) => <RoleRow key={it.role} it={it} on={false} first={i === 0} phone onClick={() => setPicked(it.role)} />)}
        </Group>
        <PhoneScreen open={!!cur} onClose={() => setPicked(null)} label={cur ? t('roles.' + cur) : listTitle} back={back}>
          {cur ? <div data-role={cur} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 16px 24px' }}>{render(cur)}</div> : null}
        </PhoneScreen>
      </>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(14px, 2vw, 24px)', alignItems: 'flex-start' }}>
      <div data-testid="role-list" style={{ ...card, flex: '0 1 330px', minWidth: 290 }}>
        <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12, lineHeight: '16px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: '#6E5A43' }}>{listTitle}</span>
          <span style={{ fontSize: 14, color: '#6B6259' }}>{items.length}</span>
        </div>
        {items.map((it, i) => <RoleRow key={it.role} it={it} on={it.role === cur} first={i === 0} phone={false} onClick={() => setPicked(it.role)} />)}
      </div>
      <div data-role={cur ?? undefined} style={{ ...card, flex: '1 1 520px', minWidth: 0, padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {cur ? render(cur) : null}
      </div>
    </div>
  );
}
