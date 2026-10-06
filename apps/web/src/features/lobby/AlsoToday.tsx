// "Also today": trial guests (no time: they come from opening), visit guests (with their time) and unread messages from families.
// Every row is tappable: guest -> its enquiry (/enquiries), unread -> /chat. Guests show GUESTS_PER_PAGE at a time.
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffUnread, type GuestVisit, type Role } from '@cp/shared';
import { alsoToday } from '@cp/shared/rules/lobby';
import { Button, FONT_BODY, FONT_SMALL, Icon, Pager, usePaged } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { CallLink, FlagChip, drugLabel, relText, type Flag } from './parts';
import type { TFn } from '../../lib/i18n';

/** Guests per page (a guest row carries care flags and two buttons, so it is tall). */
export const GUESTS_PER_PAGE = 5;

export interface GuestActions {
  onIn(g: GuestVisit): void;
  onOut(g: GuestVisit): void;
  onNoShow(g: GuestVisit): void;
  onUndoNoShow(g: GuestVisit): void;
}

function Item({ icon, title, sub, time, onClick, openLabel, children }: { icon: string; title: string; sub?: string; time?: string; onClick: () => void; openLabel?: string; children?: ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid #EFECEA', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <button type="button" onClick={onClick} aria-label={openLabel ? `${title}. ${openLabel}` : undefined} style={{ flex: 1, minWidth: 0, minHeight: 44, display: 'flex', gap: 12, alignItems: 'flex-start', padding: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
          <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', flex: 'none' }}><Icon name={icon} size={20} /></span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{title}</span>
            {sub ? <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{sub}</span> : null}
          </span>
        </button>
        {time ? <span style={{ fontSize: FONT_BODY, fontVariantNumeric: 'tabular-nums', color: '#282828', flex: 'none', lineHeight: 1.4 }}>{time}</span> : null}
      </div>
      {children ? <div style={{ paddingLeft: 52, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div> : null}
    </div>
  );
}

function guestFlags(t: TFn, g: GuestVisit): Flag[] {
  const rust = { bg: '#F7E4DD', ic: '#AF4B2F' };
  const linen = { bg: '#E8E1D8', ic: '#282828' };
  const out: Flag[] = [];
  for (const d of g.drugs) out.push({ icon: 'medication', label: t('lobby.drugAllergy', { d: drugLabel(t, d) }), ...rust });
  if (g.mobility) out.push({ icon: 'elderly', label: t('lobby.mobility.' + g.mobility), ...linen });
  if (g.healthCheck) out.push({ icon: 'monitor_heart', label: t('lobby.guestHealth'), ...linen });
  if (g.lunch) out.push({ icon: 'lunch_dining', label: t('lobby.guestLunch'), ...linen });
  return out;
}

export function AlsoToday({ role, guest }: { role: Role; guest: GuestActions }) {
  const t = useT();
  const s = useClub();
  const { today } = useNow();
  const navigate = useNavigate();
  const a = alsoToday(s, today, role);
  const unreadCount = a.unread.threads.reduce((n, th) => n + staffUnread(s, th), 0);
  const empty = !a.guests.length && !unreadCount;
  const guests = usePaged(a.guests, GUESTS_PER_PAGE);

  return (
    <section aria-label={t('lobby.alsoToday')} style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, paddingBottom: 8, lineHeight: '18px' }}>{t('lobby.alsoToday')}</div>
      {guests.rows.map((g) => {
        const e = s.enquiries[g.enquiryId];
        const title = t(g.kind === 'trial' ? 'lobby.guestTrial' : 'lobby.guestVisit', { n: g.name });
        const sub = e ? t('lobby.guestWith', { e: g.escortName || e.contact.name, r: relText(t, e.contact.relation), s: t('lobby.source.' + e.source) }) : t('lobby.guestWithNo', { e: g.escortName });
        const flags = guestFlags(t, g);
        return (
          <Item key={g.id} icon={g.kind === 'trial' ? 'waving_hand' : 'meeting_room'} title={title} sub={sub} time={g.time || undefined} onClick={() => navigate('/enquiries')} openLabel={t('lobby.openEnquiry')}>
            {flags.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{flags.map((f, i) => <FlagChip key={i} f={f} size="row" />)}</div> : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {g.status === 'noShow' ? (
                <>
                  <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('lobby.guestStatusNoShow')}</span>
                  <Button variant="secondary" size={44} onClick={() => guest.onUndoNoShow(g)}>{t('lobby.undoNoShow')}</Button>
                </>
              ) : g.checkOut ? (
                <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('lobby.guestStatusOut', { t: g.checkOut.at })}</span>
              ) : g.checkIn ? (
                <>
                  <span style={{ fontSize: FONT_BODY, color: '#3D6B4F', fontWeight: 600, lineHeight: 1.4, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check_circle" size={18} fill={1} />{t('lobby.guestStatusIn', { t: g.checkIn.at })}</span>
                  <Button variant="secondary" size={44} onClick={() => guest.onOut(g)}>{t('lobby.checkOut')}</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size={44} onClick={() => guest.onIn(g)} label={`${t('lobby.checkIn')}: ${g.name}`}>{t('lobby.checkIn')}</Button>
                  <Button variant="quiet" size={44} onClick={() => guest.onNoShow(g)} label={`${t('lobby.noShow')}: ${g.name}`}>{t('lobby.noShow')}</Button>
                </>
              )}
              {e?.contact.phone ? <CallLink t={t} name={g.escortName || e.contact.name} phone={e.contact.phone} /> : null}
            </div>
          </Item>
        );
      })}
      {guests.pages > 1 ? <Pager page={guests.page} pages={guests.pages} onPage={guests.setPage} label={t('lobby.pagerAria', { list: t('lobby.alsoToday') })} /> : null}
      {unreadCount && a.unread.latest ? (
        <Item icon="chat" title={unreadCount === 1 ? t('lobby.alsoUnread1') : t('lobby.alsoUnreadN', { n: unreadCount })}
          sub={`“${a.unread.latest.message.text}” · ${s.familyContacts[a.unread.latest.thread.familyId]?.name || ''}`} onClick={() => navigate('/chat')} />
      ) : null}
      {empty ? <div style={{ borderTop: '1px solid #EFECEA', padding: '14px 0 4px', fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('lobby.alsoNone')}</div> : null}
    </section>
  );
}
