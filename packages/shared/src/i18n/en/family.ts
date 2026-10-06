// family strings (EN). The club is drop-in: members come on any open day, so there are no bookings, leave or "expected" strings here.
export const family = {
  // ----- headings, plan and billing words from the design -----
  goodMorning: 'Good morning, {n}', goodAfternoon: 'Good afternoon, {n}', todayAtClub: 'Today at the club', now: 'NOW', photos: 'Photos', notesTeam: 'From the team', used: 'Used', payVA: 'Pay by virtual account',
  messageClub: 'Message the club', bank: 'Bank', vaNumber: 'Virtual account', autoConfirm: 'Payment is confirmed automatically, usually within a few minutes. The receipt arrives on WhatsApp.',
  simPay: 'Demo: simulate payment received', invL: '{p} invoice', dueOn: 'Due {d} · DOKU virtual account', paidOn: 'Paid {d} · receipt sent', billingBy: '{n} looks after billing for {m}.',
  sharedNote: 'Shared note from the club: {n}', sPay: 'Pay by virtual account', paidT: 'Payment received. Receipt sent to {n} on WhatsApp.', copied: 'Virtual account number copied.', mood_cheerful: 'Cheerful', mood_calm: 'Calm',
  mood_quiet: 'Quiet', mood_agitated: 'Unsettled', lunch_all: 'Ate all of lunch', lunch_most: 'Ate most of lunch', lunch_half: 'Ate half of lunch', lunch_little: 'Ate a little', calmDay: '{n} had a calm day and joined {a}.',
  sinceL: 'member since {d}',

  // ----- member switcher, member card, where the member is today (drop-in: at the club since, went home, or not at the club) -----
  switcher: 'Choose a member', both: 'Both', everyone: 'All', profile: 'Profile', planFlex: 'Flex', planGold: 'Gold', endsOn: 'Membership ends {d}', atSince: 'At the club since {t}', checkedInBy: 'Checked in by {s}',
  wentHome: 'Went home at {t}', visitSpan: 'At the club from {a} to {b}', notToday: 'Not at the club today', notNow: 'Not at the club right now', famUsually: 'Usually arrives around {t}', stClosed: 'Club closed today', stEnded: 'Membership ended {d}',
  stUpcoming: 'Membership starts {d}', endedSub: '{n}’s membership ended on {d}. Invoices and photos stay here.',

  // ----- today: timeline -----
  tArrived: 'Arrived', tArrivedD: 'Checked in by {s}', tHealth: 'Health check', tHealthUp: 'Health check on arrival', tHealthUpD: 'Blood pressure, oxygen and temperature with {n}', tLunch: 'Lunch', tTea: 'Afternoon tea',
  tHome: 'Home time', tHomeD: 'Departure blood pressure before {s} leaves', tHomeDoneD: 'Checked out by {s}', tHomeBp: 'Blood pressure before leaving {b}', lunchPhoto: 'Lunch photo posted by the kitchen',
  lunchFeedback: 'Feedback on lunch', tLunchSafe: 'The kitchen has {n}’s {a} allergy on file; today’s menu is clear.', tLunchAlt: 'Today’s {d} isn’t safe for {n}’s {a} allergy, so the kitchen is serving {x} instead.',
  theLobby: 'the lobby', forMember: 'For {n}', pronS_f: 'she', pronS_m: 'he', pronO_f: 'her', pronO_m: 'him', tempLine: 'Temperature {t} °C', food_shellfish: 'shellfish', food_seafood: 'seafood', food_fish: 'fish',
  food_peanuts: 'peanut', food_eggs: 'egg', food_dairy: 'dairy', food_gluten: 'gluten', badgeNormal: 'Normal', badgeWatch: 'A little outside the usual range · the nurse is watching',
  badgeAlert: 'Outside the safe range · the nurse is following up',

  // ----- today: both-parents cards -----
  bpArrival: 'On arrival · {t}', bpDeparture: 'Before going home · {t}', oxygen: ' · oxygen {o}%', healthSoon: 'Health check coming up with {n}.', noHealthToday: 'No health check today.', healthOnArrival: 'The nurse checks blood pressure when they arrive.',
  planUsedLine: 'Flex · {n} of {q} visits used', planGoldLine: 'Gold · come any open day', payAmount: 'Pay {a}', plansTitle: 'Plans and invoices',
  plansBoth: 'Each parent keeps their own plan, visits and invoice. You can pay every open invoice together from Billing.', openBillingBoth: 'Open billing for both',

  // ----- today: survey -----
  surveyEyebrow: 'Quick survey · 1 minute', surveyAsk: 'Tell us how we are doing and rate the team. It takes about a minute.', surveyThanks: 'Thank you. Your answers went to the club team.', surveyBtn: 'Answer the survey',
  surveyQ1: 'How happy are you with CitraPremier overall?', surveyTeam: 'Rate the team', surveyRec: 'Would you recommend CitraPremier to a friend?', surveyNotYet: 'Not yet', surveyCmt: 'Anything we could do better?',
  surveySend: 'Send answers', starsAria: '{n} of 5', surveyOverall: 'Overall', surveyNeed: 'Answer the questions marked Required to send.', surveyPick: 'Choose one',

  // ----- photos -----
  soloPhotos: '{n}’s photos', groupWith: 'Group photos with {o}', groupWithBoth: 'Group photos with both', groupOther: 'Other group photos', photoAria: '{a}, {t}', photoAriaGroup: '{a}, {t}, group photo',
  photoAriaVideo: '{a}, {t}, video', clubPhoto: 'Club photo', phEyebrow: '{n} · by day', phEyebrowBoth: 'Both parents · by day', phCountOne: '1 photo', phCountN: '{n} photos', phEmpty: 'No photos yet.',
  phEmptySub: 'Photos from club days appear here.', phNote: 'Solo photos come first each day, then group photos.', phNoteBoth: 'Solo photos come first each day, then group photos. A photo with both parents shows once.',

  // ----- team log and comments -----
  logCommentPh: 'Comment for the team', logSend: 'Send', commentLabel: 'Comment', commentSent: 'Comment sent to {n}.', dayLine: '{n} had a {m} day.', dayLineJoined: '{n} had a {m} day and joined {a}.',
  dayLineSat: '{n} had a {m} day and sat out the activities.', sharedNoteFor: 'Shared note about {m}: {n}', calendarBtn: 'Club calendar', contactsBtn: 'Useful contacts',

  // ----- plan card: Flex visits this month (counted from check-ins, extra visits billed next month) and Gold -----
  planLabel: 'Flex plan · {m}', planGoldLabel: 'Gold plan · {m}', visitsUsed: '{n} of {q} visits used in {m}', goldTitle: 'Gold plan · come any open day', goldVisits: 'Visits in {m}: {n}. No limit and no extra charge.',
  visitsExtra: '{n} extra visit this month · {p} on the {m} invoice', visitsExtraN: '{n} extra visits this month · {p} on the {m} invoice', extraDates: 'Extra visit dates: {d}',
  extraRule: 'Extra visits are {p} each, billed next month on the {m} invoice.',
  planAskGold: 'Ask to switch to Gold', planAskFlex: 'Ask to switch to Flex', planAskTitle: 'Switch {name} to {plan}?',
  planAskBodyGold: 'Gold: come any open day for {p} a month, with no extra-day charges. It starts on {d} once the club confirms.',
  planAskBodyFlex: 'Flex: {q} visits a month for {p}; extra visits are {x} each. It starts on {d} once the club confirms.',
  planAskSend: 'Send request', planAskSent: 'Request sent. The club will confirm it.', planAsked: 'Switch to {plan} from {d} requested · waiting for the club', planWithdraw: 'Withdraw request', planWithdrawn: 'Request withdrawn.', endedPlan: 'Membership ended. The plan is closed.',

  // ----- invoice card and billing -----
  invOpen: 'Open invoices', invOpenSub: '{n} to pay · oldest due {d}', invOverdueSub: 'Overdue since {d}', invNone: 'No invoice yet', invNoneSub: 'The first invoice arrives on the {od} ({date}).', invAllPaid: 'All paid',
  invAllPaidSub: 'There is nothing to pay right now.', partPaid: 'Part paid · {a} of {t}', seeBilling: 'See all invoices', viewDetails: 'Details', payOne: 'Pay this invoice', billEyebrowMulti: 'One invoice per parent',
  billTotal: 'Total to pay', billTotalSub: '{n} open · {o} overdue', billTotalSubOk: '{n} open', payTogether: 'Pay all together', payTogetherNote: '{list}. One transfer settles every invoice.',
  comboVa: 'Combined virtual account · DOKU', history: 'History', histDue: '{no} · due {d}', histPaid: '{no} · paid {d}',
  payerNote: '{n} looks after billing, so payment buttons appear on their phone. You can still see every invoice here.', viewInvoice: 'Open invoice {no}', payTotal: 'Total',

  // ----- sheet: lunch feedback -----
  fbTitle: 'Feedback on lunch', fbMember: 'For whom?', fbDay: 'Which day?', fbDish: 'Which dish?', fbWhole: 'The whole meal', fbText: 'What would you like the kitchen to know?', fbPh: 'Tell us what went well or what to change',
  fbSend: 'Send feedback', fbSent: 'Thank you. The kitchen team will reply in Messages.',
};
