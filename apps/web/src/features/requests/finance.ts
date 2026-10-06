// The finance-owned actions the Requests screen calls (budget.request, budget.edit, budget.cancel, receipt.add, receipt.edit, receipt.void).
// Input shapes follow the BudgetRequest and Receipt rows; ids are sent under every plausible key so the screen keeps working
// whichever name finance picked. The tiles stay disabled until the action is registered.
import { getAction, live, type ClubState } from '@cp/shared';

export const hasAction = (name: string) => !!getAction(name);

export interface BudgetInput { sectionId: string; item: string; amount: number }
export interface ReceiptInput { supplier: string; directoryId?: string; amount: number; sectionId: string; fileName: string; date: string }

export const budgetRequestInput = (i: BudgetInput) => ({ sectionId: i.sectionId, item: i.item.trim(), amount: i.amount });
export const budgetEditInput = (id: string, i: Partial<BudgetInput>) => ({ id, requestId: id, budgetRequestId: id, ...i, ...(i.item !== undefined ? { item: i.item.trim() } : {}) });
export const budgetCancelInput = (id: string) => ({ id, requestId: id, budgetRequestId: id });
export const receiptAddInput = (i: ReceiptInput) => ({ supplier: i.supplier.trim(), ...(i.directoryId ? { directoryId: i.directoryId } : {}), amount: i.amount, sectionId: i.sectionId, fileName: i.fileName, date: i.date });
export const receiptEditInput = (id: string, i: Partial<ReceiptInput>) => ({ id, receiptId: id, ...i, ...(i.supplier !== undefined ? { supplier: i.supplier.trim() } : {}) });
export const receiptVoidInput = (id: string) => ({ id, receiptId: id });

/** Budget sections in the order finance created them; names come from data (nameId in Indonesian). */
export const sectionsOf = (s: ClubState) => live(s.budgetSections);
export const sectionName = (s: ClubState, id: string, lang: 'en' | 'id') => { const x = s.budgetSections[id]; return x ? (lang === 'id' && x.nameId ? x.nameId : x.name) : id; };
/** The section a role most likely spends from. */
export function defaultSectionId(s: ClubState, role: string | null | undefined): string | undefined {
  const secs = sectionsOf(s);
  const want = role === 'kitchen' ? 'fnb' : role === 'activity' ? 'activities' : 'operations';
  return (secs.find((x) => x.id === want) ?? secs[0])?.id;
}
