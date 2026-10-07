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
  pgColumn: '{stage} pages', pgArchived: 'Archived lead pages', newLead: 'New lead', archivedN: 'Archived · {n}', archivedTitle: 'Archived leads', restore: 'Restore', restored: '{name} is back on the board.', archive: 'Archive', archived: '{name} archived.',
  nobody: 'Nobody at this stage.', dropHere: 'Drop a card here', trialHint: 'Booked at least 1 day ahead', moveTo: 'Move to', reschedule: 'Change the {stage} time', alreadyMember: '{name} is already a member.',
  moved: '{name} moved to {stage}.', reopened: '{name} is back as an open lead.',
  bookVisit: 'Book visit', bookTrial: 'Book trial', join: 'Join', openProfile: 'Open profile', reopen: 'Reopen',
  changeTime: 'Change time', changeDay: 'Change day', searchLabel: 'Search by name', searchPh: 'Senior or contact name', noMatch: 'No leads match “{q}”.', noMatchShort: 'No match', lostAction: 'Lost', editLead: 'Edit lead',

  // ----- lead dialog -----
  newEyebrow: 'New lead', editEyebrow: 'Edit lead', fSenior: 'Who is it for?', fSeniorTitle: 'Title', fSeniorName: 'Name', fContact: 'Who is asking?', fContactName: 'Contact person',
  fRelation: 'Relationship', fSource: 'How did they hear of us?', fNotes: 'Notes', addLead: 'Add lead', leadCreated: 'Lead added: {name}.', leadSaved: 'Lead saved.',

  // ----- visit and trial -----
  visitTitle: 'Book a visit', visitChange: 'Change the visit', trialTitle: 'Book a trial day', trialChange: 'Change the trial day',
  visitText: '{contact} gets the details on WhatsApp (demo).',
  trialText: 'Book at least one day ahead. {contact} gets a WhatsApp confirmation (demo).',
  pickDay: 'Day', otherDate: 'Another date', pickTime: 'Time', otherTime: 'Another time', pickDayTime: 'Pick a day and time', bookVisitFor: 'Book visit · {date}, {time}', bookTrialFor: 'Book trial · {date}', pickADay: 'Pick a day', trialPass: 'Lunch and a health check are included.',
  visitBooked: 'Visit booked for {name}: {date}, {time}. {contact} got the details on WhatsApp (demo).', trialBooked: 'Trial booked for {name}: {date}. {contact} got the details on WhatsApp (demo).',
  foodAllergies: 'Food allergies', notKnown: 'Not known yet', foodHint: 'If you don’t know yet, the kitchen is asked to find out before lunch.',
  mobility: 'Mobility aid', diet: 'Diet',

  // ----- join -----
  jn_eyebrow: 'Join as a member', jn_fromEnquiry: 'From the enquiry', jn_member: 'Member', jn_contact: 'Billing contact', jn_allergies: 'Allergies',
  plan: 'Plan', jn_visits: '{n} visits a month', jn_visitsOne: '{n} visit a month', start: 'Start',
  createMember: 'Create member · {plan}', sendForApproval: 'Send to management · {plan}', joinReviewNote: 'Your request goes to management. The member becomes active, and the family can sign in, once they approve.',
  joined: '{name} is now a member, starting {date}. A family login was created for {contact}.', joinSent: '{name} is waiting for management approval. The family can sign in once it is approved.',

  // ----- lost -----
  lostEyebrow: 'Mark as lost', reason: 'Reason', lostBtn: 'Mark as lost', markedLost: '{name} moved to Lost.',

  // ----- errors -----
  'err.tooSoon': 'Trials are booked at least one day ahead.', 'err.past': 'That day has passed.', 'err.pastTime': 'That time has passed today.', 'err.outing': 'That is an outing day, so nobody is at the club.',
  'err.hours': 'Choose a time while the club is open ({open}–{close}).', 'err.alreadyMember': 'This lead is already a member.', 'err.notOpen': 'Reopen this lead first.',
  'err.reopenFirst': 'Reopen this lead before moving it.', 'err.notLost': 'Only lost leads can be reopened.',

  'err.startPast': 'The start date cannot be in the past.',

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
};
