// E2E helpers: reset the demo database, sign in as a demo user, collect console errors, check the screen.
import { expect, type Page, type APIRequestContext } from '@playwright/test';

export async function resetDemo(request: APIRequestContext) {
  const r = await request.post('/api/demo/reset', { data: {} });
  expect(r.ok()).toBeTruthy();
}
/**
 * Sign in by injecting the session (same as tapping a demo account), then open a path.
 * The browser gets a real signed session token from /api/verify, exactly like the app does.
 * Specs that call the API directly (page.request with an `x-user-id` header) work because scripts/e2e-all.sh and
 * scripts/e2e-env.sh start the API with CP_TRUST_USER_HEADER=1; a normal server ignores that header.
 */
export async function signIn(page: Page, userId: string, path = '/today', lang: 'en' | 'id' = 'en') {
  const r = await page.request.post('/api/verify', { data: { userId, code: '000000' } });
  const { user, token } = await r.json();
  // seed the session once per signIn call (not on every navigation), so switching language or clubhouse in the app survives page.goto
  const once = `cp.e2e.signIn.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  await page.addInitScript(([u, tk, l, k]) => {
    try {
      if (!location.protocol.startsWith('http') || sessionStorage.getItem(k)) return;
      localStorage.setItem('cp.session', JSON.stringify({ user: u, token: tk, lang: l, club: (u as { clubId: string }).clubId }));
      sessionStorage.setItem(k, '1');
    } catch { /* about:blank has no storage */ }
  }, [user, token, lang, once] as const);
  await page.goto(path);
  await expect(page.locator('#main')).toBeVisible();
}
/** Fail the test on any console error or page error. `allow` ignores more console messages (e.g. the browser's own log of an expected 401). */
export function watchConsole(page: Page, allow?: RegExp) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ResizeObserver/.test(m.text()) && !allow?.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return { assertClean: () => expect(errors, errors.join('\n')).toEqual([]) };
}
export const isPhone = (page: Page) => (page.viewportSize()?.width || 1440) < 768;
/** No horizontal page scroll (layout fits the viewport). */
export async function assertNoHorizontalScroll(page: Page) {
  await page.evaluate(() => document.fonts.ready); // icon ligature names are wide until the icon font loads
  const over = await page.evaluate(() => {
    const main = document.querySelector('#main') as HTMLElement | null;
    const el = main || document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(over).toBeLessThanOrEqual(1);
}
