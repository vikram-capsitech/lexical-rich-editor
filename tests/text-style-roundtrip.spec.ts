import { test, expect } from '@playwright/test';

/**
 * Covers "font-family / font-size / color / background-color applied via the
 * toolbar is lost after the editor's content round-trips through
 * getValue()/setValue()" — the exact cycle a consumer app's autosave or
 * view-switch (e.g. compose -> full panel) triggers — against the
 * ContentEditorComponent test harness (example/src/ImageDataUrlRoundtripHarness.tsx,
 * which already exposes a "simulate view change" getValue->setValue button).
 *
 * Root cause under test: Lexical's own default `<span>` DOM importer (see
 * `convertSpanElement`/`applyTextFormatFromStyle` in lexical core) only
 * derives format FLAGS (bold/italic/underline/strikethrough/sub/superscript)
 * from a style attribute — it never restores arbitrary CSS text like
 * font-family/font-size/color/background-color onto the TextNode's own style
 * string. Those four properties render fine in the live session (the
 * in-memory EditorState never lost them) but were silently dropped the
 * moment the content was serialized to HTML and reparsed — invisible until a
 * genuine HTML round-trip was tested, which no prior test covered. Fixed via
 * a custom `html.import` override for `span` (src/Utils/PreserveTextStyleOnImport.ts)
 * registered in ContentEditorComponent's initialConfig, which restores those
 * four properties in addition to (not instead of) Lexical's own format-flag
 * detection.
 */

async function gotoHarness(page: import('@playwright/test').Page) {
  await page.goto('/?harness=image-roundtrip');
  await page.locator('[contenteditable="true"]').waitFor();
}

test('font-family applied via the toolbar survives a getValue/setValue round-trip', async ({ page }) => {
  await gotoHarness(page);

  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('font test text');
  await page.keyboard.press('Home');
  for (let i = 0; i < 'font test text'.length; i++) await page.keyboard.press('Shift+ArrowRight');

  await page.locator('#font-family-option').click();
  await page.getByRole('option', { name: 'Courier New', exact: true }).click();

  const span = page.locator('[contenteditable="true"] span', { hasText: 'font test text' });
  await expect(span).toHaveCSS('font-family', '"Courier New"');
  await expect(page.getByTestId('output-html')).toContainText('font-family');

  await page.getByTestId('simulate-view-change').click();

  await expect(page.locator('[contenteditable="true"] span', { hasText: 'font test text' })).toHaveCSS(
    'font-family',
    '"Courier New"',
  );
});

test('text color applied via the toolbar survives a getValue/setValue round-trip', async ({ page }) => {
  await gotoHarness(page);

  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('color test text');
  await page.keyboard.press('Home');
  for (let i = 0; i < 'color test text'.length; i++) await page.keyboard.press('Shift+ArrowRight');

  await page.locator('button[title="Text color"]').click();
  const svBox = page.locator('[data-testid="color-sv-box"]');
  await svBox.waitFor();
  const box = (await svBox.boundingBox())!;
  await page.mouse.click(box.x + 5, box.y + 5);
  await page.keyboard.press('Escape');

  const span = page.locator('[contenteditable="true"] span', { hasText: 'color test text' });
  const colorBefore = await span.evaluate((el) => getComputedStyle(el).color);
  expect(colorBefore).not.toBe('rgb(0, 0, 0)');

  await page.getByTestId('simulate-view-change').click();

  const colorAfter = await page
    .locator('[contenteditable="true"] span', { hasText: 'color test text' })
    .evaluate((el) => getComputedStyle(el).color);
  expect(colorAfter).toBe(colorBefore);
});
