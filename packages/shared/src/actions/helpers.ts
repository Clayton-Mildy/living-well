// Small helpers shared by action modules.
import type { Draft } from 'immer';
import type { Attendance, ClubState, ISODate } from '../types';
import type { Ctx } from './framework';
import { attId } from '../rules/attendance';
import { live } from '../util';
import { memberShort } from '../rules/core';

export function ensureAttendance(d: Draft<ClubState>, date: ISODate, memberId: string, ctx: Ctx): Draft<Attendance> {
  const id = attId(date, memberId);
  if (!d.attendance[id]) d.attendance[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId, date, queueAdds: [], dismissed: [], edits: [] };
  return d.attendance[id];
}
/** Family users (ids) who should hear about a member: approved links with app access. */
export function familyUserIds(d: Draft<ClubState> | ClubState, memberId: string, opts: { healthAlerts?: boolean } = {}): string[] {
  return live(d.familyLinks as ClubState['familyLinks'])
    .filter((l) => l.memberId === memberId && l.appAccess && (!l.review || l.review.status === 'approved') && (!opts.healthAlerts || l.healthAlerts))
    .map((l) => l.familyId);
}
export const shortOf = (d: Draft<ClubState> | ClubState, memberId: string) => (d.members[memberId] ? memberShort(d.members[memberId]) : memberId);
export function requireMember(d: Draft<ClubState>, memberId: string, ctx: Ctx) {
  const m = d.members[memberId];
  if (!m || m.deletedAt) ctx.fail('err.notFound');
  return m;
}
