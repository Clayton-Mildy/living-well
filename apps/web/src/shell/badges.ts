// Nav badge counts per role (shown in the sidebar and the phone bottom bar).
import { useMemo } from 'react';
import { familyUnreadCount, staffUnreadCount, live, type Role } from '@cp/shared';
import { pendingPhotoCount } from '@cp/shared/rules/members';
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
    out.chat = role === 'family' ? familyUnreadCount(s, id) : staffUnreadCount(s, role as Role);
    const ready = live(s.formRequests).filter((f) => f.status === 'submitted').length;
    if (role === 'lobby' || role === 'mgmt') out.enquiries = ready;
    if (role === 'mgmt') out.reviews = live(s.changeRequests).filter((c) => c.status === 'pending').length + pendingPhotoCount(s);
    const approver = role === 'mgmt' || role === 'finance' || (user?.kind === 'staff' && user.staff.supervisor);
    if (approver) out.stock = live(s.stockRequests).filter((k) => k.status === 'requested' && (role !== 'kitchen' || k.area === 'kitchen')).length;
    if (role === 'mgmt' || role === 'finance') {
      out.budget = live(s.budgetRequests).filter((b) => b.status === 'pending').length;
      out.receipts = live(s.receipts).filter((r) => r.status === 'submitted' && !r.voidedAt).length + live(s.vendorInvoices).filter((v) => v.status === 'toApprove').length;
    }
    return out;
  }, [s, role, id, user, today, nowMin]);
}
