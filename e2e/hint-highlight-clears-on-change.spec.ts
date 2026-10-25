import { expect, test, type Page } from '@playwright/test';
import { openHints } from './hintPopover.js';
import { selectStage } from './selectStage.js';

const FLAGGED = '.method-chip--flagged, .class-node--flagged, .file-node--flagged';

async function openStage(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '初級2: クラスを自分で作る');
  await openHints(page);
}

async function openStageWithHint(page: Page): Promise<void> {
  await openStage(page);
  await page.getByTestId('hint-problem').click();
  await page.getByRole('button', { name: /次の一手/ }).click();
  await page.getByRole('button', { name: 'ヒント1の場所をキャンバスで見る' }).click();
}

/** 最後の1ファイルの削除は、押せる操作のまま domain が失敗を返し、コードが変わらない。 */
async function deleteFileFails(page: Page): Promise<void> {
  await page.getByTestId('file-src/invoice/InvoiceService.ts').click({ button: 'right', position: { x: 10, y: 10 } });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'このファイルを削除' }).click();
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

test('失敗する操作では光りが残る', async ({ page }) => {
  // Arrange
  await openStageWithHint(page);
  await expect(page.locator(FLAGGED).first()).toBeVisible();
  const flaggedCount = await page.locator(FLAGGED).count();

  // Act: 最後の1ファイルの削除は失敗する
  await deleteFileFails(page);

  // Assert
  await expect(page.getByRole('alert')).toContainText('最後の1ファイルは削除できません');
  await expect(page.locator(FLAGGED)).toHaveCount(flaggedCount);
  await openHints(page);
  await expect(page.getByRole('button', { name: 'ヒント1の場所をキャンバスで見る' })).toHaveAttribute('aria-pressed', 'true');
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

test('「どこが問題?」で光らせたあと抽出に成功すると、光りが消える', async ({ page }) => {
  // Arrange
  await openStage(page);
  await page.getByTestId('hint-problem').click();
  await expect(page.locator(FLAGGED).first()).toBeVisible();

  // Act
  await extract(page, '請求書のPDFを描画する', 'renderPdf');

  // Assert
  await expect(page.getByTestId('method-renderPdf')).toBeVisible();
  await expect(page.locator(FLAGGED)).toHaveCount(0);
});

test('「どこが問題?」の光りは、失敗する操作では残り、元に戻すと消える', async ({ page }) => {
  // Arrange
  await openStage(page);
  await extract(page, '請求書のPDFを描画する', 'renderPdf');
  await openHints(page);
  await page.getByTestId('hint-problem').click();
  await expect(page.locator(FLAGGED).first()).toBeVisible();
  const flaggedCount = await page.locator(FLAGGED).count();

  // Act: 最後の1ファイルの削除は失敗する
  await deleteFileFails(page);

  // Assert
  await expect(page.getByRole('alert')).toContainText('最後の1ファイルは削除できません');
  await expect(page.locator(FLAGGED)).toHaveCount(flaggedCount);

  // Act
  await page.getByRole('button', { name: '元に戻す' }).click();

  // Assert
  await expect(page.getByTestId('method-renderPdf')).toHaveCount(0);
  await expect(page.locator(FLAGGED)).toHaveCount(0);
});
