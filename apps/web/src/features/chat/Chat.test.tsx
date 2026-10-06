// Messages with a lot of conversations and a long thread: the list is paged (and follows the selected conversation), the thread
// shows its newest messages first with "Show earlier messages", and the new-message sheet pages its member picker.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type ClubState, type Message, type Thread } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Chat, THREADS_PER_PAGE } from './Chat';
import { MESSAGES_SHOWN } from './ThreadPanel';
import { MEMBERS_PER_PAGE, StartThreadSheet } from './StartThreadSheet';

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

/** The seed (Caca, the lobby, has two threads) plus `extra` more lobby threads, newest first by id (x0 is the newest). */
function lobbyClub(extra: number, lang: 'en' | 'id' = 'en') {
  const state: ClubState = buildSeed().citra;
  for (let i = 0; i < extra; i++) {
    const id = `x${i}`;
    const at = `2026-10-20T${String(23 - Math.floor(i / 6)).padStart(2, '0')}:${String(59 - (i % 6) * 5).padStart(2, '0')}`;
    const th: Thread = { id, clubId: 'citra', createdAt: at, createdBy: 'family:f1', memberId: 'm1', familyId: 'f1', topic: 'lobby', lastSeq: 1, staffReadSeq: 1, familyReadSeq: 1 };
    const msg: Message = { id: `${id}-1`, clubId: 'citra', createdAt: at, createdBy: 'family:f1', threadId: id, seq: 1, from: 'family:f1', at, text: `Question number ${i}`, kind: 'text' };
    state.threads[id] = th;
    state.messages[msg.id] = msg;
  }
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
}
async function show(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{node}</MemoryRouter>); });
}
const threads = () => Array.from(host!.querySelectorAll('[data-thread]')).map((b) => b.getAttribute('data-thread')!);
const nav = () => host!.querySelector('nav');
const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
const pageButton = (label: string) => host!.querySelector(`nav button[aria-label="${label}"]`);

describe('conversation list paging', () => {
  it('a few conversations: one page, no pager', async () => {
    lobbyClub(0);
    await show(<Chat audience="staff" />);
    expect(threads()).toHaveLength(2);
    expect(nav()).toBeNull();
  });
  it(`a long list shows ${THREADS_PER_PAGE} at a time, newest first, with a pager`, async () => {
    lobbyClub(25); // 27 conversations
    await show(<Chat audience="staff" />);
    expect(threads()).toHaveLength(THREADS_PER_PAGE);
    expect(threads()[0]).toBe('t2'); // the 07:40 message today is the newest
    expect(nav()?.getAttribute('aria-label')).toBe('Pages of conversations');
    await click(pageButton('Next page'));
    expect(threads()).toHaveLength(THREADS_PER_PAGE);
    expect(threads()).not.toContain('t2');
    await click(pageButton('Page 3'));
    expect(threads()).toHaveLength(27 - 2 * THREADS_PER_PAGE);
    await click(pageButton('Previous page'));
    await click(pageButton('Previous page'));
    expect(threads()[0]).toBe('t2');
  });
  it('opening a conversation from the list keeps the list on its page', async () => {
    lobbyClub(25);
    await show(<Chat audience="staff" />);
    await click(pageButton('Next page'));
    const second = threads()[0];
    await click(host!.querySelector(`[data-thread="${second}"]`));
    expect(host!.querySelector('[role="log"]')).toBeTruthy(); // narrow screen: the thread replaces the list
    expect(host!.textContent).toContain('Question number');
  });
});

describe('long conversation', () => {
  const log = () => host!.querySelector('[role="log"]')!;
  const bubbles = () => log().querySelectorAll('[data-kind="text"]').length;
  it(`opens on its newest ${MESSAGES_SHOWN} messages; "Show earlier messages" adds more until none are left`, async () => {
    lobbyClub(0);
    const s = useReplica.getState().view!;
    for (let i = 4; i <= 95; i++) {
      const at = `2026-10-20T${String(9 + Math.floor(i / 12)).padStart(2, '0')}:${String((i % 12) * 5).padStart(2, '0')}`;
      s.messages[`t1-${i}`] = { id: `t1-${i}`, clubId: 'citra', createdAt: at, createdBy: 'family:f1', threadId: 't1', seq: i, from: i % 2 ? 'family:f1' : 'staff:s1', at, text: `Message ${i}`, kind: 'text' };
    }
    s.threads.t1.lastSeq = 95;
    useReplica.setState({ confirmed: s, view: s });
    await show(<Chat audience="staff" />);
    await click(host!.querySelector('[data-thread="t1"]'));
    expect(bubbles()).toBe(MESSAGES_SHOWN);
    expect(log().textContent).toContain('Message 95');
    expect(log().textContent).toContain('Message 56'); // the 40th newest
    expect(log().textContent).not.toMatch(/Message 55(?!\d)/); // older ones are not shown yet
    const more = () => Array.from(log().querySelectorAll('button')).find((b) => /Show earlier messages/.test(b.textContent || ''));
    expect(more()?.textContent).toContain('(55)'); // 95 messages, 40 shown
    await click(more());
    expect(bubbles()).toBe(MESSAGES_SHOWN * 2);
    expect(more()?.textContent).toContain('(15)');
    await click(more());
    expect(bubbles()).toBe(95);
    expect(more()).toBeUndefined();
    expect(log().textContent).toContain('Is Mama’s blood pressure okay this week?'); // the very first message
  });
  it('a short conversation has no "Show earlier messages"', async () => {
    lobbyClub(0);
    await show(<Chat audience="staff" />);
    await click(host!.querySelector('[data-thread="t1"]'));
    expect(log().textContent).not.toContain('Show earlier messages');
    expect(bubbles()).toBe(3);
  });
});

describe('new message: member picker', () => {
  it(`pages the member list (${MEMBERS_PER_PAGE} at a time) and goes back to page 1 when you search`, async () => {
    lobbyClub(0);
    const s = useReplica.getState().view!;
    for (let i = 0; i < 20; i++) s.members[`mx${i}`] = { ...structuredClone(s.members.m46), id: `mx${i}`, firstName: `Tester${String(i).padStart(2, '0')}`, lastName: 'Clone' };
    useReplica.setState({ confirmed: s, view: s });
    await show(<StartThreadSheet open onClose={() => undefined} />);
    const picks = () => Array.from(document.querySelectorAll('button')).filter((b) => /Opa .*Clone|Oma |Opa |Bapak /.test(b.textContent || '') && b.querySelector('[aria-hidden]') && b.textContent!.includes('chevron_right'));
    expect(picks()).toHaveLength(MEMBERS_PER_PAGE);
    const pager = document.querySelector('nav');
    expect(pager?.getAttribute('aria-label')).toBe('Pages of members');
    await click(document.querySelector('nav button[aria-label="Next page"]'));
    expect(picks()).toHaveLength(MEMBERS_PER_PAGE);
    const input = document.querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Tester05');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(picks()).toHaveLength(1);
    expect(document.querySelector('nav')).toBeNull();
  });
});
