import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

const LOCK_REASON = '先に「実際に直してみる」を押してください';

test('冒頭の手直しの前は、抽出ボタンがロック中と分かり、手直し後に解ける', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder', { completeOpeningFix: false });

  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  const button = page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' });
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(button).not.toHaveClass(/button--primary/);
  await expect(button).toHaveAccessibleDescription(LOCK_REASON);
  await expect(page.getByText(LOCK_REASON)).toBeVisible();

  // aria-disabled のボタンは Playwright が「押せない」とみなすので force で押す(利用者は押せる)
  await button.click({ force: true });
  await expect(page.locator('.error-toast')).toContainText('まず「もし、この変更が来たら?」');
  await expect(page.getByTestId('method-calculateTax')).toHaveCount(0);

  await page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' }).click();
  const opening = page.getByRole('region', { name: '手で直すシミュレーション' });
  await opening.getByRole('button', { name: 'リリースする' }).click();
  await opening.getByRole('button', { name: '組み替えを始める' }).click();

  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await expect(button).not.toHaveAttribute('aria-disabled', 'true');
  await expect(button).toHaveClass(/button--primary/);
  await expect(page.getByText(LOCK_REASON)).toHaveCount(0);
  await button.click();
  await expect(page.getByTestId('method-calculateTax')).toBeVisible();
});
