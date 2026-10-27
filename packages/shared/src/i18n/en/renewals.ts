// renewals strings (EN): KC round 7, the front desk's month-end membership follow-up.
export const renewals = {
  title: 'Next month',
  // round 14: the Next month screen (changes recorded for the coming month)
  tabChanges: 'Changes', tabUnpaid: 'Unpaid', record: 'Record a change', from: 'from {d}', undo: 'Undo', undone: 'Change undone for {name}.', noChanges: 'No changes recorded for {month}', pickMember: 'Pick a member', pickNone: 'Nobody left to record for {month}', recordedBy: 'by {who}',
  undoTitle: 'Undo this change?', undoAsk: 'The change for {name} in {month} is cancelled and the family is told now.', keep: 'Keep it',
  // round 15: the Members tab (every member and what next month holds)
  'tab.members': 'Members', continues: 'Continues', toPlan: '→ {plan}', onLeave: 'On leave', stops: 'Stops', stopsOn: 'Stops {d}', countLine: '{c} continue · {n} change', 'f.all': 'All', 'f.continues': 'Continues', 'f.changing': 'Changing',
  // page
  prevMonth: 'Earlier month', nextMonth: 'Later month', logEyebrow: '{month} · log',
  progress: '{n} of {total} decided', progressAll: 'All {total} decided',
  datesOpen: 'Leave for {month}: tell us by {date} · Invoice {invoice}', datesClosed: 'Leave can start in {month} · Invoice {invoice}',
  segLabel: 'Show', 'seg.toDo': 'To do', 'seg.waiting': 'Waiting', 'seg.decided': 'Decided',
  searchPh: 'Search a member or family', searchLabel: 'Search members', pager: 'Renewal pages',
  'none.toDo': 'Everyone has been followed up', 'none.waiting': 'Nothing is waiting for management', 'none.decided': 'Nobody decided yet', noMatch: 'No match', noLog: 'No follow-ups were recorded for {month}', noMembers: 'Nobody to follow up for {month}',
  // rows
  noContact: 'No contact on file', calls1: '1 call', callsN: '{n} calls',
  'plan.flex': 'Flex', 'plan.gold': 'Gold',
  'outcome.continue': 'Continue', 'outcome.upgrade': 'Upgrade to Gold', 'outcome.downgrade': 'Downgrade to Flex', 'outcome.leave': 'Leave', 'outcome.stop': 'Stop', 'outcome.noAnswer': 'No answer',
  // the list's columns (round 8d): who · plan · where it stands · what to do now
  'col.member': 'Member', 'col.plan': 'Plan', 'col.status': 'Status', 'col.next': 'Next step', usageLine: '{usage} this month',
  'status.new': 'Not contacted', 'status.asked': 'Asked in the app', 'status.rejected': 'Not approved', 'status.pending': 'Waiting for approval',
  'next.call': 'Call the family', 'next.callAgain': 'Call again · {calls}', 'next.askAgain': 'Ask the family again', 'next.approval': 'Waiting for approval', 'next.approve': 'Approve in Approvals', 'next.answerRequest': 'Answer the plan request',
  'next.renews': 'Renews {date}', 'next.planFrom': '{plan} starts {date}', 'next.leaveFrom': 'Leave starts {date}', 'next.lastDay': 'Last day {date}',
  // the follow-up sheet
  sheetTitle: 'Follow up {name}', 'group.contact': 'Family contact', 'group.membership': 'Membership', 'group.outcome': 'Decision for {month}', 'group.calls': 'Calls',
  whatsapp: 'WhatsApp', plan: 'Plan', usage: 'This month', usageFlex: '{used} of {quota} days', usageGold: '{n} days', usageExtra: ' · {n} extra',
  leaveMonths: 'Leave months', leaveLate: '{month}: notice was due {date}', lastDay: 'Last day', reason: 'Reason', notePh: 'Optional',
  save: 'Save', saveApproval: 'Send for approval', saved: 'Saved for {name}.', savedApplied: 'Saved for {name}. It applies from {date}.', quickSaved: 'Saved for {name}: {outcome}.',
  'st.waiting': 'Waiting for management approval. Recorded by {who}.', 'st.rejected': 'Management did not approve this: {reason}', 'st.applied': 'Applied from {date}.', 'st.appliedStop': 'Applied: the last day is {date}.',
  'st.askedPlan': 'The family asked to switch plan in the app.', 'st.askedLeave': 'Leave for {month} is already on the list.', 'st.review': 'Open in Approvals',
  'calls.none': 'No calls yet', callLine: '{who} · {when}',
  // errors
  'err.pastMonth': 'That month has already started.', 'err.started': 'This month has started', 'err.applied': 'This change is already applied. Change it on the member’s Plan tab.',
  'err.notDue': 'This member is not due for a follow-up in that month.', 'err.lastDayLate': 'The last day has to be inside the month being decided.',
  // what families are told, once a change is applied
  'notif.plan': '{name}’s plan changes to {plan} from {date}.', 'notif.leave': 'Leave for {name} in {month} is recorded: {fee} on that month’s invoice instead of the plan.',
  'notif.leave2': 'Leave for {name} from {from} to {to} is recorded: {fee} a month on the invoices instead of the plan.',
  'notif.undone': 'The change for {name} in {month} was cancelled.',
  // the bell
  'notif.act.approve': 'Renewal changes waiting for approval: {n}',
  // the feed
  'feed.continue': '{name}: continues in {month}', 'feed.upgrade': '{name}: moving to Gold from {month}', 'feed.downgrade': '{name}: moving to Flex from {month}',
  'feed.leave': '{name}: leave in {month}', 'feed.leave2': '{name}: leave from {from} to {to}', 'feed.stop': '{name}: stopping, last day {date}',
  'feed.noAnswer': '{name}: renewal call, no answer',
  'feed.undone': '{name}: change for {month} undone', 'feed.approved': '{name}: renewal change for {month} approved', 'feed.rejected': '{name}: renewal change for {month} not approved',
};
