// One member row (design ScrLobby list row), used by the manual check-in list and the "In the club" / "Gone home" lists.
// Not checked in: "Est 10:05" (their usual arrival) + Check in; no food tags here (the kitchen has them). In the club: arrival time, reading badge + Check out. Gone home: arrived and left.
import { memberName, todayReading, type BoardRow } from '@cp/shared';
import { FONT_BODY, StatusBadge } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { FlagChip, MemberAvatar, memberFlags } from './parts';

export function MemberRow({ r, selected, onOpen, onCheckIn, onCheckOut }: { r: BoardRow; selected?: boolean; onOpen: () => void; onCheckIn: () => void; onCheckOut: () => void }) {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const { today } = useNow();
  const { m, a } = r;
  const arr = todayReading(s, m.id, today, 'arrival');
  const state = a?.checkOut ? 'out' : a?.checkIn ? 'in' : 'notIn';
  const sub = state === 'out' ? t('lobby.inOut', { a: a?.checkIn?.at, l: a?.checkOut?.at })
    : state === 'in' ? t('lobby.arrivedAt', { t: a?.checkIn?.at })
    : m.usualArrival ? t('lobby.est', { t: m.usualArrival }) : '';
  const action = state === 'in' ? { text: t('lobby.checkOut'), run: onCheckOut } : state === 'notIn' ? { text: t('lobby.checkIn'), run: onCheckIn } : null;
  const flags = memberFlags(t, m, false, false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isPhone ? '6px 10px' : '10px 14px', padding: isPhone ? '8px 14px' : '12px 20px 12px 24px', borderTop: '1px solid #EFECEA', minHeight: isPhone ? 64 : 84, background: selected ? '#FBF8F4' : '#FFFFFF' }}>
      <button type="button" onClick={onOpen} style={{ flex: isPhone && state === 'notIn' ? '1 1 0' : '1 1 220px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
        <MemberAvatar m={m} size={isPhone ? 42 : 52} font={isPhone ? 15 : 18} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: isPhone ? 2 : 4 }}>
          <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: 1.4 }}>{memberName(m)}</span>
          {sub ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{sub}</span> : null}
          {flags.length ? <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{flags.map((f, i) => <FlagChip key={i} f={f} size="row" />)}</span> : null}
        </div>
      </button>
      {arr ? <StatusBadge kind={arr.status} /> : state === 'in' ? <StatusBadge kind="pending" /> : null}
      {action ? <button type="button" className="dh18" onClick={action.run} aria-label={`${action.text}: ${memberName(m)}`} style={{ height: isPhone ? 40 : 44, padding: '0 18px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none', fontFamily: 'Inter' }}>{action.text}</button> : null}
    </div>
  );
}
