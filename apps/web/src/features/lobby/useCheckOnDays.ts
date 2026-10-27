// The "Not seen for" choice of the Check on list (round 15): how many days without a visit before a member is listed.
// Per device (localStorage), shared by the Check on sheet, the lobby rail's count and the Members "Check on" filter; undefined means the automatic rule.
// Storage can throw (private mode, blocked site data), so every access is guarded and the choice then simply stays automatic.
import { useCallback, useSyncExternalStore } from 'react';

export const NOT_SEEN_CHOICES = ['auto', 7, 14, 21, 30] as const;
const KEY = 'cp.checkOn.days';
const listeners = new Set<() => void>();

function read(): number | undefined {
  try {
    const n = Number(localStorage.getItem(KEY));
    return (NOT_SEEN_CHOICES as readonly (string | number)[]).includes(n) ? n : undefined;
  } catch { return undefined; }
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useCheckOnDays(): [number | undefined, (v: 'auto' | number) => void] {
  const days = useSyncExternalStore(subscribe, read, () => undefined);
  const set = useCallback((v: 'auto' | number) => {
    try { if (v === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(v)); } catch { /* not kept: the list stays automatic */ }
    listeners.forEach((fn) => fn());
  }, []);
  return [days, set];
}
