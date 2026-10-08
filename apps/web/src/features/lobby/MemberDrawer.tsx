// Member drawer (design OvDrawer): who they are, today's status (usual arrival time, arrived / left), care flags, notes,
// family and nanny with real tel: links, and the actions: check in / check out, undo.
import { useNavigate } from 'react-router-dom';
import { contactsOfMember, fmtPhone, live, memberAge, memberName, pron, sortBy, todayReading, attOf, type ClubState, type Member } from '@cp/shared';
import { visitInfo } from '@cp/shared/rules/lobby';
import { Button, Drawer, FONT_BODY, Group, Icon, PhoneScreen, StaffOnlyTag } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, type TFn } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { CallLink, FlagChip, MemberAvatar, ReadingBadge, Stack, cap, memberFlags, relText } from './parts';

const label = { fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase' as const, fontWeight: 500, lineHeight: '18px', color: '#6E5A43' };

export interface DrawerActions {
  onCheckIn(id: string): void;
  onCheckOut(id: string): void;
  onUndoIn(id: string): void;
  onUndoOut(id: string): void;
}

/** "Flex · visit 8 of 10 this month" or "Gold · unlimited days". */
export function visitLine(t: TFn, s: ClubState, m: Member, date: string) {
  const v = visitInfo(s, m, date);
  return v.flex ? t('lobby.visitOf', { n: v.n, q: v.quota ?? 0 }) : t('lobby.goldU');
}

export function MemberDrawer({ memberId, onClose, actions }: { memberId: string | null; onClose: () => void; actions: DrawerActions }) {
  const t = useT();
  const s = useClub();
  const { today } = useNow();
  const navigate = useNavigate();
  const { isPhone } = useDevice();
  const m = memberId ? s.members[memberId] : undefined;
  if (!m) return null;

  const a = attOf(s, today, m.id);
  const state = a?.checkOut ? 'out' : a?.checkIn ? 'in' : 'notIn';
  const arr = todayReading(s, m.id, today, 'arrival');
  const todayText = state === 'out' ? t('lobby.inOut', { a: a?.checkIn?.at, l: a?.checkOut?.at })
    : state === 'in' ? t('lobby.arrivedAt', { t: a?.checkIn?.at })
    : `${t('lobby.notInToday')} · ${t('lobby.usually', { t: m.usualArrival })}`;
  const notes = (kind: 'staff' | 'family') => sortBy(live(s.memberNotes).filter((n) => n.memberId === m.id && n.visibility === kind), (n) => n.on + n.createdAt, -1)[0];
  const sharedNote = notes('family');
  const staffNote = notes('staff');
  const contacts = contactsOfMember(s, m.id).filter((x) => !x.link.review || x.link.review.status === 'approved');
  const flags = memberFlags(t, m, true);
  const primary = state === 'out' ? null : state === 'in' ? { text: t('lobby.checkOut'), run: () => actions.onCheckOut(m.id) } : { text: t('lobby.checkIn'), run: () => actions.onCheckIn(m.id) };

  const primaryBtn = primary ? <button type="button" onClick={primary.run} className={`h-bronze${isPhone ? ' cp-press' : ''}`} style={{ width: '100%', height: isPhone ? 50 : 52, borderRadius: 999, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{primary.text}</button> : undefined;
  const openProfile = () => { onClose(); navigate(`/members/${m.id}`); };
  const sub = `${memberAge(m, today) ?? ''} · ${visitLine(t, s, m, today)}`;
  const todayBody = (
    <>
      <span style={{ fontSize: 16, lineHeight: 1.4 }}>{todayText}</span>
      {arr ? <ReadingBadge t={t} r={arr} /> : null}
    </>
  );
  const undo = state !== 'notIn' ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {state === 'in' ? <Button variant="secondary" size={44} icon="undo" onClick={() => actions.onUndoIn(m.id)}>{t('lobby.undoIn')}</Button> : null}
      {state === 'out' ? <Button variant="secondary" size={44} icon="undo" onClick={() => actions.onUndoOut(m.id)}>{t('lobby.undoOut')}</Button> : null}
    </div>
  ) : null;
  const careBody = flags.length || m.nanny ? (
    <>
      {flags.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{flags.map((f, i) => <FlagChip key={i} f={f} />)}</div> : null}
      {m.nanny ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, lineHeight: '22px' }}><Icon name="supervisor_account" size={20} color="#75624B" />{t('lobby.nannyNote', { name: m.nanny.name, p: pron(m).p })}</span> : null}
    </>
  ) : null;
  const notesBody = (
    <>
      <div style={{ display: 'flex', gap: 8, fontSize: 16, lineHeight: '22px' }}>
        <Icon name="group" size={20} color="#75624B" />
        <span><strong style={{ fontWeight: 600 }}>{t('common.sharedFam')}:</strong> {sharedNote?.text || t('lobby.noNotes')}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 16, lineHeight: '22px' }}>
        <Icon name="lock" size={20} color="#75624B" />
        <span><strong style={{ fontWeight: 600 }}>{t('common.staffOnly')}:</strong> {staffNote?.text || t('lobby.noNotes')}</span>
      </div>
      {m.care.instructions ? (
        <div style={{ display: 'flex', gap: 8, fontSize: 16, lineHeight: '22px' }}>
          <Icon name="health_and_safety" size={20} color="#75624B" />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><strong style={{ fontWeight: 600 }}>{t('lobby.careInstructions')}</strong><StaffOnlyTag /></span>
            <span>{m.care.instructions}</span>
          </span>
        </div>
      ) : null}
    </>
  );
  const person = (key: string, name: string, line: string, phone: string | undefined, first: boolean) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isPhone ? '11px 0' : '10px 0', borderTop: first ? 'none' : '1px solid #F0EAE1' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{name}</span>
        <span style={{ fontSize: FONT_BODY, color: '#6B6259', lineHeight: 1.4 }}>{line}</span>
      </div>
      {phone ? <CallLink t={t} name={name} phone={phone} /> : null}
    </div>
  );
  const people = [
    ...contacts.map(({ link, contact }, i) => person(contact.id, contact.name, `${cap(relText(t, link.relation))}${link.primary ? ' · ' + t('lobby.primaryBilling') : ''} · ${fmtPhone(contact.phone)}`, contact.phone, isPhone && i === 0)),
    ...(m.nanny ? [person('nanny', m.nanny.name, `${t('lobby.nanny')}${m.nanny.phone ? ' · ' + fmtPhone(m.nanny.phone) : ''}`, m.nanny.phone || undefined, isPhone && !contacts.length)] : []),
  ];

  // round 6, phone: a pushed screen ("‹ Arrivals"), a centred header, iOS grouped sections, the check-in / check-out pinned at the bottom
  if (isPhone) {
    return (
      <PhoneScreen open onClose={onClose} label={memberName(m)} back={t('lobby.arrivals')} footer={primaryBtn}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <MemberAvatar m={m} size={80} font={28} />
          <h2 style={{ margin: '2px 0 0', fontSize: 26, lineHeight: 1.15, fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C' }}>{memberName(m)}</h2>
          <span style={{ fontSize: 14, color: '#6B6259', lineHeight: '20px' }}>{sub}</span>
        </div>
        <Group pad={0} gap={0}>
          <button type="button" onClick={openProfile} className="cp-press" style={{ height: 50, padding: '0 10px 0 16px', border: 'none', background: '#FFFFFF', color: '#24201C', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
            <Icon name="person" size={21} color="#75624B" />
            <span style={{ flex: 1 }}>{t('lobby.openProfile')}</span>
            <Icon name="chevron_right" size={22} color="#A89C8E" />
          </button>
        </Group>
        <Group title={t('lobby.todayL')} gap={8}>{todayBody}{undo}</Group>
        {careBody ? <Group title={t('lobby.care')}>{careBody}</Group> : null}
        <Group title={t('lobby.notes')}>{notesBody}</Group>
        {people.length ? <Group title={t('lobby.familyC')} pad="0 16px" gap={0}>{people}</Group> : null}
      </PhoneScreen>
    );
  }
  return (
    <Drawer open onClose={onClose} label={memberName(m)} footer={primaryBtn}>
      <Stack gap={26}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <MemberAvatar m={m} size={80} font={28} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 28, lineHeight: '34px', fontWeight: 400, letterSpacing: '-0.8px', color: '#2B231C' }}>{memberName(m)}</h2>
            <span style={{ fontSize: FONT_BODY, color: '#6B6259', lineHeight: 1.4 }}>{sub}</span>
          </div>
        </div>
        <button type="button" onClick={openProfile} className="h-cream" style={{ alignSelf: 'flex-start', height: 40, padding: '0 18px 0 14px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="person" size={19} weight={300} />
          {t('lobby.openProfile')}
        </button>

        <div style={{ padding: '14px 16px', borderRadius: 12, background: '#F3EEE8', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={label}>{t('lobby.todayL')}</span>
          {todayBody}
        </div>

        {undo}

        {careBody ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={label}>{t('lobby.care')}</span>
            {careBody}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={label}>{t('lobby.notes')}</span>
          {notesBody}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...label, paddingBottom: 6 }}>{t('lobby.familyC')}</span>
          {people}
        </div>
      </Stack>
    </Drawer>
  );
}
