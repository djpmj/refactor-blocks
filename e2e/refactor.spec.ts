import { expect, test, type Locator, type Page } from '@playwright/test';

test('右サイドバーの幅をドラッグとキーボードで調整し、白紙設計でも使える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  const sidebar = page.locator('.sidebar-resizable').first();
  const handle = page.getByRole('separator', { name: 'サイドバーの幅を変更' }).first();
  await expect(sidebar).toHaveCSS('width', '360px');

  // Act: 左端ハンドルを左へドラッグして幅を広げる
  const handleBox = await handle.boundingBox();
  if (handleBox === null) throw new Error('サイドバーのハンドルが見つかりません');
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 400, handleBox.y + handleBox.height / 2, { steps: 5 });
  await page.mouse.up();

  // Assert: 最大幅で止まる
  await expect(handle).toHaveAttribute('aria-valuenow', '640');
  await expect(sidebar).toHaveCSS('width', '640px');

  // Act: 右へドラッグして最小幅まで狭める
  const expandedHandleBox = await handle.boundingBox();
  if (expandedHandleBox === null) throw new Error('サイドバーのハンドルが見つかりません');
  await page.mouse.move(expandedHandleBox.x + expandedHandleBox.width / 2, expandedHandleBox.y + expandedHandleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(expandedHandleBox.x + 400, expandedHandleBox.y + expandedHandleBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '280');

  // Act: キーボードでも幅を調整し、ページ再読み込みで初期値に戻す
  await handle.focus();
  for (let step = 0; step < 30; step += 1) await page.keyboard.press('ArrowLeft');

  // Assert
  await expect(handle).toHaveAttribute('aria-valuenow', '640');
  await page.reload();
  await expect(page.getByRole('separator', { name: 'サイドバーの幅を変更' })).toHaveAttribute('aria-valuenow', '360');

  // Act: 白紙設計画面の右パネルもキーボードで広げる
  await page.getByTestId('mode-blank').click();
  const blankHandle = page.getByTestId('blank-view').getByRole('separator', { name: 'サイドバーの幅を変更' });
  await blankHandle.focus();
  await page.keyboard.press('ArrowLeft');

  // Assert
  await expect(blankHandle).toHaveAttribute('aria-valuenow', '376');

  // Assert: 右パネルのない設計くらべ画面にはハンドルを表示しない
  await page.getByTestId('mode-quiz').click();
  await expect(page.getByRole('separator', { name: 'サイドバーの幅を変更' })).toHaveCount(0);
});

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

/** フィールド・Move Field・Feature Envyを扱うテストは中級6を前提にしている。 */
async function openFeatureEnvyStage(page: Page) {
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '中級6: 他人のデータばかり触るメソッド' });
}

/** 貧血ドメインモデル・アクセサ越しのアクセスを扱うテストは中級7を前提にしている。 */
async function openAnemicDomainModelStage(page: Page) {
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '中級7: getter/setter だけの口座クラス' });
}

/** 凝集度・Extract Classを扱うテストは中級8を前提にしている。 */
async function openExtractClassStage(page: Page) {
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '中級8: 給与と住所を抱えた社員クラス' });
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

/**
 * キャンバスの中で、ノードの載っていない(パンに使える)点を探す。
 * e2e の tsconfig は DOM の型を持たない(vite.config.ts と共用)ので、ブラウザで動かす処理は文字列で渡す。
 */
const FIND_EMPTY_PANE_POINT = `(() => {
  const pane = document.querySelector('.react-flow__pane')?.getBoundingClientRect();
  if (pane === undefined) return null;
  for (let y = pane.top + 30; y < pane.bottom - 200; y += 20) {
    for (let x = pane.left + 170; x < pane.right - 170; x += 20) {
      if (document.elementFromPoint(x, y)?.classList.contains('react-flow__pane')) return { x, y };
    }
  }
  return null;
})()`;

async function emptyPanePoint(page: Page) {
  const point = await page.evaluate<{ x: number; y: number } | null>(FIND_EMPTY_PANE_POINT);
  if (point === null) throw new Error('キャンバスに空いている場所がありません');
  return point;
}

/**
 * Move Method でクラスが縦に伸びると、移したメソッドがキャンバスの表示範囲の外へはみ出すことがある。
 * Fit View で縮めるとセマンティックズームでメソッドが隠れるので、プレイヤーと同じく余白をドラッグしてパンし、
 * 対象をキャンバスの中央へ寄せてから、位置が落ち着いたところでクリックする。
 */
async function clickInCanvas(page: Page, testId: string) {
  const box = await stableBoundingBox(page, testId);
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (pane === null) throw new Error('キャンバスの位置を取得できません');
  const from = await emptyPanePoint(page);
  const dx = pane.x + pane.width / 2 - (box.x + box.width / 2);
  const dy = pane.y + pane.height / 2 - (box.y + box.height / 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
  await page.mouse.up();
  const moved = await stableBoundingBox(page, testId);
  await page.mouse.click(moved.x + moved.width / 2, moved.y + moved.height / 2);
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
async function addFileFromMenu(page: Page) {
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (pane === null) throw new Error('キャンバスの位置を取得できません');
  await page.mouse.click(pane.x + pane.width - 20, pane.y + pane.height - 20, { button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'ファイルを追加' }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByTestId('file-src/NewFile.ts')).toBeVisible();
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

test('クラスヘッダーのメニューから別ファイルへ移動でき、Ctrl+Zで戻せる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  const source = page.getByTestId('class-header-OrderService');
  await source.click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  const trigger = menu.getByRole('menuitem', { name: '別のファイルへ移動' });
  await expect(trigger).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toHaveText('別のファイルへ移動');
  await trigger.hover();

  // Act
  await menu.getByRole('menuitem', { name: 'TaxCalculator', exact: true }).click();

  // Assert
  await expect(page.getByTestId('file-src/order/OrderService.ts')).toContainText('0行');
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts')).toContainText('110行');
  await expect(page.getByTestId('context-menu')).toHaveCount(0);

  // Act: Undo
  await page.keyboard.press('Control+z');

  // Assert
  await expect(page.getByTestId('file-src/order/OrderService.ts')).toContainText('108行');
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts')).toContainText('2行');
});

test('クラスヘッダーではShift+F10とTab/Enterでファイルを選んで移動できる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-OrderService').focus();

  // Act
  await page.keyboard.press('Shift+F10');

  // Assert
  const menu = page.getByTestId('context-menu');
  await expect(menu.getByRole('menuitem').first()).toHaveText('別のファイルへ移動');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('file-src/order/OrderService.ts')).toContainText('0行');
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts')).toContainText('110行');
});

test('ファイル・メソッド・余白のメニューにはクラスのファイル移動項目を出さない', async ({ page }) => {
  // Arrange
  await openOrderStage(page);

  // Act & Assert: method
  await page.getByTestId('method-placeOrder').click({ button: 'right' });
  let menu = page.getByTestId('context-menu');
  await expect(menu.getByRole('menuitem', { name: '別のファイルへ移動' })).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: '別のクラスへ移動' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Act & Assert: file
  await page.getByTestId('file-src/order/OrderService.ts').locator('.file-node__header').click({ button: 'right' });
  menu = page.getByTestId('context-menu');
  await expect(menu.getByRole('menuitem', { name: '別のファイルへ移動' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Act & Assert: empty canvas
  const point = await emptyPanePoint(page);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  menu = page.getByTestId('context-menu');
  await expect(menu.getByRole('menuitem', { name: '別のファイルへ移動' })).toHaveCount(0);
});

test('ファイルが1つだけなら移動項目を出さず、Escapeでヘッダーへフォーカスを戻す', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル1: 長いメソッドを分ける' });
  const header = page.getByTestId('class-header-ReportService');
  await header.click({ button: 'right' });

  // Assert: このステージにはファイルが1つだけなので項目自体がない
  const menu = page.getByTestId('context-menu');
  await expect(menu.getByRole('menuitem', { name: '別のファイルへ移動' })).toHaveCount(0);

  // Act: Escapeで閉じる
  await page.keyboard.press('Escape');

  // Assert
  await expect(page.getByTestId('context-menu')).toHaveCount(0);
  await expect(header).toBeFocused();
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

test('ファイルを横並びにドラッグしている最中に依存矢印が左右のハンドルへ切り替わる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await dragMethodToClass(page, 'method-calculateTax', 'class-TaxCalculator');
  const movingFile = page.locator('.react-flow__node[data-id="file-tax-calculator"]');
  const anchorFile = page.locator('.react-flow__node[data-id="file-order-service"]');
  const movingBox = await movingFile.boundingBox();
  const anchorBox = await anchorFile.boundingBox();
  if (movingBox === null || anchorBox === null) throw new Error('ファイルの位置を取得できません');
  const grabX = movingBox.x + 8;
  const grabY = movingBox.y + 8;

  // Act: TaxCalculator を OrderService の右隣へ動かし、離す前に辺を確認する
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX + 20, grabY, { steps: 5 });
  await page.mouse.move(anchorBox.x + anchorBox.width + 48, anchorBox.y, { steps: 12 });

  // Assert: 矢印の両端がsource-rightとtarget-leftハンドルの中心に接続している
  const pathEnds = await page.evaluate<{ start: { x: number; y: number }; end: { x: number; y: number } } | null, undefined>(
    `(() => { const path = document.querySelector('[data-testid="rf__edge-dep-class-order-service-class-tax-calculator"] .react-flow__edge-path'); if (!(path instanceof SVGPathElement)) return null; const matrix = path.getScreenCTM(); if (matrix === null) return null; const start = path.getPointAtLength(0).matrixTransform(matrix); const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix); return { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } }; })()`,
    undefined,
  );
  if (pathEnds === null) throw new Error('矢印の両端を取得できません');
  const sourceHandle = await page.getByTestId('class-OrderService').locator('.class-node__handle--source-right').boundingBox();
  const targetHandle = await page.getByTestId('class-TaxCalculator').locator('.class-node__handle--target-left').boundingBox();
  if (sourceHandle === null || targetHandle === null) throw new Error('接続ハンドルの位置を取得できません');
  expect(Math.abs(pathEnds.start.x - sourceHandle.x - sourceHandle.width / 2)).toBeLessThan(6);
  expect(Math.abs(pathEnds.start.y - sourceHandle.y - sourceHandle.height / 2)).toBeLessThan(6);
  expect(Math.abs(pathEnds.end.x - targetHandle.x - targetHandle.width / 2)).toBeLessThan(6);
  expect(Math.abs(pathEnds.end.y - targetHandle.y - targetHandle.height / 2)).toBeLessThan(6);
  await page.mouse.up();
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
  await expect(page.getByTestId('file-src/order/OrderService.ts').locator('.file-node__path')).toHaveCount(0);
  await expect(page.getByTestId('file-src/order/OrderService.ts')).not.toContainText('行');

  // Act
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom In' }).click();

  // Assert
  await expect(method).toBeVisible();
  await expect(classNode).toContainText('行');
});

test('初期状態の点数は、行数の上限を超えた placeOrder・責務が混ざった OrderService・空の TaxCalculator の分だけ減点されている', async ({
  page,
}) => {
  // Arrange & Act
  await openOrderStage(page);

  // Assert
  await expect(page.getByTestId('score')).toContainText('70点');
  await expect(page.getByTestId('score')).toContainText('行数 -10');
  await expect(page.getByTestId('score')).toContainText('責務の混在 -10');
  await expect(page.getByTestId('score')).toContainText('空のクラス・ファイル -10');
  await expect(page.getByTestId('file-src/order/OrderService.ts').getByTestId('file-mark')).toHaveAttribute('aria-label', /-20点/);
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts').getByTestId('file-mark')).toHaveAttribute('aria-label', /-10点/);
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
  await addFileFromMenu(page);
  await addClassFromMenu(page, 'placeOrder', 'Mailer');
  // クラスノードはファイルノードのDOMの子にならないため、空ファイルの案内の有無で移動先を確かめる
  const emptyFileHint = page.getByText('ここにクラスをドロップ');
  await expect(emptyFileHint).toHaveCount(1);
  const source = page.getByTestId('class-header-Mailer');
  const target = page.getByTestId('file-src/NewFile.ts');
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

test('追加した空ファイルへメソッドをドラッグすると、新しいクラスを作って移す', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await addFileFromMenu(page);
  const method = page.getByTestId('method-placeOrder');
  const target = page.getByTestId('file-src/NewFile.ts');
  const from = await method.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('要素の位置を取得できません');

  // Act
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();

  // Assert
  await expect(page.getByTestId('class-NewClass').getByTestId('method-placeOrder')).toBeVisible();
  await expect(target).toBeVisible();
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
  await expect(menu).not.toContainText('.ts');
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
  await expect(menu.getByRole('menuitem', { name: 'ファイルの名前を変更' })).toHaveCount(0);
  await expect(menu).not.toContainText('.ts');
  await expect(menu.getByRole('menuitem', { name: 'このファイルにクラスを追加' })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'ファイルを追加' }).click();
  await expect(menu).toHaveCount(0);

  // Assert
  await expect(page.getByTestId('file-src/NewFile.ts')).toBeVisible();

  // Act: 続けて追加すると内部名が重複せず、どちらも取り消せる
  const paneAgain = await page.locator('.react-flow__pane').boundingBox();
  if (paneAgain === null) throw new Error('キャンバスの位置を取得できません');
  await page.mouse.click(paneAgain.x + paneAgain.width - 20, paneAgain.y + paneAgain.height - 20, { button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'ファイルを追加' }).click();

  // Assert
  await expect(page.getByTestId('file-src/NewFile2.ts')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('file-src/NewFile2.ts')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('file-src/NewFile.ts')).toHaveCount(0);
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

test('ファイル名は表示も編集もできず、クラス名・メソッド名はその場で変更できる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);

  // Act: ファイルヘッダーをダブルクリックしても入力欄は出ない
  await page.getByTestId('file-src/tax/TaxCalculator.ts').locator('.file-node__header').dblclick();
  await expect(page.getByLabel('ファイルのパス', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts').locator('.file-node__path')).toHaveCount(0);

  // Act: クラス名
  await page.getByTestId('class-header-TaxCalculator').locator('.class-node__name').dblclick();
  const classInput = page.getByLabel('クラス名', { exact: true });
  await classInput.fill('TaxPolicy');
  await classInput.press('Enter');

  // Act: メソッド名
  await page.getByTestId('method-placeOrder').dblclick();
  const methodInput = page.getByLabel('メソッド名', { exact: true });
  await methodInput.fill('placeNewOrder');
  await methodInput.press('Enter');

  // Assert
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts')).toBeVisible();
  await expect(page.getByTestId('class-TaxPolicy')).toBeVisible();
  await expect(page.getByTestId('method-placeNewOrder')).toBeVisible();
});

test('ダブルクリックでの名前変更中にEscapeを押すと、元の名前に戻る', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').locator('.class-node__name').dblclick();
  const input = page.getByLabel('クラス名', { exact: true });

  // Act
  await input.fill('TaxPolicy');
  await input.press('Escape');

  // Assert
  await expect(page.getByTestId('class-TaxCalculator')).toBeVisible();
  await expect(page.getByTestId('class-TaxPolicy')).toHaveCount(0);
});

test('ダブルクリックでの名前変更で重複した名前を入力すると、理由が表示され名前は変わらない', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').locator('.class-node__name').dblclick();
  const input = page.getByLabel('クラス名', { exact: true });

  // Act
  await input.fill('OrderService');
  await input.press('Enter');

  // Assert
  await expect(page.getByRole('alert')).toHaveText('同じ名前のクラスがすでにあります');
  await expect(page.getByTestId('class-TaxCalculator')).toBeVisible();
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

  // Act
  await menu.getByRole('menuitem', { name: 'OrderService', exact: true }).click();

  // Assert
  const edge = page.getByTestId('rf__edge-inherit-class-tax-calculator-class-order-service');
  await expect(edge).toHaveCount(1);
  await expect(edge).toHaveClass(/edge--inheritance/);
  await expect(edge).toHaveClass(/edge--extends/);
  await expect(edge.locator('.react-flow__edge-path')).toHaveAttribute('marker-end', "url('#inheritance-arrow')");
  await expect(page.getByTestId('class-TaxCalculator').locator('.class-node__relation--extends')).toHaveCSS('color', 'rgb(79, 107, 237)');
  await expect(page.getByTestId('class-TaxCalculator')).toContainText('extends OrderService');
  await expect(menu).toHaveCount(0);
});

test('クラスを右クリックして実装するインターフェースを設定すると、"implements"の表示が出る', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '実装するインターフェースを設定' }).click();

  // Act
  await menu.getByRole('menuitemcheckbox', { name: 'OrderService' }).click();

  // Assert
  await expect(page.getByTestId('class-TaxCalculator')).toContainText('implements OrderService');
  await expect(page.getByTestId('class-TaxCalculator')).not.toContainText('extends OrderService');
  const edge = page.getByTestId('rf__edge-inherit-class-tax-calculator-class-order-service');
  await expect(edge).toHaveClass(/edge--inheritance/);
  await expect(edge).toHaveClass(/edge--implements/);
  await expect(edge.locator('.react-flow__edge-path')).toHaveAttribute('marker-end', "url('#implements-arrow')");
  await expect(edge.locator('.react-flow__edge-path')).toHaveCSS('stroke-dasharray', '6px, 4px');
  await expect(page.getByTestId('class-TaxCalculator').locator('.class-node__relation--implements')).toHaveCSS('color', 'rgb(217, 115, 13)');
  // チェック式サブメニューは選んでも閉じない(Esc・外側クリックで閉じる)
  await expect(menu).toHaveCount(1);
  await expect(menu.getByRole('menuitemcheckbox', { name: 'OrderService' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('上級3で3クラスがDiscountStrategyを実装すると、終点が分かれて白抜き三角マーカーが付く', async ({ page }) => {
  // Arrange: 上級3の DiscountService と同じファイルに3つの実装クラスを作る
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '上級3: 会員ランクの割引をStrategyパターンへ組み替える' });
  const classNames = ['RegularDiscount', 'PremiumDiscount', 'VipDiscount'];
  for (const className of classNames) {
    await addClassFromMenu(page, 'calculateDiscount', className);
  }

  // Act: 3クラスそれぞれに共通の実装先を設定する
  for (const className of classNames) {
    await page.getByTestId(`class-header-${className}`).click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await menu.getByRole('menuitem', { name: '実装するインターフェースを設定' }).click();
    await menu.getByRole('menuitemcheckbox', { name: 'DiscountStrategy' }).click();
    await page.keyboard.press('Escape');
  }

  // Assert: 3本ともマーカーを持ち、描画パスの終点xが重ならない
  const edges = page.locator('[data-testid^="rf__edge-inherit-"][data-testid$="-class-discount-strategy"]');
  await expect(edges).toHaveCount(3);
  const endXs: string[] = [];
  for (const edge of await edges.all()) {
    const path = edge.locator('.react-flow__edge-path');
    await expect(path).toHaveAttribute('marker-end', "url('#implements-arrow')");
    const pathData = await path.getAttribute('d');
    const endpoint = pathData?.match(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (endpoint?.[1] === undefined) throw new Error('継承辺の終点を読み取れません');
    endXs.push(endpoint[1]);
  }
  expect(new Set(endXs).size).toBe(3);
  const markerPath = page.locator('#implements-arrow path');
  await expect(markerPath).toHaveCSS('fill', 'rgb(255, 255, 255)');
  await expect(markerPath).toHaveCSS('stroke', 'rgb(217, 115, 13)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(markerPath).toHaveCSS('fill', 'rgb(31, 34, 44)');
  await expect(markerPath).toHaveCSS('stroke', 'rgb(240, 160, 80)');
});

test('1つのクラスに2つのインターフェースを実装すると"implements A, B"と矢印2本が出て、チェックを外すと1つ外れる', async ({ page }) => {
  // Arrange: チュートリアル2には OrderService・TaxCalculator の2クラスしかないので、
  // まず余白にクラスを1つ追加してから、TaxCalculatorに2つとも実装させる
  await openOrderStage(page);
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (pane === null) throw new Error('キャンバスの位置を取得できません');
  await page.mouse.click(pane.x + pane.width - 20, pane.y + pane.height - 20, { button: 'right' });
  let menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'ファイルを追加' }).click();
  await expect(menu).toHaveCount(0);
  await page.getByTestId('file-src/NewFile.ts').click({ button: 'right' });
  menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'このファイルにクラスを追加' }).click();
  await page.getByLabel('追加するクラス名').fill('Extra');
  await page.getByRole('button', { name: '追加' }).click();

  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '実装するインターフェースを設定' }).click();

  // Act(2つ実装する)
  await menu.getByRole('menuitemcheckbox', { name: 'OrderService' }).click();
  await menu.getByRole('menuitemcheckbox', { name: 'Extra' }).click();

  // Assert
  await expect(page.getByTestId('class-TaxCalculator')).toContainText('implements OrderService, Extra');
  await expect(page.locator('[data-testid^="rf__edge-inherit-class-tax-calculator-"]')).toHaveCount(2);

  // Act(1つ外す)
  await menu.getByRole('menuitemcheckbox', { name: 'OrderService' }).click();

  // Assert
  await expect(page.getByTestId('class-TaxCalculator')).toContainText('implements Extra');
  await expect(page.getByTestId('class-TaxCalculator')).not.toContainText('OrderService');
  await expect(page.locator('[data-testid^="rf__edge-inherit-class-tax-calculator-"]')).toHaveCount(1);
});

test('継承元を設定にカーソルを合わせるだけで、クリックしなくても候補のクラス名が右側に表示される', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');

  // Act
  await menu.getByRole('menuitem', { name: '継承元を設定' }).hover();

  // Assert
  await expect(menu.getByRole('menu', { name: '継承元を設定' }).getByRole('menuitem', { name: 'OrderService', exact: true })).toBeVisible();
});

test('継承の輪ができる相手は、継承元の候補一覧から外れる', async ({ page }) => {
  // Arrange: TaxCalculator が OrderService を継承した状態を作る
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: '継承元を設定' }).click();
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'OrderService', exact: true }).click();
  await page.getByTestId('class-header-OrderService').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '継承元を設定' }).click();
  const submenu = menu.getByRole('menu', { name: '継承元を設定' });

  // Act & Assert: OrderService の候補一覧には、輪ができる TaxCalculator が出てこない((解除)だけになる)
  await expect(submenu.getByRole('menuitem')).toHaveText(['(解除)']);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
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

/** 上級2を100点にする: 各ゲートウェイの charge からログ記録を抽出して行数超過を解き、PaymentGateway を実装させる。 */
async function solvePaymentStage(page: Page) {
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '上級2: 決済ゲートウェイをインターフェース越しに呼ぶ' });
  for (const [gateway, log] of [['Stripe', '決済ログを記録する(Stripe)'], ['Paypal', '決済ログを記録する(PayPal)']] as const) {
    await page.getByTestId(`class-${gateway}Gateway`).getByTestId('method-charge').click();
    await page.getByLabel(log).check();
    await page.getByLabel('新しいメソッド名').fill(`log${gateway}Payment`);
    await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
    await page.getByTestId(`class-header-${gateway}Gateway`).click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await menu.getByRole('menuitem', { name: '実装するインターフェースを設定' }).click();
    await menu.getByRole('menuitemcheckbox', { name: 'PaymentGateway' }).click();
    await page.keyboard.press('Escape');
  }
  await expect(page.getByTestId('score')).toContainText('100');
}

/** チュートリアル2の依頼の部品名(依頼の順)。 */
const TAX_PARTS = ['addReducedTaxItems', 'addContactGuide', 'validateQuantityLimit'] as const;

/** 部品を置いたあとの「実装を終える」。ドラッグ直後の1回目のクリックはdnd-kitに握りつぶされることがあるので、次の依頼(か結果)に進むまで押し直す。 */
async function finishRequest(page: Page) {
  await expect(async () => {
    await page.getByTestId('change-request-finish').click({ timeout: 1000 });
    await expect(page.getByTestId('change-part-status').filter({ hasText: 'に置きました' })).toHaveCount(0, { timeout: 1000 });
  }).toPass();
}

/**
 * 変更依頼に挑戦し、依頼ごとに部品を置き先のクラス名(または余白へ出す 'new')へドラッグして「実装を終える」を押す。
 * 挑戦の開始から結果画面までを進める。
 */
async function implementRequests(page: Page, parts: readonly string[], targets: readonly string[]) {
  // ドラッグ直後の1回目のクリックはdnd-kitに握りつぶされることがあるので、パネルが開くまで押し直す
  await expect(async () => {
    await page.getByTestId('change-request-start').click({ timeout: 1000 });
    await expect(page.getByTestId('change-panel')).toBeVisible({ timeout: 1000 });
  }).toPass();
  for (const [index, target] of targets.entries()) {
    const part = `method-${parts[index]}`;
    if (target === 'new') await dragToEmptyCanvas(page, part);
    else await dragMethodToClass(page, part, `class-${target}`);
    await expect(page.getByTestId('change-part-status')).toContainText('に置きました');
    await finishRequest(page);
  }
}

async function readinessOf(page: Page, kind: 'current' | 'initial'): Promise<number> {
  const text = await page.getByTestId(`change-readiness-${kind}`).innerText();
  return Number.parseInt(text, 10);
}

/** 税の計算を抽出して TaxCalculator へ移す(チュートリアル2)。 */
async function extractTaxToCalculator(page: Page) {
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await dragMethodToClass(page, 'method-calculateTax', 'class-TaxCalculator');
  await expect(page.getByTestId('class-TaxCalculator').getByTestId('method-calculateTax')).toBeVisible();
}

/** チュートリアル2を100点にする: 税・保存・メール・在庫検証を抽出し、税は TaxCalculator へ移す。 */
async function reachFullScoreOnOrderStage(page: Page) {
  await extractTaxToCalculator(page);
  for (const [label, name] of [['注文をDBに保存する', 'saveOrder'], ['確認メールを送る', 'sendConfirmationMail'], ['在庫があるか検証する', 'validateStock']] as const) {
    await page.getByTestId('method-placeOrder').click();
    await page.getByLabel(label).check();
    await page.getByLabel('新しいメソッド名').fill(name);
    await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  }
  await expect(page.getByTestId('score')).toContainText('100');
}

test('変更依頼に挑戦すると部品置き場に部品が出て、置くまで「実装を終える」は押せない。置いて終えると、コストと置き方の点数・理由が出る', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await reachFullScoreOnOrderStage(page);

  // Act
  await page.getByTestId('change-request-start').click();

  // Assert(部品は部品置き場にあり、置くまで終えられない)
  await expect(page.getByTestId('change-request-title')).toHaveText('軽減税率の対象を増やして');
  await expect(page.getByTestId('change-request-kind')).toContainText('ルールの変更');
  await expect(page.getByTestId('class-部品置き場').getByTestId('method-addReducedTaxItems')).toBeVisible();
  await expect(page.getByTestId('change-request-finish')).toBeDisabled();
  await expect(page.getByTestId('change-part-status')).toContainText('部品はまだ部品置き場にあります');

  // Act(3件とも OrderService へ置く)
  await dragMethodToClass(page, 'method-addReducedTaxItems', 'class-OrderService');
  await expect(page.getByTestId('change-part-status')).toContainText('OrderService に置きました');
  await expect(page.getByTestId('change-request-finish')).toBeEnabled();
  await finishRequest(page);
  await dragMethodToClass(page, 'method-addContactGuide', 'class-OrderService');
  await finishRequest(page);
  await dragMethodToClass(page, 'method-validateQuantityLimit', 'class-OrderService');
  await finishRequest(page);

  // Assert
  const outcome = page.getByTestId('change-outcome-req-reduced-tax');
  await expect(outcome.getByTestId('outcome-current')).toHaveText('95点');
  await expect(outcome.getByTestId('outcome-sample')).toContainText('解答例:');
  await expect(outcome.getByTestId('outcome-placement')).toContainText('点');
  await expect(page.getByTestId('change-readiness')).toBeVisible();
  await expect(page.getByTestId('change-placement-score')).toBeVisible();
});

test('責務を分けたあとで同じ依頼を受けると、初期状態より変更容易性スコアが高くなる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await reachFullScoreOnOrderStage(page);

  // Act
  await implementRequests(page, TAX_PARTS, ['TaxCalculator', 'OrderService', 'OrderService']);

  // Assert
  const outcome = page.getByTestId('change-outcome-req-reduced-tax');
  await expect(outcome.getByTestId('outcome-current')).toHaveText('95点');
  await expect(outcome.getByTestId('outcome-placement')).toContainText('100点');
  expect(await readinessOf(page, 'current')).toBeGreaterThan(await readinessOf(page, 'initial'));
});

test('結果画面から戻ると、部品置き場は消えてキャンバスは挑戦前の状態のままで、編集を再開できる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await reachFullScoreOnOrderStage(page);
  const lines = page.getByTestId('method-placeOrder').locator('.method-chip__lines');
  const before = await lines.innerText();
  await implementRequests(page, TAX_PARTS, ['OrderService', 'OrderService', 'OrderService']);

  // Act
  await page.getByTestId('change-request-close').click();

  // Assert
  await expect(page.getByTestId('change-panel')).toHaveCount(0);
  await expect(page.getByTestId('class-部品置き場')).toHaveCount(0);
  await expect(page.getByTestId('method-addReducedTaxItems')).toHaveCount(0);
  expect(await lines.innerText()).toBe(before);
  await page.getByTestId('method-placeOrder').click();
  await expect(page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' })).toBeVisible();
});

test('変更依頼の実装中にメソッドへカーソルを合わせると、そのメソッドが何をしているか(処理の一覧)が見える', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await reachFullScoreOnOrderStage(page);
  await page.getByTestId('change-request-start').click();
  const inspect = page.getByTestId('change-inspect');
  await expect(inspect).not.toContainText('消費税を計算する');

  // Act
  await page.getByTestId('method-placeOrder').hover();

  // Assert
  await expect(inspect).toContainText('placeOrder');
  await expect(inspect).toContainText('calculateTax() を呼び出す');
  await expect(inspect).toContainText('sendConfirmationMail() を呼び出す');

  // Act(カーソルを外す)
  await page.getByTestId('class-OrderService').hover({ position: { x: 5, y: 5 } });

  // Assert(消える)
  await expect(inspect).not.toContainText('消費税を計算する');
});

test('変更依頼の結果は、リファクタリングに戻っても手がかりとして残り、直してから再挑戦すると前回の点数と比べられる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await reachFullScoreOnOrderStage(page);
  await implementRequests(page, TAX_PARTS, ['OrderService', 'OrderService', 'OrderService']);

  // Act
  await page.getByTestId('change-request-close').click();

  // Assert(実装中は隠していた変更箇所の印と、前回の減点理由がキャンバスの横に残る)
  await expect(page.getByTestId('change-site-badge').first()).toBeVisible();
  const memo = page.getByTestId('change-memo');
  await expect(memo).toContainText('軽減税率の対象を増やして');
  await expect(memo).toContainText('95点');
  await expect(page.getByTestId('change-request-start')).toHaveText('もう一度挑戦');

  // Act(税の部品を TaxCalculator へ置いて、もう一度挑戦する)
  await implementRequests(page, TAX_PARTS, ['TaxCalculator', 'OrderService', 'OrderService']);

  // Assert
  const outcome = page.getByTestId('change-outcome-req-reduced-tax');
  await expect(outcome.getByTestId('outcome-previous')).toContainText('前回 95点');
});

test('変更依頼の実装中は、前回の変更箇所の印を出さない(答えが見えてしまうため)', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await reachFullScoreOnOrderStage(page);
  await implementRequests(page, TAX_PARTS, ['OrderService', 'OrderService', 'OrderService']);
  await page.getByTestId('change-request-close').click();
  await expect(page.getByTestId('change-site-badge').first()).toBeVisible();

  // Act
  await page.getByTestId('change-request-start').click();

  // Assert
  await expect(page.getByTestId('change-site-badge')).toHaveCount(0);
});

test('実装中に Ctrl+Z で部品が部品置き場に戻る。挑戦をやめると、挑戦前の手を Ctrl+Z で戻せる', async ({ page }) => {
  // Arrange(挑戦前に100点まで直しておく)
  await openOrderStage(page);
  await reachFullScoreOnOrderStage(page);
  await page.getByTestId('change-request-start').click();
  await dragMethodToClass(page, 'method-addReducedTaxItems', 'class-OrderService');
  await expect(page.getByTestId('change-part-status')).toContainText('OrderService に置きました');

  // Act
  await page.keyboard.press('Control+z');

  // Assert(部品が部品置き場に戻る。挑戦前の calculateTax は残る)
  await expect(page.getByTestId('change-part-status')).toContainText('部品はまだ部品置き場にあります');
  await expect(page.getByTestId('class-部品置き場').getByTestId('method-addReducedTaxItems')).toBeVisible();
  await expect(page.getByTestId('method-validateStock')).toBeVisible();

  // Act(やめて、挑戦前の手を戻す)
  await page.getByRole('button', { name: 'やめる' }).click();
  await page.keyboard.press('Control+z');

  // Assert
  await expect(page.getByTestId('method-validateStock')).toHaveCount(0);
});

test('上級2: PayPay の追加は、新しいクラスで PaymentGateway を実装すると100点になり、コストの行は出ない', async ({ page }) => {
  // Arrange
  await solvePaymentStage(page);
  await page.getByTestId('change-request-start').click();
  await expect(page.getByTestId('change-request-kind')).toContainText('機能の追加');

  // Act(1件目: 余白へ出して PaymentGateway を実装する。charge という同名メソッドが他にもあるので部品置き場の中に絞る)
  await dragToEmptyCanvas(page, page.getByTestId('class-部品置き場').getByTestId('method-charge'));
  await page.getByTestId('class-header-NewClass').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '実装するインターフェースを設定' }).click();
  await menu.getByRole('menuitemcheckbox', { name: 'PaymentGateway' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('class-NewClass')).toContainText('implements PaymentGateway');
  await finishRequest(page);
  // 2件目: 余白へ出すだけ(どこからも呼ばれない)
  await dragToEmptyCanvas(page, 'method-logRetryCount');
  await finishRequest(page);
  // 3件目: StripeGateway へ足す
  await page.getByRole('button', { name: 'Fit View' }).click();
  await dragMethodToClass(page, 'method-applyGatewayTimeout', 'class-StripeGateway');
  await finishRequest(page);

  // Assert
  const paypay = page.getByTestId('change-outcome-req-add-paypay');
  await expect(paypay.getByTestId('outcome-placement')).toContainText('100点');
  await expect(paypay.getByTestId('outcome-current')).toHaveCount(0);
  await expect(paypay.getByTestId('outcome-sample')).toContainText('PaymentGateway を実装する新しいクラス');
  await paypay.getByTestId('outcome-sample-preview').click();
  await expect(page.getByTestId('codebase-preview')).toContainText('解答例の図');
  await expect(page.getByTestId('change-outcome-req-payment-logging')).toContainText('未接続');
});

test('依頼1で作った新しいクラスは、依頼2のキャンバスにも残っている(依頼は連続して改修する)', async ({ page }) => {
  // Arrange
  await solvePaymentStage(page);
  await page.getByTestId('change-request-start').click();

  // Act(1件目: 余白へ出して新しいクラスを作り、終える。charge という同名メソッドが他にもあるので部品置き場の中に絞る)
  await dragToEmptyCanvas(page, page.getByTestId('class-部品置き場').getByTestId('method-charge'));
  await expect(page.getByTestId('class-NewClass')).toBeVisible();
  await finishRequest(page);

  // Assert(2件目のキャンバスに、1件目で作ったクラスとメソッドが残っている)
  await expect(page.getByTestId('change-request-title')).not.toHaveText('PayPayでも払えるようにして');
  await expect(page.getByTestId('class-NewClass').getByTestId('method-charge')).toBeVisible();
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

/** 要素をつかんで、キャンバスの右下の余白(どのファイルの枠外)へドラッグして離す。testIdの文字列か、絞り込み済みのLocatorを渡せる。 */
async function dragToEmptyCanvas(page: Page, target: string | Locator) {
  const locator = typeof target === 'string' ? page.getByTestId(target) : target;
  const from = await locator.boundingBox();
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (from === null || pane === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Fit View' }).click();
}

async function dragToCanvasPoint(page: Page, target: string | Locator, x: number, y: number) {
  const locator = typeof target === 'string' ? page.getByTestId(target) : target;
  const from = await locator.boundingBox();
  if (from === null) throw new Error('ドラッグ元の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(x, y, { steps: 15 });
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

test('メソッドを余白の指定位置へドロップすると、その位置にファイルが現れる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const panStart = await emptyPanePoint(page);
  await page.mouse.move(panStart.x, panStart.y);
  await page.mouse.down();
  await page.mouse.move(panStart.x + 80, panStart.y + 50, { steps: 8 });
  await page.mouse.up();
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (pane === null) throw new Error('キャンバスの位置を取得できません');
  const drop = { x: pane.x + pane.width - 20, y: pane.y + pane.height - 20 };

  // Act
  await dragToCanvasPoint(page, 'method-placeOrder', drop.x, drop.y);

  // Assert
  const file = page.getByTestId('file-src/NewClass.ts');
  await expect(file).toBeVisible();
  const bounds = await file.boundingBox();
  expect(bounds).not.toBeNull();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - drop.x)).toBeLessThanOrEqual(60);
  expect(Math.abs(bounds!.y + 18 - drop.y)).toBeLessThanOrEqual(12);

  // Act: UndoしてからRedoする
  await page.keyboard.press('Control+z');
  await expect(file).toBeHidden();
  await page.keyboard.press('Control+y');

  // Assert: 同じ位置に戻る
  await expect(file).toBeVisible();
  const restored = await file.boundingBox();
  expect(restored).not.toBeNull();
  expect(Math.abs(restored!.x + restored!.width / 2 - drop.x)).toBeLessThanOrEqual(60);
  expect(Math.abs(restored!.y + 18 - drop.y)).toBeLessThanOrEqual(12);
});

test('クラスを余白の指定位置へドロップすると、新しいファイルがその位置に現れる', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  const drop = await emptyPanePoint(page);

  // Act
  await dragToCanvasPoint(page, 'class-header-TaxCalculator', drop.x, drop.y);

  // Assert
  const file = page.getByTestId('file-src/TaxCalculator.ts');
  await expect(file).toBeVisible();
  const bounds = await file.boundingBox();
  expect(bounds).not.toBeNull();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - drop.x)).toBeLessThanOrEqual(60);
  expect(Math.abs(bounds!.y + 18 - drop.y)).toBeLessThanOrEqual(12);
});

test('越境した private メソッドの呼び出しは減点され、呼び出し元のクラスへ Move Method すると解消する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '中級3: 越境する private メソッド' });
  await expect(page.getByRole('heading', { name: '中級3: 越境する private メソッド' })).toBeVisible();
  await expect(page.getByTestId('score')).toContainText('70点');
  await expect(page.getByTestId('score')).toContainText('行数 -10');
  await expect(page.getByTestId('score')).toContainText('アクセス制御 -10');
  await expect(page.getByTestId('score')).toContainText('結合度 -10');

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
  // 結合度の減点行が増えた分キャンバスが縦に伸びるので、ドラッグ元がビューポートの外に出ないようFit Viewで収める
  const source = page.getByTestId('method-renderTemplate');
  const target = page.getByTestId('class-NotificationService');
  await expect(async () => {
    await page.getByRole('button', { name: 'Fit View' }).click();
    await expect(source).toBeInViewport();
  }).toPass();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();

  // Assert: 移し終えた TemplateEngine は空のクラスとして減点される
  await expect(target.getByTestId('method-renderTemplate')).toBeVisible();
  await expect(page.getByTestId('score')).toContainText('90点');
  await expect(page.getByTestId('score')).toContainText('空のクラス・ファイル -10');

  // Act: 空になった TemplateEngine.ts を右クリックで削除する
  await page.getByTestId('file-src/notification/TemplateEngine.ts').click({ button: 'right', position: { x: 10, y: 10 } });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'ファイルを削除' }).click();

  // Assert
  await expect(page.getByTestId('score')).toContainText('100点');
});

test('中級3: renderTemplate を public にするとアクセス制御の減点は消えるが、依存が残るので満点にならない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '中級3: 越境する private メソッド' });
  const score = page.getByTestId('score');
  await expect(score).toContainText('70点');
  await expect(score).toContainText('アクセス制御 -10');
  await expect(score).toContainText('結合度 -10');

  // Act: renderTemplate の可視性の選択欄を開き、protected は選べないことを確かめる
  await page.getByTestId('method-renderTemplate').click();
  const select = page.getByLabel('メソッド renderTemplate の可視性');
  await expect(select).toBeVisible();
  // <option> は toBeDisabled() の対象外(Playwright は disabled を持つ要素を button/input/select などに限る)なので、プロパティで確かめる
  await expect(select.locator('option[value="protected"]')).toHaveJSProperty('disabled', true);

  // Act: キーボードでフォーカスし、ArrowUpでpublicにする(disabledのprotectedを飛ばす)
  await select.focus();
  await select.press('ArrowUp');

  // Assert
  await expect(select).toHaveValue('public');
  await expect(score).not.toContainText('アクセス制御');
  await expect(score).toContainText('結合度 -10');
  await expect(score).not.toContainText('100点');

  // Act: 選択欄からフォーカスを外してCtrl+Z(選択欄にフォーカスがあるとCtrl+Zはブラウザ標準が優先される)
  await page.getByTestId('method-renderTemplate').click();
  await page.keyboard.press('Control+z');

  // Assert
  await expect(score).toContainText('アクセス制御 -10');
});

test('上級8: upload を private にした後、ステージ開始時の public に戻せる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '上級8: 取り込みの手順を Template Method にまとめる' });
  await page.getByTestId('method-upload').click();
  const visibility = page.getByLabel('メソッド upload の可視性');

  // Act
  await visibility.selectOption('private');

  // Assert
  await expect(visibility.locator('option[value="public"]')).toHaveJSProperty('disabled', false);

  // Act
  await visibility.selectOption('public');

  // Assert
  await expect(visibility).toHaveValue('public');
});

test('中身のないメソッドには可視性の選択が出ない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '上級6: 太ったインターフェースを役割ごとに分ける' });
  const postMessage = page.getByTestId('class-CollaborationTool').getByTestId('method-postMessage');
  await expect(async () => {
    await page.getByRole('button', { name: 'Zoom In' }).click();
    await expect(postMessage).toBeVisible({ timeout: 500 });
  }).toPass();

  // Act
  await postMessage.click();

  // Assert
  await expect(page.getByLabel('メソッド postMessage の可視性')).toHaveCount(0);
});

test('上級1ステージ: 重複した送信ログ記録処理をExtract Methodで取り出し統合すると、メソッドが1つになる', async ({ page }) => {
  // Arrange: EmailNotifier・SmsNotifierそれぞれから「送信ログを記録する」処理を抽出する
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '上級1: 通知クラスの共通処理を基底クラスへ集める' });
  await page.getByTestId('method-notifyByEmail').click();
  await page.getByLabel('送信ログを記録する').check();
  await page.getByLabel('新しいメソッド名').fill('logEmailNotification');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await page.getByTestId('method-notifyBySms').click();
  await page.getByLabel('送信ログを記録する').check();
  await page.getByLabel('新しいメソッド名').fill('logSmsNotification');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Act: logEmailNotificationを選び、統合候補としてlogSmsNotificationが出るので統合する
  await page.getByTestId('method-logEmailNotification').click();
  const candidate = page.getByTestId('merge-candidate-logSmsNotification');
  await expect(candidate).toBeVisible();
  await page.getByLabel('統合後のメソッド名').fill('logNotification');
  await candidate.click();

  // Assert
  await expect(page.getByTestId('method-logEmailNotification')).toHaveCount(0);
  await expect(page.getByTestId('method-logSmsNotification')).toHaveCount(0);
  await expect(page.getByTestId('class-EmailNotifier').getByTestId('method-logNotification')).toBeVisible();
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
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'NotifierBase', exact: true }).click();

  // Assert
  await expect(target.getByTestId('method-buildEmailBody')).toBeVisible();
  const edge = page.getByTestId('rf__edge-inherit-class-email-notifier-class-notifier-base');
  await expect(edge).toHaveCount(1);
  await expect(page.getByTestId('class-EmailNotifier')).toContainText('extends NotifierBase');
});

test('上級5: 子が1つだけの継承は減点され、右クリックメニューから継承を解除すると減点が消える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '上級5: 子が1つしかない継承を畳む' });
  const score = page.getByTestId('score');
  await expect(score).toContainText('子が1つだけの継承 -10');
  await page.getByTestId('class-header-CsvExporter').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '継承元を設定' }).click();

  // Act
  await menu.getByRole('menuitem', { name: '(解除)' }).click();

  // Assert
  await expect(page.getByTestId('class-CsvExporter')).not.toContainText('extends BaseExporter');
  await expect(score).not.toContainText('子が1つだけの継承');
});

test('上級6: 空実装を削除するとまだ要求しているインターフェースへの約束違反になり、取り消すと戻る。実装の宣言を外すと宣言漏れになる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '上級6: 太ったインターフェースを役割ごとに分ける' });
  const score = page.getByTestId('score');
  await expect(score).toContainText('使わないメソッドの空実装 -50');
  // クラスが多くfitViewの倍率が小さいので、メソッドが見える倍率までズームインする(回数はレイアウトしだいなので決め打ちしない)
  const slackPostMessage = page.getByTestId('class-SlackClient').getByTestId('method-postMessage');
  await expect(async () => {
    await page.getByRole('button', { name: 'Zoom In' }).click();
    await expect(slackPostMessage).toBeVisible({ timeout: 500 });
  }).toPass();

  // Act: 中身のあるメソッド(SlackClient.postMessage)には削除ボタンが出ない
  await slackPostMessage.click();

  // Assert
  await expect(page.getByRole('button', { name: '空実装のメソッドを削除' })).toHaveCount(0);

  // Act: 空実装(BacklogClient.postMessage)は削除でき、実装漏れ(約束違反)になる
  await page.getByTestId('class-BacklogClient').getByTestId('method-postMessage').click();
  await page.getByRole('button', { name: '空実装のメソッドを削除' }).click();

  // Assert
  await expect(page.getByTestId('class-BacklogClient').getByTestId('method-postMessage')).toHaveCount(0);
  await expect(score).toContainText('使わないメソッドの空実装 -40');
  await expect(score).toContainText('インターフェースの約束違反 -10');

  // Act: Ctrl+Zで削除前に戻す
  await page.keyboard.press('Control+z');

  // Assert
  await expect(page.getByTestId('class-BacklogClient').getByTestId('method-postMessage')).toBeVisible();
  await expect(score).toContainText('使わないメソッドの空実装 -50');
  await expect(score).not.toContainText('インターフェースの約束違反');

  // Act: BacklogClientの実装の宣言を外す(宣言漏れになる)
  await page.getByTestId('class-header-BacklogClient').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '実装するインターフェースを設定' }).click();
  await expect(menu.getByRole('menuitemcheckbox', { name: 'CollaborationTool' })).toHaveAttribute('aria-checked', 'true');
  await menu.getByRole('menuitemcheckbox', { name: 'CollaborationTool' }).click();

  // Assert
  await expect(page.getByTestId('class-BacklogClient')).not.toContainText('implements CollaborationTool');
  await expect(score).toContainText('インターフェースの約束違反 -10');
});

test('中級6: フィールドをドラッグで別クラスへ移すと移り、Ctrl+Zで戻る', async ({ page }) => {
  // Arrange
  await openFeatureEnvyStage(page);
  await expect(page.getByTestId('score')).toContainText('他クラスのデータを触りすぎ(Feature Envy) -20');
  await expect(page.getByTestId('score')).toContainText('カプセル化の破れ -20');
  const source = page.getByTestId('field-trialDays');
  const target = page.getByTestId('class-Subscription');
  await expect(source).toBeVisible();

  // Act
  await dragMethodToClass(page, 'field-trialDays', 'class-Subscription');

  // Assert
  await expect(target.getByTestId('field-trialDays')).toBeVisible();
  await expect(page.getByTestId('class-BillingService').getByTestId('field-trialDays')).toHaveCount(0);

  // Act: Ctrl+Zで削除前に戻す
  await page.keyboard.press('Control+z');

  // Assert
  await expect(page.getByTestId('class-BillingService').getByTestId('field-trialDays')).toBeVisible();
});

test('中級6: メソッドだけ移すと循環依存になり、使うフィールドも移すと消える', async ({ page }) => {
  // Arrange
  await openFeatureEnvyStage(page);

  // Act
  await page.getByTestId('method-renewSubscription').click();

  // Assert
  await expect(page.getByText('読む: Subscription.startedAt')).toBeVisible();
  await expect(page.getByText('BillingService.trialDays')).toBeVisible();

  // Act: 「トライアル期間中なら請求しない」を抽出する
  await page.getByLabel('トライアル期間中なら請求しない').check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const cyclicMark = page.getByTestId('class-Subscription').getByTestId('cyclic-mark');
  await expect(cyclicMark).toHaveCount(0);

  // Act: isInTrial だけを Subscription へ移す
  await dragMethodToClass(page, 'method-isInTrial', 'class-Subscription');

  // Assert(フィールドを置き去りにしたので循環依存になる)
  await expect(cyclicMark).toBeVisible();

  // Act: 使うフィールド trialDays も Subscription へ移す
  await dragMethodToClass(page, 'field-trialDays', 'class-Subscription');

  // Assert(循環依存が消える)
  await expect(cyclicMark).toHaveCount(0);
});

test('中級6: フィールドを持つクラスは削除できない', async ({ page }) => {
  // Arrange
  await openFeatureEnvyStage(page);
  await page.getByTestId('class-header-Subscription').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');

  // Act
  await menu.getByRole('menuitem', { name: 'クラスを削除' }).click();

  // Assert
  await expect(page.getByRole('alert')).toHaveText('フィールドを持つクラスは削除できません。先にフィールドを別のクラスへ移してください');
  await expect(page.getByTestId('class-Subscription')).toBeVisible();
});

test('中級7: setter 越しの書き換えが見え、ルールを移して可視性を直すと減点が消える', async ({ page }) => {
  // Arrange
  await openAnemicDomainModelStage(page);
  const score = page.getByTestId('score');
  await expect(score).toContainText('カプセル化の破れ -20');
  const withdraw = page.getByTestId('method-withdraw');
  await expect(async () => {
    await page.getByRole('button', { name: 'Zoom In' }).click();
    await expect(withdraw).toBeVisible({ timeout: 500 });
  }).toPass();

  // Act: withdraw の中身を見ると setter 経由の書き換えが分かる
  await withdraw.click();
  await expect(page.getByText('setter 経由で書く: Account.balance')).toBeVisible();

  // Act: 3つの処理を選んで debit として抽出し、Account へ移す
  await page.getByLabel('getStatus() で状態を取り出し、凍結されていないか確かめる').check();
  await page.getByLabel('残高と1日の引き出し上限から引き出せるか確かめる').check();
  await page.getByLabel('残高を減らし、本日の引き出し額を足して setter で書き戻す').check();
  await page.getByLabel('新しいメソッド名').fill('debit');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await dragMethodToClass(page, 'method-debit', 'class-Account');

  // Assert: 移した直後は private のままなのでアクセス制御の違反が出る
  await expect(score).toContainText('アクセス制御');

  // Act: debit をキーボードで public にする
  const debitSelect = page.getByLabel('メソッド debit の可視性');
  await clickInCanvas(page, 'method-debit');
  await expect(debitSelect).toBeVisible();
  await debitSelect.focus();
  await debitSelect.press('ArrowUp');

  // Assert
  await expect(debitSelect).toHaveValue('public');
  await expect(score).not.toContainText('アクセス制御');

  // Act: deposit からも credit を抽出して Account へ移し、public にする
  await clickInCanvas(page, 'method-deposit');
  await page.getByLabel('getStatus() で状態を取り出し、凍結されていないか確かめる').check();
  await page.getByLabel('残高を増やして setBalance() で書き戻す').check();
  await page.getByLabel('新しいメソッド名').fill('credit');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await dragMethodToClass(page, 'method-credit', 'class-Account');
  const creditSelect = page.getByLabel('メソッド credit の可視性');
  await clickInCanvas(page, 'method-credit');
  await expect(creditSelect).toBeVisible();
  await creditSelect.focus();
  await creditSelect.press('ArrowUp');

  // Act: setBalance・setDailyWithdrawn を private にする
  await clickInCanvas(page, 'method-setBalance');
  await page.getByLabel('メソッド setBalance の可視性').selectOption('private');
  await clickInCanvas(page, 'method-setDailyWithdrawn');
  await page.getByLabel('メソッド setDailyWithdrawn の可視性').selectOption('private');

  // Assert
  await expect(score).not.toContainText('カプセル化の破れ');
});

test('中級8: 住所のフィールドとメソッドを新しいクラスへ移すと、凝集度の減点が消える', async ({ page }) => {
  // Arrange
  await openExtractClassStage(page);
  const score = page.getByTestId('score');
  await expect(score).toContainText('無関係なデータの塊が同居(凝集度が低い) -10');

  // Act: Employeeの右クリックメニューからAddressクラスを追加する
  await page.getByTestId('class-header-Employee').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'このファイルにクラスを追加' }).click();
  await menu.getByLabel('追加するクラス名').fill('Address');
  await menu.getByLabel('追加するクラス名').press('Enter');
  await expect(page.getByTestId('class-Address')).toBeVisible();

  // Act: 住所の3フィールドと2メソッドをAddressへドラッグする
  await dragMethodToClass(page, 'field-postalCode', 'class-Address');
  await dragMethodToClass(page, 'field-prefecture', 'class-Address');
  await dragMethodToClass(page, 'field-addressLine', 'class-Address');
  await dragMethodToClass(page, 'method-formatMailingAddress', 'class-Address');
  await dragMethodToClass(page, 'method-changeAddress', 'class-Address');

  // Assert
  await expect(score).not.toContainText('無関係なデータの塊が同居(凝集度が低い)');
});

for (const kind of ['method', 'field']) {
  test(`移動メニュー: ${kind}を右クリックして移動し、Ctrl+Zで戻せる`, async ({ page }) => {
    // Arrange
    await openFeatureEnvyStage(page);
    const chipId = kind === 'method' ? 'method-renewSubscription' : 'field-trialDays';
    const source = page.getByTestId('class-BillingService');
    const target = page.getByTestId('class-Subscription');
    const chip = source.getByTestId(chipId);

    // Act
    await chip.click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await expect(menu.getByRole('menuitem').first()).toHaveText('別のクラスへ移動');
    const candidates = menu.getByRole('menu', { name: '別のクラスへ移動', exact: true });
    await expect(candidates.getByRole('menuitem', { name: 'BillingService' })).toHaveCount(0);
    await expect(candidates.getByRole('menuitem', { name: '新しいクラスへ移動' })).toHaveCount(0);
    await candidates.getByRole('menuitem', { name: 'Subscription', exact: true }).click();

    // Assert
    await expect(menu).toHaveCount(0);
    await expect(target.getByTestId(chipId)).toBeVisible();
    await expect(source.getByTestId(chipId)).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(source.getByTestId(chipId)).toBeVisible();
  });

  test(`移動メニュー: ${kind}をShift+F10とTab/Enterだけで移動できる`, async ({ page }) => {
    // Arrange
    await openFeatureEnvyStage(page);
    const chipId = kind === 'method' ? 'method-renewSubscription' : 'field-trialDays';
    const chip = page.getByTestId(chipId);
    await chip.focus();

    // Act
    await chip.press('Shift+F10');
    const menu = page.getByTestId('context-menu');
    await expect(menu.getByRole('menuitem', { name: '別のクラスへ移動' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('menuitem', { name: 'Subscription', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');

    // Assert
    await expect(menu).toHaveCount(0);
    await expect(page.getByTestId('class-Subscription').getByTestId(chipId)).toBeVisible();
  });
}

test('移動メニュー: Escapeと外側クリックで開く前のチップにフォーカスを戻す', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  const chip = page.getByTestId('method-placeOrder');
  await chip.focus();

  // Act
  await chip.press('Shift+F10');
  await expect(page.getByTestId('context-menu')).toBeVisible();
  await page.keyboard.press('Escape');

  // Assert
  await expect(page.getByTestId('context-menu')).toHaveCount(0);
  await expect(chip).toBeFocused();

  // Act
  await chip.press('Shift+F10');
  await expect(page.getByTestId('context-menu')).toBeVisible();
  await page.getByLabel('ステージ').click();

  // Assert
  await expect(page.getByTestId('context-menu')).toHaveCount(0);
  await expect(chip).toBeFocused();
});

test('移動メニュー: クラス・ファイル・余白では移動項目を出さない', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  const menu = page.getByTestId('context-menu');

  for (const target of [
    page.getByTestId('class-TaxCalculator').locator('.class-node__header'),
    page.locator('.file-node__header').first(),
    page.locator('.react-flow__pane'),
  ]) {
    // Act
    // キャンバス左端にはサイドバー開閉ハンドルが重なるため、その右側を使う。
    await target.click({ button: 'right', position: { x: 30, y: 5 } });

    // Assert
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '別のクラスへ移動' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
});

test('移動メニュー: 候補が0件でも表示された先頭項目にフォーカスする', async ({ page }) => {
  // Arrange
  await page.goto('/');
  const chip = page.getByTestId('method-printMonthlyReport');
  await chip.focus();

  // Act
  await chip.press('Shift+F10');

  // Assert
  const menu = page.getByTestId('context-menu');
  await expect(menu.getByRole('menuitem', { name: '別のクラスへ移動' })).toHaveCount(0);
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(chip).toBeFocused();
});

test('移動メニュー: 開き直したメニューに古いフォーカス復帰が干渉しない', async ({ page }) => {
  // Arrange
  await openFeatureEnvyStage(page);
  const method = page.getByTestId('method-renewSubscription');
  await method.focus();
  await method.press('Shift+F10');
  const menu = page.getByTestId('context-menu');
  await expect(menu.getByRole('menuitem', { name: '別のクラスへ移動' })).toBeFocused();

  // Act
  await page.getByTestId('field-trialDays').click({ button: 'right' });
  // フォーカス復帰が予約されるフレームを確実に過ぎてから検証する。
  await page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');

  // Assert
  await expect(menu.getByRole('menuitem', { name: '別のクラスへ移動' })).toBeFocused();
  await expect(menu.getByRole('menu', { name: '別のクラスへ移動', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('class-Subscription').getByTestId('field-trialDays')).toBeVisible();
});

test('上級8: 呼び出しだけの importOrders を似た処理を持つメソッドから統合する', async ({ page }) => {
  // Arrange: 各形式の4手順を抽出する
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption('advanced-template-method');
  for (const [owner, parseLabel] of [
    ['CsvOrderImporter', 'CSVの列を注文データに変換する'],
    ['JsonOrderImporter', 'JSONの項目を注文データに変換する'],
  ]) {
    for (const [label, name] of [
      ['ファイルを開いて1行ずつ読み込む', 'readLines'],
      ['必須項目と金額を検証する', 'validateOrders'],
      ['注文をまとめて保存する', 'saveOrders'],
      [parseLabel, 'parse'],
    ]) {
      await page.getByTestId(`class-${owner}`).getByTestId('method-importOrders').click();
      await page.getByLabel(label).check();
      await page.getByLabel('新しいメソッド名').fill(name);
      await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
    }
  }
  for (const name of ['readLines', 'validateOrders', 'saveOrders']) {
    await page.getByTestId('class-CsvOrderImporter').getByTestId(`method-${name}`).click();
    await page.getByLabel('統合後のメソッド名').fill(name);
    await page.getByTestId(`merge-candidate-${name}`).click();
  }
  for (const owner of ['CsvOrderImporter', 'JsonOrderImporter']) {
    await page.getByTestId(`class-header-${owner}`).click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await menu.getByRole('menuitem', { name: '継承元を設定' }).click();
    await menu.getByRole('menuitem', { name: 'OrderImporter', exact: true }).click();
    await page.getByTestId(`class-${owner}`).getByTestId('method-parse').click();
    await page.getByLabel('メソッド parse の可視性').selectOption('protected');
  }

  // Act
  await page.getByTestId('class-CsvOrderImporter').getByTestId('method-importOrders').click();
  await expect(page.getByText('似た処理を持つメソッド', { exact: true })).toBeVisible();
  await page.getByLabel('統合後のメソッド名').fill('importOrders');
  await page.getByTestId('merge-candidate-importOrders').click();

  // Assert: public を保持し、共通の骨組みが1つになる
  await expect(page.getByTestId('method-importOrders')).toHaveCount(1);
  await expect(page.getByLabel('メソッド importOrders の可視性')).toHaveValue('public');
  for (const name of ['importOrders', 'readLines', 'validateOrders', 'saveOrders']) {
    await page.getByTestId(`method-${name}`).click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await menu.getByRole('menuitem', { name: 'OrderImporter', exact: true }).click();
    await expect(page.getByTestId('class-OrderImporter').getByTestId(`method-${name}`)).toBeVisible();
  }
  await expect(page.getByTestId('score')).toContainText('100点');
});
