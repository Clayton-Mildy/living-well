// drafts strings (EN): KC round 7, the quick camera on every page for the activity team, the kitchen and management ("shoot first, sort later"),
// the Drafts screen where the simulated AI's suggestions are fixed and sent, and the errors of photo.editDraft / photo.sendDrafts.
export const drafts = {
  title: 'Drafts', aiSuggested: 'AI suggested', ai: 'AI', check: 'Check', blurry: 'Blurry?', best: 'Best', linking: 'Linking…',
  openCamera: 'Open camera', more: 'More ways', moreManual: 'Photo of members', moreActivity: 'Pictures of a session',
  empty: 'No drafts', emptyAll: 'Nothing waiting. Open the camera and shoot.',
  none: 'Other shots', nShots_one: '1 shot', nShots_other: '{n} shots', sessionChip: 'Session · {name}', pickSession: 'Pick a session', whoIsThis: 'Who is this?',
  unknown_one: '1 face not named', unknown_other: '{n} faces not named', lunchPhoto: 'Lunch photo', teaPhoto: 'Tea photo',
  // bar
  select: 'Select', selectAll: 'Select all', nSelected: '{n} selected', sendAll: 'Send all ({n})', sendAllReview: 'Send for approval ({n})', sendSel: 'Send ({n})', deleteSel: 'Delete ({n})',
  sentN_one: '1 photo sent.', sentN_other: '{n} photos sent.', sentReviewN_one: '1 photo sent for approval.', sentReviewN_other: '{n} photos sent for approval.',
  notAll_one: '1 needs a closer look and stays in Drafts.', notAll_other: '{n} need a closer look and stay in Drafts.',
  deletedN_one: 'Draft deleted.', deletedN_other: '{n} drafts deleted.', saved: 'Draft saved.',
  // edit sheet
  editTitle: 'Edit draft', filedAs: 'Filed as', kindPeople: 'People', kindScene: 'Session', kindFood: 'Food', session: 'Session', noSession: 'No session', day: 'Day', meal: 'Meal',
  deleteDraft: 'Delete draft', unnamed_one: '1 face the AI could not name. Add them by name.', unnamed_other: '{n} faces the AI could not name. Add them by name.',
  aiLine: 'About {pct}% sure', preview: 'Preview of the draft',
  // quick camera
  quick: 'Quick camera', quickN: 'Quick camera, {n} in Drafts', photoMode: 'Photo', videoMode: 'Video', modes: 'Camera mode', shutter: 'Take photo (hold for a burst)', hint: 'Tap for one photo, hold for a burst', hintVideo: 'Tap to start recording, tap again to stop (up to 15 s)',
  gallery: 'Choose from the gallery', taken: 'Taken: {n}', tray: 'Shots taken', uploading: 'Uploading', retry: 'Upload failed. Tap to try again.', saved1: 'In Drafts',
  doneBtn: 'Done', draftsLink: 'Drafts', draftsN: 'Drafts ({n})', inDrafts_one: '1 photo in Drafts', inDrafts_other: '{n} photos in Drafts', review: 'Review', burst: 'Burst',
  noCamera: 'No camera here. Choose photos from the gallery.',
  // errors
  'err.gone': 'That draft was already sent or deleted.', 'err.needPeople': 'Say who is in the photo first.', 'err.needSession': 'Pick the session first.',
  'err.notToday': 'Lunch and tea photos can only be sent on the day they were taken.',
} as const;
