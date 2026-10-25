import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

for (const width of [1800, 1280, 1024, 800]) {
  test(`採点内訳を開いても、ツールバーのボタンが隠れずに押せる(幅${String(width)})`, async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
    const breakdown = page.locator('.score-breakdown');

    // Act
    await breakdown.locator('summary').click();

    // Assert: 内訳は画面内にあり、ツールバーのどのボタンとも重ならない
    const items = await breakdown.locator('.score-breakdown__items').boundingBox();
    expect(items).not.toBeNull();
    expect(items?.x).toBeGreaterThanOrEqual(0);
    for (const button of await page.locator('.toolbar button').all()) {
      const box = await button.boundingBox();
      if (box === null || items === null) continue;
      const apart = box.y >= items.y + items.height || box.y + box.height <= items.y || box.x >= items.x + items.width || box.x + box.width <= items.x;
      expect(apart).toBe(true);
    }

    // Act & Assert: ヒントボタンが実際に押せる
    await page.getByTestId('hint-popover-button').click();
    await expect(page.getByTestId('hint-popover')).toBeVisible();
  });
}
