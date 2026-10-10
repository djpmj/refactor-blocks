import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('抽出の選択中に結果をプレビューし、抽出・Undo・ステージ切り替えで下書きを解除する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  const sourceLines = page.getByTestId('method-printMonthlyReport').locator('.method-chip__lines');
  const checks = page.getByRole('checkbox');
  const previewMethod = page.getByTestId('extract-preview-chip');
  const summary = page.locator('.method-editor__extract-preview');

  // Act: 1つ選んでプレビューを表示する
  await checks.nth(0).check();

  // Assert: 現在の実コード行数を使い、メソッドエディタとキャンバスの両方に表示する
  await expect(sourceLines).toHaveText('30行 → 25行');
  await expect(previewMethod).toBeVisible();
  await expect(previewMethod).toHaveAttribute('aria-label', '抽出後のプレビュー: aggregateSales() 9行');
  await expect(summary).toContainText('printMonthlyReport 30行 → 25行 / 新しい aggregateSales 9行');
  await expect(previewMethod).toHaveCSS('pointer-events', 'none');
  await expect(previewMethod.locator('.method-chip')).toHaveCSS('border-top-style', 'dashed');

  // Act: 全ての処理を選択解除する
  await checks.nth(0).uncheck();

  // Assert: 選択が0個ならキャンバスとエディタのプレビューを消す
  await expect(previewMethod).toHaveCount(0);
  await expect(summary).toHaveCount(0);

  // Act: 後続の選択数・名前変更を確認するため、再び選択する
  await checks.nth(0).check();
  await expect(previewMethod).toBeVisible();
  await expect(summary).toBeVisible();
  const savedState = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  const score = await page.getByTestId('score').textContent();

  // Act: 抽出する処理を増やし、新しい名前を入力する
  await checks.nth(1).check();
  await expect(sourceLines).toHaveText('30行 → 18行');
  await expect(previewMethod).toHaveAttribute('aria-label', '抽出後のプレビュー: aggregateSalesAndCompareWithLastMonth() 16行');
  const name = page.getByLabel('新しいメソッド名');
  await name.fill('summarizeSales');
  await expect(previewMethod).toHaveAttribute('aria-label', '抽出後のプレビュー: summarizeSales() 16行');
  await expect(summary).toContainText('新しい summarizeSales 16行');

  // Act: 上限内に収まる選び方を確認してから、確定する選択へ戻す
  await checks.nth(2).check();
  await checks.nth(3).check();

  // Assert: 抽出後13行は上限15行以内なので、赤い上限超過表示が外れる
  await expect(sourceLines).toHaveText('30行 → 13行');
  await expect(page.getByTestId('method-printMonthlyReport').locator('.method-chip--over')).toHaveCount(0);
  await expect(page.getByTestId('method-printMonthlyReport').locator('.method-chip__lines-after')).not.toHaveClass(/--over/);

  // Act: 1つ選んだ状態と2つ選んだ状態の確定フローに戻す
  await checks.nth(2).uncheck();
  await checks.nth(3).uncheck();
  await expect(sourceLines).toHaveText('30行 → 18行');

  // Assert: 下書きの表示は点数・Undo履歴・自動保存を変更しない
  await expect(page.getByRole('button', { name: '元に戻す' })).toBeDisabled();
  await expect(page.getByTestId('score')).toHaveText(score ?? '');
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe(savedState);

  // Act: 抽出を確定する
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Assert: プレビューと下書き文が消え、本物のメソッドが同じ名前・行数でできる
  await expect(previewMethod).toHaveCount(0);
  await expect(summary).toHaveCount(0);
  await expect(page.getByTestId('method-summarizeSales').locator('.method-chip__lines')).toHaveText('16行');
  await expect(sourceLines).toHaveText('18行');

  // Act: 元メソッドでプレビューを出し、別メソッドを選択して下書きを閉じる
  await checks.nth(0).check();
  await expect(previewMethod).toBeVisible();
  await page.getByTestId('method-summarizeSales').click();

  // Assert: 別メソッドを選ぶと古いプレビューが消える
  await expect(previewMethod).toHaveCount(0);

  // Act: Undo後にも古い下書きが残らないことを確認する
  await page.getByRole('button', { name: '元に戻す' }).click();

  // Assert
  await expect(previewMethod).toHaveCount(0);
  await expect(summary).toHaveCount(0);

  // Act: 選択中の下書きはステージ切り替えでも破棄される
  await page.getByTestId('method-printMonthlyReport').click();
  await checks.nth(0).uncheck();
  await checks.nth(0).check();
  await expect(previewMethod).toBeVisible();
  await selectStage(page, 'チュートリアル2: 太った placeOrder');

  // Assert
  await expect(previewMethod).toHaveCount(0);
});
