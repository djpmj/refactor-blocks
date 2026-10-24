import { expect, test, type Locator, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

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

/** 初級2を、送信履歴の記録以外は解答例どおり(責務ごとにクラスを分ける)に組み替える。 */
async function arrangeInvoiceStage(page: Page) {
  await extract(page, 'method-issueInvoice', ['明細の金額を合計する', '割引を適用する'], 'calculateTotal');
  await extract(page, 'method-issueInvoice', ['請求書のPDFを描画する'], 'renderPdf');
  await extract(page, 'method-issueInvoice', ['PDFをストレージに保存する'], 'storePdf');
  await extract(page, 'method-sendInvoice', ['請求書をメールに添付して送る'], 'mailInvoice');
  await page.getByRole('button', { name: 'Fit View' }).click();
  await dragToEmptyCanvas(page, page.getByTestId('method-renderPdf'));
  await dragToEmptyCanvas(page, page.getByTestId('method-calculateTotal'));
  await dragToEmptyCanvas(page, page.getByTestId('method-storePdf'));
  await dragToEmptyCanvas(page, page.getByTestId('method-mailInvoice'));
}

/** 送信履歴の記録を、メソッドとして抽出する(クラスへの移動は arrangeInvoiceStage のあとに moveRecordHistoryToStorage で行う)。 */
async function extractRecordHistory(page: Page) {
  await extract(page, 'method-sendInvoice', ['送信履歴を記録する'], 'recordHistory');
}

/** 抽出した送信履歴の記録を、解答例と同じく保存のクラスへ移す。 */
async function moveRecordHistoryToStorage(page: Page) {
  await dragMethodToClass(page, page.getByTestId('method-recordHistory'), page.getByTestId('class-InvoiceStorage'));
}

async function openSampleDiagram(page: Page) {
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  const confirmation = page.getByTestId('answer-confirm');
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole('heading', { name: '答えを見ますか?' })).toBeVisible();
  await confirmation.getByRole('button', { name: '答えを見る' }).click();
  const dialog = page.getByTestId('codebase-preview');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('送信履歴の記録を InvoiceService に残した設計は、解答例との違いが左右の図と一覧で分かる', async ({ page }) => {
  // Arrange: 送信履歴の記録だけを InvoiceService に残して100点にする(解答例は保存のクラスへ移している)
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '初級2: クラスを自分で作る');
  await arrangeInvoiceStage(page);
  await expect(page.getByTestId('score-value')).toHaveText('100点');

  // Act: 答えを見る確認を経て、解答例の図を開く
  const dialog = await openSampleDiagram(page);

  // Assert: 左に自分の設計、右に解答例が同じ高さで並ぶ
  const player = dialog.getByTestId('player-diagram');
  const answer = dialog.getByTestId('answer-diagram');
  await expect(player.getByRole('heading', { name: 'あなたの設計' })).toBeVisible();
  await expect(answer.getByRole('heading', { name: '解答例' })).toBeVisible();
  const playerBox = await stableBoundingBox(page, player);
  const answerBox = await stableBoundingBox(page, answer);
  expect(playerBox.x + playerBox.width).toBeLessThanOrEqual(answerBox.x);
  expect(Math.abs(playerBox.y - answerBox.y)).toBeLessThan(2);
  const scaleOf = async (pane: Locator) => (await pane.locator('.react-flow__viewport').getAttribute('style'))?.match(/scale\(([\d.]+)\)/)?.[1];
  await expect.poll(async () => scaleOf(player)).toBeTruthy();
  expect(await scaleOf(answer)).toBe(await scaleOf(player));
  await expect(player.getByTestId('preview-class-InvoiceService')).toContainText('sendInvoice');
  await expect(player.getByTestId('preview-class-InvoiceStorage')).not.toContainText('recordHistory');
  await expect(answer.getByTestId('preview-class-InvoiceStorage')).toContainText('recordHistory');
  await expect(answer.getByTestId('preview-class-InvoiceService')).not.toContainText('sendInvoice');

  // Assert: 違いの一覧にその処理だけが出て、点数の事実は添えない(どちらも100点)
  const diff = dialog.getByTestId('design-diff');
  await expect(diff.getByRole('button')).toHaveCount(1);
  await expect(diff.getByRole('button')).toHaveText('「送信履歴を記録する」: あなた InvoiceService / 解答例 InvoiceStorage');
  await expect(diff).not.toContainText('解答例と同じ置き方です');
  await expect(dialog.getByTestId('design-diff-score')).toHaveCount(0);

  // Act: 違いの行を押す
  await diff.getByRole('button').click();

  // Assert: 両方の図で、その処理を持つクラスが光る
  await expect(player.getByTestId('preview-class-InvoiceService')).toHaveAttribute('data-glow', 'true');
  await expect(answer.getByTestId('preview-class-InvoiceStorage')).toHaveAttribute('data-glow', 'true');
  await expect(player.getByTestId('preview-class-InvoicePricing')).not.toHaveAttribute('data-glow', 'true');

  // Act: もう一度押す
  await diff.getByRole('button').click();

  // Assert: 光が消える
  await expect(player.getByTestId('preview-class-InvoiceService')).not.toHaveAttribute('data-glow', 'true');
});

test('解答例と同じ置き方で100点にしたステージでは「解答例と同じ置き方です」が出る', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '初級2: クラスを自分で作る');
  await extractRecordHistory(page);
  await arrangeInvoiceStage(page);
  await moveRecordHistoryToStorage(page);
  await expect(page.getByTestId('score-value')).toHaveText('100点');

  // Act
  const dialog = await openSampleDiagram(page);

  // Assert
  await expect(dialog.getByTestId('design-diff')).toHaveText('解答例と同じ置き方です');
  await expect(dialog.getByTestId('design-diff').getByRole('button')).toHaveCount(0);
});

test('狭い画面では自分の設計の下に解答例が積まれる', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto('/');

  // Act
  const dialog = await openSampleDiagram(page);

  // Assert
  const playerBox = await stableBoundingBox(page, dialog.getByTestId('player-diagram'));
  const answerBox = await stableBoundingBox(page, dialog.getByTestId('answer-diagram'));
  expect(answerBox.y).toBeGreaterThan(playerBox.y);
  expect(Math.abs(answerBox.x - playerBox.x)).toBeLessThan(2);
  await expect(dialog.getByTestId('design-diff')).toBeAttached();
});
