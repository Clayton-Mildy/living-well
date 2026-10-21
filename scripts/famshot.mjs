// Round 8 helper (temporary): screenshot a family page at phone width from the running dev server.
//   node scripts/famshot.mjs <path> <out.png> [userId=f1] [width=390] [lang=en] [fullPage=1]
import { chromium } from '@playwright/test';
const [path = '/today', out = 'shot.png', userId = 'f1', width = '390', lang = 'en', full = '1'] = process.argv.slice(2);
const base = process.env.BASE || 'http://localhost:5173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +width, height: 844 }, deviceScaleFactor: 2, isMobile: +width < 768, hasTouch: +width < 768 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const r = await page.request.post(base + '/api/verify', { data: { userId, code: '000000' } });
const { user, token } = await r.json();
await page.addInitScript(([u, tk, l]) => { try { if (!localStorage.getItem('cp.session')) localStorage.setItem('cp.session', JSON.stringify({ user: u, token: tk, lang: l, club: u.clubId })); } catch {} }, [user, token, lang]);
await page.goto(base + path);
await page.waitForSelector('#main');
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);
// the shell scrolls inside #main: make the window as tall as the page so one shot shows everything (the tab bar ends up at the bottom)
if (full === '1') {
  const h = await page.evaluate(() => { const m = document.querySelector('#main'); return m ? m.scrollHeight : document.body.scrollHeight; });
  const z = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).zoom || '1'));
  await page.setViewportSize({ width: +width, height: Math.min(9000, Math.ceil(h * z) + 10) });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: out });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
