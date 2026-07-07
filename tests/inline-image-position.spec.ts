import path from 'path';
import { test, expect } from '@playwright/test';

/**
 * Covers "typing text, then inserting a right-positioned inline image,
 * shifts the already-typed text to the right too", against the
 * ContentEditorComponent test harness (example/src/InlineImagePositionHarness.tsx).
 *
 * Root cause under test: INSERT_INLINE_IMAGE_COMMAND (src/Plugins/InlineImage.tsx)
 * used to call `parent.setFormat(fmt)` on the image's containing paragraph to
 * fake a "position: right" effect — but `format` on an ElementNode maps to
 * `text-align`, which applies to every child of that paragraph, not just the
 * image. Since the image is inserted into whatever paragraph the cursor is
 * in, any text already typed there got right-aligned along with it. Fixed by
 * removing that side effect and instead giving `.inline-editor-image.position-left`/
 * `-right` a real `float: left`/`float: right` (src/Theme/index.css), so the
 * image wraps within the line without touching the paragraph's own alignment.
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

test('inserting a right-positioned inline image does not right-align pre-existing paragraph text', async ({ page }) => {
  await gotoHarness(page);

  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.press('End');

  const paragraph = page.locator('[contenteditable="true"] p').first();
  await expect(paragraph).toHaveCSS('text-align', 'left');

  await insertInlineImage(page, 'Right');

  // Same paragraph (image shares it with the pre-existing text) — must stay left-aligned.
  await expect(page.locator('[contenteditable="true"] p')).toHaveCount(1);
  await expect(paragraph).toHaveCSS('text-align', 'left');
  await expect(page.locator('.inline-editor-image')).toHaveCSS('float', 'right');
});

test('a left-positioned inline image floats left and leaves paragraph alignment alone', async ({ page }) => {
  await gotoHarness(page);

  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.press('End');

  await insertInlineImage(page, 'Left');

  await expect(page.locator('[contenteditable="true"] p').first()).toHaveCSS('text-align', 'left');
  await expect(page.locator('.inline-editor-image')).toHaveCSS('float', 'left');
});
