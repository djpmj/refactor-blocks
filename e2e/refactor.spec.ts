import { expect, test, type Page } from '@playwright/test';

/** 既存のテストは OrderService を分解するチュートリアル2を前提にしている。 */
async function openOrderStage(page: Page) {
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル2: 太った placeOrder' });
}

/** 循環依存を扱うテストは中級1を前提にしている。 */
async function openCyclicStage(page: Page) {
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '中級1: 循環依存を断ち切る' });
}

/**
 * 直前の操作でキャンバスのレイアウトが再計算され続けている間に座標を読むと、
 * 古い位置へドラッグしてしまい失敗することがある(連続でMove Methodするテストで発生)。
 * 位置が2回連続で同じになるまで待ってから返す。
 */
async function stableBoundingBox(page: Page, testId: string) {
  const deadline = Date.now() + 3000;
  let previous = await page.getByTestId(testId).boundingBox();
  while (Date.now() < deadline) {
    await page.waitForTimeout(50);
    const current = await page.getByTestId(testId).boundingBox();
    if (previous !== null && current !== null && current.x === previous.x && current.y === previous.y) return current;
    previous = current;
  }
  if (previous === null) throw new Error(`要素 ${testId} の位置を取得できません`);
  return previous;
}

/** ドラッグ操作(Move Method)で、あるメソッドを別クラスへ移す。 */
async function dragMethodToClass(page: Page, methodTestId: string, classTestId: string) {
  const from = await stableBoundingBox(page, methodTestId);
  const to = await stableBoundingBox(page, classTestId);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await expect(page.getByTestId(classTestId)).toHaveClass(/class-node--drop-target/);
  await page.mouse.up();
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
  await expect(page.getByTestId('class-Order').getByTestId('cyclic-mark')).toBeVisible();
  await expect(page.getByTestId('class-Customer').getByTestId('cyclic-mark')).toBeVisible();
  await expect(page.getByTestId('class-Inventory').getByTestId('cyclic-mark')).toHaveCount(0);
});

test('循環依存を断ち切ると、循環依存の減点とクラスの印が消える', async ({ page }) => {
  // Arrange
  await openCyclicStage(page);
  await expect(page.getByTestId('score')).toContainText('循環依存 -20');
  await expect(page.getByTestId('class-Order').getByTestId('cyclic-mark')).toBeVisible();
  await expect(page.getByTestId('class-Customer').getByTestId('cyclic-mark')).toBeVisible();

  // Act(countOrdersOfをCustomerへ、calculateOrderTotalをOrderへ Move Method)
  await dragMethodToClass(page, 'method-countOrdersOf', 'class-Customer');
  await expect(page.getByTestId('class-Customer').getByTestId('method-countOrdersOf')).toBeVisible();
  await dragMethodToClass(page, 'method-calculateOrderTotal', 'class-Order');
  await expect(page.getByTestId('class-Order').getByTestId('method-calculateOrderTotal')).toBeVisible();

  // Assert
  await expect(page.getByTestId('score')).not.toContainText('循環依存');
  await expect(page.getByTestId('class-Order').getByTestId('cyclic-mark')).toHaveCount(0);
  await expect(page.getByTestId('class-Customer').getByTestId('cyclic-mark')).toHaveCount(0);
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

test('クラスを右クリックして継承元を設定すると、継承の矢印と"extends"の表示が出る', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '継承元を設定' }).click();
  const select = menu.getByLabel('親クラス名(空で解除)');

  // Act
  await select.selectOption('OrderService');
  await menu.getByRole('button', { name: '設定' }).click();

  // Assert
  const edge = page.getByTestId('rf__edge-inherit-class-tax-calculator-class-order-service');
  await expect(edge).toHaveCount(1);
  await expect(edge).toHaveClass(/edge--inheritance/);
  await expect(page.getByTestId('class-TaxCalculator')).toContainText('extends OrderService');
  await expect(menu).toHaveCount(0);
});

test('クラスを右クリックして実装するインターフェースを設定すると、"implements"の表示が出る', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '実装するインターフェースを設定' }).click();
  const select = menu.getByLabel('インターフェース名(空で解除)');

  // Act
  await select.selectOption('OrderService');
  await menu.getByRole('button', { name: '設定' }).click();

  // Assert
  await expect(page.getByTestId('class-TaxCalculator')).toContainText('implements OrderService');
  await expect(page.getByTestId('class-TaxCalculator')).not.toContainText('extends OrderService');
  await expect(menu).toHaveCount(0);
});

test('継承の輪ができる相手は、継承元の候補一覧から外れる', async ({ page }) => {
  // Arrange: TaxCalculator が OrderService を継承した状態を作る
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: '継承元を設定' }).click();
  await page.getByLabel('親クラス名(空で解除)').selectOption('OrderService');
  await page.getByTestId('context-menu').getByRole('button', { name: '設定' }).click();
  await page.getByTestId('class-header-OrderService').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '継承元を設定' }).click();
  const select = menu.getByLabel('親クラス名(空で解除)');

  // Act & Assert: OrderService の候補一覧には、輪ができる TaxCalculator が出てこない((解除)だけになる)
  await expect(select.locator('option')).toHaveText(['(解除)']);
  await select.press('Escape');
});

test('クラスを右クリックして削除すると、キャンバスから消える', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');

  // Act
  await menu.getByRole('menuitem', { name: 'クラスを削除' }).click();

  // Assert
  await expect(page.getByTestId('class-TaxCalculator')).toHaveCount(0);
  await expect(menu).toHaveCount(0);
});

test('ファイルを右クリックして削除すると、キャンバスから消える', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('file-src/tax/TaxCalculator.ts').click({ button: 'right', position: { x: 10, y: 10 } });
  const menu = page.getByTestId('context-menu');

  // Act
  await menu.getByRole('menuitem', { name: 'ファイルを削除' }).click();

  // Assert
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts')).toHaveCount(0);
});

test('切り出したメソッドを含むクラスを削除すると、呼び出し元の元のメソッドに処理が戻ったうえでクラスが消える。Ctrl+Zで削除前の状態に戻せる', async ({ page }) => {
  // Arrange: calculateTaxを抽出してTaxCalculatorへドラッグで移す
  await openOrderStage(page);
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const source = page.getByTestId('method-calculateTax');
  const target = page.getByTestId('class-TaxCalculator');
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(target.getByTestId('method-calculateTax')).toBeVisible();

  // Act
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'クラスを削除' }).click();

  // Assert
  await expect(page.getByTestId('class-TaxCalculator')).toHaveCount(0);
  await expect(page.getByTestId('method-calculateTax')).toHaveCount(0);
  await page.getByTestId('method-placeOrder').click();
  await expect(page.getByLabel('消費税を計算する(軽減税率あり)')).toBeVisible();

  // Act: Ctrl+Zで削除前に戻す
  await page.keyboard.press('Control+z');

  // Assert
  await expect(page.getByTestId('class-TaxCalculator').getByTestId('method-calculateTax')).toBeVisible();
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

/** 変更依頼の調査で、依頼ごとに選ぶメソッドを順にクリックして「調査を終える」を押す。 */
async function investigateRequests(page: Page, methodNamesPerRequest: readonly (readonly string[])[]) {
  // ドラッグ直後の1回目のクリックはdnd-kitに握りつぶされることがあるので、パネルが開くまで押し直す
  await expect(async () => {
    await page.getByTestId('change-request-start').click({ timeout: 1000 });
    await expect(page.getByTestId('change-panel')).toBeVisible({ timeout: 1000 });
  }).toPass();
  for (const methodNames of methodNamesPerRequest) {
    for (const name of methodNames) await page.getByTestId(`method-${name}`).click();
    await page.getByTestId('change-request-finish').click();
  }
}

async function readinessOf(page: Page, kind: 'current' | 'initial'): Promise<number> {
  const text = await page.getByTestId(`change-readiness-${kind}`).innerText();
  return Number.parseInt(text, 10);
}

test('変更依頼に挑戦し、変更が必要なメソッドを選んで調査を終えると、点数と理由が出る', async ({ page }) => {
  // Arrange
  await openOrderStage(page);

  // Act
  await page.getByTestId('change-request-start').click();
  await expect(page.getByTestId('change-request-title')).toHaveText('軽減税率の対象を増やして');
  await page.getByTestId('method-placeOrder').click();
  await expect(page.getByTestId('method-placeOrder')).toHaveAttribute('data-investigated', 'true');
  await page.getByTestId('change-request-finish').click();
  await page.getByTestId('method-placeOrder').click();
  await page.getByTestId('change-request-finish').click();
  await page.getByTestId('method-placeOrder').click();
  await page.getByTestId('change-request-finish').click();

  // Assert
  const outcome = page.getByTestId('change-outcome-req-reduced-tax');
  await expect(outcome.getByTestId('outcome-current')).toHaveText('70点');
  await expect(outcome).toContainText('巻き込み');
  await expect(outcome).toContainText('上限超え');
  await expect(page.getByTestId('change-readiness')).toBeVisible();
});

test('調査で変更が必要なメソッドを選び漏らすと、修正漏れとして減点される', async ({ page }) => {
  // Arrange
  await openOrderStage(page);

  // Act(何も選ばずに終える)
  await investigateRequests(page, [[], ['placeOrder'], ['placeOrder']]);

  // Assert
  const outcome = page.getByTestId('change-outcome-req-reduced-tax');
  await expect(outcome.getByTestId('outcome-current')).toHaveText('60点');
  await expect(outcome).toContainText('修正漏れ');
});

test('責務を分けたあとで同じ依頼を受けると、初期状態より変更容易性スコアが高くなる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
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
  await expect(page.getByTestId('class-TaxCalculator').getByTestId('method-calculateTax')).toBeVisible();

  // Act
  await investigateRequests(page, [['calculateTax'], ['placeOrder'], ['placeOrder']]);

  // Assert
  await expect(page.getByTestId('change-outcome-req-reduced-tax').getByTestId('outcome-current')).toHaveText('95点');
  expect(await readinessOf(page, 'current')).toBeGreaterThan(await readinessOf(page, 'initial'));
});

test('結果画面から戻ると、キャンバスは変更依頼を当てる前の状態のままで、編集を再開できる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  const lines = page.getByTestId('method-placeOrder').locator('.method-chip__lines');
  const before = await lines.innerText();
  await investigateRequests(page, [['placeOrder'], ['placeOrder'], ['placeOrder']]);

  // Act
  await page.getByTestId('change-request-close').click();

  // Assert
  await expect(page.getByTestId('change-panel')).toHaveCount(0);
  expect(await lines.innerText()).toBe(before);
  await page.getByTestId('method-placeOrder').click();
  await expect(page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' })).toBeVisible();
});

test('変更依頼の調査中にメソッドへカーソルを合わせると、そのメソッドが何をしているか(処理の一覧)が見える', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('change-request-start').click();
  const inspect = page.getByTestId('change-inspect');
  await expect(inspect).not.toContainText('消費税を計算する');

  // Act
  await page.getByTestId('method-placeOrder').hover();

  // Assert
  await expect(inspect).toContainText('placeOrder');
  await expect(inspect).toContainText('消費税を計算する(軽減税率あり)');
  await expect(inspect).toContainText('確認メールを送る');
  await expect(page.getByTestId('method-placeOrder')).not.toHaveAttribute('data-investigated', 'true');

  // Act(選んでいないメソッドからカーソルを外す)
  await page.getByTestId('class-OrderService').hover({ position: { x: 5, y: 5 } });

  // Assert(選んでいないので消える)
  await expect(inspect).not.toContainText('消費税を計算する');
});

test('変更依頼の調査で複数のメソッドを選ぶと、選んだメソッドすべての中身が右側に並ぶ', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await page.getByTestId('change-request-start').click();
  const inspect = page.getByTestId('change-inspect');

  // Act
  await page.getByTestId('method-placeOrder').click();
  await page.getByTestId('method-calculateTax').hover();

  // Assert(選んだものに加えて、カーソルを合わせたものが「確認中」で出る)
  await expect(inspect.getByTestId('change-inspect-placeOrder')).not.toContainText('確認中');
  await expect(inspect.getByTestId('change-inspect-calculateTax')).toContainText('確認中');

  // Act(2つ目も選ぶ。カーソルを外しても両方残る)
  await page.getByTestId('method-calculateTax').click();
  await page.getByTestId('class-TaxCalculator').hover({ position: { x: 5, y: 5 } });

  // Assert
  await expect(inspect.getByTestId('change-inspect-placeOrder')).toBeVisible();
  await expect(inspect.getByTestId('change-inspect-calculateTax')).not.toContainText('確認中');
  await expect(inspect.getByTestId('change-inspect-calculateTax')).toContainText('消費税を計算する(軽減税率あり)');
});

test('変更依頼の結果は、リファクタリングに戻っても手がかりとして残り、直してから再挑戦すると前回の点数と比べられる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await investigateRequests(page, [['placeOrder'], ['placeOrder'], ['placeOrder']]);

  // Act
  await page.getByTestId('change-request-close').click();

  // Assert(調査中は隠していた変更箇所の印と、前回の減点理由がキャンバスの横に残る)
  await expect(page.getByTestId('method-placeOrder').getByTestId('change-site-badge')).toHaveText('変更×3');
  const memo = page.getByTestId('change-memo');
  await expect(memo).toContainText('軽減税率の対象を増やして');
  await expect(memo).toContainText('70点');
  await expect(memo).toContainText('巻き込み');
  await expect(page.getByTestId('change-request-start')).toHaveText('もう一度挑戦');

  // Act(税の計算を抽出して、もう一度挑戦する)
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await investigateRequests(page, [['calculateTax'], ['placeOrder'], ['placeOrder']]);

  // Assert
  const outcome = page.getByTestId('change-outcome-req-reduced-tax');
  await expect(outcome.getByTestId('outcome-current')).toHaveText('100点');
  await expect(outcome.getByTestId('outcome-previous')).toContainText('前回 70点');
});

test('変更依頼の調査中は、前回の変更箇所の印を出さない(答えが見えてしまうため)', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await investigateRequests(page, [['placeOrder'], ['placeOrder'], ['placeOrder']]);
  await page.getByTestId('change-request-close').click();
  await expect(page.getByTestId('change-site-badge')).toHaveCount(1);

  // Act
  await page.getByTestId('change-request-start').click();

  // Assert
  await expect(page.getByTestId('change-site-badge')).toHaveCount(0);
});

test('ファイルの箱をドラッグして位置をずらせる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  const file = page.locator('.react-flow__node[data-id="file-tax-calculator"]');
  const before = await file.boundingBox();
  if (before === null) throw new Error('ファイルの位置を取得できません');

  // Act: ファイルの箱の余白(クラスの外)をつかんで下へ動かす
  const grabX = before.x + 8;
  const grabY = before.y + 8;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX + 20, grabY + 120, { steps: 5 });
  await page.mouse.up();

  // Assert
  const after = await file.boundingBox();
  expect(after?.y).toBeGreaterThan(before.y + 50);
});

/** 要素をつかんで、キャンバスの右下の余白(どのファイルの枠外)へドラッグして離す。 */
async function dragToEmptyCanvas(page: Page, testId: string) {
  const from = await page.getByTestId(testId).boundingBox();
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (from === null || pane === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();
}

test('クラスをファイルの枠外へドラッグすると、新しいファイルが作られてそこに置かれる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Act
  await dragToEmptyCanvas(page, 'class-header-TaxCalculator');

  // Assert
  await expect(page.getByTestId('file-src/TaxCalculator.ts')).toBeVisible();
  await expect(page.getByTestId('class-TaxCalculator')).toBeVisible();
});

test('メソッドをファイルの枠外へドラッグすると、新しいファイルとクラスが作られてそこに置かれる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Act
  await dragToEmptyCanvas(page, 'method-calculateTax');

  // Assert
  await expect(page.getByTestId('class-NewClass').getByTestId('method-calculateTax')).toBeVisible();
  await expect(page.getByTestId('file-src/NewClass.ts')).toBeVisible();
});

test('越境した private メソッドの呼び出しは減点され、呼び出し元のクラスへ Move Method すると解消する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '中級3: 越境する private メソッド' });
  await expect(page.getByRole('heading', { name: '中級3: 越境する private メソッド' })).toBeVisible();
  await expect(page.getByTestId('score')).toContainText('80点');
  await expect(page.getByTestId('score')).toContainText('行数 -10');
  await expect(page.getByTestId('score')).toContainText('アクセス制御 -10');

  // Act: notifyShipment からメール送信・ログ記録を抽出する
  await page.getByTestId('method-notifyShipment').click();
  await page.getByLabel('メールを送信する').check();
  await page.getByLabel('新しいメソッド名').fill('sendMail');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await page.getByTestId('method-notifyShipment').click();
  await page.getByLabel('送信ログを記録する').check();
  await page.getByLabel('新しいメソッド名').fill('logDelivery');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Act: renderTemplate を呼び出し元の NotificationService へドラッグで移す
  const source = page.getByTestId('method-renderTemplate');
  const target = page.getByTestId('class-NotificationService');
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();

  // Assert
  await expect(target.getByTestId('method-renderTemplate')).toBeVisible();
  await expect(page.getByTestId('score')).toContainText('100点');
});

test('上級ステージ: 共通処理を基底クラスへ移してから継承元を設定すると、継承の矢印が引かれる', async ({ page }) => {
  // Arrange: 通知文を組み立てる処理を EmailNotifier から抽出する
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '上級1: 通知クラスの共通処理を基底クラスへ集める' });
  await page.getByTestId('method-notifyByEmail').click();
  await page.getByLabel('通知文を組み立てる').check();
  await page.getByLabel('新しいメソッド名').fill('buildEmailBody');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Act: 抽出したメソッドを NotifierBase へドラッグで移し、EmailNotifier の継承元を NotifierBase にする
  const source = page.getByTestId('method-buildEmailBody');
  const target = page.getByTestId('class-NotifierBase');
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await page.getByTestId('class-header-EmailNotifier').click({ button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: '継承元を設定' }).click();
  await page.getByLabel('親クラス名(空で解除)').selectOption('NotifierBase');
  await page.getByTestId('context-menu').getByRole('button', { name: '設定' }).click();

  // Assert
  await expect(target.getByTestId('method-buildEmailBody')).toBeVisible();
  const edge = page.getByTestId('rf__edge-inherit-class-email-notifier-class-notifier-base');
  await expect(edge).toHaveCount(1);
  await expect(page.getByTestId('class-EmailNotifier')).toContainText('extends NotifierBase');
});
