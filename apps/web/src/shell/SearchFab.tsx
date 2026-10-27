// Round 15 (KC): the phone search is a floating button at the bottom right, at the top of the right-hand column of the floating stack:
// above the quick camera for the roles that have one, above Tasks for the roles that only have that, at the stack's bottom for a role with neither.
// Tapping it opens the search overlay (full screen on a phone). Laptop and tablet keep the sidebar field and Cmd/Ctrl-K, so it is phone only.
import type { CSSProperties } from 'react';
import { Icon } from '../components/ui';
import { useT } from '../lib/i18n';
import { useMe } from '../lib/me';
import { useUi } from '../store/ui';
import { QUICK_CAMERA_ROLES } from './QuickCamera';
import { QUICK_TASK_ROLES, floatingSlot } from './QuickTasks';

export function SearchFab({ phone, onOpen }: { phone: boolean; onOpen: () => void }) {
  const t = useT();
  const { role } = useMe();
  const pins = useUi((s) => s.pins); // a page Pin raises the whole stack
  if (!phone || !role) return null;
  const hasCam = (QUICK_CAMERA_ROLES as readonly string[]).includes(role);
  // the column's top button is the camera (camera roles) or Tasks (task roles); this one goes a level above it
  const { size, right, bottom } = floatingSlot(phone, pins, 0, hasCam || QUICK_TASK_ROLES.includes(role) ? 1 : 0);
  const pos: CSSProperties = { right, bottom };
  return (
    <button type="button" data-testid="search-fab" onClick={onOpen} aria-label={t('search.open')} title={t('search.open')} className="h-bronze cp-press"
      style={{ position: 'fixed', ...pos, zIndex: 44, width: size, height: size, borderRadius: 999, border: 'none', padding: 0, background: '#24201C', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(40,30,20,0.22), 0 14px 32px rgba(40,30,20,0.38)' }}>
      <Icon name="search" size={24} />
    </button>
  );
}
