// Admin › Roles (round 16; round 17, KC: "how business standard admin role pages work"). The Owner picks a role from the list, ticks its View and Edit
// checkboxes and approvals on the role's page (RolePage.tsx) and saves the draft in one go (access.setRole). Phone: the list, then the role as a pushed screen;
// tablet and desktop: the list on the left, the role on the right. Leaving a role or the screen with unsaved changes asks first (lib/leaveGuard).
import { useState } from 'react';
import { GRID_ROLES, MENU_KEYS, accessOf, draftChanges, roleDraft, staffByRole, staffCall, type GridRole, type RoleDraft } from '@cp/shared';
import { Icon, PageHead, PhoneScreen, FONT_SMALL, HAIRLINE } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useLeaveGuard } from '../../lib/leaveGuard';
import { useClub } from '../../store/replica';
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
  const discard = () => { setPicked(leaving?.to ?? null); setEdit(null); setLeaving(null); };
  const save = async () => {
    if (!role || !draft || !changes || busy) return;
    setBusy(true);
    const r = await act('access.setRole', { role, levels: draft.levels, approvals: draft.approvals }, { ok: t('mgmt.access.saved') });
    setBusy(false);
    if (r.ok) setEdit(null);
  };
  const roleName = (r: GridRole) => t('mgmt.access.role.' + r);
  const page = role && draft ? <RolePage role={role} draft={draft} onChange={(d) => setEdit({ role, draft: d })} surface={isPhone ? '#FFFFFF' : 'var(--page, #FFFFFF)'} /> : null;
  const bar = changes ? <SaveBar n={changes} busy={busy} onCancel={() => setEdit(null)} onSave={() => void save()} packed={!isPhone} /> : null;
  const ask = (
    <ConfirmDialog open={!!leaving || leave.blocked} onClose={() => (leaving ? setLeaving(null) : leave.stay())} title={tn(t, 'mgmt.access.discardAsk', changes)}
      body={role ? t('mgmt.access.discardBody', { role: roleName(role) }) : null} confirmLabel={t('mgmt.access.discard')} cancelLabel={t('common.cancel')}
      onConfirm={() => (leaving ? discard() : leave.proceed())} />
  );
  const list = <RoleList selected={isPhone ? null : role} onPick={go} />;

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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: 'clamp(20px, 3vw, 40px)', alignItems: 'start' }}>
        <div style={{ position: 'sticky', top: 16, minWidth: 0 }}>{list}</div>
        <div style={{ minWidth: 0, maxWidth: 720, display: 'flex', flexDirection: 'column' }}>
          {page}
          {bar ? <div style={{ position: 'sticky', bottom: 'var(--cp-tabbar, 0px)', zIndex: 4, marginTop: 18, padding: '12px 0 14px 16px', borderTop: HAIRLINE, background: 'var(--page, #FFFFFF)' }}>{bar}</div> : null}
        </div>
      </div>
      {ask}
    </Page>
  );
}

/** Owner first (full access, not editable), then the six roles with their people and how many menus they open. */
function RoleList({ selected, onPick }: { selected: GridRole | null; onPick: (r: GridRole) => void }) {
  const t = useT();
  const s = useClub();
  const people = (r: 'owner' | GridRole) => staffByRole(s, r).map(staffCall).filter(Boolean).join(', ');
  const row = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '8px 12px 8px 16px', border: 'none', background: 'transparent', textAlign: 'left', fontFamily: 'Inter', color: '#24201C' } as const;
  const text = (title: string, sub: string) => (
    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>{title}</span>
      {sub ? <span style={{ fontSize: FONT_SMALL, color: '#6B6259', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span> : null}
    </span>
  );
  const meta = { fontSize: FONT_SMALL, color: '#6B6259', flex: 'none', whiteSpace: 'nowrap' } as const;
  return (
    <nav aria-label={t('mgmt.access.title')} className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>
      <div data-role="owner" style={row}>
        {text(t('roles.owner'), people('owner'))}
        <span style={meta}>{t('mgmt.access.fullAccess')}</span>
      </div>
      {GRID_ROLES.map((r) => {
        const on = r === selected;
        const n = MENU_KEYS.filter((k) => accessOf(s, r, k) !== 'off').length;
        return (
          <button key={r} type="button" data-role={r} aria-current={on || undefined} onClick={() => onPick(r)} className={on ? undefined : 'h-row'}
            style={{ ...row, borderTop: HAIRLINE, cursor: 'pointer', background: on ? 'var(--press, #EEEEF0)' : 'transparent' }}>
            {text(t('mgmt.access.role.' + r), people(r))}
            <span style={meta}>{tn(t, 'mgmt.access.menus', n)}</span>
            <Icon name="chevron_right" size={20} color="#8A8078" />
          </button>
        );
      })}
    </nav>
  );
}
