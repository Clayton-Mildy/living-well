// Round 17: the member's Emails list (the simulated outbox, newest first).
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, type EmailRow } from '../index';
import { emailsOfMember } from './emails';

const row = (id: string, memberId: string, sentAt: string, extra: Partial<EmailRow> = {}): EmailRow => ({ id, clubId: 'citra', createdAt: sentAt, createdBy: 'system', to: 'a@b.co', toName: 'Maria Wijaya', familyId: 'f1', memberId, kind: 'invoice', subject: 'email.subj.invoice', params: {}, ref: { type: 'invoice', id: 'x' }, sentAt, sentBy: 'system', status: 'sent', ...extra });

describe('emailsOfMember', () => {
  it('holds only that member\'s live rows, newest first', () => {
    const s = produce(buildSeed().citra, (d) => {
      d.emails = { a: row('a', 'm1', '2026-10-01T09:00'), b: row('b', 'm1', '2026-10-05T09:00'), c: row('c', 'm2', '2026-10-06T09:00'), z: row('z', 'm1', '2026-10-07T09:00', { deletedAt: '2026-10-08T09:00' }) };
    });
    expect(emailsOfMember(s, 'm1').map((e) => e.id)).toEqual(['b', 'a']);
    expect(emailsOfMember(s, 'm2').map((e) => e.id)).toEqual(['c']);
    expect(emailsOfMember(s, 'm3')).toEqual([]);
  });
});
