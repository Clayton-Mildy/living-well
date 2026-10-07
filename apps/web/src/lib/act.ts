// useAct(): run a shared action with consistent feedback (error toasts, "sent for review" for gated changes).
import { useCallback } from 'react';
import { useReplica, type ActResult } from '../store/replica';
import { say } from '../store/ui';
import { useT } from './i18n';

export interface ActOpts { ok?: string | ((r: Record<string, unknown>) => string); silent?: boolean; reviewText?: string }
export function useAct() {
  const t = useT();
  const act = useReplica((s) => s.act);
  return useCallback(async (name: string, input: unknown, opts: ActOpts = {}): Promise<ActResult> => {
    const r = await act(name, input);
    if (!r.ok) {
      say(t(r.code, r.params), { tone: 'error', icon: 'error' });
      return r;
    }
    if (opts.silent) return r;
    if (r.reviewed === 'gate') say(opts.reviewText || t('common.reviewNote'), { icon: 'hourglass_top' });
    else if (opts.ok || r.result.pending) {
      // an entry by non-management staff waits for management's approval before families see it
      const ok = opts.ok ? (typeof opts.ok === 'function' ? opts.ok(r.result) : opts.ok) : '';
      if (r.result.pending) say([ok, t('approvals.waitingShort')].filter(Boolean).join(' '), { icon: 'hourglass_top' });
      else say(ok);
    }
    return r;
  }, [act, t]);
}
