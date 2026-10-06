// Threads and unread state per side (by message sequence numbers).
import type { ClubState, Message, Role, Thread, ThreadTopic } from '../types';
import { live, sortBy } from '../util';

export const TOPICS_BY_ROLE: Record<string, ThreadTopic[]> = {
  lobby: ['lobby'],
  nurse: ['nurse'],
  activity: ['care'],
  kitchen: ['kitchen'],
  finance: ['billing'],
  mgmt: ['lobby', 'nurse', 'care', 'kitchen', 'billing'],
};
export const messagesOf = (s: ClubState, threadId: string): Message[] =>
  sortBy(live(s.messages).filter((m) => m.threadId === threadId), (m) => m.seq);
const fromFamily = (m: Message) => m.from.startsWith('family:');
export const staffUnread = (s: ClubState, t: Thread) => messagesOf(s, t.id).filter((m) => m.seq > t.staffReadSeq && fromFamily(m)).length;
export const familyUnread = (s: ClubState, t: Thread) => messagesOf(s, t.id).filter((m) => m.seq > t.familyReadSeq && !fromFamily(m)).length;
export const lastMessage = (s: ClubState, threadId: string) => messagesOf(s, threadId).pop();
export function staffThreads(s: ClubState, role: Role): Thread[] {
  const topics = TOPICS_BY_ROLE[role] || [];
  return sortBy(live(s.threads).filter((t) => topics.includes(t.topic) && t.lastSeq > 0), (t) => lastMessage(s, t.id)?.at || '', -1);
}
export const familyThreads = (s: ClubState, familyId: string): Thread[] =>
  sortBy(live(s.threads).filter((t) => t.familyId === familyId && t.lastSeq > 0), (t) => lastMessage(s, t.id)?.at || '', -1);
export const threadFor = (s: ClubState, memberId: string, familyId: string, topic: ThreadTopic, feedbackId?: string) =>
  live(s.threads).find((t) => t.memberId === memberId && t.familyId === familyId && t.topic === topic && (t.feedbackId || undefined) === feedbackId);
export const staffUnreadCount = (s: ClubState, role: Role) => staffThreads(s, role).filter((t) => staffUnread(s, t) > 0).length;
export const familyUnreadCount = (s: ClubState, familyId: string) => familyThreads(s, familyId).filter((t) => familyUnread(s, t) > 0).length;
