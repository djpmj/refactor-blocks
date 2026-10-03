import { expect, test } from '@playwright/test';

test('コードタブにチュートリアル1のクラスソースを表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル1: 長いメソッドを分ける' });
  await page.getByTestId('method-printMonthlyReport').click();

  // Act
  await page.getByRole('tab', { name: 'コード' }).click();

  // Assert
  const panel = page.getByRole('tabpanel', { name: 'コード' });
  await expect(panel.locator('pre code')).toContainText('public class ReportService');
  await expect(panel.locator('pre code')).toContainText('var monthlySales');
  await expect(panel.locator('pre code')).toContainText('Console.WriteLine');
  const source = panel.locator('pre code');
  expect(await source.locator('.hljs-keyword').count()).toBeGreaterThan(0);
  await expect(source.locator('.hljs-string').first()).toContainText('商品名 | 数量 | 売上');
  await expect(source.locator('.hljs-comment')).toContainText('レポートを出力する');
  expect(await source.locator('.hljs-number').count()).toBeGreaterThan(0);
  const sourceLineCount = (await source.textContent() ?? '').split('\n').length;
  const lineNumbers = panel.locator('.code-preview__line-numbers span');
  await expect(lineNumbers).toHaveCount(sourceLineCount);
  await expect(lineNumbers.first()).toHaveText('1');
  await expect(lineNumbers.last()).toHaveText(String(sourceLineCount));
  await expect(source).toContainText('public void printMonthlyReport()\n    {');
  await expect(source).toContainText('foreach (var row in rows)\n        {\n            Console.WriteLine(row);\n        }');
  await expect(source).toContainText('.GroupBy(s => s.ProductName)\n            .Select(');
  await expect(panel.getByRole('combobox', { name: 'コードの言語' })).toHaveValue('csharp');
  await page.getByRole('tab', { name: '編集' }).click();
  await expect(page.getByRole('tabpanel', { name: '編集' })).toBeVisible();
});

test('抽出後の呼び出し行をコードタブに呼び出し文として表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル1: 長いメソッドを分ける' });
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await page.getByTestId('method-printMonthlyReport').click();

  // Act
  await page.getByRole('tab', { name: 'コード' }).click();

  // Assert
  const source = page.getByRole('tabpanel', { name: 'コード' }).locator('pre code');
  await expect(source).toContainText('aggregateSales();');
  await expect(source).not.toContainText('// 未入力: aggregateSales() を呼び出す');
});
