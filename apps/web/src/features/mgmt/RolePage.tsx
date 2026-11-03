// Admin › Roles › a role (round 17, KC): View and Edit checkboxes per menu, grouped like the sidebar, each group with a tick-all per column;
// the three owner-approval checkboxes; Reset to default. The page edits a draft (Roles.tsx holds it and saves it in one go).
import { useState, type CSSProperties } from 'react';
import { MENU_KEYS, OWNER_KINDS, actorName, defaultDraft, dtDate, isDefaultCell, staffByRole, staffCall, type AccessLevel, type GridRole, type RoleDraft } from '@cp/shared';
import { Button, Checkbox, GROUP_HEAD, HAIRLINE, FONT_SMALL } from '../../components/ui';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { menuGroups, menuLabel } from '../../app/nav';
import { ConfirmDialog } from '../kitchen/parts';
import { tn } from './common';

type Col = 'view' | 'edit';
/** Label, then the View and Edit columns (44px checkboxes). */
const GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 52px 52px', alignItems: 'center', columnGap: 0 };
const BOX: CSSProperties = { background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' };
const ROW: CSSProperties = { ...GRID, minHeight: 48, padding: '0 4px 0 16px' };

const ticks = (lv: AccessLevel, col: Col) => (col === 'view' ? lv !== 'off' : lv === 'edit');
/** Ticking Edit ticks View; unticking View unticks Edit. */
const tick = (lv: AccessLevel, col: Col, on: boolean): AccessLevel => (col === 'view' ? (on ? (lv === 'off' ? 'view' : lv) : 'off') : on ? 'edit' : lv === 'edit' ? 'view' : lv);

/** `surface`: the colour behind the page (the sticky View / Edit labels cover the rows with it). */
export function RolePage({ role, draft, onChange, surface }: { role: GridRole; draft: RoleDraft; onChange: (d: RoleDraft) => void; surface: string }) {
  const t = useT();
  const fmt = useFmt();
  const s = useClub();
  const [resetting, setResetting] = useState(false);
  const roleName = t('mgmt.access.role.' + role);
  const people = staffByRole(s, role).map(staffCall).filter(Boolean).join(', ');
  const changed = s.club.settings.accessChanged?.[role];
  const def = defaultDraft(role);
  const atDefault = MENU_KEYS.every((k) => draft.levels[k] === def.levels[k]) && OWNER_KINDS.every((k) => draft.approvals[k] === def.approvals[k]);
  const colLabel = (col: Col) => t('mgmt.access.' + col);
  const setKeys = (keys: string[], col: Col, on: boolean) => {
    const levels = { ...draft.levels };
    for (const k of keys) levels[k] = tick(levels[k], col, on);
    onChange({ ...draft, levels });
  };
  const groupState = (keys: string[], col: Col): boolean | 'mixed' => {
    const n = keys.filter((k) => ticks(draft.levels[k], col)).length;
    return n === 0 ? false : n === keys.length ? true : 'mixed';
  };

  return (
    <div data-role-page={role} style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 className="cp-serif" style={{ margin: 0, fontSize: 26, lineHeight: '32px', fontWeight: 500, color: '#24201C' }}>{roleName}</h2>
        {people ? <div style={{ fontSize: 15, color: '#24201C' }}>{people}</div> : null}
        {changed ? <div style={{ fontSize: FONT_SMALL, color: '#6B6259' }}>{t('mgmt.access.lastChanged', { name: actorName(s, changed.by), d: fmt.fd(dtDate(changed.at), { day: 'numeric', month: 'short' }) })}</div> : null}
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div aria-hidden="true" style={{ ...GRID, padding: '4px 4px 0 16px', position: 'sticky', top: -4, zIndex: 1, background: surface, marginBottom: -10 }}>
          <span />
          {(['view', 'edit'] as Col[]).map((c) => <span key={c} style={{ fontSize: 12, fontWeight: 600, color: '#6B6259', textAlign: 'center', padding: '4px 0' }}>{colLabel(c)}</span>)}
        </div>
        {menuGroups().map((g) => {
          const label = t(g.label ?? 'nav.g_general');
          return (
            <section key={label} aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div data-group={label} style={{ ...GRID, padding: '0 4px 0 16px' }}>
                <h3 style={GROUP_HEAD}>{label}</h3>
                {(['view', 'edit'] as Col[]).map((c) => <Checkbox key={c} label={`${label}: ${colLabel(c)}`} checked={groupState(g.keys, c)} onChange={(on) => setKeys(g.keys, c, on)} />)}
              </div>
              <div className="cp-grey" style={BOX}>
                {g.keys.map((k, i) => {
                  const name = t(menuLabel(k));
                  return (
                    <div key={k} data-menu={k} style={{ ...ROW, borderTop: i ? HAIRLINE : 'none' }}>
                      <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500, color: '#24201C' }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        {!isDefaultCell(role, k, draft.levels[k]) ? <span role="img" aria-label={t('mgmt.access.changed')} title={t('mgmt.access.changed')} style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--accent, #75624B)', flex: 'none' }} /> : null}
                      </span>
                      {(['view', 'edit'] as Col[]).map((c) => <Checkbox key={c} label={`${name}: ${colLabel(c)}`} checked={ticks(draft.levels[k], c)} onChange={(on) => setKeys([k], c, on)} />)}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <section aria-label={t('mgmt.access.needsOwner')} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{ ...GROUP_HEAD, padding: '0 16px' }}>{t('mgmt.access.needsOwner')}</h3>
        <div className="cp-grey" style={BOX}>
          {OWNER_KINDS.map((kind, i) => {
            const name = t('mgmt.access.kind.' + kind);
            return (
              <div key={kind} data-approval={kind} style={{ ...ROW, gridTemplateColumns: 'minmax(0, 1fr) 52px', borderTop: i ? HAIRLINE : 'none' }}>
                <span style={{ minWidth: 0, fontSize: 15, fontWeight: 500, color: '#24201C' }}>{name}</span>
                <Checkbox label={name} checked={draft.approvals[kind]} onChange={(on) => onChange({ ...draft, approvals: { ...draft.approvals, [kind]: on } })} />
              </div>
            );
          })}
        </div>
      </section>

      <div>
        <Button variant="secondary" size={44} icon="restart_alt" disabled={atDefault} onClick={() => setResetting(true)}>{t('mgmt.access.reset')}</Button>
      </div>
      <ConfirmDialog open={resetting} onClose={() => setResetting(false)} title={t('mgmt.access.resetAsk', { role: roleName })} body={t('mgmt.access.resetBody')}
        confirmLabel={t('mgmt.access.reset')} cancelLabel={t('common.cancel')} danger={false} onConfirm={() => { onChange(def); setResetting(false); }} />
    </div>
  );
}

/** The draft's bar: "3 changes · Cancel · Save". */
/** `packed`: the buttons follow the count (wide screens, where the floating camera and task buttons sit at the bottom right). */
export function SaveBar({ n, busy, onCancel, onSave, packed }: { n: number; busy: boolean; onCancel: () => void; onSave: () => void; packed?: boolean }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ flex: packed ? 'none' : 1, minWidth: 0, marginRight: packed ? 8 : 0, fontSize: 15, fontWeight: 500, color: '#24201C' }}>{tn(t, 'mgmt.access.changes', n)}</span>
      <Button variant="secondary" size={44} onClick={onCancel}>{t('common.cancel')}</Button>
      <Button size={44} onClick={onSave} disabled={busy || !n}>{t('common.save')}</Button>
    </div>
  );
}
