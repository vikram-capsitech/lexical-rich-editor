import { test, expect } from '@playwright/test';

/**
 * Covers Shift+Delete correctly deleting a selection.
 *
 * Root cause under test: Chrome (and other browsers) map Shift+Delete to the
 * OS-level "Cut" shortcut, firing a native `cut` ClipboardEvent instead of an
 * ordinary delete keystroke. Lexical's default CUT_COMMAND handler awaits an
 * async clipboard write before deleting the selection — in hosts where
 * clipboard access is restricted, or the native `cut` event never reaches
 * Lexical's own listener (sandboxed iframes, some embedded/Electron
 * contexts, stricter Permissions-Policy setups), that chain can silently
 * never reach the delete step, making Shift+Delete look like it does
 * nothing. Fixed by RobustCutPlugin intercepting the keydown directly and
 * deleting the selection synchronously, independent of the native
 * cut/clipboard event pipeline — clipboard population is now a best-effort,
 * non-blocking side effect instead of a prerequisite for deletion.
 */
test('Shift+Delete removes the selected text', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.waitFor();

  const lastP = editor.locator('p').last();
  await lastP.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' testword', { delay: 30 });

  await page.keyboard.press('End');
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Shift+ArrowLeft');
  }

  await page.keyboard.press('Shift+Delete');

  const text = await editor.innerText();
  expect(text.endsWith('imperative ref API.')).toBeTruthy();
});

test('Shift+Delete on a collapsed cursor (no selection) does not throw or misbehave', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.waitFor();

  const lastP = editor.locator('p').last();
  await lastP.click();
  await page.keyboard.press('End');
  const before = await editor.innerText();

  await page.keyboard.press('Shift+Delete');

  const after = await editor.innerText();
  expect(after).toBe(before);
});
