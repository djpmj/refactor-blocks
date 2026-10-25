import { expect, test, type Page } from '@playwright/test';
import { openHints } from './hintPopover.js';
import { selectStage } from './selectStage.js';

const FLAGGED = '.method-chip--flagged, .class-node--flagged, .file-node--flagged';

async function openStageWithHint(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '初級2: クラスを自分で作る');
  await openHints(page);
  await page.getByTestId('hint-problem').click();
  await page.getByRole('button', { name: /次の一手/ }).click();
  await page.getByRole('button', { name: 'ヒント1の場所をキャンバスで見る' }).click();
}

async function extract(page: Page, label: string, name: string): Promise<void> {
  await page.getByTestId('method-issueInvoice').click();
  await page.getByLabel(label).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('抽出に成功すると光りが消え、ヒントのボタンの押している状態も外れ、押し直すと光る', async ({ page }) => {
  // Arrange
  await openStageWithHint(page);
  await expect(page.locator(FLAGGED).first()).toBeVisible();

  // Act
  await extract(page, '請求書のPDFを描画する', 'renderPdf');

  // Assert
  await expect(page.getByTestId('method-renderPdf')).toBeVisible();
  await expect(page.locator(FLAGGED)).toHaveCount(0);
  await openHints(page);
  const hint = page.getByRole('button', { name: 'ヒント1の場所をキャンバスで見る' });
  await expect(hint).toHaveAttribute('aria-pressed', 'false');

  // Act: ヒントをもう一度押す
  await hint.click();

  // Assert
  await expect(page.locator(FLAGGED).first()).toBeVisible();
});

test('失敗する抽出では光りが残る', async ({ page }) => {
  // Arrange
  await openStageWithHint(page);
  await extract(page, '請求書のPDFを描画する', 'renderPdf');
  await openHints(page);
  await page.getByRole('button', { name: 'ヒント1の場所をキャンバスで見る' }).click();
  await expect(page.locator(FLAGGED).first()).toBeVisible();
  const flaggedCount = await page.locator(FLAGGED).count();

  // Act: 同じ名前での抽出は失敗する
  await extract(page, 'PDFをストレージに保存する', 'renderPdf');

  // Assert
  await expect(page.getByText('同じクラスに同じ名前のメソッドがあります')).toBeVisible();
  await expect(page.locator(FLAGGED)).toHaveCount(flaggedCount);
});

test('元に戻すと光りが消える', async ({ page }) => {
  // Arrange
  await openStageWithHint(page);
  await extract(page, '請求書のPDFを描画する', 'renderPdf');
  await openHints(page);
  await page.getByRole('button', { name: 'ヒント1の場所をキャンバスで見る' }).click();
  await expect(page.locator(FLAGGED).first()).toBeVisible();

  // Act
  await page.getByRole('button', { name: '元に戻す' }).click();

  // Assert
  await expect(page.getByTestId('method-renderPdf')).toHaveCount(0);
  await expect(page.locator(FLAGGED)).toHaveCount(0);
});
