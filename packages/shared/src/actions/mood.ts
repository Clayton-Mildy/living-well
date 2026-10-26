// Mood marks (round 12): any staff member can mark how a member is, at the door, at the health check, in a session, on leaving.
// Round 14: also in the activity team's Morning round and the kitchen's lunch round (neither needs a slot).
// The same marks are also written by check-in / check-out, reading.save and log.mark (those call writeMark directly).
import type { Face, MoodMoment, Slot } from '../types';
import { defineAction, isStaff } from './framework';
import { attId } from '../rules/attendance';
import { clearMark, writeMark } from '../rules/mood';
import { requireMember } from './helpers';
import { bad, hm, int, obj, oneOf, str } from '../rules/mgmtParse';

const MOMENTS = ['arrival', 'health', 'morning', 'lunch', 'activity', 'departure'] as const;

export const parseFace = (v: unknown): Face => int(v, 1, 5, 'face') as Face;
/** An optional face: absent stays absent, anything else must be 1-5. */
export const optFace = (v: unknown): Face | undefined => (v === undefined || v === null ? undefined : parseFace(v));

interface MarkInput { memberId: string; moment: MoodMoment; face: Face; slot?: Slot; readingId?: string }
interface ClearInput { memberId: string; moment: MoodMoment; slot?: Slot }

function slotOf(r: Record<string, unknown>, moment: MoodMoment): Slot | undefined {
  if (moment !== 'activity') return undefined;
  if (r.slot === undefined) return bad('slot');
  return hm(r.slot, 'slot');
}

export const moodActions = [
  defineAction<MarkInput>({
    name: 'mood.mark',
    can: (u) => isStaff(u),
    parse(raw) {
      const r = obj(raw);
      const moment = oneOf(r.moment, MOMENTS, 'moment');
      const slot = slotOf(r, moment);
      const readingId = r.readingId === undefined ? undefined : str(r.readingId, 80, { required: true, field: 'readingId' });
      return { memberId: str(r.memberId, 80, { required: true, field: 'memberId' }), moment, face: parseFace(r.face), ...(slot ? { slot } : {}), ...(readingId ? { readingId } : {}) };
    },
    run(d, input, ctx) {
      requireMember(d, input.memberId, ctx);
      if (input.moment !== 'arrival' && !d.attendance[attId(ctx.today, input.memberId)]?.checkIn) ctx.fail('mood.err.notIn');
      const row = writeMark(d, ctx, input);
      ctx.result.markId = row.id;
    },
  }),
  defineAction<ClearInput>({
    name: 'mood.clear',
    can: (u) => isStaff(u),
    parse(raw) {
      const r = obj(raw);
      const moment = oneOf(r.moment, MOMENTS, 'moment');
      const slot = slotOf(r, moment);
      return { memberId: str(r.memberId, 80, { required: true, field: 'memberId' }), moment, ...(slot ? { slot } : {}) };
    },
    run(d, input, ctx) {
      requireMember(d, input.memberId, ctx);
      clearMark(d, ctx.today, input.memberId, input.moment, input.slot);
    },
  }),
];
