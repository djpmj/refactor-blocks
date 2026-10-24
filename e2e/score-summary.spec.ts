import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';
import { expectDeductions } from './scoreBreakdown.js';

test('ヘッダーの点数の横は減点の件数だけで、ルールごとの内訳は「減点の内訳」に出る', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  // Act
  await selectStage(page, '上級1: 通知クラスの共通処理を基底クラスへ集める');

  // Assert: ヘッダーはルール名を並べず、件数と合計だけを1行で出す
  const score = page.getByTestId('score');
  await expect(score).toHaveText('減点 3項目(-50)');
  await expect(score).not.toContainText('行数');
  const box = await score.boundingBox();
  expect(box?.height ?? Infinity).toBeLessThan(24); // 12pxの文字で1行なら約18px

  // Assert: 「減点の内訳」を開くと、ルールごとの減点が出る
  await expectDeductions(page, [['行数 ×2', 20], ['責務の混在 ×2', 20], ['空のクラス・ファイル ×1', 10]]);
});

test('減点がないときヘッダーの点数の横は「✅ 減点なし」で、減点の内訳は出ない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');

  // Act
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Assert
  await expect(page.getByTestId('score-value')).toHaveText('100点');
  await expect(page.getByTestId('score')).toHaveText('✅ 減点なし');
  await expect(page.locator('.score-breakdown')).toHaveCount(0);
});
