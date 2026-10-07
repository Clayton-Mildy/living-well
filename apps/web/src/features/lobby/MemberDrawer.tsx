// Member drawer (design OvDrawer): who they are, today's status (usual arrival time, arrived / left), care flags, notes,
// family and nanny with real tel: links, and the actions: check in / check out, undo.
import { useNavigate } from 'react-router-dom';
import { contactsOfMember, fmtPhone, live, memberAge, memberName, pron, sortBy, todayReading, attOf, type ClubState, type Member } from '@cp/shared';
import { visitInfo } from '@cp/shared/rules/lobby';
import { Button, Drawer, FONT_BODY, Icon, StaffOnlyTag } from '../../components/ui';
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

  return (
    <Drawer open onClose={onClose} label={memberName(m)}
      footer={primary ? <button type="button" onClick={primary.run} className="h-bronze" style={{ width: '100%', height: 52, borderRadius: 999, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{primary.text}</button> : undefined}>
      <Stack gap={26}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <MemberAvatar m={m} size={80} font={28} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 28, lineHeight: '34px', fontWeight: 400, letterSpacing: '-0.8px', color: '#2B231C' }}>{memberName(m)}</h2>
            <span style={{ fontSize: FONT_BODY, color: '#6B6259', lineHeight: 1.4 }}>{`${memberAge(m, today) ?? ''} · ${visitLine(t, s, m, today)}`}</span>
          </div>
        </div>
        <button type="button" onClick={() => { onClose(); navigate(`/members/${m.id}`); }} className="h-cream" style={{ alignSelf: 'flex-start', height: 40, padding: '0 18px 0 14px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="person" size={19} weight={300} />
          {t('lobby.openProfile')}
        </button>

        <div style={{ padding: '14px 16px', borderRadius: 12, background: '#F3EEE8', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={label}>{t('lobby.todayL')}</span>
          <span style={{ fontSize: 16, lineHeight: 1.4 }}>{todayText}</span>
          {arr ? <ReadingBadge t={t} r={arr} /> : null}
        </div>

        {state !== 'notIn' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {state === 'in' ? <Button variant="secondary" size={44} icon="undo" onClick={() => actions.onUndoIn(m.id)}>{t('lobby.undoIn')}</Button> : null}
            {state === 'out' ? <Button variant="secondary" size={44} icon="undo" onClick={() => actions.onUndoOut(m.id)}>{t('lobby.undoOut')}</Button> : null}
          </div>
        ) : null}

        {flags.length || m.nanny ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={label}>{t('lobby.care')}</span>
            {flags.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{flags.map((f, i) => <FlagChip key={i} f={f} />)}</div> : null}
            {m.nanny ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, lineHeight: '22px' }}><Icon name="supervisor_account" size={20} color="#75624B" />{t('lobby.nannyNote', { name: m.nanny.name, p: pron(m).p })}</span> : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={label}>{t('lobby.notes')}</span>
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
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...label, paddingBottom: 6 }}>{t('lobby.familyC')}</span>
          {contacts.map(({ link, contact }) => (
            <div key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #F0EAE1' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{contact.name}</span>
                <span style={{ fontSize: FONT_BODY, color: '#6B6259', lineHeight: 1.4 }}>{`${cap(relText(t, link.relation))}${link.primary ? ' · ' + t('lobby.primaryBilling') : ''} · ${fmtPhone(contact.phone)}`}</span>
              </div>
              <CallLink t={t} name={contact.name} phone={contact.phone} />
            </div>
          ))}
          {m.nanny ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #F0EAE1' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{m.nanny.name}</span>
                <span style={{ fontSize: FONT_BODY, color: '#6B6259', lineHeight: 1.4 }}>{`${t('lobby.nanny')}${m.nanny.phone ? ' · ' + fmtPhone(m.nanny.phone) : ''}`}</span>
              </div>
              {m.nanny.phone ? <CallLink t={t} name={m.nanny.name} phone={m.nanny.phone} /> : null}
            </div>
          ) : null}
        </div>
      </Stack>
    </Drawer>
  );
}
