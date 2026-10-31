import { expect, test } from '@playwright/test';
import { dismissClearScreen, selectStage } from './selectStage.js';

test('抽出でクラスが初めて上限を超える前後に次の段階を伝える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  const headsUp = page.getByTestId('extract-growth-heads-up');
  const extract = page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' });
  const expected = 'クラスが 54行 → 60行 になり、上限(54行)を超えます。分けたメソッドは、次の段階で受け皿のクラスへ移しましょう';

  // Act & Assert: 上限に達するまで表示しない
  for (const label of ['画面に出力する', '今月の売上を集計する']) {
    await page.getByLabel(label).check();
    await expect(headsUp).toHaveCount(0);
    await extract.click();
    await dismissClearScreen(page);
  }

  // Act & Assert: 3回目は選択中に表示し、解除すると消える
  const comparison = page.getByLabel('前月比を計算する');
  await comparison.check();
  await expect(headsUp).toHaveText(expected);
  await expect(headsUp.locator('..')).toHaveAttribute('aria-live', 'polite');
  await comparison.uncheck();
  await expect(headsUp).toHaveCount(0);
  await comparison.check();
  await expect(headsUp).toHaveText(expected);

  // Act & Assert: 抽出後の結果、閉じる操作、Undo
  await extract.click();
  const result = page.getByTestId('operation-result');
  await expect(result.getByTestId('operation-result-line')).toContainText(['「行数」の減点が1件増えました(-10)']);
  await expect(result.getByTestId('operation-result-next-step')).toHaveText(`次の段階: ${expected}`);
  await result.getByRole('button', { name: '操作の結果を閉じる' }).click();
  await expect(result).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(result).toHaveCount(0);
  await comparison.check();
  await expect(headsUp).toHaveText(expected);
});
