// The hero card of Arrivals (Prototype v3): the selected tab's list. The check-in list (members not in yet), the check-out list (members in the club) and "Gone home".
// The title is an eyebrow on the left and an underline search on the right; the rows sit inside the card's padding with inset hairlines
// (a page of PAGE_SIZE at a time, with a pager), then the empty / no-match states.
import type { BoardRow } from '@cp/shared';
import { Icon, Pager, usePaged } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { MemberRow } from './MemberRow';

/** Members per page. Searching goes back to page 1. */
export const PAGE_SIZE = 10;

export interface ListEmpty { icon: string; title: string }

export function MemberList({ t, title, rows, total, query, onQuery, empty, noMatch, selectedId, onOpen, onCheckIn, onCheckOut, onUndoOut, listId }: {
  t: TFn;
  title: string;
  /** the rows to show (already narrowed by `query`) */
  rows: BoardRow[];
  /** how many members this list holds before any search */
  total: number;
  /** the search text; `onQuery` undefined = this card has no search box (it follows another card's search) */
  query: string;
  onQuery?: (q: string) => void;
  empty: ListEmpty;
  /** text for "nothing matches what was typed" */
  noMatch: (q: string) => string;
  selectedId?: string;
  onOpen: (id: string) => void;
  onCheckIn?: (id: string) => void;
  onCheckOut?: (id: string) => void;
  /** Gone home rows: an "Undo" pill that reverses the check-out */
  onUndoOut?: (id: string) => void;
  listId: string;
}) {
  const searching = !!query.trim();
  const paged = usePaged(rows, PAGE_SIZE, query.trim());
  return (
    <section aria-label={title} data-list={listId} style={{ '--hp': 'clamp(18px, 3vw, 36px)', background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 20, boxShadow: '0 1px 2px rgba(60,40,20,.04), 0 18px 40px rgba(60,40,20,.07)', padding: '8px var(--hp) 12px', minWidth: 0 } as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 0 10px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 12, lineHeight: '18px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: '#6E5A43', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 auto' }}>{title}</h2>
          {/* the count of the whole list; it is shown only while searching ("3 of 20"), the tab above already carries the number */}
          <span data-testid={`count-${listId}`} className={searching ? undefined : 'sr-only'} style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.3, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
            {searching ? t('lobby.countOf', { n: rows.length, total }) : total}
          </span>
        </div>
        {onQuery ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #DDD1C2', padding: '2px 2px', width: 'min(220px, 42%)', flex: 'none', minHeight: 44 }}>
            <Icon name="search" size={18} color="#6B6259" />
            <input value={query} aria-label={t('lobby.searchMember')} onChange={(e) => onQuery(e.target.value)} inputMode="search" placeholder={t('common.search')} autoComplete="off"
              style={{ flex: 1, minWidth: 0, height: 40, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: 'Inter', color: '#1E1A16' }} />
          </label>
        ) : null}
      </div>
      {paged.rows.map((r) => (
        <MemberRow key={r.m.id} r={r} selected={selectedId === r.m.id} onOpen={() => onOpen(r.m.id)} onCheckIn={() => onCheckIn?.(r.m.id)} onCheckOut={() => onCheckOut?.(r.m.id)} onUndoOut={onUndoOut ? () => onUndoOut(r.m.id) : undefined} />
      ))}
      {!rows.length ? (
        total === 0 || !searching ? (
          <div style={{ padding: '28px 0', borderTop: '1px solid #F0EAE1', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 20, fontWeight: 300, lineHeight: 1.3, color: '#6B6259' }}>{empty.title}</div>
          </div>
        ) : (
          <div style={{ padding: '28px 0', borderTop: '1px solid #F0EAE1', fontSize: 16, color: '#6B6259', lineHeight: 1.4 }}>{noMatch(query.trim())}</div>
        )
      ) : null}
      {paged.pages > 1 ? (
        <div style={{ borderTop: '1px solid #F0EAE1' }}>
          <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('lobby.pagerAria', { list: title })} />
        </div>
      ) : null}
    </section>
  );
}
