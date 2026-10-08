// renewals strings (EN): KC round 7, the front desk's month-end membership follow-up.
export const renewals = {
  title: 'Renewals',
  // page
  prevMonth: 'Earlier month', nextMonth: 'Later month', logEyebrow: '{month} · log',
  progress: '{n} of {total} decided', progressAll: 'All {total} decided',
  datesOpen: 'Leave for {month}: tell us by {date} · Invoice {invoice}', datesClosed: 'Leave can start in {month} · Invoice {invoice}',
  segLabel: 'Show', 'seg.toDo': 'To do', 'seg.waiting': 'Waiting', 'seg.decided': 'Decided',
  searchPh: 'Search a member or family', searchLabel: 'Search members', pager: 'Renewal pages',
  'none.toDo': 'Everyone has been followed up', 'none.waiting': 'Nothing is waiting for management', 'none.decided': 'Nobody decided yet', noMatch: 'No match', noLog: 'No follow-ups were recorded for {month}', noMembers: 'Nobody to follow up for {month}',
  // rows
  askedApp: 'Asked in the app', noContact: 'No contact on file', calls1: '1 call', callsN: '{n} calls',
  'plan.flex': 'Flex', 'plan.gold': 'Gold',
  'outcome.continue': 'Continue', 'outcome.upgrade': 'Upgrade to Gold', 'outcome.downgrade': 'Downgrade to Flex', 'outcome.leave': 'Leave', 'outcome.stop': 'Stop', 'outcome.noAnswer': 'No answer', 'outcome.callBack': 'Call back',
  'meta.continue': 'Continues', 'meta.upgrade': 'Upgrade to Gold', 'meta.downgrade': 'Downgrade to Flex', 'meta.leave': 'Leave {months}', 'meta.stop': 'Stops {date}', 'meta.noAnswer': 'No answer', 'meta.callBack': 'Call back', 'meta.rejected': 'Not approved',
  // the follow-up sheet
  sheetTitle: 'Follow up {name}', 'group.contact': 'Family contact', 'group.membership': 'Membership', 'group.outcome': 'Decision for {month}', 'group.calls': 'Calls',
  whatsapp: 'WhatsApp', plan: 'Plan', usage: 'This month', usageFlex: '{used} of {quota} days', usageGold: '{n} days', usageExtra: ' · {n} extra',
  leaveMonths: 'Leave months', leaveLate: '{month}: notice was due {date}', lastDay: 'Last day', reason: 'Reason', notePh: 'Optional',
  save: 'Save', saveApproval: 'Send for approval', saved: 'Saved for {name}.', savedApplied: 'Saved for {name}. It applies from {date}.', quickSaved: 'Saved for {name}: {outcome}.',
  'st.waiting': 'Waiting for management approval. Recorded by {who}.', 'st.rejected': 'Management did not approve this: {reason}', 'st.applied': 'Applied from {date}.', 'st.appliedStop': 'Applied: the last day is {date}.',
  'st.askedPlan': 'The family asked to switch plan in the app.', 'st.askedLeave': 'Leave for {month} is already on the list.', 'st.review': 'Open in Approvals',
  'calls.none': 'No calls yet', callLine: '{who} · {when}',
  // errors
  'err.pastMonth': 'That month has already started.', 'err.started': 'That month has already started, so the change can no longer begin on the 1st.', 'err.applied': 'This change is already applied. Change it on the member’s Plan tab.',
  'err.notDue': 'This member is not due for a follow-up in that month.', 'err.lastDayLate': 'The last day has to be inside the month being decided.',
  // what families are told, once a change is applied
  'notif.plan': '{name}’s plan changes to {plan} from {date}.', 'notif.leave': 'Leave for {name} in {month} is recorded: {fee} on that month’s invoice instead of the plan.',
  'notif.leave2': 'Leave for {name} from {from} to {to} is recorded: {fee} a month on the invoices instead of the plan.',
  // the bell
  'notif.act.followUp': '{n} members to follow up for {month}', 'notif.act.approve': 'Renewal changes waiting for approval: {n}',
  // the feed
  'feed.continue': '{name}: continues in {month}', 'feed.upgrade': '{name}: moving to Gold from {month}', 'feed.downgrade': '{name}: moving to Flex from {month}',
  'feed.leave': '{name}: leave in {month}', 'feed.leave2': '{name}: leave from {from} to {to}', 'feed.stop': '{name}: stopping, last day {date}',
  'feed.noAnswer': '{name}: renewal call, no answer', 'feed.callBack': '{name}: renewal call, to call back',
  'feed.approved': '{name}: renewal change for {month} approved', 'feed.rejected': '{name}: renewal change for {month} not approved',
};
