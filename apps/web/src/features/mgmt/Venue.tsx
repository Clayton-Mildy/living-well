// Venue bookings (design ScrVenue): book any future date with a time range (clash-checked), price and deposit; edit, cancel,
// create the invoice (simulated). KC round 7: after the event, "Ask for rating" sends the renter a no-login rating link (WhatsApp, simulated);
// the page can copy or open that link, and shows the rating that came back, with a link to the answers in Surveys. A rating can still be entered by hand.
import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dayStatus, fmtN, fmtPhone, parseN, ratePath, ratingLinkOf, rp, venueResponseOf, type Room, type VenueBooking } from '@cp/shared';
import { VENUE_EARLIEST, VENUE_LATEST, checkVenueSlot, venueLists, venueRooms } from '@cp/shared/rules/mgmt';
import { Button, Chip, DateField, Dialog, Group, Icon, Note, PageHead, Pager, Pin, SectionLabel, TextField, TimeField, usePaged, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { BadgePill, HPAD, ListCard, Page, PillBtn, heroCard, labelStyle, chipRow } from './common';

interface VForm { org: string; contactName: string; phone: string; guests: string; roomId: string; date: string; from: string; to: string; price: string; deposit: string }
const SLOTS: [string, string][] = [['08:00', '12:00'], ['13:00', '17:00'], ['17:00', '21:00']];
const blank = (rooms: Room[]): VForm => ({ org: '', contactName: '', phone: '', guests: '20', roomId: rooms[0]?.id ?? '', date: '', from: '', to: '', price: '', deposit: '' });
const fromBooking = (v: VenueBooking): VForm => ({ org: v.org, contactName: v.contactName, phone: v.phone ? fmtPhone(v.phone) : '', guests: String(v.guests), roomId: v.roomId, date: v.date, from: v.from, to: v.to, price: v.price ? fmtN(v.price) : '', deposit: v.deposit ? fmtN(v.deposit) : '' });
export const roomName = (r: Room | undefined, lang: string) => (r ? (lang === 'id' && r.nameId ? r.nameId : r.name) : '');

/** One action under a booking: a small pill on phones, a button on wider screens. */
interface Act { key: string; icon: string; label: string; run: () => void; primary?: boolean }

/** The rating a booking got (stars, what they wrote, who from, a link to the answers) or, when the link is out, that it is waiting. */
function RatingLine({ v }: { v: VenueBooking }) {
  const t = useT();
  const s = useClub();
  const navigate = useNavigate();
  const resp = venueResponseOf(s, v.id);
  if (!v.review) return null;
  return (
    <div data-rating={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 14, lineHeight: '20px' }}>
        {v.review.stars > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 500 }}><Icon name="star" size={16} fill={1} color="#75624B" />{v.review.stars}/5</span> : null}
        <span style={{ overflowWrap: 'anywhere' }}>“{v.review.text || t('mgmt.vnNoText')}”</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, lineHeight: '18px', color: '#6B6259' }}>
        {resp ? t('mgmt.vnRatingFrom', { name: resp.respondentName || v.contactName }) : t('mgmt.vnEnteredByHand')}
        {resp ? <button type="button" onClick={() => navigate(`/surveys?survey=${resp.surveyId}&tab=responses`)} style={{ border: 'none', background: 'transparent', padding: 0, color: '#75624B', fontSize: 13, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', fontFamily: 'Inter' }}>{t('mgmt.vnViewAnswers')}</button> : null}
      </span>
    </div>
  );
}

export function Venue() {
  const t = useT();
  const { isPhone } = useDevice();
  const lang = useLang();
  const { fdl, fds } = useFmt();
  const s = useClub();
  const { today, now } = useNow();
  const act = useAct();
  const rooms = venueRooms(s);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VForm>(() => blank(rooms));
  const [edit, setEdit] = useState<VenueBooking | null>(null);
  const [cancel, setCancel] = useState<VenueBooking | null>(null);
  const [review, setReview] = useState<VenueBooking | null>(null);
  const { upcoming, past } = venueLists(s, today, now);
  const upPaged = usePaged(upcoming, 6);
  const pastPaged = usePaged(past, 6);

  const book = async () => {
    const r = await act('venue.book', payload(form), { ok: t('mgmt.vnBooked', { date: fds(form.date), time: `${form.from}–${form.to}` }) });
    if (r.ok) { setOpen(false); setForm(blank(rooms)); }
  };
  const rateUrl = (token: string) => `${window.location.origin}${ratePath(token)}`;
  const copyLink = async (token: string) => {
    try { await navigator.clipboard.writeText(rateUrl(token)); say(t('mgmt.vnLinkCopied')); } catch { say(t('mgmt.vnLinkManual', { url: rateUrl(token) })); }
  };
  const row = (v: VenueBooking) => {
    const isPast = v.status === 'cancelled' || v.date < today || (v.date === today && v.to <= now);
    const done = v.status === 'confirmed' && isPast;
    const badge = v.status === 'cancelled' ? <BadgePill kind="void" label={t('status.cancelled')} />
      : done ? (v.review ? <BadgePill kind="paid" label={t('mgmt.vnReviewed', { n: v.review.stars })} /> : v.reviewAskedAt ? <BadgePill kind="pending" label={t('mgmt.vnAsked')} /> : <BadgePill kind="outstanding" label={t('mgmt.vnDone')} />)
      : <BadgePill kind="paid" label={t('mgmt.vnConfirmed')} />;
    const money = [v.price ? t('mgmt.vnPrice', { n: rp(v.price) }) : '', v.deposit ? t('mgmt.vnDeposit', { n: rp(v.deposit) }) : '', v.invoiceRef ? t('mgmt.vnInvoice', { ref: v.invoiceRef }) : ''].filter(Boolean).join(' · ');
    const needInvoice = !!(v.price && !v.invoiceRef);
    const link = ratingLinkOf(s, v.ratingToken);
    const ask = () => act('venue.askReview', { venueId: v.id }, { ok: t('mgmt.vnRatingSent', { name: v.contactName }) });
    const acts: Act[] = [];
    if (v.status === 'confirmed') {
      if (needInvoice) acts.push({ key: 'invoice', icon: 'receipt_long', label: t('mgmt.vnCreateInvoice'), primary: true, run: () => { void act('venue.createInvoice', { venueId: v.id }, { ok: (r) => t('mgmt.vnInvoiced', { ref: String(r.invoiceRef ?? '') }) }); } });
      if (done && !v.review && !v.ratingToken) acts.push({ key: 'ask', icon: 'send', label: t('mgmt.vnAskRating'), primary: !needInvoice, run: () => { void ask(); } });
      if (done && !v.review && v.ratingToken) {
        acts.push({ key: 'copy', icon: 'content_copy', label: t('mgmt.vnCopyLink'), run: () => { void copyLink(v.ratingToken!); } });
        acts.push({ key: 'open', icon: 'open_in_new', label: t('mgmt.vnOpenLink'), run: () => { window.open(rateUrl(v.ratingToken!), '_blank', 'noopener'); } });
        if (link?.state === 'closed') acts.push({ key: 'again', icon: 'send', label: t('mgmt.vnSendAgain'), run: () => { void ask(); } });
      }
      acts.push({ key: 'edit', icon: 'edit', label: t('common.edit'), run: () => setEdit(v) });
      if (!isPast) acts.push({ key: 'cancel', icon: 'event_busy', label: t('mgmt.vnCancel'), run: () => setCancel(v) });
      if ((done || v.date <= today) && !v.review) acts.push({ key: 'hand', icon: 'rate_review', label: t('mgmt.vnEnterByHand'), run: () => setReview(v) });
    }
    // a link out and not answered: waiting for the renter, or (the survey was replaced or closed) it needs sending again
    const linkNote = done && !v.review && v.ratingToken ? (link?.state === 'closed' ? t('mgmt.vnLinkClosed') : t('mgmt.vnWaiting', { name: v.contactName })) : '';
    if (isPhone) {
      // round 6, phone: a grouped row (icon, the booking's lines, status), then small pill actions under it
      return (
        <div key={v.id} data-venue={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0', borderTop: '1px solid #F0EAE1', opacity: v.status === 'cancelled' ? 0.7 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', flex: 'none' }}><Icon name="storefront" size={20} /></span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{v.org}</span>
              <span style={{ fontSize: 14, color: '#24201C', lineHeight: 1.4 }}>{t('mgmt.vnSub', { date: fdl(v.date), from: v.from, to: v.to, n: v.guests, room: roomName(s.rooms[v.roomId], lang) })}</span>
              <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{v.contactName}{v.phone ? ' · ' + fmtPhone(v.phone) : ''}</span>
              {money ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{money}</span> : null}
              <RatingLine v={v} />
              {linkNote ? <span style={{ fontSize: 13, color: '#6B6259', lineHeight: '18px', paddingTop: 2 }}>{linkNote}</span> : null}
              <span style={{ alignSelf: 'flex-start', paddingTop: 4 }}>{badge}</span>
            </div>
          </div>
          {acts.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 52 }}>
              {acts.map((a) => <PillBtn key={a.key} tone={a.primary ? 'primary' : 'secondary'} icon={a.icon} onClick={a.run}>{a.label}</PillBtn>)}
            </div>
          ) : null}
        </div>
      );
    }
    return (
      <Fragment key={v.id}>
        <div data-venue={v.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', padding: '18px 0', borderTop: '1px solid #F0EAE1', opacity: v.status === 'cancelled' ? 0.7 : 1 }}>
          <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 999, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', flex: 'none' }}><Icon name="storefront" size={21} /></span>
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{v.org}</span>
            <span style={{ fontSize: 14, color: '#24201C', lineHeight: 1.4 }}>{t('mgmt.vnSub', { date: fdl(v.date), from: v.from, to: v.to, n: v.guests, room: roomName(s.rooms[v.roomId], lang) })}</span>
            <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{v.contactName}{v.phone ? ' · ' + fmtPhone(v.phone) : ''}</span>
            {money ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{money}</span> : null}
            <RatingLine v={v} />
            {linkNote ? <span style={{ fontSize: 13, color: '#6B6259', lineHeight: '18px', paddingTop: 2 }}>{linkNote}</span> : null}
          </div>
          {badge}
          {acts.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: '1 1 100%', paddingLeft: 62 }}>
              {acts.map((a) => <Button key={a.key} size={44} variant={a.primary ? 'primary' : 'secondary'} icon={a.icon} onClick={a.run}>{a.label}</Button>)}
            </div>
          ) : null}
        </div>
      </Fragment>
    );
  };

  const startNew = () => { setForm(blank(rooms)); setOpen(true); };
  return (
    <>
    <Page max={1000} gap={18}>
      <PageHead eyebrow={t('mgmt.vnEyebrow')} title={t('mgmt.vnTitle')} right={!open && !isPhone ? <Button size={48} icon="add" onClick={startNew}>{t('mgmt.vnNew')}</Button> : undefined} />

      {open ? (isPhone ? (
        // round 6, phone: the booking form is one thing: one flat group under its header, the two actions below it
        <>
          <Group title={t('mgmt.vnBooking')} gap={16}><VenueForm value={form} onChange={setForm} rooms={rooms} /></Group>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <FormSubmit value={form} onClick={book}>{t('mgmt.vnConfirm')}</FormSubmit>
          </div>
        </>
      ) : (
        <div style={{ ...heroCard, padding: `22px ${HPAD}`, display: 'flex', flexDirection: 'column', gap: 16, animation: 'cpUp .2s ease-out' }}>
          <span style={labelStyle}>{t('mgmt.vnBooking')}</span>
          <VenueForm value={form} onChange={setForm} rooms={rooms} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <FormSubmit value={form} onClick={book}>{t('mgmt.vnConfirm')}</FormSubmit>
          </div>
        </div>
      )) : null}

      <ListCard title={t('mgmt.vnUpcoming')}>
        {upcoming.length ? upPaged.rows.map(row) : <div style={{ padding: '14px 0 16px', borderTop: '1px solid #F0EAE1', fontSize: 15, color: '#6B6259' }}>{t('mgmt.vnNone')}</div>}
        <Pager page={upPaged.page} pages={upPaged.pages} onPage={upPaged.setPage} label={t('mgmt.pgUpcoming')} />
      </ListCard>
      {past.length ? (
        <ListCard title={t('mgmt.vnPast')}>
          {pastPaged.rows.map(row)}
          <Pager page={pastPaged.page} pages={pastPaged.pages} onPage={pastPaged.setPage} label={t('mgmt.pgPast')} />
        </ListCard>
      ) : null}

      <Dialog open={!!edit} onClose={() => setEdit(null)} eyebrow={t('mgmt.vnBooking')} title={edit?.org || ''} maxWidth={640}>
        {edit ? <EditBody key={edit.id} v={edit} rooms={rooms} onClose={() => setEdit(null)} /> : null}
      </Dialog>
      <Dialog open={!!cancel} onClose={() => setCancel(null)} title={t('mgmt.vnCancelTitle')} maxWidth={480}
        footer={<><Button variant="secondary" onClick={() => setCancel(null)}>{t('mgmt.vnKeep')}</Button><Button variant="danger" onClick={async () => { if (!cancel) return; const r = await act('venue.cancel', { venueId: cancel.id }, { ok: t('mgmt.vnCancelled') }); if (r.ok) setCancel(null); }}>{t('mgmt.vnCancel')}</Button></>}>
        <div style={{ fontSize: 16, lineHeight: '24px' }}>{cancel ? t('mgmt.vnCancelText', { org: cancel.org, date: fdl(cancel.date) }) : null}</div>
      </Dialog>
      <ReviewDialog v={review} onClose={() => setReview(null)} />
    </Page>
    {isPhone && !open ? <Pin icon="add" label={t('mgmt.vnNew')} onClick={startNew} /> : null}
    </>
  );
}

const payload = (f: VForm) => ({
  org: f.org.trim(), contactName: f.contactName.trim(), phone: f.phone.trim(), guests: Number(f.guests), roomId: f.roomId, date: f.date, from: f.from, to: f.to,
  price: f.price ? parseN(f.price) : undefined, deposit: f.deposit ? parseN(f.deposit) : undefined,
});

/** Confirm button: disabled until the form is complete and the slot is free. */
function FormSubmit({ value, onClick, ignoreId, children }: { value: VForm; onClick: () => void; ignoreId?: string; children: string }) {
  const s = useClub();
  const { today, now } = useNow();
  const ok = formOk(value) && checkVenueSlot(s, { roomId: value.roomId, date: value.date, from: value.from, to: value.to }, today, now, ignoreId).ok;
  return <Button disabled={!ok} onClick={onClick}>{children}</Button>;
}
const formOk = (f: VForm) => !!(f.org.trim() && f.contactName.trim() && f.roomId && f.date && f.from && f.to && Number(f.guests) >= 1);

/** The booking fields: organisation, contact, any future date, time range with free/taken hints, room, price and deposit. */
function VenueForm({ value: f, onChange, rooms, ignoreId }: { value: VForm; onChange: (f: VForm) => void; rooms: Room[]; ignoreId?: string }) {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  const { today, now } = useNow();
  const set = (p: Partial<VForm>) => onChange({ ...f, ...p });
  const slot = { roomId: f.roomId, date: f.date, from: f.from, to: f.to };
  const check = f.date && f.from && f.to && f.roomId ? checkVenueSlot(s, slot, today, now, ignoreId) : null;
  const st = f.date ? dayStatus(s, f.date) : null;
  const dayNote = !st ? null : st.open ? (st.outing ? { tone: 'rust' as const, icon: 'directions_bus', text: t('mgmt.vnDayOuting') } : { tone: 'ochre' as const, icon: 'storefront', text: t('mgmt.vnDayOpen', { open: s.club.settings.open, close: s.club.settings.close }) })
    : st.reason === 'closed' ? { tone: 'rust' as const, icon: 'event_busy', text: t('mgmt.vnDayClosed') }
      : { tone: 'sage' as const, icon: 'event_available', text: st.reason === 'holiday' ? t('mgmt.vnDayHoliday') : t('mgmt.vnDayWeekend') };
  const slotSub = (a: string, b: string) => {
    if (!f.date || !f.roomId) return t('mgmt.vnPickDay');
    const c = checkVenueSlot(s, { roomId: f.roomId, date: f.date, from: a, to: b }, today, now, ignoreId);
    if (c.ok) return t('mgmt.vnFree');
    return c.code === 'mgmt.err.venueClash' ? t('mgmt.vnTaken') : c.code === 'mgmt.err.venueClubHours' ? t('mgmt.vnMembersHere') : c.code === 'mgmt.err.venueOuting' ? t('mgmt.vnOutingDay') : c.code === 'mgmt.err.venueClosed' ? t('mgmt.vnClosedDay') : c.code === 'mgmt.err.venuePast' ? t('mgmt.vnGone') : t('mgmt.vnNotFree');
  };
  const slotOk = (a: string, b: string) => !!f.date && !!f.roomId && checkVenueSlot(s, { roomId: f.roomId, date: f.date, from: a, to: b }, today, now, ignoreId).ok;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        <TextField label={t('mgmt.vnOrg')} value={f.org} onChange={(v) => set({ org: v })} placeholder={t('mgmt.vnOrgPh')} />
        <TextField label={t('mgmt.vnContact')} value={f.contactName} onChange={(v) => set({ contactName: v })} />
        <TextField label={t('mgmt.vnMobile')} value={f.phone} onChange={(v) => set({ phone: v })} inputMode="tel" />
        <TextField label={t('mgmt.vnGuests')} value={f.guests} onChange={(v) => set({ guests: v.replace(/\D/g, '') })} inputMode="numeric" />
      </div>
      <DateField label={t('mgmt.vnDay')} value={f.date} min={today} onChange={(v) => set({ date: v })} />
      {dayNote ? <Note tone={dayNote.tone === 'rust' ? 'rust' : dayNote.tone === 'sage' ? 'sage' : 'ochre'} icon={dayNote.icon}>{dayNote.text}</Note> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('mgmt.vnTime')}</span>
        <div style={chipRow}>
          {SLOTS.map(([a, b]) => {
            const sel = f.from === a && f.to === b;
            const off = !slotOk(a, b);
            return (
              <button key={a} type="button" className="cp-chip" aria-pressed={sel} aria-disabled={off || undefined} onClick={() => { if (!off || sel) set({ from: a, to: b }); }}
                style={{ minHeight: 52, minWidth: 96, padding: '6px 14px', borderRadius: 12, border: sel ? '1px solid #24201C' : off ? '1px solid #F0EAE1' : '1px solid #DCD3C8', background: sel ? '#24201C' : off ? '#F3EEE8' : '#FFFFFF', color: sel ? '#FFFFFF' : off ? '#5E5852' : '#24201C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        <TextField label={t('mgmt.vnPriceL')} prefix="Rp" value={f.price} onChange={(v) => set({ price: fmtN(v) })} inputMode="numeric" hint={t('mgmt.vnOptional')} />
        <TextField label={t('mgmt.vnDepositL')} prefix="Rp" value={f.deposit} onChange={(v) => set({ deposit: fmtN(v) })} inputMode="numeric" hint={t('mgmt.vnOptional')} />
      </div>
      {check && !check.ok ? <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: '#F9E3DB', color: '#9A3D24', fontSize: 16, lineHeight: '22px' }}><Icon name="error" size={20} fill={1} /><span data-testid="venue-error">{t(check.code, { ...(check.params || {}) })}</span></div> : null}
    </>
  );
}

function EditBody({ v, rooms, onClose }: { v: VenueBooking; rooms: Room[]; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const [f, setF] = useState<VForm>(() => fromBooking(v));
  const save = async () => {
    const p = payload(f);
    const r = await act('venue.update', { venueId: v.id, ...p, price: p.price ?? null, deposit: p.deposit ?? null }, { ok: t('mgmt.vnUpdated') });
    if (r.ok) onClose();
  };
  return (
    <>
      <VenueForm value={f} onChange={setF} rooms={rooms} ignoreId={v.id} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <EditSubmit value={f} v={v} onClick={save} />
      </div>
    </>
  );
}
/** Saving an unchanged date/time on a finished event is allowed; moving needs a free slot. */
function EditSubmit({ value, v, onClick }: { value: VForm; v: VenueBooking; onClick: () => void }) {
  const t = useT();
  const s = useClub();
  const { today, now } = useNow();
  const moved = value.roomId !== v.roomId || value.date !== v.date || value.from !== v.from || value.to !== v.to;
  const ok = formOk(value) && (!moved || checkVenueSlot(s, { roomId: value.roomId, date: value.date, from: value.from, to: value.to }, today, now, v.id).ok);
  return <Button disabled={!ok} onClick={onClick}>{t('common.saveChanges')}</Button>;
}

function ReviewDialog({ v, onClose }: { v: VenueBooking | null; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  const save = async () => {
    if (!v) return;
    const r = await act('venue.recordReview', { venueId: v.id, stars, text }, { ok: t('mgmt.vnReviewSaved') });
    if (r.ok) { setText(''); setStars(5); onClose(); }
  };
  return (
    <Dialog open={!!v} onClose={onClose} eyebrow={v?.org} title={t('mgmt.vnRecordReview')} maxWidth={520}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SectionLabel>{t('mgmt.vnStars')}</SectionLabel>
        <div style={chipRow} role="radiogroup" aria-label={t('mgmt.vnStars')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={t('mgmt.vnStarsOf', { n })} onClick={() => setStars(n)}
              style={{ width: 52, height: 52, borderRadius: 999, border: stars === n ? '1px solid #75624B' : '1px solid #E4DACD', background: stars === n ? '#F3EEE8' : '#FFFFFF', color: stars === n ? '#75624B' : '#8A755B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', fontFamily: 'Inter', fontSize: 16, fontWeight: 600 }}>
              {n}<Icon name="star" size={18} fill={stars >= n ? 1 : 0} />
            </button>
          ))}
        </div>
      </div>
      <TextField label={t('mgmt.vnReviewText')} multiline rows={3} value={text} onChange={setText} />
    </Dialog>
  );
}
