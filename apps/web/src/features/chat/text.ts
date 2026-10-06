// Display helpers for Messages: team names, message bodies (automatic replies are stored as i18n keys), sender names, time labels.
import { actorName, memberShort, staffCall, type ClubState, type Message, type Thread, type ThreadTopic } from '@cp/shared';
import { senderKind, teamStaff } from '@cp/shared/rules/chat';
import type { TFn } from '../../lib/i18n';

/** Name of the team a family writes to: the nurse by name (as in the design), the others by team. */
export function teamName(t: TFn, s: ClubState, topic: ThreadTopic): string {
  if (topic === 'nurse') return staffCall(teamStaff(s, 'nurse')) || t('chat.topic.nurse');
  return t('chat.topic.' + topic);
}
export function teamSub(t: TFn, s: ClubState, topic: ThreadTopic): string {
  const first = (staffCall(teamStaff(s, topic)) || '').split(' ')[0];
  return t('chat.teamSub.' + topic, { name: first });
}
/** Message text as shown: automatic replies and system lines are i18n keys (rendered translated), everything else is as written. */
export function messageBody(t: TFn, s: ClubState, m: Message, th?: Thread): string {
  if (m.kind === 'autoAck' || m.kind === 'system') {
    const fam = th ? s.familyContacts[th.familyId] : undefined;
    const mem = th ? s.members[th.memberId] : undefined;
    return t(m.text, { name: fam?.firstName || '', member: mem ? memberShort(mem) : '', nurse: staffCall(teamStaff(s, 'nurse')) });
  }
  return m.text;
}
/** "Today 10:05" / "Wed 14 Oct 18:30". */
export const whenOf = (t: TFn, fds: (d: string) => string, today: string, at: string) => `${at.slice(0, 10) === today ? t('common.today') : fds(at.slice(0, 10))} ${at.slice(11, 16)}`;
/** Who wrote it, for the meta line under a bubble. */
export function senderName(t: TFn, s: ClubState, m: Message, viewerFamilyId: string | null): string {
  if (m.kind === 'autoAck') return t('chat.autoReply');
  if (viewerFamilyId && m.from === `family:${viewerFamilyId}`) return t('chat.you');
  if (m.from.startsWith('family:')) return s.familyContacts[m.from.slice(7)]?.firstName || actorName(s, m.from); // staff see the family's first name, as in the design
  return actorName(s, m.from);
}
export { senderKind };
