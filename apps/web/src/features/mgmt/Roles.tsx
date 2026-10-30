// Admin › Roles (round 16, KC): the Owner sets what each role opens (Hidden / View / Edit per menu item) and which of a role's changes wait for the Owner.
// Wide screens: a grid, roles down the side and menu items across, the three approval switches in the last columns. Phone: a role picker, then its menu list.
import { useState, type CSSProperties } from 'react';
import { GRID_ROLES, MENU_KEYS, accessOf, defaultLevel, ownerApprovalOn, type AccessLevel, type GridRole, type OwnerKind } from '@cp/shared';
import { PageHead, Select, FONT_SMALL, HAIRLINE } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { menuLabel } from '../../app/nav';
import { Page, SwitchRow } from './common';

const KINDS: OwnerKind[] = ['pricing', 'holidays', 'budget'];
const LEVELS: AccessLevel[] = ['off', 'view', 'edit'];
type Cell = AccessLevel | 'none';

export function Roles() {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const act = useAct();
  const [role, setRole] = useState<GridRole>(GRID_ROLES[0]);
  const roleName = (r: GridRole) => t('mgmt.access.role.' + r);
  const levelOptions = LEVELS.map((l) => ({ value: l, label: t('mgmt.access.' + l) }));
  // a never-set cell whose default is Off is not in the role's menu: "—" (the server leaves such a cell to the action's own `can`); Hidden there is an explicit choice
  const notInMenu = (r: GridRole, key: string) => s.club.settings.access?.[r]?.[key] === undefined && defaultLevel(r, key) === 'off';
  const noneOption = { value: 'none' as Cell, label: '—' };
  const setLevel = (r: GridRole, key: string, level: Cell) => { void act('access.set', { role: r, key, level: level === 'none' ? 'clear' : level }); };
  const setApproval = (r: GridRole, kind: OwnerKind, on: boolean) => { void act('access.setOwnerApproval', { role: r, kind, on }); };
  const cell = (r: GridRole, key: string) => (
    <Select<Cell> ariaLabel={t('mgmt.access.cell', { role: roleName(r), menu: t(menuLabel(key)) })} value={notInMenu(r, key) ? 'none' : accessOf(s, r, key)}
      options={defaultLevel(r, key) === 'off' ? [{ ...noneOption, hint: t('mgmt.access.none') }, ...levelOptions] : levelOptions} onChange={(l) => setLevel(r, key, l)} />
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

  // wide: menu items down the side (sticky), the six roles across, then the three approval switches as rows of the same columns; compact selects fit a 1024px tablet
  const compact = { '--cp-field-h': '36px' } as CSSProperties;
  const th = { padding: '8px 4px', fontSize: FONT_SMALL, fontWeight: 600, textAlign: 'left', verticalAlign: 'bottom' } as const;
  const first = { position: 'sticky', left: 0, background: 'var(--bg, #FFFFFF)', zIndex: 1, padding: '3px 8px 3px 0', fontSize: 14, fontWeight: 500, textAlign: 'left', width: 190 } as const;
  return (
    <Page>
      <PageHead title={t('mgmt.access.title')} size={32} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontFamily: 'Inter', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...th, ...first, fontWeight: 600 }}>{t('mgmt.access.menu')}</th>
              {GRID_ROLES.map((r) => <th key={r} data-role={r} scope="col" style={th}>{roleName(r)}</th>)}
            </tr>
          </thead>
          <tbody>
            {MENU_KEYS.map((k) => (
              <tr key={k} style={{ borderTop: HAIRLINE }} data-menu={k}>
                <th scope="row" style={first}>{t(menuLabel(k))}</th>
                {GRID_ROLES.map((r) => <td key={r} style={{ padding: '3px 4px', ...compact }}>{cell(r, k)}</td>)}
              </tr>
            ))}
            {KINDS.map((kind, i) => (
              <tr key={kind} style={{ borderTop: i === 0 ? '2px solid var(--hairline, #E2E2E6)' : HAIRLINE }} data-approval={kind}>
                <th scope="row" style={first}>{t('mgmt.access.approvalOf', { kind: t('mgmt.access.kind.' + kind) })}</th>
                {GRID_ROLES.map((r) => (
                  <td key={r} style={{ padding: '3px 4px' }}>
                    <SwitchRow on={ownerApprovalOn(s, r, kind)} onClick={() => setApproval(r, kind, !ownerApprovalOn(s, r, kind))} label={<span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t('mgmt.access.approvalOf', { kind: t('mgmt.access.kind.' + kind) })}: {roleName(r)}</span>} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
