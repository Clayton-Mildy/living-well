// A day card (design dayBlock): date, TODAY tag, open/closed badge and the day's items. Management gets an Edit button on each calendar event;
// whoever builds the schedule (management) gets "Edit activity" on each activity, which offers "Just this day" or the weekly plan.
// On a phone (round 6) it is an iOS grouped day: the date is the group header (Today chip and open/closed state beside it) and the items are rows in one flat group.
// Round 7: a session changed for this day only shows "Changed" (and the day's note) for staff; a slot with no session shows a quiet row management can fill.
import { Fragment } from 'react';
import type { ClubState, Slot } from '@cp/shared';
import type { DayInfo, DayItem } from '@cp/shared/rules/calendar';
import { Button, GROUP_HEAD, Icon, IconButton } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { rowLine } from '../activity/lib';
import { StatePill, dayState, itemText } from './lib';

export function DayBlock({ s, info, today, canEdit, onEdit, onEditActivity }: { s: ClubState; info: DayInfo; today: string; canEdit?: boolean; onEdit?: (eventId: string) => void; onEditActivity?: (slot: Slot, date: string) => void }) {
  const t = useT();
  const { lang, fdl } = useFmt();
  const { isPhone } = useDevice();
  const st = dayState(t, info, { open: s.club.settings.open, close: s.club.settings.close });
  const todayTag = (h: number) => <span style={{ height: h, padding: '0 7px', borderRadius: 7, background: '#2B231C', color: '#FFFFFF', fontSize: 11, fontWeight: 700, letterSpacing: '1px', display: 'inline-flex', alignItems: 'center', textTransform: 'uppercase', flex: 'none' }}>{t('common.today')}</span>;
  // round 6, phone: a small 34px pill for a row's edit action
  const editPill = (label: string, run: () => void, icon = 'edit') => (
    <button type="button" className="cp-press" onClick={run} aria-label={label} title={label} style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: '#F3EEE8', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
      <Icon name={icon} size={19} />
    </button>
  );
  const canDay = !!onEditActivity && info.date >= today;
  // round 7: slots with no session. A day change removed it (everyone on staff sees that) or the weekly plan has none (only who can fill it)
  const empties: DayItem[] = info.noSession.filter((n) => n.changed || canDay).map((n) => ({ key: 'n:' + n.slot, kind: 'activity', time: n.slot, title: '', empty: true, changed: n.changed }));
  const rows = [...info.items, ...empties].sort((a, b) => (a.time ?? '00:00').localeCompare(b.time ?? '00:00') || (a.empty ? 1 : 0) - (b.empty ? 1 : 0));
  const changedLine = (line: string | undefined, size: number) => (line ? <span style={{ fontSize: size, lineHeight: 1.4, fontWeight: 600, color: '#7A5510' }}>{line}</span> : null);
  const slotOf = (it: DayItem) => (it.time || '10:30') as Slot;

  if (isPhone) {
    return (
      <div data-date={info.date} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 16px', minHeight: 22 }}>
          <h2 style={{ ...GROUP_HEAD, display: 'flex', alignItems: 'center', gap: 8, overflow: 'visible', flex: '1 1 0' }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fdl(info.date)}</span>
            {info.date === today ? todayTag(18) : null}
          </h2>
          <StatePill st={st} size={13} />
        </div>
        {rows.length ? (
          <div style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }}>
            {rows.map((it, i) => {
              const x = itemText(s, it, t, lang, info.weekend);
              const editable = !!canEdit && !!it.eventId && !!onEdit;
              const activityEdit = canDay && it.kind === 'activity';
              return (
                <Fragment key={it.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 8px 16px', minHeight: 54, ...rowLine(i === 0, 72) }}>
                    <span style={{ width: 46, flex: 'none', fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3, color: '#4A4038' }}>{x.time}</span>
                    <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 9, background: x.bg, color: x.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={x.icon} size={18} /></span>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, color: it.empty ? '#6B6259' : undefined }}>{x.title}</span>
                      {x.sub ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{x.sub}</span> : null}
                      {changedLine(x.changedLine, 13)}
                    </div>
                    {editable && info.date >= today ? editPill(t('cal.editEvent', { title: x.title }), () => onEdit!(it.eventId!)) : null}
                    {activityEdit ? (it.empty ? editPill(t('cal.addSessionAria', { slot: slotOf(it) }), () => onEditActivity!(slotOf(it), info.date), 'add') : editPill(t('cal.editActivityAria', { title: x.title }), () => onEditActivity!(slotOf(it), info.date))) : null}
                  </div>
                </Fragment>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div data-date={info.date} style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '14px 22px', background: '#FBFAF8', borderBottom: '1px solid #F0EAE1' }}>
        <span style={{ fontSize: 17, fontWeight: 600, flex: '1 1 0', minWidth: 160, lineHeight: 1.4 }}>{fdl(info.date)}</span>
        {info.date === today ? <span style={{ height: 22, padding: '0 8px', borderRadius: 8, background: '#2B231C', color: '#FFFFFF', fontSize: 11, fontWeight: 700, letterSpacing: '1px', display: 'inline-flex', alignItems: 'center', textTransform: 'uppercase' }}>{t('common.today')}</span> : null}
        <StatePill st={st} />
      </div>
      {rows.map((it) => {
        const x = itemText(s, it, t, lang, info.weekend);
        const editable = !!canEdit && !!it.eventId && !!onEdit;
        const activityEdit = canDay && it.kind === 'activity';
        return (
          <Fragment key={it.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px', borderTop: '1px solid #F0EAE1', minHeight: 64, flexWrap: activityEdit ? 'wrap' : 'nowrap' }}>
              <span style={{ width: 60, flex: 'none', fontSize: 'max(14px, var(--cp-body, 0px))', fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{x.time}</span>
              <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: x.bg, color: x.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={x.icon} size={20} /></span>
              <div style={{ flex: activityEdit ? '1 1 140px' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4, color: it.empty ? '#6B6259' : undefined }}>{x.title}</span>
                {x.sub ? <span style={{ fontSize: 'max(14px, var(--cp-body, 0px))', lineHeight: '20px', color: '#6B6259' }}>{x.sub}</span> : null}
                {changedLine(x.changedLine, 14)}
              </div>
              {editable && info.date >= today ? <IconButton icon="edit" label={t('cal.editEvent', { title: x.title })} onClick={() => onEdit!(it.eventId!)} /> : null}
              {activityEdit ? (
                <span style={{ marginLeft: 'auto' }}>
                  {it.empty
                    ? <Button variant="secondary" size={44} icon="add" label={t('cal.addSessionAria', { slot: slotOf(it) })} onClick={() => onEditActivity!(slotOf(it), info.date)}>{t('cal.addSession')}</Button>
                    : <Button variant="secondary" size={44} icon="edit" label={t('cal.editActivityAria', { title: x.title })} onClick={() => onEditActivity!(slotOf(it), info.date)}>{t('cal.editActivity')}</Button>}
                </span>
              ) : null}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
