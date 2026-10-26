import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function extractFragments(page: Page, indexes: readonly number[], name: string) {
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  const checks = page.getByRole('checkbox');
  for (const index of indexes) await checks.nth(index).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('表の組み立てと出力を1つにまとめると、増えた減点が先に出て、お知らせと両方読める', async ({ page }) => {
  // Arrange & Act
  await extractFragments(page, [2, 3, 4], 'renderReport');

  // Assert
  const result = page.getByTestId('operation-result');
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute('role', 'status');
  // 現行データでは行数の減点も1件消えるので、合計は同じ(mixed)。増えた行が先に出る
  await expect(result).toHaveClass(/operation-result--mixed/);
  await expect(page.getByTestId('operation-result-line').first()).toHaveText('「責務の混ざったメソッド」の減点が1件増えました(-10)');
  await expect(page.locator('.error-toast[role="status"]')).toBeVisible();
});

test('集計だけを抽出すると、消えた減点が緑系・↑で出て、増えた行は出ない', async ({ page }) => {
  // Arrange & Act
  await extractFragments(page, [0, 1], 'summarizeSales');

  // Assert
  const result = page.getByTestId('operation-result');
  await expect(result).toHaveClass(/operation-result--better/);
  await expect(result).toContainText('の減点が');
  await expect(result).toContainText('件消えました(+');
  await expect(result).not.toContainText('増えました');
  await expect(result).toContainText('↑');
});

test('×とキーボードで閉じられる', async ({ page }) => {
  // Arrange
  await extractFragments(page, [0, 1], 'summarizeSales');
  const result = page.getByTestId('operation-result');
  await expect(result).toBeVisible();

  // Act
  await page.getByRole('button', { name: '操作の結果を閉じる' }).click();

  // Assert
  await expect(result).toBeHidden();

  // Arrange: もう一度出す
  await page.getByRole('button', { name: '元に戻す' }).click();
  await page.getByTestId('method-printMonthlyReport').click();
  const checks = page.getByRole('checkbox');
  await checks.nth(0).check();
  await checks.nth(1).check();
  await page.getByLabel('新しいメソッド名').fill('summarizeSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(result).toBeVisible();

  // Act: キーボードで閉じる
  await page.getByRole('button', { name: '操作の結果を閉じる' }).focus();
  await page.keyboard.press('Enter');

  // Assert
  await expect(result).toBeHidden();
});

test('Undoすると結果は消え、新しい結果も出ない', async ({ page }) => {
  // Arrange
  await extractFragments(page, [2, 3, 4], 'renderReport');
  await expect(page.getByTestId('operation-result')).toBeVisible();

  // Act
  await page.getByRole('button', { name: '元に戻す' }).click();

  // Assert
  await expect(page.getByTestId('operation-result')).toBeHidden();
});

test('集計だけを抽出すると、操作の結果と点数の演出(success-feedback)が同時に出る', async ({ page }) => {
  // Arrange & Act
  await extractFragments(page, [0, 1], 'summarizeSales');

  // Assert
  await expect(page.getByTestId('operation-result')).toBeVisible();
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await expect(page.getByTestId('score-ring')).toHaveClass(/score-badge__ring--perfect/);
  await expect(page.getByTestId('method-printMonthlyReport')).toHaveClass(/method-chip-button--resolved/);
});

test('移動でpublic化したお知らせ(下のトースト)と操作の結果(上部中央)が同時に読める', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('editor-rail').click();
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const taxChip = page.getByTestId('method-calculateTax');
  const target = page.getByTestId('class-TaxCalculator');
  await expect(taxChip).toBeVisible();
  await expect(target).toBeVisible();
  const from = await taxChip.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('ドラッグ元・先の位置を取得できません');

  // Act
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await expect(target).toHaveClass(/class-node--drop-target/);
  await page.mouse.up();

  // Assert
  await expect(page.locator('.error-toast[role="status"]')).toContainText('public にしました');
  const result = page.getByTestId('operation-result');
  await expect(result).toBeVisible();
  await expect(page.getByTestId('operation-result-line').first()).toContainText('減点が');
});

test('点数が実際に下がる抽出では、赤系・↓で増えた減点だけが出る', async ({ page }) => {
  // Arrange & Act: 集計の後半から出力までをまとめると、行数の減点が消えずに責務の混在だけが増える
  await extractFragments(page, [1, 2, 3, 4], 'renderWithTotals');

  // Assert
  const result = page.getByTestId('operation-result');
  await expect(result).toHaveClass(/operation-result--worse/);
  await expect(page.getByTestId('operation-result-line')).toHaveText(['「責務の混ざったメソッド」の減点が1件増えました(-10)']);
  await expect(result).toContainText('↓');
  await expect(page.getByTestId('score-announcement')).toHaveText('80点');
});
