import { test, expect } from '@playwright/test';

/**
 * Covers the "uploaded image becomes a broken image after changing the view"
 * bug, against the ContentEditorComponent test harness
 * (example/src/ImageDataUrlRoundtripHarness.tsx).
 *
 * Root cause under test: an uploaded/pasted image is inserted with a
 * `data:image/...;base64,` src (see ImagePlugin.tsx / InlineImage.tsx, which
 * read files via `FileReader.readAsDataURL`). That insert goes straight
 * through a Lexical command, bypassing sanitizeHtml, so it renders fine
 * immediately. But re-mounting the editor elsewhere — e.g. a consumer app
 * switching between an inline compose panel and a "Full Panel" view, each
 * its own ContentEditorComponent instance — re-seeds the new instance from
 * the captured HTML via the `value` prop / setValue(), which DOES run
 * through sanitizeHtml(). That sanitizer used to strip every `data:` URI
 * unconditionally, including `data:image/...` on <img src>, silently
 * dropping the attribute and leaving a broken image icon. Fixed in
 * src/Utils/Sanitize.ts by allowlisting `data:image/...;base64,` specifically
 * for `img[src]` — still blocking `data:`/`javascript:` on links, and any
 * non-image `data:` URI, everywhere else.
 */

async function gotoHarness(page: import('@playwright/test').Page) {
  await page.goto('/?harness=image-roundtrip');
  await page.locator('[contenteditable="true"]').waitFor();
}

test('an uploaded (data:image) image survives a view-change round-trip', async ({ page }) => {
  await gotoHarness(page);

  await page.getByTestId('insert-data-url-image').click();
  await expect(page.locator('img')).toHaveCount(1);
  await expect(page.getByTestId('output-html')).toContainText('data:image');

  // Simulates switching views: capture the current HTML (getValue) and
  // re-seed a freshly mounted editor with it (setValue) — the same round
  // trip a consumer performs when swapping ContentEditorComponent instances.
  await page.getByTestId('simulate-view-change').click();

  await expect(page.getByTestId('output-html')).toContainText('data:image');
  const img = page.locator('img').first();
  await expect(img).toHaveCount(1);
  await expect(img).toHaveAttribute('src', /^data:image\//);
});

test('dangerous URLs are still stripped after the data:image allowlist fix', async ({ page }) => {
  await gotoHarness(page);

  await page.getByTestId('insert-dangerous-content').click();

  const out = page.getByTestId('output-html');
  await expect(out).not.toContainText('data:text/html');
  await expect(out).not.toContainText('javascript:');
  await expect(out).toContainText('<img src="" alt="evil-img"');
});

test('an image that fails to load renders the broken-image fallback instead of hanging forever', async ({ page }) => {
  await gotoHarness(page);

  // Root cause: useSuspenseImage (ImageComponent.tsx / InlineImageComponent.tsx)
  // threw a promise that only resolved on `onload` — a failed load left the
  // Suspense boundary suspended forever, rendering nothing at all (not even
  // the BrokenImage fallback). Fixed by also resolving on `onerror`.
  await page.getByTestId('insert-broken-image').click();

  // BrokenImage renders a hardcoded alt="broken-image", not the original alt text.
  await expect(page.locator('img[alt="broken-image"]')).toHaveCount(1);
});
