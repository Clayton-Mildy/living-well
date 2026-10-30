// Round 16 (KC): a celebration is free unless the family asks for something (a cake, decorations). The front desk and management add or remove charges
// while it is open; finance or management issues them on an invoice of their own (CEL-…), which the family pays with the same virtual account.
import { useState } from 'react';
import { parseN, rp } from '@cp/shared';
import { celebrationIsPast, celebrationTotal } from '@cp/shared/rules/celebrations';
import { Button, Icon, IconButton, TextField } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';

export function ChargesBody({ celebrationId }: { celebrationId: string }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { today, now } = useNow();
  const { role } = useMe();
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const c = s.celebrations?.[celebrationId];
  if (!c) return null;
  const charges = c.charges ?? [];
  const live = c.status !== 'declined' && c.status !== 'cancelled';
  const canEdit = (role === 'lobby' || role === 'mgmt') && live && !celebrationIsPast(c, today, now);
  const canIssue = (role === 'finance' || role === 'mgmt') && live && charges.some((x) => !x.invoiceId);
  const n = parseN(amount);
  const run = async (name: string, input: Record<string, unknown>, ok: string | ((r: Record<string, unknown>) => string)) => {
    if (busy) return false;
    setBusy(true);
    try { return (await act(name, input, { ok })).ok; } finally { setBusy(false); }
  };
  const add = async () => {
    if (!item.trim() || n < 1000) return;
    if (await run('celebration.addCharge', { celebrationId, item: item.trim(), amount: n }, t('celeb.chargeAdded', { item: item.trim() }))) { setItem(''); setAmount(''); }
  };
  const total = celebrationTotal(c);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>
        {charges.map((x, i) => (
          <div key={x.id} data-charge={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '6px 8px 6px 16px', borderTop: i ? '0.5px solid var(--hairline, #E2E2E6)' : 'none' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.4 }}>{x.item} · {rp(x.amount)}</span>
            {x.invoiceId ? <span style={{ fontSize: 13, color: '#6B6259' }}>{x.invoiceId}</span>
              : canEdit ? <IconButton icon="close" label={t('common.remove')} size={40} onClick={() => void run('celebration.removeCharge', { celebrationId, chargeId: x.id }, t('celeb.chargeRemoved', { item: x.item }))} /> : null}
          </div>
        ))}
        <div data-testid="charges-total" style={{ padding: '12px 16px', borderTop: charges.length ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', fontSize: 15, fontWeight: 500 }}>
          {total ? t('celeb.total', { amount: rp(total) }) : t('celeb.free')}
        </div>
      </div>
      {canEdit ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 160px' }}><TextField label={t('celeb.item')} value={item} onChange={setItem} maxLength={60} name="item" /></div>
          <div style={{ flex: '1 1 120px' }}><TextField label={t('celeb.price')} value={amount} onChange={(v) => setAmount(v.replace(/[^\d.]/g, ''))} inputMode="numeric" placeholder="Rp" name="amount" /></div>
          <Button variant="secondary" disabled={busy || !item.trim() || n < 1000} onClick={() => void add()}><Icon name="add" size={18} />{t('celeb.addCharge')}</Button>
        </div>
      ) : null}
      {canIssue ? <Button disabled={busy} onClick={() => void run('celebration.issueInvoice', { celebrationId }, (r) => t('celeb.issued', { number: String(r.invoiceId ?? '') }))}><Icon name="receipt_long" size={18} />{t('celeb.issueInvoice')}</Button> : null}
    </div>
  );
}
