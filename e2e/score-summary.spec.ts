import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('ヘッダーの点数の横は減点の件数だけで、ルールごとの内訳は「減点の内訳」に出る', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  // Act
  await selectStage(page, '上級1: 通知クラスの共通処理を基底クラスへ集める');

  // Assert
  const score = page.getByTestId('score');
  await expect(score).toHaveText(/^減点 \d+項目\(-\d+\)$/);
  await expect(score).not.toContainText('行数');
  const box = await score.boundingBox();
  expect(box?.height ?? Infinity).toBeLessThan(24); // 12pxの文字で1行なら約18px
  const breakdown = page.locator('.score-breakdown');
  await breakdown.locator('summary').click();
  await expect(breakdown.locator('.score-breakdown__items button[aria-pressed]').first()).toBeVisible();
});
