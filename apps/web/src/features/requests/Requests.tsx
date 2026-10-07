// Requests (new screen) for section staff: ask for stock, ask for budget, snap a receipt; then follow "My requests".
// Reuses the kitchen stock form and the finance actions; housekeeping and driver land here as their home screen.
import { useState } from 'react';
import { defaultAreaFor } from '@cp/shared/rules/kitchenOps';
import { PageHead, Icon } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { StockForm } from '../kitchen/StockForm';
import { BudgetForm } from './BudgetForm';
import { MyRequests } from './MyRequests';
import { ReceiptSnap } from './ReceiptSnap';
import { hasAction } from './finance';

type Panel = 'stock' | 'budget' | 'receipt';

export function Requests() {
  const t = useT();
  const { device, isPhone } = useDevice();
  const { role } = useMe();
  const [open, setOpen] = useState<Panel | null>(null);
  const tiles: { id: Panel; icon: string; title: string; enabled: boolean }[] = [
    { id: 'stock', icon: 'inventory_2', title: t('requests.stock.title'), enabled: true },
    { id: 'budget', icon: 'pie_chart', title: t('requests.budget.title'), enabled: hasAction('budget.request') },
    { id: 'receipt', icon: 'photo_camera', title: t('requests.receipt.title'), enabled: hasAction('receipt.add') },
  ];
  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 16 : 'clamp(18px, 2.8vw, 32px)', maxWidth: 900 }}>
      <PageHead eyebrow={t('requests.eyebrow')} title={t('requests.title')} />
      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'repeat(3, minmax(0, 1fr))' : 'repeat(auto-fit,minmax(220px,1fr))', gap: isPhone ? 8 : 14 }} role="group" aria-label={t('requests.new')}>
        {tiles.map((x) => {
          const on = open === x.id;
          return (
            <button key={x.id} type="button" className={x.enabled ? 'dh30' : undefined} data-testid={`tile-${x.id}`} aria-expanded={on} aria-disabled={!x.enabled || undefined} onClick={() => x.enabled && setOpen(on ? null : x.id)}
              style={{ display: 'flex', flexDirection: isPhone ? 'column' : 'row', alignItems: 'center', justifyContent: isPhone ? 'center' : undefined, gap: isPhone ? 8 : 14, padding: isPhone ? '14px 6px' : '14px 18px', minHeight: isPhone ? 84 : 76, borderRadius: 14, border: on ? '1px solid #24201C' : '1px solid #EFE7DC', background: !x.enabled ? '#F3EEE8' : on ? '#FBF8F4' : '#FFFFFF', boxShadow: x.enabled ? 'var(--card-shadow)' : undefined, color: x.enabled ? '#24201C' : '#6B6259', textAlign: isPhone ? 'center' : 'left', cursor: x.enabled ? 'pointer' : 'not-allowed', fontFamily: 'Inter' }}>
              <span aria-hidden="true" style={{ width: isPhone ? 36 : 42, height: isPhone ? 36 : 42, borderRadius: 999, background: '#F3EEE8', color: '#6E5A43', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name={x.icon} size={isPhone ? 20 : 22} weight={300} />
              </span>
              <span style={{ flex: isPhone ? undefined : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: isPhone ? 14 : 16, fontWeight: 500, lineHeight: 1.3 }}>{x.title}</span>
                {x.enabled ? null : <span className="cp-hide-phone" style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('requests.soon')}</span>}
              </span>
              {isPhone ? null : <Icon name={on ? 'remove' : 'add'} size={20} color="#6E5A43" />}
            </button>
          );
        })}
      </div>
      {open === 'stock' ? <StockForm defaultArea={defaultAreaFor(role)} onSent={() => setOpen(null)} /> : null}
      {open === 'budget' ? <BudgetForm onSent={() => setOpen(null)} /> : null}
      {open === 'receipt' ? <ReceiptSnap onDone={() => setOpen(null)} /> : null}
      <MyRequests />
    </div>
  );
}
