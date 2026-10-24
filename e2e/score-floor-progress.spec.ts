import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('中級9は0点でも減点の合計を表示し、減った操作でゲージを光らせる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  await expect(page.getByTestId('score')).toHaveText(/^減点 \d+項目\(-100\)$/);

  // Act: 一時的に空クラスを追加し、削除して120点から100点へ戻す
  await page.getByTestId('method-confirm').click({ button: 'right' });
  const addMenu = page.getByTestId('context-menu');
  await addMenu.getByRole('group', { name: 'このファイル' }).getByRole('menuitem', { name: 'クラスを追加' }).click();
  await addMenu.getByLabel('追加するクラス名').fill('TemporaryEmpty');
  await addMenu.getByRole('button', { name: '追加' }).click();
  await expect(page.getByTestId('score')).toHaveText(/\(-120\)$/);
  await page.getByTestId('class-header-NewClass').click({ button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'NewClass を削除' }).click();

  // Assert: ゲージは光るが数値は0点のままで、減点合計の変化を読み上げる
  await expect(page.getByTestId('score')).toHaveText(/\(-100\)$/);
  await expect(page.getByTestId('score-value')).toHaveText('0点');
  await expect(page.getByTestId('score-announcement')).toHaveText('減点の合計が -120 から -100 に減りました');
  await expect(page.getByTestId('score-ring')).toHaveClass(/score-badge__ring--celebrate/);
});

test('1点以上のステージの点数表示は従来どおり', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await expect(page.getByTestId('score')).toHaveText(/^減点 \d+項目\(-\d+\)$/);
  await expect(page.getByTestId('score-value')).toHaveText('70点');
});
