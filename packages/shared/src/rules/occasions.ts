// Occasions (round 12): the birthdays and membership anniversaries that fall in a stretch of days, for the Arrivals rail, the member row,
// the kitchen menu, the calendar, the family's Today card and the profile hero. Pure selectors over ClubState.
import type { ClubState, ISODate, Member } from '../types';
import { addDays, live, sortBy } from '../util';
import { activeOn } from './core';

export interface Occasion { member: Member; kind: 'birthday' | 'anniversary'; date: ISODate; years: number }

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** The month-day of `iso` in year `y`; 29 February falls on the 28th in a year without one. */
function inYear(y: number, iso: ISODate): ISODate {
  const md = iso.slice(5);
  return `${y}-${md === '02-29' && !isLeap(y) ? '02-28' : md}`;
}

/** Birthdays (from the date of birth) and anniversaries (from the first membership start, one year and more) of active members on `from` … `to`, year-agnostic on month and day. Earliest first, then by name. */
export function occasionsInRange(s: ClubState, from: ISODate, to: ISODate): Occasion[] {
  if (to < from) return [];
  const y0 = +from.slice(0, 4), y1 = +to.slice(0, 4);
  const out: Occasion[] = [];
  for (const m of live(s.members)) {
    const mark = (kind: Occasion['kind'], iso: ISODate | null | undefined) => {
      if (!iso) return;
      const born = +iso.slice(0, 4);
      for (let y = y0; y <= y1; y++) {
        const date = inYear(y, iso);
        const years = y - born;
        if (date < from || date > to || years < (kind === 'anniversary' ? 1 : 0) || !activeOn(m, date)) continue;
        out.push({ member: m, kind, date, years });
      }
    };
    mark('birthday', m.dob);
    mark('anniversary', m.memberships[0]?.start);
  }
  const name = (m: Member) => m.firstName + ' ' + m.lastName;
  return sortBy(out, (o) => o.date + (o.kind === 'birthday' ? '0' : '1') + name(o.member));
}

/** Today and the seven days after it. */
export const occasionsThisWeek = (s: ClubState, today: ISODate) => occasionsInRange(s, today, addDays(today, 7));
