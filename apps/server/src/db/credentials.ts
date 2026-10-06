// Sign-in credentials (server-only): a unique username and a salted scrypt hash per staff member or family contact.
// Nothing here is ever copied into club state, actions, patches, audit logs or console output.
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { accountRows, DEFAULT_PASSWORD, MAX_PASSWORD, MIN_PASSWORD, type ClubState } from '@cp/shared';
import { db } from './client';
import { credentials } from './schema';

export { DEFAULT_PASSWORD, MAX_PASSWORD, MIN_PASSWORD };

const N = 16384, R = 8, P = 1, KEYLEN = 32;
const scrypt = (pw: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, keylen, opts, (e, key) => (e ? reject(e) : resolve(key))));

/** `scrypt$N$r$p$salt$hash` (base64): a fresh random salt per password. */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
let dummy: Promise<string> | undefined;
/** Checked when the username does not exist, so a wrong username takes as long as a wrong password. */
export const burnHash = async (pw: string) => { dummy ??= hashPassword('not-a-real-account'); await verifyPassword(pw, await dummy); };

/** An error message that is safe to print: database errors list the query parameters, which here would include a password hash. */
export const scrubError = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/params:[\s\S]*$/i, 'params: [hidden]').replace(/scrypt\$[^\s,)'"]*/g, '[hash]');

export const normUsername = (s: string) => s.trim().toLowerCase();

export async function credentialByUsername(username: string) {
  return (await db.select().from(credentials).where(eq(credentials.username, normUsername(username))))[0];
}
export async function credentialByUser(userId: string) {
  return (await db.select().from(credentials).where(eq(credentials.userId, userId)))[0];
}
export async function setPasswordHash(userId: string, passwordHash: string) {
  const r = await db.update(credentials).set({ passwordHash, updatedAt: new Date() }).where(eq(credentials.userId, userId)).returning({ userId: credentials.userId });
  return r.length > 0;
}

/**
 * Reserve a username for someone and give them the default password: the base name, then base2, base3, ... until one is free.
 * Idempotent: a person who already has credentials keeps their username.
 */
export async function claimUsername(userId: string, base: string): Promise<string> {
  const have = await credentialByUser(userId);
  if (have) return have.username;
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  for (let n = 1; n < 1000; n++) {
    const username = n === 1 ? base : base + n;
    const rows = await db.insert(credentials).values({ userId, username, passwordHash }).onConflictDoNothing().returning({ username: credentials.username });
    if (rows.length) return username;
    const raced = await credentialByUser(userId); // another request reserved a name for this person meanwhile
    if (raced) return raced.username;
  }
  throw new Error('no free username');
}

type Entry = { userId: string; username: string };
const entriesOf = (states: Record<string, ClubState>): Entry[] =>
  accountRows(states).flatMap((a) => (a.username ? [{ userId: a.id, username: a.username }] : []));
const withDefaultHashes = async (entries: Entry[]) => {
  const hashes = await Promise.all(entries.map(() => hashPassword(DEFAULT_PASSWORD)));
  return entries.map((e, i) => ({ ...e, passwordHash: hashes[i] }));
};

/** Hash the default password for every account the seed (or given states) names, ready to insert in the same transaction as the states. */
export async function prepareCredentials(states: Record<string, ClubState>) {
  return withDefaultHashes(entriesOf(states));
}
type Tx = Pick<typeof db, 'delete' | 'insert'>;
/** Replace every credential row (demo reset, db:reset, first boot): everyone is back on the default password. */
export async function replaceCredentials(tx: Tx, rows: Awaited<ReturnType<typeof prepareCredentials>>) {
  await tx.delete(credentials);
  if (rows.length) await tx.insert(credentials).values(rows);
}
/** Boot: anyone whose state names a username but who has no credentials row (an older database) gets the default password. */
export async function seedMissingCredentials(states: Record<string, ClubState>) {
  const entries = entriesOf(states);
  if (!entries.length) return;
  const have = new Set((await db.select({ id: credentials.userId }).from(credentials).where(inArray(credentials.userId, entries.map((e) => e.userId)))).map((r) => r.id));
  const missing = entries.filter((e) => !have.has(e.userId));
  if (!missing.length) return;
  await db.insert(credentials).values(await withDefaultHashes(missing)).onConflictDoNothing();
}
