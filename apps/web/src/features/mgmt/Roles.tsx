// Admin › Roles (round 16, KC): the Owner sets what each role opens (Hidden / View / Edit per menu item) and which of a role's changes wait for the Owner.
// Wide screens: a grid, roles down the side and menu items across, the three approval switches in the last columns. Phone: a role picker, then its menu list.
import { useState } from 'react';
import { GRID_ROLES, MENU_KEYS, accessOf, ownerApprovalOn, type AccessLevel, type GridRole, type OwnerKind } from '@cp/shared';
import { PageHead, Select, FONT_SMALL, HAIRLINE } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { menuLabel } from '../../app/nav';
import { Page, SwitchRow } from './common';

const KINDS: OwnerKind[] = ['pricing', 'holidays', 'budget'];
const LEVELS: AccessLevel[] = ['off', 'view', 'edit'];

export function Roles() {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const act = useAct();
  const [role, setRole] = useState<GridRole>(GRID_ROLES[0]);
  const roleName = (r: GridRole) => t('mgmt.access.role.' + r);
  const levelOptions = LEVELS.map((l) => ({ value: l, label: t('mgmt.access.' + l) }));
  const setLevel = (r: GridRole, key: string, level: AccessLevel) => { void act('access.set', { role: r, key, level }); };
  const setApproval = (r: GridRole, kind: OwnerKind, on: boolean) => { void act('access.setOwnerApproval', { role: r, kind, on }); };
  const cell = (r: GridRole, key: string) => (
    <Select<AccessLevel> ariaLabel={t('mgmt.access.cell', { role: roleName(r), menu: t(menuLabel(key)) })} value={accessOf(s, r, key)} options={levelOptions} onChange={(l) => setLevel(r, key, l)} />
  );
  const switchOf = (r: GridRole, kind: OwnerKind) => (
    <SwitchRow on={ownerApprovalOn(s, r, kind)} onClick={() => setApproval(r, kind, !ownerApprovalOn(s, r, kind))} label={t('mgmt.access.approvalOf', { kind: t('mgmt.access.kind.' + kind) })} />
  );

  if (isPhone) {
    return (
      <Page>
        <PageHead title={t('mgmt.access.title')} size={28} />
        <Select<GridRole> label={t('mgmt.access.role')} value={role} options={GRID_ROLES.map((r) => ({ value: r, label: roleName(r) }))} onChange={setRole} />
        <section aria-label={t('mgmt.access.menu')}>
          {MENU_KEYS.map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, borderTop: HAIRLINE, padding: '6px 0' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500 }}>{t(menuLabel(k))}</span>
              <div style={{ width: 130, flex: 'none' }}>{cell(role, k)}</div>
            </div>
          ))}
        </section>
        <section aria-label={t('mgmt.access.approval')}>
          {KINDS.map((kind) => <div key={kind} style={{ borderTop: HAIRLINE }}>{switchOf(role, kind)}</div>)}
        </section>
      </Page>
    );
  }

  const COL = 132;
  const th = { padding: '8px 6px', fontSize: FONT_SMALL, fontWeight: 600, textAlign: 'left', verticalAlign: 'bottom', whiteSpace: 'normal', minWidth: COL } as const;
  const firstCol = { position: 'sticky', left: 0, background: 'var(--bg, #FFFFFF)', zIndex: 1, minWidth: 150, padding: '6px 10px 6px 0', fontWeight: 600 } as const;
  return (
    <Page>
      <PageHead title={t('mgmt.access.title')} size={32} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontFamily: 'Inter' }}>
          <thead>
            <tr>
              <th style={{ ...th, ...firstCol, minWidth: 150 }}>{t('mgmt.access.role')}</th>
              {MENU_KEYS.map((k) => <th key={k} style={th}>{t(menuLabel(k))}</th>)}
              {KINDS.map((kind) => <th key={kind} style={th}>{t('mgmt.access.approval')}<br />{t('mgmt.access.kind.' + kind)}</th>)}
            </tr>
          </thead>
          <tbody>
            {GRID_ROLES.map((r) => (
              <tr key={r} style={{ borderTop: HAIRLINE }} data-role={r}>
                <th scope="row" style={{ ...firstCol, textAlign: 'left', fontSize: 15 }}>{roleName(r)}</th>
                {MENU_KEYS.map((k) => <td key={k} style={{ padding: '6px' }}>{cell(r, k)}</td>)}
                {KINDS.map((kind) => <td key={kind} style={{ padding: '6px' }}>{switchOf(r, kind)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
