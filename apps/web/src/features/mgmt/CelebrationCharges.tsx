// Round 16 (KC): a celebration is free unless the family asks for something (a cake, decorations). The front desk and management add or remove charges
// while it is open. Round 17: each one is a pending charge that lands on the member's next monthly invoice (no invoice of its own).
import { useState } from 'react';
import { parseN, rp } from '@cp/shared';
import { celebrationChargeInvoice, celebrationIsPast, celebrationTotal } from '@cp/shared/rules/celebrations';
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
  const invoice = (x: (typeof charges)[number]) => celebrationChargeInvoice(s, x);
  const total = celebrationTotal(c);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>
        {charges.map((x, i) => (
          <div key={x.id} data-charge={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '6px 8px 6px 16px', borderTop: i ? '0.5px solid var(--hairline, #E2E2E6)' : 'none' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.4 }}>{x.item} · {rp(x.amount)}</span>
            <span style={{ fontSize: 13, color: '#6B6259' }}>{invoice(x) ? t('celeb.onInvoice', { number: invoice(x)! }) : live ? t('celeb.onNextBill') : t('celeb.notBilled')}</span>
            {!invoice(x) && canEdit ? <IconButton icon="close" label={t('common.remove')} size={40} onClick={() => void run('celebration.removeCharge', { celebrationId, chargeId: x.id }, t('celeb.chargeRemoved', { item: x.item }))} /> : null}
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
    </div>
  );
}

/** Round 18: the charges of a party that is not saved yet. They stay in the sheet's state and travel with celebration.request. */
export interface DraftCharge { item: string; amount: number }
export const CHARGES_MAX = 10;
export function ChargeListEditor({ value, onChange }: { value: DraftCharge[]; onChange: (v: DraftCharge[]) => void }) {
  const t = useT();
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const n = parseN(amount);
  const ok = !!item.trim() && n >= 1000 && n <= 100_000_000 && value.length < CHARGES_MAX;
  const add = () => { if (!ok) return; onChange([...value, { item: item.trim(), amount: n }]); setItem(''); setAmount(''); };
  const total = value.reduce((a, x) => a + x.amount, 0);
  return (
    <div data-testid="charge-list-editor" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>
        {value.map((x, i) => (
          <div key={i} data-charge={i} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '6px 8px 6px 16px', borderTop: i ? '0.5px solid var(--hairline, #E2E2E6)' : 'none' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.4 }}>{x.item} · {rp(x.amount)}</span>
            <IconButton icon="close" label={t('common.remove')} size={40} onClick={() => onChange(value.filter((_, k) => k !== i))} />
          </div>
        ))}
        <div data-testid="charges-total" style={{ padding: '12px 16px', borderTop: value.length ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', fontSize: 15, fontWeight: 500 }}>
          {total ? t('celeb.total', { amount: rp(total) }) : t('celeb.free')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 160px' }}><TextField label={t('celeb.item')} value={item} onChange={setItem} maxLength={60} name="item" /></div>
        <div style={{ flex: '1 1 120px' }}><TextField label={t('celeb.price')} value={amount} onChange={(v) => setAmount(v.replace(/[^\d.]/g, ''))} inputMode="numeric" placeholder="Rp" name="amount" /></div>
        <Button variant="secondary" disabled={!ok} onClick={add}><Icon name="add" size={18} />{t('celeb.addCharge')}</Button>
      </div>
    </div>
  );
}
