import { expect, test, type Page } from '@playwright/test';

/** 既存のテストは OrderService を分解するチュートリアル2を前提にしている。 */
async function openOrderStage(page: Page) {
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル2: 太った placeOrder' });
}

/** キャンバスの余白を右クリックし、メニューからファイルを追加する。 */
async function addFileFromMenu(page: Page, path: string) {
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (pane === null) throw new Error('キャンバスの位置を取得できません');
  await page.mouse.click(pane.x + pane.width - 20, pane.y + pane.height - 20, { button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'ファイルを追加' }).click();
  await menu.getByLabel('追加するファイルのパス').fill(path);
  await menu.getByRole('button', { name: '追加' }).click();
}

/** メソッドを右クリックし、メニューからそのメソッドのファイルにクラスを追加する。 */
async function addClassFromMenu(page: Page, methodName: string, className: string) {
  await page.getByTestId(`method-${methodName}`).click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'このファイルにクラスを追加' }).click();
  await menu.getByLabel('追加するクラス名').fill(className);
  await menu.getByRole('button', { name: '追加' }).click();
}

test('メソッドを選んで処理を抽出すると、クラスに新しいメソッドが増える', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
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
  await openOrderStage(page);
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
  await openOrderStage(page);
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
  await openOrderStage(page);
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
  await openOrderStage(page);
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

test('ズームアウトするとファイル名とクラス名だけになり、ズームインするとメソッドと行数が戻る', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  const classNode = page.getByTestId('class-OrderService');
  const method = page.getByTestId('method-placeOrder');
  await expect(method).toBeVisible();

  // Act
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom Out' }).click();

  // Assert
  await expect(method).toHaveCount(0);
  await expect(classNode).toContainText('OrderService');
  await expect(classNode).not.toContainText('行');
  await expect(page.getByTestId('file-src/order/OrderService.ts')).toContainText('src/order/OrderService.ts');
  await expect(page.getByTestId('file-src/order/OrderService.ts')).not.toContainText('行');

  // Act
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom In' }).click();

  // Assert
  await expect(method).toBeVisible();
  await expect(classNode).toContainText('行');
});

test('初期状態の点数は、行数の上限を超えた placeOrder と責務が混ざった OrderService の分だけ減点されている', async ({
  page,
}) => {
  // Arrange & Act
  await openOrderStage(page);

  // Assert
  await expect(page.getByTestId('score')).toContainText('80点');
  await expect(page.getByTestId('score')).toContainText('行数 -10');
  await expect(page.getByTestId('score')).toContainText('責務の混在 -10');
  await expect(page.getByTestId('file-src/order/OrderService.ts').getByTestId('file-mark')).toBeVisible();
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts').getByTestId('file-mark')).toHaveCount(0);
});

test('税の計算を抽出して TaxCalculator へ移すと、責務の混在の減点が消える', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score')).toContainText('責務の混在 -10');
  const mark = page.getByTestId('file-src/order/OrderService.ts').getByTestId('file-mark');
  await expect(mark).toHaveAttribute('aria-label', /-20点/);
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
  await expect(page.getByTestId('score')).not.toContainText('責務の混在');
  await expect(mark).not.toHaveAttribute('aria-label', /-20点/);
});

test('クラスとファイルを追加し、クラスを新しいファイルへドラッグ&ドロップで移せる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await addFileFromMenu(page, 'src/mail/Mailer.ts');
  await addClassFromMenu(page, 'placeOrder', 'Mailer');
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
  await openOrderStage(page);

  // Act
  await addClassFromMenu(page, 'placeOrder', 'TaxCalculator');

  // Assert
  await expect(page.getByRole('alert')).toHaveText('同じ名前のクラスがすでにあります');
  await expect(page.getByTestId('context-menu')).toBeVisible();
});

test('ステージを選ぶと、そのステージのコードベースと目標に切り替わり、点数も付け直される', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'チュートリアル1: 長いメソッドを分ける' })).toBeVisible();
  await expect(page.getByTestId('class-ReportService')).toBeVisible();
  await expect(page.getByTestId('stage-description')).toContainText('月次の売上レポート');

  // Act
  await page.getByLabel('ステージ').selectOption({ label: '中級1: 循環依存を断ち切る' });

  // Assert
  await expect(page.getByRole('heading', { name: '中級1: 循環依存を断ち切る' })).toBeVisible();
  await expect(page.getByTestId('stage-description')).toContainText('注文(Order)と顧客(Customer)');
  await expect(page.getByTestId('class-ReportService')).toHaveCount(0);
  await expect(page.getByTestId('class-Customer')).toBeVisible();
  await expect(page.getByTestId('score')).toContainText('循環依存 -20');
});

test('メソッドを右クリックしてメニューから、そのクラスのファイルにクラスを追加できる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);

  // Act
  await page.getByTestId('method-placeOrder').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await expect(menu).toContainText('src/order/OrderService.ts');
  await menu.getByRole('menuitem', { name: 'このファイルにクラスを追加' }).click();
  await menu.getByLabel('追加するクラス名').fill('OrderValidator');
  await menu.getByLabel('追加するクラス名').press('Enter');

  // Assert
  await expect(page.getByTestId('class-OrderValidator')).toBeVisible();
  await expect(menu).toHaveCount(0);
});

test('キャンバスの余白を右クリックしてメニューから、ファイルを追加できる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (pane === null) throw new Error('キャンバスの位置を取得できません');

  // Act
  await page.mouse.click(pane.x + pane.width - 20, pane.y + pane.height - 20, { button: 'right' });
  const menu = page.getByTestId('context-menu');
  await expect(menu.getByRole('menuitem', { name: 'このファイルにクラスを追加' })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'ファイルを追加' }).click();
  await menu.getByLabel('追加するファイルのパス').fill('src/mail/Mailer.ts');
  await menu.getByRole('button', { name: '追加' }).click();

  // Assert
  await expect(page.getByTestId('file-src/mail/Mailer.ts')).toBeVisible();
});

test('右クリックメニューはEscapeで閉じる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-OrderService').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await expect(menu).toBeVisible();

  // Act
  await page.keyboard.press('Escape');

  // Assert
  await expect(menu).toHaveCount(0);
});

test('クラスを右クリックして名前を変更すると、キャンバスの表示が変わる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');

  // Act
  await menu.getByRole('menuitem', { name: 'クラスの名前を変更' }).click();
  const input = menu.getByLabel('新しいクラス名');
  await expect(input).toHaveValue('TaxCalculator');
  await input.fill('TaxPolicy');
  await input.press('Enter');

  // Assert
  await expect(page.getByTestId('class-TaxPolicy')).toBeVisible();
  await expect(page.getByTestId('class-TaxCalculator')).toHaveCount(0);
  await expect(menu).toHaveCount(0);
});

test('ファイルを右クリックしてパスを変更すると、キャンバスの表示が変わる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('file-src/tax/TaxCalculator.ts').click({ button: 'right', position: { x: 10, y: 10 } });
  const menu = page.getByTestId('context-menu');

  // Act
  await menu.getByRole('menuitem', { name: 'ファイルの名前を変更' }).click();
  const input = menu.getByLabel('新しいファイルのパス');
  await input.fill('src/tax/TaxPolicy.ts');
  await input.press('Enter');

  // Assert
  await expect(page.getByTestId('file-src/tax/TaxPolicy.ts')).toBeVisible();
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts')).toHaveCount(0);
});

test('重複した名前には変更できず、理由が表示されて名前は変わらない。Escapeで取り消せる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'クラスの名前を変更' }).click();
  const input = menu.getByLabel('新しいクラス名');

  // Act
  await input.fill('OrderService');
  await input.press('Enter');

  // Assert
  await expect(page.getByRole('alert')).toHaveText('同じ名前のクラスがすでにあります');
  await expect(page.getByTestId('class-TaxCalculator')).toBeVisible();
  await input.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('メソッドをドラッグで移したあと Ctrl+Z で元のクラスに戻り、Ctrl+Y で移動先に戻る', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await expect(page.getByRole('button', { name: '元に戻す' })).toBeDisabled();
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const from = await page.getByTestId('method-calculateTax').boundingBox();
  const to = await page.getByTestId('class-TaxCalculator').boundingBox();
  if (from === null || to === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  const original = page.getByTestId('class-OrderService').getByTestId('method-calculateTax');
  const moved = page.getByTestId('class-TaxCalculator').getByTestId('method-calculateTax');
  await expect(moved).toBeVisible();

  // Act & Assert
  await page.keyboard.press('Control+z');
  await expect(original).toBeVisible();
  await expect(moved).toHaveCount(0);
  await page.keyboard.press('Control+y');
  await expect(moved).toBeVisible();
  await page.getByRole('button', { name: '最初に戻す' }).click();
  await expect(page.getByTestId('method-calculateTax')).toHaveCount(0);
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(moved).toBeVisible();
});
