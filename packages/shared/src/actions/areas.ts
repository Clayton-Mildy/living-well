// Round 16 (KC): every staff action belongs to one menu of the access grid. `execute` refuses a staff action when the role's access to that menu is View or Hidden.

/** An exact action name or a 'x.' prefix → menu key. Exact names win over prefixes; the longest prefix wins. */
export const AREA_PREFIXES: [prefix: string, area: string][] = [
  // people
  ['approval.approve', 'reviews'], ['approval.reject', 'reviews'], ['review.approve', 'reviews'], ['review.reject', 'reviews'], ['review.acknowledge', 'reviews'], ['review.revert', 'reviews'], // round 16: View on Approvals refuses deciding (withdraw is the submitter's own, stays unmapped)
  ['members.', 'members'], ['family.', 'members'], ['note.', 'members'], ['planChange.', 'members'], ['membership.', 'members'],
  ['signing.send', 'members'], ['signing.physical', 'members'], ['email.', 'members'],
  ['enquiry.', 'enquiries'],
  ['followUp.', 'renewals'], ['unpaid.', 'renewals'], ['visitCall.', 'renewals'],
  ['venue.', 'venue'], ['celebration.', 'venue'], ['venue.createInvoice', 'billing'],
  ['survey.', 'surveys'], ['surveyTemplate.', 'surveys'],
  ['task.', 'tasks'], ['duty.', 'tasks'],
  // health
  ['reading.', 'readings'], ['queue.', 'readings'], ['health.', 'readings'],
  ['log.', 'log'],
  ['photo.', 'camera'],
  // kitchen
  ['dish.', 'lunch'], ['menu.', 'lunch'], ['dayMenu.', 'lunch'], ['allergyPlan.', 'lunch'], ['kitchen.', 'lunch'],
  ['feedback.reply', 'feedback'], ['feedback.setStatus', 'feedback'],
  // money
  ['invoice.', 'billing'], ['run.', 'billing'], ['xero.', 'billing'],
  ['payment.', 'payments'], ['refund.', 'payments'],
  ['budget.', 'budget'],
  ['receipt.', 'receipts'],
  ['vendorInvoice.', 'spending'],
  ['guest.', 'guests'], ['stock.', 'stock'], ['directory.', 'contacts'],
  ['prices.set', 'plans'], ['club.setPlan', 'plans'], ['club.updateSettings', 'settings'], ['terms.publish', 'settings'], // round 17: Admin › Settings (the Flex visits rule too)
  // club
  ['calendarEvent.', 'calendar'], ['schedule.', 'calendar'], ['activity.', 'calendar'], ['room.', 'calendar'],
  ['broadcast.', 'broadcast'], ['template.', 'broadcast'],
  ['staff.', 'hr'], ['hrNote.', 'hr'], ['staffTime.', 'hr'], ['leave.decide', 'hr'],
];

/**
 * Actions that stay `can`-only: family-only and public ones, `system`, approvals, own-account actions, the door (attendance, guest check-in),
 * quick capture that every role does from its own home (photo.take…, mood, stock requests). A role whose default for a menu is Hidden and whose
 * grid cell was never set is not checked for that menu either (see `permit`), so cross-screen paths keep working.
 */
export const UNMAPPED: string[] = [
  'review.withdraw', 'notifications.', 'account.', 'attendance.', 'jobs.',
  'guest.checkIn', 'guest.checkOut', 'guest.noShow', 'guest.undoCheckIn', 'guest.undoNoShow',
  'photo.take', 'photo.capture', 'photo.editDraft', 'photo.deleteDraft', 'photo.sendDrafts', 'photo.unsend',
  'stock.request', 'stock.edit', 'stock.cancel', 'feedback.submit', 'feedback.log', 'mood.', 'leave.request', 'leave.cancel', 'member.logCall', 'celebration.request',
  'budget.request', 'receipt.add',
  'access.', // round 16: Admin › Roles is the Owner's (can isOwner only)
  'terms.agree', // round 17: the family's own action (terms.publish belongs to the settings menu)
  'document.upload', 'enquiry.formOpen', 'enquiry.formSave', 'enquiry.formSubmit', 'venue.rate', 'survey.answer', 'signing.sign', 'signing.stamp',
  'family.updateDetails', 'family.setHealthAlerts', 'planChange.request', 'planChange.withdraw',
];

/** Actions the person who filed the row may also run (edit or withdraw their own receipt or budget request): that path is not an area right, so the grid does not take it away. */
export const OWN_ROW: string[] = ['receipt.edit', 'receipt.void', 'budget.edit', 'budget.cancel'];

const matches = (list: string[], name: string) => list.some((p) => (p.endsWith('.') ? name.startsWith(p) : name === p));

export const isUnmapped = (name: string) => matches(UNMAPPED, name);

/** The menu key an action belongs to, or null when it stays `can`-only. */
export function areaOf(name: string): string | null {
  // an exact entry in UNMAPPED beats a prefix in the table (photo.take vs 'photo.'); a prefix entry only covers what the table does not name exactly
  if (UNMAPPED.includes(name)) return null;
  const exact = AREA_PREFIXES.find(([p]) => p === name);
  if (exact) return exact[1];
  let best: [string, string] | undefined;
  for (const e of AREA_PREFIXES) if (e[0].endsWith('.') && name.startsWith(e[0]) && (!best || e[0].length > best[0].length)) best = e;
  if (best) return best[1];
  return null;
}
