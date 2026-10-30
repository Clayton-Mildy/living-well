// The signed-in user: session (public) + full User from the club state.
import { createContext, useContext, useMemo } from 'react';
import { roleOf, screenRole, type Role, type StaffRole, type User } from '@cp/shared';
import { useSession } from '../store/session';
import { useReplica, userIn } from '../store/replica';

// round 16 (KC): a screen the Owner opened for a role (Roles screen) is rendered "as" the area's base role; ScreenAccessProvider (lib/access.tsx) sets it
export const RoleAsContext = createContext<StaffRole | undefined>(undefined);

/** The signed-in user as the club state has them, before any granted-screen override. */
export function useBaseMe(): { user: User | null; role: Role | null; realRole: Role | null; id: string | null } {
  const id = useSession((s) => s.user?.id || null);
  const view = useReplica((s) => s.view);
  const self = useReplica((s) => s.self);
  return useMemo(() => {
    if (!id || !view) return { user: null, role: null, realRole: null, id };
    const u = userIn(view, id, self);
    const real = u ? roleOf(u) : null;
    return { user: u, role: real && screenRole(real), realRole: real, id };
  }, [id, view, self]);
}

// round 16 (KC): the Owner renders every screen as management (`role`); `realRole` is 'owner' for the few places that differ.
// On a granted screen (explicit Edit beyond the role's default) `role` and the user's staff role are the area's base role, so the screen works as it does for that role.
export function useMe(): { user: User | null; role: Role | null; realRole: Role | null; id: string | null } {
  const base = useBaseMe();
  const roleAs = useContext(RoleAsContext);
  return useMemo(() => {
    if (!roleAs || !base.user || base.realRole === 'owner') return base;
    const u = base.user;
    return { ...base, role: roleAs, user: u.kind === 'staff' ? { ...u, staff: { ...u.staff, role: roleAs } } : u };
  }, [base, roleAs]);
}
