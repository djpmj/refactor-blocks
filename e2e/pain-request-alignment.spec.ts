import { expect, test, type Locator, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function drag(page: Page, sourceTestId: string, target: string | Locator) {
  const source = await page.getByTestId(sourceTestId).boundingBox();
  const targetBox = await (typeof target === 'string' ? page.getByTestId(target) : target).boundingBox();
  if (source === null || targetBox === null) throw new Error('ドラッグ対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
}

test('中級1: 責務を寄せると、カードに直すクラス数の前後が出る', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '中級1: 循環依存を断ち切る');
  const card = page.getByRole('region', { name: 'もし、この変更が来たら?' });
  await card.locator('summary').click();
  await expect(card).not.toContainText('最初は 2 クラス');

  // Act
  await drag(page, 'method-calculateOrderTotal', 'class-Order');
  await drag(page, 'method-getLines', 'class-Order');

  // Assert
  await expect(card).toContainText('1 クラス');
  await expect(card).toContainText('最初は 2 クラス');
});

test('中級8: Addressクラスへ分けると、クラスを開いて読む行数の前後が出る', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '中級8: 給与と住所を抱えた社員クラス');
  const card = page.getByRole('region', { name: 'もし、この変更が来たら?' });
  await card.locator('summary').click();
  await expect(card).toContainText('そのクラスを開くと、目を通す行数は今 40 行');

  // Act
  await page.getByTestId('class-header-Employee').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'クラスを追加' }).click();
  await menu.getByLabel('追加するクラス名').fill('Address');
  await menu.getByLabel('追加するクラス名').press('Enter');
  await expect(page.getByTestId('class-NewClass')).toBeVisible();
  await drag(page, 'field-postalCode', 'class-NewClass');
  const addressClass = page.locator('.class-node').filter({ has: page.getByTestId('field-postalCode') });
  await drag(page, 'field-prefecture', addressClass);
  await drag(page, 'field-addressLine', addressClass);
  await drag(page, 'method-formatMailingAddress', addressClass);
  await drag(page, 'method-changeAddress', addressClass);

  // Assert
  await expect(card).toContainText('そのクラスを開くと、目を通す行数は今 22 行');
  await expect(card).toContainText('最初は 40 行でした');
});
