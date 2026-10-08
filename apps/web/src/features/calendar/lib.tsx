// Calendar helpers: kind colours (design KIND / DOTS), weekday names in the current language, day status badge, item text.
import type { CSSProperties } from 'react';
import { addDays, staffCall, type ClubState, type Lang } from '@cp/shared';
import { activityName, roomName } from '@cp/shared/rules/activity';
import { eventTitle, type DayInfo, type DayItem, type CalKind } from '@cp/shared/rules/calendar';
import { fd, type TFn } from '../../lib/i18n';

export const KIND: Record<CalKind, { icon: string; bg: string; fg: string; dot: string }> = {
  closed: { icon: 'event_busy', bg: '#F0EAE1', fg: '#5E5852', dot: '#5E5852' },
  holiday: { icon: 'flag', bg: '#F9E3DB', fg: '#9A3D24', dot: '#9A3D24' },
  outing: { icon: 'directions_bus', bg: '#E3EFE6', fg: '#3D6B4F', dot: '#3D6B4F' },
  venue: { icon: 'storefront', bg: '#F6ECD6', fg: '#7A5510', dot: '#7A5510' },
  activity: { icon: 'interests', bg: '#F3EEE8', fg: '#75624B', dot: '#8A755B' },
  guest: { icon: 'waving_hand', bg: '#E8E1D8', fg: '#24201C', dot: '#75624B' },
};
const STATE = {
  open: { icon: 'storefront', bg: '#E3EFE6', fg: '#2F5A40' },
  closed: { icon: 'event_busy', bg: '#F0EAE1', fg: '#6B6259' },
  holiday: { icon: 'flag', bg: '#F9E3DB', fg: '#9A3D24' },
  weekend: { icon: 'event_busy', bg: '#F0EAE1', fg: '#6B6259' },
} as const;

/** Weekday names from Intl (so Monday is "Mon" / "Sen"): 0 = Sunday … 6 = Saturday. 1 January 2001 was a Monday, used only as a reference week. */
export const weekdayName = (lang: Lang, w: number, style: 'short' | 'long' = 'short') => fd(lang, addDays('2000-12-31', w), { weekday: style });
export const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export function dayState(t: TFn, info: Pick<DayInfo, 'state'>, hours: { open: string; close: string }) {
  const st = STATE[info.state];
  const label = info.state === 'open' ? t('cal.stOpen', { from: hours.open, to: hours.close }) : info.state === 'holiday' ? t('cal.stHoliday') : info.state === 'weekend' ? t('cal.stWeekend') : t('cal.stClosed');
  return { ...st, label };
}
export const StatePill = ({ st, size = 14 }: { st: ReturnType<typeof dayState>; size?: number }) => (
  <span style={{ color: st.fg, fontSize: size, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
    <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: st.fg, flex: 'none' }} />
    {st.label}
  </span>
);

export interface ItemText { title: string; sub: string; icon: string; bg: string; fg: string; time: string; /** KC round 7, staff: "Changed · note" under a session that differs from the weekly plan */ changedLine?: string }
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
      if (it.empty) { title = t('cal.noSession'); icon = 'event_busy'; break; }
      const a = s.activities[it.activityId || ''];
      title = activityName({ name: it.title, nameId: it.titleId }, lang);
      icon = a?.icon || k.icon;
      // KC round 7: a guest host leads the session ("with Bu Ratna · guest") instead of the teacher
      sub = [room, it.guest ? t('guests.withGuest', { name: it.guest.name }) : it.staffId ? staffCall(s.staff[it.staffId]) : ''].filter(Boolean).join(' · ');
      break;
    }
  }
  const changedLine = it.changed ? (it.note ? t('cal.changedNote', { note: it.note }) : t('cal.changed')) : undefined;
  return { title, sub, icon, bg: k.bg, fg: k.fg, time: it.time ?? (it.kind === 'guest' ? '' : t('cal.allDay')), ...(changedLine ? { changedLine } : {}) };
}

export const smallCaps: CSSProperties = { fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px', color: '#6E5A43' };
