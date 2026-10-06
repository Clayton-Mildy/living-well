// CitraPremier API app (routes). index.ts boots and listens; tests import this.
// CitraPremier API: sign-in (username + password), snapshots, actions, live events (SSE), demo clock/reset, public membership form.
import 'dotenv/config';
import { Hono } from 'hono';

import { streamSSE } from 'hono/streaming';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { DomainError, projectForFamily, canAccessClub, systemUser, live } from '@cp/shared';
import { getClub, getClubs, runAction, subscribe, resetDemo, broadcastAll } from './state';
import { clockInfo, setClock } from './clock';
import { authUser, publicUser, registerAuthRoutes } from './routes/auth';
import { byteRange, checkUpload, loadMedia, saveMedia } from './media';

export const app = new Hono();
const errBody = (e: unknown) => (e instanceof DomainError ? { code: e.code, params: e.params } : { code: 'err.server', params: { message: e instanceof Error ? e.message : String(e) } });

app.get('/api/health', (c) => c.json({ ok: true, clock: clockInfo() }));
app.get('/api/clock', (c) => c.json(clockInfo()));

// sign-in, session token, account (routes/auth.ts)
registerAuthRoutes(app);

app.get('/api/snapshot', (c) => {
  const u = authUser(c);
  if (!u) return c.json({ code: 'err.forbidden' }, 401);
  const clubId = c.req.query('club') || u.clubId;
  if (!canAccessClub(u, clubId) || !getClub(clubId)) return c.json({ code: 'err.forbidden' }, 403);
  const s = getClub(clubId);
  const state = u.kind === 'family' ? projectForFamily(s, u.id) : s;
  // self: the full signed-in user. A manager viewing another clubhouse (e.g. the empty Adina) has no staff row in that state.
  return c.json({ rev: s.rev, state, clock: clockInfo(), serverTime: Date.now(), user: publicUser(u), self: u });
});

app.get('/api/events', (c) => {
  const u = authUser(c, true); // EventSource cannot set headers: the session token comes as ?token=
  if (!u) return c.json({ code: 'err.forbidden' }, 401);
  const clubId = c.req.query('club') || u.clubId;
  if (!canAccessClub(u, clubId)) return c.json({ code: 'err.forbidden' }, 403);
  // keep proxies/tunnels (Cloudflare) from buffering or compressing the event stream
  const res = streamSSE(c, async (stream) => {
    let open = true;
    const unsub = subscribe({ clubId, user: u, send: (e) => { if (open) void stream.writeSSE({ event: e.type, data: JSON.stringify(e) }); } });
    stream.onAbort(() => { open = false; unsub(); });
    await stream.writeSSE({ event: 'hello', data: JSON.stringify({ rev: getClub(clubId)?.rev ?? 0, clock: clockInfo() }) });
    while (open) {
      await stream.sleep(20000);
      if (open) await stream.writeSSE({ event: 'ping', data: String(Date.now()) });
    }
  });
  // streamSSE sets plain "no-cache"; "no-transform" also stops a tunnel from compressing (and so buffering) the stream
  res.headers.set('Cache-Control', 'no-cache, no-transform');
  res.headers.set('X-Accel-Buffering', 'no');
  return res;
});

app.post('/api/actions/:name', async (c) => {
  const u = authUser(c);
  if (!u) return c.json({ code: 'err.forbidden' }, 401);
  const { mutationId, club, input } = await c.req.json<{ mutationId: string; club?: string; input: unknown }>();
  const clubId = club || u.clubId;
  if (!canAccessClub(u, clubId)) return c.json({ code: 'err.forbidden' }, 403);
  try {
    const r = await runAction(clubId, c.req.param('name'), input, u, mutationId || `m${Date.now().toString(36)}`);
    return c.json(u.kind === 'family' ? { rev: r.rev, result: r.result, reviewed: r.reviewed } : r);
  } catch (e) {
    const body = errBody(e);
    const status = body.code === 'err.forbidden' ? 403 : e instanceof DomainError ? 422 : 500;
    if (status === 500) console.error(e);
    return c.json(body, status);
  }
});

// photos: upload (signed in) and read back by their long random id (an <img> cannot send the session token, so the id is the key)
app.post('/api/media', async (c) => {
  const u = authUser(c);
  if (!u) return c.json({ code: 'err.forbidden' }, 401);
  const body = (await c.req.json().catch(() => ({}))) as { mime?: unknown; data?: unknown };
  const r = checkUpload(body ?? {});
  if (!r.ok) return c.json({ code: r.code }, r.status);
  const id = await saveMedia(u.clubId, u.id, r.mime, r.bytes);
  return c.json({ id, url: `/api/media/${id}`, bytes: r.bytes.length }, 201);
});
app.get('/api/media/:id', async (c) => {
  const id = c.req.param('id');
  const etag = `"${id}"`;
  const cache = { ETag: etag, 'Cache-Control': 'private, max-age=31536000, immutable' };
  if (c.req.header('if-none-match') === etag) return new Response(null, { status: 304, headers: cache });
  const m = await loadMedia(id);
  if (!m) return c.json({ code: 'err.notFound' }, 404);
  const head = { ...cache, 'Content-Type': m.mime, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' };
  // Safari plays a <video> only from a server that answers byte ranges
  const range = byteRange(c.req.header('range'), m.bytes.length);
  if (range === 'bad') return new Response(null, { status: 416, headers: { ...head, 'Content-Range': `bytes */${m.bytes.length}` } });
  if (range) {
    const part = m.bytes.subarray(range.start, range.end + 1);
    return new Response(new Uint8Array(part), { status: 206, headers: { ...head, 'Content-Length': String(part.length), 'Content-Range': `bytes ${range.start}-${range.end}/${m.bytes.length}` } });
  }
  return new Response(new Uint8Array(m.bytes), { headers: { ...head, 'Content-Length': String(m.bytes.length) } });
});

// demo tools
app.get('/api/demo/accounts', (c) => {
  const s = getClub('citra');
  if (!s) return c.json({ accounts: [] });
  const order = ['s1', 's8', 'f1', 'f2', 's5', 's6', 's3', 's2', 's10', 's9'];
  const accounts = order.map((id) => {
    const st = s.staff[id];
    if (st) return { id, name: st.name, kind: 'staff', roleKey: st.role };
    const f = s.familyContacts[id];
    if (!f) return null;
    const links = live(s.familyLinks).filter((l) => l.familyId === id && l.appAccess);
    const m = s.members[links[0]?.memberId || ''];
    const both = links.length > 1 ? ' & ' + links.slice(1).map((l) => s.members[l.memberId]?.title + ' ' + s.members[l.memberId]?.firstName).join(', ') : '';
    return { id, name: f.name, kind: 'family', roleKey: 'family', member: m ? `${m.title} ${m.firstName}${both}` : '', billing: links.some((l) => l.primary) };
  }).filter(Boolean);
  return c.json({ accounts });
});
app.post('/api/demo/reset', async (c) => { await resetDemo(); return c.json({ ok: true, clock: clockInfo() }); });
app.post('/api/demo/clock', async (c) => {
  const { hm, allowBack } = await c.req.json<{ hm: string; allowBack?: boolean }>();
  const clock = await setClock(hm, !!allowBack);
  broadcastAll({ type: 'clock', clock });
  return c.json(clock);
});

// public membership form (opened from a link; no sign-in)
const PUBLIC_FORM_ACTIONS = new Set(['form.open', 'form.saveDraft', 'form.submit']);
function findForm(token: string) {
  for (const s of Object.values(getClubs())) {
    const f = live(s.formRequests).find((x) => x.token === token);
    if (f) return { s, f };
  }
  return null;
}
app.get('/api/form/:token', (c) => {
  const hit = findForm(c.req.param('token'));
  if (!hit) return c.json({ code: 'err.notFound' }, 404);
  const { s, f } = hit;
  // anyone holding the link sees this: only what the form pre-fills (no staff notes, care instructions, billing or review data)
  let target: unknown;
  if (f.target.type === 'enquiry') {
    const e = s.enquiries[f.target.id];
    target = e && { id: e.id, senior: e.senior, contact: e.contact };
  } else {
    const m = s.members[f.target.id];
    target = m && {
      id: m.id, title: m.title, firstName: m.firstName, lastName: m.lastName, gender: m.gender, dob: m.dob, address: m.address, nanny: m.nanny,
      health: { conditions: m.health.conditions, meds: m.health.meds, food: m.health.food, foodOther: m.health.foodOther, drugs: m.health.drugs, mobility: m.health.mobility, diet: m.health.diet },
      documents: m.documents.map((d) => ({ id: d.id, type: d.type, status: d.status })), consents: m.consents.map((x) => ({ kind: x.kind, granted: x.granted })),
    };
  }
  return c.json({ clubId: s.clubId, club: { name: s.club.name, fullName: s.club.fullName }, form: f, target, clock: clockInfo() });
});
app.post('/api/form/:token/:action', async (c) => {
  const token = c.req.param('token');
  const name = `form.${c.req.param('action')}`;
  if (!PUBLIC_FORM_ACTIONS.has(name)) return c.json({ code: 'err.forbidden' }, 403);
  const hit = findForm(token);
  if (!hit) return c.json({ code: 'err.notFound' }, 404);
  const { input, mutationId } = await c.req.json<{ input: Record<string, unknown>; mutationId?: string }>();
  try {
    const r = await runAction(hit.s.clubId, name, { ...input, token }, systemUser(hit.s.clubId), mutationId || `f${Date.now().toString(36)}`);
    return c.json({ rev: r.rev, result: r.result });
  } catch (e) {
    return c.json(errBody(e), e instanceof DomainError ? 422 : 500);
  }
});

// Production / tunnel mode: serve the built web app from the same origin as the API (single port for cloudflared).
const webDist = process.env.WEB_DIST || join(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (process.env.SERVE_WEB !== '0' && existsSync(join(webDist, 'index.html'))) {
  const root = relative(process.cwd(), webDist) || '.';
  const indexHtml = readFileSync(join(webDist, 'index.html'), 'utf8');
  app.use('/assets/*', serveStatic({ root, onFound: (_p, c) => { c.header('Cache-Control', 'public, max-age=31536000, immutable'); } }));
  app.use('*', serveStatic({ root }));
  app.get('*', (c) => (c.req.path.startsWith('/api/') ? c.json({ code: 'err.notFound' }, 404) : c.html(indexHtml)));
  console.log('Serving web app from ' + webDist);
}

