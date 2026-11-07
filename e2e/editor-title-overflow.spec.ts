import { expect, test, type Locator } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function fitsInPanel(title: Locator): Promise<boolean> {
  return title.evaluate((element) => element.scrollWidth <= element.clientWidth);
}

test('長いクラス名.メソッド名の見出しが右に切れずパネル幅で折り返す', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '上級7: 金額と通貨を Money にまとめる');

  // Act
  await page.getByTestId('method-submitExpense').click();

  // Assert
  const title = page.locator('.method-editor__title');
  await expect(title).toContainText('ExpenseApplicationService.submitExpense()');
  await expect.poll(() => fitsInPanel(title)).toBe(true);
  await expect(page.locator('.method-editor__title .line-badge')).toBeVisible();

  // 幅を狭めても切れない
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect.poll(() => fitsInPanel(title)).toBe(true);
  await expect(page.locator('.method-editor__title .line-badge')).toBeVisible();
});
