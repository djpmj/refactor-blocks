import { expect, test, type Locator, type Page } from '@playwright/test';
import { selectStage, startChangeRequests } from './selectStage.js';

const BLANK_PARTS = ['placeOrder', 'shipOrder', 'calculateOrderTax', 'saveOrder', 'updateShippingStatus', 'sendOrderConfirmMail', 'sendShippedMail'] as const;

async function dragToTarget(page: Page, source: Locator, target: Locator) {
  const sourceBox = await stableBox(page, source);
  const targetBox = await stableBox(page, target);
  if (sourceBox === null || targetBox === null) throw new Error('ドラッグ対象または移動先が見つかりません');
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2, { steps: 5 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function stableBox(page: Page, locator: Locator) {
  const deadline = Date.now() + 3000;
  let previous = await locator.boundingBox();
  while (Date.now() < deadline) {
    await page.waitForTimeout(50);
    const current = await locator.boundingBox();
    if (previous !== null && current !== null && current.x === previous.x && current.y === previous.y) return current;
    previous = current;
  }
  if (previous === null) throw new Error('ドラッグ対象の位置を取得できません');
  return previous;
}

async function dragToEmptyCanvas(page: Page, source: Locator, pane: Locator) {
  const sourceBox = await source.boundingBox();
  const paneBox = await pane.boundingBox();
  if (sourceBox === null || paneBox === null) throw new Error('ドラッグ対象またはキャンバスが見つかりません');
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2, { steps: 5 });
  await page.mouse.move(paneBox.x + paneBox.width - 20, paneBox.y + paneBox.height - 20, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function openChangeRequestResult(page: Page) {
  await page.goto('/');
  await selectStage(page, '上級2: 決済ゲートウェイをインターフェース越しに呼ぶ');
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
  await startChangeRequests(page);
  await dragPlayerMethodToEmptyCanvas(page, page.getByTestId('class-部品置き場').getByTestId('method-charge'));
  await page.getByTestId('class-header-GatewayIntegrationHandler').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '実装するインターフェースを設定' }).click();
  await menu.getByRole('menuitemcheckbox', { name: 'PaymentGateway' }).click();
  await page.keyboard.press('Escape');
  await finishChangeRequest(page);
  await dragPlayerMethodToEmptyCanvas(page, page.getByTestId('method-logRetryCount'));
  await finishChangeRequest(page);
  await dragToTarget(page, page.getByTestId('method-applyGatewayTimeout'), page.getByTestId('class-StripeGateway'));
  await finishChangeRequest(page);
}

async function dragPlayerMethodToEmptyCanvas(page: Page, source: Locator) {
  const sourceBox = await source.boundingBox();
  const paneBox = await page.locator('.app__canvas .react-flow__pane').boundingBox();
  if (sourceBox === null || paneBox === null) throw new Error('ドラッグ対象またはキャンバスが見つかりません');
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2, { steps: 5 });
  await page.mouse.move(paneBox.x + paneBox.width - 20, paneBox.y + paneBox.height - 20, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function finishChangeRequest(page: Page) {
  await expect(async () => {
    await page.getByTestId('change-request-finish').click({ timeout: 1000 });
    await expect(page.getByTestId('change-part-status').filter({ hasText: 'に置きました' })).toHaveCount(0, { timeout: 1000 });
  }).toPass();
}

async function openBlankDesignResult(page: Page) {
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
  const view = page.getByTestId('blank-view');
  await dragToEmptyCanvas(page, view.getByTestId(`method-${BLANK_PARTS[0]}`), view.locator('.react-flow__pane'));
  await page.getByRole('button', { name: 'Fit View' }).click();
  for (const part of BLANK_PARTS.slice(1)) {
    await dragToTarget(page, view.getByTestId(`method-${part}`), view.getByTestId('class-NewClass'));
  }
  await expect(view.getByTestId('blank-unplaced')).toContainText('全部品を配置しました');
  await view.getByTestId('blank-review').click();
}

test('「変更前の図を見る」を押すと、最初の状態のクラス・メソッドを読み取り専用で表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');

  // Act
  await page.getByRole('button', { name: '変更前の図を見る' }).click();

  // Assert
  const dialog = page.getByTestId('codebase-preview');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('preview-class-ReportService')).toContainText('printMonthlyReport');
  await expect(dialog.locator('.file-node__path')).toHaveCount(0);
  await expect(dialog).not.toContainText('.ts');

  // Act: メソッドを選び、処理とコードを確認する
  await dialog.getByRole('button', { name: /printMonthlyReport/ }).click();

  // Assert: 読み取り専用のメソッドパネルが表示される
  const panel = dialog.getByRole('complementary', { name: 'メソッドの内容' });
  await expect(panel.getByRole('tab', { name: '編集' })).toBeVisible();
  await expect(panel.getByRole('tabpanel')).toBeVisible();
  await expect(panel.getByRole('checkbox')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /抽出/ })).toHaveCount(0);
  await panel.getByRole('tab', { name: 'コード' }).click();
  await expect(panel.locator('.code-preview')).toBeVisible();

  // Act: 最大化して元のサイズへ戻す
  const maximize = dialog.getByTestId('codebase-preview-maximize');
  await expect(maximize).toHaveAttribute('aria-pressed', 'false');
  await maximize.focus();
  await page.keyboard.press('Enter');
  await expect(maximize).toHaveAttribute('aria-label', '元のサイズに戻す');
  await expect(dialog).toHaveClass(/codebase-preview--maximized/);
  const maximizedBox = await dialog.boundingBox();
  expect(maximizedBox?.width).toBe(page.viewportSize()?.width);
  expect(maximizedBox?.height).toBe(page.viewportSize()?.height);
  await page.keyboard.press('Space');
  await expect(maximize).toHaveAttribute('aria-label', '最大化');

  // Act: 閉じて開き直す
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('button', { name: '変更前の図を見る' }).click();
  const reopened = page.getByTestId('codebase-preview');
  await expect(reopened.getByTestId('codebase-preview-maximize')).toHaveAttribute('aria-pressed', 'false');
  await expect(reopened.getByRole('complementary')).toHaveCount(0);

  // Act: 閉じるボタンで閉じる
  await reopened.getByRole('button', { name: '閉じる' }).click();

  // Assert
  await expect(dialog).toBeHidden();
});

test('「解答例の図を見る」を押すと、模範解答どおりに抽出した後の構造を表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');

  // Act
  await page.getByRole('button', { name: '解答例の図を見る' }).click();

  // Assert
  const dialog = page.getByTestId('codebase-preview');
  await expect(dialog.getByTestId('preview-class-ReportService')).toContainText('aggregateSales');
  await expect(dialog.locator('.file-node__path')).toHaveCount(0);
  await expect(dialog).not.toContainText('.ts');
  await dialog.getByRole('button', { name: /aggregateSales/ }).click();
  const panel = dialog.getByRole('complementary', { name: 'メソッドの内容' });
  await expect(panel.getByRole('heading', { name: /ReportService\.aggregateSales\(\)/ })).toBeVisible();
  await panel.getByRole('tab', { name: 'コード' }).click();
  await expect(panel.locator('.code-preview')).toBeVisible();
});

test('プレビューのメソッドパネルはドラッグとキーボードで幅を変えられる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '解答例の図を見る' }).click();
  const dialog = page.getByTestId('codebase-preview');
  await expect(dialog.getByRole('separator', { name: 'メソッドパネルの幅を変更' })).toHaveCount(0);
  await dialog.getByRole('button', { name: /aggregateSales/ }).click();

  const handle = dialog.getByRole('separator', { name: 'メソッドパネルの幅を変更' });
  const panel = dialog.getByRole('complementary', { name: 'メソッドの内容' });
  await expect(handle).toHaveAttribute('aria-valuenow', '360');
  const initialPanelWidth = (await panel.boundingBox())?.width ?? 0;
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move((handleBox?.x ?? 0) + 2, (handleBox?.y ?? 0) + 10);
  await page.mouse.down();
  await page.mouse.move((handleBox?.x ?? 0) - 78, (handleBox?.y ?? 0) + 10);
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '440');
  await expect.poll(async () => (await panel.boundingBox())?.width).toBeGreaterThan(initialPanelWidth);

  const dragHandle = async (deltaX: number) => {
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move((box?.x ?? 0) + 2, (box?.y ?? 0) + 10);
    await page.mouse.down();
    await page.mouse.move((box?.x ?? 0) + deltaX, (box?.y ?? 0) + 10);
    await page.mouse.up();
  };
  await dragHandle(-1000);
  await expect(handle).toHaveAttribute('aria-valuenow', '640');
  await dragHandle(1000);
  await expect(handle).toHaveAttribute('aria-valuenow', '280');

  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '296');
});

test('幅800px以下のプレビューでは仕切りを出さずパネルを下に表示する', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: '解答例の図を見る' }).click();
  const dialog = page.getByTestId('codebase-preview');
  await dialog.getByRole('button', { name: /aggregateSales/ }).click();
  await expect(dialog.getByRole('separator', { name: 'メソッドパネルの幅を変更' })).toHaveCount(0);
  const canvas = dialog.locator('.codebase-preview__canvas');
  const panel = dialog.getByRole('complementary', { name: 'メソッドの内容' });
  const canvasBox = await canvas.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(canvasBox?.y).toBeLessThan(panelBox?.y ?? 0);
  expect(panelBox?.width).toBeGreaterThan(500);
});

test('変更依頼の解答例でもメソッドを切り替えて最大化でき、プレイヤーのキャンバスを変えない', async ({ page }) => {
  // Arrange: 変更依頼を終え、解答例を開く
  await openChangeRequestResult(page);
  const canvas = page.locator('.app__canvas .react-flow').first();
  const canvasBefore = await canvas.innerText();
  await page.getByTestId('change-outcome-req-add-paypay').getByTestId('outcome-sample-preview').click();

  // Act: 一つ目のメソッドを選ぶ
  const dialog = page.getByTestId('codebase-preview');
  await dialog.getByTestId('preview-method-method-checkout').click();

  // Assert: 読み取り専用パネルが表示される
  const panel = dialog.getByRole('complementary', { name: 'メソッドの内容' });
  await expect(panel.getByRole('heading', { name: /PaymentService\.checkout\(\)/ })).toBeVisible();
  await expect(panel.getByRole('checkbox')).toHaveCount(0);

  // Act: 別メソッドへ切り替えて最大化する
  await dialog.getByTestId('preview-method-method-charge-stripe').click();
  await expect(panel.getByRole('heading', { name: /StripeGateway\.charge\(\)/ })).toBeVisible();
  const maximize = dialog.getByTestId('codebase-preview-maximize');
  await maximize.press('Enter');

  // Assert: □ と ✕を使え、メインキャンバスには影響しない
  await expect(maximize).toHaveAttribute('aria-pressed', 'true');
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.width).toBe(page.viewportSize()?.width);
  expect(dialogBox?.height).toBe(page.viewportSize()?.height);
  await expect(dialog.getByRole('button', { name: '閉じる' })).toBeVisible();
  expect(await canvas.innerText()).toBe(canvasBefore);
});

test('白紙設計の結果の解答例でもメソッドを選べて最大化し、キャンバスを変えない', async ({ page }) => {
  // Arrange: 白紙設計を完成させ、結果から模範解答を開く
  await openBlankDesignResult(page);
  const canvas = page.getByTestId('blank-view').locator('.app__canvas .react-flow');
  const canvasBefore = await canvas.innerText();
  await page.getByTestId('blank-result').getByRole('button', { name: '模範解答の図を見る' }).click();

  // Act: 模範解答のメソッドを選び最大化する
  const dialog = page.getByTestId('codebase-preview');
  await dialog.getByTestId('preview-method-method-blank-place-order').click();
  const panel = dialog.getByRole('complementary', { name: 'メソッドの内容' });
  await expect(panel.getByRole('heading', { name: /OrderService\.placeOrder\(\)/ })).toBeVisible();
  const maximize = dialog.getByTestId('codebase-preview-maximize');
  await maximize.press('Enter');

  // Assert
  await expect(maximize).toHaveAttribute('aria-pressed', 'true');
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.width).toBe(page.viewportSize()?.width);
  expect(dialogBox?.height).toBe(page.viewportSize()?.height);
  expect(await canvas.innerText()).toBe(canvasBefore);
});
