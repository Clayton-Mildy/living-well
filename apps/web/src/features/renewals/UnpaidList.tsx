// Next month, Unpaid tab (round 14). A placeholder in task 1; the unpaid invoices of the month are listed here from task 2 on.
import type { YM } from '@cp/shared';

export function UnpaidList({ month }: { month: YM }) {
  return <div data-testid="unpaid-list" data-month={month} />;
}
