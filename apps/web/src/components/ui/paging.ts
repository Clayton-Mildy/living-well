// Pure paging math behind usePaged and Pager.
export const pageCount = (total: number, size: number) => Math.max(1, Math.ceil(total / Math.max(1, size)));
/** Keep a page number inside 1..pages (a NaN or fractional page snaps to page 1 / the nearest whole page). */
export const clampPage = (page: number, pages: number) => Math.min(Math.max(1, Math.floor(page) || 1), Math.max(1, pages));
export const pageSlice = <T,>(items: T[], page: number, size: number): T[] => {
  const p = clampPage(page, pageCount(items.length, size));
  return items.slice((p - 1) * size, p * size);
};
/** Page buttons to show: 1 … 4 5 6 … 12 (ellipsis as '…'). Short lists show every page. */
export function pageWindow(page: number, pages: number, around = 1): (number | '…')[] {
  if (pages <= 5 + around * 2) return Array.from({ length: pages }, (_, i) => i + 1);
  const from = Math.max(2, page - around), to = Math.min(pages - 1, page + around);
  const out: (number | '…')[] = [1];
  if (from > 2) out.push(from === 3 ? 2 : '…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push(to === pages - 2 ? pages - 1 : '…');
  out.push(pages);
  return out;
}
