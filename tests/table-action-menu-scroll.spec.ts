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

/**
 * Root cause under test: the button is a position: fixed portal outside the
 * editor's own overflow:auto container, so it isn't clipped the way the
 * table itself is. With a large table, scrolling the editor's own content
 * (not the page) can carry the selected cell above/below the editor's own
 * edges while it stays selected. An earlier fix clamped the button's
 * position against the editor's own getBoundingClientRect() so it couldn't
 * float outside the editor into the surrounding page chrome — but that kept
 * the button visible, pinned to the editor's edge, even once the cell was
 * fully scrolled out of view, which just moved the "floats over unrelated
 * content" problem from the page chrome to the editor's own edge. Now the
 * button hides entirely once its cell has no overlap left with the editor's
 * visible area, and reappears once scrolling brings the cell back into view.
 */
test('the table action-menu button hides once its cell scrolls fully out of view, and reappears when scrolled back', async ({ page }) => {
  await page.goto('/');
  await page.locator('[contenteditable="true"]').first().waitFor();

  await page.getByTitle('Add table').click();
  await page.getByPlaceholder('Rows').fill('20');
  await page.getByPlaceholder('Columns').fill('5');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const editor = page.locator('[contenteditable="true"]').first();

  const firstCell = page.locator('table td, table th').first();
  await firstCell.click();

  const button = page.locator('.aoTableActionHandleBtn');
  await expect(button).toBeVisible();

  // Scroll the editor's own scroll container (not the page) past the
  // selected cell, without reselecting — the cursor stays in that cell.
  await editor.evaluate((el) => { el.scrollTop = el.scrollHeight; });

  await expect(button).toBeHidden({ timeout: 5000 });

  // Scroll back to the top so the cell is visible again.
  await editor.evaluate((el) => { el.scrollTop = 0; });

  await expect(button).toBeVisible({ timeout: 5000 });
});
