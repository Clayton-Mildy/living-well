// Round 15 phase 1 story (phone, small seed, demo day Wed 21 Oct 2026). Caca: the search button, the enquiry source "Other", the plan filter and the nanny on the rows,
// "Not seen for" (on 28 Oct, when the whole club has been away a week). Ega: Next month lists every member; the Year view lists the closed days. Maria: where her parent is,
// a finished day drawn as done with its check-out row, and the calendar's passed bars.
// Isolated env: E2E_NAME=e5 E2E_PORT=8891 scripts/e2e-all.sh 1 phone round15p1
import { test, expect, type APIRequestContext } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { pickOption } from './kit';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

const act = async (request: APIRequestContext, name: string, tag: string, input: Record<string, unknown>) => {
  const r = await request.post(`/api/actions/${name}`, { headers: { 'x-user-id': 's1' }, data: { mutationId: `e2e-r15p1-${tag}`, club: 'citra', input } });
  expect(r.ok(), await r.text()).toBeTruthy();
};

test('Caca: the search button, an enquiry from "Other", the plan filter, and the nanny on the row', async ({ page, request }) => {
  const c = watchConsole(page);
  await act(request, 'attendance.checkIn', 'lina-in', { memberId: 'm1', method: 'manual' }); // Oma Lina, who has Mbak Sari with her
  await signIn(page, 's1', '/today');

  // 1. the floating search button opens the search; a name finds the member
  await page.getByTestId('search-fab').click();
  const overlay = page.getByRole('dialog', { name: 'Search' });
  await expect(overlay).toBeVisible();
  await overlay.getByRole('textbox', { name: 'Search' }).fill('Lina');
  await expect(overlay.getByTestId('ss-row').filter({ hasText: 'Lina' }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);

  // 2. a new enquiry: "Where from?" appears only for the source Other, and the card line carries the answer
  await page.goto('/enquiries');
  await page.getByRole('button', { name: 'New lead' }).click();
  const d = page.getByRole('dialog', { name: 'New lead' });
  await d.getByRole('button', { name: 'Instagram', exact: true }).click();
  await expect(d.getByRole('button', { name: 'Instagram', exact: true })).toBeVisible(); // control: the source buttons are on screen
  await expect(d.getByLabel('Where from?')).toHaveCount(0);
  await d.getByRole('button', { name: 'Opa', exact: true }).click();
  await d.getByLabel(/^Name/).fill('Gunawan Setiadi');
  await d.getByLabel(/^Contact person/).fill('Rina Setiadi');
  await d.getByLabel(/^Mobile/).fill('0812 5500 7788');
  await d.getByRole('radiogroup', { name: 'How did they hear of us?' }).getByRole('button', { name: 'Other', exact: true }).click();
  await d.getByLabel('Where from?').fill('Church bulletin');
  await d.getByRole('button', { name: 'Add lead' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Lead added: Opa Gunawan Setiadi.' }).first()).toBeVisible();
  const card = page.locator('[data-lead]').filter({ hasText: 'Gunawan Setiadi' });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Other · Church bulletin');
  await assertNoHorizontalScroll(page);

  // 3. Members: In the club has a Plan dropdown; Oma Lina's row says who is with her
  await page.goto('/members');
  await pickOption(page, 'Filter members', /^In the club/);
  await expect(page.locator('[data-member]')).toHaveCount(4); // control: m1 (just in), m2, m20, m10
  const lina = page.locator('[data-member="m1"]');
  await expect(lina.getByTestId('row-nanny')).toContainText('with Mbak Sari');
  await expect(page.locator('[data-member="m10"]').getByTestId('row-nanny')).toHaveCount(0);
  await pickOption(page, /^Plan$/, 'Gold');
  await expect(page.locator('[data-member]')).toHaveCount(2); // Hendra and Tjahjadi
  await expect(page.locator('[data-member="m2"]')).toBeVisible();
  await expect(page.locator('[data-member="m10"]')).toHaveCount(0);
  await expect(page.locator('[data-member="m1"]')).toHaveCount(0);
  await pickOption(page, /^Plan$/, 'Flex');
  await expect(page.locator('[data-member]')).toHaveCount(2); // Oma Lina and Opa Bambang
  await expect(page.locator('[data-member="m1"]')).toBeVisible();
  await expect(page.locator('[data-member="m1"]').getByTestId('row-nanny')).toContainText('with Mbak Sari');
  await pickOption(page, /^Plan$/, 'All plans');
  await expect(page.locator('[data-member]')).toHaveCount(4);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Caca: "Not seen for" 7 days lists the members who have been away a week, on Members and on the lobby rail', async ({ page, request }) => {
  const c = watchConsole(page);
  // 28 Oct: everybody last came on the 20th or 21st, so no one is past their own rhythm yet
  expect((await request.post('/api/demo/clock', { data: { hm: '09:30', allowBack: true, date: '2026-10-28' } })).ok()).toBeTruthy();
  await signIn(page, 's1', '/members?f=checkOn');
  await expect(page.getByRole('heading', { name: 'Members', level: 1 })).toBeVisible();
  const filter = page.getByRole('combobox', { name: 'Filter members' });
  await expect(filter).toContainText("Haven't come lately · 0");
  const notSeen = page.getByRole('combobox', { name: 'Not seen for' });
  await expect(notSeen).toContainText('Automatic'); // control: the Select is on screen, and the list is empty
  await expect(page.locator('[data-member]')).toHaveCount(0);

  await pickOption(page, 'Not seen for', '7 days');
  await expect(notSeen).toContainText('7 days');
  await expect(page.locator('[data-member]')).toHaveCount(4); // the five less Tjahjadi, whose membership is suspended for an unpaid invoice
  await expect(filter).toContainText("Haven't come lately · 4");
  expect(await page.evaluate(() => localStorage.getItem('cp.checkOn.days'))).toBe('7'); // remembered on this device
  await assertNoHorizontalScroll(page);

  // the lobby rail reads the same choice
  await page.goto('/today');
  await expect(page.getByText(/^Haven't come lately \(4\)/)).toBeVisible();
  await expect(page.locator('[data-check-on]')).toHaveCount(4);
  await expect(page.getByRole('combobox', { name: 'Not seen for' })).toContainText('7 days');
  // Automatic takes the members off again (the block stays only while a fixed choice is on)
  await pickOption(page, 'Not seen for', 'Automatic');
  await expect(page.locator('[data-check-on]')).toHaveCount(0);
  await expect(page.getByText(/^Haven't come lately \(/)).toHaveCount(0);
  c.assertClean();
});

test('Ega: Next month lists every member and what next month holds, a tap opens the follow-up; the Year view lists the closed days', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/renewals');
  await expect(page.getByRole('heading', { level: 1, name: 'Next month' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Members' })).toHaveAttribute('aria-selected', 'true');
  const list = page.getByTestId('next-month-list');
  await expect(list.locator('[data-member]')).toHaveCount(5); // the small seed's members, each with a plan and a status
  await expect(list.locator('[data-member="m1"]')).toContainText('Flex');
  await expect(list.locator('[data-member="m1"]')).toContainText('Continues');
  await expect(list.locator('[data-member="m46"]')).toContainText('Gold');
  await expect(list.getByTestId('next-count')).toContainText('5 continue');
  await assertNoHorizontalScroll(page);
  await list.locator('button[data-member="m1"]').click();
  await expect(page.getByRole('dialog', { name: /Oma Lina/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Calendar → Year: the closed days of 2026 (the closure and the outing) sit in a list under the months
  await page.goto('/calendar');
  await page.getByRole('tab', { name: 'Year' }).click();
  await expect(page.getByTestId('year-label')).toHaveText('2026');
  const closed = page.getByTestId('year-closed');
  await expect(closed).toContainText('Closed or away in 2026');
  const row = closed.locator('[data-testid="year-closed-row"][data-date="2026-10-30"]');
  await expect(row).toContainText('staff first-aid training');
  await expect(row).toHaveAttribute('data-kind', 'closed');
  await expect(closed.locator('[data-testid="year-closed-row"][data-date="2026-10-29"]')).toHaveAttribute('data-kind', 'outing');
  await expect(closed.locator('[data-testid="year-closed-row"][data-date="2026-10-29"]')).toContainText('Outing');
  await assertNoHorizontalScroll(page);
  // a tap on a row opens that day in the month
  await row.click();
  await expect(page.locator('div[data-date="2026-10-30"]')).toContainText('first-aid');
  c.assertClean();
});

test('Maria: Me says where Oma Lina is; a finished day is drawn done with its check-out row; past calendar rows are passed', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/me');
  await expect(page.getByTestId('me-parent-m1')).toContainText('Home today'); // control: the row is on screen and she is not in yet
  await act(request, 'attendance.checkIn', 'lina-in', { memberId: 'm1', method: 'manual' });
  await page.goto('/me');
  await expect(page.getByTestId('me-parent-m1')).toContainText(/At the club since \d\d:\d\d/);
  await act(request, 'attendance.checkOut', 'lina-out', { memberId: 'm1' });
  await page.goto('/me');
  await expect(page.getByTestId('me-parent-m1')).toContainText(/Went home \d\d:\d\d/);
  await expect(page.getByTestId('me-parent-m1')).not.toContainText('At the club since');

  // 20 Oct, a day she came and left: every row is done, and it ends with the home row
  await page.goto('/today?member=m1&date=2026-10-20');
  const tl = page.getByTestId('timeline');
  await expect(tl).toHaveAttribute('data-day', '2026-10-20');
  await expect(page.locator('[data-testid="timeline"] [data-tl^="session-"]').first()).toBeVisible();
  const rows = tl.locator('[data-tl]');
  expect(await rows.count()).toBeGreaterThan(3);
  expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))).toEqual(Array(await rows.count()).fill('done'));
  await expect(tl.locator('[data-tl="home"]')).toContainText('Home time');
  await expect(tl.locator('[data-tl="home"]')).toContainText('16:11');
  await assertNoHorizontalScroll(page);

  // the calendar: a day that is over has every bar passed; tomorrow has none
  await page.goto('/calendar?date=2026-10-20');
  const bars = page.locator('[data-testid="cal-row"] [data-passed]');
  await expect(bars.first()).toBeVisible();
  expect(await bars.evaluateAll((els) => els.map((e) => e.getAttribute('data-passed')))).not.toContain('0');
  await page.goto('/calendar?date=2026-10-22');
  await expect(bars.first()).toBeVisible();
  expect(await bars.evaluateAll((els) => els.map((e) => e.getAttribute('data-passed')))).not.toContain('1');
  c.assertClean();
});
