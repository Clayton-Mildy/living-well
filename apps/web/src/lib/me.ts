// The signed-in user: session (public) + full User from the club state.
import { useMemo } from 'react';
import { roleOf, screenRole, type Role, type User } from '@cp/shared';
import { useSession } from '../store/session';
import { useReplica, userIn } from '../store/replica';

// round 16 (KC): the Owner renders every screen as management (`role`); `realRole` is 'owner' for the few places that differ
export function useMe(): { user: User | null; role: Role | null; realRole: Role | null; id: string | null } {
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
