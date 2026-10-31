import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function extractPrintOnly(page: Page) {
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByRole('checkbox').nth(4).check();
  await page.getByLabel('新しいメソッド名').fill('printSalesReport');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('出力だけを抽出すると、効いていない理由が → と灰色系で出て、点数は90点のまま、お知らせも読める', async ({ page }) => {
  // Arrange & Act
  await extractPrintOnly(page);

  // Assert
  const result = page.getByTestId('operation-result');
  await expect(result).toHaveClass(/operation-result--unchanged/);
  await expect(page.getByTestId('operation-result-line')).toHaveText([
    /^効いていません: ReportService\.printMonthlyReport\(\) は\d+行→\d+行に減りましたが、上限28行をまだ\d+行超えています$/,
  ]);
  await expect(result).toContainText('→');
  await expect(page.getByTestId('score-announcement')).toHaveText('90点');
  await expect(page.locator('.error-toast[role="status"]')).toContainText('抽出すると');
});

test('×とキーボードで閉じられ、Undoで消える', async ({ page }) => {
  // Arrange
  await extractPrintOnly(page);
  const result = page.getByTestId('operation-result');
  await expect(result).toBeVisible();

  // Act & Assert: ×
  await page.getByRole('button', { name: '操作の結果を閉じる' }).click();
  await expect(result).toBeHidden();

  // Act & Assert: Undo で消える
  await page.getByRole('button', { name: '元に戻す' }).click();
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByRole('checkbox').nth(4).check();
  await page.getByLabel('新しいメソッド名').fill('printSalesReport');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(result).toBeVisible();
  await page.getByRole('button', { name: '操作の結果を閉じる' }).focus();
  await page.keyboard.press('Enter');
  await expect(result).toBeHidden();
  await page.getByRole('button', { name: '元に戻す' }).click();
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByRole('checkbox').nth(4).check();
  await page.getByLabel('新しいメソッド名').fill('printSalesReport');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(result).toBeVisible();
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(result).toBeHidden();
});

test('クラス名を変えただけ(配置が変わらない)では何も出ない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');

  // Act
  await page.getByTestId('class-header-ReportService').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '名前を変更' }).click();
  const nameInput = menu.getByLabel('新しいクラス名');
  await nameInput.fill('MonthlyReport');
  await nameInput.press('Enter');

  // Assert
  await expect(page.getByTestId('class-MonthlyReport')).toBeVisible();
  await expect(page.getByTestId('operation-result')).toBeHidden();
});
