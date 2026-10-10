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
  await expect(maximize).toHaveAttribute('aria-pressed', 'false');
  await maximize.click();
  await expect(maximize).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog).toHaveClass(/sample-replay--maximized/);
  const maximizedBox = await dialog.boundingBox();
  expect(maximizedBox?.width).toBe(page.viewportSize()?.width);
  expect(maximizedBox?.height).toBe(page.viewportSize()?.height);
  await maximize.click();
  await expect(maximize).toHaveAttribute('aria-pressed', 'false');
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
  await expect(page.getByLabel('メソッドエディタ')).toContainText('メソッドかフィールドをクリックすると');
});
