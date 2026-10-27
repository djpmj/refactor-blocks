import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE_1 = 'チュートリアル1: 長いメソッドを分ける';
const MOVE_BESTS_KEY = 'refactor-blocks:move-bests';

async function extractAggregateSales(page: Page) {
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
}

async function renameAggregateSales(page: Page) {
  const method = page.getByTestId('method-aggregateSales');
  await method.dblclick();
  const input = method.getByRole('textbox', { name: 'メソッド名' });
  await input.fill('sumSales');
  await input.press('Enter');
}

async function openStage1(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, STAGE_1);
}

test('1回の抽出で100点にすると、手数1手と模範解答1手が出る。名前を変えると2手になり自己ベストが並ぶ', async ({ page }) => {
  // Arrange
  await openStage1(page);
  await expect(page.getByTestId('move-count')).toHaveCount(0);

  // Act
  await extractAggregateSales(page);

  // Assert
  await expect(page.getByTestId('move-count')).toHaveText('あなたの手数: 1手(模範解答: 1手)');

  // Act: 名前を変える(コードが変わる操作)
  await renameAggregateSales(page);

  // Assert
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await expect(page.getByTestId('move-count')).toHaveText('あなたの手数: 2手(模範解答: 1手・自己ベスト: 1手)');
});

test('抽出→元に戻す→抽出でも1手。100点を下回ると行が消える', async ({ page }) => {
  // Arrange
  await openStage1(page);
  await extractAggregateSales(page);

  // Act: 元に戻して、もう一度抽出する
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByTestId('move-count')).toHaveCount(0);
  await extractAggregateSales(page);

  // Assert
  await expect(page.getByTestId('move-count')).toHaveText('あなたの手数: 1手(模範解答: 1手)');
});

test('最初に戻すと数え直し、最初に戻したのを元に戻すと戻す前の手数に戻る', async ({ page }) => {
  // Arrange
  await openStage1(page);
  await extractAggregateSales(page);
  await renameAggregateSales(page);
  await expect(page.getByTestId('move-count')).toContainText('あなたの手数: 2手');

  // Act: 最初に戻して、1回の抽出で100点にする
  await page.getByRole('button', { name: '最初に戻す' }).click();
  await extractAggregateSales(page);

  // Assert
  await expect(page.getByTestId('move-count')).toContainText('あなたの手数: 1手(模範解答: 1手');

  // Act: 抽出を戻し、最初に戻したのも元に戻す
  await page.getByRole('button', { name: '元に戻す' }).click();
  await page.getByRole('button', { name: '元に戻す' }).click();

  // Assert
  await expect(page.getByTestId('move-count')).toContainText('あなたの手数: 2手(模範解答: 1手');
});

test('自己ベストを記録して再読み込みすると、下書きから再開で手数は数えず自己ベストだけ出る', async ({ page }) => {
  // Arrange
  await openStage1(page);
  await extractAggregateSales(page);
  await expect(page.getByTestId('move-count')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), MOVE_BESTS_KEY)).toBe('{"tutorial-extract-method":1}');

  // Act
  await page.reload();
  await selectStage(page, STAGE_1);

  // Assert
  await expect(page.getByTestId('draft-restored')).toBeVisible();
  await expect(page.getByTestId('move-count')).toHaveText('前回の続きから再開したため、手数は数えていません(自己ベスト: 1手)');
});

test('壊れた自己ベストの保存値は空として扱い、画面は壊れない', async ({ page }) => {
  // Arrange
  await page.addInitScript((key) => localStorage.setItem(key, '{"tutorial-extract-method":-1}'), MOVE_BESTS_KEY);
  await openStage1(page);

  // Act
  await extractAggregateSales(page);

  // Assert
  await expect(page.getByTestId('move-count')).toHaveText('あなたの手数: 1手(模範解答: 1手)');
});
