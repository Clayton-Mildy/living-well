// Who a row, a reading or a reminder is about: a member or a trial / visiting guest, with the names the screens show.
import { memberName, memberShort, type ClubState, type GuestVisit, type Member, type QueueItem, type Reading } from '@cp/shared';
import type { StationRow } from '@cp/shared/rules/healthStation';
import { memberPhoto } from '../../lib/media';

export interface Who { kind: 'member' | 'guest'; id: string; name: string; short: string; tone?: number; photo?: string; member?: Member; guest?: GuestVisit }

export const whoOfPerson = (p: QueueItem['person']): Who =>
  p.type === 'member' ? { kind: 'member', id: p.m.id, name: memberName(p.m), short: memberShort(p.m), tone: p.m.photoTone, photo: memberPhoto(p.m), member: p.m } : { kind: 'guest', id: p.g.id, name: p.g.name, short: p.g.name, guest: p.g };
export const whoOfRow = (r: StationRow): Who => whoOfPerson(r.person);

export function whoOfReading(s: ClubState, r: Reading): Who | null {
  const m = r.memberId ? s.members[r.memberId] : undefined;
  if (m) return { kind: 'member', id: m.id, name: memberName(m), short: memberShort(m), tone: m.photoTone, photo: memberPhoto(m), member: m };
  const g = r.guestId ? s.guestVisits[r.guestId] : undefined;
  return g ? { kind: 'guest', id: g.id, name: g.name, short: g.name, guest: g } : null;
}
