// mood strings (EN): KC round 12, a 1-5 face at each moment of a visit; round 14: six moments, a meaning per face.
export const mood = {
  'face.5': 'Great', 'face.4': 'Good', 'face.3': 'Okay', 'face.2': 'Low', 'face.1': 'Upset',
  'moment.arrival': 'Check-in', 'moment.health': 'Nurse', 'moment.morning': 'Morning', 'moment.lunch': 'Lunch', 'moment.activity': 'Activity', 'moment.departure': 'Checkout',
  // round 14: one fixed meaning per face, shown under the picker
  'hint.5': 'Chatting and laughing', 'hint.4': 'Engaged and content', 'hint.3': 'Calm, quiet but fine', 'hint.2': 'Withdrawn or tired', 'hint.1': 'Distressed, agitated or in pain',
  'err.notIn': 'Check them in first.',
  ask: 'How is {name} today?', askOut: 'How is {name} leaving?',
  notMarkedDoor: 'Not marked at the door: {n}',
  lift: 'Lift {n}', index: 'Mood index', arc: 'Mood through the day',
};
