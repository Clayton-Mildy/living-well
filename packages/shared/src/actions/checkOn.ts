// Check on (round 12): the front desk phones the family of a member who has gone quiet and logs what they said (a CareCall, staff only).
// "Unwell" and "in hospital" also tell management and leave a staff-only note on the member's page.
import type { CareCallOutcome, ISODate } from '../types';
import { defineAction, hasRole } from './framework';
import { requireMember, shortOf } from './helpers';
import { CARE_CALL_OUTCOMES } from '../rules/checkOn';
import { isoDate, obj, oneOf, phone, str } from '../rules/mgmtParse';

interface LogCallInput { memberId: string; contactName: string; phone: string; outcome: CareCallOutcome; note?: string; checkAgainOn?: ISODate }

export const checkOnActions = [
  defineAction<LogCallInput>({
    name: 'member.logCall',
    can: (u) => hasRole(u, 'lobby', 'nurse', 'mgmt'),
    parse(raw) {
      const r = obj(raw);
      const note = str(r.note, 500);
      const again = r.checkAgainOn === undefined || r.checkAgainOn === null || r.checkAgainOn === '' ? undefined : isoDate(r.checkAgainOn, 'checkAgainOn');
      return {
        memberId: str(r.memberId, 80, { required: true, field: 'memberId' }),
        contactName: str(r.contactName, 120),
        phone: phone(r.phone, 'phone', false),
        outcome: oneOf(r.outcome, CARE_CALL_OUTCOMES, 'outcome'),
        ...(note ? { note } : {}),
        ...(again ? { checkAgainOn: again } : {}),
      };
    },
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx);
      if (input.checkAgainOn && input.checkAgainOn < ctx.today) ctx.fail('err.invalid');
      const id = ctx.id('call');
      d.careCalls[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: m.id, date: ctx.today, at: ctx.nowDT, by: ctx.actor,
        contactName: input.contactName, phone: input.phone, outcome: input.outcome,
        ...(input.note ? { note: input.note } : {}), ...(input.checkAgainOn ? { checkAgainOn: input.checkAgainOn } : {}),
      };
      const name = shortOf(d, m.id);
      if (input.outcome === 'unwell' || input.outcome === 'hospital') {
        ctx.notify({ toRoles: ['mgmt'], kind: 'checkOn.notif.unwell', params: { name, outcome: input.outcome }, link: `/members/${m.id}`, memberId: m.id, severity: 'attention' });
        const nid = ctx.id('note');
        d.memberNotes[nid] = { id: nid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: m.id, visibility: 'staff', text: `Welfare call: ${input.outcome === 'hospital' ? 'in hospital' : 'unwell'}${input.note ? ` · ${input.note}` : ''}`, on: ctx.today };
      }
      ctx.feed({ icon: 'call', key: 'checkOn.feed.called', memberId: m.id, params: { name } });
      ctx.result.callId = id;
    },
  }),
];
