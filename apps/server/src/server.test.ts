// Server routes against a separate test database (citrapremier_test on the Homebrew Postgres, port 5434).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://localhost:5434/citrapremier_test';
// Tests call the API without a browser session: they may name the user with `x-user-id`. The auth tests below switch this off to prove a browser cannot.
process.env.CP_TRUST_USER_HEADER = '1';
type AppMod = typeof import('./app');
type StateMod = typeof import('./state');
let app: AppMod['app'];
let state: StateMod;
let sql: typeof import('./db/client')['sql'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response): Promise<any> => r.json();
const json = (body: unknown, user?: string) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...(user ? { 'x-user-id': user } : {}) }, body: JSON.stringify(body) });
beforeAll(async () => {
  state = await import('./state');
  await state.boot();
  await state.resetDemo();
  app = (await import('./app')).app;
  sql = (await import('./db/client')).sql;
});
afterAll(async () => { await sql.end(); });

const login = (username: string, password: string) => app.request('/api/login', json({ username, password }));
const bearer = (token: string, extra: Record<string, string> = {}) => ({ headers: { authorization: `Bearer ${token}`, ...extra } });
const tokenOf = async (username: string, password = 'citra123') => (await j(await login(username, password))).token as string;
const SEED_NAMES = ['caca', 'yohanes', 'agus', 'siti', 'dinar', 'dimas', 'joko', 'dewi', 'ega', 'fransiska', 'maria', 'daniel', 'cynthia', 'stephanie', 'laras', 'yohana'];

describe('auth: username and password', () => {
  it('signs in with the seed username and the demo password, returns the user and a session token', async () => {
    const r = await login('caca', 'citra123');
    expect(r.status).toBe(200);
    const body = await j(r);
    expect(body).toMatchObject({ ok: true, user: { id: 's1', kind: 'staff', role: 'lobby' } });
    expect(typeof body.token).toBe('string');
    const fam = await j(await login('maria', 'citra123'));
    expect(fam).toMatchObject({ ok: true, user: { id: 'f1', kind: 'family', memberIds: ['m1', 'm46'] } });
  });
  it('ignores case and surrounding spaces in the username', async () => {
    expect((await j(await login('  Maria ', 'citra123'))).user.id).toBe('f1');
  });
  it('every seed account has a credential; staff without app access are told so', async () => {
    const [n] = await sql`select count(*)::int as n from credentials`;
    expect(n.n).toBe(SEED_NAMES.length);
    for (const name of SEED_NAMES) {
      const r = await login(name, 'citra123');
      if (name === 'siti' || name === 'joko') {
        expect(r.status).toBe(403);
        expect(await j(r)).toMatchObject({ ok: false, reason: 'noAccess', code: 'login.noAccess' });
      } else expect((await j(r)).ok, name).toBe(true);
    }
  });
  it('a wrong password and an unknown username get the same clear error', async () => {
    const wrong = await login('caca', 'citra124');
    const unknown = await login('nobody', 'citra123');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await j(wrong)).toEqual({ ok: false, reason: 'invalid', code: 'login.errInvalid' });
    expect(await j(unknown)).toEqual({ ok: false, reason: 'invalid', code: 'login.errInvalid' });
    const empty = await login('caca', '');
    expect(empty.status).toBe(400);
    expect((await j(empty)).code).toBe('login.errEmpty');
    expect((await app.request('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not json' })).status).toBe(400);
  });
  it('the old phone sign-in is gone', async () => {
    const r = await app.request('/api/login', json({ phone: '0812 1090 4471' }));
    expect(r.status).toBe(400);
  });
  it('the demo one-tap sign-in (no password) still works and returns a token; any 6 digits, nothing else', async () => {
    const r = await j(await app.request('/api/verify', json({ userId: 's1', code: '000000' })));
    expect(r).toMatchObject({ ok: true, user: { id: 's1' } });
    expect(typeof r.token).toBe('string');
    expect((await app.request('/api/verify', json({ userId: 's1', code: '12345' }))).status).toBe(400);
    expect((await app.request('/api/verify', json({ userId: 's4', code: '000000' }))).status).toBe(401); // no app access
    process.env.CP_DEMO_LOGIN = '0';
    expect((await app.request('/api/verify', json({ userId: 's1', code: '000000' }))).status).toBe(403);
    delete process.env.CP_DEMO_LOGIN;
  });
});

describe('auth: session tokens', () => {
  it('a token authorises requests without x-user-id, and the snapshot is that user', async () => {
    const t = await tokenOf('maria');
    const snap = await j(await app.request('/api/snapshot', bearer(t)));
    expect(snap.user.id).toBe('f1');
    expect(snap.self.contact.username).toBe('maria');
    const session = await j(await app.request('/api/session', bearer(t)));
    expect(session.user.id).toBe('f1');
  });
  it('without CP_TRUST_USER_HEADER the bare x-user-id header means nothing', async () => {
    process.env.CP_TRUST_USER_HEADER = '0';
    try {
      expect((await app.request('/api/snapshot', { headers: { 'x-user-id': 's9' } })).status).toBe(401);
      expect((await app.request('/api/actions/attendance.checkIn', json({ mutationId: 'tok-1', input: { memberId: 'm1', method: 'manual' } }, 's1'))).status).toBe(401);
      expect((await app.request('/api/account', { headers: { 'x-user-id': 's9' } })).status).toBe(401);
      const t = await tokenOf('ega');
      expect((await app.request('/api/snapshot', bearer(t))).status).toBe(200);
      expect((await app.request('/api/snapshot', bearer(t, { 'x-user-id': 'f1' }))).status).toBe(200); // the token decides, not the header
      expect((await j(await app.request('/api/session', bearer(t, { 'x-user-id': 'f1' })))).user.id).toBe('s9');
    } finally { process.env.CP_TRUST_USER_HEADER = '1'; }
  });
  it('rejects forged, tampered, expired and malformed tokens, even when x-user-id is trusted', async () => {
    const t = await tokenOf('maria');
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ u: 's9', exp: Date.now() + 1e9 })).toString('base64url');
    const bad = [`${forged}.${sig}`, `${body}.${sig.slice(0, -2)}xx`, `${body}`, 'garbage', `${t}.extra`, ''];
    for (const x of bad) expect((await app.request('/api/snapshot', { headers: { authorization: `Bearer ${x}`, 'x-user-id': 's9' } })).status, x).toBe(401);
    const { signToken, verifyToken } = await import('./auth');
    expect(verifyToken(signToken('s1'))).toBe('s1');
    expect(verifyToken(signToken('s1', Date.now() - 31 * 24 * 3600 * 1000))).toBeNull(); // expired
  });
  it('the live event stream takes the token as ?token= and refuses a bad one', async () => {
    const t = await tokenOf('caca');
    expect((await app.request('/api/events?club=citra&token=nope')).status).toBe(401);
    expect((await app.request('/api/events?club=citra&uid=s1')).status).toBe(401); // the user id alone is not a credential
    const ok = await app.request(`/api/events?club=citra&token=${t}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('text/event-stream');
    await ok.body?.cancel();
    // the ?token= form is for the event stream only
    expect((await app.request(`/api/snapshot?token=${t}`)).status).toBe(401);
  });
});

describe('auth: change and reset password', () => {
  it('GET /api/account returns your username', async () => {
    expect(await j(await app.request('/api/account', bearer(await tokenOf('daniel'))))).toEqual({ username: 'daniel' });
    expect((await app.request('/api/account')).status).toBe(401);
  });
  it('changes your own password: current must match, the new one is checked, then only the new one signs in', async () => {
    const t = await tokenOf('daniel');
    const post = (body: unknown) => app.request('/api/account/password', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify(body) });
    expect((await post({ current: 'wrong-one', next: 'a-new-secret' })).status).toBe(422);
    expect((await j(await post({ current: 'wrong-one', next: 'a-new-secret' }))).code).toBe('login.errCurrent');
    expect((await j(await post({ current: 'citra123', next: 'short' }))).code).toBe('login.errShort');
    expect((await j(await post({ current: 'citra123', next: 'citra123' }))).code).toBe('login.errSame');
    expect((await j(await post({ current: 'citra123', next: 'x'.repeat(80) }))).code).toBe('login.errLong');
    expect((await app.request('/api/account/password', json({ current: 'citra123', next: 'a-new-secret' }))).status).toBe(401);
    expect((await post({ current: 'citra123', next: 'a-new-secret' })).status).toBe(200);
    expect((await login('daniel', 'citra123')).status).toBe(401);
    expect((await login('daniel', 'a-new-secret')).status).toBe(200);
    expect((await app.request('/api/snapshot', bearer(t))).status).toBe(200); // the current session carries on
    expect(await j(await app.request('/api/account', bearer(t)))).toEqual({ username: 'daniel' }); // the username never changes
  });
  it('management resets a password to the default; nobody else can', async () => {
    expect((await login('daniel', 'a-new-secret')).status).toBe(200); // from the previous test
    const reset = (userId: string, as?: string) => app.request('/api/account/reset-password', as ? { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${as}` }, body: JSON.stringify({ userId }) } : json({ userId }));
    expect((await reset('f2')).status).toBe(401);
    expect((await reset('f2', await tokenOf('caca'))).status).toBe(403); // lobby
    expect((await reset('f2', await tokenOf('fransiska'))).status).toBe(403); // finance
    expect((await reset('f2', await tokenOf('maria'))).status).toBe(403); // family
    expect((await login('daniel', 'a-new-secret')).status).toBe(200); // still the changed password
    const mgmt = await tokenOf('ega');
    const r = await reset('f2', mgmt);
    expect(r.status).toBe(200);
    expect(await j(r)).toMatchObject({ ok: true, username: 'daniel', defaultPassword: 'citra123' });
    expect((await login('daniel', 'a-new-secret')).status).toBe(401);
    expect((await login('daniel', 'citra123')).status).toBe(200);
    expect((await reset('nobody', mgmt)).status).toBe(404);
    expect((await reset('', mgmt)).status).toBe(404);
  });
});

describe('auth: nothing secret in state, snapshots, the audit log or the database dump', () => {
  it('no password or hash appears in a staff or family snapshot, the club state, or the audit log', async () => {
    await app.request('/api/actions/attendance.checkOut', json({ mutationId: 'sec-1', input: { memberId: 'm1' } }, 's1')); // some audit rows
    const t = await tokenOf('ega');
    await app.request('/api/account/reset-password', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify({ userId: 'f1' }) });
    const dumps = [
      JSON.stringify(await j(await app.request('/api/snapshot', bearer(t)))),
      JSON.stringify(await j(await app.request('/api/snapshot', bearer(await tokenOf('maria'))))),
      JSON.stringify(state.getClub('citra')),
      JSON.stringify(await sql`select data from audit_log`),
    ];
    const [cred] = await sql`select password_hash from credentials where user_id = 'f1'`;
    expect(cred.password_hash).toMatch(/^scrypt\$/);
    for (const d of dumps) {
      expect(d).not.toContain('scrypt$');
      expect(d).not.toMatch(/password|citra123/i);
      expect(d).not.toContain(cred.password_hash);
    }
  });
  it('usernames are in club state for staff, but a family user sees only their own', async () => {
    const staff = await j(await app.request('/api/snapshot', bearer(await tokenOf('ega'))));
    expect(staff.state.staff.s1.username).toBe('caca');
    expect(staff.state.familyContacts.f2.username).toBe('daniel');
    const fam = await j(await app.request('/api/snapshot', bearer(await tokenOf('maria'))));
    expect(fam.state.familyContacts.f1.username).toBe('maria');
    expect(fam.state.familyContacts.f2.username).toBeUndefined();
    expect(Object.values(fam.state.staff).every((x: any) => x.username === undefined)).toBe(true);
  });
  it('each password is salted: the same password hashes differently for two people', async () => {
    const rows = await sql`select password_hash from credentials where user_id in ('s1', 's2')`;
    expect(rows[0].password_hash).not.toBe(rows[1].password_hash);
  });
});

describe('auth: usernames for new accounts', () => {
  const act = async (name: string, input: unknown, user = 's9') => { const r = await app.request(`/api/actions/${name}`, json({ mutationId: `acct-t-${name}-${Math.random().toString(36).slice(2)}`, club: 'citra', input }, user)); return { status: r.status, body: await j(r) }; };
  const staffIn = (id: string) => (state.getClub('citra').staff as Record<string, { username?: string }>)[id];
  const contactIn = (id: string) => (state.getClub('citra').familyContacts as Record<string, { username?: string }>)[id];
  const newStaff = (name: string, appAccess: boolean) => ({ name, role: 'lobby', title: 'Front of house', phone: `0813${Math.floor(1e7 + Math.random() * 9e7)}`, appAccess, hr: { contract: 'pkwtt' } });

  it('a new staff member with app access gets the first name (plus a number if taken), the default password, and it is broadcast', async () => {
    const events: { type: string; patches?: { path: (string | number)[] }[] }[] = [];
    const unsub = state.subscribe({ clubId: 'citra', user: state.userById('s9')!, send: (e) => events.push(e as never) });
    const a = await act('staff.create', newStaff('Caca Baru', true));
    expect(a.status).toBe(200);
    const id = a.body.result.staffId as string;
    unsub();
    expect(staffIn(id).username).toBe('caca2'); // 'caca' is Caca's
    expect(events.some((e) => e.type === 'patch' && e.patches?.some((p) => p.path[0] === 'staff' && p.path[1] === id && p.path[2] === 'username'))).toBe(true);
    const r = await login('caca2', 'citra123');
    expect(await j(r)).toMatchObject({ ok: true, user: { id } });
    const b = await act('staff.create', newStaff('Caca Lagi', true));
    expect(staffIn(b.body.result.staffId).username).toBe('caca3');
  });
  it('without app access there is no username yet; switching access on assigns one', async () => {
    const a = await act('staff.create', newStaff('Budi Santoso', false));
    const id = a.body.result.staffId as string;
    expect(staffIn(id).username).toBeUndefined();
    expect((await login('budi', 'citra123')).status).toBe(401);
    expect((await act('staff.setAppAccess', { staffId: id, on: true })).status).toBe(200);
    expect(staffIn(id).username).toBe('budi');
    expect((await login('budi', 'citra123')).status).toBe(200);
  });
  it('a family contact added by management is active at once and gets a username', async () => {
    const a = await act('family.addContact', { memberId: 'm1', name: 'Daniel Tan', phone: '0813 4000 2233', relation: 'son', primary: false });
    expect(a.status).toBe(200);
    expect(contactIn(a.body.result.familyId).username).toBe('daniel2');
    expect((await j(await login('daniel2', 'citra123'))).user.kind).toBe('family');
  });
  it('a contact added by the lobby has none until management approves; then the username lands in state', async () => {
    const a = await act('family.addContact', { memberId: 'm10', name: 'Dewi Purnomo', phone: '0813 4000 1122', relation: 'daughter', primary: false }, 's1');
    expect(a.body.reviewed).toBe('gate');
    const id = a.body.result.familyId as string;
    expect(contactIn(id).username).toBeUndefined();
    expect((await login('dewi2', 'citra123')).status).toBe(401);
    const ok = await act('review.approve', { crId: a.body.result.changeRequestId });
    expect(ok.status).toBe(200);
    expect(contactIn(id).username).toBe('dewi2'); // 'dewi' is the nurse
    expect((await j(await login('dewi2', 'citra123'))).user.id).toBe(id);
  });
  it('the username is fixed: it survives a rename, and the system action cannot change it', async () => {
    const before = contactIn('f2').username;
    expect(before).toBe('daniel');
    const t = await tokenOf('daniel');
    await app.request('/api/actions/account.updateFamily', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify({ mutationId: 'ren-1', input: { familyId: 'f2', name: 'Daniel W. Wijaya' } }) });
    expect(contactIn('f2').username).toBe('daniel');
    expect((await act('account.setUsernames', { assignments: [{ id: 'f2', username: 'hacker' }] })).status).toBe(403); // even management cannot call it
    expect((await act('account.setUsernames', { assignments: [{ id: 'f2', username: 'hacker' }] }, 'f2')).status).toBe(403);
  });
  it('boot gives a default password to anyone whose state has a username but no credentials row', async () => {
    await sql`delete from credentials where user_id = 'f2'`;
    expect((await login('daniel', 'citra123')).status).toBe(401);
    await state.boot();
    expect((await login('daniel', 'citra123')).status).toBe(200);
  });
  it('demo reset puts every password and username back to the seed', async () => {
    await app.request('/api/actions/staff.create', json({ mutationId: 'rst-pre', input: newStaff('Zed Zulu', true) }, 's9'));
    expect((await login('zed', 'citra123')).status).toBe(200);
    const t = await tokenOf('maria');
    await app.request('/api/account/password', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify({ current: 'citra123', next: 'maria-changed' }) });
    expect((await login('maria', 'citra123')).status).toBe(401);
    expect((await app.request('/api/demo/reset', json({}))).status).toBe(200);
    expect((await login('maria', 'citra123')).status).toBe(200);
    expect((await login('maria', 'maria-changed')).status).toBe(401);
    expect((await login('zed', 'citra123')).status).toBe(401);
    expect((await login('caca2', 'citra123')).status).toBe(401);
    const [n] = await sql`select count(*)::int as n from credentials`;
    expect(n.n).toBe(SEED_NAMES.length);
    expect((await app.request('/api/snapshot', bearer(t))).status).toBe(200); // sessions survive a reset
  }, 20_000); // round 7: a reset now seeds 6 months of history, slower when the whole suite runs at once
});

describe('snapshots', () => {
  it('staff get the full club; family get their projection without staff-only data', async () => {
    const staff = await j(await app.request('/api/snapshot', { headers: { 'x-user-id': 's1' } }));
    expect(Object.keys(staff.state.members)).toHaveLength(5);
    expect(staff.state.members.m1.care.instructions).toContain('right arm');
    const fam = await j(await app.request('/api/snapshot', { headers: { 'x-user-id': 'f1' } }));
    expect(fam.state.members.m1.care.instructions).toBe('');
    expect(Object.keys(fam.state.enquiries)).toHaveLength(0);
    // staff pay is never sent; the only staff phone a family gets is the front desk's (the "WhatsApp the club" link)
    const withPhone = Object.values(fam.state.staff).filter((x: any) => x.phone !== '') as any[];
    expect(withPhone.map((x) => x.role)).toEqual(['lobby']);
    expect(Object.values(fam.state.staff).every((x: any) => x.hr.salary === 0)).toBe(true);
    expect(Object.keys(fam.state.threads)).toHaveLength(0);
    expect(Object.keys(fam.state.messages)).toHaveLength(0);
  });
  it('club access is enforced', async () => {
    expect((await app.request('/api/snapshot?club=adina', { headers: { 'x-user-id': 's1' } })).status).toBe(403);
    expect((await app.request('/api/snapshot?club=adina', { headers: { 'x-user-id': 's9' } })).status).toBe(200);
    expect((await app.request('/api/snapshot', {})).status).toBe(401);
  });
});

describe('actions', () => {
  it('persists, bumps the revision, writes the audit log and broadcasts', async () => {
    const events: string[] = [];
    const u = state.userById('s9')!;
    const unsub = state.subscribe({ clubId: 'citra', user: u, send: (e) => events.push(e.type) });
    const before = state.getClub('citra').rev;
    const r = await app.request('/api/actions/attendance.checkIn', json({ mutationId: 'srv-1', club: 'citra', input: { memberId: 'm1', method: 'face' } }, 's1'));
    expect(r.status).toBe(200);
    const body = await j(r);
    expect(body.rev).toBe(before + 1);
    expect(events).toContain('patch');
    unsub();
    const [row] = await sql`select data->'checkIn'->>'at' as at from attendance where club_id = 'citra' and id = '2026-10-21:m1'`;
    expect(row.at).toMatch(/^\d\d:\d\d$/);
    const [audit] = await sql`select action from audit_log where mutation_id = 'srv-1'`;
    expect(audit.action).toBe('attendance.checkIn');
    const [club] = await sql`select rev from clubs where id = 'citra'`;
    expect(club.rev).toBe(before + 1);
  });
  it('family users get a "changed" ping instead of patches', async () => {
    const events: string[] = [];
    const unsub = state.subscribe({ clubId: 'citra', user: state.userById('f1')!, send: (e) => events.push(e.type) });
    await app.request('/api/actions/attendance.checkIn', json({ mutationId: 'srv-2', input: { memberId: 'm46', method: 'manual' } }, 's1'));
    unsub();
    expect(events).toEqual(['changed']);
  });
  it('returns 403 for forbidden and 422 for domain errors', async () => {
    expect((await app.request('/api/actions/review.approve', json({ mutationId: 'srv-3', input: { crId: 'cr-seed-1' } }, 's1'))).status).toBe(403);
    const dup = await app.request('/api/actions/attendance.checkIn', json({ mutationId: 'srv-4', input: { memberId: 'm1', method: 'manual' } }, 's1'));
    expect(dup.status).toBe(422);
    expect((await j(dup)).code).toBe('err.alreadyCheckedIn');
  });
  it('demo reset restores the seed', async () => {
    expect((await app.request('/api/demo/reset', json({}))).status).toBe(200);
    expect(state.getClub('citra').rev).toBe(0);
    expect(state.getClub('citra').attendance['2026-10-21:m1']).toBeUndefined();
    const [n] = await sql`select count(*)::int as n from attendance where id = '2026-10-21:m1'`;
    expect(n.n).toBe(0);
  });
});

describe('demo accounts', () => {
  it('lists staff and family demo accounts', async () => {
    const r = await j(await app.request('/api/demo/accounts'));
    expect(r.accounts.map((a: any) => a.id)).toEqual(expect.arrayContaining(['s1', 's9', 'f1', 'f2', 's10']));
    expect(r.accounts.find((a: any) => a.id === 'f1')).toMatchObject({ member: 'Oma Lina & Opa Budi', billing: true });
  });
});

describe('media (photos)', () => {
  // a 1x1 PNG, and the first bytes of a JPEG and a WebP
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]).toString('base64');
  const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(16, 2)]).toString('base64');

  it('stores a photo and serves it back with long cache headers (round trip)', async () => {
    const up = await app.request('/api/media', json({ mime: 'image/png', data: PNG }, 's6'));
    expect(up.status).toBe(201);
    const { id, url, bytes } = await j(up);
    expect(id).toMatch(/^md_[A-Za-z0-9_-]{20,}$/);
    expect(url).toBe(`/api/media/${id}`);
    expect(bytes).toBe(Buffer.from(PNG, 'base64').length);

    const get = await app.request(url); // no sign-in: an <img> tag cannot send the session token
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/png');
    expect(get.headers.get('cache-control')).toContain('max-age=31536000');
    expect(get.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await get.arrayBuffer()).toString('base64')).toBe(PNG);

    const again = await app.request(url, { headers: { 'if-none-match': get.headers.get('etag') || '' } });
    expect(again.status).toBe(304);
    const [row] = await sql`select club_id, created_by, mime, bytes from media where id = ${id}`;
    expect(row).toMatchObject({ club_id: 'citra', created_by: 's6', mime: 'image/png', bytes });
  });
  it('accepts JPEG and WebP, and gives each upload its own random id', async () => {
    const a = await j(await app.request('/api/media', json({ mime: 'image/jpeg', data: JPEG }, 's6')));
    const b = await j(await app.request('/api/media', json({ mime: 'image/webp', data: `data:image/webp;base64,${WEBP}` }, 's6')));
    expect(a.id).not.toBe(b.id);
    expect((await app.request(`/api/media/${b.id}`)).headers.get('content-type')).toBe('image/webp');
  });
  it('needs a signed-in user to upload', async () => {
    expect((await app.request('/api/media', json({ mime: 'image/png', data: PNG }))).status).toBe(401);
  });
  it('rejects anything that is not a JPEG, PNG or WebP', async () => {
    const text = Buffer.from('hello, this is not a picture').toString('base64');
    expect((await app.request('/api/media', json({ mime: 'text/plain', data: text }, 's6'))).status).toBe(415);
    expect((await app.request('/api/media', json({ mime: 'image/gif', data: PNG }, 's6'))).status).toBe(415);
    const lie = await app.request('/api/media', json({ mime: 'image/png', data: text }, 's6')); // says PNG, is text
    expect(lie.status).toBe(415);
    expect((await j(lie)).code).toBe('common.mediaType');
    const mismatch = await app.request('/api/media', json({ mime: 'image/jpeg', data: PNG }, 's6')); // says JPEG, is PNG
    expect(mismatch.status).toBe(415);
    expect((await app.request('/api/media', json({ mime: 'image/png' }, 's6'))).status).toBe(400);
    expect((await app.request('/api/media', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-id': 's6' }, body: 'not json' })).status).toBe(400);
  });
  it('rejects a photo above 5 MB', async () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5 * 1024 * 1024, 7)]).toString('base64');
    const r = await app.request('/api/media', json({ mime: 'image/jpeg', data: big }, 's6'));
    expect(r.status).toBe(413);
    expect((await j(r)).code).toBe('common.mediaTooBig');
  });
  it('404s for an unknown or malformed id', async () => {
    expect((await app.request('/api/media/md_doesnotexistdoesnotexist')).status).toBe(404);
    expect((await app.request('/api/media/..%2f..%2fetc')).status).toBe(404);
  });
});

describe('media (PDF documents)', () => {
  const pdf = (n = 0) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(n, 0x20), Buffer.from('\n%%EOF')]);
  it('stores a PDF and serves it back inline as application/pdf', async () => {
    const up = await app.request('/api/media', json({ mime: 'application/pdf', data: pdf(200).toString('base64') }, 's1'));
    expect(up.status).toBe(201);
    const { id } = await j(up);
    const got = await app.request(`/api/media/${id}`);
    expect(got.status).toBe(200);
    expect(got.headers.get('content-type')).toBe('application/pdf');
    expect(got.headers.get('content-disposition')).toBe('inline');
    expect(Buffer.from(await got.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
  });
  it('checks the file really is a PDF, in both directions', async () => {
    const text = Buffer.from('hello, this is not a pdf').toString('base64');
    expect((await app.request('/api/media', json({ mime: 'application/pdf', data: text }, 's1'))).status).toBe(415);
    expect((await app.request('/api/media', json({ mime: 'application/pdf', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }, 's1'))).status).toBe(415);
    expect((await app.request('/api/media', json({ mime: 'image/png', data: pdf(50).toString('base64') }, 's1'))).status).toBe(415);
    expect((await app.request('/api/media', json({ mime: 'application/pdf', data: pdf(50).toString('base64') }))).status).toBe(401);
  });
  it('allows a PDF up to 10 MB (images stay at 5 MB) and refuses more', async () => {
    expect((await app.request('/api/media', json({ mime: 'application/pdf', data: pdf(6 * 1024 * 1024).toString('base64') }, 's1'))).status).toBe(201);
    const r = await app.request('/api/media', json({ mime: 'application/pdf', data: pdf(10 * 1024 * 1024).toString('base64') }, 's1'));
    expect(r.status).toBe(413);
    expect((await j(r)).code).toBe('common.docTooBig');
  });
});

describe('media (videos)', () => {
  // a tiny WebM (the EBML header every WebM / Matroska file starts with) and an MP4 (an `ftyp` box at byte 4)
  const webmBytes = (n = 64) => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]), Buffer.from('webm'), Buffer.alloc(n, 3)]);
  const mp4Bytes = (n = 64) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.from([0, 0, 2, 0]), Buffer.alloc(n, 5)]);
  const WEBM = webmBytes().toString('base64');
  const MP4 = mp4Bytes().toString('base64');
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('stores a tiny WebM and serves it back as video/webm (round trip), with byte ranges for Safari', async () => {
    const up = await app.request('/api/media', json({ mime: 'video/webm', data: WEBM }, 's6'));
    expect(up.status).toBe(201);
    const { id, url, bytes } = await j(up);
    expect(bytes).toBe(webmBytes().length);
    const get = await app.request(url);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('video/webm');
    expect(get.headers.get('accept-ranges')).toBe('bytes');
    expect(get.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await get.arrayBuffer()).equals(webmBytes())).toBe(true);
    const [row] = await sql`select club_id, created_by, mime, bytes from media where id = ${id}`;
    expect(row).toMatchObject({ club_id: 'citra', created_by: 's6', mime: 'video/webm', bytes });
    // a range: the first 4 bytes are the EBML signature
    const part = await app.request(url, { headers: { range: 'bytes=0-3' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe(`bytes 0-3/${bytes}`);
    expect(part.headers.get('content-length')).toBe('4');
    expect([...Buffer.from(await part.arrayBuffer())]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    // open-ended and "last n bytes" ranges; one outside the file is refused
    expect((await app.request(url, { headers: { range: `bytes=${bytes - 2}-` } })).headers.get('content-range')).toBe(`bytes ${bytes - 2}-${bytes - 1}/${bytes}`);
    expect((await app.request(url, { headers: { range: 'bytes=-5' } })).headers.get('content-range')).toBe(`bytes ${bytes - 5}-${bytes - 1}/${bytes}`);
    expect((await app.request(url, { headers: { range: `bytes=${bytes + 10}-` } })).status).toBe(416);
  });
  it('accepts an MP4 (and a data: URL), and a recorded file needs a signed-in user', async () => {
    const r = await app.request('/api/media', json({ mime: 'video/mp4', data: `data:video/mp4;base64,${MP4}` }, 's6'));
    expect(r.status).toBe(201);
    expect((await app.request(`/api/media/${(await j(r)).id}`)).headers.get('content-type')).toBe('video/mp4');
    expect((await app.request('/api/media', json({ mime: 'video/webm', data: WEBM }))).status).toBe(401);
  });
  it('checks the real file signature, not what the caller claims', async () => {
    const text = Buffer.from('hello, this is not a video').toString('base64');
    for (const [mime, data] of [['video/webm', text], ['video/mp4', text], ['video/mp4', WEBM], ['video/webm', MP4], ['video/webm', PNG], ['video/ogg', WEBM], ['video/quicktime', MP4]] as const) {
      const r = await app.request('/api/media', json({ mime, data }, 's6'));
      expect(r.status, `${mime}`).toBe(415);
      expect((await j(r)).code).toBe('ds.videoType');
    }
    // and a video file cannot pass as an image
    const asImage = await app.request('/api/media', json({ mime: 'image/png', data: WEBM }, 's6'));
    expect(asImage.status).toBe(415);
    expect((await j(asImage)).code).toBe('common.mediaType');
  });
  it('allows a video up to 25 MB (images stay at 5 MB) and refuses more', async () => {
    const six = Buffer.concat([webmBytes(0), Buffer.alloc(6 * 1024 * 1024, 9)]);
    const ok = await app.request('/api/media', json({ mime: 'video/webm', data: six.toString('base64') }, 's6'));
    expect(ok.status).toBe(201);
    const big = Buffer.concat([webmBytes(0), Buffer.alloc(25 * 1024 * 1024, 9)]).toString('base64');
    const r = await app.request('/api/media', json({ mime: 'video/webm', data: big }, 's6'));
    expect(r.status).toBe(413);
    expect((await j(r)).code).toBe('ds.videoTooBig');
    const img = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6 * 1024 * 1024, 7)]).toString('base64');
    const tooBigImage = await app.request('/api/media', json({ mime: 'image/jpeg', data: img }, 's6'));
    expect(tooBigImage.status).toBe(413);
    expect((await j(tooBigImage)).code).toBe('common.mediaTooBig');
  });
  it('a teacher records a video: photo.take stores the mediaId and its length, pending until management approves', async () => {
    const { id } = await j(await app.request('/api/media', json({ mime: 'video/webm', data: WEBM }, 's6')));
    const r = await app.request('/api/actions/photo.take', json({ mutationId: 'vid1', input: { kind: 'solo', memberIds: ['m1'], media: 'video', durationSec: 9, mediaId: id } }, 's6'));
    expect(r.status).toBe(200);
    const snap = await j(await app.request('/api/snapshot?club=citra', { headers: { 'x-user-id': 's9' } }));
    const photo = Object.values(snap.state.photos as Record<string, any>).find((p) => p.mediaId === id);
    expect(photo).toMatchObject({ media: 'video', durationSec: 9, kind: 'solo', visibility: 'pending' });
    // a family never gets a pending video
    const fam = await j(await app.request('/api/snapshot?club=citra', { headers: { 'x-user-id': 'f1' } }));
    expect(Object.values(fam.state.photos as Record<string, any>).some((p) => p.mediaId === id)).toBe(false);
  });
});

describe('byteRange', () => {
  it('reads a Range header against the file size', async () => {
    const { byteRange } = await import('./media');
    expect(byteRange(undefined, 100)).toBeNull();
    expect(byteRange('items=0-5', 100)).toBeNull();
    expect(byteRange('bytes=0-1', 100)).toEqual({ start: 0, end: 1 });
    expect(byteRange('bytes=10-', 100)).toEqual({ start: 10, end: 99 });
    expect(byteRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
    expect(byteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(byteRange('bytes=100-', 100)).toBe('bad');
    expect(byteRange('bytes=20-10', 100)).toBe('bad');
    expect(byteRange('bytes=-0', 100)).toBe('bad');
  });
});
