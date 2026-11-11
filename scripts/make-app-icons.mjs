// Renders the install icons (white star on gold #CFA550) with Playwright's Chromium: node scripts/make-app-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'public');
const star = readFileSync(join(root, 'brand-mark-white.svg'), 'utf8').replace(/ width="512" height="512"/, ' width="100%" height="100%"');
const GOLD = '#CFA550';
const STAR_EXTENT = 184 / 208; // the star spans about +-92 of the -104..104 viewBox
// [file, pixels, star width as a share of the icon]
const jobs = [
  ['icons/icon-192.png', 192, 0.66],
  ['icons/icon-512.png', 512, 0.66],
  ['icons/icon-maskable-512.png', 512, 0.54],
  ['apple-touch-icon.png', 180, 0.66],
];

mkdirSync(join(root, 'icons'), { recursive: true });
const browser = await chromium.launch();
for (const [file, px, share] of jobs) {
  const page = await browser.newPage({ viewport: { width: px, height: px }, deviceScaleFactor: 1 });
  const box = Math.round((px * share) / STAR_EXTENT);
  await page.setContent(`<body style="margin:0;width:${px}px;height:${px}px;background:${GOLD};display:flex;align-items:center;justify-content:center"><div style="width:${box}px;height:${box}px">${star}</div></body>`);
  await page.screenshot({ path: join(root, file), type: 'png' });
  await page.close();
  console.log('wrote', file);
}
await browser.close();
