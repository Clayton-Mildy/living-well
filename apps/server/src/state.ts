// Canonical in-memory club states (loaded from Postgres), serialized action pipeline per club, SSE fan-out.
import { buildSeed, execute, systemUser, DomainError, getUser, accountsNeedingUsername, usernameBase, type ClubState, type Patch, type User } from '@cp/shared';
import { loadAll, persistMutation, replaceAll } from './db/store';
import { clockInfo, demoDate, demoNowMin, loadClock, resetClock } from './clock';
import { runMigrations, ensureDatabase } from './db/setup';
import { claimUsername, scrubError, seedMissingCredentials } from './db/credentials';
import { loadSecret } from './auth';
import { formDoc, signingOf } from '@cp/shared/rules/signing';
import { stampProvider, type StampProvider } from './providers/stampProvider';

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
    await replaceAll(buildSeed(demoDate(), demoNowMin(), { roster: process.env.CP_SEED_SMALL !== '1' }));
    clubs = await loadAll();
  }
  await loadClock();
  // a demo left from an earlier day starts fresh on today's date (the seed is built around the demo day)
  if (clockInfo().today !== demoDate()) {
    await replaceAll(buildSeed(demoDate(), demoNowMin(), { roster: process.env.CP_SEED_SMALL !== '1' }));
    clubs = await loadAll();
    await resetClock();
    console.log(`New demo day ${demoDate()}: demo data reset.`);
  }
  await loadSecret();
  await seedMissingCredentials(clubs);
  await syncUsernames(); // older databases: give everyone who can sign in a username
  stampProvider(); // an unknown CP_STAMP_PROVIDER stops the server here, at boot
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
  if (user.id !== 'system') stampCountersigned(clubId).catch((e) => console.error('stamp sweep failed:', scrubError(e))); // fire and forget: the stamp lands a moment later as a normal change
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

// e-Meterai: the server stamps every countersigned e-Meterai form that has no serial yet (after any action, and on the jobs tick).
// One sweep per club at a time; a request that arrives while one runs makes it look once more, so a form countersigned meanwhile is not missed.
let stamper: StampProvider | null = null;
/** Tests swap the provider; null goes back to the configured one. */
export function setStampProvider(p: StampProvider | null) { stamper = p; }
const sweeps = new Map<string, Promise<number>>();
const sweepAgain = new Set<string>();
/** The sweep running for the club, or a resolved 0: lets tests wait for the fire-and-forget sweep instead of sleeping. */
export const lastSweep = (clubId: string): Promise<number> => sweeps.get(clubId) ?? Promise.resolve(0);

const awaitingStamp = (s: ClubState | undefined) =>
  Object.values(s?.members || {}).filter((m) => { const g = signingOf(m); return g?.status === 'countersigned' && g.meterai === 'e' && !g.meteraiSerial; });

/** Affix the e-Meterai to every countersigned form without a serial. Resolves with how many were stamped; provider errors are logged and leave the form countersigned. */
export async function stampCountersigned(clubId: string): Promise<number> {
  const running = sweeps.get(clubId);
  if (running) { sweepAgain.add(clubId); return running; }
  if (!awaitingStamp(clubs[clubId]).length) return 0;
  const p = (async () => {
    let stamped = 0;
    do {
      sweepAgain.delete(clubId);
      for (const m of awaitingStamp(clubs[clubId])) {
        try {
          const { serial, at } = await (stamper ?? stampProvider()).affix({ documentId: formDoc(m)!.id, memberId: m.id });
          await runActionRaw(clubId, 'signing.stamp', { memberId: m.id, serial, at }, systemUser(clubId), `stamp-${Date.now().toString(36)}-${m.id}`);
          stamped++;
        } catch (e) { console.error(`stamp failed for ${m.id}:`, scrubError(e)); }
      }
    } while (sweepAgain.has(clubId));
    return stamped;
  })().finally(() => sweeps.delete(clubId));
  sweeps.set(clubId, p);
  return p;
}

let resetting: Promise<void> | null = null;
/** Re-seed every clubhouse. One reset at a time: if two people press Reset together, the second shares the first. */
export function resetDemo(): Promise<void> {
  resetting ??= (async () => {
    try {
      await replaceAll(buildSeed(demoDate(), demoNowMin(), { roster: process.env.CP_SEED_SMALL !== '1' }));
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
/** One round of the scheduled work for every clubhouse (the 15 s timer, and the demo clock when it moves to another day). */
export async function runJobsNow(wait = true) {
  while (tickBusy && wait) await new Promise((r) => setTimeout(r, 25)); // a timer round in progress finishes first, so this one sees the new day
  if (tickBusy) return;
  tickBusy = true;
  try {
    for (const id of Object.keys(clubs)) {
      try { await runAction(id, 'jobs.tick', {}, systemUser(id), `job-${Date.now().toString(36)}-${id}`); }
      catch (e) { if (!(e instanceof DomainError)) console.error('job tick failed', e); }
      await stampCountersigned(id); // never throws: provider errors are logged inside
    }
  } finally { tickBusy = false; }
}
export function startJobs() {
  setInterval(() => { void runJobsNow(false); }, 15000);
}
