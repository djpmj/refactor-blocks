import { expect, test, type Locator, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

/** 白紙設計の画面(リファクタリング画面にも同じtestidが出ることがあるので、この中だけを見る)。 */
function blankView(page: Page): Locator {
  return page.getByTestId('blank-view');
}

async function openBlank(page: Page) {
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
}

/**
 * 直前の操作でキャンバスのレイアウトが再計算され続けている間に座標を読むと、
 * 古い位置へドラッグしてしまい失敗することがある(連続でMove Methodするときに発生)。
 * 位置が2回連続で同じになるまで待ってから返す。
 */
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

/** 直前に作ったファイルへ表示が寄っていることがあるので、全体を表示し、メソッドが見える大きさに戻す。 */
async function showAllWithDetails(page: Page, view: Locator) {
  await page.getByRole('button', { name: 'Fit View' }).click();
  // 倍率の更新は少し遅れて案内に反映されるので、出るのを待つ(出なければ、すでにメソッドが見える大きさ)
  await view.getByRole('button', { name: '中身が見える大きさにする' }).click({ timeout: 700 }).catch(() => undefined);
}

/** キャンバスの四隅のうち、どのファイルの枠にも覆われていない所を返す(自動で全体が収まるので、どの隅が空くかは配置で変わる)。 */
async function findEmptyCorner(page: Page, pane: { x: number; y: number; width: number; height: number }) {
  const corners = [
    { x: pane.x + pane.width - 30, y: pane.y + pane.height - 30 },
    { x: pane.x + 30, y: pane.y + pane.height - 30 },
    { x: pane.x + pane.width - 30, y: pane.y + 30 },
    { x: pane.x + 30, y: pane.y + 30 },
  ];
  for (const corner of corners) {
    const hit = await page.evaluate(`(({ x, y }) => document.elementFromPoint(x, y)?.closest('.file-node') !== null)(${JSON.stringify(corner)})`);
    if (hit === false) return corner;
  }
  throw new Error('ファイルの枠外の余白が見つかりません');
}

/** 要素をつかんで、キャンバスの余白(どのファイルの枠外)へドラッグして離す。 */
async function dragToEmptyCanvas(page: Page, view: Locator, testId: string) {
  await showAllWithDetails(page, view);
  const from = await stableBoundingBox(page, view.getByTestId(testId));
  const pane = await stableBoundingBox(page, view.locator('.react-flow__pane'));
  const target = await findEmptyCorner(page, pane);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(target.x, target.y, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** ドラッグ操作(Move Method)で、あるメソッドを別クラスへ移す。 */
async function dragMethodToClass(page: Page, view: Locator, methodTestId: string, classTestId: string) {
  await showAllWithDetails(page, view);
  const from = await stableBoundingBox(page, view.getByTestId(methodTestId));
  const to = await stableBoundingBox(page, view.getByTestId(classTestId));
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

const ALL_PARTS = [
  'placeOrder',
  'shipOrder',
  'calculateOrderTax',
  'saveOrder',
  'updateShippingStatus',
  'sendOrderConfirmMail',
  'sendShippedMail',
] as const;

/** 7つの部品をすべて、余白に作った1つのクラスへまとめて配置する(点数は問わず、答え合わせを試すためだけの配置)。 */
async function placeAllParts(page: Page, view: Locator) {
  const initialPart = 'placeOrder';
  await dragToEmptyCanvas(page, view, `method-${initialPart}`);
  await page.getByRole('button', { name: 'Fit View' }).click();
  for (const name of ALL_PARTS.slice(1)) {
    const initialClass = view.locator('.class-node').filter({ has: page.getByTestId(`method-${initialPart}`) });
    await dragMethodToClass(page, view, `method-${name}`, await initialClass.getAttribute('data-testid') ?? '');
  }
}

test('「白紙設計」に切り替えると、要求文と部品置き場の7つの部品が表示され、答え合わせは押せない', async ({ page }) => {
  // Arrange & Act
  await openBlank(page);

  // Assert
  const view = blankView(page);
  await expect(view.getByTestId('blank-requirement')).toContainText('注文と発送');
  for (const name of ALL_PARTS) {
    await expect(view.getByTestId(`method-${name}`)).toBeVisible();
  }
  await expect(view.getByTestId('blank-unplaced')).toContainText('あと7個');
  await expect(view.getByTestId('blank-review')).toBeDisabled();
  await expect(view.getByTestId('blank-review')).toHaveAttribute('aria-describedby', 'blank-review-disabled-reason');
  await expect(view.getByTestId('blank-review-disabled-reason')).toHaveText(
    `答え合わせは、部品置き場の部品をすべてクラスへ置くと押せます。まだ置いていない部品: ${ALL_PARTS.join('、')}`,
  );
});

test('部品を1つ空いている所へドラッグすると、新しいクラスにその部品が入り、未配置が「あと6個」になる', async ({ page }) => {
  // Arrange
  await openBlank(page);
  const view = blankView(page);

  // Act
  await dragToEmptyCanvas(page, view, 'method-placeOrder');

  // Assert
  await expect(view.getByTestId('class-OrderService').getByTestId('method-placeOrder')).toBeVisible();
  await expect(view.getByTestId('blank-unplaced')).toContainText('あと6個');
  await expect(view.getByTestId('blank-review-disabled-reason')).toHaveText(
    `答え合わせは、部品置き場の部品をすべてクラスへ置くと押せます。まだ置いていない部品: ${ALL_PARTS.slice(1).join('、')}`,
  );
});

test('白紙設計では本体のあるメソッドを選ぶと可視性欄が表示される', async ({ page }) => {
  // Arrange
  await openBlank(page);
  const view = blankView(page);
  await dragToEmptyCanvas(page, view, 'method-placeOrder');

  // Act
  await view.getByTestId('method-placeOrder').click();

  // Assert
  await expect(view.getByLabel('メソッド placeOrder の可視性')).toBeVisible();
});

test('白紙設計の新しいクラスは部品の責務で命名し、同数行では先に入れた責務名を保つ', async ({ page }) => {
  // Arrange
  await openBlank(page);
  const view = blankView(page);

  // Act: 注文フローを配置し、別の余白へ保存4行を配置する
  await dragToEmptyCanvas(page, view, 'method-placeOrder');
  await expect(view.getByTestId('class-OrderService')).toBeVisible();
  await expect(view.locator('.drag-overlay')).toHaveCount(0);
  await expect(view.getByTestId('method-saveOrder')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Fit View' }).click();
  const methodLocator = view.getByTestId('method-saveOrder');
  await expect(methodLocator).toHaveCSS('opacity', '1');
  const method = await stableBoundingBox(page, methodLocator);
  const pane = await stableBoundingBox(page, view.locator('.react-flow__pane'));
  const emptyPoint = { x: pane.x + pane.width - 30, y: pane.y + pane.height - 30 };
  const hitTarget = await page.evaluate(`(({ x, y }) => {
    const fileNode = document.elementFromPoint(x, y)?.closest('.file-node');
    return fileNode?.getAttribute('data-testid') ?? null;
  })(${JSON.stringify(emptyPoint)})`);
  if (hitTarget !== null) throw new Error(`ドロップ先が余白ではありません: ${hitTarget}`);
  await page.mouse.move(method.x + method.width / 2, method.y + method.height / 2);
  await page.mouse.down();
  await page.mouse.move(method.x + method.width / 2 + 20, method.y + method.height / 2, { steps: 5 });
  await page.mouse.move(emptyPoint.x, emptyPoint.y, { steps: 15 });
  await page.mouse.up();

  // Assert
  await expect(view.getByTestId('class-OrderRepository').getByTestId('method-saveOrder')).toBeVisible();

  // Act: メール3行を配置する
  await dragToEmptyCanvas(page, view, 'method-sendOrderConfirmMail');
  await expect(view.getByTestId('class-OrderMailer')).toBeVisible();

  // Act: 3行の税処理をメールのクラスへ加える
  await dragMethodToClass(page, view, 'method-calculateOrderTax', 'class-OrderMailer');
  await expect(view.getByTestId('class-OrderMailer').getByTestId('method-calculateOrderTax')).toBeVisible();

  // Assert: 同数行なら先に入っていた通知の責務名を保つ
  await expect(view.getByTestId('class-OrderMailer')).toBeVisible();

  // Act: 右クリックの「名前を変更」で手動命名し、別の部品を加える
  await page.getByTestId('class-header-OrderMailer').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '名前を変更' }).click();
  const nameInput = menu.getByLabel('新しいクラス名');
  await nameInput.fill('CustomMailer');
  await nameInput.press('Enter');
  await dragMethodToClass(page, view, 'method-sendShippedMail', 'class-CustomMailer');

  // Assert: 手動命名後は内容が変わっても名前を維持する
  await expect(view.getByTestId('class-CustomMailer').getByTestId('method-calculateOrderTax')).toBeVisible();
  await expect(view.getByTestId('class-CustomMailer').getByTestId('method-sendShippedMail')).toBeVisible();
  await expect(view.getByTestId('class-OrderMailer')).toHaveCount(0);
});

test('全部品を配置すると答え合わせができ、両者の設計スコアと変更依頼の結果、模範解答の図が出る', async ({ page }) => {
  // Arrange
  await openBlank(page);
  const view = blankView(page);
  await placeAllParts(page, view);
  await expect(view.getByTestId('blank-unplaced')).toContainText('全部品を配置しました');
  await expect(view.getByTestId('blank-review-disabled-reason')).toHaveCount(0);
  await expect(view.getByTestId('blank-review')).not.toHaveAttribute('aria-describedby');
  await expect(view.getByTestId('blank-review')).toBeEnabled();

  // Act
  await view.getByTestId('blank-review').click();

  // Assert
  const result = view.getByTestId('blank-result');
  await expect(result).toBeVisible();
  await expect(result.getByTestId('blank-score-player')).toContainText('点');
  await expect(result.getByTestId('blank-score-model')).toContainText('点');
  await expect(result.getByTestId('blank-change-req-blank-mail-footer')).toBeVisible();
  await expect(result.getByTestId('blank-change-req-blank-reduced-tax')).toBeVisible();

  // Act: 模範解答の図を見る
  await result.getByRole('button', { name: '模範解答の図を見る' }).click();

  // Assert
  await expect(page.getByTestId('codebase-preview').getByTestId('preview-class-OrderMailer')).toBeVisible();
});

test('白紙設計で部品を動かしてから Ctrl+Z すると白紙設計の操作だけが戻る。リファクタリングに切り替えて Ctrl+Z しても白紙設計の配置は変わらない', async ({ page }) => {
  // Arrange
  await openBlank(page);
  const view = blankView(page);
  await dragToEmptyCanvas(page, view, 'method-placeOrder');
  await expect(view.getByTestId('blank-unplaced')).toContainText('あと6個');

  // Act: リファクタリングに切り替えて Ctrl+Z しても、白紙設計の配置は変わらない
  await page.getByTestId('mode-refactor').click();
  await page.keyboard.press('Control+z');
  await page.getByTestId('mode-blank').click();

  // Assert
  await expect(view.getByTestId('blank-unplaced')).toContainText('あと6個');

  // Act: 白紙設計の画面で Ctrl+Z すると、白紙設計の操作が戻る
  await page.keyboard.press('Control+z');

  // Assert
  await expect(view.getByTestId('blank-unplaced')).toContainText('あと7個');
});

test('リファクタリングと白紙設計を行き来しても、それぞれの操作が残っている', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const calculateTax = page.getByTestId('class-OrderService').getByTestId('method-calculateTax');
  await expect(calculateTax).toBeVisible();

  // Act
  await page.getByTestId('mode-blank').click();
  const view = blankView(page);
  await dragToEmptyCanvas(page, view, 'method-placeOrder');
  await expect(view.getByTestId('class-OrderService').getByTestId('method-placeOrder')).toBeVisible();
  await page.getByTestId('mode-refactor').click();

  // Assert: リファクタリングのコードベースがそのまま残っている
  await expect(calculateTax).toBeVisible();

  // Act & Assert: 白紙設計に戻ると配置も残っている
  await page.getByTestId('mode-blank').click();
  await expect(view.getByTestId('class-OrderService').getByTestId('method-placeOrder')).toBeVisible();
});

test('キーボードだけで、モードの切り替え・答え合わせ・結果を閉じる操作ができる', async ({ page }) => {
  // Arrange: 配置はマウスで済ませる
  await openBlank(page);
  const view = blankView(page);
  await placeAllParts(page, view);
  await expect(view.getByTestId('blank-unplaced')).toContainText('全部品を配置しました');

  // Act: モードの切り替え・答え合わせ・結果を閉じるはキーボードで行う
  await page.getByTestId('mode-refactor').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('mode-blank').focus();
  await page.keyboard.press('Enter');
  await view.getByTestId('blank-review').focus();
  await page.keyboard.press('Enter');

  // Assert
  const result = view.getByTestId('blank-result');
  await expect(result).toBeVisible();

  // Act
  await result.getByTestId('blank-result-close').focus();
  await page.keyboard.press('Enter');

  // Assert: 閉じたら「答え合わせ」ボタンへフォーカスが戻る
  await expect(result).toHaveCount(0);
  await expect(view.getByTestId('blank-review')).toBeFocused();
});

test('問題を切り替えると部品が入れ替わる', async ({ page }) => {
  // Arrange
  await openBlank(page);
  const view = blankView(page);
  const select = view.getByTestId('blank-problem-select');
  await expect(select.locator('option')).toHaveText(['白紙1: 注文と発送', '白紙2: 会議室の予約', '白紙3: 勤怠の打刻']);
  await expect(select).toHaveValue('blank-order-shipping');

  // Act: 未配置のままなので、確認なしで切り替わる
  await select.selectOption('blank-room-reservation');

  // Assert
  await expect(view.getByTestId('blank-requirement')).toContainText('会議室');
  await expect(view.getByTestId('method-reserveRoom')).toBeVisible();
  await expect(view.getByTestId('method-placeOrder')).toHaveCount(0);
  await expect(view.getByTestId('blank-unplaced')).toContainText('あと7個');
});

test('配置済みで問題を切り替えると確認が出て、キャンセルで配置が残り、OKで入れ替わる', async ({ page }) => {
  // Arrange
  await openBlank(page);
  const view = blankView(page);
  const select = view.getByTestId('blank-problem-select');
  await select.selectOption('blank-room-reservation');
  await dragToEmptyCanvas(page, view, 'method-checkRoomAvailability');
  await expect(view.getByTestId('class-RoomAvailability')).toBeVisible();
  await expect(view.getByTestId('blank-unplaced')).toContainText('あと6個');

  // Act: キャンセルする
  const messages: string[] = [];
  page.once('dialog', (dialog) => {
    messages.push(dialog.message());
    void dialog.dismiss();
  });
  await select.selectOption('blank-attendance');

  // Assert: 配置も選択欄の値もそのまま
  await expect.poll(() => messages).toEqual(['今の配置は消えます。別の問題に切り替えますか?']);
  await expect(select).toHaveValue('blank-room-reservation');
  await expect(view.getByTestId('class-RoomAvailability')).toBeVisible();
  await expect(view.getByTestId('blank-unplaced')).toContainText('あと6個');

  // Act: OKする
  page.once('dialog', (dialog) => {
    void dialog.accept();
  });
  await select.selectOption('blank-attendance');

  // Assert: 白紙3の部品7つが並び、元に戻せない
  await expect(view.getByTestId('method-clockIn')).toBeVisible();
  await expect(view.getByTestId('blank-unplaced')).toContainText('あと7個');
  await expect(view.getByRole('button', { name: '元に戻す' })).toBeDisabled();
});
