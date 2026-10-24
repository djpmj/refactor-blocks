import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('ドラッグ操作の読み上げが日本語で、IDではなく名前になる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const method = page.getByTestId('method-placeOrder');
  const liveRegion = page.locator('[id^="DndLiveRegion"]');

  // Assert: 操作説明が日本語
  const describedBy = await method.getAttribute('aria-describedby');
  if (describedBy === null) throw new Error('aria-describedby がありません');
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('スペースキーで持ち上げ、矢印キーで動かします。もう一度スペースキーで置き、Esc で取り消します。');

  // Act: キーボードで持ち上げ、TaxCalculator の上まで動かして置く
  await method.focus();
  await page.keyboard.press('Space');
  for (let i = 0; i < 40; i += 1) {
    if ((await liveRegion.textContent())?.includes('クラス TaxCalculator の上') === true) break;
    await page.keyboard.press('ArrowRight');
  }
  await expect(liveRegion).toHaveText('OrderService.placeOrder() を クラス TaxCalculator の上に動かしています。');
  await page.keyboard.press('Space');

  // Assert: 置いた文に英語とIDが含まれない
  await expect(liveRegion).toHaveText('OrderService.placeOrder() を クラス TaxCalculator に置きました。');
  await expect(liveRegion).not.toContainText(/Draggable|droppable|method:|class:|[0-9a-f]{8}-/);
});
