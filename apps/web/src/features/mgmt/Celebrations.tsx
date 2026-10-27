// Celebrations (round 12): a family asks the front desk to hold a room for a birthday or a small celebration at the club; the front desk requests it here
// and management confirms (a request by management is confirmed at once). Under Venue as its own tab: Requested (Confirm / Decline for management, "Waiting"
// for the front desk), Upcoming, Past. The form is the venue form's little sibling: a member, the occasion, a title the app suggests, the day, the time, the room.
import { useState } from 'react';
import { listName, type Celebration, type Room } from '@cp/shared';
import { celebrationLists } from '@cp/shared/rules/celebrations';
import { venueRooms } from '@cp/shared/rules/mgmt';
import { Button, Dialog, Icon, Note, Pager, Pin, TextField, usePaged } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { BadgePill, ListCard, PillBtn, roomName, useBusy } from './common';
import { CelebrationSheet, type CelebrationPrefill, CelForm, Submit, fromRow, suggestTitle, type CForm } from './CelebrationSheet';

export function Celebrations({ open, setOpen, prefill }: { open: boolean; setOpen: (b: boolean) => void; prefill?: CelebrationPrefill }) {
  const t = useT();
  const lang = useLang();
  const { isPhone } = useDevice();
  const { fdl } = useFmt();
  const s = useClub();
  const { today, now } = useNow();
  const act = useAct();
  const { role } = useMe();
  const isMgmt = role === 'mgmt';
  const rooms = venueRooms(s);
  const [edit, setEdit] = useState<Celebration | null>(null);
  const [cancel, setCancel] = useState<Celebration | null>(null);
  const [decline, setDecline] = useState<Celebration | null>(null);
  const { busy, run } = useBusy();
  const { requested, upcoming, past } = celebrationLists(s, today, now);
  const upPaged = usePaged(upcoming, 6);
  const pastPaged = usePaged(past, 6);
  const decide = (c: Celebration, status: 'confirmed' | 'declined', reason?: string) => run(async () => {
    const r = await act('celebration.decide', { celebrationId: c.id, status, ...(reason ? { reason } : {}) }, { ok: status === 'confirmed' ? t('celeb.confirmedToast') : t('celeb.declinedToast') });
    if (r.ok) setDecline(null);
  });

  const row = (c: Celebration, kind: 'requested' | 'upcoming' | 'past') => {
    const m = s.members[c.memberId];
    const badge = c.status === 'requested' ? <BadgePill kind="pending" label={t('celeb.waiting')} />
      : c.status === 'confirmed' ? (kind === 'past' ? <BadgePill kind="outstanding" label={t('celeb.done')} /> : <BadgePill kind="paid" label={t('celeb.confirmedBadge')} />)
        : c.status === 'declined' ? <BadgePill kind="void" label={t('celeb.declined')} /> : <BadgePill kind="void" label={t('status.cancelled')} />;
    const acts: { key: string; icon: string; label: string; tone: 'primary' | 'secondary'; run: () => void }[] = [];
    if (kind !== 'past') {
      if (c.status === 'requested' && isMgmt) {
        acts.push({ key: 'confirm', icon: 'check', label: t('celeb.confirm'), tone: 'primary', run: () => { void decide(c, 'confirmed'); } });
        acts.push({ key: 'decline', icon: 'close', label: t('celeb.decline'), tone: 'secondary', run: () => setDecline(c) });
      }
      acts.push({ key: 'edit', icon: 'edit', label: t('common.edit'), tone: 'secondary', run: () => setEdit(c) });
      acts.push({ key: 'cancel', icon: 'event_busy', label: t('celeb.cancelBtn'), tone: 'secondary', run: () => setCancel(c) });
    }
    return (
      <div key={c.id} data-celebration={c.id} data-status={c.status} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: isPhone ? '12px 0' : '16px 0', borderTop: '0.5px solid var(--hairline, #E2E2E6)', opacity: c.status === 'declined' || c.status === 'cancelled' ? 0.7 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span aria-hidden="true" className="cp-fill" style={{ width: isPhone ? 40 : 46, height: isPhone ? 40 : 46, borderRadius: 999, background: 'var(--fill, #F4F4F5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent, #75624B)', flex: 'none' }}><Icon name="cake" size={isPhone ? 20 : 21} /></span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{c.title}</span>
            <span style={{ fontSize: 14, color: '#24201C', lineHeight: 1.4 }}>{t('celeb.sub', { date: fdl(c.date), from: c.from, to: c.to, room: roomName(s.rooms[c.roomId], lang) })}</span>
            <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{[m ? listName(m) : '', t(c.guests === 1 ? 'celeb.guest1' : 'celeb.guests', { n: c.guests }), c.cateringNote].filter(Boolean).join(' · ')}</span>
            {c.status === 'declined' && c.declineReason ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('celeb.declinedWhy', { reason: c.declineReason })}</span> : null}
            <span style={{ alignSelf: 'flex-start', paddingTop: 4 }}>{badge}</span>
          </div>
        </div>
        {acts.length ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: isPhone ? 52 : 62 }}>
            {acts.map((a) => <PillBtn key={a.key} tone={a.tone} icon={a.icon} disabled={busy} onClick={a.run}>{a.label}</PillBtn>)}
          </div>
        ) : null}
      </div>
    );
  };
  const none = (text: string) => <div style={{ padding: '14px 0 16px', borderTop: '0.5px solid var(--hairline, #E2E2E6)', fontSize: 15, color: '#6B6259' }}>{text}</div>;

  const startNew = () => setOpen(true);
  return (
    <>
      {requested.length ? (
        <ListCard title={t('celeb.requested')}>{requested.map((c) => row(c, 'requested'))}</ListCard>
      ) : null}
      <ListCard title={t('celeb.upcoming')}>
        {upcoming.length ? upPaged.rows.map((c) => row(c, 'upcoming')) : none(t('celeb.none'))}
        <Pager page={upPaged.page} pages={upPaged.pages} onPage={upPaged.setPage} label={t('mgmt.pgUpcoming')} />
      </ListCard>
      {past.length ? (
        <ListCard title={t('celeb.past')}>
          {pastPaged.rows.map((c) => row(c, 'past'))}
          <Pager page={pastPaged.page} pages={pastPaged.pages} onPage={pastPaged.setPage} label={t('mgmt.pgPast')} />
        </ListCard>
      ) : null}

      <Dialog open={!!edit} onClose={() => setEdit(null)} eyebrow={t('celeb.title')} title={edit?.title || ''} maxWidth={640}>
        {edit ? <EditBody key={edit.id} c={edit} rooms={rooms} isMgmt={isMgmt} onClose={() => setEdit(null)} /> : null}
      </Dialog>
      <Dialog open={!!cancel} onClose={() => setCancel(null)} title={t('celeb.cancelTitle')} maxWidth={480}
        footer={<><Button variant="secondary" onClick={() => setCancel(null)}>{t('mgmt.vnKeep')}</Button>
          <Button variant="danger" disabled={busy} onClick={() => { if (cancel) void run(async () => { const r = await act('celebration.cancel', { celebrationId: cancel.id }, { ok: t('celeb.cancelledToast') }); if (r.ok) setCancel(null); }); }}>{t('celeb.cancelBtn')}</Button></>}>
        <div style={{ fontSize: 16, lineHeight: '24px' }}>{cancel ? t('celeb.cancelText', { title: cancel.title, date: fdl(cancel.date) }) : null}</div>
      </Dialog>
      <DeclineDialog c={decline} busy={busy} onClose={() => setDecline(null)} onDecline={(c, reason) => { void decide(c, 'declined', reason); }} />
      <CelebrationSheet open={open} onClose={() => setOpen(false)} prefill={prefill} />
      {isPhone && !open ? <Pin icon="add" label={t('celeb.new')} onClick={startNew} /> : null}
    </>
  );
}

function EditBody({ c, rooms, isMgmt, onClose }: { c: Celebration; rooms: Room[]; isMgmt: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  const act = useAct();
  const { busy, run } = useBusy();
  const [f, setF] = useState<CForm>(() => fromRow(c));
  const save = () => run(async () => {
    const title = f.title || suggestTitle(s.members[f.memberId], f, lang);
    const r = await act('celebration.update', { celebrationId: c.id, kind: f.kind, title: title.trim(), date: f.date, from: f.from, to: f.to, roomId: f.roomId, guests: Number(f.guests), cateringNote: f.note.trim() },
      { ok: c.status === 'confirmed' && !isMgmt ? t('celeb.updatedAgain') : t('celeb.updatedToast') });
    if (r.ok) onClose();
  });
  return (
    <>
      {c.status === 'confirmed' && !isMgmt ? <Note icon="info">{t('celeb.editReconfirm')}</Note> : null}
      <CelForm value={f} onChange={setF} rooms={rooms} ignoreId={c.id} memberLocked />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Submit f={f} ignoreId={c.id} busy={busy} onClick={save}>{t('common.saveChanges')}</Submit>
      </div>
    </>
  );
}

function DeclineDialog({ c, busy, onClose, onDecline }: { c: Celebration | null; busy: boolean; onClose: () => void; onDecline: (c: Celebration, reason: string) => void }) {
  const t = useT();
  const [reason, setReason] = useState('');
  return (
    <Dialog open={!!c} onClose={() => { setReason(''); onClose(); }} eyebrow={c?.title} title={t('celeb.declineTitle')} maxWidth={480}
      footer={<><Button variant="secondary" onClick={() => { setReason(''); onClose(); }}>{t('common.cancel')}</Button><Button variant="danger" disabled={busy} onClick={() => { if (c) { onDecline(c, reason.trim()); setReason(''); } }}>{t('celeb.decline')}</Button></>}>
      <TextField label={t('celeb.reasonL')} value={reason} onChange={setReason} hint={t('mgmt.vnOptional')} />
    </Dialog>
  );
}
