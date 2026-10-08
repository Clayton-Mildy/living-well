// Public routes: no sign-in, the link is the key. KC round 7: a renter rates their event through the link management sent on WhatsApp
// (simulated): GET shows what to answer, POST sends the answer. The answer goes through the normal action path as the system, so it is
// checked, saved, and broadcast to everyone signed in like any other change (venue.rate in packages/shared/src/actions/club.ts).
import type { Context, Hono } from 'hono';
import { DomainError, ratingLinkOf, systemUser } from '@cp/shared';
import { getClubs, runAction } from '../state';

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

export function registerPublicRoutes(app: Hono) {
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
