// Round 16 (KC): what the signed-in role may do on the screen it has open (the access grid, shared/rules/access.ts).
// The server enforces the same rule (framework.ts permit/canRun); this only decides what the screen shows.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { AREA_BASE, NO_LIFT, defaultLevel, type AccessLevel, type GridRole, type StaffRole } from '@cp/shared';
import { useClub } from '../store/replica';
import { RoleAsContext, useBaseMe } from './me';

export interface ScreenAccess { key: string; level: AccessLevel; roleAs?: StaffRole }

const ScreenAccessContext = createContext<ScreenAccess>({ key: 'today', level: 'edit' });

/** Pure rule, mirrored from the server: explicit cell wins, else the default; a never-set cell whose default is Off is no grid cell (`can` alone, so Edit). */
export function screenAccess(explicit: AccessLevel | undefined, role: StaffRole | 'family' | null, key: string, grid: boolean): ScreenAccess {
  if (role === 'owner') return { key, level: 'edit', roleAs: key === 'roles' ? undefined : 'mgmt' };
  if (!role || role === 'family' || !grid) return { key, level: 'edit' };
  const def = defaultLevel(role as GridRole, key);
  const level = explicit ?? def;
  if (explicit === undefined && def === 'off') return { key, level: 'edit' };
  // tasks-view-edit: Tasks on Edit is the role's own team's tasks, never management's screen (the server does not lend Tasks either, NO_LIFT)
  if (level === 'edit') return { key, level, roleAs: explicit === 'edit' && def !== 'edit' && !NO_LIFT.includes(key) ? AREA_BASE[key] : undefined };
  return { key, level: 'view' }; // explicit Off or View, or a default View: the screen is read-only
}

export function ScreenAccessProvider({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  const s = useClub();
  const { realRole } = useBaseMe();
  const access = useMemo(() => {
    const grid = !!realRole && realRole !== 'family' && realRole !== 'owner' && screenKey in AREA_BASE;
    const explicit = grid ? s.club.settings.access?.[realRole as GridRole]?.[screenKey] : undefined;
    return screenAccess(explicit, realRole, screenKey, grid);
  }, [s.club.settings.access, realRole, screenKey]);
  return (
    <ScreenAccessContext.Provider value={access}>
      <RoleAsContext.Provider value={access.roleAs}>{children}</RoleAsContext.Provider>
    </ScreenAccessContext.Provider>
  );
}

export const useScreenAccess = (): ScreenAccess => useContext(ScreenAccessContext);
