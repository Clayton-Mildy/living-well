// Guided demo "Oma Lina's day": every step run from the Demo panel, in order, the way it is presented.
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole } from './helpers';

const T = '2026-10-21';
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const stateOf = async (page: Page, userId = 's9'): Promise<Row> => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': userId } })).json()).state;
const rows = (o: Row): Row[] => Object.values(o).filter((r: Row) => !r.deletedAt);
const poll = (page: Page, fn: (s: Row) => unknown) => expect.poll(async () => fn(await stateOf(page)), { timeout: 20_000 });

/** Open the Demo pill and run a guided step by its button label. */
async function step(page: Page, label: RegExp) {
  await page.getByRole('button', { name: /^Demo$/ }).click();
  const panel = page.getByRole('dialog', { name: 'Demo tools' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: label }).click();
  await expect(panel).toHaveCount(0);
}

test.beforeAll(async ({ request }) => { await resetDemo(request); });

test.skip('Oma Lina’s day: the guided demo runs end to end (the guided demo is hidden for now)', async ({ page }) => {
  test.setTimeout(300_000);
  const c = watchConsole(page);
  await signIn(page, 's9');

  // 1 · 10:00 face check-in at the door: her 11th visit in October, so an extra day
  await step(page, /^Show the lobby$/);
  await poll(page, (s) => s.attendance[`${T}:m1`]?.checkIn?.method).toBe('face');
  await expect(page.locator('#main')).toContainText('In the club');
  let s = await stateOf(page);
  expect(rows(s.activity).some((a) => a.memberId === 'm1' && a.key === 'lobby.feed.extraVisit')).toBe(true);

  // 2 · 10:08 health check: the PC-303 reads 152/94; the nurse saves it and the family is told
  await step(page, /^Open the health station$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Oma Lina Wijaya' })).toBeVisible();
  await page.getByRole('button', { name: /^Save and next$/ }).click();
  await poll(page, (x) => rows(x.readings).find((r) => r.memberId === 'm1' && r.date === T && r.kind === 'arrival')?.sys).toBe(152);

  // 3 · 10:50 solo and group photos
  await step(page, /^Take the photos$/);
  await poll(page, (x) => rows(x.photos).filter((p) => p.date === T && p.memberIds.includes('m1') && p.visibility === 'visible').length).toBeGreaterThanOrEqual(2); // approved by management

  // 4 · 12:02 lunch photo from the kitchen
  await step(page, /^Post the lunch photo$/);
  await poll(page, (x) => (x.dayMenus[T]?.photoIds || []).some((id: string) => x.photos[id]?.visibility === 'visible')).toBe(true);

  // 5 · 13:15 daily log
  await step(page, /^Write the log$/);
  await poll(page, (x) => rows(x.dailyLogs).find((l) => l.memberId === 'm1' && l.date === T)?.status).toBe('saved');

  // 6 · 15:45 departure check and check-out (nobody records who collected her)
  await step(page, /^Check her out$/);
  await poll(page, (x) => !!x.attendance[`${T}:m1`]?.checkOut).toBe(true);
  s = await stateOf(page);
  expect(Object.keys(s.attendance[`${T}:m1`].checkOut).sort()).toEqual(['at', 'by', 'method']);

  // 7 · 17:10 Maria opens Today, comments on the log and messages the lobby
  await step(page, /^Open Maria.s Today$/);
  await poll(page, (x) => rows(x.messages).filter((m) => m.from === 'family:f1' && String(m.at).startsWith(T)).length).toBeGreaterThanOrEqual(2);

  // 8 · Maria sees the extra visit on her plan card
  await step(page, /^Open Maria.s plan$/);
  await expect(page.getByTestId('plan-card').filter({ hasText: 'extra visit' }).first()).toBeVisible();

  // 9 · November invoice with the extra day, paid by virtual account
  await step(page, /^Issue and pay$/);
  await poll(page, (x) => {
    const inv = rows(x.invoices).find((i) => i.memberId === 'm1' && i.period === '2026-11');
    return inv ? rows(x.payments).some((p) => p.allocations.some((a: Row) => a.invoiceId === inv.id)) : false;
  }).toBe(true);
  s = await stateOf(page);
  const nov = rows(s.invoices).find((i) => i.memberId === 'm1' && i.period === '2026-11')!;
  expect(nov.lines.find((l: Row) => l.kind === 'extraDay')).toMatchObject({ qty: 1, amount: 650000, dates: [T] });

  // 10 · management overview, 11 · plans and pricing
  await step(page, /^Open Arrivals$/);
  await expect(page.getByRole('heading', { name: 'Arrivals' })).toBeVisible();
  await step(page, /^Open plans and pricing$/);
  await expect(page).toHaveURL(/\/plans$/);

  // progress: everything except setting the real Flex price, which the presenter does by hand
  await page.getByRole('button', { name: /^Demo$/ }).click();
  await expect(page.getByRole('dialog', { name: 'Demo tools' })).toContainText('10 of 11 steps done');
  c.assertClean();
});
