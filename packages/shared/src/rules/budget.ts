// Budget weeks (Mon–Sun): committed = receipts + approved requests without a receipt + adjustments.
import type { ClubState, ISODate, SectionId } from '../types';
import { addDays, live, sortBy, sum, weekStart } from '../util';

export function weeklyLimit(s: ClubState, sectionId: SectionId, week: ISODate): number {
  const sec = s.budgetSections[sectionId];
  if (!sec) return 0;
  return sortBy(sec.limits.filter((l) => l.fromWeek <= week), (l) => l.fromWeek).pop()?.weekly ?? 0;
}
export function budgetWeek(s: ClubState, sectionId: SectionId, anyDay: ISODate) {
  const ws = weekStart(anyDay);
  const we = addDays(ws, 6);
  const receipts = live(s.receipts).filter((r) => r.sectionId === sectionId && !r.voidedAt && r.status !== 'rejected' && r.date >= ws && r.date <= we);
  const linked = new Set(receipts.map((r) => r.budgetRequestId).filter(Boolean));
  const approved = live(s.budgetRequests).filter((b) => b.sectionId === sectionId && b.weekStart === ws && b.status === 'approved' && !linked.has(b.id));
  const pending = live(s.budgetRequests).filter((b) => b.sectionId === sectionId && b.weekStart === ws && b.status === 'pending');
  const adjustments = live(s.budgetAdjustments).filter((a) => a.sectionId === sectionId && a.weekStart === ws);
  const spent = sum(receipts.map((r) => r.amount)) + sum(adjustments.map((a) => a.amount));
  const committed = sum(approved.map((b) => b.amount));
  const limit = weeklyLimit(s, sectionId, ws);
  return { weekStart: ws, weekEnd: we, limit, spent, committed, used: spent + committed, left: limit - spent - committed, pending, approved, receipts, adjustments };
}
