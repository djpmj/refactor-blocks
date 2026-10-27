import { expect, test } from '@playwright/test';
import { openHints } from './hintPopover.js';
import { dismissClearScreen, selectStage } from './selectStage.js';

const STAGE = '中級1: 循環依存を断ち切る';

test('中級1では問題の場所を見てから次の一手と動きが使え、ステージ変更で再びロックする', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, STAGE);
  const problem = page.getByTestId('hint-problem');
  const next = page.getByRole('button', { name: /次の一手/ });
  const ghost = page.getByTestId('ghost-hint');
  await openHints(page);

  // Assert
  await expect(problem).toBeVisible();
  await expect(next).toBeDisabled();
  await expect(next).toHaveAttribute('title', '先に「どこが問題?」を見てみよう');
  await expect(ghost).toBeDisabled();
  await expect(ghost).toHaveAttribute('title', '先に「どこが問題?」を見てみよう');

  // Act
  await problem.click();

  // Assert
  const explanation = page.getByTestId('hint-problem-text');
  await expect(explanation).toContainText('いちばん大きい減点: 循環依存(-20点)');
  await expect(explanation).toContainText('AがBを、BがAを呼んでいる');
  await expect(explanation).toContainText('どう直せばよいか考えてみよう');
  await expect(explanation).not.toContainText('一方通行');
  await expect(page.getByTestId('class-Order')).toHaveClass(/class-node--flagged/);
  await expect(next).toBeEnabled();
  await expect(ghost).toBeEnabled();

  // Act: reveal one textual step, then switch away and back.
  await next.click();
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await selectStage(page, STAGE);
  await openHints(page);

  // Assert
  await expect(next).toBeDisabled();
  await expect(ghost).toBeDisabled();
  await expect(problem).toBeEnabled();
});

test('100点では問題ヒントを使えない', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const problem = page.getByTestId('hint-problem');

  // Act: move tax to its own class and extract the remaining actions.
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const source = await page.getByTestId('method-calculateTax').boundingBox();
  const destination = await page.getByTestId('class-TaxCalculator').boundingBox();
  if (source === null || destination === null) throw new Error('移動対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 12 });
  await page.mouse.up();
  for (const [label, name] of [['注文をDBに保存する', 'saveOrder'], ['確認メールを送る', 'sendConfirmationMail'], ['在庫があるか検証する', 'validateStock']] as const) {
    await page.getByTestId('method-placeOrder').click();
    await page.getByLabel(label).check();
    await page.getByLabel('新しいメソッド名').fill(name);
    await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  }

  // Assert
  await expect(page.getByTestId('score-value')).toContainText('100点');
  await dismissClearScreen(page);
  await openHints(page);
  await expect(problem).toBeDisabled();
});
