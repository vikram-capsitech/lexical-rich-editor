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
 * edges while it stays selected — the previous fix only recomputed the
 * button's position on scroll, clamping it against the browser viewport, so
 * the button ended up floating into the surrounding page chrome (e.g. above
 * the editor, overlapping the toolbar) instead of staying inside the content
 * area the table actually lives in. Fixed by clamping against the editor's
 * own getBoundingClientRect() instead of the viewport.
 */
test('the table action-menu button stays inside the editor when a large table is scrolled internally', async ({ page }) => {
  await page.goto('/');
  await page.locator('[contenteditable="true"]').first().waitFor();

  await page.getByTitle('Add table').click();
  await page.getByPlaceholder('Rows').fill('20');
  await page.getByPlaceholder('Columns').fill('5');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const editor = page.locator('[contenteditable="true"]').first();
  const editorBox = await editor.boundingBox();
  expect(editorBox).not.toBeNull();

  const firstCell = page.locator('table td, table th').first();
  await firstCell.click();

  const button = page.locator('.aoTableActionHandleBtn');
  await expect(button).toBeVisible();

  // Scroll the editor's own scroll container (not the page) past the
  // selected cell, without reselecting — the cursor stays in that cell.
  await editor.evaluate((el) => { el.scrollTop = el.scrollHeight; });

  await expect(async () => {
    const buttonBox = await button.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.y).toBeGreaterThanOrEqual(editorBox!.y);
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(editorBox!.y + editorBox!.height);
    expect(buttonBox!.x).toBeGreaterThanOrEqual(editorBox!.x);
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(editorBox!.x + editorBox!.width);
  }).toPass({ timeout: 5000 });
});
