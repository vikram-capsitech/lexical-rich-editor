import { test, expect } from '@playwright/test';

/**
 * Covers the table cell action-menu (row/column insert/delete dropdown)
 * tracking its anchor cell across scroll, against the main demo app.
 *
 * Root cause under test: the button portals to `document.body` with
 * `position: fixed`, positioned from a `getBoundingClientRect()` snapshot
 * (`anchorRect`) taken once whenever the selection changes. Unlike
 * FloatLinkEditor and CharacterStylesPopupPlugin — which both reposition
 * their own floating surfaces on `scroll`/`resize` — this plugin never
 * recomputed `anchorRect` on those events, so scrolling the page (or the
 * editor's own scroll container) after clicking into a cell left the button
 * frozen at its old viewport position while the actual cell moved away
 * underneath it. Fixed by adding the same `window`/root `scroll`/`resize`
 * listeners the other floating surfaces already use, re-running the same
 * selection-based position calculation.
 */

test('the table action-menu button tracks its cell across a page scroll', async ({ page }) => {
  await page.goto('/');
  await page.locator('[contenteditable="true"]').first().waitFor();

  await page.getByTitle('Add table').click();
  await page.getByPlaceholder('Rows').fill('3');
  await page.getByPlaceholder('Columns').fill('3');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const cell = page.locator('table td, table th').first();
  await cell.click();

  const button = page.locator('.aoTableActionHandleBtn');
  await expect(button).toBeVisible();

  await page.evaluate(() => window.scrollBy(0, 80));
  // Position updates asynchronously (React state from a scroll listener) —
  // poll rather than asserting immediately after the scroll.
  await expect(async () => {
    const cellBox = await cell.boundingBox();
    const buttonBox = await button.boundingBox();
    expect(cellBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    // Button sits a small, fixed offset below/right of the cell's top-left
    // (see TableActionMenuPlugin.tsx's handleStyle) — assert it moved with
    // the cell rather than staying at its pre-scroll position.
    expect(buttonBox!.y).toBeGreaterThan(cellBox!.y);
    expect(buttonBox!.y - cellBox!.y).toBeLessThan(20);
  }).toPass({ timeout: 5000 });
});
