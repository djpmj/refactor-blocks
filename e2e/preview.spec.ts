import { expect, test } from '@playwright/test';

test('「変更前の図を見る」を押すと、最初の状態のクラス・メソッドを読み取り専用で表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');

  // Act
  await page.getByRole('button', { name: '変更前の図を見る' }).click();

  // Assert
  const dialog = page.getByTestId('codebase-preview');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('preview-class-ReportService')).toContainText('printMonthlyReport');
  await expect(dialog.locator('.file-node__path')).toHaveCount(0);
  await expect(dialog).not.toContainText('.ts');

  // Act: 閉じるボタンで閉じる
  await dialog.getByRole('button', { name: '閉じる' }).click();

  // Assert
  await expect(dialog).toBeHidden();
});

test('「解答例の図を見る」を押すと、模範解答どおりに抽出した後の構造を表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');

  // Act
  await page.getByRole('button', { name: '解答例の図を見る' }).click();

  // Assert
  const dialog = page.getByTestId('codebase-preview');
  await expect(dialog.getByTestId('preview-class-ReportService')).toContainText('aggregateSales');
  await expect(dialog.locator('.file-node__path')).toHaveCount(0);
  await expect(dialog).not.toContainText('.ts');
});
