// Round 16 (KC): the notice period. A downgrade, a stop or a leave for a month has to be asked some days before that month's 1st; asked later, it can start
// the month after at the earliest. Round 18: each of the three kinds has its own days (`ClubSettings.notice`); a kind not set falls back to the round 16
// `noticeDays`, then to 14 (December → 17 November), so a club with no settings behaves as before. Round 19: an upgrade has its own days too (default 1:
// asked by the last day of the month before, as before; the old `noticeDays` never applied to it). Moving back to the plan in force the day before is a
// take-back ('takeBack'), which keeps the old upgrade rule: only to be asked before the 1st.
// Management ending a membership for a reason (members.end) is not a family's request and is not held to it.
import type { ClubState, ISODate, Member, Plan, YM } from '../types';
import { addDays, addMonths, monthStart, ym } from '../util';
import { planOn } from './core';
import { priceOn } from './billing';
import { planPrice } from './plans';

export const NOTICE_DAYS_DEFAULT = 14;
export const UPGRADE_DAYS_DEFAULT = 1;
export const NOTICE_KINDS = ['downgrade', 'stop', 'leave', 'upgrade'] as const;
export type NoticeDaysKind = typeof NOTICE_KINDS[number];
/** The days of notice for each kind: the kind's own setting, else the old single `noticeDays`, else 14; an upgrade's own setting, else 1. */
export const noticeSettings = (s: Pick<ClubState, 'club'>): Record<NoticeDaysKind, number> => {
  const { notice, noticeDays: old } = s.club.settings;
  const of = (k: Exclude<NoticeDaysKind, 'upgrade'>) => notice?.[k] ?? old ?? NOTICE_DAYS_DEFAULT;
  return { downgrade: of('downgrade'), stop: of('stop'), leave: of('leave'), upgrade: notice?.upgrade ?? UPGRADE_DAYS_DEFAULT };
};
export const noticeDays = (s: Pick<ClubState, 'club'>, kind: NoticeDaysKind): number => noticeSettings(s)[kind];
/** The last day a change of this kind starting in `month` can be asked for. */
export const noticeDeadline = (s: Pick<ClubState, 'club'>, month: YM, kind: NoticeDaysKind): ISODate => addDays(monthStart(month), -noticeDays(s, kind));

export type NoticeKind = 'takeBack' | NoticeDaysKind;
export type NoticeCheck = { ok: true } | { ok: false; code: 'err.noticeLate'; params: { deadline: ISODate; month: YM; earliest: YM; days: number } };

/**
 * A move to `to` for `month`, against the plan in force the day before (what the family pays now): dearer is an upgrade; cheaper or the same price is a
 * downgrade (each with its notice). Moving back to that plan takes back a change scheduled for the month ('takeBack'), which needs no notice.
 */
export function changeKind(s: ClubState, m: Member, to: Plan, month: YM): 'upgrade' | 'downgrade' | 'takeBack' {
  const first = monthStart(month);
  const before = planOn(m, addDays(first, -1)).plan;
  if (to === before) return 'takeBack';
  const price = priceOn(s, first);
  return planPrice(price, to) > planPrice(price, before) ? 'upgrade' : 'downgrade';
}

const inTime = (s: Pick<ClubState, 'club'>, kind: NoticeKind, month: YM, today: ISODate) =>
  month > ym(today) && (kind === 'takeBack' ? today < monthStart(month) : today <= noticeDeadline(s, month, kind));

/** The first month after today's whose change of this kind can still be asked for. */
export function earliestMonth(s: Pick<ClubState, 'club'>, kind: NoticeKind, today: ISODate): YM {
  let month = addMonths(ym(today), 1);
  while (!inTime(s, kind, month, today)) month = addMonths(month, 1);
  return month;
}

/** Can a change of this kind starting in `month` be asked for today? `days` is the kind's days (0 for a take-back, whose deadline is the day before the 1st). */
export function noticeCheck(s: Pick<ClubState, 'club'>, kind: NoticeKind, month: YM, today: ISODate): NoticeCheck {
  if (inTime(s, kind, month, today)) return { ok: true };
  const deadline = kind === 'takeBack' ? addDays(monthStart(month), -1) : noticeDeadline(s, month, kind);
  return { ok: false, code: 'err.noticeLate', params: { deadline, month, earliest: earliestMonth(s, kind, today), days: kind === 'takeBack' ? 0 : noticeDays(s, kind) } };
}
