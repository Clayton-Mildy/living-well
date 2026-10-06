// Calendar helpers: kind colours (design KIND / DOTS), weekday names in the current language, day status badge, item text.
import type { CSSProperties } from 'react';
import { addDays, staffCall, type ClubState, type Lang } from '@cp/shared';
import { activityName, roomName } from '@cp/shared/rules/activity';
import { eventTitle, type DayInfo, type DayItem, type CalKind } from '@cp/shared/rules/calendar';
import { Icon } from '../../components/ui';
import { fd, type TFn } from '../../lib/i18n';

export const KIND: Record<CalKind, { icon: string; bg: string; fg: string; dot: string }> = {
  closed: { icon: 'event_busy', bg: '#EFECEA', fg: '#6A6967', dot: '#6A6967' },
  holiday: { icon: 'flag', bg: '#F7E4DD', fg: '#AF4B2F', dot: '#AF4B2F' },
  outing: { icon: 'directions_bus', bg: '#E6EFE8', fg: '#3D6B4F', dot: '#3D6B4F' },
  venue: { icon: 'storefront', bg: '#F6ECD6', fg: '#7A5510', dot: '#7A5510' },
  activity: { icon: 'interests', bg: '#F4F0EE', fg: '#75624B', dot: '#8A755B' },
  guest: { icon: 'waving_hand', bg: '#E8E1D8', fg: '#282828', dot: '#75624B' },
};
const STATE = {
  open: { icon: 'storefront', bg: '#E6EFE8', fg: '#3D6B4F' },
  closed: { icon: 'event_busy', bg: '#EFECEA', fg: '#6A6967' },
  holiday: { icon: 'flag', bg: '#F7E4DD', fg: '#AF4B2F' },
  weekend: { icon: 'event_busy', bg: '#EFECEA', fg: '#6A6967' },
} as const;

/** Weekday names from Intl (so Monday is "Mon" / "Sen"): 0 = Sunday … 6 = Saturday. 1 January 2001 was a Monday, used only as a reference week. */
export const weekdayName = (lang: Lang, w: number, style: 'short' | 'long' = 'short') => fd(lang, addDays('2000-12-31', w), { weekday: style });
export const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export function dayState(t: TFn, info: Pick<DayInfo, 'state'>, hours: { open: string; close: string }) {
  const st = STATE[info.state];
  const label = info.state === 'open' ? t('cal.stOpen', { from: hours.open, to: hours.close }) : info.state === 'holiday' ? t('cal.stHoliday') : info.state === 'weekend' ? t('cal.stWeekend') : t('cal.stClosed');
  return { ...st, label };
}
export const StatePill = ({ st }: { st: ReturnType<typeof dayState> }) => (
  <span style={{ height: 30, padding: '0 12px 0 8px', borderRadius: 999, background: st.bg, color: st.fg, fontSize: 'max(13px, var(--cp-small, 0px))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
    <Icon name={st.icon} size={18} fill={1} />
    {st.label}
  </span>
);

export interface ItemText { title: string; sub: string; icon: string; bg: string; fg: string; time: string }
/** What a day item shows: title, subtitle, icon and colours. Families never get a venue client (the title is "Private event"). */
export function itemText(s: Pick<ClubState, 'rooms' | 'staff' | 'activities'>, it: DayItem, t: TFn, lang: Lang, weekend: boolean): ItemText {
  const k = KIND[it.kind];
  const room = it.roomId ? roomName(s.rooms[it.roomId], lang) : '';
  const span = it.time && it.to ? `${it.time}–${it.to}` : it.time || '';
  let title = it.title;
  let sub = '';
  let icon = k.icon;
  switch (it.kind) {
    case 'closed': title = eventTitle(it, lang); sub = t('cal.k_closed'); break;
    case 'holiday': title = eventTitle(it, lang); sub = t('cal.k_holiday'); break;
    case 'outing': title = eventTitle(it, lang); sub = [t('cal.k_outing'), span].filter(Boolean).join(' · '); break;
    case 'venue':
      title = it.private ? t('cal.private') : it.title;
      sub = [it.private ? t('cal.k_private') : t('cal.k_venue'), it.private ? span : room, it.private ? '' : span, weekend && !it.private ? t('cal.membersNotAffected') : ''].filter(Boolean).join(' · ');
      break;
    case 'guest':
      // a trial has no time (it is a lunch and a health check); a visit keeps its time
      icon = it.guestKind === 'visit' ? 'meeting_room' : 'waving_hand';
      if (it.guestKind === 'visit') sub = [t('cal.k_visit'), it.time || ''].filter(Boolean).join(' · ');
      else { title = `${t('cal.k_trial')}: ${it.title}`; sub = t('cal.trialSub'); }
      break;
    case 'activity': {
      const a = s.activities[it.activityId || ''];
      title = activityName({ name: it.title, nameId: it.titleId }, lang);
      icon = a?.icon || k.icon;
      sub = [room, it.staffId ? staffCall(s.staff[it.staffId]) : ''].filter(Boolean).join(' · ');
      break;
    }
  }
  return { title, sub, icon, bg: k.bg, fg: k.fg, time: it.time ?? (it.kind === 'guest' ? '' : t('cal.allDay')) };
}

export const smallCaps: CSSProperties = { fontSize: 'max(13px, var(--cp-small, 0px))', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' };
