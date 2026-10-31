import { expect, test, type Page } from '@playwright/test';
import { dismissClearScreen, selectStage } from './selectStage.js';

const STAGE = 'チュートリアル1: 長いメソッドを分ける';

async function extractOnce(page: Page) {
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('method-aggregateSales')).toBeVisible();
}

test('開いた直後は「スタート時の点数」が出て、抽出すると消え、元に戻す・最初に戻すでまた出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE);
  const note = page.getByTestId('score-start-note');

  // Assert: 開いた直後
  await expect(note).toHaveText('スタート時の点数');
  await expect(page.getByTestId('score-announcement')).toHaveText('90点');

  // Act: 抽出
  await extractOnce(page);
  await dismissClearScreen(page);

  // Assert
  await expect(note).toHaveCount(0);

  // Act: 元に戻す
  await page.getByRole('button', { name: '元に戻す' }).click();

  // Assert
  await expect(note).toBeVisible();

  // Act: もう一度抽出して最初に戻す
  await extractOnce(page);
  await dismissClearScreen(page);
  await expect(note).toHaveCount(0);
  await page.getByRole('button', { name: '最初に戻す' }).click();

  // Assert
  await expect(note).toBeVisible();
});
