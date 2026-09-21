import { expect, test } from '@playwright/test';

test('メソッドを選んで処理を抽出すると、クラスに新しいメソッドが増える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('method-placeOrder').click();

  // Act
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Assert
  await expect(page.getByTestId('class-OrderService').getByTestId('method-calculateTax')).toBeVisible();
});

test('メソッドを別クラスへドラッグ&ドロップすると移動する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const source = page.getByTestId('method-calculateTax');
  const target = page.getByTestId('class-TaxCalculator');

  // Act
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();

  // Assert
  await expect(target.getByTestId('method-calculateTax')).toBeVisible();
});

test('抽出したメソッドを別クラスへ移すと、クラス間に依存の矢印が引かれる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const source = page.getByTestId('method-calculateTax');
  const target = page.getByTestId('class-TaxCalculator');
  const edge = page.getByTestId('rf__edge-dep-class-order-service-class-tax-calculator');
  await expect(edge).toHaveCount(0);

  // Act
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();

  // Assert
  await expect(edge).toHaveCount(1);
});

test('初期状態の点数は、上限を超えた placeOrder の分だけ減点されている', async ({ page }) => {
  // Arrange & Act
  await page.goto('/');

  // Assert
  await expect(page.getByTestId('score')).toContainText('90点');
  await expect(page.getByTestId('score')).toContainText('行数 -10');
});
