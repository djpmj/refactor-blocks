import { expect, test, type Page } from '@playwright/test';
import { dismissClearScreen, selectStage, startChangeRequests } from './selectStage.js';

async function extractAggregation(page: Page) {
  await page.getByRole('button', { name: 'Fit View' }).click();
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('チュートリアル1: 責務Aだけ抽出して100点になると「さらに良くできるところ」が2件出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  const note = page.getByTestId('room-to-improve-note');
  await expect(page.getByTestId('score-value')).not.toHaveText('100点');
  await expect(note).toHaveCount(0);

  // Act
  await extractAggregation(page);
  await dismissClearScreen(page);

  // Assert: 点数・他のカードは今までどおり、理解度チェックは今までどおり出る
  await expect(page.getByTestId('score-value')).toHaveText('100点');
  await expect(note).toBeVisible();
  await expect(note.getByRole('heading', { name: 'さらに良くできるところ' })).toBeVisible();
  const items = note.getByTestId('room-to-improve-item');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('printMonthlyReport() の中に、');
  await expect(items.nth(0)).toContainText('「表のヘッダーを組み立てる」');
  await expect(items.nth(0)).toContainText('「画面に出力する」');
  await expect(items.nth(0).locator('.responsibility-mark')).toHaveCount(2);
  await expect(items.nth(1)).toContainText('ReportService');
  await expect(items.nth(1)).toContainText('3種類の責務');
  await expect(items.nth(1)).toContainText('上限ちょうど');
  await expect(note).not.toContainText(/formatting|output|aggregation/);
  await expect(page.locator('.concept-check')).toBeVisible();

  // Act: メソッド名を押すとメソッドエディタが開く
  await items.nth(0).getByRole('button', { name: 'printMonthlyReport()' }).click();

  // Assert
  await expect(page.getByTestId('method-printMonthlyReport').locator('.method-chip--selected')).toBeVisible();
  await expect(page.getByTestId('score-value')).toHaveText('100点');

  // Act: クラス名を押すとキャンバスで強調される
  await items.nth(1).getByRole('button', { name: 'ReportService' }).click();

  // Assert
  await expect(page.getByTestId('class-ReportService')).toHaveClass(/class-node--flagged/);
});

test('チュートリアル1: 変更依頼に挑戦している間はカードが出ない', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await extractAggregation(page);
  await expect(page.getByTestId('room-to-improve-note')).toBeVisible();

  // Act
  await startChangeRequests(page);

  // Assert
  await expect(page.getByTestId('room-to-improve-note')).toHaveCount(0);
});
