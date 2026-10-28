// enq strings (EN): the enquiries board, lead dialogs, visits, trials, joining with the signed paper form.
export const enq = {
  'stage.new': 'New', 'stage.visit': 'Visit', 'stage.trial': 'Trial booked', 'stage.joined': 'Joined', 'stage.lost': 'Lost',
  'next.none': 'No next step', 'next.callBack': 'Call back', 'next.sendPrices': 'Send prices', 'next.visit': 'Visit', 'next.trial': 'Trial day', 'next.followUp': 'Follow up', 'next.starts': 'Starts', 'next.custom': 'Next step',
  'lost.price': 'Price', 'lost.distance': 'Too far away', 'lost.notReady': 'Not ready yet', 'lost.otherPlace': 'Chose another place', 'lost.health': 'Care needs too high', 'lost.other': 'Other reason',
  src_referral: 'Referral', src_instagram: 'Instagram', src_website: 'Website', src_walkIn: 'Walk-in', src_other: 'Other',
  rel_daughter: 'Daughter', rel_son: 'Son', rel_daughterInLaw: 'Daughter-in-law', rel_sonInLaw: 'Son-in-law', rel_granddaughter: 'Granddaughter', rel_grandson: 'Grandson', rel_grandchild: 'Grandchild',
  rel_spouse: 'Spouse', rel_sibling: 'Brother or sister', rel_other: 'Other',

  // ----- board -----
  intro: 'Move a card with its button, or drag it. Trials are booked at least one day ahead. Joining copies everything into a new member record.',
  stageLabel: 'Stage',
  // ----- lead history (round 13) -----
  viewBoard: 'Leads', viewHistory: 'History', viewLabel: 'View',
  'hist.opened': 'Opened', 'hist.visited': 'Visit booked', 'hist.trial': 'Trial booked', 'hist.joined': 'Joined', 'hist.lost': 'Lost', 'hist.leads': 'Leads ({n})', 'hist.back': 'Back to {stage}',
  'hist.none': 'No leads this month', 'hist.monthsLabel': 'Leads by month', 'hist.opened_n': '{n} opened', 'hist.convCaption': 'of leads opened in the 3 months before',
  pgColumn: '{stage} pages', pgArchived: 'Archived lead pages', newLead: 'New lead', archivedN: 'Archived · {n}', archivedTitle: 'Archived leads', restore: 'Restore', restored: '{name} is back on the board.', archive: 'Archive', archived: '{name} archived.',
  nobody: 'Nobody at this stage.', dropHere: 'Drop a card here', trialHint: 'Booked at least 1 day ahead', moveTo: 'Move to', reschedule: 'Change the {stage} time', alreadyMember: '{name} is already a member.',
  moved: '{name} moved to {stage}.', reopened: '{name} is back as an open lead.',
  bookVisit: 'Book visit', bookTrial: 'Book trial', join: 'Join', openProfile: 'Open profile', reopen: 'Reopen',
  changeTime: 'Change time', changeDay: 'Change day', searchLabel: 'Search by name', searchPh: 'Senior or contact name', noMatch: 'No leads match “{q}”.', noMatchShort: 'No match', lostAction: 'Lost', editLead: 'Edit lead',

  // ----- lead dialog -----
  newEyebrow: 'New lead', editEyebrow: 'Edit lead', fSenior: 'Who is it for?', fSeniorName: 'Name', fContact: 'Who is asking?', fContactName: 'Contact person',
  fRelation: 'Relationship', fSource: 'How did they hear of us?', sourceOther: 'Where from?', fNotes: 'Notes', addLead: 'Add lead', leadCreated: 'Lead added: {name}.', leadSaved: 'Lead saved.',

  // ----- visit and trial -----
  visitTitle: 'Book a visit', visitChange: 'Change the visit', trialTitle: 'Book a trial day', trialChange: 'Change the trial day',
  visitText: '{contact} gets the details on WhatsApp (demo).',
  trialText: 'A trial is 2 days in a row for {price}. Book at least one day ahead. {contact} gets a WhatsApp confirmation (demo).',
  pickDay: 'Day', otherDate: 'Another date', pickTime: 'Time', otherTime: 'Another time', pickDayTime: 'Pick a day and time', bookVisitFor: 'Book visit · {date}, {time}', bookTrialFor: 'Book trial · {date} and {date2} · {price}', pickADay: 'Pick a day', trialPass: 'Two days in a row, with lunch and a health check each day.', trialDays: '{a} and {b}', trialPrice: 'Trial fee {price}, paid at the front desk.',
  visitBooked: 'Visit booked for {name}: {date}, {time}. {contact} got the details on WhatsApp (demo).', trialBooked: 'Trial booked for {name}: {date} and {date2} ({price}). {contact} got the details on WhatsApp (demo).',
  foodAllergies: 'Food allergies', notKnown: 'Not known yet', foodHint: 'If you don’t know yet, the kitchen is asked to find out before lunch.',
  mobility: 'Mobility aid', diet: 'Diet',

  // ----- join -----
  jn_eyebrow: 'Join as a member', jn_fromEnquiry: 'From the enquiry', jn_member: 'Member', jn_contact: 'Billing contact', jn_allergies: 'Allergies',
  jn_regFee: 'The registration fee ({price}, one time) is on the first invoice.', jn_fromTrial: 'Allergies and needs from the trial day are filled in.',
  plan: 'Plan', jn_visits: '{n} visits a month', jn_visitsOne: '{n} visit a month', start: 'Start',
  createMember: 'Create member · {plan}', sendForApproval: 'Send to management · {plan}', joinReviewNote: 'Your request goes to management. The member becomes active, and the family can sign in, once they approve.',
  joined: '{name} is now a member, starting {date}. A family login was created for {contact}.', joinSent: '{name} is waiting for management approval. The family can sign in once it is approved.',

  // ----- lost -----
  lostEyebrow: 'Mark as lost', reason: 'Reason', lostBtn: 'Mark as lost', markedLost: '{name} moved to Lost.',

  // ----- errors -----
  'err.tooSoon': 'Trials are booked at least one day ahead.', 'err.past': 'That day has passed.', 'err.pastTime': 'That time has passed today.', 'err.outing': 'That is an outing day, so nobody is at the club.',
  'err.hours': 'Choose a time while the club is open ({open}–{close}).', 'err.alreadyMember': 'This lead is already a member.', 'err.notOpen': 'Reopen this lead first.',
  'err.reopenFirst': 'Reopen this lead before moving it.', 'err.notLost': 'Only lost leads can be reopened.',

  'err.titleRequired': 'Title is needed.', 'err.startPast': 'The start date cannot be in the past.',

  // ----- activity feed -----
  'feed.leadAdded': 'New lead · {name}', 'feed.moved_new': '{name} moved back to New', 'feed.moved_visit': '{name} moved to Visit', 'feed.moved_trial': '{name} moved to Trial booked',
  'feed.visitBooked': 'Visit booked · {name} · {date} {time}', 'feed.trialBooked': 'Trial booked · {name} · {date}', 'feed.lost': '{name} marked as lost', 'feed.reopened': '{name} reopened',
  'feed.archived': '{name} archived',
  'feed.joined': '{name} joined as a member ({plan}), starting {date}',
  'feed.joinPending': '{name} was added from an enquiry and is waiting for management approval', 'feed.joinRejected': '{name}’s joining was not approved; the lead is back on the board',

  // ----- notifications (updates) -----
  'notif.newLead': 'New lead: {name}', 'notif.welcome': 'Welcome to CitraPremier! {name} starts on {date}.', 'notif.trialLunch': 'Trial lunch on {date}: {name}.',
  'notif.trialLunchAllergy': 'Trial lunch on {date}: {name}. Food allergy noted: check the plan.',
  'notif.trialLunchUnknown': 'Trial lunch on {date}: {name}. Food allergies not known yet: ask the family.', 'notif.trialHealth': 'Trial guest on {date}: {name}. Arrival check needed.',
  // registration is on paper
  regAttached: 'Registration form attached', regMissing: 'Registration form missing', 'err.formRequired': 'Attach the signed registration form to join.',
  jn_paperNote: 'Type the key details from the paper form. Attach a photo or PDF of the signed form to join.',

  // ----- KC round 10: the online registration link -----
  sendForm: 'Send form link', formLinkEyebrow: 'Online registration', formLinkIntro: 'The family fills in the registration on their phone. The answers come back to this lead and fill in the Join step. The signed paper form is still needed at the club.',
  formLinkLabel: 'Link', formLinkCopy: 'Copy link', formLinkCopied: 'Link copied.', formLinkWa: 'Send on WhatsApp', formLinkAgain: 'Send a new link', formLinkMaking: 'Preparing the link…',
  formLinkWaText: 'Hello {contact}, here is the CitraPremier registration form for {name}. Please fill it in before your visit: {link}',
  formState_sent: 'Form sent', formState_opened: 'Form opened', formState_submitted: 'Form filled in', formState_inProgress: 'In progress · step {n} of 5',
  formState_expired: 'Form link expired',
  formSentOn: 'Sent {date} · valid until {until}', formOpenedOn: 'Opened {date} · valid until {until}', formExpiredOn: 'The link expired on {until}.', formFilledBy: 'Filled in online by {name} on {date}',
  formSavedOn: 'Filling it in: step {n} of 5, saved {date} · valid until {until}',
  formOpenJoin: 'Open in Join', jn_fromOnline: 'From the online form', formSentToast: 'Form link ready for {contact}.',
  'err.formConflict': 'This form was continued on another phone. Choose which answers to keep.', 'err.formDone': 'The family has already sent this form. Open Join to use the answers.', 'err.formExpired': 'This link has expired. Ask the club for a new one.',
  'feed.formSent': 'Registration form link sent · {name}', 'feed.formSubmitted': 'Registration form filled in online · {name}',
  'feed.formSaved': 'Registration form started online · {name}',
  'notif.formSubmitted': '{by} filled in the registration form for {name} online.',
  // the public page
  pf_tab: 'Registration', pf_eyebrow: 'Membership registration', pf_intro: 'Fill this in before your visit. It takes about five minutes and saves the front desk retyping it. At the club you will sign the printed form.',
  pf_who: 'Who is joining', pf_contact: 'Family contact', pf_plan: 'Plan you lean to', pf_planUnsure: 'Not sure yet', pf_paperNote: 'The signed paper form is still needed: the club prints it from these answers for you to sign.',
  pf_submit: 'Send to the club', pf_sending: 'Sending…', pf_thanksTitle: 'Thank you, {name}', pf_thanksText: 'Your answers reached the club. Bring your KTP and the family card on the first day; the front desk has the form ready to sign.',
  pf_doneTitle: 'Already sent', pf_doneText: 'This form reached the club on {date}. To change something, ask the front desk for a new link.',
  pf_badTitle: 'This link does not work', pf_badText: 'Check the link you received, or ask the club to send it again.', pf_expiredTitle: 'This link has expired', pf_expiredText: 'Links stay open for 14 days. Ask the front desk to send a new one.',
  pf_privacy: 'Only the club sees these answers.',
  pf_conflictTitle: 'This form was continued on another phone', pf_conflictText: 'Newer answers were saved from another phone. Which should we keep?', pf_useSaved: 'Use the saved one', pf_keepMine: 'Keep this phone’s', pf_stepHealth: 'Health', pf_stepPlan: 'Plan', pf_stepReview: 'Review and send', pf_continue: 'Continue', pf_saveLater: 'Save for later', pf_saving: 'Saving…', pf_saved: 'Saved. You can close this page and carry on later from the same link.', pf_saveFailed: 'Could not save to the club just now. Your answers are kept on this phone.', pf_resumed: 'Welcome back: carrying on where you left off.', pf_reviewIntro: 'Check your answers, then send them to the club.', pf_none: 'None',
};
