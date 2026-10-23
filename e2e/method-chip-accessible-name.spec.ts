import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('method chips expose spoken visibility, warnings, and selection state', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級2: 何でも入った1つのファイル');

  const balance = page.getByTestId('method-getBalance');
  const shipping = page.getByTestId('method-calculateShippingFee');
  await expect(balance).toHaveAccessibleName('getBalance()、public、7行');
  await expect(balance).not.toHaveAccessibleName(/\+/);
  await expect(shipping).toHaveAccessibleName(/private/);
  await balance.click();
  await expect(balance).toHaveAttribute('aria-pressed', 'true');
  await expect(shipping).toHaveAttribute('aria-pressed', 'false');

  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await expect(page.getByTestId('method-printMonthlyReport')).toHaveAccessibleName(/行数の上限 28行を超えています/);
});
