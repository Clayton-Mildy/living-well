import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  buildSeed, execute, getUser, messagesOf, staffThreads, familyThreads, staffUnread, familyUnread, staffUnreadCount, familyUnreadCount, unreadUpdates, actionItems,
  type ClubState, type Message, type ThreadTopic,
} from '../index';

// Wed 21 Oct 2026, 10:00. Seed threads: t1 Maria/Oma Lina/lobby (1 unread for staff), t2 Laras/Bapak Bambang/lobby (1 unread),
// t3 Cynthia/Opa Hendra/nurse (health alert), t4 Yohana/Opa Tjahjadi/nurse, tk-c1..c3 kitchen feedback threads.
const clock = { today: '2026-10-21', nowMin: 600 };
const clubs = buildSeed();
const base: ClubState = clubs.citra;
const as = (id: string) => getUser(clubs, id)!;
let n = 0;
const run = (s: ClubState, name: string, input: unknown, userId: string, c = clock) => execute(s, name, input, as(userId), c, `m${++n}`);
const thread = (s: ClubState, id: string) => s.threads[id];
const last = (s: ClubState, tid: string) => messagesOf(s, tid).at(-1) as Message;

describe('seed expectations for unread', () => {
  it('lobby has two unread conversations; Maria has none unread', () => {
    expect(staffUnreadCount(base, 'lobby')).toBe(2);
    expect(staffUnread(base, thread(base, 't1'))).toBe(1);
    expect(staffUnread(base, thread(base, 't2'))).toBe(1);
    expect(familyUnreadCount(base, 'f1')).toBe(0);
  });
});

describe('thread.start', () => {
  const start = (s: ClubState, userId: string, topic: ThreadTopic, memberId = 'm1', familyId = 'f1', text = 'Hello Maria') => run(s, 'thread.start', { memberId, familyId, topic, text }, userId);

  it('posts into the existing thread and tells the family; the sender’s side is read, the family’s is unread', () => {
    const r = start(base, 's1', 'lobby');
    expect(r.result.threadId).toBe('t1');
    const t = thread(r.state, 't1');
    expect(t.lastSeq).toBe(4);
    expect(t.staffReadSeq).toBe(4); // replying marks the thread read for staff
    expect(familyUnread(r.state, t)).toBe(1);
    expect(last(r.state, 't1')).toMatchObject({ from: 'staff:s1', text: 'Hello Maria', kind: 'text', seq: 4 });
    const note = unreadUpdates(r.state, as('f1')).find((x) => x.kind === 'chat.notif.new');
    expect(note).toMatchObject({ link: '/chat?thread=t1', memberId: 'm1', params: { name: 'Caca', member: 'Oma Lina' } });
    expect(note?.ref).toEqual({ type: 'thread', id: 't1' });
    expect(unreadUpdates(r.state, as('f2')).some((x) => x.kind === 'chat.notif.new')).toBe(false); // only the contact written to
    expect(familyUnreadCount(r.state, 'f1')).toBe(1);
  });
  it('creates a new thread for a new member, contact and topic', () => {
    const r = start(base, 's1', 'lobby', 'm1', 'f2', 'Hi Daniel');
    const id = r.result.threadId as string;
    expect(id).not.toBe('t1');
    expect(thread(r.state, id)).toMatchObject({ memberId: 'm1', familyId: 'f2', topic: 'lobby', lastSeq: 1, staffReadSeq: 1, familyReadSeq: 0 });
    expect(familyThreads(r.state, 'f2').map((t) => t.id)).toContain(id);
    expect(Object.values(r.state.activity).some((x) => x.key === 'chat.feed.started' && x.memberId === 'm1')).toBe(true);
  });
  it('each role may only start the topics it covers; management any topic; family never', () => {
    expect(() => start(base, 's1', 'nurse')).toThrow('err.forbidden');
    for (const [u, topic] of [['s1', 'lobby'], ['s8', 'nurse'], ['s5', 'care'], ['s3', 'kitchen'], ['s10', 'billing']] as const) {
      const r = start(base, u, topic, 'm1', 'f1');
      expect(thread(r.state, r.result.threadId as string).topic).toBe(topic);
    }
    for (const topic of ['lobby', 'nurse', 'care', 'kitchen', 'billing'] as const) expect(start(base, 's9', topic).result.threadId).toBeTruthy();
    expect(() => start(base, 's10', 'lobby')).toThrow('err.forbidden');
    expect(() => start(base, 's5', 'nurse')).toThrow('err.forbidden');
    expect(() => start(base, 'f1', 'lobby')).toThrow('err.forbidden');
  });
  it('billing is visible to finance and management, not to the lobby', () => {
    const s = start(base, 's10', 'billing', 'm1', 'f1', 'About the October invoice').state;
    expect(staffThreads(s, 'finance').map((t) => t.topic)).toEqual(['billing']);
    expect(staffThreads(s, 'mgmt').some((t) => t.topic === 'billing')).toBe(true);
    expect(staffThreads(s, 'lobby').some((t) => t.topic === 'billing')).toBe(false);
  });
  it('validates text, member, contact and topic', () => {
    expect(() => start(base, 's1', 'lobby', 'm1', 'f1', '   ')).toThrow('chat.err.empty');
    expect(() => start(base, 's1', 'lobby', 'm1', 'f1', 'x'.repeat(2001))).toThrow('chat.err.tooLong');
    expect(() => start(base, 's1', 'lobby', 'nobody', 'f1')).toThrow('err.notFound');
    expect(() => start(base, 's1', 'lobby', 'm1', 'nobody')).toThrow('err.notFound');
    expect(() => start(base, 's1', 'lobby', 'm10', 'f1')).toThrow('chat.err.noAccess'); // Maria is not Bapak Bambang's family
    const noAccess = produce(base, (d) => { d.familyLinks['f2:m1'].appAccess = false; });
    expect(() => start(noAccess, 's1', 'lobby', 'm1', 'f2')).toThrow('chat.err.noAccess');
    expect(() => run(base, 'thread.start', { memberId: 'm1', familyId: 'f1', topic: 'secret', text: 'x' }, 's1')).toThrow('err.invalid');
    expect(() => run(base, 'thread.start', { memberId: 'm1', topic: 'lobby', text: 'x' }, 's1')).toThrow('err.invalid');
  });
  it('trims the text', () => {
    expect(last(start(base, 's1', 'lobby', 'm1', 'f1', '  padded  ').state, 't1').text).toBe('padded');
  });
});

describe('message.send: staff', () => {
  it('replies in an allowed topic, marks the thread read for staff, notifies the family', () => {
    const r = run(base, 'message.send', { threadId: 't1', text: 'Yes, it is at the lobby.' }, 's1');
    expect(thread(r.state, 't1')).toMatchObject({ lastSeq: 4, staffReadSeq: 4 });
    expect(staffUnreadCount(r.state, 'lobby')).toBe(1); // t2 is still unread
    expect(staffUnreadCount(r.state, 'mgmt')).toBe(1);
    const note = unreadUpdates(r.state, as('f1')).find((x) => x.kind === 'chat.notif.reply');
    expect(note).toMatchObject({ link: '/chat?thread=t1', params: { name: 'Caca', member: 'Oma Lina' } });
    expect(familyUnread(r.state, thread(r.state, 't1'))).toBe(1);
    expect(r.state.messages[Object.keys(r.state.messages).find((k) => r.state.messages[k].threadId === 't1' && r.state.messages[k].seq === 4)!].from).toBe('staff:s1');
    expect(actionItems(r.state, as('s1'), clock.today, clock.nowMin).find((i) => i.id === 'unread')?.params.n).toBe(1);
  });
  it('is limited to the topics of the role; management writes anywhere', () => {
    expect(() => run(base, 'message.send', { threadId: 't1', text: 'hi' }, 's8')).toThrow('err.forbidden'); // nurse in a lobby thread
    expect(() => run(base, 'message.send', { threadId: 't3', text: 'hi' }, 's1')).toThrow('err.forbidden'); // lobby in a nurse thread
    expect(run(base, 'message.send', { threadId: 't3', text: 'We will see him Tuesday.' }, 's8').state.threads.t3.lastSeq).toBe(3);
    expect(run(base, 'message.send', { threadId: 't3', text: 'FYI' }, 's9').state.threads.t3.lastSeq).toBe(3);
    expect(() => run(base, 'message.send', { threadId: 'nope', text: 'hi' }, 's1')).toThrow('err.forbidden');
  });
  it('answering a meal-feedback thread from Messages marks the feedback answered', () => {
    expect(base.feedback.c1.status).toBe('open');
    const r = run(base, 'message.send', { threadId: 'tk-c1', text: 'Thank you, we will use less salt.' }, 's3');
    expect(r.state.feedback.c1.status).toBe('answered');
    expect(last(r.state, 'tk-c1')).toMatchObject({ from: 'staff:s3', kind: 'text' });
    expect(unreadUpdates(r.state, as('fm10_0')).some((x) => x.kind === 'chat.notif.reply')).toBe(true);
    expect(() => run(base, 'message.send', { threadId: 'tk-c1', text: 'hi' }, 's1')).toThrow('err.forbidden');
  });
  it('rejects empty and over-long text and bad references', () => {
    expect(() => run(base, 'message.send', { threadId: 't1', text: ' ' }, 's1')).toThrow('chat.err.empty');
    expect(() => run(base, 'message.send', { threadId: 't1', text: 'y'.repeat(2001) }, 's1')).toThrow('chat.err.tooLong');
    expect(() => run(base, 'message.send', { text: 'hi' }, 's1')).toThrow('err.invalid');
    expect(() => run(base, 'message.send', { threadId: 't1', text: 'hi', ref: { type: 'banana', id: 'x' } }, 's1')).toThrow('err.invalid');
    expect(last(run(base, 'message.send', { threadId: 't1', text: 'hi', ref: { type: 'invoice', id: 'INV-2610-001' } }, 's1').state, 't1').ref).toEqual({ type: 'invoice', id: 'INV-2610-001' });
  });
  it('staff cannot create a thread with message.send (they use thread.start)', () => {
    expect(() => run(base, 'message.send', { memberId: 'm1', topic: 'lobby', text: 'hi' }, 's1')).toThrow('err.forbidden');
  });
});

describe('message.send: family', () => {
  it('writes in their own thread, marks their side read, and the lobby sees it unread', () => {
    const r = run(base, 'message.send', { threadId: 't1', text: 'Thank you!' }, 'f1');
    const t = thread(r.state, 't1');
    expect(staffUnread(r.state, t)).toBe(2); // the earlier one plus this one
    expect(familyUnread(r.state, t)).toBe(0);
    expect(messagesOf(r.state, 't1').filter((m) => m.from === 'family:f1')).toHaveLength(3);
  });
  it('finds or creates the thread by member and topic, for the family’s own members only', () => {
    const existing = run(base, 'message.send', { memberId: 'm1', topic: 'lobby', text: 'Another note' }, 'f1');
    expect(existing.result.threadId).toBe('t1');
    const fresh = run(base, 'message.send', { memberId: 'm46', topic: 'nurse', text: 'How is Opa Budi’s blood pressure?' }, 'f1');
    const id = fresh.result.threadId as string;
    expect(thread(fresh.state, id)).toMatchObject({ memberId: 'm46', familyId: 'f1', topic: 'nurse' });
    expect(staffThreads(fresh.state, 'nurse').some((t) => t.id === id)).toBe(true);
    expect(() => run(base, 'message.send', { memberId: 'm10', topic: 'lobby', text: 'x' }, 'f1')).toThrow('err.forbidden'); // not Maria's member
    expect(() => run(base, 'message.send', { memberId: 'm1', topic: 'kitchen', text: 'x' }, 'f1')).toThrow('err.forbidden'); // kitchen threads come from meal feedback
    expect(() => run(base, 'message.send', { threadId: 't2', text: 'x' }, 'f1')).toThrow('err.forbidden'); // someone else's thread
    expect(run(base, 'message.send', { memberId: 'm1', topic: 'billing', text: 'Question about the invoice' }, 'f1').result.threadId).toBeTruthy();
  });
  it('a daily-log comment goes to the care thread with its reference', () => {
    const r = run(base, 'message.send', { memberId: 'm1', topic: 'care', text: 'So glad she sang!', ref: { type: 'dailyLog', id: 'log-m1-2026-10-19' } }, 'f1');
    const id = r.result.threadId as string;
    expect(thread(r.state, id).topic).toBe('care');
    expect(messagesOf(r.state, id)[0]).toMatchObject({ from: 'family:f1', ref: { type: 'dailyLog', id: 'log-m1-2026-10-19' } });
    expect(staffThreads(r.state, 'activity').some((t) => t.id === id)).toBe(true);
  });
  it('write access follows the family’s links: a family with no access cannot write', () => {
    const s = produce(base, (d) => { d.familyLinks['f1:m1'].appAccess = false; });
    const maria = getUser({ citra: s }, 'f1')!; // the server builds the user from the live state: Oma Lina is no longer one of her members
    expect(maria.kind === 'family' && maria.memberIds).toEqual(['m46']);
    expect(() => execute(s, 'message.send', { memberId: 'm1', topic: 'lobby', text: 'x' }, maria, clock, 'mq')).toThrow('err.forbidden');
    expect(execute(s, 'message.send', { memberId: 'm46', topic: 'lobby', text: 'x' }, maria, clock, 'mr').result.threadId).toBeTruthy();
  });
});

describe('automatic acknowledgement', () => {
  const acks = (s: ClubState, tid: string) => messagesOf(s, tid).filter((m) => m.kind === 'autoAck');
  it('a family message with nobody from the club active for an hour gets one acknowledgement stored as an i18n key', () => {
    const r = run(base, 'message.send', { threadId: 't1', text: 'Thank you!' }, 'f1');
    expect(r.result.autoAck).toBe(true);
    const [ack] = acks(r.state, 't1');
    expect(ack).toMatchObject({ from: 'system', kind: 'autoAck', text: 'chat.autoAck.lobby', seq: 5, createdBy: 'system', at: '2026-10-21T10:00' });
    const t = thread(r.state, 't1');
    expect(t.lastSeq).toBe(5);
    expect(t.familyReadSeq).toBe(5); // the family just wrote; they do not get an unread for the ack
    expect(familyUnread(r.state, t)).toBe(0);
    expect(staffUnread(r.state, t)).toBe(2); // the ack never counts as unread for staff, and does not clear their unread
  });
  it('only one: a second message within the hour gets none', () => {
    const one = run(base, 'message.send', { threadId: 't1', text: 'First' }, 'f1').state;
    const two = run(one, 'message.send', { threadId: 't1', text: 'Second' }, 'f1', { today: clock.today, nowMin: 605 });
    expect(two.result.autoAck).toBe(false);
    expect(acks(two.state, 't1')).toHaveLength(1);
  });
  it('none when someone from the club wrote within the last 60 minutes; again once an hour has passed', () => {
    const staff = run(base, 'message.send', { threadId: 't1', text: 'On it.' }, 's1').state;
    const soon = run(staff, 'message.send', { threadId: 't1', text: 'Thanks' }, 'f1', { today: clock.today, nowMin: 659 });
    expect(soon.result.autoAck).toBe(false);
    const later = run(staff, 'message.send', { threadId: 't1', text: 'One more thing' }, 'f1', { today: clock.today, nowMin: 661 });
    expect(later.result.autoAck).toBe(true);
    expect(acks(later.state, 't1')).toHaveLength(1);
  });
  it('is judged per thread and uses the topic’s text; a brand-new thread is acknowledged too', () => {
    const r = run(base, 'message.send', { memberId: 'm46', topic: 'nurse', text: 'Hello nurse' }, 'f1');
    const id = r.result.threadId as string;
    expect(acks(r.state, id).map((m) => m.text)).toEqual(['chat.autoAck.nurse']);
    const care = run(base, 'message.send', { memberId: 'm1', topic: 'care', text: 'Great photo' }, 'f1');
    expect(acks(care.state, care.result.threadId as string)[0].text).toBe('chat.autoAck.care');
    const billing = run(base, 'message.send', { memberId: 'm1', topic: 'billing', text: 'Invoice question' }, 'f1');
    expect(acks(billing.state, billing.result.threadId as string)[0].text).toBe('chat.autoAck.billing');
    const kitchen = run(base, 'message.send', { threadId: 'tk-c1', text: 'More feedback' }, 'fm10_0');
    expect(acks(kitchen.state, 'tk-c1')[0].text).toBe('chat.autoAck.kitchen');
  });
  it('a health alert from the nurse counts as the club being active', () => {
    // t3: nurse message 14 Oct. Put a fresh one at 09:30 today and the family writes at 10:00: no acknowledgement
    const s = run(base, 'message.send', { threadId: 't3', text: 'Follow-up from the nurse' }, 's8', { today: clock.today, nowMin: 570 }).state;
    expect(run(s, 'message.send', { threadId: 't3', text: 'Thank you' }, 'fm2_0').result.autoAck).toBe(false);
  });
  it('staff replies are never acknowledged', () => {
    expect(run(base, 'message.send', { threadId: 't1', text: 'hi' }, 's1').result.autoAck).toBeUndefined();
  });
  it('works across midnight and uses the club date (no fixed month)', () => {
    const c1 = { today: '2026-10-31', nowMin: 23 * 60 + 30 };
    const s1 = run(base, 'message.send', { threadId: 't1', text: 'On it' }, 's1', c1).state;
    const c2 = { today: '2026-11-01', nowMin: 10 }; // 40 minutes later, next day
    const r = run(s1, 'message.send', { threadId: 't1', text: 'Thanks' }, 'f1', c2);
    expect(r.result.autoAck).toBe(false);
    const c3 = { today: '2026-11-01', nowMin: 31 + 60 }; // more than 60 minutes later
    const r3 = run(s1, 'message.send', { threadId: 't1', text: 'Thanks again' }, 'f1', c3);
    expect(r3.result.autoAck).toBe(true);
    expect(last(r3.state, 't1').at).toBe('2026-11-01T01:31');
  });
});

describe('thread.markRead', () => {
  it('marks only your own side, and only the thread you name', () => {
    const r = run(base, 'thread.markRead', { threadId: 't1' }, 's1');
    expect(thread(r.state, 't1')).toMatchObject({ staffReadSeq: 3, familyReadSeq: 3 });
    expect(staffUnreadCount(r.state, 'lobby')).toBe(1);
    expect(staffUnread(r.state, thread(r.state, 't2'))).toBe(1); // t2 untouched
    const fam = produce(base, (d) => { d.threads.t3.lastSeq = 3; d.messages['t3-3'] = { id: 't3-3', clubId: 'citra', createdAt: '2026-10-21T09:00', createdBy: 'staff:s8', threadId: 't3', seq: 3, from: 'staff:s8', at: '2026-10-21T09:00', text: 'New', kind: 'text' }; });
    expect(familyUnread(fam, thread(fam, 't3'))).toBe(1);
    const rf = run(fam, 'thread.markRead', { threadId: 't3' }, 'fm2_0');
    expect(thread(rf.state, 't3')).toMatchObject({ familyReadSeq: 3, staffReadSeq: 2 });
    expect(familyUnreadCount(rf.state, 'fm2_0')).toBe(0);
  });
  it('is a no-op when already read', () => {
    expect(run(base, 'thread.markRead', { threadId: 't3' }, 's8').patches).toHaveLength(0);
    expect(run(base, 'thread.markRead', { threadId: 't1' }, 'f1').patches).toHaveLength(0);
  });
  it('a family’s notifications for the thread are marked read when they open it', () => {
    const replied = run(base, 'message.send', { threadId: 't1', text: 'Found it' }, 's1').state;
    expect(unreadUpdates(replied, as('f1')).some((x) => x.kind === 'chat.notif.reply')).toBe(true);
    const opened = run(replied, 'thread.markRead', { threadId: 't1' }, 'f1').state;
    expect(unreadUpdates(opened, as('f1')).some((x) => x.kind === 'chat.notif.reply')).toBe(false);
    expect(familyUnreadCount(opened, 'f1')).toBe(0);
  });
  it('staff only read topics they cover; a family only its own threads', () => {
    expect(() => run(base, 'thread.markRead', { threadId: 't3' }, 's1')).toThrow('err.forbidden');
    expect(() => run(base, 'thread.markRead', { threadId: 't1' }, 'f2')).toThrow('err.forbidden');
    expect(() => run(base, 'thread.markRead', { threadId: 't2' }, 'f1')).toThrow('err.forbidden');
    expect(() => run(base, 'thread.markRead', {}, 's1')).toThrow('err.invalid');
    expect(run(base, 'thread.markRead', { threadId: 't3' }, 's9').patches).toHaveLength(0); // management reads any
  });
});

describe('the nurse’s tell-family message and kitchen replies stay readable', () => {
  it('seed keeps the health alert and the kitchen reply with their kinds and topics', () => {
    expect(messagesOf(base, 't3')[0]).toMatchObject({ kind: 'healthAlert', from: 'staff:s8' });
    expect(thread(base, 'tk-c2').topic).toBe('kitchen');
    expect(messagesOf(base, 'tk-c2')[1]).toMatchObject({ from: 'staff:s3', kind: 'text' });
    expect(familyThreads(base, 'fm2_0').map((t) => t.topic).sort()).toEqual(['kitchen', 'nurse']);
  });
});

describe('determinism', () => {
  it('the same mutation id gives identical patches on client and server', () => {
    const a = execute(base, 'message.send', { threadId: 't1', text: 'Thanks' }, as('f1'), clock, 'mz');
    const b = execute(buildSeed().citra, 'message.send', { threadId: 't1', text: 'Thanks' }, as('f1'), clock, 'mz');
    expect(JSON.stringify(a.patches)).toEqual(JSON.stringify(b.patches));
  });
});
