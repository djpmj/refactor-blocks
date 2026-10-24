import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';
import { expectDeductions } from './scoreBreakdown.js';

test('中級9は0点でも減点の合計を表示し、減った操作でゲージを光らせる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  await expectDeductions(page, [['行数 ×6', 60], ['責務の混在 ×3', 30], ['空のクラス・ファイル ×1', 10]]);

  // Act: 一時的に空クラスを追加し、削除して120点から100点へ戻す
  await page.getByTestId('method-confirm').click({ button: 'right' });
  const addMenu = page.getByTestId('context-menu');
  await addMenu.getByRole('group', { name: 'このファイル' }).getByRole('menuitem', { name: 'クラスを追加' }).click();
  await addMenu.getByLabel('追加するクラス名').fill('TemporaryEmpty');
  await addMenu.getByRole('button', { name: '追加' }).click();
  await expectDeductions(page, [['行数 ×7', 70], ['責務の混在 ×3', 30], ['空のクラス・ファイル ×2', 20]]);
  await page.getByTestId('class-header-NewClass').click({ button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'NewClass を削除' }).click();

  // Assert: ゲージは光るが数値は0点のままで、減点合計の変化を読み上げる
  await expectDeductions(page, [['行数 ×6', 60], ['責務の混在 ×3', 30], ['空のクラス・ファイル ×1', 10]]);
  await expect(page.getByTestId('score-value')).toHaveText('0点');
  await expect(page.getByTestId('score-announcement')).toHaveText('減点の合計が -120 から -100 に減りました');
  await expect(page.getByTestId('score-ring')).toHaveClass(/score-badge__ring--celebrate/);
});

test('1点以上のステージの点数表示は従来どおり', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await expectDeductions(page, [['行数 ×1', 10], ['責務の混在 ×1', 10], ['空のクラス・ファイル ×1', 10]]);
  await expect(page.getByTestId('score-value')).toHaveText('70点');
});
