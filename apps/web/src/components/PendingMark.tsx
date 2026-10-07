// A small "Pending approval" dot-and-text marker for what staff entered and management has not approved yet (or sent back, with the reason).
// Families never get a row with an approval mark (the server leaves pending entries out), so they never see this.
import type { Approval } from '@cp/shared';
import { approvalState } from '@cp/shared/rules/approvals';
import { useT } from '../lib/i18n';

export function PendingMark({ row }: { row: { approval?: Approval } | null | undefined }) {
  const t = useT();
  const st = row ? approvalState(row) : null;
  if (!row || !st) return null;
  const rejected = st === 'rejected';
  const color = rejected ? '#9A3D24' : '#7A5510';
  const label = rejected ? (row.approval?.reason ? t('approvals.rejectedWhy', { reason: row.approval.reason }) : t('approvals.rejectedMark')) : row.approval?.prev ? t('approvals.pendingEdit') : t('approvals.pending');
  return (
    <span data-testid="approval-mark" data-state={st} title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color, fontSize: 13, fontWeight: 500, lineHeight: 1.3, whiteSpace: 'normal' }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: color, flex: 'none' }} />
      {label}
    </span>
  );
}
