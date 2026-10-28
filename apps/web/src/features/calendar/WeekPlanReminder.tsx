// KC round 15: each week has its own activity programme and menu. While this week or next week has none, the planners' Today says so, with a button
// into that week (management sees both, the activity team the programme, the kitchen the menu). Gone as soon as the week is published or sent.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ISODate } from '@cp/shared';
import { unplannedWeeks } from '@cp/shared/rules/weekPlans';
import { Button, Note } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';

/** `onMenu`: open the menu of that week in place (the kitchen's page already holds the plan); otherwise the button goes to /menu?week=. */
export function WeekPlanReminder({ what, onMenu }: { what: 'programme' | 'menu' | 'both'; onMenu?: (monday: ISODate) => void }) {
  const t = useT();
  const { fd } = useFmt();
  const s = useClub();
  const { today } = useNow();
  const navigate = useNavigate();
  const weeks = useMemo(() => unplannedWeeks(s, today)
    .map((w) => ({ ...w, programme: w.programme && what !== 'menu', menu: w.menu && what !== 'programme' }))
    .filter((w) => w.programme || w.menu), [s, today, what]);
  if (!weeks.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {weeks.map((w) => {
        const week = w.monday <= today ? t('cal.remind.thisWeek') : t('cal.remind.nextWeek', { date: fd(w.monday, { day: 'numeric', month: 'short' }) });
        return (
          <Note key={w.monday} tone="ochre" icon="event_note">
            <span data-testid="week-plan-reminder" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
              <span>{t(w.programme && w.menu ? 'cal.remind.both' : w.programme ? 'cal.remind.programme' : 'cal.remind.menu', { week })}</span>
              <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {w.programme ? <Button variant="secondary" size={44} icon="calendar_month" onClick={() => navigate(`/calendar?week=${w.monday}`)}>{t('cal.remind.planProgramme')}</Button> : null}
                {w.menu ? <Button variant="secondary" size={44} icon="restaurant_menu" onClick={() => (onMenu ? onMenu(w.monday) : navigate(`/menu?week=${w.monday}`))}>{t('cal.remind.planMenu')}</Button> : null}
              </span>
            </span>
          </Note>
        );
      })}
    </div>
  );
}
