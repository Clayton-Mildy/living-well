// Round 13 phase 2 (small seed, demo day Wed 21 Oct 2026). One test per task; the phone project only.
// Isolated env: E2E_NAME=r13 E2E_PORT=8861 scripts/e2e-all.sh 1 "phone" round13
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';

test.beforeEach(async ({ request }) => { await resetDemo(request); });

test('lead history: the Enquiries History view lists the months, Leads comes back unchanged', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  await page.getByRole('tab', { name: 'History' }).click();
  const oct = page.getByRole('region', { name: 'October 2026' });
  await expect(oct).toContainText('4 opened'); // e1, e2, e3 and e5
  const sep = page.getByRole('region', { name: 'September 2026' });
  await expect(sep).toContainText('Chose another place 1'); // Ibu Nyoman Sari
  await oct.getByRole('button', { name: /^Leads \(4\)$/ }).click();
  await expect(oct).toContainText('Oma Siu Lan Tjandra');
  await expect(oct).toContainText('New 8 Oct · Trial 12 Oct');
  await assertNoHorizontalScroll(page);
  // back on Leads the stage chips are unchanged
  await page.getByRole('tab', { name: 'Leads' }).click();
  await expect(page.locator('[data-lead]').first()).toBeVisible();
  await expect(page.locator('[data-hist-lead]')).toHaveCount(0);
  c.assertClean();
});
