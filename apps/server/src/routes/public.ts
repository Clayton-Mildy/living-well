// Public routes: no sign-in, the link is the key. KC round 7: a renter rates their event through the link management sent on WhatsApp
// (simulated): GET shows what to answer, POST sends the answer. The answer goes through the normal action path as the system, so it is
// checked, saved, and broadcast to everyone signed in like any other change (venue.rate in packages/shared/src/actions/club.ts).
import type { Context, Hono } from 'hono';
import { DomainError, priceOn, ratingLinkOf, systemUser } from '@cp/shared';
import { enquiryByFormToken, formLinkState, formRevOf, onlineDraftOf } from '@cp/shared/rules/enquiries';
import { getClubs, runAction } from '../state';
import { clockInfo } from '../clock';
import { checkUpload, saveMedia } from '../media';

/** The clubhouse and rating link a token belongs to. A token matches at most one booking. */
function findLink(token: string) {
  for (const s of Object.values(getClubs())) {
    const link = ratingLinkOf(s, token);
    if (link) return { s, link };
  }
  return null;
}
/** A rating link is private: never cached, never indexed. */
const priv = (c: Context) => { c.header('Cache-Control', 'no-store'); c.header('X-Robots-Tag', 'noindex'); };

/** KC round 10: the lead an online registration token belongs to. */
function findForm(token: string) {
  for (const s of Object.values(getClubs())) {
    const e = enquiryByFormToken(s, token);
    if (e) return { s, e };
  }
  return null;
}

/** What a form post may weigh. A body with no content-length (or a longer one) is refused before it is read. */
const FORM_BODY_MAX = 40000;
const tooBig = (c: Context) => { const n = c.req.header('content-length'); return n === undefined || !/^\d+$/.test(n) || Number(n) > FORM_BODY_MAX; };
/** One draft save per link every 2 s (the page saves on Continue and Save for later; a script hammering it gets 429). Time of the last write by token. */
const DRAFT_GAP_MS = 2000;
const lastDraftWrite = new Map<string, number>();

export function registerPublicRoutes(app: Hono) {
  // ----- the online registration form (/form/:token): a pre-fill for the paper form -----
  app.get('/api/public/form/:token', (c) => {
    priv(c);
    const found = findForm(c.req.param('token'));
    if (!found) return c.json({ code: 'err.notFound' }, 404);
    const { s, e } = found;
    const clk = clockInfo();
    const f = e.form!;
    const state = formLinkState(f, `${clk.today}T${clk.now}`);
    const price = priceOn(s, clk.today);
    // anyone holding the link sees only what the form itself holds: the lead's name and contact, and what the family typed in before
    return c.json({ state, club: s.club.name, today: clk.today, draft: onlineDraftOf(e), step: f.step ?? null, savedAt: f.savedAt ?? null, draftRev: formRevOf(f), submittedAt: f.submittedAt ?? null, expiresAt: f.expiresAt, prices: { flex: price.flex, gold: price.gold, flexQuota: s.club.settings.flexQuota } });
  });
  // the family photographs the ID cards from the form: an image or a PDF (never a video), saved as the club's media like any upload
  app.post('/api/public/form/:token/media', async (c) => {
    priv(c);
    const found = findForm(c.req.param('token'));
    if (!found) return c.json({ code: 'err.notFound' }, 404);
    const clk = clockInfo();
    const state = formLinkState(found.e.form!, `${clk.today}T${clk.now}`);
    if (state !== 'sent' && state !== 'opened' && state !== 'inProgress') return c.json({ code: 'enq.err.formExpired' }, 422);
    const body = (await c.req.json().catch(() => ({}))) as { mime?: unknown; data?: unknown };
    if (typeof body.mime === 'string' && body.mime.startsWith('video/')) return c.json({ code: 'common.mediaType' }, 415);
    const r = checkUpload(body ?? {});
    if (!r.ok) return c.json({ code: r.code }, r.status);
    const id = await saveMedia(found.s.clubId, 'system', r.mime, r.bytes);
    return c.json({ id, url: `/api/media/${id}`, bytes: r.bytes.length }, 201);
  });
  // round 13: the half-filled form is saved on the lead through the link (system action), so reopening it on another phone continues where they stopped
  app.post('/api/public/form/:token/draft', async (c) => {
    priv(c);
    const token = c.req.param('token');
    const found = findForm(token);
    if (!found) return c.json({ code: 'err.notFound' }, 404);
    if (tooBig(c)) return c.json({ code: 'err.invalid', params: { field: 'body' } }, 413);
    const wait = DRAFT_GAP_MS - (Date.now() - (lastDraftWrite.get(token) ?? 0));
    if (wait > 0) { c.header('Retry-After', String(Math.ceil(wait / 1000))); return c.json({ code: 'err.tooFast' }, 429); }
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as { step?: unknown; expect?: unknown; draft?: unknown };
    try {
      const r = await runAction(found.s.clubId, 'enquiry.formSave', { token, step: body.step, expect: body.expect, draft: body.draft }, systemUser(found.s.clubId), `form-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
      if (r.patches.length) lastDraftWrite.set(token, Date.now()); // an unchanged draft writes nothing and does not count
      return c.json({ ok: true, rev: r.rev, savedAt: r.result.savedAt ?? null, draftRev: r.result.draftRev ?? 0 });
    } catch (e) {
      if (e instanceof DomainError) {
        if (e.code === 'enq.err.formConflict') {
          // saved from another phone since this page last looked: hand back what the lead has, so the family chooses (nothing is overwritten)
          const now = findForm(token);
          if (now) return c.json({ code: e.code, draft: onlineDraftOf(now.e), step: now.e.form?.step ?? null, savedAt: now.e.form?.savedAt ?? null, draftRev: formRevOf(now.e.form) }, 409);
        }
        return c.json({ code: e.code, params: e.params }, e.code === 'enq.err.formExpired' ? 410 : 422);
      }
      console.error('form draft failed:', e instanceof Error ? e.message : e);
      return c.json({ code: 'err.server' }, 500);
    }
  });
  app.post('/api/public/form/:token', async (c) => {
    priv(c);
    const token = c.req.param('token');
    const found = findForm(token);
    if (!found) return c.json({ code: 'err.notFound' }, 404);
    if (tooBig(c)) return c.json({ code: 'err.invalid', params: { field: 'body' } }, 413);
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as { action?: string; draft?: unknown };
    const name = body.action === 'open' ? 'enquiry.formOpen' : body.action === 'submit' ? 'enquiry.formSubmit' : null;
    if (!name) return c.json({ code: 'err.invalid', params: { field: 'action' } }, 422);
    try {
      const r = await runAction(found.s.clubId, name, { token, ...(body.draft !== undefined ? { draft: body.draft } : {}) }, systemUser(found.s.clubId), `form-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
      return c.json({ ok: true, rev: r.rev });
    } catch (e) {
      if (e instanceof DomainError) return c.json({ code: e.code, params: e.params }, 422);
      console.error('form failed:', e instanceof Error ? e.message : e);
      return c.json({ code: 'err.server' }, 500);
    }
  });

  app.get('/api/public/rate/:token', (c) => {
    priv(c);
    const found = findLink(c.req.param('token'));
    if (!found) return c.json({ code: 'err.notFound' }, 404);
    const { s, link } = found;
    const b = link.booking;
    const room = s.rooms[b.roomId];
    return c.json({
      state: link.state,
      club: s.club.name,
      booking: { org: b.org, contactName: b.contactName, date: b.date, from: b.from, to: b.to, room: room?.name ?? '', roomNameId: room?.nameId ?? '' },
      survey: { title: link.survey.title, questions: link.survey.questions, custom: link.survey.custom ?? [] },
    });
  });

  app.post('/api/public/rate/:token', async (c) => {
    priv(c);
    const token = c.req.param('token');
    const found = findLink(token);
    if (!found) return c.json({ code: 'err.notFound' }, 404);
    if (Number(c.req.header('content-length') || 0) > 20000) return c.json({ code: 'err.invalid', params: { field: 'body' } }, 413);
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    try {
      const r = await runAction(found.s.clubId, 'venue.rate', { ...body, token }, systemUser(found.s.clubId), `rate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
      return c.json({ ok: true, rev: r.rev });
    } catch (e) {
      if (e instanceof DomainError) return c.json({ code: e.code, params: e.params }, 422);
      console.error('rating failed:', e instanceof Error ? e.message : e);
      return c.json({ code: 'err.server' }, 500);
    }
  });
}
