// enq strings (EN): the enquiries board, lead dialogs, visits, trials, joining, the form link.
export const enq = {
  'stage.new': 'New', 'stage.visit': 'Visit', 'stage.trial': 'Trial booked', 'stage.joined': 'Joined', 'stage.lost': 'Lost',
  'next.none': 'No next step', 'next.callBack': 'Call back', 'next.sendPrices': 'Send prices', 'next.visit': 'Visit', 'next.trial': 'Trial day', 'next.followUp': 'Follow up', 'next.starts': 'Starts', 'next.custom': 'Next step',
  'lost.price': 'Price', 'lost.distance': 'Too far away', 'lost.notReady': 'Not ready yet', 'lost.otherPlace': 'Chose another place', 'lost.health': 'Care needs too high', 'lost.other': 'Other reason',
  src_referral: 'Referral', src_instagram: 'Instagram', src_website: 'Website', src_walkIn: 'Walk-in', src_other: 'Other',
  rel_daughter: 'Daughter', rel_son: 'Son', rel_daughterInLaw: 'Daughter-in-law', rel_sonInLaw: 'Son-in-law', rel_granddaughter: 'Granddaughter', rel_grandson: 'Grandson', rel_grandchild: 'Grandchild',
  rel_spouse: 'Spouse', rel_sibling: 'Brother or sister', rel_other: 'Other',
  form_sent: 'Form sent', form_opened: 'Form opened', form_draft: 'Form in progress', form_ready: 'Form ready to review', form_returned: 'Returned for changes', form_approved: 'Form approved',

  // ----- board -----
  intro: 'Move a card with its button, or drag it. Trials are booked at least one day ahead. Joining copies everything into a new member record.',
  stageLabel: 'Stage',
  pgColumn: '{stage} pages', pgArchived: 'Archived lead pages', newLead: 'New lead', archivedN: 'Archived · {n}', archivedTitle: 'Archived leads', restore: 'Restore', restored: '{name} is back on the board.', archive: 'Archive', archived: '{name} archived.',
  nobody: 'Nobody at this stage.', dropHere: 'Drop a card here', trialHint: 'Booked at least 1 day ahead', moveTo: 'Move to', reschedule: 'Change the {stage} time', alreadyMember: '{name} is already a member.',
  moved: '{name} moved to {stage}.', reopened: '{name} is back as an open lead.',
  bookVisit: 'Book visit', bookTrial: 'Book trial', join: 'Join', openProfile: 'Open profile', reopen: 'Reopen', reviewForm: 'Review form', viewForm: 'View form', sendForm: 'Send form link',
  formLink: 'Form link', fillAsFamily: 'Fill as family (demo)', changeTime: 'Change time', changeDay: 'Change day', searchLabel: 'Search by name', searchPh: 'Senior or contact name', noMatch: 'No leads match “{q}”.', noMatchShort: 'No match', lostAction: 'Lost', editLead: 'Edit lead',

  // ----- lead dialog -----
  newEyebrow: 'New lead', editEyebrow: 'Edit lead', fSenior: 'Who is it for?', fSeniorTitle: 'Title', fSeniorName: 'Name', fContact: 'Who is asking?', fContactName: 'Contact person',
  fRelation: 'Relationship', fSource: 'How did they hear of us?', fNotes: 'Notes', addLead: 'Add lead', leadCreated: 'Lead added: {name}.', leadSaved: 'Lead saved.',

  // ----- visit and trial -----
  visitTitle: 'Book a visit', visitChange: 'Change the visit', trialTitle: 'Book a trial day', trialChange: 'Change the trial day',
  visitText: 'Pick the day and time. {contact} gets the details on WhatsApp (demo).',
  trialText: 'A trial is a day pass with lunch and a health check. Book it at least one day ahead so the kitchen and the nurse can prepare. {contact} gets a WhatsApp confirmation with the day and what to bring (demo).',
  pickDay: 'Day', otherDate: 'Another date', pickTime: 'Time', otherTime: 'Another time', pickDayTime: 'Pick a day and time', bookVisitFor: 'Book visit · {date}, {time}', bookTrialFor: 'Book trial · {date}', pickADay: 'Pick a day', trialPass: 'Lunch and a health check are included.',
  visitBooked: 'Visit booked for {name}: {date}, {time}. {contact} got the details on WhatsApp (demo).', trialBooked: 'Trial booked for {name}: {date}. {contact} got the details on WhatsApp (demo).',
  prefilled: 'Health details are filled in from the family’s form.', foodAllergies: 'Food allergies', notKnown: 'Not known yet', foodHint: 'If you don’t know yet, the kitchen is asked to find out before lunch.',
  mobility: 'Mobility aid', diet: 'Diet',

  // ----- review the form -----
  rv_eyebrow: 'Step 1 of 2 · Online form · sent {date}', rv_eyebrowDone: 'Online form · approved', rv_details: 'Details', rv_dob: 'Date of birth', rv_address: 'Address', rv_by: 'Filled in by',
  rv_docs: 'Documents', rv_nannyKtp: 'Nanny’s KTP · {name}', rv_noNanny: 'No nanny', rv_healthPhoto: 'Health-info photo', rv_signature: 'E-signature', rv_missing: 'missing', rv_health: 'Health',
  rv_conditions: 'Conditions', rv_meds: 'Medicines', rv_food: 'Food allergies', rv_drugs: 'Medicine allergies', rv_mobility: 'Mobility aid', rv_diet: 'Diet', rv_consent: 'Consent',
  rv_consentData: 'Use of information', rv_consentFace: 'Face recognition', rv_agreed: 'Agreed', rv_notGiven: 'Not given', rv_declined: 'Declined · lobby checks in by name', rv_approveJoin: 'Approve and join',
  rv_return: 'Return for changes', rv_sendBack: 'Send back', rv_note: 'What should the family change?', rv_noteHint: '{name} gets this on WhatsApp (demo) and can fix the form from the same link.',
  rv_approvedNote: 'This form is approved.', rv_step2: 'Step 2 of 2 · Plan and first day', rv_backForm: 'Back to the form',
  rv_joinIntro: 'Approving the form joins {name} as a member. Pick a plan and a first day. This creates the member record and {contact}’s family login.',
  rv_createBtn: 'Approve and create member · {plan}', rv_sendBtn: 'Approve and send to management · {plan}', rv_joinedNote: 'This form is approved and became {name}’s member record.',
  rv_joinedPending: 'Approved. The new member waits for management to approve before the family can sign in.',
  formReturned: 'Returned. {name} got your note on WhatsApp (demo).',

  // ----- join -----
  jn_eyebrow: 'Join as a member', jn_fromForm: 'From the online form', jn_fromEnquiry: 'From the enquiry', jn_member: 'Member', jn_contact: 'Billing contact', jn_allergies: 'Allergies',
  jn_docs: 'Documents', jn_nannyKtp: 'nanny’s KTP', jn_healthPhoto: 'health photo', jn_signedForm: 'signed form', jn_noRetype: 'Nothing to retype. These details become the member record.',
  jn_noForm: 'No online form yet. The record starts with these details and fills in when the family sends the form.', plan: 'Plan', jn_visits: '{n} visits a month', jn_visitsOne: '{n} visit a month', start: 'Start',
  createMember: 'Create member · {plan}', sendForApproval: 'Send to management · {plan}', joinReviewNote: 'Your request goes to management. The member becomes active, and the family can sign in, once they approve.',
  joined: '{name} is now a member, starting {date}. A family login was created for {contact}.', joinSent: '{name} is waiting for management approval. The family can sign in once it is approved.',

  // ----- lost, link -----
  lostEyebrow: 'Mark as lost', reason: 'Reason', lostBtn: 'Mark as lost', markedLost: '{name} moved to Lost.',
  linkEyebrow: 'Membership form link', linkSent: 'Link sent to {contact} on WhatsApp ({phone}) (demo). Copy it to share another way.', linkLabel: 'Link to the form', copyLink: 'Copy link', copied: 'Link copied.',
  sendWa: 'Send on WhatsApp (demo)', waSent: 'Sent to {contact} on WhatsApp (demo).', linkNote: 'Anyone with the link can fill in the form. It saves as they go, in English or Bahasa Indonesia.',
  formSent: 'Membership form link ready for {contact}.',

  // ----- errors -----
  'err.tooSoon': 'Trials are booked at least one day ahead.', 'err.past': 'That day has passed.', 'err.pastTime': 'That time has passed today.', 'err.outing': 'That is an outing day, so nobody is at the club.',
  'err.hours': 'Choose a time while the club is open ({open}–{close}).', 'err.alreadyMember': 'This lead is already a member.', 'err.notOpen': 'Reopen this lead first.',
  'err.reopenFirst': 'Reopen this lead before moving it.', 'err.notLost': 'Only lost leads can be reopened.', 'err.noPhone': 'This contact has no mobile number.',
  'err.formReady': 'The family already sent this form. Review it instead.', 'err.formApproved': 'This form is already approved.', 'err.notReady': 'This form is not ready to review.',
  'err.inReviews': 'Management reviews documents and consent for existing members in Reviews.',
  'err.approveViaJoin': 'Approve this form by joining the member: pick a plan and a first day.', 'err.startPast': 'The start date cannot be in the past.',

  // ----- activity feed -----
  'feed.leadAdded': 'New lead · {name}', 'feed.moved_new': '{name} moved back to New', 'feed.moved_visit': '{name} moved to Visit', 'feed.moved_trial': '{name} moved to Trial booked',
  'feed.visitBooked': 'Visit booked · {name} · {date} {time}', 'feed.trialBooked': 'Trial booked · {name} · {date}', 'feed.lost': '{name} marked as lost', 'feed.reopened': '{name} reopened',
  'feed.archived': '{name} archived', 'feed.formSent': 'Membership form link sent · {name}', 'feed.formSubmitted': 'Membership form ready to review · {name}', 'feed.formApproved': 'Membership form approved · {name}',
  'feed.formReturned': 'Membership form returned for changes · {name}', 'feed.joined': '{name} joined as a member ({plan}), starting {date}',
  'feed.joinPending': '{name} was added from an enquiry and is waiting for management approval', 'feed.joinRejected': '{name}’s joining was not approved; the lead is back on the board',

  // ----- notifications (updates) -----
  'notif.newLead': 'New lead: {name}', 'notif.welcome': 'Welcome to CitraPremier! {name} starts on {date}.', 'notif.trialLunch': 'Trial lunch on {date}: {name}.',
  'notif.trialLunchAllergy': 'Trial lunch on {date}: {name}. Food allergy noted: check the plan.',
  'notif.trialLunchUnknown': 'Trial lunch on {date}: {name}. Food allergies not known yet: ask the family.', 'notif.trialHealth': 'Trial guest on {date}: {name}. Arrival check needed.',
};
