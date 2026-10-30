// Round 16 (KC): the notice period. A downgrade, a stop or a leave for a month has to be asked `noticeDays` (a club setting, default 14) before that
// month's 1st (December → 17 November); asked later, it can start the month after at the earliest. An upgrade needs no notice: only to be asked before the 1st.
// Management ending a membership for a reason (members.end) is not a family's request and is not held to it.
import type { ClubState, ISODate, Member, Plan, YM } from '../types';
import { addDays, addMonths, monthStart, ym } from '../util';
import { planOn } from './core';
import { priceOn } from './billing';
import { planPrice } from './plans';

export const NOTICE_DAYS_DEFAULT = 14;
export const noticeDays = (s: Pick<ClubState, 'club'>): number => s.club.settings.noticeDays ?? NOTICE_DAYS_DEFAULT;
/** The last day a change starting in `month` can be asked for. */
export const noticeDeadline = (s: Pick<ClubState, 'club'>, month: YM): ISODate => addDays(monthStart(month), -noticeDays(s));

export type NoticeKind = 'upgrade' | 'downgrade' | 'stop' | 'leave';
export type NoticeCheck = { ok: true } | { ok: false; code: 'err.noticeLate'; params: { deadline: ISODate; month: YM; earliest: YM; days: number } };

/**
 * A move to `to` for `month`, against the plan in force the day before (what the family pays now): dearer is an upgrade; cheaper or the same price is a
 * downgrade (notice applies). Moving back to that plan takes back a change scheduled for the month, which needs no notice.
 */
export function changeKind(s: ClubState, m: Member, to: Plan, month: YM): 'upgrade' | 'downgrade' {
  const first = monthStart(month);
  const before = planOn(m, addDays(first, -1)).plan;
  if (to === before) return 'upgrade';
  const price = priceOn(s, first);
  return planPrice(price, to) > planPrice(price, before) ? 'upgrade' : 'downgrade';
}

const inTime = (s: ClubState, kind: NoticeKind, month: YM, today: ISODate) =>
  month > ym(today) && (kind === 'upgrade' ? today < monthStart(month) : today <= noticeDeadline(s, month));

/** The first month after today's whose change of this kind can still be asked for. */
export function earliestMonth(s: ClubState, kind: NoticeKind, today: ISODate): YM {
  let month = addMonths(ym(today), 1);
  while (!inTime(s, kind, month, today)) month = addMonths(month, 1);
  return month;
}

/** Can a change of this kind starting in `month` be asked for today? */
export function noticeCheck(s: ClubState, kind: NoticeKind, month: YM, today: ISODate): NoticeCheck {
  if (inTime(s, kind, month, today)) return { ok: true };
  return { ok: false, code: 'err.noticeLate', params: { deadline: noticeDeadline(s, month), month, earliest: earliestMonth(s, kind, today), days: noticeDays(s) } };
}
