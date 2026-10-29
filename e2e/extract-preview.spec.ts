import { expect, test } from '@playwright/test';
import { dismissClearScreen, selectStage } from './selectStage.js';

test('チュートリアル1のヒントどおりに選ぶと模範解答の名前が自動で付く', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  const name = page.getByLabel('新しいメソッド名');

  // Act & Assert: 表の2処理
  await page.getByLabel('表のヘッダーを組み立てる').check();
  await page.getByLabel('表の行を組み立てる').check();
  await expect(name).toHaveValue('buildSalesTable');
  await page.getByLabel('表のヘッダーを組み立てる').uncheck();
  await page.getByLabel('表の行を組み立てる').uncheck();

  // Act & Assert: 出力の1処理を抽出
  await page.getByLabel('画面に出力する').check();
  await expect(name).toHaveValue('printSalesReport');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('method-printSalesReport')).toBeVisible();
});

test('手直し中もメソッド行数のバッジは一行で表示する', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける', { completeOpeningFix: false });
  const method = page.getByTestId('method-printMonthlyReport');

  // Act
  const openSidebar = page.getByRole('button', { name: 'サイドバーを開く' });
  if (await openSidebar.count() > 0) await openSidebar.click();
  await page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' }).click();
  await page.getByRole('checkbox', { name: 'ReportService.printMonthlyReport() を直した' }).check();

  // Assert
  await expect(method.locator('.method-chip__fixed-mark')).toBeVisible();
  await expect(method.locator('.method-chip__lines')).toHaveText('39行');
  const lineBadgeRows = await method.locator('.method-chip__lines').evaluate((badge) => {
    const range = badge.ownerDocument.createRange();
    range.selectNodeContents(badge);
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
  });
  expect(lineBadgeRows).toBe(1);
});

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
  await expect(sourceLines).toHaveText('39行 → 34行');
  await expect(previewMethod).toBeVisible();
  await expect(previewMethod).toHaveAttribute('aria-label', '抽出後のプレビュー: aggregateSales() 10行');
  await expect(summary).toContainText('printMonthlyReport 39行 → 34行 / 新しい aggregateSales 10行');
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
  await expect(sourceLines).toHaveText('39行 → 25行');
  await expect(previewMethod).toHaveAttribute('aria-label', '抽出後のプレビュー: aggregateSales() 19行');
  const name = page.getByLabel('新しいメソッド名');
  await name.fill('summarizeSales');
  await expect(previewMethod).toHaveAttribute('aria-label', '抽出後のプレビュー: summarizeSales() 19行');
  await expect(summary).toContainText('新しい summarizeSales 19行');

  // Act: 上限内に収まる選び方を確認してから、確定する選択へ戻す
  await checks.nth(2).check();
  await checks.nth(3).check();

  // Assert: 抽出後16行は上限28行以内なので、赤い上限超過表示が外れる
  await expect(sourceLines).toHaveText('39行 → 16行');
  await expect(page.getByTestId('method-printMonthlyReport').locator('.method-chip--over')).toHaveCount(0);
  await expect(page.getByTestId('method-printMonthlyReport').locator('.method-chip__lines-after')).not.toHaveClass(/--over/);

  // Act: 1つ選んだ状態と2つ選んだ状態の確定フローに戻す
  await checks.nth(2).uncheck();
  await checks.nth(3).uncheck();
  await expect(sourceLines).toHaveText('39行 → 25行');

  // Assert: 下書きの表示は点数・Undo履歴・自動保存を変更しない
  await expect(page.getByRole('button', { name: '元に戻す' })).toBeDisabled();
  await expect(page.getByTestId('score')).toHaveText(score ?? '');
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe(savedState);

  // Act: 抽出を確定する
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Assert: プレビューと下書き文が消え、本物のメソッドが同じ名前・行数でできる
  await expect(previewMethod).toHaveCount(0);
  await expect(summary).toHaveCount(0);
  await expect(page.getByTestId('method-summarizeSales').locator('.method-chip__lines')).toHaveText('19行');
  await expect(sourceLines).toHaveText('25行');
  await dismissClearScreen(page);

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

test('チュートリアル1で表のヘッダー・行・出力を抽出すると、責務に沿った短い名前になる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  const name = page.getByLabel('新しいメソッド名');

  // Act: formattingの2処理とoutputの処理を選択する
  await page.getByLabel('表のヘッダーを組み立てる').check();
  await page.getByLabel('表の行を組み立てる').check();
  await page.getByLabel('画面に出力する').check();

  // Assert: 自動名を確認して抽出する
  await expect(name).toHaveValue('printReport');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('method-printReport')).toBeVisible();
});
