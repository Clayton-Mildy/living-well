// Admin › Roles (round 16; round 17, KC: "how business standard admin role pages work"; round 18: laid out like Tasks › Team). The Owner picks a role
// from the list (each with its icon, people, "10 of 29" menus and a bar; the Owner row is locked), ticks its View and Edit checkboxes and approvals on
// the role's page (RolePage.tsx) and saves the draft in one go (access.setRole). Phone: a grouped list, then the role as a full screen with the Save
// bar at the bottom; tablet and desktop: the list card on the left, the role's card on the right. Leaving a role or the screen with unsaved changes
// asks first (lib/leaveGuard).
import { useEffect, useRef, useState } from 'react';
import { GRID_ROLES, MENU_KEYS, accessOf, draftChanges, roleDraft, staffByRole, staffCall, type GridRole, type RoleDraft } from '@cp/shared';
import { Group, PageHead, PhoneScreen, HAIRLINE } from '../../components/ui';
import { RoleRow, roleCard, type RoleItem } from '../../components/roleparts';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useLeaveGuard } from '../../lib/leaveGuard';
import { useClub } from '../../store/replica';
import { useAtLeast } from '../lobby/useAtLeast';
import { ConfirmDialog } from '../kitchen/parts';
import { Page, tn } from './common';
import { RolePage, SaveBar } from './RolePage';
export function Roles() {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const act = useAct();
  const [picked, setPicked] = useState<GridRole | null>(null);
  const [edit, setEdit] = useState<{ role: GridRole; draft: RoleDraft } | null>(null);
  const [leaving, setLeaving] = useState<{ to: GridRole | null } | null>(null);
  const [busy, setBusy] = useState(false);
  // tablet portrait (final review I-3): the list (290–330) + gap (≤24) + card (520) no longer fit side by side, so the card stacks under the list.
  // Then the list is not sticky (it would cover the card's rows) and picking a role brings its card into view.
  const rowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const side = useAtLeast(rowRef, 874).wide;
  const role = picked ?? (isPhone ? null : GRID_ROLES[0]);
  const draft = role ? (edit?.role === role ? edit.draft : roleDraft(s, role)) : null;
  const changes = role && draft ? draftChanges(s, role, draft) : 0;

  // leaving the screen (any menu, search or notification link, the back gesture, closing the tab) with a draft asks first
  const leave = useLeaveGuard(changes > 0);

  const go = (to: GridRole | null) => {
    if (to === role) return;
    if (changes) { setLeaving({ to }); return; }
    setPicked(to);
    setEdit(null);
  };
  useEffect(() => {
    if (picked && !isPhone && !side) cardRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps -- only when the Owner picks a role
  const discard = () => { setPicked(leaving?.to ?? null); setEdit(null); setLeaving(null); };
  const save = async () => {
    if (!role || !draft || !changes || busy) return;
    setBusy(true);
    const r = await act('access.setRole', { role, levels: draft.levels, approvals: draft.approvals }, { ok: t('mgmt.access.saved') });
    setBusy(false);
    if (r.ok) setEdit(null);
  };
  const roleName = (r: GridRole) => t('mgmt.access.role.' + r);
  const page = role && draft ? <RolePage key={role} role={role} draft={draft} onChange={(d) => setEdit({ role, draft: d })} surface={isPhone ? '#FFFFFF' : 'inherit'} /> : null;
  const bar = changes ? <SaveBar n={changes} busy={busy} onCancel={() => setEdit(null)} onSave={() => void save()} packed={!isPhone} /> : null;
  const ask = (
    <ConfirmDialog open={!!leaving || leave.blocked} onClose={() => (leaving ? setLeaving(null) : leave.stay())} title={tn(t, 'mgmt.access.discardAsk', changes)}
      body={role ? t('mgmt.access.discardBody', { role: roleName(role) }) : null} confirmLabel={t('mgmt.access.discard')} cancelLabel={t('common.cancel')}
      onConfirm={() => (leaving ? discard() : leave.proceed())} />
  );
  const list = <RoleList selected={isPhone ? null : role} onPick={go} phone={isPhone} />;

  if (isPhone) {
    return (
      <Page>
        <PageHead title={t('mgmt.access.title')} size={28} />
        {list}
        {role ? <PhoneScreen open onClose={() => go(null)} label={roleName(role)} back={t('mgmt.access.title')} footer={bar}>{page}</PhoneScreen> : null}
        {ask}
      </Page>
    );
  }
  return (
    <Page>
      <PageHead title={t('mgmt.access.title')} size={32} />
      <div ref={rowRef} data-roles-layout={side ? 'side' : 'stacked'} style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(14px, 2vw, 24px)', alignItems: 'flex-start' }}>
        <div data-testid="roles-list" style={side ? { flex: '0 1 330px', minWidth: 290, position: 'sticky', top: 16 } : { flex: '1 1 100%', minWidth: 0 }}>{list}</div>
        {/* not roleCard: overflow hidden would stop the View / Edit header and the Save bar from sticking */}
        <div ref={cardRef} className="cp-grey" style={{ scrollMarginTop: 16, background: roleCard.background, borderRadius: roleCard.borderRadius, flex: '1 1 520px', minWidth: 0, padding: '18px 20px 0', display: 'flex', flexDirection: 'column' }}>
          {page}
          <div style={{ position: 'sticky', bottom: 'var(--cp-tabbar, 0px)', zIndex: 4, margin: '18px -20px 0', padding: bar ? '12px 20px 14px' : '0 0 20px', borderTop: bar ? HAIRLINE : 'none', backgroundColor: 'inherit', borderRadius: '0 0 20px 20px' }}>{bar}</div>
        </div>
      </div>
      {ask}
    </Page>
  );
}

/** Owner first (full access, locked), then the six roles with their people and how many menus they open, with a bar. */
function RoleList({ selected, onPick, phone }: { selected: GridRole | null; onPick: (r: GridRole) => void; phone: boolean }) {
  const t = useT();
  const s = useClub();
  const people = (r: 'owner' | GridRole) => staffByRole(s, r).map(staffCall).filter(Boolean).join(', ');
  const owner: RoleItem = { role: 'owner', title: t('roles.owner'), icon: 'admin_panel_settings', sub: people('owner'), right: t('mgmt.roles.fullAccess'), locked: true };
  const items: RoleItem[] = [owner, ...GRID_ROLES.map((r): RoleItem => {
    const n = MENU_KEYS.filter((k) => accessOf(s, r, k) !== 'off').length;
    return { role: r, title: t('mgmt.access.role.' + r), sub: [people(r), t('mgmt.roles.ofMenus', { n, total: MENU_KEYS.length })].filter(Boolean).join(' · '), done: n, total: MENU_KEYS.length, ink: true };
  })];
  const rows = items.map((it, i) => <RoleRow key={it.role} it={it} on={it.role === selected} first={i === 0} phone={phone} onClick={() => it.role !== 'owner' && onPick(it.role)} />);
  if (phone) return <Group label={t('mgmt.access.title')} pad={0} gap={0}>{rows}</Group>;
  return <nav aria-label={t('mgmt.access.title')} className="cp-grey" style={roleCard}>{rows}</nav>;
}
