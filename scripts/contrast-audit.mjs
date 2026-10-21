// Round 8c (temporary): find surfaces and controls that don't separate from what's behind them (same or nearly the same colour, no border, no
// shadow) on every screen of every role, at phone and laptop width. Read-only: page loads only.
//   node scripts/contrast-audit.mjs <outDir> [filter-substring]
// Writes <outDir>/report.json and <outDir>/<user>-<width>-<page>.png with the hits outlined in red.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const [outDir, only] = process.argv.slice(2);
const base = process.env.BASE || 'http://localhost:5173';
fs.mkdirSync(outDir, { recursive: true });

const PAGES = {
  f1: ['/today', '/today?member=m1', '/today?member=m1&date=2026-10-12', '/photos', '/calendar', '/calendar?view=month', '/health', '/history?member=m1&metric=bp', '/profile?member=m1', '/me', '/billing', '/contacts'],
  s1: ['/today', '/enquiries', '/members', '/members/m1', '/members/m1/health', '/menu', '/renewals', '/tasks', '/contacts', '/requests'],
  s8: ['/today', '/readings', '/members', '/tasks'],
  s5: ['/today', '/camera', '/log', '/calendar', '/tasks'],
  s3: ['/today', '/feedback', '/requests'],
  s10: ['/today', '/payments', '/budget', '/receipts', '/stock', '/guests', '/directory'],
  s9: ['/reviews', '/report', '/billing', '/calendar', '/insights', '/broadcast', '/venue', '/hr', '/surveys', '/plans'],
};
const WIDTHS = [390, 1440];

import { probe } from './contrast-probe.mjs';

const browser = await chromium.launch();
const report = [];
for (const [userId, pages] of Object.entries(PAGES)) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
    const page = await ctx.newPage();
    const r = await page.request.post(base + '/api/verify', { data: { userId, code: '000000' } });
    const { user, token } = await r.json();
    await page.addInitScript(([u, tk]) => { try { if (!localStorage.getItem('cp.session')) localStorage.setItem('cp.session', JSON.stringify({ user: u, token: tk, lang: 'en', club: u.clubId })); } catch {} }, [user, token]);
    for (const p of pages) {
      if (only && !(`${userId}${p}`.includes(only))) continue;
      try {
        await page.goto(base + p);
        await page.waitForSelector('#main', { timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);
        // tall window so the whole page is checked at once
        const h = await page.evaluate(() => { const m = document.querySelector('#main'); return m ? m.scrollHeight : document.body.scrollHeight; });
        const z = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).zoom || '1'));
        await page.setViewportSize({ width, height: Math.min(7000, Math.max(900, Math.ceil(h * z) + 10)) });
        await page.waitForTimeout(400);
        const hits = await page.evaluate(probe);
        const name = `${userId}-${width}-${p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}`;
        if (hits.length) await page.screenshot({ path: path.join(outDir, name + '.png') });
        report.push({ userId, width, page: p, hits });
        console.log(`${name}: ${hits.length} (${hits.filter((x) => x.kind === 'same').length} same)`);
        await page.setViewportSize({ width, height: 900 });
      } catch (e) { console.log(`${userId} ${width} ${p}: ERROR ${String(e).slice(0, 120)}`); }
    }
    await ctx.close();
  }
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
await browser.close();
