import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('「解答を再生」で模範解答を1手ずつ進め、図・説明・点数が変わる。閉じてもキャンバスは変わらない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  const scoreBefore = await page.getByTestId('score').innerText();
  const canvasBefore = await page.locator('.react-flow').first().innerText();

  // Act: 開く
  await page.getByTestId('sample-replay-open').click();

  // Assert: 0手目
  const dialog = page.getByTestId('sample-replay');
  await expect(dialog).toBeVisible();
  const maximize = dialog.getByTestId('sample-replay-maximize');
  const controls = dialog.locator('.window-controls');
  const close = controls.getByRole('button', { name: '閉じる' });
  await expect(maximize).toHaveAttribute('aria-label', '最大化');
  await expect(maximize).toHaveAttribute('title', '最大化');
  await expect(maximize).toHaveText('');
  await expect(maximize.locator('svg rect')).toHaveCount(1);
  await expect(close).toHaveAttribute('title', '閉じる');
  await expect(controls.getByTestId('sample-replay-maximize')).toHaveCount(1);
  const maximizeBox = await maximize.boundingBox();
  const closeBox = await close.boundingBox();
  const dialogBox = await dialog.boundingBox();
  expect(maximizeBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(dialogBox).not.toBeNull();
  expect((maximizeBox?.x ?? 0) + (maximizeBox?.width ?? 0)).toBeLessThan(closeBox?.x ?? 0);
  expect((closeBox?.x ?? 0) - ((maximizeBox?.x ?? 0) + (maximizeBox?.width ?? 0))).toBeLessThanOrEqual(16);
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) - ((closeBox?.x ?? 0) + (closeBox?.width ?? 0))).toBeLessThanOrEqual(24);
  await maximize.hover();
  const hoverBackground = await maximize.evaluate((button) => {
    const view = button.ownerDocument.defaultView;
    if (view === null) throw new Error('表示中のドキュメントに window がありません');
    return view.getComputedStyle(button).backgroundColor;
  });
  expect(hoverBackground).not.toBe('rgba(0, 0, 0, 0)');
  await close.hover();
  const closeHover = await close.evaluate((button) => {
    const view = button.ownerDocument.defaultView;
    if (view === null) throw new Error('表示中のドキュメントに window がありません');
    const style = view.getComputedStyle(button);
    return { background: style.backgroundColor, color: style.color };
  });
  expect(closeHover.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(closeHover.color).toBe('rgb(255, 255, 255)');
  await maximize.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  expect(await close.evaluate((button) => {
    const view = button.ownerDocument.defaultView;
    if (view === null) throw new Error('表示中のドキュメントに window がありません');
    return view.getComputedStyle(button).outlineStyle;
  })).toBe('solid');
  await page.keyboard.press('Shift+Tab');
  await expect(maximize).toBeFocused();
  expect(await maximize.evaluate((button) => {
    const view = button.ownerDocument.defaultView;
    if (view === null) throw new Error('表示中のドキュメントに window がありません');
    return view.getComputedStyle(button).outlineStyle;
  })).toBe('solid');
  await expect(maximize).toHaveAttribute('aria-pressed', 'false');
  await maximize.press('Enter');
  await expect(maximize).toHaveAttribute('aria-pressed', 'true');
  await expect(maximize).toHaveAttribute('aria-label', '元のサイズに戻す');
  await expect(maximize).toHaveAttribute('title', '元のサイズに戻す');
  await expect(maximize.locator('svg rect')).toHaveCount(2);
  await expect(dialog).toHaveClass(/codebase-preview--maximized/);
  const maximizedControlsBox = await controls.boundingBox();
  const maximizedMaximizeBox = await maximize.boundingBox();
  const maximizedCloseBox = await close.boundingBox();
  const maximizedDialogBox = await dialog.boundingBox();
  expect((maximizedMaximizeBox?.x ?? 0) + (maximizedMaximizeBox?.width ?? 0)).toBeLessThan(maximizedCloseBox?.x ?? 0);
  expect((maximizedCloseBox?.x ?? 0) - ((maximizedMaximizeBox?.x ?? 0) + (maximizedMaximizeBox?.width ?? 0))).toBeLessThanOrEqual(16);
  expect((maximizedDialogBox?.x ?? 0) + (maximizedDialogBox?.width ?? 0) - ((maximizedCloseBox?.x ?? 0) + (maximizedCloseBox?.width ?? 0))).toBeLessThanOrEqual(24);
  expect(maximizedControlsBox).not.toBeNull();
  const maximizedBox = await dialog.boundingBox();
  expect(maximizedBox?.width).toBe(page.viewportSize()?.width);
  expect(maximizedBox?.height).toBe(page.viewportSize()?.height);
  await maximize.press('Space');
  await expect(maximize).toHaveAttribute('aria-pressed', 'false');
  await expect(maximize).toHaveAttribute('aria-label', '最大化');
  await expect(maximize.locator('svg rect')).toHaveCount(1);
  const restoredBox = await dialog.boundingBox();
  expect(restoredBox?.width).toBeLessThanOrEqual(1100);
  await expect(dialog.getByTestId('sample-replay-position')).toHaveText('0 / 1 手');
  await expect(dialog.getByTestId('sample-replay-description')).toContainText('最初の状態です');
  await expect(dialog.getByTestId('preview-class-ReportService')).not.toContainText('aggregateSales');
  await expect(dialog.getByRole('button', { name: '最初へ' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: /前へ/ })).toBeDisabled();
  await expect(dialog.getByText('ここまでで100点です')).toHaveCount(0);

  // Act: 次へ
  await dialog.getByRole('button', { name: /次へ/ }).click();

  // Assert: 最後の手
  await expect(dialog.getByTestId('sample-replay-position')).toHaveText('1 / 1 手');
  await expect(dialog.getByTestId('sample-replay-score')).toContainText('100点');
  await expect(dialog.getByTestId('sample-replay-score')).toContainText('(+');
  await expect(dialog.getByText('ここまでで100点です')).toBeVisible();
  await expect(dialog.getByTestId('preview-class-ReportService')).toContainText('aggregateSales');
  await expect(dialog.getByRole('button', { name: /次へ/ })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '最後へ' })).toBeDisabled();

  // Act: キーボードで戻る・進む
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByTestId('sample-replay-position')).toHaveText('0 / 1 手');
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByTestId('sample-replay-position')).toHaveText('1 / 1 手');

  // Act: 最初へ・最後へ
  await dialog.getByRole('button', { name: '最初へ' }).click();
  await expect(dialog.getByTestId('sample-replay-position')).toHaveText('0 / 1 手');
  await dialog.getByRole('button', { name: '最後へ' }).click();
  await expect(dialog.getByTestId('sample-replay-position')).toHaveText('1 / 1 手');

  // Act: Escで閉じる
  await page.keyboard.press('Escape');

  // Assert: プレイヤーのキャンバスと点数は開く前のまま
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('score')).toHaveText(scoreBefore);
  expect(await page.locator('.react-flow').first().innerText()).toBe(canvasBefore);

  // Act: 開き直すと0手目から
  await page.getByTestId('sample-replay-open').click();

  // Assert
  await expect(page.getByTestId('sample-replay-position')).toHaveText('0 / 1 手');
  await expect(page.getByTestId('sample-replay-maximize')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '閉じる' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(dialog).toBeHidden();

  // Act: 解答例の図を開く
  await page.getByRole('button', { name: '解答例の図を見る' }).click();
  const preview = page.getByTestId('codebase-preview');
  const previewClose = preview.getByRole('button', { name: '閉じる' });
  await expect(preview.locator('.window-controls')).toContainText('✕');
  await expect(previewClose).toHaveClass(/window-control--close/);
  const previewCloseBox = await previewClose.boundingBox();
  const previewBox = await preview.boundingBox();
  expect((previewBox?.x ?? 0) + (previewBox?.width ?? 0) - ((previewCloseBox?.x ?? 0) + (previewCloseBox?.width ?? 0))).toBeLessThanOrEqual(24);
  await previewClose.hover();
  expect(await previewClose.evaluate((button) => {
    const view = button.ownerDocument.defaultView;
    if (view === null) throw new Error('表示中のドキュメントに window がありません');
    return view.getComputedStyle(button).backgroundColor;
  })).not.toBe('rgba(0, 0, 0, 0)');
  await previewClose.click();
});

test('再生中のメソッドパネルは手順に追従し、プレイヤーの選択を変更しない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '中級11: Controller に全部書いてある注文API');
  const playerCanvas = page.locator('.app__canvas .react-flow');
  await expect(playerCanvas).toContainText('OrderController');
  await expect(playerCanvas).toContainText('cancelOrder');
  await page.getByTestId('sample-replay-open').click();
  const dialog = page.getByTestId('sample-replay');

  // Act: placeOrder を選択する
  await dialog.getByTestId('preview-method-method-place-order').click();

  // Assert: 読み取り専用の編集タブ
  const panel = dialog.getByRole('complementary', { name: 'メソッドの内容' });
  await expect(panel.getByRole('heading', { name: /OrderController\.placeOrder\(\)/ })).toBeVisible();
  await expect(panel.getByText('在庫を確認する')).toBeVisible();
  await expect(panel.getByRole('checkbox')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /抽出/ })).toHaveCount(0);

  // Act: コードを見て1手進む
  await panel.getByRole('tab', { name: 'コード' }).click();
  const before = await panel.locator('.code-preview').innerText();
  await dialog.getByRole('button', { name: /次へ/ }).click();

  // Assert: この手の codebase に更新される
  await expect(panel.locator('.code-preview')).not.toHaveText(before);
  await expect(panel.locator('.code-preview')).toContainText('processOrder');
  await expect(playerCanvas).toContainText('placeOrder()');
  await expect(playerCanvas).toContainText('cancelOrder()');
  await expect(playerCanvas).not.toContainText('processOrder');
  await expect(page.getByTestId('method-editor-empty')).toContainText('中央の図から、直したいメソッドをクリックしてみよう');
});

test('再生中のメソッドパネル幅を変えても手順移動後に幅を保つ', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級11: Controller に全部書いてある注文API');
  await page.getByTestId('sample-replay-open').click();
  const dialog = page.getByTestId('sample-replay');
  await dialog.getByTestId('preview-method-method-place-order').click();

  const handle = dialog.getByRole('separator', { name: 'メソッドパネルの幅を変更' });
  const panel = dialog.getByRole('complementary', { name: 'メソッドの内容' });
  await expect(handle).toHaveAttribute('aria-valuenow', '360');
  await handle.focus();
  const positionBeforeResize = await dialog.getByTestId('sample-replay-position').innerText();
  await page.keyboard.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '376');
  await expect(dialog.getByTestId('sample-replay-position')).toHaveText(positionBeforeResize);

  await page.getByRole('button', { name: /次へ/ }).click();
  await expect(dialog.getByTestId('sample-replay-position')).toContainText(/^1 \/ \d+ 手$/);
  await expect(handle).toHaveAttribute('aria-valuenow', '376');
  await expect(panel.getByRole('heading', { name: /OrderController\.placeOrder\(\)/ })).toBeVisible();

  await page.getByRole('button', { name: '閉じる' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByTestId('sample-replay-position')).toContainText(/^0 \/ \d+ 手$/);
});
