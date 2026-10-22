// Staff leave (round 13): the pieces MyLeave (Account, Tasks) and LeaveTab (People) share.
import type { LeaveRequest } from '@cp/shared';
import { useFmt, useT } from '../../lib/i18n';

/** "Mon 9 Nov – Tue 10 Nov", or one day on its own. */
export function useRange() {
  const { fds } = useFmt();
  return (r: Pick<LeaveRequest, 'from' | 'to'>) => (r.from === r.to ? fds(r.from) : `${fds(r.from)} – ${fds(r.to)}`);
}
/** "2 club days" / "1 club day". */
export function useDays() {
  const t = useT();
  return (n: number) => t(n === 1 ? 'people.leave.daysOne' : 'people.leave.days', { n });
}

/** One request as a quiet row: dates and length, the reason, a status word (and a declined note), then whatever action the caller offers. */
export function LeaveRow({ r, first, action, who }: { r: LeaveRequest; first?: boolean; action?: React.ReactNode; who?: string }) {
  const t = useT();
  const range = useRange();
  const days = useDays();
  const tone = r.status === 'declined' ? '#9A3D24' : r.status === 'pending' ? '#7A5510' : '#6B6259';
  return (
    <div data-leave={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0', borderTop: first ? 'none' : '0.5px solid var(--hairline, #E2E2E6)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>{range(r)}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: tone, whiteSpace: 'nowrap' }}>{t('people.leave.st_' + r.status)}</span>
      </div>
      <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{days(r.days)}{who ? ` · ${who}` : ''}</span>
      <span style={{ fontSize: 15, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{r.reason}</span>
      {r.note ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{t('people.leave.noteIs', { note: r.note })}</span> : null}
      {action ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6 }}>{action}</div> : null}
    </div>
  );
}
