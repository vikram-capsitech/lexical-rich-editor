import path from 'path';
import { test, expect } from '@playwright/test';

/**
 * Covers "inline image position (e.g. Right) is lost after the editor's
 * content round-trips through getValue()/setValue()" — the exact cycle a
 * consumer app's autosave/draft-reload triggers — against the
 * ContentEditorComponent test harness (example/src/InlineImagePositionHarness.tsx).
 *
 * Root cause under test: two separate gaps in InlineImageNode.tsx.
 *   1. exportDOM() emitted a bare `<img src alt width height>` with zero
 *      position info, so getValue() always dropped it.
 *   2. Even with position info added back to the exported HTML, both
 *      InlineImageNode and the block ImageNode register a DOM conversion for
 *      plain `img` tags; ImageNode's is an unconditional `priority: 2`, so
 *      any inline image re-imported via setValue()/paste always became a
 *      plain block ImageNode instead — losing the entire floated-inline
 *      layout, not just the position value.
 * Fixed by having exportDOM() always emit a `data-lexical-inline-image`
 * marker (independent of position) plus `data-position` when set, and having
 * InlineImageNode.importDOM() only outrank ImageNode's converter (return
 * `priority: 3`) when that marker is present.
 */

const TEST_IMAGE = path.join(__dirname, '..', 'example', 'public', 'test-image.png');

async function gotoHarness(page: import('@playwright/test').Page) {
  await page.goto('/?harness=inline-image-position');
  await page.locator('[contenteditable="true"]').waitFor();
}

async function insertInlineImage(page: import('@playwright/test').Page, position: 'Left' | 'Right' | 'Full') {
  await page.getByTitle('Add Inline Image').click();
  await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE);
  await page.getByText('Left', { exact: true }).click();
  await page.getByRole('option', { name: position }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

test('a right-positioned inline image keeps its position and float across a getValue/setValue round-trip', async ({ page }) => {
  await gotoHarness(page);

  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.press('End');

  await insertInlineImage(page, 'Right');

  const image = page.locator('.inline-editor-image');
  await expect(image).toHaveCSS('float', 'right');
  await expect(page.getByTestId('output-html')).toContainText('data-position="right"');

  await page.getByTestId('simulate-view-change').click();

  // Must still be exactly one inline image, still floated right — not a
  // plain block ImageNode with the position silently dropped.
  await expect(page.locator('.inline-editor-image')).toHaveCount(1);
  await expect(page.locator('.inline-editor-image')).toHaveCSS('float', 'right');
  await expect(page.getByTestId('output-html')).toContainText('data-position="right"');
});
