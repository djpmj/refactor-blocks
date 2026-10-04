import { expect, test } from '@playwright/test';

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
});
