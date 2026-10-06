// mgmt strings (EN): overview, broadcast, venue, surveys, plans and pricing.
export const mgmt = {
  // ----- overview -----
  tileInClubNow: 'In the club now', tileGoneHome: 'Gone home', tileVisits: 'Visits today', tileExtra: 'Extra visits this month', tileReview: 'To review', toWatch: '{n} to watch', allNormal: 'All normal', tileOverdue: 'Overdue invoices', tileSurvey: 'Survey · overall', noAnswers: 'No answers yet', nAnswers: '{n} answers', nAnswersOne: '{n} answer',
  tilePhotos: 'Photos sent today', tileLogs: 'Daily logs saved', tileLunch: 'Lunch photo', posted: 'Posted', notYet: 'Not yet', tilePayments: 'Payments today', tileUnread: 'Unread messages',
  tileStock: 'Stock to approve', tileVenue: 'Venue bookings ahead', sample: 'Sample', priceSet: 'Set', samplePrices: 'Sample prices', clubPrices: 'Club prices',
  emptyClub: '{club} has no members or staff yet. Anything you add here stays separate from your other clubhouses.',
  listLive: 'Live today', newestFirst: 'newest first', liveEmptyMeta: 'actions appear here as they happen', liveEmpty: 'Nothing has happened yet today.', whoSystem: 'Automatic', whoDoor: 'Door camera',
  listUp: 'Coming up', upEmpty: 'Nothing planned yet.', upVenue: 'Private event: {org}', upTrial: 'Trial day: {name}', upVisit: 'Visit: {name}',
  listReq: 'Requests from families', noApproval: 'no approval needed', reqEmpty: 'No requests from families right now.',
  reqUpgrade: 'Change to {to} from {date}', plan_flex: 'Flex', plan_gold: 'Gold', enqEmpty: 'No open enquiries.',

  // ----- broadcast -----
  bcEyebrow: 'WhatsApp templates', audience: 'Audience', aud_families: 'Families', aud_enquiries: 'Enquiries', aud_staff: 'Staff', noRecipients: 'Nobody to message yet in this selection.',
  template: 'Template', editTemplates: 'Edit templates', message: 'Message', ph_update: 'Our new garden room opens on Monday.', ph_closure: 'Friday 30 October, for staff first-aid training',
  ph_event: 'batik museum outing, Thursday 26 November', ph_custom: 'Write your message.', when: 'When', whenNow: 'Send now', whenTom: 'Tomorrow, 08:00', whenCustom: 'Pick a date and time',
  sendTo: 'Send to {n} people', scheduleFor: 'Schedule for {n} people', sendToOne: 'Send to {n} person', scheduleForOne: 'Schedule for {n} person', stopEditing: 'Stop editing', bcEditing: 'You are editing a scheduled message. Save to keep the changes.',
  previewFor: 'Preview for {name} · template “{tpl}”', previewNobody: 'The preview appears when the audience has someone in it.', previewPick: 'Preview as', openApp: 'Open the CitraPremier app',
  simNote: 'Demo: WhatsApp messages are simulated.', sentAndScheduled: 'Sent and scheduled', bcEmpty: 'No broadcasts yet.', nPeople: '{n} people', nPeopleOne: '{n} person', scheduledFor: 'Scheduled · {when}', sentOn: 'Sent {when}',
  wasFor: 'Cancelled · was {when}', st_sent: 'Sent', st_scheduled: 'Scheduled', st_cancelled: 'Cancelled', cancelSend: 'Cancel send',
  bcSentToast: 'Sent to {n} people on WhatsApp (demo).', bcSentToastOne: 'Sent to {n} person on WhatsApp (demo).', bcScheduledToast: 'Scheduled for {when}.', bcCancelled: 'Scheduled message cancelled.', bcUpdated: 'Scheduled message updated.',
  tplTitle_update: 'Club update', tplTitle_closure: 'Club closed', tplTitle_event: 'Event invitation', tplTitle_custom: 'Message',
  tplText_update: 'Hello {name}, news from CitraPremier: {msg}', tplText_closure: 'Hello {name}, a reminder that CitraPremier is closed on {msg}. We open again on the next working day at 08:30.',
  tplText_event: 'Hello {name}, you are invited: {msg}. Reply YES to save a place.',
  tplName: 'Template name', tplBody: 'Message text', tplHint: 'Use {name} for the first name of the person and {msg} for what you type each time.', tplNew: 'New template', tplNewText: 'Hello {name}, {msg}',
  tplSaved: 'Template saved.', tplRemoved: 'Template removed.', tplConfirmRemove: 'Remove template',

  // ----- venue -----
  vnEyebrow: 'Outside events', vnTitle: 'Venue bookings', vnNew: 'New booking', vnBooking: 'Booking', vnOrg: 'Organisation', vnOrgPh: 'e.g. PT Sentosa annual meeting', vnContact: 'Contact person',
  vnMobile: 'Mobile', vnGuests: 'Guests', vnDay: 'Day', vnTime: 'Time', vnFrom: 'From', vnTo: 'To', vnRoom: 'Room', vnPriceL: 'Price', vnDepositL: 'Deposit', vnOptional: 'Optional',
  vnDayOpen: 'The club is open this day. Outside events must be before {open} or after {close}.', vnDayWeekend: 'Weekend: the club is closed, so any time is free.',
  vnDayHoliday: 'National holiday: the club is closed, so any time is free.', vnDayClosed: 'The club is closed this day for its own reasons, so it cannot take bookings.',
  vnDayOuting: 'Outing day: the team and members are away, so it cannot take bookings.', vnPickDay: 'Pick a day', vnFree: 'Free', vnTaken: 'Taken', vnMembersHere: 'Members here',
  vnOutingDay: 'Outing day', vnClosedDay: 'Closure', vnGone: 'Passed', vnNotFree: 'Not free', vnNoRooms: 'No rooms can be booked for events yet. Rooms for events are set under Calendar and schedule.',
  vnHint: 'The booking blocks the club calendar for that time. On club days, outside events happen after {close}.', vnConfirm: 'Confirm booking',
  vnBooked: 'Booked. {date}, {time} is now blocked on the club calendar.', vnUpcoming: 'Upcoming', vnOnCalendar: 'on the club calendar', vnNone: 'No upcoming bookings.', vnPast: 'Past and cancelled',
  vnPastMeta: 'send the guest a review link afterwards', vnSub: '{date} · {from}–{to} · {n} guests · {room}', vnPrice: 'Price {n}', vnDeposit: 'Deposit {n}', vnInvoice: 'Invoice {ref}',
  vnConfirmed: 'Confirmed · on calendar', vnDone: 'Event done', vnAsked: 'Review link sent', vnReviewed: 'Reviewed {n}/5', vnCancel: 'Cancel booking', vnCancelTitle: 'Cancel this booking?',
  vnCancelText: '{org} on {date}. The room and the time become free again.', vnKeep: 'Keep booking', vnCancelled: 'Booking cancelled. The time is free again.', vnCreateInvoice: 'Create invoice',
  vnInvoiced: 'Invoice {ref} created (demo) and sent to finance.', vnSendReview: 'Send review link', vnAskedToast: 'Review link sent to {name} on WhatsApp (demo).', vnRecordReview: 'Record review',
  vnStars: 'Rating', vnStarsOf: '{n} of 5', vnReviewText: 'What they said', vnReviewSaved: 'Review recorded.', vnNoText: 'No comment', vnUpdated: 'Booking updated.',

  // ----- surveys -----
  svEyebrow: 'Families · satisfaction', svLiveSent: 'Live · sent {date}', svRespOf: '{n} of {total} families', svRespOfOne: '{n} of {total} family', svOverall: 'Overall', svAnswers: '{n} answers', svAnswersOne: '{n} answer', svRecommend: 'Would recommend',
  svOfAnswered: 'of families who answered', svRate: 'Response rate', svRateSub: '{n} of {total} families', svRateSubOne: '{n} of {total} family', svTeamRatings: 'Team ratings · shown in People', svRatings: '{n} ratings', svRatingsOne: '{n} rating',
  svNoRatings: 'no ratings yet', svComments: 'Comments', svDetails: 'See details', svClose: 'Close survey', svClosed: '{title} is closed.', svNew: 'New survey', svEditDraft: 'Edit draft',
  svTitle: 'Title', svTitlePh: 'e.g. November check-in', svQuestions: 'Questions', svq_overall: 'Overall satisfaction, 1 to 5', svq_team: 'Rate the team', svq_recommend: 'Would you recommend us?',
  svq_comment: 'Anything we could do better?', svTeam: 'Who can families rate?', svTeamHint: 'Pick from the staff. Ratings show in People.',
  svHint: 'Families get it on WhatsApp and answer in the app. The current survey closes when you send a new one.', svNoFamilies: 'No family has the app yet, so there is nobody to send to.',
  svSendTo: 'Send to {n} families', svSendToOne: 'Send to {n} family', svSaveDraft: 'Save draft', svSent: 'Survey sent to {n} families on WhatsApp (demo), with a link into the app.', svSentOne: 'Survey sent to {n} family on WhatsApp (demo), with a link into the app.', svDraftSaved: 'Draft saved. Edit it before sending.',
  svDrafts: 'Drafts', svDeleted: 'Draft deleted.', svEarlier: 'Earlier surveys', svPastSub: 'Sent {date} · {n} answers · {rec}% would recommend', svDetailEyebrow: 'Sent {date}', svLive: 'Live',
  svClosedBadge: 'Closed {date}', svFamilies: 'Families', svAnswered: 'Answered', svWaiting: 'Not yet',

  // ----- surveys: who gets it -----
  svAudience: 'Who gets it', svAud_all: 'All families with the app', svAud_members: 'Families of chosen members', svAud_contacts: 'Chosen people',
  svAudHint_all: 'Every family contact who can use the app.', svAudHint_members: 'Pick the members. Their family contacts who have the app get the survey.',
  svAudHint_contacts: 'Pick the family contacts yourself. Only people who have the app can be chosen.', svSearchMembers: 'Search members', svSearchContacts: 'Search family contacts',
  svSelectResults: 'Select all in the list', svClearPicked: 'Clear selection', svPickedMembers: '{n} members chosen', svPickedMembersOne: '{n} member chosen',
  svPickedContacts: '{n} people chosen', svPickedContactsOne: '{n} person chosen', svGoesTo: 'Goes to {n} families', svGoesToOne: 'Goes to {n} family',
  svNoneChosen: 'Choose who gets it before you send.', svNoMatch: 'Nobody matches your search.', svFamiliesN: '{n} families', svFamiliesNOne: '{n} family',
  svMembersN: '{n} members', svMembersNOne: '{n} member', svPeopleN: '{n} people', svPeopleNOne: '{n} person', svAudSum_all: 'All families with the app',
  svAudSum_members: 'Families of {members}', svAudSum_contacts: '{people} chosen', svSentTo: 'Sent to', svMemberFamily: 'Family: {names}', svNoContactsApp: 'no family with the app yet',

  // ----- surveys: your own questions -----
  svCustom: 'Your own questions', svCustomHint: 'Families see the text exactly as you write it. You can change, reorder or remove questions until the survey is sent.', svCustomNone: 'No questions of your own yet.',
  svAddQ: 'Add a question', svNewQ: 'New question', svEditQ: 'Edit question', svQText: 'Question', svQTextPh: 'e.g. Did you enjoy the new Thursday menu?',
  svQKind: 'Answer type', svQKind_rating: 'Stars, 1 to 5', svQKind_yesno: 'Yes or no', svQKind_choice: 'Pick one option', svQKind_text: 'Free text',
  svQKindHint_rating: 'Families tap 1 to 5 stars.', svQKindHint_yesno: 'Families answer Yes or No.', svQKindHint_choice: 'Families pick one of the options you write.', svQKindHint_text: 'Families write their own answer.',
  svQOptions: 'Options', svQOptionsPh: 'One option on each line', svQOptionsHint: 'One option per line, 2 to 8 different options.', svQOptionsN: '{n} options', svQOptionsNOne: '{n} option',
  svQRequired: 'Families must answer this', svQRequiredSub: 'They cannot send the survey without it.', svQAdd: 'Add question', svQSave: 'Save question',
  svQUp: 'Move up', svQDown: 'Move down', svQRemove: 'Remove question', svQEdit: 'Edit question', svQReqTag: 'Required', svQOptTag: 'Optional',
  svCustomCount: '{n} questions of your own', svCustomCountOne: '{n} question of your own', svQLimit: 'You can add up to {n} questions.',
  svCustomResults: 'Your questions', svResNone: 'No answers yet', pgTextAnswers: 'Answer pages',
  svPastSubOne: 'Sent {date} · {n} answer · {rec}% would recommend', svPastPlain: 'Sent {date} · {n} answers', svPastPlainOne: 'Sent {date} · {n} answer',

  // ----- plans and pricing -----
  plEyebrow: 'Club settings', plIntro: 'Prices tagged Sample are placeholders until the club confirms them. Changing a price updates the next invoice; invoices already sent keep their amounts.',
  samplePrice: 'Sample price', plFlexDesc: '{n} visits a month. A visit counts when the member checks in.', plFlexDescOne: '{n} visit a month. A visit counts when the member checks in.', plGoldDesc: 'Come on any open day, as often as you like.', plExtra: 'Extra day', plExtraDesc: 'Charged for each Flex visit beyond {n} in a month.', plExtraDescOne: 'Charged for each Flex visit beyond {n} in a month.',
  perMonth: 'Per month', perDay: 'Per day', plQuota: 'Visits', plQuotaV: '{n} visits a month', plQuotaVOne: '{n} visit a month', plUnused: 'Unused visits', plNoRoll: 'Do not roll over',
  plUnlimited: 'Unlimited', plBilled: 'Billed', plNextInvoice: 'On next month’s invoice', plCounted: 'Counted from', plCheckIns: 'Check-ins at the door', priceAria: '{name} price in rupiah',
  plRules: 'Club rules', plRulesDesc: 'Members come on any open day. This rule decides when a Flex visit is an extra day.', plQuotaL: 'Flex visits per month', plFrom: 'Takes effect from',
  plFromHint: 'Invoices already sent keep their old amounts.', plPreview: 'Next invoice preview', plPreviewFor: 'Preview for', plPreviewTitle: '{name} · invoice of {day} {month}',
  plUnsaved: 'Showing what you typed. Not saved yet.', plNothing: 'Nothing to bill for this member yet.', plTotal: 'Total', plOthers: 'Separate invoices on the same account: {others}. {payer} can pay them together.',
  plSentKeep: 'Invoices already sent keep their old amounts.', plNoMembers: 'No members yet, so there is nothing to preview.', plansSaved: 'Saved. The next invoice uses these prices and rules.',
  pgBroadcasts: 'Broadcast pages', pgTemplates: 'Template pages', pgUpcoming: 'Upcoming booking pages', pgPast: 'Past booking pages', pgDrafts: 'Draft survey pages',
  pgSurveys: 'Earlier survey pages', pgComments: 'Comment pages', pgFamilies: 'Family pages', pgPick: 'Search result pages',
  notifyTeam: 'Notify the team', notifyTeamSub: 'Finance gets a notification about the new prices.',

  // ----- errors (action codes) -----
  'err.venueClash': '{room} is already booked from {from} to {to} by {org}.', 'err.venueClubHours': 'The club is open {open}–{close} that day. Events need to be before {open} or after {close}.',
  'err.venueOuting': 'That day is an outing, so the club cannot take a booking.', 'err.venueClosed': 'The club is closed that day for its own reasons, so it cannot take a booking.',
  'err.venuePast': 'That time has already passed.', 'err.venueTimes': 'The end time must be after the start time.', 'err.venueLate': 'Events must fall between {from} and {to}.',
  'err.venueRoom': 'Choose a room that can be booked for events.', 'err.venueCancelled': 'That booking is cancelled.', 'err.venueDone': 'That event has already happened.',
  'err.venueNotDone': 'The event has not happened yet.', 'err.venueReviewed': 'This event already has a review.', 'err.venueAsked': 'A review link was already sent.',
  'err.venuePrice': 'Add a price first.', 'err.venueInvoiced': 'This booking already has an invoice.', 'err.noRecipients': 'There is nobody to send to.', 'err.pastTime': 'Choose a time after now.',
  'err.notScheduled': 'This message was already sent or cancelled.', 'err.tplMsg': 'The text needs {msg} so that your message goes in.', 'err.tplBuiltIn': 'The built-in templates can be edited but not removed.',
  'err.teamRequired': 'Pick at least one team member to rate.', 'err.notDraft': 'Only a draft survey can be changed.', 'err.notLive': 'This survey is not open.',
  'err.alreadyAnswered': 'You have already answered this survey.', 'err.priceInvalid': 'Enter a price above zero.', 'err.pricePast': 'The start date cannot be in the past.',
  'err.quotaInvalid': 'Use a whole number from 1 to 23.', 'err.contactNoApp': 'This family cannot use the app yet, so they cannot answer a survey.',
  'err.qText': 'Write the question, up to {n} characters.', 'err.qOptions': 'Write 2 to 8 different options, one on each line.', 'err.qOptionLong': 'Keep each option under {n} characters.',
  'err.noQuestions': 'Add a question: turn on a preset or write your own.', 'err.answerRequired': 'Please answer: {q}',

  // ----- activity feed -----
  'feed.broadcast': 'Broadcast sent to {n} people', 'feed.broadcastScheduled': 'Broadcast scheduled for {n} people ({date} {time})', 'feed.broadcastCancelled': 'Scheduled broadcast cancelled',
  'feed.venueBooked': 'Venue booked · {org} · {date}', 'feed.venueUpdated': 'Venue booking changed · {org} · {date}', 'feed.venueCancelled': 'Venue booking cancelled · {org} · {date}',
  'feed.venueReviewAsked': 'Review link sent · {org}', 'feed.venueReviewed': 'Venue review recorded · {org} · {stars}/5', 'feed.venueInvoice': 'Venue invoice {ref} · {org}',
  'feed.surveySent': 'Survey sent · {title} · {n} families', 'feed.surveyClosed': 'Survey closed · {title}', 'feed.surveyAnswered': '{name} answered the survey · {overall}/5', 'feed.surveyAnsweredPlain': '{name} answered the survey',
  'feed.prices': 'Prices updated (from {date})', 'feed.rules': 'Club rules updated: Flex is {quota} visits a month',

  // ----- notifications (updates) -----
  'notif.bc_update': 'Club update: {text}', 'notif.bc_closure': 'The club is closed on {text}.', 'notif.bc_event': 'You are invited: {text}', 'notif.bc_custom': '{text}',
  'notif.broadcastSent': 'Broadcast sent to {n} people.', 'notif.venueInvoice': 'Venue invoice {ref} for {org}: {amount}.', 'notif.pricesChanged': 'Prices changed from {date}. Check the next invoice run.',
};
