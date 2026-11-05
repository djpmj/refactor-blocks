import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function openOrderStage(page: Page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByTestId('editor-rail').click();
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
}

test('抽出名が不正なら事前に止め、修正するとプレビューが戻る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByRole('checkbox').first().check();
  const input = page.getByLabel('新しいメソッド名');
  const suggested = await input.inputValue();
  const button = page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' });

  // Act
  await input.fill('1bad name');

  // Assert
  await expect(button).toBeDisabled();
  await expect(page.locator('#method-editor-extract-disabled-reason')).toHaveText('「1bad name」はメソッド名に使えません。英字・数字・_ だけを使い、数字から始めないでください');
  await expect(page.locator('.method-editor__extract-preview')).toHaveCount(0);
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute('aria-describedby', 'method-editor-extract-disabled-reason');

  // Act
  await input.fill(suggested);

  // Assert
  await expect(button).toBeEnabled();
  await expect(page.locator('.method-editor__extract-preview')).toBeVisible();
});

test('メソッド名の変更で不正な名前を拒否する', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('method-placeOrder').dblclick();

  // Act
  const input = page.getByLabel('メソッド名', { exact: true });
  await input.fill('1bad name');
  await input.press('Enter');

  // Assert
  await expect(page.locator('.app__canvas').getByRole('alert')).toContainText('メソッド名には英字・数字・_ だけを使い、数字から始めないでください');
  await expect(page.getByTestId('method-placeOrder')).toBeVisible();
  await expect(page.getByTestId('method-1bad name')).toHaveCount(0);
});

test('クラス名の変更で不正な名前を拒否する', async ({ page }) => {
  // Arrange
  await openOrderStage(page);
  await page.getByTestId('class-header-TaxCalculator').locator('.class-node__name').dblclick();

  // Act
  const input = page.getByLabel('クラス名', { exact: true });
  await input.fill('Tax Calculator');
  await input.press('Enter');

  // Assert
  await expect(page.locator('.app__canvas').getByRole('alert')).toContainText('クラス名には英字・数字・_ だけを使い、数字から始めないでください');
  await expect(page.getByTestId('class-TaxCalculator')).toBeVisible();
  await expect(page.getByTestId('class-Tax Calculator')).toHaveCount(0);
});
