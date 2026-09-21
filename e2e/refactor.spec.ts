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

test('処理を選ぶと、選んだ処理に合わせてメソッド名が自動で入り、そのまま抽出できる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('method-placeOrder').click();
  const nameInput = page.getByLabel('新しいメソッド名');

  // Act
  await page.getByLabel('商品が空でないか検証する').check();
  await expect(nameInput).toHaveValue('validateItems');
  await page.getByLabel('在庫があるか検証する').check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Assert
  await expect(page.getByTestId('class-OrderService').getByTestId('method-validateItemsAndStock')).toBeVisible();
});

test('抽出したメソッドを「呼び出し元へ戻す」と、処理が元のメソッドに戻りメソッドが消える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await page.getByTestId('method-calculateTax').click();

  // Act
  await page.getByRole('button', { name: '呼び出し元へ戻す' }).click();

  // Assert
  await expect(page.getByTestId('method-calculateTax')).toHaveCount(0);
  await expect(page.getByLabel('消費税を計算する(軽減税率あり)')).toBeVisible();
  await expect(page.getByRole('heading', { name: /OrderService\.placeOrder\(\)/ })).toBeVisible();
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

test('クラスとファイルを追加し、クラスを新しいファイルへドラッグ&ドロップで移せる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('新しいファイルのパス').fill('src/mail/Mailer.ts');
  await page.getByRole('button', { name: 'ファイルを追加' }).click();
  await page.getByLabel('新しいクラス名').fill('Mailer');
  await page.getByLabel('クラスの追加先ファイル').selectOption({ label: 'src/order/OrderService.ts' });
  await page.getByRole('button', { name: 'クラスを追加' }).click();
  // クラスノードはファイルノードのDOMの子にならないため、空ファイルの案内の有無で移動先を確かめる
  const emptyFileHint = page.getByText('ここにクラスをドロップ');
  await expect(emptyFileHint).toHaveCount(1);
  const source = page.getByTestId('class-header-Mailer');
  const target = page.getByTestId('file-src/mail/Mailer.ts');
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

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
  await expect(page.getByTestId('class-Mailer')).toHaveCount(1);
  await expect(emptyFileHint).toHaveCount(0);
});

test('同じ名前のクラスは追加できず、理由が表示される', async ({ page }) => {
  // Arrange
  await page.goto('/');

  // Act
  await page.getByLabel('新しいクラス名').fill('TaxCalculator');
  await page.getByRole('button', { name: 'クラスを追加' }).click();

  // Assert
  await expect(page.getByRole('alert')).toHaveText('同じ名前のクラスがすでにあります');
});
