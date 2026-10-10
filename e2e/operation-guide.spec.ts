import { expect, test } from '@playwright/test';
import { OPERATION_GUIDE } from '../src/presentation/guide/operationGuide.js';

test('操作ガイドはボタンと ? キーで開閉し、Esc・閉じるボタンでフォーカスを戻す', async ({ page }) => {
  await page.goto('/');
  const openButton = page.getByTestId('operation-guide-open');
  const dialog = page.getByTestId('operation-guide');
  await openButton.click();
  await expect(dialog).toBeVisible();

  for (const section of OPERATION_GUIDE) {
    await expect(dialog.getByRole('heading', { name: section.heading })).toBeVisible();
    for (const { operation, description } of section.items) {
      await expect(dialog.getByText(operation, { exact: true })).toBeVisible();
      await expect(dialog.getByText(description, { exact: true })).toBeVisible();
    }
  }

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(openButton).toBeFocused();

  await openButton.focus();
  await page.keyboard.press('Shift+/');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Shift+/');
  await expect(dialog).not.toBeVisible();
  await expect(openButton).toBeFocused();

  await openButton.click();
  const closeButton = page.getByTestId('operation-guide-close');
  await closeButton.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).not.toBeVisible();
  await expect(openButton).toBeFocused();
});

test('? は編集入力中は文字として入力でき、編集外でガイドを開く', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByTestId('operation-guide');
  const method = page.getByTestId('method-printMonthlyReport');
  await method.dblclick();
  const methodInput = method.getByLabel('メソッド名');
  await methodInput.focus();
  await page.keyboard.type('?');
  await expect(dialog).not.toBeVisible();
  await expect(methodInput).toHaveValue('?');

  await page.getByTestId('roadmap-open').focus();
  await page.keyboard.press('Shift+/');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByTestId('operation-guide-open').focus();
  await page.keyboard.press('Shift+/');
  await expect(dialog).toBeVisible();
});

test('設計くらべ・白紙設計では ? でガイドが開かない', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByTestId('operation-guide');
  await page.getByTestId('mode-quiz').click();
  await page.keyboard.press('Shift+/');
  await expect(dialog).not.toBeVisible();
  await page.getByTestId('mode-blank').click();
  await page.keyboard.press('Shift+/');
  await expect(dialog).not.toBeVisible();
});

test('幅600pxでも操作ガイドが画面内に収まり、内容をダイアログ内でスクロールできる', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 700 });
  await page.goto('/');
  await page.getByTestId('operation-guide-open').click();
  const dialog = page.getByTestId('operation-guide');
  const bounds = await dialog.boundingBox();
  if (bounds === null) throw new Error('操作ガイドの位置を取得できません');
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(600);
  const content = dialog.locator('.operation-guide__content');
  await expect(content).toBeVisible();
  expect(await content.evaluate((element) => element.scrollHeight)).toBeGreaterThan(await content.evaluate((element) => element.clientHeight));
});

test('ガイドの表示中もUndo・Redoの既存ショートカットが使える', async ({ page }) => {
  await page.goto('/');
  const method = page.getByTestId('method-printMonthlyReport');
  await method.dblclick();
  const methodInput = method.getByLabel('メソッド名');
  await methodInput.fill('renamedReport');
  await methodInput.press('Enter');
  await expect(page.getByTestId('method-renamedReport')).toBeVisible();

  await page.getByTestId('operation-guide-open').click();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('method-printMonthlyReport')).toBeVisible();
  await page.keyboard.press('Control+y');
  await expect(page.getByTestId('method-renamedReport')).toBeVisible();
});
