// Round 15 phase 1 follow-up (F6): on a tablet and a laptop the family Today day strip (the tiles under the hero picture) never overlaps or clips its labels;
// it scrolls sideways inside its column when the tiles do not fit, with the day being read in view.
// Isolated env: E2E_NAME=e5 E2E_PORT=8891 scripts/e2e-all.sh 1 tablet round15p1-strip   (it skips itself on a phone, which has the round faces)
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

test('Maria on a tablet or laptop: the day strip keeps its tiles apart, scrolls inside its column, and shows the selected day and "Tomorrow"', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'the tiles are the wide layout');
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today?member=m1&date=2026-10-20');
  const strip = page.getByTestId('day-strip');
  await expect(strip).toBeVisible();
  await expect(strip).toHaveAttribute('data-layout', 'tiles');
  const items = strip.locator('button[data-date]');
  expect(await items.count()).toBeGreaterThan(2);
  await expect(strip.locator('button[data-plan]')).toContainText('Tomorrow');

  // every tile sits inside the strip's scrollable width, none overlaps its neighbour, and no label runs past its tile
  const geo = await strip.evaluate((el) => {
    const tiles = Array.from(el.querySelectorAll<HTMLElement>('button[data-date]'));
    return {
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
      tiles: tiles.map((b) => {
        const label = b.lastElementChild as HTMLElement;
        const lr = label.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return { left: b.offsetLeft, width: b.offsetWidth, labelOver: lr.right - br.right, labelUnder: br.left - lr.left, text: label.textContent };
      }),
    };
  });
  let end = 0;
  for (const t of geo.tiles) {
    expect(t.left, `${t.text} starts after the previous tile`).toBeGreaterThanOrEqual(end);
    end = t.left + t.width;
    expect(t.labelOver, `${t.text} label runs past its tile`).toBeLessThanOrEqual(1);
    expect(t.labelUnder, `${t.text} label starts before its tile`).toBeLessThanOrEqual(1);
  }
  expect(end).toBeLessThanOrEqual(geo.scrollWidth);
  await assertNoHorizontalScroll(page);

  // the day being read is in view; scrolled to the end, "Tomorrow" is fully visible
  const inView = (loc: ReturnType<typeof strip.locator>) => loc.evaluate((b) => {
    const r = b.getBoundingClientRect();
    const s = b.parentElement!.getBoundingClientRect();
    return r.left >= s.left - 1 && r.right <= s.right + 1;
  });
  expect(await inView(strip.locator('button[data-selected="true"]'))).toBe(true);
  await strip.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  expect(await inView(strip.locator('button[data-plan]'))).toBe(true);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});
