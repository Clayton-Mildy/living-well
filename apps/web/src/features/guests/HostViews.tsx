// Guest hosts: the add / edit form (a sheet) and the host's detail (a pushed screen on a phone, a side drawer on tablet and laptop):
// who they are, how to reach and pay them, what they were paid and are owed, and their sessions.
import { useState, type ReactNode } from 'react';
import { fmtPhone, rp, waUrl, type GuestHost, type GuestHostKind } from '@cp/shared';
import { activityName } from '@cp/shared/rules/activity';
import { GUEST_KINDS, feeOfSession, hostOf, hostTotals, sessionsOfHost } from '@cp/shared/rules/guests';
import { Button, Drawer, Group, Icon, PhoneScreen, Select, Sheet, TextField, Toggle } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useT, useFmt } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useResetOn } from '../../lib/useResetOn';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { StatusDot } from '../activity/lib';
import { KindTile, MoneyField, kindLabel, rowStyle, stateOf } from './lib';

const telOf = (p: string) => 'tel:' + p.replace(/[^\d+]/g, '');

/** Add or edit a host. `onSaved` gets the host id (the booking sheet picks a host it just added). */
export function HostForm({ open, onClose, host, onSaved }: { open: boolean; onClose: () => void; host?: GuestHost; onSaved?: (id: string, fee: number) => void }) {
  const t = useT();
  const act = useAct();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GuestHostKind>('teacher');
  const [what, setWhat] = useState('');
  const [phone, setPhone] = useState('');
  const [fee, setFee] = useState('');
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState('');
  const [note, setNote] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  useResetOn(open ? host?.id ?? 'new' : null, () => {
    setName(host?.name ?? ''); setKind(host?.kind ?? 'teacher'); setWhat(host?.what ?? ''); setPhone(host?.phone ? fmtPhone(host.phone) : ''); setFee(host ? String(host.fee) : '');
    setBank(host?.bank?.bank ?? ''); setAccount(host?.bank?.account ?? ''); setHolder(host?.bank?.holder ?? ''); setNote(host?.note ?? ''); setActive(host?.active ?? true); setBusy(false);
  });
  const ready = !!name.trim() && !!what.trim() && Number(fee) > 0;
  const save = async () => {
    setBusy(true);
    const r = await act('guest.saveHost', { ...(host ? { id: host.id } : {}), name, kind, what, phone, fee: Number(fee), bank: { bank, account, holder }, note: note.trim() || null, active }, { silent: true });
    setBusy(false);
    if (r.ok) { say(t(host ? 'guests.hostSaved' : 'guests.hostAdded', { name: name.trim() })); onSaved?.(String(r.result.hostId), Number(fee)); onClose(); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={host ? t('guests.editHost') : t('guests.addHost')}
      footer={<Button full disabled={!ready || busy} onClick={save}>{host ? t('common.save') : t('guests.addHostBtn')}</Button>}>
      <TextField label={t('guests.name')} value={name} onChange={setName} maxLength={80} autoFocus={!host} />
      <Select label={t('guests.kind')} value={kind} onChange={setKind} options={GUEST_KINDS.map((k) => ({ value: k, label: kindLabel(t, k) }))} />
      <TextField label={t('guests.what')} value={what} onChange={setWhat} placeholder={t('guests.whatPh')} maxLength={80} />
      <TextField label={t('guests.phone')} value={phone} onChange={setPhone} inputMode="tel" type="tel" placeholder="+62 812-0000-0000" />
      <MoneyField label={t('guests.usualFee')} value={fee} onChange={setFee} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <TextField label={t('guests.bank')} value={bank} onChange={setBank} placeholder="BCA" maxLength={40} />
        <TextField label={t('guests.account')} value={account} onChange={setAccount} inputMode="numeric" maxLength={40} />
        <TextField label={t('guests.holder')} value={holder} onChange={setHolder} maxLength={80} />
      </div>
      <TextField label={t('guests.note')} value={note} onChange={setNote} multiline rows={2} maxLength={300} />
      {host ? <Toggle on={active} onClick={() => setActive(!active)} label={t('guests.active')} sub={t('guests.activeSub')} /> : null}
    </Sheet>
  );
}

/** A titled block: a grouped list on a phone, a plain section with a small caps title on tablet and laptop. */
export function Block({ title, meta, children, pad = 0 }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; pad?: number | string }) {
  const { isPhone } = useDevice();
  if (isPhone) return <Group title={title} meta={meta} pad={pad} gap={0}>{children}</Group>;
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {title ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: '#6E5A43', lineHeight: '18px' }}>{title}</span>{meta ? <span style={{ fontSize: 13, color: '#6B6259' }}>{meta}</span> : null}</div> : null}
      <div style={{ border: '1px solid #EFE7DC', borderRadius: 14, overflow: 'hidden', background: '#FFFFFF', padding: pad }}>{children}</div>
    </section>
  );
}

const kv = (label: ReactNode, value: ReactNode, first: boolean, phone: boolean, action?: ReactNode) => (
  <div key={String(label)} style={{ ...rowStyle(first, phone), cursor: 'default', minHeight: 54, padding: phone ? '8px 12px 8px 16px' : '10px 18px' }}>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.35 }}>{label}</span>
      <span style={{ fontSize: 16, lineHeight: 1.35, wordBreak: 'break-word' }}>{value}</span>
    </div>
    {action}
  </div>
);
const pill = (href: string, icon: string, label: string) => (
  <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener" aria-label={label} title={label} className="cp-press" style={{ width: 36, height: 36, borderRadius: 999, background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', textDecoration: 'none' }}><Icon name={icon} size={19} /></a>
);

export function HostDetail({ hostId, onClose, onBook, onEdit, onOpenSession }: { hostId: string | null; onClose: () => void; onBook: (hostId: string) => void; onEdit: (h: GuestHost) => void; onOpenSession: (id: string) => void }) {
  const t = useT();
  const { lang, fds } = useFmt();
  const { isPhone } = useDevice();
  const { role } = useMe();
  const s = useClub();
  const act = useAct();
  const [confirm, setConfirm] = useState(false);
  const host = hostId ? hostOf(s, hostId) : undefined;
  useResetOn(hostId, () => setConfirm(false));
  if (!host) return null;
  const canEdit = role === 'mgmt';
  const tot = hostTotals(s, host.id);
  const mine = sessionsOfHost(s, host.id);
  const wa = waUrl(host.phone);
  const archive = async () => {
    const r = await act('guest.archiveHost', { id: host.id }, { silent: true });
    if (r.ok) { say(t('guests.hostArchived', { name: host.name })); onClose(); }
  };
  const stat = (n: ReactNode, label: string) => (
    <div key={label} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: isPhone ? '12px 16px' : '12px 18px' }}>
      <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{n}</span>
      <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.3 }}>{label}</span>
    </div>
  );
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isPhone ? '0 4px' : 0 }}>
        <KindTile kind={host.kind} size={52} />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 22, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C' }}>{host.name}</span>
          <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.35 }}>{host.what} · {kindLabel(t, host.kind)}{host.active ? '' : ` · ${t('guests.inactive')}`}</span>
        </div>
      </div>
      <Block pad={0}>
        <div style={{ display: 'flex' }}>
          {stat(tot.sessions, t('guests.tSessions'))}
          {stat(rp(tot.paid), t('guests.tPaid'))}
          {stat(<span style={{ color: tot.owed ? '#7A5510' : undefined }}>{rp(tot.owed)}</span>, t('guests.tOwed'))}
        </div>
      </Block>
      <Block title={t('guests.contact')}>
        {kv(t('guests.phone'), host.phone ? fmtPhone(host.phone) : '—', true, isPhone, host.phone ? <span style={{ display: 'flex', gap: 8 }}>{pill(telOf(host.phone), 'call', `${t('common.call')} ${host.name}`)}{wa ? pill(wa, 'chat', t('guests.whatsapp', { name: host.name })) : null}</span> : undefined)}
        {kv(t('guests.bankDetails'), host.bank && (host.bank.bank || host.bank.account) ? [host.bank.bank, host.bank.account, host.bank.holder ? `a.n. ${host.bank.holder}` : ''].filter(Boolean).join(' · ') : '—', false, isPhone)}
        {kv(t('guests.usualFee'), rp(host.fee), false, isPhone)}
        {host.note ? kv(t('guests.note'), host.note, false, isPhone) : null}
      </Block>
      <Block title={t('guests.sessions')} meta={mine.length ? String(mine.length) : undefined}>
        {mine.length ? mine.map((g, i) => {
          const a = s.activities[g.activityId];
          const st = stateOf(s, g, t);
          return (
            <button key={g.id} type="button" className={isPhone ? 'cp-tap-self' : 'h-row'} onClick={() => onOpenSession(g.id)} style={{ ...rowStyle(i === 0, isPhone), minHeight: 54, padding: isPhone ? '8px 12px 8px 16px' : '10px 18px' }}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35 }}>{fds(g.date)} · {g.slot}</span>
                <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.35 }}>{activityName(a, lang)}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flex: 'none' }}>
                <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{rp(feeOfSession(s, g))}</span>
                {st ? <span style={{ fontSize: 13 }}><StatusDot color={st.color}>{st.text}</StatusDot></span> : null}
              </span>
              <Icon name="chevron_right" size={20} color="#A89C8E" />
            </button>
          );
        }) : <div style={{ padding: '16px', fontSize: 15, color: '#6B6259' }}>{t('guests.noSessionsHost')}</div>}
      </Block>
      {canEdit ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button variant="secondary" icon="edit" onClick={() => onEdit(host)}>{t('guests.editHost')}</Button>
          {confirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 12, background: '#F9E3DB', color: '#9A3D24' }}>
              <span style={{ fontSize: 14, lineHeight: '20px' }}>{t('guests.archiveAsk', { name: host.name })}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size={44} onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
                <Button variant="danger" size={44} onClick={archive}>{t('guests.archive')}</Button>
              </div>
            </div>
          ) : <Button variant="ghost" onClick={() => setConfirm(true)} style={{ color: '#9A3D24' }}>{t('guests.archive')}</Button>}
        </div>
      ) : null}
    </>
  );
  const book = canEdit && host.active ? <Button full icon="event_available" onClick={() => onBook(host.id)}>{t('guests.bookHost', { name: host.name })}</Button> : undefined;
  if (isPhone) return <PhoneScreen open onClose={onClose} label={host.name} back={t('guests.hosts')} footer={book}>{body}</PhoneScreen>;
  return <Drawer open onClose={onClose} label={host.name} footer={book}><div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{body}</div></Drawer>;
}
