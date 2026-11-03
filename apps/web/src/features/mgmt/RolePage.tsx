// Admin › Roles › a role (round 17, KC; round 18: laid out like Tasks). The role's head (icon, people, last change, "10 of 29" with its bar), then one
// section per sidebar group with a count and an All / None text button, each menu with its icon, " · view only", and View and Edit checkboxes under one
// View / Edit header. A group with nothing ticked folds to "Care · hidden" and opens on a tap. When the panel is 900px or wider the sections flow into
// two columns, balanced by rows. Then the owner-approval checkboxes and Reset to default. The page edits a draft (Roles.tsx holds it and saves it).
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MENU_KEYS, OWNER_KINDS, actorName, defaultDraft, dtDate, isDefaultCell, staffByRole, staffCall, type AccessLevel, type GridRole, type RoleDraft } from '@cp/shared';
import { Button, Checkbox, Icon } from '../../components/ui';
import { Lines, RoleHead } from '../../components/roleparts';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { menuGroups, menuIcon, menuLabel } from '../../app/nav';
import { useAtLeast } from '../lobby/useAtLeast';
import { ConfirmDialog } from '../kitchen/parts';

type Col = 'view' | 'edit';
const COLS: Col[] = ['view', 'edit'];
/** The role panel's width from which the sections sit in two columns. */
export const TWO_COLUMNS = 900;
/** Label, then the View and Edit columns (52px each, a 44px target around an 18px box). */
const GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 52px 52px', alignItems: 'center', columnGap: 0 };
const PAD = '0 6px 0 16px';
const line = (first: boolean): CSSProperties => ({
  minHeight: 48, padding: PAD, backgroundColor: 'transparent', backgroundImage: first ? 'none' : 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)', backgroundSize: 'calc(100% - 52px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat',
});
const MUTED = '#6B6259';

const ticks = (lv: AccessLevel, col: Col) => (col === 'view' ? lv !== 'off' : lv === 'edit');
/** Ticking Edit ticks View; unticking View unticks Edit. */
const tick = (lv: AccessLevel, col: Col, on: boolean): AccessLevel => (col === 'view' ? (on ? (lv === 'off' ? 'view' : lv) : 'off') : on ? 'edit' : lv === 'edit' ? 'view' : lv);

/** Splits the groups into two columns in their order, so the taller column is as short as it can be. */
export function balance<T>(items: T[], rows: (x: T) => number): [T[], T[]] {
  const total = items.reduce((n, x) => n + rows(x), 0);
  let best = 0, bestMax = Infinity, left = 0;
  for (let i = 0; i <= items.length; i++) {
    const worst = Math.max(left, total - left);
    if (worst < bestMax) { bestMax = worst; best = i; }
    if (i < items.length) left += rows(items[i]);
  }
  return [items.slice(0, best), items.slice(best)];
}

/** An icon in a 26px grey circle (a menu's sidebar icon). */
function Dot({ icon }: { icon: string }) {
  return (
    <span aria-hidden="true" className="cp-fill" style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--fill, #F4F4F5)', color: 'var(--accent, #75624B)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name={icon} size={15} fill={1} />
    </span>
  );
}

/** `surface`: the colour behind the page, or 'inherit' inside a card (the warm skin repaints cards, so the sticky View / Edit header takes the card's own colour). */
export function RolePage({ role, draft, onChange, surface }: { role: GridRole; draft: RoleDraft; onChange: (d: RoleDraft) => void; surface: string }) {
  const t = useT();
  const fmt = useFmt();
  const s = useClub();
  const { isPhone } = useDevice();
  const ref = useRef<HTMLDivElement>(null);
  const { wide } = useAtLeast(ref, TWO_COLUMNS);
  const two = wide && !isPhone;
  const [opened, setOpened] = useState<string[]>([]);
  const [resetting, setResetting] = useState(false);
  const roleName = t('mgmt.access.role.' + role);
  const people = staffByRole(s, role).map(staffCall).filter(Boolean).join(', ');
  const changed = s.club.settings.accessChanged?.[role];
  const def = defaultDraft(role);
  const atDefault = MENU_KEYS.every((k) => draft.levels[k] === def.levels[k]) && OWNER_KINDS.every((k) => draft.approvals[k] === def.approvals[k]);
  const seen = (keys: string[]) => keys.filter((k) => draft.levels[k] !== 'off').length;
  const colLabel = (col: Col) => t('mgmt.access.' + col);
  // a group the Owner is editing stays open, even once its last box is unticked (it folds again when the role is opened anew)
  const keep = (label: string) => setOpened((o) => (o.includes(label) ? o : [...o, label]));
  const setKeys = (label: string, keys: string[], col: Col, on: boolean) => {
    const levels = { ...draft.levels };
    for (const k of keys) levels[k] = tick(levels[k], col, on);
    keep(label);
    onChange({ ...draft, levels });
  };
  const setAll = (label: string, keys: string[], level: AccessLevel) => {
    const levels = { ...draft.levels };
    for (const k of keys) levels[k] = level;
    keep(label);
    onChange({ ...draft, levels });
  };
  const sub = [people, changed ? t('mgmt.roles.changedBy', { name: actorName(s, changed.by), d: fmt.fd(dtDate(changed.at), { day: 'numeric', month: 'short' }) }) : ''].filter(Boolean).join(' · ');

  const groups = menuGroups().map((g) => {
    const label = t(g.label ?? 'nav.g_general');
    return { label, keys: g.keys, folded: seen(g.keys) === 0 && !opened.includes(label) };
  });
  const colHead = (
    <div data-col-head aria-hidden="true" style={{ ...GRID, padding: PAD, margin: isPhone ? 0 : '0 -20px', position: 'sticky', top: isPhone ? -4 : 0, zIndex: 1, backgroundColor: 'inherit' }}>
      <span />
      {COLS.map((c) => <span key={c} style={{ fontSize: 12, lineHeight: '16px', fontWeight: 600, color: MUTED, textAlign: 'center', padding: '6px 0' }}>{colLabel(c)}</span>)}
    </div>
  );
  const textButton = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="cp-press"
      style={{ minHeight: 44, margin: '-14px -8px -14px 0', padding: '0 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13, fontWeight: 500, color: '#24201C', textDecoration: 'underline', textUnderlineOffset: 3 }}>
      {label}
    </button>
  );
  const section = (g: (typeof groups)[number]) => {
    if (g.folded) {
      return (
        <div key={g.label} data-group={g.label} data-folded>
          <Lines>
            <button type="button" onClick={() => keep(g.label)} className={isPhone ? 'cp-tap-self' : 'h-row'}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minHeight: 52, padding: '8px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter' }}>
              <span style={{ fontSize: 12, lineHeight: '16px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: 'var(--eyebrow, #6E5A43)' }}>{g.label} · {t('mgmt.roles.hidden')}</span>
              <span style={{ fontSize: 13, lineHeight: '18px', color: MUTED, overflowWrap: 'anywhere' }}>{g.keys.map((k) => t(menuLabel(k))).join(', ')}</span>
            </button>
          </Lines>
        </div>
      );
    }
    const n = seen(g.keys);
    const full = g.keys.every((k) => draft.levels[k] === 'edit');
    const meta: ReactNode = (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t('mgmt.roles.ofMenus', { n, total: g.keys.length })}</span>
        {full ? textButton(t('mgmt.roles.none'), () => setAll(g.label, g.keys, 'off')) : textButton(t('mgmt.roles.all'), () => setAll(g.label, g.keys, 'edit'))}
      </span>
    );
    return (
      <div key={g.label} data-group={g.label}>
        <Lines title={g.label} meta={meta}>
          {g.keys.map((k, i) => {
            const name = t(menuLabel(k));
            const lv = draft.levels[k];
            return (
              <div key={k} data-menu={k} style={{ ...GRID, ...line(i === 0) }}>
                <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Dot icon={menuIcon(k)} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 15, lineHeight: '20px', fontWeight: 500, color: '#24201C' }}>
                    {name}{lv === 'view' ? <span style={{ fontWeight: 400, color: MUTED }}> · {t('mgmt.roles.viewOnly')}</span> : null}
                  </span>
                  {!isDefaultCell(role, k, lv) ? <span role="img" aria-label={t('mgmt.access.changed')} title={t('mgmt.access.changed')} style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent, #75624B)', flex: 'none' }} /> : null}
                </span>
                {COLS.map((c) => <Checkbox key={c} box={18} label={`${name}: ${colLabel(c)}`} checked={ticks(lv, c)} onChange={(on) => setKeys(g.label, [k], c, on)} />)}
              </div>
            );
          })}
        </Lines>
      </div>
    );
  };
  const columns = two ? balance(groups, (g) => (g.folded ? 1 : g.keys.length)) : [groups];

  return (
    <div ref={ref} data-role-page={role} style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0, backgroundColor: surface }}>
      <RoleHead role={role} title={roleName} sub={sub} right={t('mgmt.roles.ofMenus', { n: seen(MENU_KEYS), total: MENU_KEYS.length })} done={seen(MENU_KEYS)} total={MENU_KEYS.length} ink />

      <div data-columns={columns.length} style={{ backgroundColor: 'inherit', display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, columnGap: 40, alignItems: 'start' }}>
        {columns.map((col, i) => (
          <div key={i} data-column style={{ backgroundColor: 'inherit', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            {colHead}
            {col.map(section)}
          </div>
        ))}
      </div>

      <div data-owner-approvals>
        <Lines title={t('mgmt.access.needsOwner')}>
          {OWNER_KINDS.map((kind, i) => {
            const name = t('mgmt.access.kind.' + kind);
            return (
              <div key={kind} data-approval={kind} style={{ ...GRID, gridTemplateColumns: 'minmax(0, 1fr) 52px', ...line(i === 0) }}>
                <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Dot icon={KIND_ICON[kind]} />
                  <span style={{ minWidth: 0, fontSize: 15, lineHeight: '20px', fontWeight: 500, color: '#24201C' }}>{name}</span>
                </span>
                <Checkbox box={18} label={name} checked={draft.approvals[kind]} onChange={(on) => onChange({ ...draft, approvals: { ...draft.approvals, [kind]: on } })} />
              </div>
            );
          })}
        </Lines>
      </div>

      <div>
        <Button variant="secondary" size={44} icon="restart_alt" disabled={atDefault} onClick={() => setResetting(true)}>{t('mgmt.access.reset')}</Button>
      </div>
      <ConfirmDialog open={resetting} onClose={() => setResetting(false)} title={t('mgmt.access.resetAsk', { role: roleName })} body={t('mgmt.access.resetBody')}
        confirmLabel={t('mgmt.access.reset')} cancelLabel={t('common.cancel')} danger={false} onConfirm={() => { onChange(def); setResetting(false); }} />
    </div>
  );
}
const KIND_ICON: Record<(typeof OWNER_KINDS)[number], string> = { pricing: 'sell', holidays: 'event_busy', budget: 'pie_chart' };

/** The draft's bar: Reset (back to the saved role) and "Save · 2 changes". */
/** `packed`: the buttons sit together on the left (wide screens, where the floating camera and task buttons sit at the bottom right). */
export function SaveBar({ n, busy, onCancel, onSave, packed }: { n: number; busy: boolean; onCancel: () => void; onSave: () => void; packed?: boolean }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Button variant="secondary" size={44} onClick={onCancel}>{t('mgmt.roles.reset')}</Button>
      <Button size={44} onClick={onSave} disabled={busy || !n} style={packed ? undefined : { flex: 1 }}>{n === 1 ? t('mgmt.roles.saveOne') : t('mgmt.roles.saveN', { n })}</Button>
    </div>
  );
}
