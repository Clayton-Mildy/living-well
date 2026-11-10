// The staff tablet (KC, 10 Nov 2026: Samsung Galaxy Tab A11, 8.7" 1340×800, about 894×440 CSS px when held sideways in Chrome).
// A short wide window gets a compact sidebar (most of the menu in view, the language switch in the account sheet) and a tighter Arrivals header.
// The test sets its own window size, so it runs once (in the phone project).
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, isPhone, assertNoHorizontalScroll } from './helpers';

test.beforeAll(async ({ request }) => { await resetDemo(request); });

/** Menu items fully inside the sidebar's scrolling menu (not hidden below its fold). */
const menuInView = (page: Page) => page.getByTestId('staff-sidebar').evaluate((side) => {
  const items = Array.from(side.querySelectorAll<HTMLElement>('[data-nav-key]'));
  let box = items[0]?.parentElement ?? null;
  while (box && box !== side && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
  const view = (box ?? side).getBoundingClientRect();
  return { all: items.length, inView: items.filter((el) => { const r = el.getBoundingClientRect(); return r.top >= view.top - 1 && r.bottom <= view.bottom + 1; }).length };
});
/** The "Check in a member" list: how many rows it has and how many have their Check in button fully on screen (the Also today rail is left out). */
const checkInsInView = (page: Page) => page.locator('#main').evaluate((main) => {
  const view = main.getBoundingClientRect();
  const label = Array.from(main.querySelectorAll<HTMLElement>('*')).find((e) => e.children.length === 0 && e.textContent?.trim().toLowerCase() === 'check in a member');
  let card: HTMLElement | null = label ?? null;
  const buttonsIn = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Check in');
  while (card && card !== main && !buttonsIn(card).length) card = card.parentElement;
  const rows = card ? buttonsIn(card) : [];
  return { total: rows.length, inView: rows.filter((b) => { const r = b.getBoundingClientRect(); return r.top >= view.top && r.bottom <= view.bottom; }).length };
});

test('Tab A11 held sideways: a compact sidebar shows most of the menu, the language switch moves to the account sheet, Arrivals shows more people', async ({ page }) => {
  test.skip(!isPhone(page), 'the test sets its own window size');
  await page.setViewportSize({ width: 894, height: 440 });
  await signIn(page, 's1', '/today');
  await expect(page.getByTestId('staff-sidebar')).toBeVisible();
  const m = await menuInView(page);
  expect(m.all).toBeGreaterThanOrEqual(10);
  expect(m.inView).toBeGreaterThanOrEqual(9);
  await expect(page.getByTestId('staff-sidebar').getByRole('group', { name: 'Language' })).toBeHidden();
  const rows = await checkInsInView(page);
  expect(rows.total).toBeGreaterThan(0);
  expect(rows.inView).toBeGreaterThanOrEqual(Math.min(4, rows.total));
  await assertNoHorizontalScroll(page);
  // the language switch is still one tap away, in the account sheet
  await page.getByTestId('staff-sidebar').getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('dialog').getByRole('tablist', { name: 'Language' })).toBeVisible();
});

test('a normal tablet (1024×768) keeps the full sidebar with its language switch', async ({ page }) => {
  test.skip(!isPhone(page), 'the test sets its own window size');
  await page.setViewportSize({ width: 1024, height: 768 });
  await signIn(page, 's1', '/today');
  await expect(page.getByTestId('staff-sidebar').getByRole('group', { name: 'Language' })).toBeVisible();
});
