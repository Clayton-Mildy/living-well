// Shared demo clock (same on every device): today + minutes since midnight, re-rendering every 15 s.
import { useEffect, useState } from 'react';
import { toHM } from '@cp/shared';
import { useReplica, clockNow } from '../store/replica';

export function useNow() {
  const anchor = useReplica((s) => s.clock);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 15000); return () => clearInterval(t); }, []);
  const c = clockNow(anchor);
  return { today: c.today, nowMin: c.nowMin, now: toHM(c.nowMin) };
}
