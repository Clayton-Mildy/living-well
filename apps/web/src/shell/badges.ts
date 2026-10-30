// Nav badge counts per role (shown in the sidebar and the phone bottom bar).
import { useMemo } from 'react';
import { live, screenRole } from '@cp/shared';
import { approvalTotal, pendingItems } from '@cp/shared/rules/approvals';
import { openTaskCount } from '@cp/shared/rules/tasks';
import { pendingLeave } from '@cp/shared/rules/staffLeave';
import { useClub } from '../store/replica';
import { useNow } from '../lib/clock';
import { useMe } from '../lib/me';

export function useNavCounts(): Record<string, number> {
  const s = useClub();
  const { today, nowMin } = useNow();
  const { role, realRole, id, user } = useMe();
  return useMemo(() => {
    if (!s || !role || !id) return {};
    const out: Record<string, number> = {};
    if (role === 'mgmt') out.hr = pendingLeave(s).length; // round 13: staff leave requests waiting in People → Leave
    if (role === 'mgmt') out.reviews = approvalTotal(s, { owner: realRole === 'owner' }); // round 16: owner requests count for the Owner only; // everything waiting in Approvals: profile changes, care log, readings, photos, menu, stock
    const approver = role === 'mgmt' || role === 'finance' || (user?.kind === 'staff' && user.staff.supervisor);
    if (approver) out.stock = live(s.stockRequests).filter((k) => k.status === 'requested' && (role !== 'kitchen' || k.area === 'kitchen')).length;
    if (role === 'finance') out.payments = pendingItems(s, 'payments').length; // front-desk payments waiting for finance
    if (role === 'mgmt' || role === 'finance') {
      out.budget = live(s.budgetRequests).filter((b) => b.status === 'pending').length;
      out.receipts = live(s.receipts).filter((r) => r.status === 'submitted' && !r.voidedAt).length + live(s.vendorInvoices).filter((v) => v.status === 'toApprove').length;
    }
    if (user?.kind === 'staff') out.tasks = openTaskCount(s, screenRole(user.staff.role), today, nowMin, { owner: realRole === 'owner' }); // KC round 7: tasks still open that are due by now
    return out;
  }, [s, role, realRole, id, user, today, nowMin]);
}
