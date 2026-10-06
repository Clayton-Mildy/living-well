// Canonical in-memory club states (loaded from Postgres), serialized action pipeline per club, SSE fan-out.
import { buildSeed, execute, systemUser, DomainError, getUser, accountsNeedingUsername, usernameBase, type ClubState, type Patch, type User } from '@cp/shared';
import { loadAll, persistMutation, replaceAll } from './db/store';
import { clockInfo, demoDate, demoNowMin, loadClock, resetClock } from './clock';
import { runMigrations, ensureDatabase } from './db/setup';
import { claimUsername, scrubError, seedMissingCredentials } from './db/credentials';
import { loadSecret } from './auth';

let clubs: Record<string, ClubState> = {};
const queues: Record<string, Promise<unknown>> = {};
export type ServerEvent =
  | { type: 'patch'; rev: number; mutationId: string; patches: Patch[]; by: string }
  | { type: 'changed'; rev: number; mutationId?: string }
  | { type: 'reset' }
  | { type: 'clock'; clock: ReturnType<typeof clockInfo> };
interface Listener { clubId: string; user: User; send: (e: ServerEvent) => void }
const listeners = new Set<Listener>();

export async function boot() {
  await ensureDatabase(new URL(process.env.DATABASE_URL || 'postgres://localhost:5434/citrapremier'));
  await runMigrations();
  clubs = await loadAll();
  if (!Object.keys(clubs).length) {
    await replaceAll(buildSeed(demoDate(), demoNowMin()));
    clubs = await loadAll();
  }
  await loadClock();
  // a demo left from an earlier day starts fresh on today's date (the seed is built around the demo day)
  if (clockInfo().today !== demoDate()) {
    await replaceAll(buildSeed(demoDate(), demoNowMin()));
    clubs = await loadAll();
    await resetClock();
    console.log(`New demo day ${demoDate()}: demo data reset.`);
  }
  await loadSecret();
  await seedMissingCredentials(clubs);
  await syncUsernames(); // older databases: give everyone who can sign in a username
}
export const getClubs = () => clubs;
export const getClub = (id: string) => clubs[id];
export const userById = (id: string | undefined | null) => (id ? getUser(clubs, id) : null);

function enqueue<T>(clubId: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues[clubId] || Promise.resolve();
  const next = prev.then(fn, fn);
  queues[clubId] = next.catch(() => {});
  return next;
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function broadcast(clubId: string, e: ServerEvent) {
  for (const l of listeners) {
    if (l.clubId !== clubId && e.type !== 'reset' && e.type !== 'clock') continue;
    if (e.type === 'patch' && l.user.kind === 'family') l.send({ type: 'changed', rev: e.rev, mutationId: e.mutationId });
    else l.send(e);
  }
}
export const broadcastAll = (e: ServerEvent) => { for (const l of listeners) l.send(e); };

/**
 * Run an action authoritatively: execute, persist touched rows, bump rev, broadcast.
 * When it changed who can sign in (a new staff member with app access, a family contact activated), the server then
 * gives them a username through the system action `account.setUsernames`, which broadcasts like any other change.
 */
export async function runAction(clubId: string, name: string, input: unknown, user: User, mutationId: string) {
  const r = await runActionRaw(clubId, name, input, user, mutationId);
  if (r.patches.some((p) => ACCOUNT_COLLECTIONS.has(String(p.path[0])))) {
    try { await syncUsernames(); } catch (e) { console.error('username assignment failed:', scrubError(e)); }
  }
  return r;
}
const ACCOUNT_COLLECTIONS = new Set(['staff', 'familyContacts', 'familyLinks']);

let syncing: Promise<void> = Promise.resolve();
let acctSeq = 0;
/** Assign a username (first name, plus a number if taken; default password) to everyone who can sign in but has none. One run at a time. */
export function syncUsernames(): Promise<void> {
  syncing = syncing.then(async () => {
    const need = accountsNeedingUsername(clubs);
    const byClub = new Map<string, { id: string; username: string }[]>();
    for (const a of need) {
      const username = await claimUsername(a.id, usernameBase(a.name));
      byClub.set(a.clubId, [...(byClub.get(a.clubId) || []), { id: a.id, username }]);
    }
    for (const [clubId, assignments] of byClub) await runActionRaw(clubId, 'account.setUsernames', { assignments }, systemUser(clubId), `acct-${Date.now().toString(36)}-${++acctSeq}`);
  });
  const mine = syncing;
  syncing = syncing.catch(() => {});
  return mine;
}

function runActionRaw(clubId: string, name: string, input: unknown, user: User, mutationId: string) {
  return enqueue(clubId, async () => {
    const s = clubs[clubId];
    if (!s) throw new DomainError('err.notFound');
    const r = execute(s, name, input, user, clockInfo(), mutationId);
    if (!r.patches.length) return { rev: s.rev, patches: [] as Patch[], result: r.result };
    const next: ClubState = { ...r.state, rev: s.rev + 1 };
    const memberId = (input as { memberId?: string })?.memberId;
    await persistMutation(next, r.patches, { at: `${clockInfo().today}T${clockInfo().now}`, actor: user.id, action: name, mutationId, memberId, input });
    clubs[clubId] = next;
    broadcast(clubId, { type: 'patch', rev: next.rev, mutationId, patches: r.patches, by: user.id });
    return { rev: next.rev, patches: r.patches, result: r.result, reviewed: r.reviewed };
  });
}

let resetting: Promise<void> | null = null;
/** Re-seed every clubhouse. One reset at a time: if two people press Reset together, the second shares the first. */
export function resetDemo(): Promise<void> {
  resetting ??= (async () => {
    try {
      await replaceAll(buildSeed(demoDate(), demoNowMin()));
      clubs = await loadAll();
      const clock = await resetClock();
      broadcastAll({ type: 'reset' });
      broadcastAll({ type: 'clock', clock });
    } finally {
      resetting = null;
    }
  })();
  return resetting;
}

let tickBusy = false;
export function startJobs() {
  setInterval(async () => {
    if (tickBusy) return;
    tickBusy = true;
    try {
      for (const id of Object.keys(clubs)) {
        try { await runAction(id, 'jobs.tick', {}, systemUser(id), `job-${Date.now().toString(36)}-${id}`); }
        catch (e) { if (!(e instanceof DomainError)) console.error('job tick failed', e); }
      }
    } finally { tickBusy = false; }
  }, 15000);
}
