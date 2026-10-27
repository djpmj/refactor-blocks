import { expect, test, type Locator, type Page } from '@playwright/test';
import { dismissClearScreen, finishAndAdvance, releaseAllManualFixSites, selectStage, startChangeRequests } from './selectStage.js';

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
  await dismissClearScreen(page);
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

/** 「実装を終える」を、その依頼の結果カードが出るまで押し直す(ドラッグ直後の1回目のクリックは握りつぶされることがある)。 */
async function finishToReview(page: Page) {
  await expect(async () => {
    await page.getByTestId('change-request-finish').click({ timeout: 1000 });
    await expect(page.getByTestId('change-request-next')).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test('変更依頼は1件ごとに答え合わせし、置き直した結果が全体の結果に使われる', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '初級2: クラスを自分で作る');
  await solveInvoiceStage(page);
  await expect(page.getByTestId('score-value')).toHaveText('100点');
  await releaseAllManualFixSites(page);
  await startChangeRequests(page);
  await expect(page.getByTestId('change-request-title')).toBeVisible();
  await expect(page.getByTestId('opening-fix-banner')).toHaveCount(0);

  // Act: 依頼1の部品をわざと InvoiceService に置いて終える
  await dragMethodToClass(page, page.getByTestId('method-adjustPdfLayout'), page.getByTestId('class-InvoiceService'));
  await finishToReview(page);

  // Assert: 依頼2へ進まず、依頼1の結果カードが出る
  const review = page.getByTestId('change-outcome-req-pdf-layout');
  await expect(review.getByTestId('outcome-placement')).toContainText('この依頼の置き方 90点');
  await expect(review.getByTestId('outcome-sample')).toContainText('既存の InvoicePdfRenderer に置く');
  await expect(page.getByTestId('change-request-title')).toHaveCount(0);
  await expect(page.getByTestId('change-request-next')).toHaveText('次の依頼へ');

  // Act: 置き直す
  await page.getByTestId('change-request-retry').click();
  await expect(page.getByTestId('change-request-title')).toContainText('PDF');
  await expect(page.getByTestId('change-part-status')).toContainText('部品置き場');
  await dragMethodToClass(page, page.getByTestId('method-adjustPdfLayout'), page.getByTestId('class-InvoicePdfRenderer'));
  await finishToReview(page);

  // Assert
  await expect(page.getByTestId('change-outcome-req-pdf-layout').getByTestId('outcome-placement')).toContainText('この依頼の置き方 100点');

  // Act: 次の依頼へ進み、残りも終える
  await page.getByTestId('change-request-next').click();
  await expect(page.getByTestId('change-request-title')).toContainText('端数処理');
  await dragMethodToClass(page, page.getByTestId('method-roundHalfUp'), page.getByTestId('class-InvoicePricing'));
  await finishAndAdvance(page);
  await dragMethodToClass(page, page.getByTestId('method-rebuildRendering'), page.getByTestId('class-InvoicePdfRenderer'));
  await finishToReview(page);
  await expect(page.getByTestId('change-request-next')).toHaveText('結果を見る');
  await page.getByTestId('change-request-next').click();

  // Assert: 全体の結果では依頼1は置き直したあとの結果
  await expect(page.getByRole('heading', { name: '変更依頼の結果' })).toBeVisible();
  await expect(page.getByTestId('change-outcome-req-pdf-layout').getByTestId('outcome-placement')).toContainText('置き方 100点');
});
