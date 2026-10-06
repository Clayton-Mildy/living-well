// Requests (new screen) for section staff: ask for stock, ask for budget, snap a receipt; then follow "My requests".
// Reuses the kitchen stock form and the finance actions; housekeeping and driver land here as their home screen.
import { useState } from 'react';
import { defaultAreaFor } from '@cp/shared/rules/kitchenOps';
import { PageHead, Icon, FONT_BODY } from '../../components/ui';
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
  const tiles: { id: Panel; icon: string; title: string; sub: string; enabled: boolean }[] = [
    { id: 'stock', icon: 'inventory_2', title: t('requests.stock.title'), sub: t('requests.stock.sub'), enabled: true },
    { id: 'budget', icon: 'pie_chart', title: t('requests.budget.title'), sub: t('requests.budget.sub'), enabled: hasAction('budget.request') },
    { id: 'receipt', icon: 'photo_camera', title: t('requests.receipt.title'), sub: t('requests.receipt.sub'), enabled: hasAction('receipt.add') },
  ];
  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 18, maxWidth: 900 }}>
      <PageHead eyebrow={t('requests.eyebrow')} title={t('requests.title')} />
      <div className="cp-tiles cp-tiles3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,160px),1fr))', gap: 12 }} role="group" aria-label={t('requests.new')}>
        {tiles.map((x) => (
          <button key={x.id} type="button" className={`${x.enabled ? 'dh30 ' : ''}cp-tile cp-tile-stack`} data-testid={`tile-${x.id}`} aria-expanded={open === x.id} aria-disabled={!x.enabled || undefined} onClick={() => x.enabled && setOpen(open === x.id ? null : x.id)}
            style={{ minHeight: 104, padding: '16px 18px', borderRadius: 20, border: open === x.id ? '2px solid #75624B' : '1px solid #DBD7D6', background: x.enabled ? '#FFFFFF' : '#F4F0EE', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, color: x.enabled ? '#282828' : '#6A6967', textAlign: 'left', cursor: x.enabled ? 'pointer' : 'not-allowed', fontFamily: 'Inter' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>
              <Icon name={x.icon} size={20} color="#75624B" />
              {x.title}
            </span>
            <span className="cp-hide-phone" style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{x.enabled ? x.sub : t('requests.soon')}</span>
          </button>
        ))}
      </div>
      {open === 'stock' ? <StockForm defaultArea={defaultAreaFor(role)} onSent={() => setOpen(null)} /> : null}
      {open === 'budget' ? <BudgetForm onSent={() => setOpen(null)} /> : null}
      {open === 'receipt' ? <ReceiptSnap onDone={() => setOpen(null)} /> : null}
      <MyRequests />
    </div>
  );
}
