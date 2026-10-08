// Shell-level strings (EN). Area namespaces live in their own files.
export const common = {
  updating: 'A new version is ready. Reloading…', somethingWrong: 'Something went wrong.', reload: 'Reload',
  close: 'Close', cancel: 'Cancel', save: 'Save', saveChanges: 'Save changes', share: 'Share', copy: 'Copy', edit: 'Edit', delete: 'Delete', remove: 'Remove', add: 'Add',
  confirm: 'Confirm', back: 'Back', backToday: 'Back to Today', seeAll: 'See all', today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', done: 'Done', search: 'Search',
  all: 'All', none: 'None', yes: 'Yes', no: 'No', other: 'Other', loading: 'Loading…', retry: 'Try again', undo: 'Undo', next: 'Next', previous: 'Previous', continue: 'Continue',
  staffOnly: 'Staff only', sharedFam: 'Shared with family', submitReview: 'Submit for review', pendingReview: 'Pending review', pendingApproval: 'Pending approval',
  reviewNote: 'Your change goes to management for approval. Until then the current details stay in effect.', changesLogged: 'Changes are logged with your name and the time.',
  required: 'Required', optional: 'Optional', notSet: 'Not set', empty: 'Nothing here yet', more: 'More', less: 'Less', show: 'Show', hide: 'Hide', call: 'Call', open: 'Open',
  noResults: 'No matches', demo: 'Demo', reason: 'Reason', note: 'Note', date: 'Date', time: 'Time', name: 'Name', phone: 'Mobile (WhatsApp)', amount: 'Amount',
  clubClosed: 'Club closed', clubClosedSub: 'The club is closed today. We open again on {date}.', weekendSub: 'Weekend: the club opens again on {date}.',
  and: 'and', by: 'by {name}', at: 'at {time}', minutesAgo: '{n} min ago', justNow: 'just now',
  // UI kit (Select, DateField, TimeField, Pager, CameraCapture, media)
  pickOne: 'Choose…', pickDate: 'Choose a date', pickMonth: 'Choose a month', pickTime: 'Choose a time', searchHere: 'Search…', clear: 'Clear',
  prevMonth: 'Previous month', nextMonth: 'Next month', prevYear: 'Previous year', nextYear: 'Next year', prevYears: 'Earlier years', nextYears: 'Later years',
  chooseMonth: 'Choose month', chooseYear: 'Choose year', hour: 'Hour', minute: 'Minute',
  pages: 'Pages', pagePrev: 'Previous page', pageNext: 'Next page', pageOf: 'Page {page} of {pages}', pageGo: 'Page {n}',
  camera: 'Camera', cameraStarting: 'Starting the camera…', cameraDenied: 'Camera access is blocked. Allow it in your browser settings, or choose a photo instead.',
  cameraNone: 'No camera was found here. Choose a photo instead.', takePhoto: 'Take photo', retake: 'Retake', usePhoto: 'Use photo', choosePhoto: 'Choose a photo',
  uploadInstead: 'Upload a photo', switchCamera: 'Switch camera', photoPreview: 'Preview of the photo', processing: 'Preparing the photo…',
  mediaType: 'Please use a JPEG, PNG or WebP photo.', mediaTooBig: 'That photo is too large (max 5 MB).', mediaFailed: 'The photo could not be uploaded.', docTooBig: 'That file is too large (max 10 MB).', docType: 'Please use a photo or a PDF file.',
};
export const status = {
  normal: 'Normal', watch: 'Watch', alert: 'Alert', paid: 'Paid', outstanding: 'Outstanding', overdue: 'Overdue', pending: 'Check pending', partial: 'Part paid', void: 'Void',
  approved: 'Approved', rejected: 'Rejected', requested: 'Requested', received: 'Received', declined: 'Declined', cancelled: 'Cancelled', open: 'Open', answered: 'Answered', closed: 'Closed',
  suspended: 'Suspended · unpaid', onLeave: 'On leave · {month}',
};
export const nav = {
  arrivals: 'Arrivals', enquiries: 'Enquiries', members: 'Members', health: 'Health checks', readings: 'Readings', today: 'Today', camera: 'Camera', log: 'Daily log',
  menu: 'Menu', feedback: 'Feedback', stock: 'Stock', billing: 'Billing', payments: 'Payments', budget: 'Budget', receipts: 'Receipts', overview: 'Overview', broadcast: 'Broadcast',
  calendar: 'Calendar and schedule', calShort: 'Calendar', people: 'People', photos: 'Photos', healthF: 'Health', venue: 'Venue', more: 'More', directory: 'Directory', contacts: 'Contacts',
  surveys: 'Surveys', plans: 'Plans and pricing', reviews: 'Approvals', requests: 'Requests',
  g_front: 'Front desk', g_care: 'Care', g_kitchen: 'Kitchen', g_finance: 'Finance', g_club: 'Club', allModules: 'All modules',
  // short labels for the phone bottom bar
  s_overview: 'Home', s_arrivals: 'Arrivals', s_enquiries: 'Leads', s_members: 'Members', s_health: 'Checks', s_readings: 'Trends', s_today: 'Today', s_camera: 'Camera',
  s_log: 'Log', s_menu: 'Menu', s_feedback: 'Feedback', s_stock: 'Stock', s_billing: 'Bills', s_payments: 'Pay', s_budget: 'Budget', s_receipts: 'Receipts', s_directory: 'Contacts',
  s_calendar: 'Calendar', s_calShort: 'Calendar', s_photos: 'Photos', s_healthF: 'Health', s_more: 'More', s_requests: 'Requests', s_reviews: 'Approvals', s_contacts: 'Contacts',
  // KC round 7
  renewals: 'Renewals', tasks: 'Tasks', guests: 'Guest hosts', insights: 'Visit insights', memories: 'Memories', report: 'Daily report', s_report: 'Report', s_renewals: 'Renewals', s_tasks: 'Tasks', s_guests: 'Guests', s_insights: 'Insights', s_memories: 'Memories',
};
export const roles = {
  lobby: 'Lobby', nurse: 'Nurse', activity: 'Activity teacher', kitchen: 'Kitchen & F&B', finance: 'Finance', mgmt: 'Management', family: 'Family', housekeeping: 'Housekeeping', driver: 'Driver',
  lands_lobby: 'Arrivals board', lands_nurse: 'Health station', lands_activity: "Today's activity", lands_kitchen: 'Menu of the day', lands_finance: 'Billing board', lands_mgmt: 'Arrivals board',
  lands_family: 'Today page', lands_housekeeping: 'Requests', lands_driver: 'Requests', billing: 'billing',
};
export const login = {
  signIn: 'Sign in', welcome: 'Welcome', loginSub: 'One sign-in for the club team and for families. Use your username and password.',
  username: 'Username', password: 'Password', showPassword: 'Show password', hidePassword: 'Hide password',
  errEmpty: 'Enter your username and password.', errInvalid: 'That username or password is not right. Check both and try again.',
  pending: 'Your access is waiting for the club’s approval. We’ll let you know on WhatsApp.', noAccess: 'This account has no app access yet. Ask the club to switch it on.',
  forgot: 'Forgot your password? Ask the club manager to reset it.', demoHint: 'Demo: first name in lowercase · password {pw}',
  demoAccounts: 'Demo accounts', demoAccountsSub: 'Tap an account to sign in without a password.', tagline: 'Adding years to life, and life to years.',
  philosophy: 'More hospitality, less hospital', photoPh: 'Photo: members with family in the garden room', footer: 'A Living Well Seniors Communities clubhouse · open Monday to Friday, 08:30–16:30', photoAlt: 'A member and her daughter, smiling together',
  club: 'CitraPremier | Premium Seniors Club',
  // account sheet: sign-in name and password
  signInSection: 'Sign-in', usernameFixed: 'Your username can’t be changed.', changePassword: 'Change password', currentPassword: 'Current password', newPassword: 'New password',
  confirmPassword: 'Confirm new password', passwordHint: 'At least {n} characters.', errCurrent: 'Your current password is not right.', errShort: 'Use at least {n} characters.',
  errLong: 'Use at most {n} characters.', errSame: 'Choose a password that is different from the current one.', errMismatch: 'The two new passwords don’t match.', passwordChanged: 'Your password is changed.',
  // management: reset someone's password to the default
  resetPassword: 'Reset password', resetConfirm: 'Set {name}’s password back to the default?', resetDone: '{name}’s password is back to the default ({pw}).',
};
export const shell = {
  account: 'Account', signOut: 'Sign out', language: 'Language', languageName: 'Language · Bahasa', profile: 'Your details', yourName: 'Your name', yourPhone: 'Your mobile number',
  profileSaved: 'Your details are saved.', profileSubmitted: 'Sent to the club for approval. Your current details stay until then.', clubhouse: 'Clubhouse', switchClub: 'Switch clubhouse',
  clubNote: '{m} members · {s} staff', openingNote: 'Opening 2027', notifications: 'Notifications', needsAction: 'Needs action', updates: 'Updates', markAllRead: 'Mark all as read',
  nothingAction: 'Nothing needs your attention right now.', nothingUpdates: 'No updates yet.', bell: 'Notifications, {n} new', live: 'Live',
  offline: 'Offline. Changes will sync when the connection is back.', reconnecting: 'Reconnecting…', changeFailed: 'That didn’t save: {reason}', menu: 'Menu',
};
export const notif = {
  checkedIn: '{name} checked in at {time}.', checkedOut: '{name} checked out at {time}.', newPhotos: '{n} new photos of {name}.', logSaved: '{name}’s daily log is ready: {mood}.',
  paymentReceived: 'Payment received from {name} for {invoice}.', reviewSubmitted: '{who} sent a change for review ({section}).', reviewFlagged: '{who} changed health details ({section}). Applied; please review.',
  reviewApproved: 'Your change was approved ({section}).', reviewRejected: 'Your change was not approved ({section}): {note}', reviewReverted: 'Management reverted your change ({section}).',
  // derived "needs action" items
  'act.review': 'Change to review: {name} · {section}', 'act.reviewFlagged': 'Health change applied, please review: {name} · {section}', 'act.alertReading': 'Alert reading: {name} · {value}',
  'act.contract': 'Contract ends {date}: {name}', 'act.complaint': 'Open meal feedback: {name} · {dish}', 'act.overdue': 'Overdue invoice: {name} · {number}', 'act.budgetApprove': 'Budget request to approve: {item}',
  'act.receiptApprove': 'Receipt to approve: {supplier}', 'act.vendorApprove': 'Vendor invoice to approve: {supplier}', 'act.invoiceRun': 'Invoice run for {month} is due', 'act.stockApprove': 'Stock request to approve: {item} ({qty})',
  'act.planRequest': '{name}: the family asks to switch to {plan} from {date}', 'act.guestTrial': 'Trial guest arriving {time}: {name}', 'act.guestTrialDay': 'Trial day today: {name}', 'act.photosReview': 'Photos waiting for your approval: {n}', 'act.approvalsLogs': 'Daily logs and notes waiting for approval: {n}', 'act.approvalsReadings': 'Health readings waiting for approval: {n}', 'act.approvalsMenu': 'Menu changes waiting for approval: {n}', 'act.guestVisit': 'Visit at {time}: {name}', 'act.readyCheckout': 'Departure check done: {name} is ready to go home',
  'act.queue': '{n} waiting at the health station', 'act.logs': '{n} daily logs still to write', 'act.allergen': 'Allergy clash at lunch: {name} · {dish}',
  'act.invoiceDue': 'Invoice to pay: {name} · {number}', 'act.invoiceOverdue': 'Overdue invoice: {name} · {number}', 'act.survey': 'Tell us how we are doing: {title}', 'act.docRequested': 'Document requested for {name}',
};
export const feed = {
  planRequested: '{name}: the family asked to switch to {plan}', planWithdrawn: '{name}: the family withdrew a plan request',
  checkedIn: '{name} checked in', checkedOut: '{name} checked out', memberCreatedForm: 'Member record created from the membership form', reading: 'Reading for {name}: {value}',
  reviewApproved: 'Change approved ({section})', reviewReverted: 'Change reverted ({section})',
};
export const err = {
  planRequestPending: 'A plan change is already waiting for the club.', planRequestEnding: 'This membership is ending, so the plan can’t change.', planRequestDone: 'The club has already handled this request.',
  unknownAction: 'That action isn’t available.', forbidden: 'You don’t have permission to do that.', notFound: 'That record no longer exists.', noChanges: 'Nothing changed.',
  reviewNotPending: 'This change was already handled.', reviewConflict: 'The details changed since this was submitted ({fields}). Review again or approve anyway.', noteRequired: 'Please add a note.',
  memberPending: 'This member is still waiting for management approval.', memberNotActive: 'This membership isn’t active today.', alreadyCheckedIn: 'Already checked in.',
  alreadyCheckedOut: 'Already checked out.', notCheckedIn: 'Not checked in yet.', network: 'No connection to the club server.', invalid: 'Please check the highlighted fields.', closedDay: 'The club is closed that day.',
  // KC round 6: the brochure's terms (suspension for an unpaid invoice, leave)
  suspended: 'Membership on hold: invoice {number} ({amount}) is still unpaid. Check in again once it is paid.', onLeave: '{name} is on leave in {month}.',
  leaveLate: 'Leave for {month} has to be asked for in writing 14 days before the end of the month before: by {deadline}. That day has passed.', leaveAlready: 'There is already leave for {month}.',
  leaveMax: 'Leave can be at most {max} months in a row.', leaveEnding: 'This membership is ending or has ended, so leave can’t be asked for.', leaveLocked: 'This leave is confirmed: it could be taken back until {deadline}.',
};
export const review = {
  newMember: 'New member', conversion: 'Lead joining', details: 'Details', plan: 'Plan', docsConsent: 'Documents and consent', family: 'Family contacts', allergies: 'Allergies', medicines: 'Medicines', care: 'Care instructions',
};
export const demo = {
  pill: 'Demo', title: 'Demo tools', guided: 'Guided demo', guidedTitle: 'Oma Lina’s day', progress: '{n} of {total} steps done', switchAccount: 'Switch account',
  's1.title': 'Face check-in at the door', 's1.sub': 'Oma Lina drops in. The door camera recognises her, the lobby confirms, and Maria and Daniel get a message. It is her 11th visit in October, so it counts as an extra day.', 's1.run': 'Show the lobby',
  's2.title': 'Health check: blood pressure a little high', 's2.sub': 'Ns. Dewi reads the PC-303: 152/94. She notes the right arm, shares it with the family and plans a re-check.', 's2.run': 'Open the health station',
  's3.title': 'Solo and group photos', 's3.sub': 'Dinar takes photos at keroncong. Ega approves them in Reviews, then each family sees only their own member.', 's3.run': 'Take the photos',
  's4.title': 'Lunch photo from the kitchen', 's4.sub': 'Chef Agus posts today’s lunch; once management approves it, families see it on their Today page; Bapak Bambang’s fish allergy plan is on the kitchen board.', 's4.run': 'Post the lunch photo',
  's5.title': 'Daily log: ate half of lunch', 's5.sub': 'Dinar writes Oma Lina’s log. It feeds “From the team” on Maria’s Today page.', 's5.run': 'Write the log',
  's6.title': 'Departure check and home time', 's6.sub': 'A second blood pressure before she leaves (134/84), then the lobby checks her out. The family is told.', 's6.run': 'Check her out',
  's7.title': 'Maria opens Today', 's7.sub': 'Maria reads the day, the team’s log and the photos on her Today page.', 's7.run': 'Open Maria’s Today',
  's8.title': 'Maria sees the extra visit', 's8.sub': 'Flex includes 10 visits a month. Oma Lina has used all 10 in October, so today is an extra day (Rp 650,000) on the November invoice.', 's8.run': 'Open Maria’s plan',
  's9.title': 'November invoice, paid by virtual account', 's9.sub': 'Finance issues November’s invoices early, with today’s extra day. Maria pays by DOKU virtual account; it syncs to Xero.', 's9.run': 'Issue and pay', 's9.alt': 'Show the finance board',
  's10.title': 'Management’s live board', 's10.sub': 'Ega starts on Arrivals: who is in the club right now, with Reviews and the bell showing what waits for her.', 's10.run': 'Open Arrivals',
  's11.title': 'Set the extra-day price', 's11.sub': 'The brochure’s prices are in. Only the extra-day price is still marked as a sample. Ega sets the real price; it applies from the next invoice run.', 's11.run': 'Open plans and pricing',
  reset: 'Reset demo data', resetDone: 'Demo data reset to 09:58.', resetConfirm: 'Reset every change made in this demo? Everyone using the app sees the reset.', designSystem: 'Design system', clock: 'Club clock',
};
export const inv = {
  'line.flex': 'Flex plan · {month}', 'line.gold': 'Gold plan · {month}', 'line.extra': 'Extra days · {month} ({n})', 'line.credit': 'Account credit', 'line.venue': 'Venue booking', 'line.leave': 'Leave (cuti) · {month}', 'line.registration': 'Registration fee',
};
