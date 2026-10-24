import { expect, test, type Locator, type Page } from '@playwright/test';
import { releaseAllManualFixSites, selectStage, startChangeRequests } from './selectStage.js';

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

async function dragTo(page: Page, method: Locator, destination: (box: { x: number; y: number; width: number; height: number }) => { x: number; y: number }, target: Locator) {
  const source = await stableBoundingBox(page, method);
  const box = await stableBoundingBox(page, target);
  const point = destination(box);
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await expect(page.locator('.drag-overlay')).toBeVisible();
  await page.mouse.move(point.x, point.y, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
  await page.waitForTimeout(300);
}

async function dragMethodToClass(page: Page, method: Locator, target: Locator) {
  await dragTo(page, method, (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }), target);
}

async function dragToEmptyCanvas(page: Page, method: Locator) {
  await dragTo(page, method, (box) => ({ x: box.x + box.width - 20, y: box.y + box.height - 20 }), page.locator('.react-flow__pane'));
  await page.getByRole('button', { name: 'Fit View' }).click();
}

async function extract(page: Page, method: string, labels: string[], name: string) {
  await page.getByTestId(method).click();
  for (const label of labels) await page.getByLabel(label).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

/** 初級2を解答例どおり(責務ごとにクラスを分ける)に組み替えて100点にする。 */
async function solveInvoiceStage(page: Page) {
  await extract(page, 'method-issueInvoice', ['明細の金額を合計する', '割引を適用する'], 'calculateTotal');
  await extract(page, 'method-issueInvoice', ['請求書のPDFを描画する'], 'renderPdf');
  await extract(page, 'method-issueInvoice', ['PDFをストレージに保存する'], 'storePdf');
  await extract(page, 'method-sendInvoice', ['請求書をメールに添付して送る'], 'mailInvoice');
  await extract(page, 'method-sendInvoice', ['送信履歴を記録する'], 'recordHistory');
  await page.getByRole('button', { name: 'Fit View' }).click();
  await dragToEmptyCanvas(page, page.getByTestId('method-renderPdf'));
  await dragToEmptyCanvas(page, page.getByTestId('method-calculateTotal'));
  await dragToEmptyCanvas(page, page.getByTestId('method-storePdf'));
  await dragMethodToClass(page, page.getByTestId('method-recordHistory'), page.getByTestId('class-InvoiceStorage'));
  await dragToEmptyCanvas(page, page.getByTestId('method-mailInvoice'));
}

async function finish(page: Page, next: Locator) {
  await expect(async () => {
    await page.getByTestId('change-request-finish').click({ timeout: 1000 });
    await expect(next).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test('前の依頼で部品を置き間違えても、鬼の変更の解答例は解答例どおりに置いた土台の上で出る', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '初級2: クラスを自分で作る');
  await solveInvoiceStage(page);
  await expect(page.getByTestId('score-value')).toHaveText('100点');
  await releaseAllManualFixSites(page);
  await startChangeRequests(page);

  // Act: 依頼1の部品をわざと InvoiceService に置く
  await dragMethodToClass(page, page.getByTestId('method-adjustPdfLayout'), page.getByTestId('class-InvoiceService'));
  await finish(page, page.getByTestId('change-request-title').filter({ hasText: '端数処理' }));
  await dragMethodToClass(page, page.getByTestId('method-roundHalfUp'), page.getByTestId('class-InvoicePricing'));
  await finish(page, page.getByTestId('boss-label'));
  await dragMethodToClass(page, page.getByTestId('method-rebuildRendering'), page.getByTestId('class-InvoicePdfRenderer'));
  await finish(page, page.getByTestId('boss-comparison'));

  // Assert
  const first = page.getByTestId('change-outcome-req-pdf-layout');
  await expect(first.getByTestId('outcome-sample')).toContainText('既存の InvoicePdfRenderer に置く');
  await expect(first.getByTestId('outcome-sample-note')).toHaveCount(0);
  const boss = page.getByTestId('change-outcome-req-boss-rendering');
  await expect(boss.getByTestId('outcome-sample')).toContainText('既存の InvoicePdfRenderer に置く');
  await expect(boss.getByTestId('outcome-sample-note')).toHaveText('解答例は、前の依頼もすべて解答例どおりに置いた場合の置き場所です');
});
