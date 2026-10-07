// "Also today" (Prototype v3 aside rail, no box): trial guests (no time: they come from opening), visit guests (with their time) and unread messages from families.
// Plain text blocks (19px title, 14px sub line, the guest's actions) separated by hairlines. Every title is tappable: guest -> its enquiry (/enquiries),
// unread -> /chat (a quick link with an arrow). Guests show GUESTS_PER_PAGE at a time.
import { Fragment, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffUnread, type GuestVisit, type Role } from '@cp/shared';
import { alsoToday } from '@cp/shared/rules/lobby';
import { Button, Eyebrow, Icon, Pager, usePaged } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { CallLink, DotItem, drugLabel, relText } from './parts';
import type { TFn } from '../../lib/i18n';

/** Guests per page (a guest block carries care notes and two buttons, so it is tall). */
export const GUESTS_PER_PAGE = 5;

export interface GuestActions {
  onIn(g: GuestVisit): void;
  onOut(g: GuestVisit): void;
  onNoShow(g: GuestVisit): void;
  onUndoNoShow(g: GuestVisit): void;
}

const Rule = () => <div aria-hidden="true" style={{ height: 1, background: '#E6DDD1' }} />;

/** The guest's non-allergy care notes as one quiet line ("Walker · Health check on arrival · Staying for lunch"). */
function guestNotes(t: TFn, g: GuestVisit): string {
  const out: string[] = [];
  if (g.mobility) out.push(t('lobby.mobility.' + g.mobility));
  if (g.healthCheck) out.push(t('lobby.guestHealth'));
  if (g.lunch) out.push(t('lobby.guestLunch'));
  return out.join(' · ');
}

function Block({ title, openLabel, onClick, children }: { title: string; openLabel?: string; onClick: () => void; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" onClick={onClick} aria-label={openLabel ? `${title}. ${openLabel}` : undefined}
        style={{ alignSelf: 'flex-start', maxWidth: '100%', minHeight: 28, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#2B231C', fontFamily: 'Inter', fontSize: 19, lineHeight: 1.3, fontWeight: 500 }}>{title}</button>
      {children}
    </div>
  );
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
  const sub14 = { fontSize: 14, lineHeight: 1.4, color: '#6B6259' } as const;

  const blocks: ReactNode[] = guests.rows.map((g) => {
    const e = s.enquiries[g.enquiryId];
    const title = t(g.kind === 'trial' ? 'lobby.guestTrial' : 'lobby.guestVisit', { n: g.name });
    const sub = e ? t('lobby.guestWith', { e: g.escortName || e.contact.name, r: relText(t, e.contact.relation), s: t('lobby.source.' + e.source) }) : t('lobby.guestWithNo', { e: g.escortName });
    const allergies = g.drugs.map((d) => t('lobby.drugAllergy', { d: drugLabel(t, d) }));
    const notes = guestNotes(t, g);
    return (
      <Block key={g.id} title={title} openLabel={t('lobby.openEnquiry')} onClick={() => navigate('/enquiries')}>
        <div style={{ ...sub14, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 8px' }}>
          {g.time ? <><span style={{ fontVariantNumeric: 'tabular-nums', color: '#2B231C', fontWeight: 500 }}>{g.time}</span><span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: 999, background: '#B8AC9C', alignSelf: 'center' }} /></> : null}
          <span>{sub}</span>
        </div>
        {allergies.length || notes ? (
          <div style={{ ...sub14, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 10px' }}>
            {allergies.length ? <DotItem color="#A2452B">{allergies.join(', ')}</DotItem> : null}
            {notes ? <span>{notes}</span> : null}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {g.status === 'noShow' ? (
            <>
              <span style={sub14}>{t('lobby.guestStatusNoShow')}</span>
              <Button variant="secondary" size={44} onClick={() => guest.onUndoNoShow(g)}>{t('lobby.undoNoShow')}</Button>
            </>
          ) : g.checkOut ? (
            <span style={sub14}>{t('lobby.guestStatusOut', { t: g.checkOut.at })}</span>
          ) : g.checkIn ? (
            <>
              <DotItem color="#3F7A55">{t('lobby.guestStatusIn', { t: g.checkIn.at })}</DotItem>
              <Button variant="secondary" size={44} onClick={() => guest.onOut(g)}>{t('lobby.checkOut')}</Button>
            </>
          ) : (
            <>
              <Button variant="primary" size={44} onClick={() => guest.onIn(g)} label={`${t('lobby.checkIn')}: ${g.name}`}>{t('lobby.checkIn')}</Button>
              <Button variant="ghost" size={44} onClick={() => guest.onNoShow(g)} label={`${t('lobby.noShow')}: ${g.name}`}>{t('lobby.noShow')}</Button>
            </>
          )}
          {e?.contact.phone ? <CallLink t={t} name={g.escortName || e.contact.name} phone={e.contact.phone} /> : null}
        </div>
      </Block>
    );
  });
  if (guests.pages > 1) blocks.push(<Pager key="pager" page={guests.page} pages={guests.pages} onPage={guests.setPage} label={t('lobby.pagerAria', { list: t('lobby.alsoToday') })} />);
  if (unreadCount && a.unread.latest) {
    const sub = `“${a.unread.latest.message.text}” · ${s.familyContacts[a.unread.latest.thread.familyId]?.name || ''}`;
    blocks.push(
      <button key="unread" type="button" onClick={() => navigate('/chat')} style={{ padding: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#1E1A16', fontFamily: 'Inter', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, minHeight: 28 }}>
          <Icon name="chat" size={19} weight={300} color="#6E5A43" />
          <span>{unreadCount === 1 ? t('lobby.alsoUnread1') : t('lobby.alsoUnreadN', { n: unreadCount })}</span>
          <Icon name="arrow_forward" size={18} color="#6E5A43" />
        </span>
        <span style={{ ...sub14, paddingLeft: 27 }}>{sub}</span>
      </button>,
    );
  }
  if (empty) blocks.push(<div key="none" style={sub14}>{t('lobby.alsoNone')}</div>);

  return (
    <section aria-label={t('lobby.alsoToday')} style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 8, minWidth: 0 }}>
      <Eyebrow>{t('lobby.alsoToday')}</Eyebrow>
      {blocks.map((b, i) => <Fragment key={i}>{i > 0 ? <Rule /> : null}{b}</Fragment>)}
    </section>
  );
}
