// Nav badge counts per role (shown in the sidebar and the phone bottom bar).
import { useMemo } from 'react';
import { live } from '@cp/shared';
import { approvalTotal } from '@cp/shared/rules/approvals';
import { openTaskCount } from '@cp/shared/rules/tasks';
import { useClub } from '../store/replica';
import { useNow } from '../lib/clock';
import { useMe } from '../lib/me';

export function useNavCounts(): Record<string, number> {
  const s = useClub();
  const { today, nowMin } = useNow();
  const { role, id, user } = useMe();
  return useMemo(() => {
    if (!s || !role || !id) return {};
    const out: Record<string, number> = {};
    if (role === 'mgmt') out.reviews = approvalTotal(s); // everything waiting in Approvals: profile changes, care log, readings, photos, menu, stock
    const approver = role === 'mgmt' || role === 'finance' || (user?.kind === 'staff' && user.staff.supervisor);
    if (approver) out.stock = live(s.stockRequests).filter((k) => k.status === 'requested' && (role !== 'kitchen' || k.area === 'kitchen')).length;
    if (role === 'mgmt' || role === 'finance') {
      out.budget = live(s.budgetRequests).filter((b) => b.status === 'pending').length;
      out.receipts = live(s.receipts).filter((r) => r.status === 'submitted' && !r.voidedAt).length + live(s.vendorInvoices).filter((v) => v.status === 'toApprove').length;
    }
    if (user?.kind === 'staff') out.tasks = openTaskCount(s, user.staff.role, today, nowMin); // KC round 7: tasks still open that are due by now
    return out;
  }, [s, role, id, user, today, nowMin]);
}
