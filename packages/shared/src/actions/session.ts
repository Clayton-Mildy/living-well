// Session-level actions: notification read state, own profile.
import { defineAction, isFamily, isStaff } from './framework';
import { updatesFor } from '../notify';
import type { Lang } from '../types';
import { e164 } from '../util';

export const sessionActions = [
  defineAction<{ ids: string[] }>({
    name: 'notifications.read',
    can: () => true,
    run(d, input, ctx) {
      for (const id of input.ids) {
        const n = d.notifications[id];
        if (n && !n.readBy.includes(ctx.user.id)) n.readBy.push(ctx.user.id);
      }
    },
  }),
  defineAction<Record<string, never>>({
    name: 'notifications.readAll',
    can: () => true,
    run(d, _input, ctx) {
      for (const n of updatesFor(d as never, ctx.user)) {
        const row = d.notifications[n.id];
        if (row && !row.readBy.includes(ctx.user.id)) row.readBy.push(ctx.user.id);
      }
    },
  }),
  defineAction<{ name?: string; phone?: string; lang?: Lang }>({
    name: 'account.updateStaff',
    can: (u) => isStaff(u),
    run(d, input, ctx) {
      const st = d.staff[ctx.user.id];
      if (!st) ctx.fail('err.notFound');
      if (input.name?.trim()) st.name = input.name.trim();
      if (input.phone?.trim()) st.phone = e164(input.phone);
    },
  }),
  defineAction<{ familyId: string; name?: string; phone?: string; lang?: Lang }>({
    name: 'account.updateFamily',
    can: (u, input) => isFamily(u) && u.id === input.familyId,
    // a family member changing their own contact details is a customer change: management reviews it
    review: { policy: (input) => (input.name || input.phone ? 'gate' : 'none'), section: 'family', op: 'update', target: (input) => ({ type: 'familyContact', id: input.familyId }) },
    run(d, input, ctx) {
      const fc = d.familyContacts[input.familyId];
      if (!fc) ctx.fail('err.notFound');
      if (input.name?.trim()) { fc.name = input.name.trim(); fc.firstName = fc.name.split(' ')[0]; }
      if (input.phone?.trim()) fc.phone = e164(input.phone);
      if (input.lang) fc.lang = input.lang;
    },
  }),
];
