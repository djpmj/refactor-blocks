import { expect, test } from '@playwright/test';

test('コードタブにチュートリアル1のクラスソースを表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByText('printMonthlyReport', { exact: true }).first().click();

  // Act
  await page.getByRole('tab', { name: 'コード' }).click();

  // Assert
  const panel = page.getByRole('tabpanel', { name: 'コード' });
  await expect(panel.locator('pre code')).toContainText('public class ReportService');
  await expect(panel.locator('pre code')).toContainText('var monthlySales');
  await expect(panel.locator('pre code')).toContainText('Console.WriteLine');
  await expect(panel.getByRole('combobox', { name: 'コードの言語' })).toHaveValue('csharp');
  await page.getByRole('tab', { name: '編集' }).click();
  await expect(page.getByRole('tabpanel', { name: '編集' })).toBeVisible();
});
