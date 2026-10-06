// Session tokens: stateless and HMAC-signed. A token names the user and an expiry; nothing else is stored or looked up.
//   token = base64url(JSON {u: userId, exp: epoch ms}) + '.' + base64url(HMAC-SHA256(secret, body))
// The secret is SESSION_SECRET from the environment, or a random value generated once and kept in the `meta` table
// (so tokens survive restarts and demo resets, but never leave this database).
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { meta } from './db/schema';

export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let secret: Buffer | null = null;

/** Load (or create) the signing secret. Called once at boot, before any request is served. */
export async function loadSecret() {
  if (process.env.SESSION_SECRET) { secret = Buffer.from(process.env.SESSION_SECRET); return; }
  const get = async () => (await db.select().from(meta).where(eq(meta.key, 'sessionSecret')))[0]?.value as string | undefined;
  let hex = await get();
  if (!hex) {
    await db.insert(meta).values({ key: 'sessionSecret', value: randomBytes(32).toString('hex') }).onConflictDoNothing();
    hex = await get();
  }
  secret = Buffer.from(hex!, 'hex');
}
const key = () => {
  if (!secret) throw new Error('session secret not loaded (call boot first)');
  return secret;
};
const sign = (body: string) => createHmac('sha256', key()).update(body).digest('base64url');

export function signToken(userId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: userId, exp: now + TOKEN_TTL_MS })).toString('base64url');
  return `${body}.${sign(body)}`;
}
/** The user id inside a valid, unexpired token; null for anything else (wrong signature, expired, malformed). */
export function verifyToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token || token.length > 512) return null;
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { u?: unknown; exp?: unknown };
    return typeof u === 'string' && typeof exp === 'number' && exp > now ? u : null;
  } catch { return null; }
}
