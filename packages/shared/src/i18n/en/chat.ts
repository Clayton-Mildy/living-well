// chat strings (EN): staff and family Messages, new message sheet, automatic replies.
export const chat = {
  eyebrowStaff: 'Families · WhatsApp', eyebrowFamily: 'With the club', newMessage: 'New message', filterTeam: 'Filter by team', both: 'Both', member: 'Member',
  'topic.lobby': 'Lobby', 'topic.nurse': 'Nurse', 'topic.care': 'Activity team', 'topic.kitchen': 'Kitchen', 'topic.billing': 'Billing',
  'teamSub.lobby': '{name} and the front desk', 'teamSub.nurse': 'The club nurse', 'teamSub.care': 'The activity teachers', 'teamSub.kitchen': 'The kitchen team', 'teamSub.billing': 'The finance team',
  about: 'About {n} · {team}', aboutReplies: 'About {m}', relOf: '{rel} of {m}', you: 'You', youColon: 'You: ', startConv: 'Start a conversation', unreadAria: 'Unread',
  openProfile: 'Open {n}’s profile', backAria: 'Back to conversations', placeholder: 'Write a message', messageAria: 'Message', logAria: 'Messages in this conversation', sendAria: 'Send', threadAria: 'Conversation with {name}',
  pick: 'Choose a conversation', pickSub: 'Tap a conversation on the left to read and reply.', none: 'No conversations yet', noneSub: 'Messages from families show up here. Use New message to start one.',
  noneFamily: 'No conversations yet', noneFamilySub: 'Message the club any time. We usually reply within the hour.', emptyThread: 'No messages yet. Say hello below.',
  autoReply: 'Automatic reply', healthUpdate: 'Health update', notice: 'Notice', feedbackHead: 'Lunch feedback · {dish}',
  'ref.dailyLog': 'About the daily log', 'ref.reading': 'About a health reading', 'ref.photo': 'About a photo', 'ref.invoice': 'About an invoice', 'ref.feedback': 'About lunch feedback',
  'q.staff1': 'Thank you, noted.', 'q.staff2': 'Yes, it’s at the lobby.', 'q.staff3': 'We’ll check and get back to you.',
  'q.famLobby1': 'We’ll pick {n} up a little early today.', 'q.famLobby2': 'Is anything of {n}’s left at the lobby?', 'q.famLobby3': 'Thank you for today!',
  'q.famNurse1': 'How was {n}’s blood pressure today?', 'q.famNurse2': '{n} took the medicine this morning.', 'q.famNurse3': 'Thank you, {nurse}.',
  'autoAck.lobby': 'Thanks {name}, noted. We’ll take care of it.', 'autoAck.nurse': 'Thank you, {name}. I’ll check on {member} and reply here.',
  'autoAck.care': 'Thanks {name}. We’ve passed this on to the activity team.', 'autoAck.kitchen': 'Thank you, {name}. The kitchen team will look at this.',
  'autoAck.billing': 'Thanks {name}. Our finance team will get back to you soon.',
  // new message sheet
  startTitle: 'New message', startSub: 'Write to a family contact. They see it in the Messages tab of their app.', stepMember: 'About which member?', searchMember: 'Search members',
  stepContact: 'Which family member?', stepTeam: 'Which team is writing?', stepText: 'Your message', noContacts: 'No family contact of {n} has app access yet, so there is nobody to message.',
  pagerThreads: 'Pages of conversations', pagerMembers: 'Pages of members', earlier: 'Show earlier messages ({n})',
  noMembers: 'No members match.', sendMsg: 'Send message', sentTo: 'Message sent to {name}.', primaryTag: 'Primary billing contact', change: 'Change', noTopic: 'Your role has no team to write from.',
  // errors raised by the message actions
  'err.empty': 'Write a message first.', 'err.tooLong': 'That message is too long (up to {max} characters).', 'err.noAccess': '{name} doesn’t have app access yet.',
  // notifications and feed
  'notif.new': '{name} sent you a message about {member}.', 'notif.reply': '{name} replied about {member}.',
  'feed.started': 'Started a conversation with {who} about {name}', 'feed.reply': 'Replied to {who} about {name}',
  'feed.family.lobby': '{who} messaged the lobby about {name}', 'feed.family.nurse': '{who} messaged the nurse about {name}', 'feed.family.care': '{who} messaged the activity team about {name}',
  'feed.family.kitchen': '{who} messaged the kitchen about {name}', 'feed.family.billing': '{who} messaged billing about {name}',
};
