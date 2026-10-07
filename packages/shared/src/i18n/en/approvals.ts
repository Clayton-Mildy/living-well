// approvals strings (EN): management approves what the team enters; staff see their entries marked until then.
export const approvals = {
  // staff side: the marker on an entry, and the toast after saving
  pending: 'Pending approval', pendingEdit: 'Pending approval · edit', rejectedMark: 'Rejected', rejectedWhy: 'Rejected: {reason}',
  waitingShort: 'Waiting for management approval.', familiesSeeEarlier: 'Families still see the earlier version.',
  menuWaiting: 'The menu from {date} is waiting for management approval. Families see the earlier menu until then.', menuNeeds: 'Management approves menu changes before families see them.',
  // the Approvals screen
  sub: 'What the team enters stays hidden from families until you approve it.',
  'tab.profile': 'Profile', 'tab.logs': 'Care log', 'tab.readings': 'Health', 'tab.photos': 'Photos', 'tab.menu': 'Menu', 'tab.stock': 'Stock', 'tab.history': 'History', pagerRows: 'Approval pages', tabsLabel: 'Approval types',
  'none.profile': 'No profile changes to approve', 'none.profileSub': 'New members and changes sent by other staff appear here, and health changes that were applied at once.',
  'none.logs': 'No care log entries to approve', 'none.logsSub': 'Daily logs and notes for families written by the team appear here before families can see them.',
  'none.readings': 'No health readings to approve', 'none.readingsSub': 'Readings saved by the nurse appear here before families can see them.',
  'none.menu': 'No menu changes to approve', 'none.menuSub': 'A weekly menu or a one-day change from the kitchen appears here before families can see it.',
  'none.stock': 'No stock requests to approve', 'none.stockSub': 'Requests from the team appear here. The kitchen supervisor and finance can also approve them on the Stock screen.',
  'none.history': 'Nothing handled yet',
  historySub: 'Entries that were approved or rejected',
  groupLabel: '{kind} {who}',
  // kinds
  'kind.cr': 'Change', 'kind.flag': 'Applied, review', 'kind.log': 'Daily log', 'kind.note': 'Note for the family', 'kind.reading': 'Health reading', 'kind.version': 'Weekly menu', 'kind.dayMenu': 'Menu for one day', 'kind.stock': 'Stock request', 'kind.photo': 'Photo',
  isNew: 'New', isEdit: 'Edit', editOf: '{kind} (edit)',
  // rows
  sentBy: '{who} · {when}', view: 'View', hide: 'Hide', approveOne: 'Approve', rejectOne: 'Reject', checkRow: 'Select {n}',
  // summaries and details
  'sum.menuVersion': 'Weekly menu from {date}', 'sum.menuChanges': '{n} changes', 'sum.menuSame': 'Same dishes, new start date', 'sum.dayMenu': 'Menu for {date}', 'sum.stock': '{item} · {qty} {unit}',
  was: 'Before', now: 'Now', noPrev: 'New entry', none: 'None', plus: 'Added', minus: 'Removed', area: 'For', section: 'Budget section', requestedBy: 'Requested by', noteLabel: 'Note for the family', pinned: 'Pinned', staffNoteHidden: 'The staff-only note stays private.',
  fromTemplate: 'Follows the weekly menu',
  // bulk and results
  rejectTitleOne: 'Reject this entry', rejectTitleN: 'Reject {n} entries', rejectSub: 'Families never see rejected entries. The person who entered them is told, with your reason.', rejectReasonOne: 'Why is it not approved?', rejectReasonN: 'Why are they not approved?',
  approvedOne: 'Approved. Families can see it now.', approvedN: '{n} approved. Families can see them now.', approvedStaffOne: 'Approved.', approvedStaffN: '{n} approved.',
  rejectedOne: 'Rejected. The author is told.', rejectedN: '{n} rejected. The authors are told.',
  skippedN: '{n} skipped: already handled or no longer waiting.', conflictN: '{n} could not be applied because the record changed since. Open them one at a time.', nothingDone: 'Nothing to do: those entries were already handled.',
  // notifications to the author of a rejected entry
  'notif.rejected.logs': 'Management did not approve {n} of your care log entries: {reason}', 'notif.rejected.readings': 'Management did not approve {n} of your health readings: {reason}', 'notif.rejected.menu': 'Management did not approve {n} of your menu changes: {reason}',
};
