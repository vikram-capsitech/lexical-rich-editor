import { test, expect } from '@playwright/test';

/**
 * Covers the table cell action-menu (row/column insert/delete dropdown)
 * hiding once its cell is only PARTIALLY clipped by a scroll container's
 * bottom edge, against the InlineImagePositionHarness (chosen because it
 * already renders the editor inside a small fixed-height `overflow: scroll`
 * box, matching a real host app's compact compose panel — see the sibling
 * table-action-menu-visibility.spec.ts, which covers the simpler
 * fully-offscreen case in the main demo's full-page scroll).
 *
 * Root cause under test: table-action-menu-visibility.spec.ts's fix only
 * hid the button when the cell was FULLY clipped out of view (no overlap at
 * all with the visible area). A cell that's still barely overlapping —
 * e.g. only its top few pixels remain above a scroll container's bottom
 * edge — passed that "any overlap" check, so the button (which anchors near
 * the cell's TOP edge) kept rendering even though its own footprint no
 * longer fit in the remaining visible sliver, appearing to hover on its own
 * with no fully-visible row beneath it. Fixed by requiring the button's own
 * vertical footprint (not just any pixel of the cell) to fit within the
 * visible, un-clipped area.
 */

test('the table action-menu button hides once its cell is only partially clipped by a scroll container', async ({ page }) => {
  await page.goto('/?harness=inline-image-position');
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.waitFor();
  await editor.click();

  await page.getByTitle('Add table').click();
  await page.getByPlaceholder('Rows').fill('12');
  await page.getByPlaceholder('Columns').fill('6');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const rowIndex = 8;

  // Bring row 8 fully into view near the top of the scroll container first,
  // so selecting its cell doesn't trigger the browser's native
  // scroll-into-view correction (which would defeat the setup below).
  await page.evaluate((idx) => {
    const scrollable = Array.from(document.querySelectorAll('*')).filter(
      (n) => n.scrollHeight > n.clientHeight + 2,
    ).slice(-1)[0];
    const row = document.querySelectorAll('table tr')[idx];
    const rowRect = row.getBoundingClientRect();
    const containerRect = scrollable.getBoundingClientRect();
    scrollable.scrollTop += rowRect.top - (containerRect.top + 4);
    scrollable.dispatchEvent(new Event('scroll', { bubbles: true }));
  }, rowIndex);

  await page.locator('table tr').nth(rowIndex).locator('td, th').first().click();

  const button = page.locator('.aoTableActionHandleBtn');
  await expect(button).toBeVisible();

  // Scroll back up in small steps — this drags the already-visible row 8
  // toward and eventually past the scroll container's bottom edge, exactly
  // the "half hidden row, dropdown still shown" scenario reported. Bounded
  // loop (not expect().toPass()) since each step must actually land after
  // the previous one — there's no independent condition to just re-poll.
  let hidden = false;
  for (let step = 0; step < 60 && !hidden; step++) {
    await page.evaluate(() => {
      const scrollable = Array.from(document.querySelectorAll('*')).filter(
        (n) => n.scrollHeight > n.clientHeight + 2,
      ).slice(-1)[0];
      scrollable.scrollTop = Math.max(0, scrollable.scrollTop - 4);
      scrollable.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    hidden = !(await button.isVisible());
  }

  expect(hidden).toBe(true);
});
