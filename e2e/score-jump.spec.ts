import { expect, test } from '@playwright/test';

test('減点項目を選ぶと違反メソッドを強調し、再選択で解除する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル1: 長いメソッドを分ける' });
  const breakdown = page.locator('.score-breakdown');
  await expect(breakdown).toBeVisible();
  await breakdown.locator('summary').click();
  const rule = breakdown.locator('.score-breakdown__items button').first();

  // Act
  await rule.click();

  // Assert
  await expect(rule).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.method-chip--flagged')).toHaveCount(1);
  await expect(page.getByTestId('method-printMonthlyReport').locator('.method-chip--flagged')).toBeVisible();
  await expect(page.getByTestId('method-printMonthlyReport').locator('.method-chip--flagged')).toBeInViewport();

  // Act
  await rule.click();

  // Assert
  await expect(rule).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.method-chip--flagged')).toHaveCount(0);

  // Act: reset とステージ切り替えでもフォーカスを解除する
  await rule.click();
  await page.locator('.stage-panel__reset').click();

  // Assert
  await expect(rule).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.method-chip--flagged')).toHaveCount(0);
  await rule.click();
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル2: 太った placeOrder' });
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(0);
});

test('別の減点項目を選ぶと強調が切り替わり、違反を直すと該当項目が消える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル2: 太った placeOrder' });
  const breakdown = page.locator('.score-breakdown');
  await breakdown.locator('summary').click();
  const rules = breakdown.locator('.score-breakdown__items button');
  const firstRule = rules.nth(0);
  const secondRule = rules.nth(1);

  // Act: 別の減点を選択
  await firstRule.click();
  await secondRule.click();

  // Assert
  await expect(firstRule).toHaveAttribute('aria-pressed', 'false');
  await expect(secondRule).toHaveAttribute('aria-pressed', 'true');

  // Act: 責務の混在を解消するため、税計算を抽出して TaxCalculator へ移す
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.locator('.method-editor__extract input').fill('calculateTax');
  await page.locator('.method-editor__extract button').click();
  const source = page.getByTestId('method-calculateTax');
  const target = page.getByTestId('class-TaxCalculator');
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('抽出したメソッドまたは移動先が見つかりません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();

  // Assert
  await expect(secondRule).toHaveCount(0);
  await expect(page.locator('.class-node--flagged')).toHaveCount(0);
});
