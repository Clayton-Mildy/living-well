// guests strings (EN): KC round 7, guest hosts (outside teachers, singers and speakers) and the sessions they lead.
export const guests = {
  title: 'Guest hosts',
  // screen
  sessions: 'Sessions', hosts: 'Hosts', view: 'View', filter: 'Show', book: 'Book a guest', addHost: 'Add a host', guest: 'Guest',
  f_all: 'All', f_upcoming: 'Upcoming', f_toPay: 'To pay', f_paid: 'Paid', f_cancelled: 'Cancelled',
  g_upcoming: 'Upcoming', g_toPay: 'To pay', g_paid: 'Paid', g_cancelled: 'Cancelled',
  st_booked: 'Booked', st_cancelled: 'Cancelled', st_paid: 'Paid', st_toPay: 'Not paid yet',
  late: 'The day has passed: mark it as done', overdue: 'This was on {date}. Mark it as done once the guest has taught or performed.',
  issue_closed: 'The club is closed that day', issue_outing: 'An outing replaces that day', issue_noSession: 'That slot has no session now',
  empty: 'No guest sessions yet.', emptyHosts: 'No guest hosts yet.', noSessionsHost: 'No sessions yet.', inactive: 'Inactive', owes: '{amount} owed',
  withGuest: 'with {name} · guest', hint: 'Guest host',
  // kinds
  k_teacher: 'Teacher', k_entertainer: 'Entertainer', k_speaker: 'Speaker', k_other: 'Other',
  // session
  when: 'When', status: 'Status', fee: 'Fee', invoice: 'Invoice', note: 'Note', dueOn: 'due {date}', paidOn: 'paid {date}', waitingFinance: 'Finance can pay this before or after the session.',
  markDone: 'Mark as done', markPaid: 'Mark as paid', whatsapp: 'WhatsApp {name}', keep: 'Keep it', cancelBooking: 'Cancel booking', cancelAsk: 'Cancel {name} on {date}? The slot goes back to the weekly plan.',
  doneToast: 'Marked as done. Finance can pay {name} now.', paidToast: '{name} marked as paid.', cancelledToast: 'Booking cancelled.',
  // book sheet
  bookTitle: 'Book a guest', editTitle: 'Edit booking', host: 'Host', pickHost: 'Pick a host', newHost: 'New host', date: 'Date', session: 'Session', pickActivity: 'Pick an activity',
  errDay: 'Pick an open day, today or later, with no outing.', takenBy: 'Already booked: {name}', changesSlot: 'This changes the {slot} activity on {date}. Teachers and families are told.',
  notePh: 'For example: needs a microphone', bookBtn: 'Book', booked: '{name} is booked for {date}.', saved: 'Booking saved.',
  // host
  addHostBtn: 'Add host', editHost: 'Edit host', name: 'Name', kind: 'Kind', what: 'What they do', whatPh: 'For example: Angklung teacher', phone: 'Phone', usualFee: 'Usual fee per session',
  bank: 'Bank', account: 'Account number', holder: 'Account holder', bankDetails: 'Bank', contact: 'Contact', active: 'Active', activeSub: 'Inactive hosts cannot be booked.',
  tSessions: 'Sessions', tPaid: 'Paid', tOwed: 'Owed', bookHost: 'Book {name}', archive: 'Archive host', archiveAsk: 'Archive {name}? Their past sessions stay on record.',
  hostAdded: '{name} added.', hostSaved: '{name} saved.', hostArchived: '{name} archived.',
  // notifications, feed and errors (guests.ts)
  'notif.booked': '{name} will lead {activity} on {date} at {slot}.', 'notif.cancelled': '{name} will not come on {date} at {slot}.',
  'notif.toPay': '{name} is booked: {amount} to pay ({number}). It can be paid before the session.', 'notif.paidCancelled': '{name}’s session was cancelled after it was paid ({amount}): ask for the money back, or keep it for another session.',
  'feed.booked': 'Guest booked: {name} · {date} {slot}', 'feed.cancelled': 'Guest cancelled: {name} · {date} {slot}', 'feed.done': 'Guest session done: {name} · {date} {slot}',
  'err.dupHost': '“{name}” is already a guest host.', 'err.hostInactive': '{name} is not active. Switch them on first.', 'err.slotTaken': 'Another guest is already booked for that session.',
  'err.needActivity': 'Pick the activity the guest will lead.', 'err.hostBooked': '{name} still has a booking. Cancel it or mark it as done first.',
  'err.notBooked': 'This booking is no longer open.', 'err.notYet': 'It can be marked as done on the day.',
};
