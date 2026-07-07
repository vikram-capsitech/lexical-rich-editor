import { test, expect } from '@playwright/test';

/**
 * Covers the default header shading applied when inserting a table via the
 * toolbar's "Insert table" dialog (src/Plugins/Table.tsx), against the main
 * demo app (Pro toolbar level).
 *
 * Root cause under test: `$createTableNodeWithDimensions(row, col, true)` —
 * passing a bare `true` for `includeHeaders` marks BOTH the first row AND
 * the first column as headers, shading the entire top row and entire left
 * column of every freshly inserted table gray, with no way to opt out from
 * the Insert Table dialog (it has no header toggle). Fixed by passing
 * `{ rows: true, columns: false }` so only the first row is shaded — the
 * standard doc/spreadsheet convention.
 */

test('inserting a table shades only the first row, not the first column', async ({ page }) => {
  await page.goto('/');
  await page.locator('[contenteditable="true"]').first().waitFor();

  await page.getByTitle('Add table').click();
  await page.getByPlaceholder('Rows').fill('3');
  await page.getByPlaceholder('Columns').fill('3');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const rows = page.locator('table tr');
  await expect(rows).toHaveCount(3);

  // First row: every cell is a header (<th>).
  const firstRowCells = rows.nth(0).locator('th, td');
  await expect(firstRowCells).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(firstRowCells.nth(i)).toHaveJSProperty('tagName', 'TH');
  }

  // Every other row: no cell is a header, including the first column.
  for (let r = 1; r < 3; r++) {
    const cells = rows.nth(r).locator('th, td');
    await expect(cells).toHaveCount(3);
    for (let c = 0; c < 3; c++) {
      await expect(cells.nth(c)).toHaveJSProperty('tagName', 'TD');
    }
  }
});
