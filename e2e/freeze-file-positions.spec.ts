import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function boxPosition(page: import('@playwright/test').Page, fileId: string) {
  const box = await page.getByTestId(fileId).boundingBox();
  const canvas = await page.locator('.react-flow__pane').boundingBox();
  if (box === null || canvas === null) throw new Error(`${fileId} またはキャンバスの位置を取得できません`);
  return { x: box.x - canvas.x, y: box.y - canvas.y };
}

async function flowPosition(page: import('@playwright/test').Page, fileId: string) {
  const transform = await page.getByTestId(fileId).evaluate((element) => element.parentElement?.style.transform ?? '');
  const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform);
  if (match === null) throw new Error(`${fileId} のReact Flow座標を取得できません`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

test('ファイル位置を操作後も保ち、整列・元に戻す・最初に戻すで配置を切り替える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const orderId = 'file-src/order/OrderService.ts';
  const taxId = 'file-src/tax/TaxCalculator.ts';
  const initialTax = await boxPosition(page, taxId);
  const initialOrderFlow = await flowPosition(page, orderId);
  const initialTaxFlow = await flowPosition(page, taxId);
  const taxHeader = page.getByTestId(taxId).locator('.file-node__header');
  const headerBox = await taxHeader.boundingBox();
  if (headerBox === null) throw new Error('TaxCalculator のヘッダーが見つかりません');
  await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(headerBox.x + headerBox.width / 2 + 80, headerBox.y + headerBox.height / 2 + 80, { steps: 8 });
  await page.mouse.up();
  const manuallyMovedTax = await boxPosition(page, taxId);
  expect(manuallyMovedTax).not.toEqual(initialTax);
  const manuallyMovedTaxFlow = await flowPosition(page, taxId);

  // Act: placeOrder から税計算を抽出して TaxCalculator へドラッグする
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const method = page.getByTestId('method-calculateTax');
  const target = page.getByTestId('class-TaxCalculator');
  const from = await method.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('ドラッグ要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(target.getByTestId('method-calculateTax')).toBeVisible();

  // Assert: 手で置いた TaxCalculator と OrderService は操作後もその位置にある
  // (メソッドエディタの表示でキャンバスの幅が変わると表示が合わせ直されるので、画面の位置ではなく図の座標で比べる)
  await expect.poll(() => flowPosition(page, taxId)).toEqual(manuallyMovedTaxFlow);
  await expect.poll(() => flowPosition(page, orderId)).toEqual(initialOrderFlow);

  // Act: 整列はキーボードからも使え、依存先を呼び出し元より下へ置く
  const arrange = page.getByTestId('canvas-arrange');
  await expect(arrange).toHaveAttribute('aria-label', '依存の向きに沿って並べ直す');
  await expect(arrange).toHaveClass(/nodrag/);
  await arrange.focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await boxPosition(page, taxId)).y > (await boxPosition(page, orderId)).y).toBe(true);
  const alignedTax = await flowPosition(page, taxId);
  const alignedOrder = await flowPosition(page, orderId);

  // Act & Assert: undo は配置を保ち、reset はステージ初期配置に戻す
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect.poll(() => flowPosition(page, taxId)).toEqual(alignedTax);
  await expect.poll(() => flowPosition(page, orderId)).toEqual(alignedOrder);
  await page.getByRole('button', { name: '最初に戻す' }).click();
  await expect.poll(() => flowPosition(page, orderId)).toEqual(initialOrderFlow);
  await expect.poll(() => flowPosition(page, taxId)).toEqual(initialTaxFlow);
});
