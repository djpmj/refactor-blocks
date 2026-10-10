import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('ヒントの対象を表示し、切り替え・解除・リセット・ステージ変更ができる', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByRole('button', { name: /ヒントを見る/ }).click();
  const hint = page.getByRole('button', { name: 'ヒント1の場所をキャンバスで見る' });

  // Act
  await hint.click();

  // Assert
  await expect(hint).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('method-printMonthlyReport').locator('.method-chip--flagged')).toBeVisible();
  await expect(page.getByTestId('method-printMonthlyReport')).toBeInViewport();

  // Act: 同じヒントをもう一度押して解除する
  await hint.click();

  // Assert
  await expect(hint).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(0);
  await hint.click();

  // Act: 得点内訳へ切り替え、もう一度ヒントを押して解除する
  const breakdown = page.locator('.score-breakdown');
  await breakdown.locator('summary').click();
  await breakdown.locator('.score-breakdown__items button[aria-pressed]').first().click();

  // Assert
  await expect(hint).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(1);

  // Act: ヒントへ切り替えてリセットする
  await hint.click();
  await page.locator('.stage-panel__reset').click();

  // Assert
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(0);

  // Act: ハイライト中にステージを切り替える
  await page.getByRole('button', { name: 'ヒント1の場所をキャンバスで見る' }).click();
  await selectStage(page, 'チュートリアル2: 太った placeOrder');

  // Assert
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(0);
});

test('まだ存在しない対象のヒントは、前の操作で作られるまで無効', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const reveal = page.getByRole('button', { name: /ヒントを見る/ });
  await reveal.click();
  await reveal.click();
  await reveal.click();
  await reveal.click();
  const hint = page.getByRole('button', { name: 'ヒント4の場所をキャンバスで見る' });
  const hintOne = page.getByRole('button', { name: 'ヒント1の場所をキャンバスで見る' });
  const hintTwo = page.getByRole('button', { name: 'ヒント2の場所をキャンバスで見る' });

  // Assert
  await expect(hint).toBeDisabled();
  await expect(hint).toHaveAttribute('title', 'まだこの名前のブロックがありません');

  // 同じ placeOrder を指すヒントでも、押下状態は選んだ一件だけにする
  await hintOne.click();
  await expect(hintOne).toHaveAttribute('aria-pressed', 'true');
  await expect(hintTwo).toHaveAttribute('aria-pressed', 'false');
  await hintTwo.click();
  await expect(hintOne).toHaveAttribute('aria-pressed', 'false');
  await expect(hintTwo).toHaveAttribute('aria-pressed', 'true');

  // Act: ヒントの対象である calculateTax をプレイヤーの操作で作る
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Assert
  await expect(hint).toBeEnabled();
  await hint.click();
  await expect(page.getByTestId('method-calculateTax').locator('.method-chip--flagged')).toBeVisible();

  // Act: メソッドがなくなり、移動先クラスだけ残ったらハイライトを解除する
  await page.getByTestId('method-calculateTax').click();
  await page.getByRole('button', { name: '呼び出し元へ戻す' }).click();

  // Assert
  await expect(page.getByTestId('method-calculateTax')).toHaveCount(0);
  await expect(page.getByTestId('class-TaxCalculator')).toBeVisible();
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(0);
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(0);
});
