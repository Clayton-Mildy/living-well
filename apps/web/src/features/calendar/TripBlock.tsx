// Round 19 (task 4): a field trip day in the weekly schedule builder is one block in place of that day's sessions:
// "Field trip", the title, "{from}–{to} · no sessions". Management opens the trip in the event editor from it; for everyone else it is read-only.
import type { CSSProperties } from 'react';
import type { CalendarEvent } from '@cp/shared';
import { Icon, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useClub } from '../../store/replica';

export function TripBlock({ event, canEdit, onOpen, style }: { event: CalendarEvent; canEdit: boolean; onOpen?: (id: string) => void; style?: CSSProperties }) {
  const t = useT();
  const { lang } = useFmt();
  const hours = useClub().club.settings;
  const title = lang === 'id' && event.titleId ? event.titleId : event.title;
  const when = `${event.from ?? hours.open}–${event.to ?? hours.close}`;
  const box: CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', borderRadius: 12, border: '1.5px solid #24201C', background: '#FFFFFF', color: '#24201C', padding: 12, display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left', fontFamily: 'Inter', ...style };
  const inner = (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: FONT_SMALL, fontWeight: 600, lineHeight: 1.4 }}><Icon name="directions_bus" size={18} />{t('cal.k_outing')}</span>
      <span style={{ fontSize: FONT_BODY, fontWeight: 600, lineHeight: '19px', overflowWrap: 'anywhere' }}>{title}</span>
      <span style={{ fontSize: FONT_SMALL, color: '#5E5852', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>{when} · {t('cal.tripNoSessions')}</span>
    </>
  );
  const label = `${t('cal.k_outing')}: ${title}, ${when}`;
  return canEdit && onOpen
    ? <button type="button" data-trip-block={event.id} className="cp-press" onClick={() => onOpen(event.id)} style={{ ...box, cursor: 'pointer' }}>{inner}</button>
    : <div data-trip-block={event.id} role="group" aria-label={label} style={box}>{inner}</div>;
}
