import { test, expect } from '@playwright/test';

/**
 * Covers the table cell action-menu (row/column insert/delete dropdown)
 * hiding once its anchor cell scrolls out of view, against the main demo app.
 *
 * Root cause under test: TableActionMenuPlugin recomputes the button's
 * position on every scroll (see table-action-menu-scroll.spec.ts) but never
 * checked whether the cell was still actually visible. `handleStyle` clamps
 * `top` to `Math.max(8, ...)`, so once the cell scrolled above the viewport
 * the button got pinned to the top edge instead of disappearing — it kept
 * floating on its own with no table beneath it. Fixed by adding
 * `isRectVisible`/`getScrollClipAncestor` checks that fold into `canShow`,
 * hiding the button whenever the cell is clipped out of the window viewport
 * or its nearest scrollable ancestor.
 */

test('the table action-menu button hides once its cell scrolls out of view', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.waitFor();
  await editor.click();

  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 15; i++) {
    await page.keyboard.type(`padding line ${i}`);
    await page.keyboard.press('Enter');
  }

  await page.getByTitle('Add table').click();
  await page.getByPlaceholder('Rows').fill('3');
  await page.getByPlaceholder('Columns').fill('3');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  for (let i = 0; i < 15; i++) {
    await page.keyboard.type(`after-table padding line ${i}`);
    await page.keyboard.press('Enter');
  }

  const cell = page.locator('table td, table th').first();
  await cell.click();

  const button = page.locator('.aoTableActionHandleBtn');
  await expect(button).toBeVisible();

  await page.mouse.wheel(0, 1500);

  await expect(button).toBeHidden();
});
