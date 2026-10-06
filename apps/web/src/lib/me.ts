// The signed-in user: session (public) + full User from the club state.
import { useMemo } from 'react';
import { roleOf, type Role, type User } from '@cp/shared';
import { useSession } from '../store/session';
import { useReplica, userIn } from '../store/replica';

export function useMe(): { user: User | null; role: Role | null; id: string | null } {
  const id = useSession((s) => s.user?.id || null);
  const view = useReplica((s) => s.view);
  const self = useReplica((s) => s.self);
  return useMemo(() => {
    if (!id || !view) return { user: null, role: null, id };
    const u = userIn(view, id, self);
    return { user: u, role: u ? roleOf(u) : null, id };
  }, [id, view, self]);
}
