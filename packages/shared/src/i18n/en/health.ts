// health strings (EN).
export const health = {
  healthStation: 'Health station', healthChecks: 'Health checks', arrivalCheck: 'Arrival check', departureCheck: 'Departure check', recheckL: 'Re-check',
  spotCheck: 'Spot check', bp: 'Blood pressure', systolic: 'Sys', diastolic: 'Dia', pulse: 'Pulse', spo2: 'Oxygen · SpO₂', glucose: 'Glucose', weight: 'Weight', temp: 'Temp', grip: 'Grip',
  takeReading: 'Take reading', measuring: 'Measuring…', readOxi: 'Read oximeter', saveNext: 'Save and next', shareNotes: 'Share notes with family', cuff: 'BP cuff',
  oximeter: 'Oximeter', connected: 'connected', choose: 'Choose someone from the list',
  last4w: 'Systolic, last 4 weeks', allNormal: 'All readings in the normal range.', alertCall: 'Above the alert line. Let them rest, re-check, and tell the family.', watchCall: 'A little outside the usual range. Worth a re-check later today.',
  quickNotes: 'Quick notes', keypad: 'Keypad · {f}', device: 'LEPU PC-303', readDevice: 'Read PC-303', keypadNote: 'Values from the LEPU PC-303 fill in on their own. The keypad is the fallback, and is how weight and grip go in.',
  vitals: 'Oxygen and temperature', gluMonthly: 'Glucose', wtGrip: 'Weight and grip',
  lastL: 'Last {v} · {d}', lastToday: 'Today {t} · {v}', fromDevices: 'Read meter & scale',
  readingAt: 'Reading at {t}', savedBy: 'Saved at {t} by {n}', tellFam: 'Tell {n} now', recheck15: 'Re-check in {m} minutes', saved: 'Saved for {n}: {v}, {s}.', famTold: ' {f} was told on WhatsApp (demo).',
  'note.rested': 'Rested 5 minutes first', 'note.medsTaken': 'Took morning medicine at home', 'note.dizzy': 'Feeling dizzy', 'note.headache': 'Headache', 'note.rightArm': 'Measured on right arm',
  healthD: 'Blood pressure {b} · SpO₂ {o}%',

  // the list
  ageSub: '{a} · {p} · arrived {t}', ageSubPlain: '{a} · {p}', inClubN: '{n} in the club', membersN: '{n} members', foundN: '{n} found', posOf: '{i} of {n}',
  searchL: 'Search members', searchPh: 'Search by name or family name', grpIn: 'In the club today', grpOther: 'Not in today', listEmpty: 'No active members yet.', noMatchSub: 'Check the spelling, or search by first or family name.',
  presIn: 'In the club since {t}', presGone: 'Went home at {t}', presNo: 'Not checked in today', rowSince: 'Arrived {t}', rowLeft: 'Left {t}',
  chipArrival: 'Arrival check due', chipRecheck: 'Re-check at {t}', chipDeparture: 'Departure check due', chipSpot: 'Spot check asked', chipMonthly: 'Glucose and weight due', chipGlucose: 'Glucose due', chipWeight: 'Weight due',
  dueHead: 'Due for {n}', dueClear: 'Clear', dueClearL: 'Clear: {c}', dueNowL: 'due now', dueLaterL: 'later today',
  guestTrial: 'Trial guest', guestVisit: 'Visiting guest', guestSub: '{k} · arrived {t}', monthlyCheck: 'Monthly check',
  kArrival: 'Arrival', kDeparture: 'Departure', kRecheck: 'Re-check', kSpot: 'Spot check', kMonthly: 'Monthly',
  todayHead: 'Today’s readings · {n}', todayNone: 'No readings saved today yet.', cardOpen: '{k} at {t}',
  healthRecord: 'Health record', trends: 'Trends',

  // care flags
  allergyUnknown: 'Allergies not known yet', lunchMed: '{n} {d} · lunch', drugAllergy: '{d} allergy',
  'food.shellfish': 'Shellfish', 'food.seafood': 'Seafood', 'food.fish': 'Fish', 'food.peanuts': 'Peanuts', 'food.eggs': 'Eggs', 'food.dairy': 'Dairy', 'food.gluten': 'Gluten',
  'drug.penicillin': 'Penicillin', 'drug.sulfa': 'Sulfa', 'drug.aspirin': 'Aspirin', 'drug.ibuprofen': 'Ibuprofen',
  'mob.walkingStick': 'Walking stick', 'mob.walker': 'Walker', 'mob.wheelchair': 'Wheelchair',
  'diet.softFood': 'Soft food', 'diet.lowSalt': 'Low salt', 'diet.vegetarian': 'Vegetarian', 'diet.sugarFree': 'Sugar free',

  // the form
  byHand: 'Enter by hand', optionalTag: 'Optional', monthlyLater: 'Do monthly later', monthlyNow: 'Do them now',
  monthlyHead: 'Monthly checks · optional', monthlyLaterNote: 'Glucose and weight stay due. They show as a reminder on the member’s row.',
  whyMissingShort: 'Still needed: {g}.', whyRangeShort: 'Check the highlighted values.', whyMonthlyShort: 'Enter at least one value.',
  whyMeasuring: 'Waiting for the PC-303 reading…', whyMissing: 'Still needed: {g}. Tap Read PC-303 or type the values in.', whyMonthly: 'Enter at least one value.',
  whyRange: 'Check the highlighted values: they look too high or too low to be right.', rangeHint: 'Between {lo} and {hi}', notePh: 'Add a short note for the record (optional)',
  noFamily: 'No family contact receives health messages for {n}.',
  kindL: 'Which check?', kindSuggest: 'Suggested: {k}', kindTaken: '{k} (already saved today)', kindNotDue: '{k} (not due this month)', saveOnly: 'Save reading',
  savedOnlyMonthly: 'Monthly check saved for {n}.', savedDeferred: ' Glucose and weight are still due this month.', savedRecheck: ' Re-check at {t}.',

  // today's readings: correct or remove
  editBtn: 'Edit reading', voidBtn: 'Remove reading', toldAt: 'Family told at {t}: {f}', editedAt: 'Corrected at {t} by {n} · {r}', editedNoReason: 'Corrected at {t} by {n}',
  editTitle: 'Edit reading', editWhy: 'Why are you changing it?', editSave: 'Save correction', editHint: 'The old values stay in the audit trail with your name and the reason.', edited: 'Reading corrected.',
  'er.typo': 'Typing mistake', 'er.deviceError': 'Device gave a wrong value', 'er.remeasured': 'Measured again', 'er.other': 'Other',
  voidTitle: 'Remove this reading?', voidSub: 'It stays in the audit trail but no longer counts for status, trends or alerts.', voidMonthly: 'Also remove the glucose and weight saved with it',
  voidFamily: 'The family was told about this reading. They will get the correction on WhatsApp (demo).', voidConfirm: 'Remove reading', voided: 'Reading removed.',
  'vr.wrongPerson': 'Wrong person', 'vr.deviceError': 'Device error', 'vr.duplicate': 'Duplicate', 'vr.other': 'Other',

  // clear a reminder
  dismissTitle: 'Clear this reminder for {n}?', dismissSub: 'The reason is kept in the record. The reminder comes back if the check is asked for again.', dismissConfirm: 'Clear reminder', removed: 'Reminder cleared for {n}.',
  'dr.declined': 'Declined the check', 'dr.notNeeded': 'Not needed today', 'dr.leftEarly': 'Going home early', 'dr.other': 'Other',

  // errors
  'err.alreadyTaken': 'This check was already saved today. Open today’s readings to correct it.', 'err.bpRequired': 'Blood pressure is needed for this check.', 'err.bpPair': 'Enter both blood pressure numbers.',
  'err.diaSys': 'The lower blood pressure number must be below the upper number.', 'err.needValue': 'Enter at least one value.', 'err.monthlyDone': 'The monthly check is already saved for this month.',
  'err.noArrival': 'Take the arrival check first.', 'err.alreadyQueued': 'Already in the queue.', 'err.alreadyVoided': 'This reading was already removed.', 'err.reasonRequired': 'Please choose a reason.',
  'err.notInQueue': 'That reminder isn’t due any more.', 'err.guestKind': 'That check can’t be saved for a guest.',
  'err.range.sys': 'Systolic pressure must be between 50 and 260 mmHg.', 'err.range.dia': 'Diastolic pressure must be between 30 and 160 mmHg.', 'err.range.pulse': 'Pulse must be between 25 and 220 bpm.',
  'err.range.spo2': 'SpO₂ must be between 50 and 100 %.', 'err.range.temp': 'Temperature must be between 30 and 43 °C.', 'err.range.glucose': 'Glucose must be between 20 and 700 mg/dL.',
  'err.range.weight': 'Weight must be between 20 and 250 kg.', 'err.range.grip': 'Grip must be between 1 and 99 kg.',

  // updates to the family’s bell (the club tells them on WhatsApp; simulated in the demo)
  'notif.fam.normal': '{name}: health check at {time}, {value}. All in the normal range.',
  'notif.fam.watch': '{name}: health check at {time}, {value}. A little outside the usual range; the nurse is keeping an eye on it.',
  'notif.fam.alert': '{name}: health check at {time}, {value}. Above the alert line; the nurse is looking after it.',
  'notif.fam.void': 'Correction: a reading shared about {name} was recorded by mistake.', 'notif.alert': 'Alert reading: {name} · {value}', 'notif.guestAlert': 'Alert reading for {name} (guest): {value}',
  'feed.normal': '{name} · {value} · Normal', 'feed.watch': '{name} · {value} · Watch', 'feed.alert': '{name} · {value} · Alert',
  'feed.normalTold': '{name} · {value} · Normal · family told', 'feed.watchTold': '{name} · {value} · Watch · family told', 'feed.alertTold': '{name} · {value} · Alert · family told',
  'feed.edited': 'Reading corrected for {name}', 'feed.voided': 'Reading removed for {name}', 'feed.queueAdd': '{name} added to the health queue', 'feed.dismissed': '{name}: health reminder cleared',

  // readings (trends)
  filterL: 'Filter', readingsEyebrow: 'Health station · last {n} weeks', nobodyGroup: 'Nobody in this group.', lastBp: 'Last BP {v} · {d}', todayL: 'today', noConditions: 'no long-term conditions',
  openRecord: 'Open health record', posList: '{i} of {n}',
  modeL: 'View', modeTrends: 'Trends', modeDay: 'By day', dayL: 'Day', dayPrev: 'Previous day', dayNext: 'Next day', dayToday: 'Today', daySum: 'Readings: {r} · People: {p}', dayEmpty: 'No readings on {d}.', dayEmptySub: 'Pick another date, or step back a day.',
  histDayL: 'Reading day', histEarlier: 'Earlier reading day', histLater: 'Later reading day', histLatest: 'Latest', histPos: 'Reading day {i} of {n}', histEmpty: 'No readings on {d}.', histEmptySub: 'Use the arrows to jump to the nearest day with readings.', histNone: 'No readings yet.', trendsSearchPh: 'Search by name or family name', cSpo2: 'SpO₂', cTemp: 'Temperature', noReadingsYet: 'No readings yet', history: 'History',
  lgBp: 'Solid line: arrival · dashed: departure · shaded: normal range', lgPulse: 'Arrival · shaded: {lo}–{hi}', lgSpo2: 'Arrival · watch under {w}, alert under {a}',
  lgTemp: 'Arrival · watch from {w}, alert from {a}', lgGlu: 'Since {m} · shaded: {lo}–{hi}', lgWt: 'Since {m} · watch on a {w} kg change',
  // trend charts (KC round 7): hover or tap a chart to read the date and value; the range over which to look
  rangeL: 'Time range', 'range.1w': '1W', 'range.1m': '1M', 'range.3m': '3M', 'range.6m': '6M', 'range.all': 'All', 'range.custom': 'Custom', rangeFrom: 'From', rangeTo: 'To',
  readingsIn: '{n} readings from {a} to {b}', readingsInOne: '1 reading from {a} to {b}',
  trendOf: 'Trend of {n}', latestOn: 'Latest: {d}', noInRange: 'No readings in this range',
  // device waiting, one complete measurement is enough
  waiting: 'Waiting…', stopWaitingL: 'Stop waiting for the PC-303 and type instead',
  whyWaiting: 'Waiting for the PC-303. Tap a box to type the numbers instead.', whyWaitingShort: 'Waiting for the PC-303. Tap a box to type.',
  whyPartial: 'Finish or clear: {g}.', whyPartialShort: 'Finish or clear: {g}.',
  whyNone: 'Enter one complete measurement, for example all three blood pressure numbers.', whyNoneShort: 'Enter one complete measurement.',
  // Watch and Alert limits (settings)
  limitsBtn: 'Limits', limitsTitle: 'Watch and Alert limits', limitsNote: 'Past a Watch limit a reading shows Watch; past an Alert limit, Alert. Leave a box empty to not use it. Saved readings are graded again with the new limits.',
  limReset: 'Use the standard limits', limSaved: 'Limits saved. Every reading now uses them.', limBadOrder: 'Alert must be past Watch.', limBadRange: 'Between {lo} and {hi}.', limOneNeeded: 'Fill in Watch or Alert.',
  'limW.from': 'Watch from', 'limA.from': 'Alert from', 'limW.above': 'Watch above', 'limA.above': 'Alert above', 'limW.below': 'Watch below', 'limA.below': 'Alert below',
  'lim.sysHigh': 'Blood pressure, upper number high', 'lim.diaHigh': 'Blood pressure, lower number high', 'lim.sysLow': 'Blood pressure, upper number low',
  'lim.pulseHigh': 'Pulse high', 'lim.pulseLow': 'Pulse low', 'lim.spo2Low': 'Oxygen (SpO₂) low', 'lim.tempHigh': 'Temperature high', 'lim.tempLow': 'Temperature low',
  'lim.gluHigh': 'Glucose high', 'lim.gluLow': 'Glucose low', 'lim.weightChange': 'Weight change since last month',
  'err.limitRange': 'A limit is outside the usual range.', 'err.limitOrder': 'Alert must be past Watch, and each line needs Watch or Alert.', 'feed.limits': '{name} changed the Watch and Alert limits',
  // a member's own limits (KC round 7): the station note, the member's limits sheet, the feed
  ownLimits: 'Own limits', ownLimitsTip: 'Graded with {n}’s own limits: {k}.',
  limitsForTitle: 'Limits for {n}', limMemberNote: 'Change a line to give {n} their own limit. Lines you leave follow the club.', limOwn: 'Own', limOwnCount: 'Members with their own limits: {n}',
  limResetClub: 'Reset to club limits', limSavedMember: 'Limits saved for {n}. Their readings are graded again.', limClearedMember: '{n} now follows the club limits.',
  'feed.memberLimits': '{name} set own Watch and Alert limits for {member}', 'feed.memberLimitsClear': '{name} put {member} back on the club limits',
};
