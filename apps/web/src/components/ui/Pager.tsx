// usePaged + Pager: every list that can run past one page uses these.
import { useMemo, useState } from 'react';
import { useT } from '../../lib/i18n';
import { useDevice } from '../../hooks/useDevice';
import { FONT_BODY, Icon } from './index';
import { clampPage, pageCount, pageSlice, pageWindow } from './paging';

export interface Paged<T> {
  /** current page, 1-based (always inside 1..pages) */
  page: number;
  pages: number;
  /** the items of this page */
  rows: T[];
  setPage: (p: number) => void;
  total: number;
}
/**
 * Slice `items` into pages of `pageSize`. Pass a `resetKey` (the search text, a filter…) and the list goes back to page 1 whenever it changes.
 * The page also stays valid when the list shrinks (a deleted last row never leaves you on an empty page).
 */
export function usePaged<T>(items: T[], pageSize = 10, resetKey?: string | number | boolean): Paged<T> {
  const [st, setSt] = useState<{ page: number; key: typeof resetKey }>({ page: 1, key: resetKey });
  let want = st.page;
  if (st.key !== resetKey) { want = 1; setSt({ page: 1, key: resetKey }); } // reset while rendering, so no flash of the old page
  const pages = pageCount(items.length, pageSize);
  const page = clampPage(want, pages);
  const rows = useMemo(() => pageSlice(items, page, pageSize), [items, page, pageSize]);
  return { page, pages, rows, setPage: (p: number) => setSt({ page: clampPage(p, pages), key: resetKey }), total: items.length };
}

/** Previous / next with "Page 2 of 5"; numbered pages too on tablet and laptop. Renders nothing for a single page. */
export function Pager({ page, pages, onPage, label }: { page: number; pages: number; onPage: (p: number) => void; label?: string }) {
  const t = useT();
  const { isPhone } = useDevice();
  if (pages <= 1) return null;
  const btn = (disabled: boolean) => ({ width: 44, height: 44, borderRadius: 999, border: '1px solid #DBD7D6', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#B5B0AC' : '#282828', flex: 'none' as const, padding: 0 });
  const prevOff = page <= 1, nextOff = page >= pages;
  return (
    <nav aria-label={label || t('common.pages')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px', flexWrap: 'wrap' }}>
      <button type="button" aria-label={t('common.pagePrev')} aria-disabled={prevOff || undefined} onClick={prevOff ? undefined : () => onPage(page - 1)} className={prevOff ? undefined : 'h-cream'} style={btn(prevOff)}><Icon name="chevron_left" size={22} /></button>
      {isPhone ? (
        <span aria-live="polite" style={{ minWidth: 112, textAlign: 'center', fontSize: FONT_BODY, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{t('common.pageOf', { page, pages })}</span>
      ) : (
        <>
          {pageWindow(page, pages).map((p, i) => p === '…'
            ? <span key={`e${i}`} aria-hidden="true" style={{ width: 24, textAlign: 'center', color: '#6A6967' }}>…</span>
            : (
              <button key={p} type="button" aria-label={t('common.pageGo', { n: p })} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)} className={p === page ? undefined : 'h-cream'}
                style={{ minWidth: 44, height: 44, padding: '0 8px', borderRadius: 999, border: p === page ? '1px solid #75624B' : '1px solid transparent', background: p === page ? '#75624B' : 'transparent', color: p === page ? '#FFFFFF' : '#282828', fontSize: FONT_BODY, fontWeight: p === page ? 600 : 500, cursor: 'pointer', fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter' }}>{p}</button>
            ))}
          <span className="sr-only" aria-live="polite">{t('common.pageOf', { page, pages })}</span>
        </>
      )}
      <button type="button" aria-label={t('common.pageNext')} aria-disabled={nextOff || undefined} onClick={nextOff ? undefined : () => onPage(page + 1)} className={nextOff ? undefined : 'h-cream'} style={btn(nextOff)}><Icon name="chevron_right" size={22} /></button>
    </nav>
  );
}
