// One guest session: who, when, what, the fee and where it stands (booked, to pay, paid). Management marks it done (once the day has come), edits it,
// cancels it; anyone with access can WhatsApp the host. Once it is done the fee is a vendor invoice that finance pays in Receipts.
import { useState } from 'react';
import { fmtPhone, rp, waUrl, type GuestSession } from '@cp/shared';
import { activityName } from '@cp/shared/rules/activity';
import { feeOfSession, guestIssue, hostOfSession, invoiceOfSession, payStateOf } from '@cp/shared/rules/guests';
import { Button, Icon, Note, Sheet } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useT, useFmt } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useNow } from '../../lib/clock';
import { useResetOn } from '../../lib/useResetOn';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { StatusDot } from '../activity/lib';
import { issueText, stateOf } from './lib';

export function SessionSheet({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (g: GuestSession) => void }) {
  const t = useT();
  const { lang, fdl, fds } = useFmt();
  const s = useClub();
  const act = useAct();
  const { today } = useNow();
  const { role } = useMe();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useResetOn(id, () => { setConfirm(false); setBusy(false); });
  const g = id ? s.guestSessions[id] : undefined;
  if (!g || g.deletedAt) return null;
  const host = hostOfSession(s, g);
  const name = host?.name ?? '';
  const a = s.activities[g.activityId];
  const inv = invoiceOfSession(s, g);
  const pay = payStateOf(s, g);
  const st = stateOf(s, g, t);
  const issue = guestIssue(s, g);
  const mgmt = role === 'mgmt';
  const booked = g.status === 'booked';
  const wa = waUrl(host?.phone);

  const run = async (name_: string, input: unknown, ok: string) => {
    setBusy(true);
    const r = await act(name_, input, { silent: true });
    setBusy(false);
    if (r.ok) { say(ok); onClose(); }
  };
  const field = (label: string, value: string) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', minHeight: 30 }}>
      <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{label}</span>
      <span style={{ fontSize: 16, lineHeight: 1.4, textAlign: 'right', minWidth: 0 }}>{value}</span>
    </div>
  );
  return (
    <Sheet open onClose={onClose} title={name}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {field(t('guests.when'), `${fds(g.date)} · ${g.slot}`)}
        {field(t('cal.activity'), activityName(a, lang))}
        {field(t('guests.fee'), rp(feeOfSession(s, g)))}
        {st ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', minHeight: 30 }}>
            <span style={{ fontSize: 14, color: '#6B6259' }}>{t('guests.status')}</span>
            <StatusDot color={st.color}>{st.text}</StatusDot>
          </div>
        ) : field(t('guests.status'), t('guests.st_booked'))}
        {inv ? field(t('guests.invoice'), `${inv.number} · ${pay === 'paid' && inv.paidOn ? t('guests.paidOn', { date: fds(inv.paidOn) }) : t('guests.dueOn', { date: fds(inv.due) })}`) : null}
        {g.note ? field(t('guests.note'), g.note) : null}
      </div>
      {issue ? <Note tone="ochre" icon="warning">{issueText(t, issue)}</Note> : null}
      {booked && g.date < today ? <Note tone="ochre" icon="event_available">{t('guests.overdue', { date: fdl(g.date) })}</Note> : null}
      {pay === 'toPay' ? <Note tone="cream" icon="hourglass_top">{t('guests.waitingFinance')}</Note> : null}
      {mgmt && booked && g.date <= today ? <Button full icon="task_alt" disabled={busy} onClick={() => run('guest.done', { id: g.id }, t('guests.doneToast', { name }))}>{t('guests.markDone')}</Button> : null}
      {(mgmt || role === 'finance') && pay === 'toPay' && inv && inv.status === 'approved' ? <Button full icon="paid" disabled={busy} onClick={() => run('vendorInvoice.markPaid', { id: inv.id }, t('guests.paidToast', { name }))}>{t('guests.markPaid')}</Button> : null}
      {wa ? (
        <a href={wa} target="_blank" rel="noopener" className="h-cream cp-press" style={{ height: 44, borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 500, textDecoration: 'none', fontFamily: 'Inter' }}>
          <Icon name="chat" size={19} weight={300} />{t('guests.whatsapp', { name })}<span style={{ color: '#6B6259', fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{host ? fmtPhone(host.phone) : ''}</span>
        </a>
      ) : null}
      {mgmt && booked ? (
        confirm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 12, background: '#F9E3DB', color: '#9A3D24' }}>
            <span style={{ fontSize: 14, lineHeight: '20px' }}>{t('guests.cancelAsk', { name, date: fdl(g.date) })}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" size={44} onClick={() => setConfirm(false)}>{t('guests.keep')}</Button>
              <Button variant="danger" size={44} disabled={busy} onClick={() => run('guest.cancel', { id: g.id }, t('guests.cancelledToast', { name }))}>{t('guests.cancelBooking')}</Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon="edit" full onClick={() => onEdit(g)}>{t('common.edit')}</Button>
            <Button variant="secondary" full onClick={() => setConfirm(true)} style={{ color: '#9A3D24' }}>{t('guests.cancelBooking')}</Button>
          </div>
        )
      ) : null}
    </Sheet>
  );
}
