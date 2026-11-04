import { expect, test } from '@playwright/test';
import { dismissClearScreen, selectStage } from './selectStage.js';

test('記録が空なら今のチュートリアル1がおすすめで、おさらいは出ない', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();
  const dialog = page.getByTestId('stage-roadmap');
  await expect(dialog.getByTestId('roadmap-next')).toHaveText('次のおすすめ: チュートリアル1: 長いメソッドを分ける');
  await expect(dialog.getByTestId('roadmap-unfinished')).toHaveCount(0);
});

test('100点で次の章へ進むと、次のおすすめは現在の章になり前の章はおさらいに出る', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await page.getByTestId('story-toggle').click();
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await dismissClearScreen(page);
  await page.getByTestId('story-next').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('チュートリアル2: 太った placeOrder');
  await page.getByTestId('roadmap-open').click();
  const dialog = page.getByTestId('stage-roadmap');
  await expect(dialog.getByTestId('roadmap-next')).toHaveText('次のおすすめ: チュートリアル2: 太った placeOrder');
  await expect(dialog.getByTestId('roadmap-unfinished')).toHaveText('おさらい: チュートリアル1: 長いメソッドを分ける(あと: 理解度チェック・変更依頼)');
  const first = dialog.getByTestId('roadmap-stage-tutorial-extract-method').locator('.stage-roadmap__status');
  await expect(first).toContainText('100点(あと: 理解度チェック・変更依頼)');
  await expect(first).not.toContainText('おすすめ');
  await expect(dialog.getByTestId('roadmap-stage-tutorial-order-service').locator('.stage-roadmap__status')).toContainText('おすすめ');
});
