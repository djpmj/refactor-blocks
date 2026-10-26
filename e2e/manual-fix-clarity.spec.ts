import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('opening fix hides method names until refactoring begins', async ({ page }) => {
  await page.goto('/');
  const tour = page.getByTestId('first-visit-tour');
  if (await tour.isVisible()) await tour.getByRole('button', { name: 'ガイドを終了' }).click();
  await selectStage(page, '中級1: 循環依存を断ち切る', { completeOpeningFix: false });
  await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  const card = page.getByRole('region', { name: 'もし、この変更が来たら?' });
  await expect(card).toContainText('まず手で直してみよう');
  await expect(card).not.toContainText('直す場所は今 3 か所');
  await expect(card).not.toContainText('Order.checkout');
  await page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' }).click();
  await expect(page.getByRole('button', { name: 'リリースする' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Order.checkout() を直した' }).check();
  await page.getByRole('checkbox', { name: 'Customer.calculateOrderTotal() を直した' }).check();
  await page.getByRole('checkbox', { name: 'Order.getLines() を直した' }).check();
  await page.getByRole('button', { name: 'リリースする' }).click();
  await page.getByRole('button', { name: '組み替えを始める' }).click();
  await expect(card).toContainText('Order.checkout');
  await expect(card).toContainText('直す場所は今 3 か所');
  await expect(page.getByTestId('opening-fix-banner')).toHaveCount(0);
});

test('a solved opening fix reports the read volume and scrolls result actions into view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto('/');
  const tour = page.getByTestId('first-visit-tour');
  if (await tour.isVisible()) await tour.getByRole('button', { name: 'ガイドを終了' }).click();
  await selectStage(page, 'チュートリアル2: 太った placeOrder', { completeOpeningFix: false });
  await page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' }).click();
  await expect(page.getByRole('button', { name: 'リリースする' })).toBeInViewport();
  await page.getByRole('checkbox', { name: 'OrderService.placeOrder() を直した' }).check();
  await page.getByRole('button', { name: 'リリースする' }).click();
  await expect(page.getByText(/この変更のために 31 行を読みました/)).toBeVisible();
  await expect(page.getByRole('button', { name: '組み替えを始める' })).toBeInViewport();
});
