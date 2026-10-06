// One list card of Arrivals: the check-in list (members not in yet), the check-out list (members in the club) and "Gone home".
// Heading with a count, an optional hint and search, the member rows (a page of PAGE_SIZE at a time, with a pager), and the empty / no-match states.
import type { BoardRow } from '@cp/shared';
import { FONT_BODY, Icon, Pager, usePaged } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { Field } from './parts';
import { MemberRow } from './MemberRow';

/** Members per page. Searching goes back to page 1. */
export const PAGE_SIZE = 10;

export interface ListEmpty { icon: string; title: string; sub?: string }

export function MemberList({ t, title, hint, hintIcon, rows, total, query, onQuery, empty, noMatch, selectedId, onOpen, onCheckIn, onCheckOut, listId }: {
  t: TFn;
  title: string;
  hint?: string;
  hintIcon?: string;
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
  listId: string;
}) {
  const searching = !!query.trim();
  const paged = usePaged(rows, PAGE_SIZE, query.trim());
  return (
    <section aria-label={title} data-list={listId} style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden' }}>
      <div className="cp-ml-head" style={{ padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="cp-ml-title" style={{ margin: 0, fontSize: 28, lineHeight: '36px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C', minWidth: 0 }}>{title}</h2>
          <span data-testid={`count-${listId}`} style={{ fontSize: 16, color: '#6A6967', lineHeight: 1.4, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
            {searching ? t('lobby.countOf', { n: rows.length, total }) : total}
          </span>
        </div>
        {hint ? (
          <span className="cp-hide-phone" style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            {hintIcon ? <Icon name={hintIcon} size={18} color="#75624B" style={{ marginTop: 1 }} /> : null}
            {hint}
          </span>
        ) : null}
        {onQuery ? <Field value={query} onChange={onQuery} inputMode="search" placeholder={t('lobby.searchMember')} label={<span className="sr-only">{t('lobby.searchMember')}</span>} /> : null}
      </div>
      {paged.rows.map((r) => (
        <MemberRow key={r.m.id} r={r} selected={selectedId === r.m.id} onOpen={() => onOpen(r.m.id)} onCheckIn={() => onCheckIn?.(r.m.id)} onCheckOut={() => onCheckOut?.(r.m.id)} />
      ))}
      {!rows.length ? (
        total === 0 || !searching ? (
          <div style={{ padding: '36px 24px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', borderTop: '1px solid #EFECEA' }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={empty.icon} size={30} color="#8A755B" /></div>
            <div style={{ fontSize: 20, letterSpacing: '-0.3px', lineHeight: 1.3 }}>{empty.title}</div>
            {empty.sub ? <div style={{ fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{empty.sub}</div> : null}
          </div>
        ) : (
          <div style={{ padding: '28px 24px', borderTop: '1px solid #EFECEA', fontSize: 16, color: '#6A6967', textAlign: 'center', lineHeight: 1.4 }}>{noMatch(query.trim())}</div>
        )
      ) : null}
      {paged.pages > 1 ? (
        <div style={{ borderTop: '1px solid #EFECEA' }}>
          <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('lobby.pagerAria', { list: title })} />
        </div>
      ) : null}
    </section>
  );
}
