// Messages selectors: topics per role, the auto-acknowledgement rule, and the thread rows shown to staff and to families.
// Unread counts per side come from rules/messages.ts (staffUnread / familyUnread); this file adds the view-model pieces.
import type { Actor, ClubState, DT, FamilyContact, Feedback, ISODate, Member, Message, Role, StaffRole, Thread, ThreadTopic } from '../types';
import { firstOfRole, familyMemberIds, isPrimaryFor, membershipStatus } from './core';
import { TOPICS_BY_ROLE, familyThreads, familyUnread, lastMessage, staffThreads, staffUnread, threadFor, messagesOf } from './messages';
import { toMin } from '../util';

/** Topics a staff role may read and write (management: all). */
export const topicsOf = (role: Role | null | undefined): ThreadTopic[] => (role ? TOPICS_BY_ROLE[role] || [] : []);
export const canStaffUseTopic = (role: Role | null | undefined, topic: ThreadTopic) => topicsOf(role).includes(topic);
/** Topics a family member may write to by themselves (kitchen threads come from meal feedback). */
export const FAMILY_TOPICS: ThreadTopic[] = ['lobby', 'nurse', 'care', 'billing'];
export const ALL_TOPICS: ThreadTopic[] = ['lobby', 'nurse', 'care', 'kitchen', 'billing'];
/** The staff role that answers each topic (used for avatars and team names, never hard-coded staff ids). */
export const TOPIC_ROLE: Record<ThreadTopic, StaffRole> = { lobby: 'lobby', nurse: 'nurse', care: 'activity', kitchen: 'kitchen', billing: 'finance' };
export const teamStaff = (s: ClubState, topic: ThreadTopic) => firstOfRole(s, TOPIC_ROLE[topic]);

// ---------- auto-acknowledgement ----------
export const AUTO_ACK_MINUTES = 60;
export const autoAckKey = (topic: ThreadTopic) => `chat.autoAck.${topic}`;
const dayNumber = (d: string) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000);
/** Minutes from `a` to `b` (club wall-clock strings, may span days). */
export const minutesBetween = (a: DT, b: DT) => (dayNumber(b) - dayNumber(a)) * 1440 + toMin(b.slice(11, 16)) - toMin(a.slice(11, 16));
export const isStaffActor = (a: Actor) => a.startsWith('staff:');
export const isFamilyActor = (a: Actor) => a.startsWith('family:');
export const senderKind = (m: Pick<Message, 'from'>): 'family' | 'staff' | 'system' => (isFamilyActor(m.from) ? 'family' : isStaffActor(m.from) ? 'staff' : 'system');
/**
 * A family message gets ONE automatic acknowledgement when nobody from the club has written in the thread
 * (and no acknowledgement went out) during the last 60 demo minutes. `msgs` are the thread's messages before the new one.
 */
export function needsAutoAck(msgs: Pick<Message, 'from' | 'kind' | 'at'>[], now: DT): boolean {
  return !msgs.some((m) => (isStaffActor(m.from) || m.kind === 'autoAck') && minutesBetween(m.at, now) < AUTO_ACK_MINUTES);
}
export const threadNeedsAutoAck = (s: ClubState, threadId: string | undefined, now: DT) => (threadId ? needsAutoAck(messagesOf(s, threadId), now) : true);

// ---------- member switcher (family) ----------
export interface FamilyChoices {
  /** every member the family can message about (approved link with app access) */
  all: string[];
  /** members the switcher offers: those whose membership has not ended (all of them when every membership has ended) */
  choices: string[];
}
export function familyChoices(s: ClubState, familyId: string, today: ISODate): FamilyChoices {
  const all = familyMemberIds(s, familyId, true).filter((id) => s.members[id]);
  const active = all.filter((id) => membershipStatus(s.members[id], today) !== 'ended');
  return { all, choices: active.length ? active : all };
}
/** A stored switcher value ('both' or a member id) against the members on offer: 'both' only when there is more than one. */
export function resolveMemberSel(stored: unknown, choices: string[]): string {
  if (choices.length < 2) return choices[0] || '';
  return typeof stored === 'string' && choices.includes(stored) ? stored : 'both';
}

// ---------- thread rows ----------
export interface ThreadRow {
  key: string; // thread id, or `v:<memberId>:<topic>` for a "start a conversation" row with no messages yet
  thread?: Thread;
  topic: ThreadTopic;
  member: Member;
  family: FamilyContact;
  last?: Message;
  unread: number;
  feedback?: Feedback;
}
const rowOf = (s: ClubState, t: Thread, unread: number): ThreadRow | null => {
  const member = s.members[t.memberId];
  const family = s.familyContacts[t.familyId];
  if (!member || !family) return null;
  return { key: t.id, thread: t, topic: t.topic, member, family, last: lastMessage(s, t.id), unread, feedback: t.feedbackId ? s.feedback[t.feedbackId] : undefined };
};
/** Staff view: threads of the topics the role covers, newest first, filtered to one topic or all. */
export function staffRows(s: ClubState, role: Role, topic: ThreadTopic | 'all' = 'all'): ThreadRow[] {
  return staffThreads(s, role)
    .filter((t) => topic === 'all' || t.topic === topic)
    .map((t) => rowOf(s, t, staffUnread(s, t)))
    .filter((r): r is ThreadRow => !!r);
}
/** Topics a family can start for a member: lobby and nurse, plus billing for the primary billing contact. */
export const starterTopics = (s: ClubState, familyId: string, memberId: string): ThreadTopic[] =>
  isPrimaryFor(s, familyId, memberId) ? ['lobby', 'nurse', 'billing'] : ['lobby', 'nurse'];
/**
 * Family view: real threads (newest first), then one "start a conversation" row per member and topic that has none yet.
 * `memberIds` limits the list to those members (the member switcher); null = all the family's members.
 */
export function familyRows(s: ClubState, familyId: string, memberIds: string[] | null, today: ISODate): ThreadRow[] {
  const fam = s.familyContacts[familyId];
  const real = familyThreads(s, familyId)
    .filter((t) => !memberIds || memberIds.includes(t.memberId))
    .map((t) => rowOf(s, t, familyUnread(s, t)))
    .filter((r): r is ThreadRow => !!r);
  if (!fam) return real;
  const starters: ThreadRow[] = [];
  const ids = (memberIds || familyMemberIds(s, familyId)).filter((id) => s.members[id] && membershipStatus(s.members[id], today) !== 'ended');
  for (const id of ids) {
    for (const topic of starterTopics(s, familyId, id)) {
      const existing = threadFor(s, id, familyId, topic);
      if (existing && existing.lastSeq > 0) continue;
      starters.push({ key: `v:${id}:${topic}`, topic, member: s.members[id], family: fam, unread: 0 });
    }
  }
  return [...real, ...starters];
}
/** Resolve a selection key (thread id or starter key) to its row; a starter whose thread now exists resolves to the real thread. */
export function resolveRow(rows: ThreadRow[], key: string | null | undefined): ThreadRow | undefined {
  if (!key) return undefined;
  const direct = rows.find((r) => r.key === key);
  if (!key.startsWith('v:')) return direct;
  const [, memberId, topic] = key.split(':');
  return rows.find((r) => r.thread && !r.thread.feedbackId && r.member.id === memberId && r.topic === topic) || direct;
}
