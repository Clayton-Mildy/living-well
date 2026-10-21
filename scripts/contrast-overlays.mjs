// Round 8c (temporary): open the most-used sheets and dialogs (read-only: open, probe, Escape) and check them for colour collisions.
//   node scripts/contrast-overlays.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { probe } from './contrast-probe.mjs';

const [outDir] = process.argv.slice(2);
const base = process.env.BASE || 'http://localhost:5173';
fs.mkdirSync(outDir, { recursive: true });
// [user, path, how to open (a CSS selector or role/name), name]
const CASES = [
  ['s1', '/today', 'css=[data-testid="arrivals-row"], [data-member-row], button:has-text("Oma Aisyah")', 'arrivals-member'],
  ['s1', '/members', 'role=button[name=/Add member/]', 'add-member'],
  ['s1', '/renewals', 'css=button.cp-tap-target', 'renewal-sheet'],
  ['s1', '/members/m1', 'role=button[name=/Edit/]', 'member-edit'],
  ['s10', '/today', 'css=[data-testid^="invoice-row"], [data-invoice]', 'invoice-sheet'],
  ['s3', '/today', 'role=button[name=/Change today/]', 'menu-change'],
  ['f1', '/today', 'role=button[name=/Answer the survey/]', 'family-survey'],
  ['f1', '/me', 'css=[data-testid="me-details"]', 'family-details'],
  ['f1', '/profile?member=m1', 'css=[data-testid="pf-edit"]', 'family-edit'],
];
const browser = await chromium.launch();
const report = [];
for (const width of [390, 1440]) {
  for (const [userId, p, sel, name] of CASES) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
    const page = await ctx.newPage();
    const r = await page.request.post(base + '/api/verify', { data: { userId, code: '000000' } });
    const { user, token } = await r.json();
    await page.addInitScript(([u, tk]) => { try { localStorage.setItem('cp.session', JSON.stringify({ user: u, token: tk, lang: 'en', club: u.clubId })); } catch {} }, [user, token]);
    try {
      await page.goto(base + p); await page.waitForSelector('#main'); await page.waitForTimeout(1200);
      await page.locator(sel).first().click({ timeout: 5000 });
      await page.waitForTimeout(800);
      const hits = await page.evaluate(probe);
      const inOverlay = hits; // the probe also scans dialogs
      await page.screenshot({ path: path.join(outDir, `${name}-${width}.png`) });
      report.push({ name, width, hits: inOverlay });
      console.log(`${name}-${width}: ${inOverlay.length}`);
      await page.keyboard.press('Escape');
    } catch (e) { console.log(`${name}-${width}: could not open (${String(e).slice(0, 80)})`); }
    await ctx.close();
  }
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
await browser.close();
