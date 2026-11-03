// Round 17: "On your next bill", a small preview for the family's Bills page and the staff member Plan tab: the pick-up fee and the charges (field trips,
// a birthday cake) that wait for the next monthly invoice, with their total. Nothing is drawn when nothing waits.
import { nextBill } from '@cp/shared';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { lineLabel, money } from './lib';

export function NextBill({ memberId, caption }: { memberId: string; /** a name above the rows, when a family page shows more than one parent */ caption?: string }) {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const { today } = useNow();
  const { items, total } = nextBill(s, memberId, today);
  if (!items.length) return null;
  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, fontSize: 15, lineHeight: 1.4 } as const;
  return (
    <section data-testid="next-bill" aria-label={t('finance.next.title')} className="cp-fill" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h3 style={{ margin: 0, fontSize: 13, lineHeight: '18px', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#6B6259' }}>
        {t('finance.next.title')}{caption ? ` · ${caption}` : ''}
      </h3>
      {items.map((i) => (
        <div key={i.id} data-testid="next-item" style={row}>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere', color: '#24201C' }}>{lineLabel(t, fmt.fmonth, i)}</span>
          <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{money(i.amount)}</span>
        </div>
      ))}
      <div style={{ ...row, borderTop: '0.5px solid var(--hairline, #E2E2E6)', paddingTop: 6, fontWeight: 600 }}>
        <span>{t('finance.next.total')}</span>
        <span data-testid="next-total" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{money(total)}</span>
      </div>
    </section>
  );
}
