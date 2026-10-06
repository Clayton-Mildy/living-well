// lobby strings (EN): arrivals board, manual check-in, member drawer, check-out dialog, trial and visit guests.
// The club is drop-in: members come on any open day, so there is no "expected" list, nobody is recorded as bringing or collecting.
export const lobby = {
  arrivals: 'Arrivals', inClub: 'In the club', goneHome: 'Gone home', faceCheckin: 'Face check-in', frontDoor: 'Front door camera · face recognition',
  live: 'Live', standingBy: 'Standing by', standingBySub: 'Members are recognised as they come through the door.', simulate: 'Simulate next arrival', demoOnly: 'Demo only: stands in for the door camera.',
  recognising: 'Recognising…', match: '{n}% match', manual: 'Picked from the list', confirmCheckin: 'Confirm check-in', notThem: 'Not this person', alsoToday: 'Also today',
  checkIn: 'Check in', checkOut: 'Check out', usually: 'Usually arrives around {t}', est: 'Est {t}', arrivedAt: 'Arrived {t}',
  depDone: 'Departure check done at {t}.', depMissing: 'Departure blood pressure not taken yet.',
  depWaiting: 'Waiting at the health station for the departure check.', sendNurse: 'Send to health station', coConfirm: 'Check out and tell family', care: 'Care', notes: 'Notes', familyC: 'Family',
  primaryBilling: 'Primary billing contact',
  tCheckedIn: '{n} checked in at {t}. {f} got a message.', tCheckedOut: '{n} checked out at {t}. Family told.', nurseQ: '{n} sent to the health station.',
  openProfile: 'Open full profile', todayCounts: 'Today at the club', modeAria: 'Check in or check out', clubOpen: 'Club open',

  // header and club-open pill
  opensAt: 'Opens at {t}', closedNow: 'Closed for today', todayL: 'Today',
  // door camera
  noneByFace: 'Everyone not in yet is checked in by name.', faceCard: 'Face check-in camera',
  // manual check-in
  checkInTitle: 'Check in a member', manualHint: 'Not recognised at the door? Find them here and tap Check in.', searchMember: 'Search by name, family or phone',
  noMatch: 'No member matches “{q}”.', noMembers: 'There are no active members yet.', allIn: 'Everyone has checked in today.', checkInPlain: '{n} checked in at {t}.',
  emptyIn: 'Nobody is in the club yet', emptyInSub: 'Members appear here as they check in.', emptyOut: 'Nobody has gone home yet', emptyOutSub: 'Members appear here after they check out.',
  // check-out mode: members in the club, and who has gone home
  checkOutHint: 'Find a member who is going home and tap Check out.', noMatchIn: 'Nobody in the club matches “{q}”.', noMatchGone: 'Nobody who has gone home matches “{q}”.',
  pagerAria: 'Pages of {list}', tileIn: 'Open the check-out list', tileGone: 'See who has gone home',
  goneHint: 'Members who checked out today. Open one to undo a check-out.', countOf: '{n} of {total}',
  // visits (Flex: 10 visits a month; Gold: unlimited)
  visitOf: 'Flex · visit {n} of {q} this month', goldU: 'Gold · unlimited days', extraVisit: 'Visit {n} of {q} this month: an extra day, {p} on next month’s invoice.',
  extraToast: 'This is an extra day: {p} on next month’s invoice.',
  // drawer
  careInstructions: 'Care instructions', noNotes: 'No notes yet.', callAria: 'Call {name}', undoIn: 'Undo check-in', undoOut: 'Undo check-out', diabetic: 'Diabetic',
  drugAllergy: '{d} allergy', medLunch: '{name} {dose} · lunch', notInToday: 'Not checked in today', inOut: 'Arrived {a} · left {l}',
  nanny: 'Nanny', nannyNote: 'With {name}, {p} nanny',
  // toasts
  tUndoIn: '{n}’s check-in was undone.', tUndoOut: '{n}’s check-out was undone.',
  // also today
  alsoNone: 'Nothing else is planned today.',
  alsoUnread1: '1 unread message from a family', alsoUnreadN: '{n} unread messages from families', guestTrial: 'Trial day: {n}', guestVisit: 'Visit: {n}',
  guestWith: 'With {e} ({r}) · {s}', guestWithNo: 'With {e}', guestAllergyUnknown: 'Allergies not recorded', guestHealth: 'Health check on arrival', guestLunch: 'Staying for lunch',
  guestStatusIn: 'Checked in {t}', guestStatusOut: 'Left {t}', guestStatusNoShow: 'Did not come', noShow: 'No-show', undoNoShow: 'Undo no-show', openEnquiry: 'Open enquiry',
  tGuestIn: '{n} checked in at {t}.', tGuestInHealth: '{n} checked in at {t}. Sent to the health station.', tGuestOut: '{n} left at {t}.', tNoShow: '{n} marked as not coming.',
  tUndoGuest: '{n}’s check-in was undone.',
  // labels
  'rel.daughter': 'daughter', 'rel.son': 'son', 'rel.daughterInLaw': 'daughter-in-law', 'rel.sonInLaw': 'son-in-law', 'rel.granddaughter': 'granddaughter', 'rel.grandson': 'grandson',
  'rel.grandchild': 'grandchild', 'rel.spouse': 'spouse', 'rel.sibling': 'sibling', 'rel.other': 'family',
  'food.shellfish': 'Shellfish', 'food.seafood': 'Seafood', 'food.fish': 'Fish', 'food.peanuts': 'Peanuts', 'food.eggs': 'Eggs', 'food.dairy': 'Dairy', 'food.gluten': 'Gluten',
  'mobility.walkingStick': 'Walking stick', 'mobility.walker': 'Walker', 'mobility.wheelchair': 'Wheelchair',
  'diet.softFood': 'Soft food', 'diet.lowSalt': 'Low salt', 'diet.vegetarian': 'Vegetarian', 'diet.sugarFree': 'Sugar-free',
  'drug.penicillin': 'Penicillin', 'drug.sulfa': 'Sulfa', 'drug.aspirin': 'Aspirin', 'drug.ibuprofen': 'Ibuprofen',
  'source.referral': 'referral', 'source.instagram': 'Instagram', 'source.website': 'website', 'source.walkIn': 'walk-in', 'source.other': 'other',
  // errors raised by the attendance actions
  'err.faceOptOut': '{name} opted out of face recognition. Check them in by name.', 'err.undoAfterOut': '{name} has already left. Undo the check-out first.',
  'err.notCheckedOut': '{name} hasn’t checked out.', 'err.guestCancelled': 'This visit was cancelled.', 'err.guestNotToday': '{name} isn’t booked for today.', 'err.guestArrived': '{name} has already arrived.',
  // activity feed
  'feed.extraVisit': '{name} checked in for visit {n} this month: an extra day',
  'notif.extraVisit': '{name}: visit {n} this month is an extra day. {price} on next month’s invoice.',
  'feed.undoIn': 'Check-in of {name} undone', 'feed.undoOut': 'Check-out of {name} undone', 'feed.departureAsked': 'Departure check requested for {name}', 'feed.guestTrial': 'Trial guest {name} arrived',
  'feed.guestVisit': 'Visitor {name} arrived', 'feed.guestOut': '{name} left', 'feed.guestNoShow': '{name} did not come', 'feed.undoGuest': 'Check-in of {name} undone',
};
