// Sign-in and account routes: username + password login, signed session tokens, password change and management reset.
// Who is calling? A browser sends `Authorization: Bearer <token>` (the live event stream, which cannot set headers, uses `?token=`).
// The bare `x-user-id` header is NOT trusted unless CP_TRUST_USER_HEADER=1 (set by scripts/e2e-all.sh and the server tests, never in production).
import type { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { accessState, canAccessClub, findAccount, isMgmt, type User } from '@cp/shared';
import { getClubs, userById } from '../state';
import { signToken, verifyToken } from '../auth';
import { DEFAULT_PASSWORD, MAX_PASSWORD, MIN_PASSWORD, burnHash, credentialByUser, credentialByUsername, hashPassword, normUsername, scrubError, setPasswordHash, verifyPassword } from '../db/credentials';

export const publicUser = (u: User) =>
  u.kind === 'staff'
    ? { kind: 'staff' as const, id: u.id, name: u.staff.name, knownAs: u.staff.knownAs, role: u.staff.role, title: u.staff.title, clubId: u.clubId, clubs: u.clubs }
    : { kind: 'family' as const, id: u.id, name: u.contact.name, firstName: u.contact.firstName, role: 'family' as const, clubId: u.clubId, clubs: [u.clubId], memberIds: u.memberIds, lang: u.contact.lang };

/** The signed-in user for this request, or null. A bearer token (header, or `?token=` when `allowQuery`) is authoritative: if it is bad, nothing else is tried. */
export function authUser(c: Context, allowQuery = false): User | null {
  const header = c.req.header('authorization');
  const bearer = header ? header.match(/^Bearer\s+(\S+)$/i)?.[1] ?? '' : allowQuery ? c.req.query('token') : undefined;
  if (bearer !== undefined) {
    const id = verifyToken(bearer);
    return id ? userById(id) : null;
  }
  if (process.env.CP_TRUST_USER_HEADER === '1') return userById(c.req.header('x-user-id'));
  return null;
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const readBody = async (c: Context) => ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;

export function registerAuthRoutes(app: Hono) {
  // a failing database call must not print the query parameters (they hold password hashes)
  app.onError((e, c) => {
    if (e instanceof HTTPException) return e.getResponse();
    console.error('request failed:', c.req.method, c.req.path, scrubError(e));
    return c.json({ code: 'err.server' }, 500);
  });
  // Username + password. A wrong username and a wrong password give the same answer (and take the same time).
  app.post('/api/login', async (c) => {
    const b = await readBody(c);
    const username = normUsername(text(b.username));
    const password = text(b.password);
    if (!username || !password) return c.json({ ok: false, reason: 'empty', code: 'login.errEmpty' }, 400);
    const cred = password.length <= 200 ? await credentialByUsername(username) : undefined;
    const good = cred ? await verifyPassword(password, cred.passwordHash) : (await burnHash(password), false);
    if (!cred || !good) return c.json({ ok: false, reason: 'invalid', code: 'login.errInvalid' }, 401);
    const u = userById(cred.userId);
    if (!u) {
      const pending = accessState(getClubs(), cred.userId) === 'pending';
      return c.json({ ok: false, reason: pending ? 'pending' : 'noAccess', code: pending ? 'login.pending' : 'login.noAccess' }, 403);
    }
    return c.json({ ok: true, user: publicUser(u), token: signToken(u.id) });
  });

  // One-tap demo accounts (login page and Demo panel): no password. Set CP_DEMO_LOGIN=0 to switch this off.
  app.post('/api/verify', async (c) => {
    if (process.env.CP_DEMO_LOGIN === '0') return c.json({ ok: false, reason: 'disabled' }, 403);
    const { userId, code } = (await readBody(c)) as { userId?: string; code?: string };
    if (!/^\d{6}$/.test(String(code || ''))) return c.json({ ok: false, reason: 'code' }, 400);
    const u = userById(userId);
    if (!u) return c.json({ ok: false, reason: 'noAccess' }, 401);
    return c.json({ ok: true, user: publicUser(u), token: signToken(u.id) });
  });

  app.get('/api/session', (c) => {
    const u = authUser(c);
    return u ? c.json({ user: publicUser(u) }) : c.json({ user: null }, 401);
  });

  // Your own sign-in name (fixed). The password is never returned, by this or any other route.
  app.get('/api/account', async (c) => {
    const u = authUser(c);
    if (!u) return c.json({ code: 'err.forbidden' }, 401);
    const cred = await credentialByUser(u.id);
    return c.json({ username: cred?.username ?? null });
  });

  // Change your own password. Errors are 422 (never 401: the browser signs out on 401).
  app.post('/api/account/password', async (c) => {
    const u = authUser(c);
    if (!u) return c.json({ code: 'err.forbidden' }, 401);
    const b = await readBody(c);
    const current = text(b.current), next = text(b.next);
    const cred = await credentialByUser(u.id);
    if (!cred) return c.json({ code: 'err.notFound' }, 404);
    if (!current || !(await verifyPassword(current, cred.passwordHash))) return c.json({ code: 'login.errCurrent' }, 422);
    if (next.length < MIN_PASSWORD) return c.json({ code: 'login.errShort', params: { n: MIN_PASSWORD } }, 422);
    if (next.length > MAX_PASSWORD) return c.json({ code: 'login.errLong', params: { n: MAX_PASSWORD } }, 422);
    if (next === current || normUsername(next) === cred.username) return c.json({ code: 'login.errSame' }, 422);
    await setPasswordHash(u.id, await hashPassword(next));
    return c.json({ ok: true });
  });

  // Management: put someone's password back to the default.
  app.post('/api/account/reset-password', async (c) => {
    const u = authUser(c);
    if (!u) return c.json({ code: 'err.forbidden' }, 401);
    if (!isMgmt(u)) return c.json({ code: 'err.forbidden' }, 403);
    const userId = text((await readBody(c)).userId);
    const acct = userId ? findAccount(getClubs(), userId) : undefined;
    const cred = acct ? await credentialByUser(userId) : undefined;
    if (!acct || !cred) return c.json({ code: 'err.notFound' }, 404);
    if (!canAccessClub(u, acct.clubId)) return c.json({ code: 'err.forbidden' }, 403);
    await setPasswordHash(userId, await hashPassword(DEFAULT_PASSWORD));
    return c.json({ ok: true, username: cred.username, defaultPassword: DEFAULT_PASSWORD });
  });
}
