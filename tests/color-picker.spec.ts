import { test, expect, Page } from '@playwright/test';

/**
 * Covers the text-color / background-color picker flow against the
 * ContentEditorComponent test harness (example/src/ColorPickerTestHarness.tsx).
 *
 * Root cause under test: the picker used to continuously re-sync its local
 * color from the host's `value` prop while its popover was open, so a
 * stale/incorrect echo from the host's selection-readback round trip could
 * overwrite an in-progress pick the instant the mouse was released or the
 * popover was reopened. Fixed in src/Nodes/ColorPickerComponent.tsx by only
 * seeding from `value` on the closed -> open transition.
 *
 * The picker commits every preset click, hex edit, and SV/hue drag straight
 * through `onChange` as it happens (live commit) — there is no separate
 * "Apply" step to wait on, so these tests assert the applied color directly
 * after the triggering interaction. The picker is closed by toggling its
 * trigger button (no "Close" button in the flow being tested).
 * Architecture under test: picking a color (clicking the saturation/value
 * box, the hue bar, a preset swatch, or editing the hex field) only updates
 * the picker's local draft state — nothing is applied to the editor until
 * the user explicitly clicks Apply. This replaced an earlier design that
 * applied color continuously while dragging, which depended on Lexical
 * syncing DOM selection/focus on every single pointer move; in at least one
 * production environment that fought the popover for focus badly enough
 * that a drag's mouseup was sometimes never delivered to `window`, leaving
 * the drag "stuck" and silently overwriting the document with whatever
 * color a later, unrelated stray cursor movement happened to compute.
 * Committing once, deliberately, on Apply makes that whole failure class
 * structurally impossible: the editor is never touched by pointer movement.
 */

function hexToRgbString(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

async function gotoHarness(page: Page) {
  await page.goto('/?harness=color-picker');
  await page.locator('[contenteditable="true"]').waitFor();
}

async function selectAllEditorText(page: Page) {
  await page.locator('[contenteditable="true"]').click();
  await page.keyboard.press('Control+A');
}

/** Double-clicks a specific word inside a larger text run (browsers select the word under the cursor). */
async function dblClickWord(page: Page, word: string) {
  const point = await page.locator('[contenteditable="true"]').evaluate((root, w) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const idx = node.textContent?.indexOf(w) ?? -1;
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + w.length);
        const r = range.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
    }
    return null;
  }, word);
  if (!point) throw new Error(`Word "${word}" not found in editor`);
  await page.mouse.dblclick(point.x, point.y);
}

/** Opens the picker; calling this again while open toggles it closed (same trigger button). */
async function openPicker(page: Page, title: 'Text color' | 'Background color') {
  await page.getByTitle(title).click();
}

/** Closes the picker via its trigger button — there is no dedicated "Close" button. */
async function closePicker(page: Page, title: 'Text color' | 'Background color') {
  await page.getByTitle(title).click();
}

async function pickPreset(page: Page, hex: string) {
  await page.locator(`.aoLexSwatches button[title="${hex}"]`).click();
}

async function setCustomHex(page: Page, hex: string) {
  const input = page.locator('.aoLexRow:has-text("Hex") input');
  await input.fill(hex);
  await input.blur();
}

/** Reads the computed `color`/`backgroundColor` of the element wrapping a given text run. */
async function computedStyleOfText(
  page: Page,
  text: string,
  prop: 'color' | 'backgroundColor',
): Promise<string | null> {
  return page.locator('[contenteditable="true"]').evaluate((root, args) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes(args.text)) {
        const el = node.parentElement;
        if (!el) return null;
        return getComputedStyle(el)[args.prop as 'color' | 'backgroundColor'];
      }
    }
    return null;
  }, { text, prop });
}

/** Polls the computed style since live-commit updates flow through React/Lexical asynchronously. */
async function expectComputedStyle(
  page: Page,
  text: string,
  prop: 'color' | 'backgroundColor',
  expected: string,
) {
  await expect
    .poll(() => computedStyleOfText(page, text, prop))
    .toBe(expected);
}

test.describe('Color picker — text & background color', () => {
  test('applies a preset text color live on selection, with no Apply step', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Text color');
    await pickPreset(page, '#ff0000');

    await expectComputedStyle(page, 'AAAA', 'color', hexToRgbString('#ff0000'));
  });

  test('applies a custom (hex-entered) text color live on blur, with no Apply step', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Text color');
    await setCustomHex(page, '#123abc');

    await expectComputedStyle(page, 'AAAA', 'color', hexToRgbString('#123abc'));
  });

  test('applies a preset background color live on selection, with no Apply step', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Background color');
    await pickPreset(page, '#00ff00');

    await expectComputedStyle(page, 'AAAA', 'backgroundColor', hexToRgbString('#00ff00'));
  });

  test('applies a custom (hex-entered) background color live on blur, with no Apply step', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Background color');
    await setCustomHex(page, '#654321');

    await expectComputedStyle(page, 'AAAA', 'backgroundColor', hexToRgbString('#654321'));
  });

  test('picking a color does not touch the editor until Apply is clicked', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Text color');
    await pickPreset(page, '#0000ff');
    await closePicker(page, 'Text color');

    expect(await computedStyleOfText(page, 'AAAA', 'color')).not.toBe(hexToRgbString('#ff0000'));
  });

  test('reflects the actually-applied color after closing and reopening the picker', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Text color');
    await pickPreset(page, '#0000ff');
    await clickApply(page);

    await openPicker(page, 'Text color');
    const hexInput = page.locator('.aoLexRow:has-text("Hex") input');
    await expect(hexInput).toHaveValue('#0000ff');
  });

  test('color formatting survives a parent re-render', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Text color');
    await pickPreset(page, '#ff9900');

    await expectComputedStyle(page, 'AAAA', 'color', hexToRgbString('#ff9900'));

    await page.getByTestId('force-rerender').click();
    await page.getByTestId('force-rerender').click();

    await expectComputedStyle(page, 'AAAA', 'color', hexToRgbString('#ff9900'));
  });

  test('selecting a preset color does not submit the surrounding form', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Text color');
    await pickPreset(page, '#9900ff');

    await expectComputedStyle(page, 'AAAA', 'color', hexToRgbString('#9900ff'));
    await expect(page.getByTestId('submit-count')).toHaveText('0');
  });

  test('applied formatting is present in the final HTML/editor state', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Text color');
    await pickPreset(page, '#4a86e8');

    // Lexical's HTML export normalizes inline color values through the
    // browser's CSSStyleDeclaration, so the stored HTML contains the
    // rgb() form rather than the literal hex string that was applied.
    await expect(page.getByTestId('output-html')).toContainText(hexToRgbString('#4a86e8'));
  });

  test('applying color to one word does not affect unrelated text', async ({ page }) => {
    await gotoHarness(page);
    await dblClickWord(page, 'AAAA');
    await openPicker(page, 'Text color');
    await pickPreset(page, '#ff0000');

    await expectComputedStyle(page, 'AAAA', 'color', hexToRgbString('#ff0000'));
    expect(await computedStyleOfText(page, 'BBBB', 'color')).not.toBe(hexToRgbString('#ff0000'));
  });

  test('clicking inside the saturation/value box picks a color and applies it on Apply', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Text color');

    const sv = page.getByTestId('color-sv-box');
    const box = await sv.boundingBox();
    if (!box) throw new Error('SV picker not visible');

    // Click a non-corner point so the result is unambiguous (not a default).
    await sv.click({ position: { x: box.width * 0.25, y: box.height * 0.25 } });

    const hexInput = page.locator('.aoLexRow:has-text("Hex") input');
    const pickedHex = await hexInput.inputValue();
    expect(pickedHex.toLowerCase()).not.toBe('#ffffff');
    expect(pickedHex.toLowerCase()).not.toBe('#000000');

    // Not applied yet — picking is local-only until Apply.
    expect(await computedStyleOfText(page, 'AAAA', 'color')).not.toBe(hexToRgbString(pickedHex));

    await clickApply(page);
    expect((await computedStyleOfText(page, 'AAAA', 'color'))?.toLowerCase()).toBe(
      hexToRgbString(pickedHex),
    );
  });

  test('clicking the hue bar picks a color and applies it on Apply', async ({ page }) => {
    await gotoHarness(page);
    await selectAllEditorText(page);
    await openPicker(page, 'Text color');

    const hue = page.locator('.aoLexHue');
    const box = await hue.boundingBox();
    if (!box) throw new Error('Hue bar not visible');

    await hue.click({ position: { x: box.width * 0.5, y: box.height / 2 } });

    const hexInput = page.locator('.aoLexRow:has-text("Hex") input');
    const pickedHex = await hexInput.inputValue();

    await expectComputedStyle(page, 'AAAA', 'color', hexToRgbString(draggedHex));
  });
});
