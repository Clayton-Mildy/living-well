// Playwright helpers for the UI kit (components/ui): Select, DateField, MonthField, TimeField, Pager and CameraCapture.
// The kit's controls are not native, so `selectOption()` and `fill('2026-10-21')` do not work on them; use these instead.
//   await pickOption(page, 'Method', 'Bank transfer');   // Select (a combobox + listbox)
//   await pickDate(page, 'Date', '2026-10-21');          // DateField (any year: it pages months and years)
//   calendarDay(page, "2026-10-21")                       // one day button of the open DateField popover (scoped, so it never matches a calendar screen)
//   await pickMonth(page, 'Month', '2026-11');           // MonthField
//   await pickTime(page, 'From', '09:30');               // TimeField (hour, then minute, then Done)
//   await goToPage(page, 2);                              // Pager: numbered button on tablet and laptop, Next on phone
//   await takePhotoWithFile(page);                        // CameraCapture without a camera: the file-picker fallback, then "Use photo"
import { expect, type Page } from '@playwright/test';

type Name = string | RegExp;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthIndex = (ym: string) => +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1);

/** Open a Select by its label and choose an option by its text. */
export async function pickOption(page: Page, label: Name, option: Name) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
}
/** A FilterChips control: a dropdown on a phone, a row of chips elsewhere. `option` is the chip / option text (e.g. /^Doctors/). */
export async function pickFilter(page: Page, label: Name, option: Name) {
  if (await page.getByRole('combobox', { name: label }).count()) return pickOption(page, label, option);
  await page.getByRole('group', { name: label }).getByRole('button', { name: option }).click();
}
/** The text shown in a Select (what the user sees chosen). */
export const selectedOption = (page: Page, label: Name) => page.getByRole('combobox', { name: label });

/** The calendar of the open DateField popover (not any other grid or [data-date] on the page, e.g. the calendar screen's own month cells). */
export const calendarOf = (page: Page) => page.locator('[role="dialog"] [role="grid"][data-month]');
/** One day button of the open DateField popover. */
export const calendarDay = (page: Page, iso: string) => calendarOf(page).locator(`[data-date="${iso}"]`);

const dateTrigger = (page: Page, label: Name) => page.getByRole('button', { name: label }).and(page.locator('[aria-haspopup="dialog"]'));

/** Open a DateField by its label and click the day ('YYYY-MM-DD'). */
export async function pickDate(page: Page, label: Name, iso: string) {
  await dateTrigger(page, label).click();
  const grid = calendarOf(page);
  await expect(grid).toBeVisible();
  const target = iso.slice(0, 7);
  const cur = (await grid.getAttribute('data-month'))!;
  const diff = monthIndex(target) - monthIndex(cur);
  if (Math.abs(diff) <= 6) {
    for (let i = 0; i < Math.abs(diff); i++) await page.getByRole('button', { name: diff > 0 ? 'Next month' : 'Previous month' }).click();
  } else {
    // far away (a birth date): month picker, year picker, then the year, the month and the day
    const year = +target.slice(0, 4);
    await page.locator('[data-cal-title]').click();
    await page.locator('[data-cal-title]').click();
    const yearBtn = page.getByRole('button', { name: String(year), exact: true });
    for (let i = 0; i < 40 && !(await yearBtn.isVisible()); i++) await page.getByRole('button', { name: year > +cur.slice(0, 4) ? 'Later years' : 'Earlier years' }).click();
    await yearBtn.click();
    await page.getByRole('button', { name: `${MONTHS[+target.slice(5, 7) - 1]} ${year}`, exact: true }).click();
  }
  await calendarDay(page, iso).click();
}
/** Open a MonthField by its label and choose 'YYYY-MM'. */
export async function pickMonth(page: Page, label: Name, ym: string) {
  await dateTrigger(page, label).click();
  const title = page.locator('[data-cal-title]');
  await expect(title).toBeVisible();
  const year = +ym.slice(0, 4);
  for (let i = 0; i < 40; i++) {
    const shown = +((await title.innerText()).match(/\d{4}/)?.[0] || year);
    if (shown === year) break;
    await page.getByRole('button', { name: shown < year ? 'Next year' : 'Previous year' }).click();
  }
  await page.getByRole('button', { name: `${MONTHS[+ym.slice(5, 7) - 1]} ${year}`, exact: true }).click();
}
/** Open a TimeField by its label and choose 'HH:MM' (the minute must be on the field's step, or be its current value). */
export async function pickTime(page: Page, label: Name, hm: string) {
  await dateTrigger(page, label).click();
  await page.getByRole('listbox', { name: 'Hour' }).getByRole('option', { name: hm.slice(0, 2), exact: true }).click();
  await page.getByRole('listbox', { name: 'Minute' }).getByRole('option', { name: hm.slice(3, 5), exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}
/** The text on a DateField / TimeField / MonthField trigger, e.g. 'Wed 21 Oct 2026' or '09:30'. */
export const fieldText = (page: Page, label: Name) => dateTrigger(page, label);

/** Pager: go to page n (numbered buttons on tablet and laptop; Next/Previous steps on phone). Pass `within` to scope to one list's pager. */
export async function goToPage(page: Page, n: number, within?: Name) {
  const nav = page.getByRole('navigation', { name: within || /Pages|pages/ }).first();
  const numbered = nav.getByRole('button', { name: `Page ${n}`, exact: true });
  if (await numbered.count()) { await numbered.click(); return; }
  const text = (await nav.innerText()).match(/Page (\d+) of/);
  let cur = text ? +text[1] : 1;
  while (cur !== n) { await nav.getByRole('button', { name: cur < n ? 'Next page' : 'Previous page' }).click(); cur += cur < n ? 1 : -1; }
}

/** A real 1x1 PNG (the client downscales it to a JPEG, uploads it and the app shows it back). */
export const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
/** CameraCapture in a browser with no camera: it shows the file picker. Choose a file, then "Use photo". The dialog must already be open. */
export async function takePhotoWithFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer } = { name: 'photo.png', mimeType: 'image/png', buffer: TINY_PNG }) {
  const cam = page.getByRole('dialog', { name: 'Camera' });
  await expect(cam).toBeVisible();
  await cam.locator('input[type="file"]').setInputFiles(file);
  await cam.getByRole('button', { name: 'Use photo' }).click();
  await expect(cam).toBeHidden();
}
