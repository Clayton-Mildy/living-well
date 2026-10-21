// fhealth strings (EN): family Health, history and the parent profile (round 8).
export const fhealth = {
  // ----- the Health tab -----
  title: 'Health', heroAria: 'Blood pressure history for {n}', notFound: 'We couldn’t find this person.',
  weeksAgo: '{n} weeks ago', monthsAgo: '{n} months ago', // KC round 10: an old reading says how old it is
  bpWhen_arrival: '{n}’s blood pressure on arrival', bpWhen_departure: '{n}’s blood pressure before leaving', bpWhen_recheck: '{n}’s blood pressure at the re-check',
  bpWhen_spot: '{n}’s blood pressure at a spot check', bpWhen_monthly: '{n}’s blood pressure at the monthly check',
  heroWatch: 'A little outside the usual range.', heroAlert: 'Well outside the usual range.',
  historyRow: 'Health history', profileRow: '{n}’s profile and care',
  emptyTitle: 'No health checks yet', emptyBody: 'The nurse checks blood pressure, pulse and oxygen when {n} arrives. They show up here after the first check.',
  notMeasured: 'Not measured yet',
  m_bp: 'Blood pressure', m_pulse: 'Pulse', m_spo2: 'Oxygen', m_temp: 'Temperature', m_glucose: 'Glucose', m_weight: 'Weight', m_grip: 'Grip',
  recentTitle: 'Latest readings', openFull: 'Open full page',
  s_bp: 'BP', s_temp: 'Temp',

  // ----- Health history -----
  histTitle: 'Health history', chooseMetric: 'Measurement', rangeAria: 'Time range',
  spanLine: '{a} – {b} · {n} readings', spanLineOne: '{a} – {b} · 1 reading', spanLineNone: '{a} – {b} · no readings',
  avgUnit: 'avg {u}', listTitle: 'Readings in this range', noneInRange: 'No readings in this range.',
  kind_arrival: 'on arrival', kind_departure: 'before leaving', kind_recheck: 're-check', kind_spot: 'spot check', kind_monthly: 'monthly check',
  recorded: 'Recorded', showMore: 'Show more',
  dateRange: 'Date range', pickDay: 'Pick a day', hintFrom: 'Tap the first day.', hintTo: 'Now tap the last day.', pickBoth: 'Pick a first and last day',
  qThisMonth: 'This month', qLastMonth: 'Last month', qTwoWeeks: 'Last 2 weeks', qSince: 'Since {m}',

  // ----- a parent's profile -----
  'jump.overview': 'Overview', 'jump.health': 'Health', 'jump.care': 'Care', 'jump.visits': 'Visits', 'jump.plan': 'Plan', 'jump.family': 'Family', 'jump.docs': 'Documents', 'jump.notes': 'Notes',
  jumpAria: 'Jump to a section', edit: 'Edit', suggest: 'Suggest a change',
  eyebrow: '{p} · since {d}', nextInvoice: 'Next invoice {d}', visitsGold: '{n} visits so far, any open day',
  extraLine: '{n} extra days this month · {p} on next month’s invoice', extraLineOne: '1 extra day this month · {p} on next month’s invoice',
  born: 'Born', married: 'Married',
  history: 'History', foodAllergy: 'Food allergy', drugAllergy: 'Medicine allergy', mobility: 'Mobility', diet: 'Diet', noDiet: 'No special diet',
  last10: 'Last 10 logs', noMood: 'No mood notes yet.',
  visitsIn: 'Visits · {m}',
  tUsed: 'Used', tLeft: 'Left', tLeftSub: 'Extra day {p}', tExtra: 'Extra days', tExtraNone: 'None this month', tExtraBill: '{p} next invoice',
  tVisits: 'Visits', tPlan: 'Plan', tGoldSub: 'Any open day', tUsual: 'Usual', tArrival: 'Arrival',
  lgVisited: 'Visited', lgExtra: 'Extra day', lgClosed: 'Closed',
  perMonth: '{p} a month', coupleVal: 'Billed with {n}', monthly: 'Month to month · next invoice {d}',
  paysBills: 'pays the bills', usesApp: 'uses the app', noApp: 'no app yet', you: 'You', waAria: 'Message {n} on WhatsApp',
  stOnFile: 'On file', stPaper: 'Paper copy on file', stRequested: 'Requested by the club', stWaiting: 'Waiting for the club',
  consents: 'Consents', consentLine: '{n} · {d} · {v}',
  notesTitle: 'Notes from the club team', pinned: 'Pinned', sharedBy: '{n} · shared {d}',

  // ----- edit details -----
  editTitle: 'Edit details', editNote: 'The club checks changes before they show. Until then the current details stay.',
  sentToast: 'Sent to the club for approval', errEmail: 'Check the email address.',
  pendingTitle: 'Your changes are waiting for the club', pendingFields: 'Changes: {f}',
};
