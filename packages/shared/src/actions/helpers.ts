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

/** Post a message into the (member, family contact, topic) thread, creating the thread on first use. Sender's side is marked read. */
export function postMessage(
  d: Draft<ClubState>,
  ctx: Ctx,
  m: { memberId: string; familyId: string; topic: import('../types').ThreadTopic; text: string; kind?: import('../types').Message['kind']; ref?: import('../types').Message['ref']; from?: import('../types').Actor; feedbackId?: string },
) {
  let th = Object.values(d.threads).find((t) => !t.deletedAt && t.memberId === m.memberId && t.familyId === m.familyId && t.topic === m.topic && (t.feedbackId || undefined) === m.feedbackId);
  if (!th) {
    const tid = ctx.id('th');
    d.threads[tid] = { id: tid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: m.memberId, familyId: m.familyId, topic: m.topic, ...(m.feedbackId ? { feedbackId: m.feedbackId } : {}), lastSeq: 0, staffReadSeq: 0, familyReadSeq: 0 };
    th = d.threads[tid];
  }
  const seq = th.lastSeq + 1;
  th.lastSeq = seq;
  const from = m.from ?? ctx.actor;
  if (from.startsWith('family:')) th.familyReadSeq = seq;
  else th.staffReadSeq = seq;
  const id = ctx.id('msg');
  d.messages[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: from, threadId: th.id, seq, from, at: ctx.nowDT, text: m.text, kind: m.kind || 'text', ...(m.ref ? { ref: m.ref } : {}) };
  return { threadId: th.id, seq, messageId: id };
}
