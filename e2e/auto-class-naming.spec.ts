import { expect, test, type Locator, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function dragToEmptyCanvas(page: Page, method: Locator): Promise<void> {
  const source = await stableBoundingBox(page, method);
  const pane = await stableBoundingBox(page, page.locator('.react-flow__pane'));
  await stableBoundingBox(page, page.getByTestId('file-src/invoice/InvoiceService.ts'));
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await expect(page.locator('.drag-overlay')).toBeVisible();
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Fit View' }).click();
}

async function stableBoundingBox(page: Page, locator: Locator) {
  const deadline = Date.now() + 3000;
  let previous = await locator.boundingBox();
  while (Date.now() < deadline) {
    await page.waitForTimeout(50);
    const current = await locator.boundingBox();
    if (previous !== null && current !== null && current.x === previous.x && current.y === previous.y) return current;
    previous = current;
  }
  if (previous === null) throw new Error('要素の位置を取得できません');
  return previous;
}

async function dragMethodToClass(page: Page, method: Locator, target: Locator): Promise<void> {
  const source = await stableBoundingBox(page, method);
  const destination = await stableBoundingBox(page, target);
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await expect(page.locator('.drag-overlay')).toBeVisible();
  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test('作成したクラス名は内容に追従し、手動リネーム後は固定される', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '初級2: クラスを自分で作る');
  await page.getByTestId('method-issueInvoice').click();
  await page.getByLabel('請求書のPDFを描画する').check();
  await page.getByLabel('新しいメソッド名').fill('renderPdf');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await page.getByTestId('method-issueInvoice').click();
  await page.getByLabel('PDFをストレージに保存する').check();
  await page.getByLabel('新しいメソッド名').fill('storePdf');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await page.getByRole('button', { name: 'Fit View' }).click();

  // Act: 抽出した描画メソッドを余白へ移し、メソッドの責務から自動命名させる
  await dragToEmptyCanvas(page, page.getByTestId('method-renderPdf'));

  // Assert
  const renderer = page.getByTestId('class-InvoicePdfRenderer');
  await expect(renderer.getByTestId('method-renderPdf')).toBeVisible();

  // Act: another responsibility joins, then the original responsibility is removed
  await dragMethodToClass(page, page.getByTestId('method-storePdf'), renderer);
  await expect(renderer.getByTestId('method-storePdf')).toBeVisible();
  await dragMethodToClass(page, renderer.getByTestId('method-renderPdf'), page.getByTestId('class-InvoiceService'));

  // Assert: the remaining storage responsibility renames the class
  const storage = page.getByTestId('class-InvoiceStorage');
  await expect(storage.getByTestId('method-storePdf')).toBeVisible();

  // Act: undo/redo keeps the automatically chosen name with the codebase history
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(renderer.getByTestId('method-renderPdf')).toBeVisible();
  await page.getByRole('button', { name: 'やり直し' }).click();
  await expect(storage.getByTestId('method-storePdf')).toBeVisible();

  // Act: rename to opt out of automatic naming
  await page.getByTestId('class-header-InvoiceStorage').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '名前を変更' }).click();
  const nameInput = menu.getByLabel('新しいクラス名');
  await nameInput.fill('CustomArchive');
  await nameInput.press('Enter');
  await expect(page.getByTestId('class-CustomArchive')).toBeVisible();
  await expect(page.getByTestId('class-CustomArchive').getByTestId('method-storePdf')).toBeVisible();

  // Act: change the class contents again after opting out of automatic naming
  await dragMethodToClass(page, page.getByTestId('method-renderPdf'), page.getByTestId('class-CustomArchive'));

  // Assert: content changes do not resume automatic naming after a manual rename
  const customArchive = page.getByTestId('class-CustomArchive');
  await expect(customArchive.getByTestId('method-storePdf')).toBeVisible();
  await expect(customArchive.getByTestId('method-renderPdf')).toBeVisible();
  await expect(page.getByTestId('class-InvoicePdfRenderer')).toHaveCount(0);
});

