import { expect, test, type Page } from '@playwright/test';
import { completeOpeningFix, dismissClearScreen, releaseAllManualFixSites, selectStage } from './selectStage.js';

async function refactorTutorial1(page: Page) {
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score-value')).toContainText('100');
  await dismissClearScreen(page);
}

async function extractTutorial2(page: Page) {
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const source = await page.getByTestId('method-calculateTax').boundingBox();
  const target = await page.getByTestId('class-TaxCalculator').boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();
  for (const [fragment, name] of [['注文をDBに保存する', 'saveOrder'], ['確認メールを送る', 'sendConfirmationMail'], ['在庫があるか検証する', 'validateStock']] as const) {
    await page.getByTestId('method-placeOrder').click();
    await page.getByLabel(fragment).check();
    await page.getByLabel('新しいメソッド名').fill(name);
    await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  }
  await expect(page.getByTestId('score-value')).toContainText('100');
  await dismissClearScreen(page);
}

test('ステージ切替と同じステージの段階進行で左パネルが次のカードを見せる', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 700 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await refactorTutorial1(page);
  await page.getByTestId('story-toggle').click();
  const sidebar = page.locator('#stage-sidebar');
  await sidebar.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => sidebar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.getByTestId('story-next').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('チュートリアル2');
  await expect.poll(() => sidebar.evaluate((element) => element.scrollTop)).toBe(0);

  await completeOpeningFix(page);
  await extractTutorial2(page);
  const closingHeading = page.locator('.change-pain h3');
  await expect(closingHeading).toHaveText('もし、この変更が来たら?(もう一度)');
  await expect.poll(async () => {
    const box = await closingHeading.boundingBox();
    return box !== null && box.y >= 0 && box.y + box.height <= 700;
  }).toBe(true);

  await page.locator('.change-pain').getByRole('button', { name: '実際に直してみる' }).click();
  await releaseAllManualFixSites(page);
  await page.getByRole('region', { name: '手で直すシミュレーション' }).getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('.change-pain h3')).toHaveText('なぜ分けるのか');
  await expect.poll(async () => {
    const box = await page.locator('.change-pain h3').boundingBox();
    return box !== null && box.y >= 0 && box.y + box.height <= 700;
  }).toBe(true);
});

test('ステージ一覧から別のステージを選ぶと左パネルが先頭に戻る', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 700 });
  await page.goto('/');
  await page.getByTestId('story-toggle').click();
  const sidebar = page.locator('#stage-sidebar');
  await sidebar.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => sidebar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await selectStage(page, 'チュートリアル2: 太った placeOrder', { completeOpeningFix: false });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('チュートリアル2');
  await expect.poll(() => sidebar.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.getByTestId('story-intro')).toContainText('第2章');
});
