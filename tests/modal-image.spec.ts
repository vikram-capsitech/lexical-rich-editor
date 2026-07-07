import { test, expect } from '@playwright/test';

/**
 * Covers image selection/resizing against the ContentEditorComponent test
 * harness (example/src/ModalImageTestHarness.tsx), which wraps the editor in
 * a Fluent v8 `Modal` — matching how a "Full Panel"/dialog-style host embeds
 * the editor in a real consumer app.
 *
 * Root cause under test: Fluent's `Modal`/`Layer` renders its content through
 * its own separate React root. Lexical's image/inline-image decorator nodes
 * render into their own DOM node via `createPortal`, and clicking the image
 * only selected it via a `CLICK_COMMAND` handler registered on the editor
 * root — which requires the native click to bubble all the way up from the
 * image to that root. With the editor nested inside the Modal's separate
 * root, React stops native click propagation at the decorator's own portal
 * boundary, so the click never reached the editor root and the image could
 * never be selected (and therefore never resized). Fixed in
 * src/Nodes/ImageComponent.tsx and src/Nodes/InlineImageComponent.tsx by also
 * handling the click directly via a JSX `onClick` inside the same portal,
 * instead of relying solely on `CLICK_COMMAND` bubbling to the editor root.
 */

async function gotoHarness(page: import('@playwright/test').Page) {
  await page.goto('/?harness=modal-image');
  await page.locator('img').waitFor();
}

test('clicking an image inside a Fluent Modal selects it and shows resize handles', async ({ page }) => {
  await gotoHarness(page);

  const img = page.locator('img').first();
  await img.click({ position: { x: 1, y: 1 } });

  await expect(img).toHaveClass(/focused/);
  await expect(page.locator('.image-resizer')).toHaveCount(8);
});

test('clicking away from a selected image inside a Fluent Modal deselects it', async ({ page }) => {
  await gotoHarness(page);

  const img = page.locator('img').first();
  await img.click({ position: { x: 1, y: 1 } });
  await expect(img).toHaveClass(/focused/);

  await page.locator('span[data-lexical-text="true"]').first().click();

  await expect(img).not.toHaveClass(/focused/);
  await expect(page.locator('.image-resizer')).toHaveCount(0);
});

/**
 * Root cause: ImageComponent's KEY_DELETE_COMMAND/KEY_BACKSPACE_COMMAND
 * handler removed the selected image node but always `return false` —
 * telling Lexical's command system "not handled" — so the default,
 * lower-priority delete handling ran *again* afterward against a selection
 * that now pointed at an already-removed node. That corrupted the resulting
 * selection: instead of landing in the (now-empty) paragraph the image used
 * to occupy, the native browser caret ended up anchored on an unrelated
 * ancestor <div>, which is what read as "the cursor is stuck". Fixed by
 * returning `true` once the handler actually deletes the node.
 */
test('deleting a selected image leaves the caret in a sane, predictable place', async ({ page }) => {
  await gotoHarness(page);

  const img = page.locator('img').first();
  await img.click({ position: { x: 1, y: 1 } });
  await expect(img).toHaveClass(/focused/);

  await page.keyboard.press('Delete');

  await expect(page.locator('img')).toHaveCount(0);

  const anchor = await page.evaluate(() => {
    const sel = window.getSelection();
    return { nodeName: sel?.anchorNode?.nodeName, offset: sel?.anchorOffset };
  });
  // The selection must collapse into the paragraph the image occupied, not
  // onto some unrelated ancestor element.
  expect(anchor.nodeName).toBe('P');

  // The rest of the document must still be intact and editable — typing
  // lands exactly where clicked, not somewhere stale.
  await page.locator('span[data-lexical-text="true"]', { hasText: 'After image' }).click({ position: { x: 1, y: 5 } });
  await page.keyboard.type('XYZ');
  await expect(page.locator('.editor')).toContainText('XYZAfter image');
});
