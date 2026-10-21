// Celebrations (round 12): a family asks the front desk to hold a room for a birthday or a small celebration at the club; the front desk requests it here
// and management confirms (a request by management is confirmed at once). Under Venue as its own tab: Requested (Confirm / Decline for management, "Waiting"
// for the front desk), Upcoming, Past. The form is the venue form's little sibling: a member, the occasion, a title the app suggests, the day, the time, the room.
import { useState } from 'react';
import { approvedMembers, listName, displayName, membershipStatus, sortBy, type Celebration, type CelebrationKind, type Member, type Room } from '@cp/shared';
import { CELEBRATION_KINDS, CELEBRATION_GUESTS_MAX, celebrationLists, celebrationTitle, checkCelebrationSlot } from '@cp/shared/rules/celebrations';
import { VENUE_EARLIEST, VENUE_LATEST, venueRooms } from '@cp/shared/rules/mgmt';
import { Button, ChipGroup, Chip, DateField, Dialog, Group, Icon, Note, Pager, Pin, Select, TextField, TimeField, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { BadgePill, HPAD, ListCard, PillBtn, SLOTS, heroCard, labelStyle, chipRow, roomName, useBusy } from './common';

interface CForm { memberId: string; kind: CelebrationKind; title: string; date: string; from: string; to: string; roomId: string; guests: string; note: string }
const blank = (rooms: Room[]): CForm => ({ memberId: '', kind: 'birthday', title: '', date: '', from: '', to: '', roomId: rooms[0]?.id ?? '', guests: '10', note: '' });
const fromRow = (c: Celebration): CForm => ({ memberId: c.memberId, kind: c.kind, title: c.title, date: c.date, from: c.from, to: c.to, roomId: c.roomId, guests: String(c.guests), note: c.cateringNote ?? '' });
const formOk = (f: CForm, title: string) => !!(f.memberId && title.trim() && f.roomId && f.date && f.from && f.to && f.guests !== '' && Number(f.guests) <= CELEBRATION_GUESTS_MAX);

/** The title the app suggests: "Opa Budi's 80th birthday" (the age comes from the date of birth and the day chosen). */
function suggestTitle(m: Member | undefined, f: CForm, lang: 'en' | 'id'): string {
  if (!m) return '';
  const years = f.kind === 'birthday' && m.dob && f.date ? Number(f.date.slice(0, 4)) - Number(m.dob.slice(0, 4)) : undefined;
  return celebrationTitle(f.kind, displayName(m), years, lang);
}

/** The fields: member (fixed when editing), occasion, title, day, time, room, guests, a cake or catering note. */
function CelForm({ value: f, onChange, rooms, ignoreId, memberLocked }: { value: CForm; onChange: (f: CForm) => void; rooms: Room[]; ignoreId?: string; memberLocked?: boolean }) {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  const { today, now } = useNow();
  const members = sortBy(approvedMembers(s).filter((m) => membershipStatus(m, today) !== 'ended'), (m) => listName(m));
  const m = s.members[f.memberId];
  const auto = suggestTitle(m, f, lang);
  const title = f.title || auto;
  const set = (p: Partial<CForm>) => onChange({ ...f, ...p });
  const slot = { roomId: f.roomId, date: f.date, from: f.from, to: f.to };
  const check = f.date && f.from && f.to && f.roomId ? checkCelebrationSlot(s, slot, today, now, ignoreId) : null;
  const slotCheck = (a: string, b: string) => (f.date && f.roomId ? checkCelebrationSlot(s, { roomId: f.roomId, date: f.date, from: a, to: b }, today, now, ignoreId) : null);
  const slotSub = (a: string, b: string) => {
    const c = slotCheck(a, b);
    if (!c) return t('mgmt.vnPickDay');
    if (c.ok) return t('mgmt.vnFree');
    return c.code === 'mgmt.err.venueClash' ? t('mgmt.vnTaken') : c.code === 'mgmt.err.venueOuting' ? t('mgmt.vnOutingDay') : c.code === 'mgmt.err.venueClosed' ? t('mgmt.vnClosedDay') : c.code === 'mgmt.err.venuePast' ? t('mgmt.vnGone') : t('mgmt.vnNotFree');
  };
  return (
    <>
      {memberLocked
        ? <div style={{ fontSize: 16, fontWeight: 500 }}>{m ? listName(m) : ''}</div>
        : <Select label={t('celeb.member')} value={f.memberId} onChange={(v) => set({ memberId: v })} placeholder={t('celeb.pickMember')} searchable options={members.map((x) => ({ value: x.id, label: listName(x) }))} />}
      <ChipGroup label={t('celeb.kind')} value={f.kind} onChange={(v) => set({ kind: v as CelebrationKind })} options={CELEBRATION_KINDS.map((k) => ({ value: k, label: t('celeb.kind_' + k) }))} />
      <TextField label={t('celeb.titleL')} value={title} onChange={(v) => set({ title: v })} />
      <DateField label={t('mgmt.vnDay')} value={f.date} min={today} onChange={(v) => set({ date: v })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('mgmt.vnTime')}</span>
        <div style={chipRow}>
          {SLOTS.map(([a, b]) => {
            const sel = f.from === a && f.to === b;
            const off = !slotCheck(a, b)?.ok;
            return (
              <button key={a} type="button" className={sel ? 'cp-chip' : 'cp-chip cp-fill'} aria-pressed={sel} aria-disabled={off || undefined} onClick={() => { if (!off || sel) set({ from: a, to: b }); }}
                style={{ minHeight: 52, minWidth: 96, padding: '6px 14px', borderRadius: 12, border: 'none', background: sel ? '#24201C' : 'var(--fill, #F4F4F5)', color: sel ? '#FFFFFF' : off ? '#8A8078' : '#24201C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}>
                <span style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1.4 }}>{a}–{b}</span>
                <span style={{ fontSize: FONT_SMALL, whiteSpace: 'nowrap', lineHeight: 1.4 }}>{slotSub(a, b)}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          <TimeField label={t('mgmt.vnFrom')} value={f.from} min={VENUE_EARLIEST} max={VENUE_LATEST} step={15} onChange={(v) => set({ from: v })} />
          <TimeField label={t('mgmt.vnTo')} value={f.to} min={VENUE_EARLIEST} max={VENUE_LATEST} step={15} onChange={(v) => set({ to: v })} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('mgmt.vnRoom')}</span>
        {rooms.length ? <div style={chipRow}>{rooms.map((r) => <Chip key={r.id} selected={f.roomId === r.id} onClick={() => set({ roomId: r.id })}>{roomName(r, lang)}</Chip>)}</div> : <Note icon="info">{t('mgmt.vnNoRooms')}</Note>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <TextField label={t('celeb.guestsL')} value={f.guests} onChange={(v) => set({ guests: v.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" />
        <TextField label={t('celeb.noteL')} value={f.note} onChange={(v) => set({ note: v })} placeholder={t('celeb.notePh')} hint={t('mgmt.vnOptional')} />
      </div>
      {check && !check.ok ? <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: '#F9E3DB', color: '#9A3D24', fontSize: 16, lineHeight: '22px' }}><Icon name="error" size={20} fill={1} /><span data-testid="celebration-error">{t(check.code, { ...(check.params || {}) })}</span></div> : null}
    </>
  );
}

/** Submit: disabled until the form is complete and the slot is free (an edit that leaves the slot alone is not re-checked, it is the row's own). */
function Submit({ f, ignoreId, busy, onClick, children }: { f: CForm; ignoreId?: string; busy: boolean; onClick: () => void; children: string }) {
  const s = useClub();
  const lang = useLang();
  const { today, now } = useNow();
  const title = f.title || suggestTitle(s.members[f.memberId], f, lang);
  const ok = formOk(f, title) && checkCelebrationSlot(s, { roomId: f.roomId, date: f.date, from: f.from, to: f.to }, today, now, ignoreId).ok;
  return <Button disabled={!ok || busy} onClick={onClick}>{children}</Button>;
}

export function Celebrations({ open, setOpen }: { open: boolean; setOpen: (b: boolean) => void }) {
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
  const [form, setForm] = useState<CForm>(() => blank(rooms));
  const [edit, setEdit] = useState<Celebration | null>(null);
  const [cancel, setCancel] = useState<Celebration | null>(null);
  const [decline, setDecline] = useState<Celebration | null>(null);
  const { busy, run } = useBusy();
  const { requested, upcoming, past } = celebrationLists(s, today, now);
  const upPaged = usePaged(upcoming, 6);
  const pastPaged = usePaged(past, 6);
  const titleOf = (f: CForm) => f.title || suggestTitle(s.members[f.memberId], f, lang);
  const payload = (f: CForm) => ({ kind: f.kind, title: titleOf(f).trim(), date: f.date, from: f.from, to: f.to, roomId: f.roomId, guests: Number(f.guests), cateringNote: f.note.trim() });

  const book = () => run(async () => {
    const r = await act('celebration.request', { memberId: form.memberId, ...payload(form) }, { ok: isMgmt ? t('celeb.bookedToast', { date: fdl(form.date) }) : t('celeb.requestedToast') });
    if (r.ok) { setOpen(false); setForm(blank(rooms)); }
  });
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

  const startNew = () => { setForm(blank(rooms)); setOpen(true); };
  const formBlock = isPhone ? (
    <>
      <Group title={t('celeb.new')} gap={16}><CelForm value={form} onChange={setForm} rooms={rooms} /></Group>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
        <Submit f={form} busy={busy} onClick={book}>{isMgmt ? t('celeb.bookBtn') : t('celeb.requestBtn')}</Submit>
      </div>
    </>
  ) : (
    <div className="cp-grey" style={{ ...heroCard, padding: `22px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 16, animation: 'cpUp .2s ease-out' }}>
      <span style={labelStyle}>{t('celeb.new')}</span>
      <CelForm value={form} onChange={setForm} rooms={rooms} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
        <Submit f={form} busy={busy} onClick={book}>{isMgmt ? t('celeb.bookBtn') : t('celeb.requestBtn')}</Submit>
      </div>
    </div>
  );

  return (
    <>
      {open ? formBlock : null}
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
