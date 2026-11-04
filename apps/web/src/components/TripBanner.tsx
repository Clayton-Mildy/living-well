// Round 20: the field trip banner at the top of the staff screens on a trip day (Arrivals, the nurse's health station, the kitchen's menu).
// A white card with an ink 1.5 px border, a bus icon, "Field trip today" (or the screen's own title), "{title} · {from}–{to}" and "{n} going"
// (the trip's Who went). Nothing on other days.
import { tripOn, type ISODate } from '@cp/shared';
import { Icon } from './ui';
import { useLang, useT } from '../lib/i18n';
import { useClub } from '../store/replica';

export function TripBanner({ date, title }: { date: ISODate; /** the kitchen's "Field trip · menu optional"; default "Field trip today" */ title?: string }) {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  const trip = tripOn(s, date);
  if (!trip) return null;
  const name = lang === 'id' && trip.titleId ? trip.titleId : trip.title;
  const when = trip.from && trip.to ? t('lobby.tripWhen', { title: name, from: trip.from, to: trip.to }) : name;
  const heading = title ?? t('lobby.tripToday');
  return (
    <section data-testid="trip-banner" aria-label={heading}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, border: '1.5px solid #24201C', background: '#FFFFFF', color: '#24201C', minWidth: 0 }}>
      <Icon name="directions_bus" size={22} color="#24201C" />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{heading}</span>
        <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{when}</span>
      </span>
      <span data-testid="trip-going" style={{ flex: 'none', fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{t('lobby.tripGoing', { n: trip.wentIds?.length ?? 0 })}</span>
    </section>
  );
}
