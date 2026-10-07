// A day card (design dayBlock): date, TODAY tag, open/closed badge and the day's items. Management gets an Edit button on each calendar event;
// whoever builds the schedule (activity teachers and management) gets "Edit activity" on each activity.
import { Fragment } from 'react';
import type { ClubState } from '@cp/shared';
import type { DayInfo, DayItem } from '@cp/shared/rules/calendar';
import { Button, Icon, IconButton } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { StatePill, dayState, itemText } from './lib';

export function DayBlock({ s, info, today, canEdit, onEdit, onEditActivity }: { s: ClubState; info: DayInfo; today: string; canEdit?: boolean; onEdit?: (eventId: string) => void; onEditActivity?: (it: DayItem, date: string) => void }) {
  const t = useT();
  const { lang, fdl } = useFmt();
  const { isPhone } = useDevice();
  const st = dayState(t, info, { open: s.club.settings.open, close: s.club.settings.close });
  return (
    <div data-date={info.date} style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 8 : 10, flexWrap: 'wrap', padding: isPhone ? '12px 16px' : '14px 22px', background: '#FBFAF8', borderBottom: '1px solid #F0EAE1' }}>
        <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 600, flex: isPhone ? '1 1 auto' : '1 1 0', minWidth: isPhone ? 0 : 160, lineHeight: 1.4 }}>{fdl(info.date)}</span>
        {info.date === today ? <span style={{ height: 22, padding: '0 8px', borderRadius: 8, background: '#2B231C', color: '#FFFFFF', fontSize: 11, fontWeight: 700, letterSpacing: '1px', display: 'inline-flex', alignItems: 'center', textTransform: 'uppercase' }}>{t('common.today')}</span> : null}
        <StatePill st={st} />
      </div>
      {info.items.map((it) => {
        const x = itemText(s, it, t, lang, info.weekend);
        const editable = !!canEdit && !!it.eventId && !!onEdit;
        const activityEdit = !!onEditActivity && it.kind === 'activity' && info.date >= today;
        return (
          <Fragment key={it.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 10 : 14, padding: isPhone ? '8px 10px 8px 16px' : '12px 22px', borderTop: '1px solid #F0EAE1', minHeight: isPhone ? 56 : 64, flexWrap: activityEdit && !isPhone ? 'wrap' : 'nowrap' }}>
              <span style={{ width: isPhone ? 50 : 60, flex: 'none', fontSize: 'max(14px, var(--cp-body, 0px))', fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{x.time}</span>
              <span aria-hidden="true" style={{ width: isPhone ? 36 : 40, height: isPhone ? 36 : 40, borderRadius: 999, background: x.bg, color: x.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={x.icon} size={isPhone ? 18 : 20} /></span>
              <div style={{ flex: activityEdit && !isPhone ? '1 1 140px' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{x.title}</span>
                <span style={{ fontSize: 'max(14px, var(--cp-body, 0px))', lineHeight: '20px', color: '#6B6259' }}>{x.sub}</span>
              </div>
              {editable && info.date >= today ? <IconButton icon="edit" label={t('cal.editEvent', { title: x.title })} onClick={() => onEdit!(it.eventId!)} /> : null}
              {activityEdit ? (isPhone
                ? <IconButton icon="edit" label={t('cal.editActivityAria', { title: x.title })} onClick={() => onEditActivity!(it, info.date)} />
                : <span style={{ marginLeft: 'auto' }}><Button variant="secondary" size={44} icon="edit" label={t('cal.editActivityAria', { title: x.title })} onClick={() => onEditActivity!(it, info.date)}>{t('cal.editActivity')}</Button></span>) : null}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
