import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test.beforeEach(async ({ request }) => {
  const response = await request.get('/items');
  const items: { _id: string }[] = await response.json();
  for (const item of items) await request.delete(`/items/${item._id}`);
});

test('complete shopping journey persists across reloads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Deine Liste ist leer.')).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Was brauchst du?' });
  await input.fill('  Butter  ');
  await input.press('Enter');
  const checkbox = page.getByRole('checkbox', { name: 'Butter: gekauft' });
  await expect(checkbox).toBeVisible();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  // Controlled checkboxes change only after the API confirms persistence.
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await expect(page.locator('.item-name')).toHaveCSS('text-decoration-line', 'line-through');
  await expect(page.getByText('Alle Produkte gekauft.')).toBeVisible();
  await page.reload();
  await expect(checkbox).toBeChecked();
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
  await expect(page.locator('.item-name')).toHaveCSS('text-decoration-line', 'none');
  await page.getByRole('button', { name: 'Butter löschen' }).click();
  await expect(checkbox).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Deine Liste ist leer.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('validates blanks and preserves the input when saving fails', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Was brauchst du?' });
  await expect(input).toBeEnabled();
  await input.fill('   ');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Produktnamen');
  await page.route('**/items', async (route) => {
    if (route.request().method() === 'POST') await route.abort();
    else await route.continue();
  });
  await input.fill('Hafermilch');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('nicht erreichbar');
  await expect(input).toHaveValue('Hafermilch');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.unroute('**/items');
  await page.getByRole('button', { name: 'Liste neu laden' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(input).toBeEnabled();
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Hafermilch: gekauft' })).toBeVisible();
});

test('keeps the stored status and row when updates or deletions fail', async ({ page, request }) => {
  await request.post('/items', { data: { name: 'Brot' } });
  await page.goto('/');
  const checkbox = page.getByRole('checkbox', { name: 'Brot: gekauft' });
  await expect(checkbox).toBeVisible();
  await page.route('**/items/*', (route) => route.fulfill({ status: 500, json: { error: 'Test: Speichern fehlgeschlagen.' } }));
  await checkbox.click();
  await expect(page.getByRole('alert')).toContainText('Speichern fehlgeschlagen');
  await expect(checkbox).not.toBeChecked();
  await page.getByRole('button', { name: 'Brot löschen' }).click();
  await expect(page.getByRole('alert')).toContainText('Speichern fehlgeschlagen');
  await expect(checkbox).toBeVisible();
});

test('recovers from a failed initial load', async ({ page }) => {
  await page.route('**/items', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('nicht erreichbar');
  await expect(page.getByText('Noch keine Liste geladen')).toBeVisible();
  const retry = page.getByRole('button', { name: 'Liste neu laden' });
  await expect(retry).not.toBeFocused();
  await retry.focus();
  await retry.press('Enter');
  await expect(page.getByText('Deine Liste wird geladen …')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('nicht erreichbar');
  await expect(retry).toBeFocused();
  await page.unroute('**/items');
  await retry.press('Enter');
  await expect(page.getByText('Deine Liste ist leer.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toBeFocused();
});

test('prevents double submissions and overlapping mutations on a row', async ({ page, request }) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Was brauchst du?' });
  await expect(input).toBeEnabled();
  await page.route('**/items**', async (route) => {
    if (route.request().method() !== 'GET') await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await input.fill('Kaffee');
  await input.press('Enter');
  await input.press('Enter');
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  const checkbox = page.getByRole('checkbox', { name: 'Kaffee: gekauft' });
  await checkbox.click();
  await expect(checkbox).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Kaffee löschen' })).toHaveAttribute('aria-disabled', 'true');
  await expect(checkbox).toBeChecked();
  const items: unknown[] = await (await request.get('/items')).json();
  expect(items).toHaveLength(1);
});

test('supports long names, keyboard use, and accessible responsive layouts', async ({ page, request }, testInfo) => {
  for (const name of ['Äpfel', 'Hafermilch', 'Vollkornbrot', 'Tomaten', 'Kaffee']) {
    await request.post('/items', { data: { name } });
  }
  await page.goto('/');
  await expect(page.getByRole('checkbox')).toHaveCount(5);
  await page.getByRole('checkbox', { name: 'Hafermilch: gekauft' }).click();
  await expect(page.getByRole('checkbox', { name: 'Hafermilch: gekauft' })).toBeChecked();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('shopping-list.png'), fullPage: true, animations: 'disabled' });
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole('textbox').fill('X'.repeat(120));
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('checkbox')).toHaveCount(6);
  await page.getByRole('checkbox', { name: 'Äpfel: gekauft' }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('checkbox', { name: 'Äpfel: gekauft' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Äpfel: gekauft' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('preserves keyboard focus through delayed toggles and chooses a useful target after deletion', async ({ page, request }) => {
  for (const name of ['Brot', 'Milch', 'Äpfel']) await request.post('/items', { data: { name } });
  await page.goto('/');
  await page.route('**/items/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  const bread = page.getByRole('checkbox', { name: 'Brot: gekauft' });
  await bread.focus();
  await bread.press('Space');
  await expect(bread).toHaveAttribute('aria-disabled', 'true');
  await expect(bread).toBeFocused();
  await expect(bread).toBeChecked();
  await expect(bread).toBeFocused();
  const removeBread = page.getByRole('button', { name: 'Brot löschen' });
  await removeBread.focus();
  await removeBread.press('Enter');
  await expect(removeBread).toHaveAttribute('aria-disabled', 'true');
  await expect(removeBread).toBeFocused();
  await expect(bread).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Milch: gekauft' })).toBeFocused();
  await page.getByRole('button', { name: 'Äpfel löschen' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Äpfel: gekauft' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Milch: gekauft' })).toBeFocused();
  await page.getByRole('button', { name: 'Milch löschen' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toBeFocused();
});

test('keeps the loaded empty state and input focus after a failed add', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Deine Liste ist leer.')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.route('**/items', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.fulfill({ status: 500, json: { error: 'Speichern fehlgeschlagen.' } });
    } else await route.continue();
  });
  const input = page.getByRole('textbox');
  await input.fill('Milch');
  await page.getByRole('button', { name: 'Hinzufügen' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Speichern fehlgeschlagen.');
  await expect(input).toHaveValue('Milch');
  await expect(input).toBeFocused();
  await expect(page.getByText('Noch keine Liste geladen')).toHaveCount(0);
  await expect(page.getByText('Deine Liste ist leer.')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('has accessible loading and initial error states', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/items', async (route) => {
    await gate;
    await route.fulfill({ status: 500, json: { error: 'Laden fehlgeschlagen.' } });
  });
  await page.goto('/');
  try {
    await expect(page.getByText('Deine Liste wird geladen …')).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  } finally {
    release();
  }
  await expect(page.getByRole('alert')).toHaveText('Laden fehlgeschlagen.');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('shows the first product without scrolling on small screens', async ({ page, request }, testInfo) => {
  await request.post('/items', { data: { name: 'Butter' } });
  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const firstRow = page.getByRole('listitem').first();
    await expect(firstRow).toBeVisible();
    const bounds = await firstRow.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`compact-${viewport.width}.png`), fullPage: true, animations: 'disabled' });
  }
});
