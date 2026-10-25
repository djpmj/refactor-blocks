import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const OPENING_FIX_MESSAGE = 'まず「もし、この変更が来たら?」';
const EXTRACT_NOTICE = '抽出すると、新しいメソッドの宣言と呼び出しの分だけ合計の行数は少し増えます';

async function dragBeforeFix(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder', { completeOpeningFix: false });
  const source = await page.getByTestId('method-placeOrder').boundingBox();
  const destination = await page.getByTestId('class-TaxCalculator').boundingBox();
  if (source === null || destination === null) throw new Error('ドラッグ対象が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function extractOnce(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('editor-rail').click();
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByRole('checkbox', { name: '今月の売上を集計する' }).check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('手直しの前にドラッグして出た警告は、出た直後は見えていて、「実際に直してみる」を押すと消える', async ({ page }) => {
  // Arrange & Act
  await dragBeforeFix(page);

  // Assert: 出した操作自身では消えない
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(OPENING_FIX_MESSAGE);
  await page.waitForTimeout(500);
  await expect(alert).toContainText(OPENING_FIX_MESSAGE);

  // Act
  await page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' }).click();

  // Assert
  await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeVisible();
  await expect(alert).toHaveCount(0);
});

test('手直しの前にドラッグして出た警告は、メソッドをクリックすると消える', async ({ page }) => {
  // Arrange
  await dragBeforeFix(page);
  await expect(page.getByRole('alert')).toContainText(OPENING_FIX_MESSAGE);

  // Act: ドラッグ直後の数百msはドロップの後始末でクリックが効かないので、落ち着くのを待つ
  await page.waitForTimeout(800);
  await page.getByTestId('method-placeOrder').click();

  // Assert
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('抽出のお知らせは、8秒たつと消える', async ({ page }) => {
  // Arrange & Act
  await extractOnce(page);

  // Assert
  const status = page.locator('.error-toast[role="status"]');
  await expect(status).toContainText(EXTRACT_NOTICE);
  await page.waitForTimeout(6000);
  await expect(status).toContainText(EXTRACT_NOTICE);
  await expect(status).toHaveCount(0, { timeout: 4000 });
});

test('抽出のお知らせは、×を押すとすぐ消える', async ({ page }) => {
  // Arrange
  await extractOnce(page);
  const status = page.locator('.error-toast[role="status"]');
  await expect(status).toContainText(EXTRACT_NOTICE);

  // Act
  await status.getByRole('button', { name: 'メッセージを閉じる' }).click();

  // Assert
  await expect(status).toHaveCount(0, { timeout: 1000 });
});
