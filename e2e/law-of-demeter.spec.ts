import { expect, test, type Page } from '@playwright/test';
import { dismissClearScreen, selectStage } from './selectStage.js';

const STAGE = '中級14: 注文から住所までたどる宛名印刷';

async function extract(page: Page, owner: string, method: string, labels: readonly string[], name: string) {
  await page.getByTestId(`class-${owner}`).getByTestId(`method-${method}`).click();
  for (const label of labels) await page.getByRole('checkbox', { name: label }).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await dismissClearScreen(page);
}

async function mergeInto(page: Page, owner: string, name: string) {
  await page.getByTestId(`class-${owner}`).getByTestId(`method-${name}`).click();
  await page.getByLabel('統合後の名前').fill(name);
  await page.getByTestId(`merge-candidate-${name}`).click();
  await dismissClearScreen(page);
}

async function moveMethod(page: Page, name: string, toClass: string) {
  await page.getByTestId(`method-${name}`).click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '別のクラスへ移動' }).click();
  await menu.getByRole('menuitem', { name: toClass, exact: true }).click();
  await expect(page.getByTestId(`class-${toClass}`).getByTestId(`method-${name}`)).toBeVisible();
  await dismissClearScreen(page);
}

test('中級14: 模範解答の移動までの8手を画面で操作すると100点になり、理解度チェックが3問出る', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, STAGE);
  await expect(page.getByTestId('score-value')).toContainText('60');

  // Act: チェーンの後ろ側(住所をたどって宛先を作る)を抽出・統合して Customer へ
  await extract(page, 'ShippingLabelPrinter', 'printLabel', ['customer.getAddress() で住所を取り出す', 'address.formatForLabel() で宛先の文字列を作る'], 'buildAddressLine');
  await extract(page, 'DeliveryNotePrinter', 'printNote', ['customer.getAddress() で住所を取り出す', 'address.formatForLabel() で宛先の文字列を作る'], 'buildAddressLine');
  await mergeInto(page, 'ShippingLabelPrinter', 'buildAddressLine');
  await moveMethod(page, 'buildAddressLine', 'Customer');

  // Act: 残りの「顧客を取り出して頼む」を抽出・統合して Order へ
  await extract(page, 'ShippingLabelPrinter', 'printLabel', ['order.getCustomer() で顧客を取り出す', 'buildAddressLine() を呼び出す'], 'shippingAddressLine');
  await extract(page, 'DeliveryNotePrinter', 'printNote', ['order.getCustomer() で顧客を取り出す', 'buildAddressLine() を呼び出す'], 'shippingAddressLine');
  await mergeInto(page, 'ShippingLabelPrinter', 'shippingAddressLine');
  await moveMethod(page, 'shippingAddressLine', 'Order');

  // Assert: 8手目で100点。getter を private にする9・10手目は、可視性の選択欄が出ないステージ設定(visibilityEnforced なし)なので画面では行えない
  await expect(page.getByTestId('score-value')).toContainText('100');
  await dismissClearScreen(page);
  const panel = page.getByRole('region', { name: '理解度チェック' });
  await expect(panel.getByRole('group')).toHaveCount(3);
});
