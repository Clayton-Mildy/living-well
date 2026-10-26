// The celebration request form as a sheet (round 14): the Celebrations tab, the Prepare button on a birthday row and the reminder's link (/celebrations?new=&date=) all
// open this one form. `prefill` starts it on a member, an occasion and a day (title "{nickname}'s birthday", the first room, 13:30–15:00).
import { useState } from 'react';
import { approvedMembers, listName, displayName, membershipStatus, sortBy, type Celebration, type CelebrationKind, type ISODate, type Member, type Room } from '@cp/shared';
import { CELEBRATION_KINDS, CELEBRATION_GUESTS_MAX, celebrationTitle, checkCelebrationSlot } from '@cp/shared/rules/celebrations';
import { VENUE_EARLIEST, VENUE_LATEST, venueRooms } from '@cp/shared/rules/mgmt';
import { Button, ChipGroup, Chip, DateField, Dialog, Icon, Note, Select, TextField, TimeField, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { SLOTS, chipRow, roomName, useBusy } from './common';

export interface CForm { memberId: string; kind: CelebrationKind; title: string; date: string; from: string; to: string; roomId: string; guests: string; note: string }
export const blank = (rooms: Room[]): CForm => ({ memberId: '', kind: 'birthday', title: '', date: '', from: '', to: '', roomId: rooms[0]?.id ?? '', guests: '10', note: '' });
/** The form for an edit of a celebration. */
export const fromRow = (c: Celebration): CForm => ({ memberId: c.memberId, kind: c.kind, title: c.title, date: c.date, from: c.from, to: c.to, roomId: c.roomId, guests: String(c.guests), note: c.cateringNote ?? '' });
const formOk = (f: CForm, title: string) => !!(f.memberId && title.trim() && f.roomId && f.date && f.from && f.to && f.guests !== '' && Number(f.guests) <= CELEBRATION_GUESTS_MAX);

/** The title the app suggests: "Opa Budi's 80th birthday" (the age comes from the date of birth and the day chosen). */
export function suggestTitle(m: Member | undefined, f: CForm, lang: 'en' | 'id'): string {
  if (!m) return '';
  const years = f.kind === 'birthday' && m.dob && f.date ? Number(f.date.slice(0, 4)) - Number(m.dob.slice(0, 4)) : undefined;
  return celebrationTitle(f.kind, displayName(m), years, lang);
}

/** The fields: member (fixed when editing), occasion, title, day, time, room, guests, a cake or catering note. */
export function CelForm({ value: f, onChange, rooms, ignoreId, memberLocked }: { value: CForm; onChange: (f: CForm) => void; rooms: Room[]; ignoreId?: string; memberLocked?: boolean }) {
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
export function Submit({ f, ignoreId, busy, onClick, children }: { f: CForm; ignoreId?: string; busy: boolean; onClick: () => void; children: string }) {
  const s = useClub();
  const lang = useLang();
  const { today, now } = useNow();
  const title = f.title || suggestTitle(s.members[f.memberId], f, lang);
  const ok = formOk(f, title) && checkCelebrationSlot(s, { roomId: f.roomId, date: f.date, from: f.from, to: f.to }, today, now, ignoreId).ok;
  return <Button disabled={!ok || busy} onClick={onClick}>{children}</Button>;
}

export interface CelebrationPrefill { memberId: string; kind: CelebrationKind; date: ISODate }
/** The form a Prepare tap starts: the member's occasion on its day, "{nickname}'s birthday", the first venue room, 13:30–15:00. */
export function prefillForm(s: Parameters<typeof venueRooms>[0], p: CelebrationPrefill, lang: 'en' | 'id'): CForm {
  const m = s.members[p.memberId];
  return { ...blank(venueRooms(s)), memberId: p.memberId, kind: p.kind, date: p.date, from: '13:30', to: '15:00', title: m ? celebrationTitle(p.kind, displayName(m), undefined, lang) : '' };
}

export function CelebrationSheet({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: CelebrationPrefill }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t('celeb.new')} maxWidth={640}>
      <SheetBody onClose={onClose} prefill={prefill} />
    </Dialog>
  );
}

/** Mounted only while the sheet is open, so each opening starts from a blank or pre-filled form. */
function SheetBody({ onClose, prefill }: { onClose: () => void; prefill?: CelebrationPrefill }) {
  const t = useT();
  const lang = useLang();
  const { fdl } = useFmt();
  const s = useClub();
  const act = useAct();
  const { role } = useMe();
  const isMgmt = role === 'mgmt';
  const rooms = venueRooms(s);
  const [form, setForm] = useState<CForm>(() => (prefill ? prefillForm(s, prefill, lang) : blank(rooms)));
  const { busy, run } = useBusy();
  const book = () => run(async () => {
    const title = form.title || suggestTitle(s.members[form.memberId], form, lang);
    const r = await act('celebration.request', { memberId: form.memberId, kind: form.kind, title: title.trim(), date: form.date, from: form.from, to: form.to, roomId: form.roomId, guests: Number(form.guests), cateringNote: form.note.trim() },
      { ok: isMgmt ? t('celeb.bookedToast', { date: fdl(form.date) }) : t('celeb.requestedToast') });
    if (r.ok) onClose();
  });
  return (
    <>
      <CelForm value={form} onChange={setForm} rooms={rooms} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Submit f={form} busy={busy} onClick={book}>{isMgmt ? t('celeb.bookBtn') : t('celeb.requestBtn')}</Submit>
      </div>
    </>
  );
}
