// Messages: staff start and answer threads, families write in their own, per-side read state,
// and one automatic acknowledgement when a family message finds nobody from the club active in the thread for an hour.
import type { ClubState, Message, ThreadTopic } from '../types';
import { DomainError, defineAction, type Ctx } from './framework';
import { postMessage, requireMember, shortOf } from './helpers';
import { ALL_TOPICS, FAMILY_TOPICS, autoAckKey, canStaffUseTopic, needsAutoAck } from '../rules/chat';
import { messagesOf } from '../rules/messages';
import { isPendingRow, staffCall } from '../rules/core';
import { live } from '../util';

export const MAX_MESSAGE_LENGTH = 2000;
const REF_TYPES: NonNullable<Message['ref']>['type'][] = ['dailyLog', 'reading', 'photo', 'invoice', 'feedback'];
const bad = () => new DomainError('err.invalid');
const id = (x: unknown): string => {
  if (typeof x !== 'string' || !x) throw bad();
  return x;
};
const topicOf = (x: unknown): ThreadTopic => {
  if (!ALL_TOPICS.includes(x as ThreadTopic)) throw bad();
  return x as ThreadTopic;
};
const textOf = (x: unknown): string => {
  const t = typeof x === 'string' ? x.trim() : '';
  if (!t) throw new DomainError('chat.err.empty');
  if (t.length > MAX_MESSAGE_LENGTH) throw new DomainError('chat.err.tooLong', { max: MAX_MESSAGE_LENGTH });
  return t;
};

interface SendInput { threadId?: string; memberId?: string; topic?: ThreadTopic; text: string; ref?: Message['ref'] }
const staffName = (d: ClubState, ctx: Ctx) => staffCall(d.staff[ctx.user.id]) || ctx.user.id;

export const messagesActions = [
  // Staff open a conversation with a family contact about a member, in a topic their role covers.
  defineAction<{ memberId: string; familyId: string; topic: ThreadTopic; text: string }>({
    name: 'thread.start',
    can: (u, input) => u.kind === 'staff' && canStaffUseTopic(u.staff.role, input.topic),
    parse(raw) {
      const r = raw as { memberId?: unknown; familyId?: unknown; topic?: unknown; text?: unknown };
      return { memberId: id(r?.memberId), familyId: id(r?.familyId), topic: topicOf(r?.topic), text: textOf(r?.text) };
    },
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx);
      const fc = d.familyContacts[input.familyId];
      if (!fc || fc.deletedAt) ctx.fail('err.notFound');
      const link = live(d.familyLinks as ClubState['familyLinks']).find((l) => l.memberId === m.id && l.familyId === fc.id && l.appAccess && (!l.review || l.review.status === 'approved'));
      if (!link || isPendingRow(fc)) ctx.fail('chat.err.noAccess', { name: fc.firstName });
      const sent = postMessage(d, ctx, { memberId: m.id, familyId: fc.id, topic: input.topic, text: input.text });
      ctx.result.threadId = sent.threadId;
      ctx.notify({ toUsers: [fc.id], kind: 'chat.notif.new', params: { name: staffName(d as ClubState, ctx), member: shortOf(d, m.id) }, link: `/chat?thread=${sent.threadId}`, memberId: m.id, ref: { type: 'thread', id: sent.threadId } });
      ctx.feed({ icon: 'chat', key: 'chat.feed.started', params: { who: fc.firstName, name: shortOf(d, m.id) }, memberId: m.id });
    },
  }),

  // Staff reply in a thread of an allowed topic. A family member writes in their own thread: by thread id, or by member + topic
  // (which finds or creates their thread). Daily-log comments go to the care thread with ref { type: 'dailyLog', id }.
  defineAction<SendInput>({
    name: 'message.send',
    can: (u, input, s) => {
      const th = input.threadId ? s.threads[input.threadId] : undefined;
      if (u.kind === 'staff') return !!th && !th.deletedAt && canStaffUseTopic(u.staff.role, th.topic);
      if (input.threadId) return !!th && !th.deletedAt && th.familyId === u.id;
      return !!input.memberId && !!input.topic && u.memberIds.includes(input.memberId) && FAMILY_TOPICS.includes(input.topic);
    },
    parse(raw) {
      const r = raw as { threadId?: unknown; memberId?: unknown; topic?: unknown; text?: unknown; ref?: unknown };
      const out: SendInput = { text: textOf(r?.text) };
      if (r?.threadId !== undefined) out.threadId = id(r.threadId);
      if (r?.memberId !== undefined) out.memberId = id(r.memberId);
      if (r?.topic !== undefined) out.topic = topicOf(r.topic);
      if (!out.threadId && !(out.memberId && out.topic)) throw bad();
      if (r?.ref !== undefined && r.ref !== null) {
        const ref = r.ref as { type?: unknown; id?: unknown };
        if (!REF_TYPES.includes(ref.type as NonNullable<Message['ref']>['type'])) throw bad();
        out.ref = { type: ref.type as NonNullable<Message['ref']>['type'], id: id(ref.id) };
      }
      return out;
    },
    run(d, input, ctx) {
      if (ctx.user.kind === 'staff') {
        const th = d.threads[input.threadId!];
        if (!th || th.deletedAt) ctx.fail('err.notFound');
        const sent = postMessage(d, ctx, { memberId: th.memberId, familyId: th.familyId, topic: th.topic, text: input.text, ref: input.ref, feedbackId: th.feedbackId });
        const fb = th.feedbackId ? d.feedback[th.feedbackId] : undefined;
        if (fb && fb.status === 'open') fb.status = 'answered'; // answering meal feedback from Messages counts as the reply
        ctx.result.threadId = sent.threadId;
        ctx.notify({ toUsers: [th.familyId], kind: 'chat.notif.reply', params: { name: staffName(d as ClubState, ctx), member: shortOf(d, th.memberId) }, link: `/chat?thread=${th.id}`, memberId: th.memberId, ref: { type: 'thread', id: th.id } });
        ctx.feed({ icon: 'chat', key: 'chat.feed.reply', params: { who: d.familyContacts[th.familyId]?.firstName || '', name: shortOf(d, th.memberId) }, memberId: th.memberId });
        return;
      }
      // family
      const familyId = ctx.user.id;
      const th = input.threadId
        ? d.threads[input.threadId]
        : Object.values(d.threads).find((t) => !t.deletedAt && t.memberId === input.memberId && t.familyId === familyId && t.topic === input.topic && !t.feedbackId);
      const memberId = th ? th.memberId : input.memberId!;
      const topic = th ? th.topic : input.topic!;
      requireMember(d, memberId, ctx);
      const ack = needsAutoAck(th ? messagesOf(d as ClubState, th.id) : [], ctx.nowDT); // judged before the new message exists
      const sent = postMessage(d, ctx, { memberId, familyId, topic, text: input.text, ref: input.ref, feedbackId: th?.feedbackId });
      if (ack) {
        const t2 = d.threads[sent.threadId];
        const seq = t2.lastSeq + 1;
        t2.lastSeq = seq;
        t2.familyReadSeq = seq; // the family is in the thread right now; staff unread is untouched
        const mid = ctx.id('msg');
        d.messages[mid] = { id: mid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: 'system', threadId: t2.id, seq, from: 'system', at: ctx.nowDT, text: autoAckKey(topic), kind: 'autoAck' };
      }
      ctx.result.threadId = sent.threadId;
      ctx.result.autoAck = ack;
      ctx.feed({ icon: 'chat', key: `chat.feed.family.${topic}`, params: { who: d.familyContacts[familyId]?.firstName || '', name: shortOf(d, memberId) }, memberId });
    },
  }),

  // Mark your own side of a thread read: only called when the thread is actually open on screen.
  defineAction<{ threadId: string }>({
    name: 'thread.markRead',
    can: (u, input, s) => {
      const th = s.threads[input.threadId];
      if (!th || th.deletedAt) return false;
      return u.kind === 'staff' ? canStaffUseTopic(u.staff.role, th.topic) : th.familyId === u.id;
    },
    parse: (raw) => ({ threadId: id((raw as { threadId?: unknown })?.threadId) }),
    run(d, input, ctx) {
      const th = d.threads[input.threadId];
      if (!th) ctx.fail('err.notFound');
      if (ctx.user.kind === 'staff') {
        th.staffReadSeq = th.lastSeq;
        return;
      }
      th.familyReadSeq = th.lastSeq;
      for (const n of Object.values(d.notifications)) {
        if (!n.deletedAt && n.ref?.type === 'thread' && n.ref.id === th.id && n.toUsers.includes(ctx.user.id) && !n.readBy.includes(ctx.user.id)) n.readBy.push(ctx.user.id);
      }
    },
  }),
];
