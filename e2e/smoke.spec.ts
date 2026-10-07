// Smoke: every demo account × every screen it may open × every tab on that screen, in English and Indonesian.
// Fails on console errors, raw i18n keys, English left on Indonesian screens, unexpected redirects and horizontal scroll.
// Saves a screenshot per screen to artifacts/smoke/<project>/<lang>/ (phone and laptop only).
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { en } from '../packages/shared/src/i18n/en';
import { id as idDict } from '../packages/shared/src/i18n/id';
import { allowedKeys } from '../apps/web/src/app/nav';
import type { Role } from '../packages/shared/src/types';

const ACCOUNTS: [string, Role][] = [
  ['s1', 'lobby'], ['s8', 'nurse'], ['s5', 'activity'], ['s3', 'kitchen'], ['s2', 'kitchen'], ['s10', 'finance'], ['s9', 'mgmt'],
  ['f1', 'family'], ['f2', 'family'], ['fm10_0', 'family'],
];
const EXTRA_PATHS: Partial<Record<Role, string[]>> = {
  mgmt: ['/members/m1', '/members/m10'],
  lobby: ['/members/m2'],
  nurse: ['/members/m20'],
  finance: ['/members/m20'],
};

// a raw key looks like "<namespace>.<name>" for one of the dictionary's namespaces
const NS = [...new Set(Object.keys(en).map((k) => k.split('.')[0]))];
const RAW = new RegExp(`(^|[\\s(«"'])(?:${NS.join('|')})\\.[A-Za-z_]\\w*(?:\\.\\w+)*(?=$|[\\s,.:;!?)»"'])`);
// English strings that have a different Indonesian translation (ignoring short and templated ones)
const ID_VALUES = new Set(Object.values(idDict as Record<string, string>).map((v) => v.trim()));
const ENGLISH = new Set(
  Object.entries(en as Record<string, string>)
    .filter(([k, v]) => v.length >= 5 && !v.includes('{') && (idDict as Record<string, string>)[k] !== v && !ID_VALUES.has(v.trim()))
    .map(([, v]) => v.trim()),
);

/** Wait for lazy screens and skeletons to finish (the SSE stream keeps the network busy, so no networkidle). */
const settled = (page: Page) => page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
async function screenTexts(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('script,style,[aria-hidden="true"],.ms')) continue;
      const s = (n.textContent || '').trim();
      if (s && el.getClientRects().length) out.push(s);
    }
    for (const el of Array.from(document.querySelectorAll('[aria-label],[placeholder],[title]')))
      for (const a of ['aria-label', 'placeholder', 'title']) { const v = el.getAttribute(a); if (v && v.trim()) out.push(v.trim()); }
    return out;
  });
}
async function checkScreen(page: Page, lang: 'en' | 'id', where: string, problems: string[]) {
  await page.waitForTimeout(150);
  for (const s of await screenTexts(page)) {
    if (RAW.test(s)) problems.push(`${where}: raw key "${s.slice(0, 80)}"`);
    else if (lang === 'id' && ENGLISH.has(s)) problems.push(`${where}: English on Indonesian screen "${s.slice(0, 80)}"`);
  }
  await assertNoHorizontalScroll(page);
}
/** Click every tab on the screen (role=tab), checking each. */
async function walkTabs(page: Page, lang: 'en' | 'id', where: string, problems: string[]) {
  const n = await page.locator('#main [role="tab"]').count();
  for (let i = 0; i < Math.min(n, 14); i++) {
    const tab = page.locator('#main [role="tab"]').nth(i);
    if (!(await tab.isVisible()) || (await tab.isDisabled())) continue;
    const name = ((await tab.textContent()) || String(i)).trim().slice(0, 24);
    await tab.click();
    await checkScreen(page, lang, `${where} › ${name}`, problems);
  }
}

test.beforeAll(async ({ request }) => { await resetDemo(request); });

for (const lang of ['en', 'id'] as const) {
  for (const [uid, role] of ACCOUNTS) {
    test(`${lang} ${uid} (${role}): every screen`, async ({ page }, info) => {
      test.setTimeout(240_000);
      const shoot = info.project.name === 'phone' || info.project.name === 'laptop';
      const c = watchConsole(page);
      const problems: string[] = [];
      await signIn(page, uid, '/today', lang);
      const paths = [...[...allowedKeys(role)].map((k) => '/' + k), ...(EXTRA_PATHS[role] || [])];
      for (const path of paths) {
        await page.goto(path);
        await expect(page.locator('#main')).toBeVisible();
        await settled(page);
        const url = new URL(page.url());
        if (path !== '/today' && url.pathname === '/today') problems.push(`${path}: redirected home`);
        await checkScreen(page, lang, `${uid}${path}`, problems);
        if (shoot) await page.screenshot({ path: `artifacts/smoke/${info.project.name}/${lang}/${uid}${path.replace(/\//g, '_')}.png` });
        await walkTabs(page, lang, `${uid}${path}`, problems);
      }
      expect(problems, problems.join('\n')).toEqual([]);
      c.assertClean();
    });
  }
}

// pages outside the app shell: the design system (registration is on paper, so there is no public form)
for (const lang of ['en', 'id'] as const) {
  test(`${lang} design system`, async ({ page }, info) => {
    const c = watchConsole(page);
    const problems: string[] = [];
    await signIn(page, 's9', '/today', lang);
    for (const path of ['/design-system']) {
      await page.goto(path);
      await settled(page);
      await expect(page.locator('h1, h2').first()).toBeVisible();
      for (const s of await screenTexts(page)) if (RAW.test(s)) problems.push(`${path}: raw key "${s.slice(0, 80)}"`);
      if (info.project.name === 'phone' || info.project.name === 'laptop') await page.screenshot({ path: `artifacts/smoke/${info.project.name}/${lang}/public${path.replace(/\//g, '_')}.png`, fullPage: true });
    }
    expect(problems, problems.join('\n')).toEqual([]);
    c.assertClean();
  });
}
