// Tasks, Team and Manage (KC round 7): a list of the roles and the chosen role's details, laid out like the health station. On tablet and laptop the list sits on
// the left and the details on the right; on a phone the list is a grouped list and a role opens full screen. The details have tabs (duties, additional tasks).
// Round 18: the parts (RoleRow, RoleHead, ScoreBar, RoleIcon, Lines) live in components/roleparts.tsx, shared with Admin › Roles.
import { useState, type ReactNode } from 'react';
import type { StaffRole } from '@cp/shared';
import { Group, PhoneScreen } from '../../components/ui';
import { RoleRow, roleCard as card, type RoleItem } from '../../components/roleparts';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';

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
        <PhoneScreen open={!!cur} onClose={() => setPicked(null)} label={cur ? t('mgmt.access.role.' + cur) : listTitle} back={back}>
          {cur ? <div data-role={cur} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 16px 24px' }}>{render(cur)}</div> : null}
        </PhoneScreen>
      </>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(14px, 2vw, 24px)', alignItems: 'flex-start' }}>
      <div data-testid="role-list" className="cp-grey" style={{ ...card, flex: '0 1 330px', minWidth: 290 }}>
        <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12, lineHeight: '16px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: 'var(--eyebrow, #6E5A43)' }}>{listTitle}</span>
          <span style={{ fontSize: 14, color: '#6B6259' }}>{items.length}</span>
        </div>
        {items.map((it, i) => <RoleRow key={it.role} it={it} on={it.role === cur} first={i === 0} phone={false} onClick={() => setPicked(it.role)} />)}
      </div>
      <div data-role={cur ?? undefined} className="cp-grey" style={{ ...card, flex: '1 1 520px', minWidth: 0, padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {cur ? render(cur) : null}
      </div>
    </div>
  );
}
