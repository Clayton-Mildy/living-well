// View models for the kitchen screens: everything is derived from the club state and the demo clock.
import { useMemo } from 'react';
import { dayStatus, lobbyGroups, live, lunchPhotosOn, nextOpenDay, type DayStatus, type Feedback, type ISODate, type StockRequest } from '@cp/shared';
import {
  coversOn, dietaryRows, dishesByCourse, kitchenConflicts, menuDishesOn, overridesFrom, scheduledVersions, sortFeedback, sortStock, templateForWeek, templateOn, unknownAllergyGuests, unreviewedDishesOn,
} from '@cp/shared/rules/kitchenOps';
import { useClub } from '../../store/replica';
import { useNow } from '../../lib/clock';

/** Today's menu screen: covers, menu, lunch photos, dietary needs, allergy conflicts. Closed days give `closed` and no menu. */
export function useMenuVals() {
  const s = useClub();
  const { today } = useNow();
  return useMemo(() => {
    const st: DayStatus = dayStatus(s, today);
    const menu = menuDishesOn(s, today);
    const row = s.dayMenus[today];
    return {
      today,
      closed: !st.open,
      closedReason: st.open ? null : st.reason,
      closedTitle: st.open ? undefined : st.event?.title,
      nextOpen: nextOpenDay(s, today),
      menu,
      covers: coversOn(s, today),
      // members who have checked in so far: still in the club, and already gone home
      members: (() => { const g = lobbyGroups(s, today); return { inClub: g.inClub.length, gone: g.goneHome.length }; })(),
      photos: lunchPhotosOn(s, today), // pending, shown and hidden ones, oldest first
      diet: dietaryRows(s, today),
      conflicts: kitchenConflicts(s, today),
      unknownGuests: unknownAllergyGuests(s, today),
      unreviewed: unreviewedDishesOn(s, today),
      overridden: !!(row && (row.lunch || row.soft || row.tea)),
    };
  }, [s, today]);
}

/** The weekly menu of the week starting `week` (the editor's starting point), later versions and upcoming per-date overrides. */
export function usePlanVals(week: ISODate) {
  const s = useClub();
  const { today } = useNow();
  return useMemo(() => {
    const { version } = templateOn(s, today);
    return {
      today,
      week,
      version,
      days: templateForWeek(s, week, today),
      scheduled: scheduledVersions(s, today),
      overrides: overridesFrom(s, today),
      dishes: { lunch: dishesByCourse(s, 'lunch'), soft: dishesByCourse(s, 'soft'), tea: dishesByCourse(s, 'tea') },
    };
  }, [s, today, week]);
}

export function useFeedbackList(): Feedback[] {
  const s = useClub();
  return useMemo(() => sortFeedback(live(s.feedback)), [s.feedback]);
}

export function useStockList(): StockRequest[] {
  const s = useClub();
  return useMemo(() => sortStock(live(s.stockRequests)), [s.stockRequests]);
}
