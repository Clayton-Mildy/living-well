// One member row (Prototype v3 quiet row), used by the check-in list, the "In the club" list and "Gone home".
// A 46px avatar, the name, one sub line and ONE pill button. The sub line carries the time ("Est 10:05" / "Arrived 09:48" / "Arrived 09:40 · left 11:30"),
// the departure-check status as a dot item (in the club) and, only when there is one, the member's allergy as a rust dot item.
// Every other tag (walking stick, diet, diabetes, lunch medicines…) lives in the member drawer, one tap away.
import { memberName, onLeaveOn, suspensionOf, todayReading, type BoardRow } from '@cp/shared';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { DotItem, MemberAvatar, allergyLine } from './parts';

/** Dot colour of the arrival reading: normal sage, alert rust, watch / not taken yet ochre. */
const ST_FG: Record<string, string> = { normal: '#3F7A55', alert: '#9A3D24' };

export function MemberRow({ r, first, selected, onOpen, onCheckIn, onCheckOut, onUndoOut }: {
  r: BoardRow; first?: boolean; selected?: boolean; onOpen: () => void; onCheckIn: () => void; onCheckOut: () => void; onUndoOut?: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const { isPhone } = useDevice();
  const s = useClub();
  const { today } = useNow();
  const { m, a } = r;
  const arr = todayReading(s, m.id, today, 'arrival');
  const state = a?.checkOut ? 'out' : a?.checkIn ? 'in' : 'notIn';
  const sub = state === 'out' ? t('lobby.inOut', { a: a?.checkIn?.at, l: a?.checkOut?.at })
    : state === 'in' ? t('lobby.arrivedAt', { t: a?.checkIn?.at })
    : m.usualArrival ? t('lobby.est', { t: m.usualArrival }) : '';
  // the arrival reading, or "check pending" while nobody has taken it yet
  const kind = state === 'in' ? (arr ? arr.status : 'pending') : null;
  const stFg = kind ? ST_FG[kind] ?? '#8A6216' : '';
  const allergy = allergyLine(t, m);
  // KC round 6 (the brochure's terms): an unpaid invoice past the 1st puts the membership on hold; a month of leave is not a visiting month. Either way the check-in is refused with the reason.
  const hold = suspensionOf(s, m.id, today);
  const onLeave = state === 'notIn' && onLeaveOn(m, today);
  const name = memberName(m);
  const action = state === 'in' ? { text: t('lobby.checkOut'), run: onCheckOut, primary: false }
    : state === 'notIn' ? { text: t('lobby.checkIn'), run: onCheckIn, primary: true }
    : onUndoOut ? { text: t('common.undo'), run: onUndoOut, primary: false, label: `${t('lobby.undoOut')}: ${name}` } : null;
  const pad = 'var(--hp, 24px)';
  // round 6, phone: an iOS grouped row, its own 16px inset, a hairline that starts at the name (not under the avatar), a tint while pressed
  const rowStyle: React.CSSProperties = isPhone
    ? { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', backgroundColor: selected ? '#FBF8F4' : '#FFFFFF', boxShadow: selected ? 'inset 3px 0 0 #2B231C' : undefined,
      backgroundImage: first || selected ? 'none' : 'linear-gradient(#EFEAE3, #EFEAE3)', backgroundSize: 'calc(100% - 70px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat', transition: 'background-color .15s' }
    : { display: 'flex', alignItems: 'center', gap: 16, padding: '18px 0', borderTop: '1px solid #F0EAE1',
      ...(selected ? { background: '#FBF8F4', boxShadow: 'inset 3px 0 0 #2B231C', margin: `0 calc(${pad} * -1)`, padding: `18px ${pad}`, borderTopColor: 'transparent' } : {}) };
  return (
    <div className={isPhone ? 'cp-tap' : undefined} style={rowStyle}>
      <button type="button" onClick={onOpen} className={isPhone ? 'cp-tap-target' : undefined} style={{ flex: '1 1 0', minWidth: 0, minHeight: 46, display: 'flex', alignItems: 'center', gap: isPhone ? 12 : 16, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
        <MemberAvatar m={m} size={isPhone ? 42 : 46} font={15} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: 1.3 }}>{name}</span>
          <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: '2px 10px', flexWrap: 'wrap' }}>
            {sub ? <span>{sub}</span> : null}
            {kind ? <DotItem color={stFg}>{t('status.' + kind)}</DotItem> : null}
            {hold ? <DotItem color="#9A3D24">{t('status.suspended')}</DotItem> : null}
            {onLeave ? <DotItem color="#8A6216">{t('status.onLeave', { month: fmt.fd(`${today.slice(0, 7)}-01`, { month: 'short' }) })}</DotItem> : null}
            {allergy ? <DotItem color="#A2452B">{allergy}</DotItem> : null}
          </span>
        </span>
      </button>
      {action ? (
        <button type="button" className={`${action.primary ? 'h-bronze' : 'h-cream'}${isPhone ? ' cp-press' : ''}`} onClick={action.run} aria-label={'label' in action ? action.label : `${action.text}: ${name}`}
          style={{ height: isPhone ? 34 : 40, padding: isPhone ? '0 14px' : '0 18px', borderRadius: 999, border: `1px solid ${action.primary ? '#24201C' : '#DCD3C8'}`, background: action.primary ? '#24201C' : '#FFFFFF', color: action.primary ? '#FFFFFF' : '#24201C', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none', fontFamily: 'Inter' }}>{action.text}</button>
      ) : null}
    </div>
  );
}
