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

/** 要素をつかんで、キャンバスの右下の余白(どのファイルの枠外)へドラッグして離す。 */
async function dragToEmptyCanvas(page: Page, view: Locator, testId: string) {
  const from = await stableBoundingBox(page, view.getByTestId(testId));
  const pane = await stableBoundingBox(page, view.locator('.react-flow__pane'));
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** ドラッグ操作(Move Method)で、あるメソッドを別クラスへ移す。 */
async function dragMethodToClass(page: Page, view: Locator, methodTestId: string, classTestId: string) {
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
  await dragToEmptyCanvas(page, view, `method-${ALL_PARTS[0]}`);
  await page.getByRole('button', { name: 'Fit View' }).click();
  for (const name of ALL_PARTS.slice(1)) {
    await dragMethodToClass(page, view, `method-${name}`, 'class-NewClass');
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
});

test('部品を1つ空いている所へドラッグすると、新しいクラスにその部品が入り、未配置が「あと6個」になる', async ({ page }) => {
  // Arrange
  await openBlank(page);
  const view = blankView(page);

  // Act
  await dragToEmptyCanvas(page, view, 'method-placeOrder');

  // Assert
  await expect(view.getByTestId('class-NewClass').getByTestId('method-placeOrder')).toBeVisible();
  await expect(view.getByTestId('blank-unplaced')).toContainText('あと6個');
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

test('全部品を配置すると答え合わせができ、両者の設計スコアと変更依頼の結果、模範解答の図が出る', async ({ page }) => {
  // Arrange
  await openBlank(page);
  const view = blankView(page);
  await placeAllParts(page, view);
  await expect(view.getByTestId('blank-unplaced')).toContainText('全部品を配置しました');

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
  await expect(view.getByTestId('class-NewClass').getByTestId('method-placeOrder')).toBeVisible();
  await page.getByTestId('mode-refactor').click();

  // Assert: リファクタリングのコードベースがそのまま残っている
  await expect(calculateTax).toBeVisible();

  // Act & Assert: 白紙設計に戻ると配置も残っている
  await page.getByTestId('mode-blank').click();
  await expect(view.getByTestId('class-NewClass').getByTestId('method-placeOrder')).toBeVisible();
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
