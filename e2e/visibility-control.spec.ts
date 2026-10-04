import { expect, test } from '@playwright/test';

async function openStage(page: import('@playwright/test').Page, label: string) {
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label });
}

test('通常ステージでは可視性欄を隠し、抽出メソッドを呼び出し元へ戻す操作は残す', async ({ page }) => {
  // Arrange
  await openStage(page, 'チュートリアル2: 太った placeOrder');
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Act
  await page.getByTestId('method-calculateTax').click();

  // Assert
  await expect(page.getByLabel('メソッド calculateTax の可視性')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '呼び出し元へ戻す' })).toBeVisible();
});

test('上級1ではメソッドを選んでも可視性欄とヒントを表示しない', async ({ page }) => {
  // Arrange
  await openStage(page, '上級1: 通知クラスの共通処理を基底クラスへ集める');

  // Act
  await page.getByTestId('method-notifyByEmail').click();

  // Assert
  await expect(page.getByLabel('メソッド notifyByEmail の可視性')).toHaveCount(0);
  await expect(page.locator('.method-editor__visibility-hint')).toHaveCount(0);

  // Act
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル1: 長いメソッドを分ける' });
  await page.getByTestId('method-printMonthlyReport').click();

  // Assert
  await expect(page.getByLabel('メソッド printMonthlyReport の可視性')).toHaveCount(0);
});

test('visibilityEnforced のある中級3と中級7では可視性欄を表示する', async ({ page }) => {
  // Arrange & Act
  await openStage(page, '中級3: 越境する private メソッド');
  await page.getByTestId('method-renderTemplate').click();

  // Assert
  await expect(page.getByLabel('メソッド renderTemplate の可視性')).toBeVisible();

  // Act
  await page.getByLabel('ステージ').selectOption({ label: '中級7: getter/setter だけの口座クラス' });
  await page.getByTestId('method-withdraw').click();

  // Assert
  await expect(page.getByLabel('メソッド withdraw の可視性')).toBeVisible();
});

test('初期コードに protected メソッドがある上級8では可視性欄を表示する', async ({ page }) => {
  // Arrange
  await openStage(page, '上級8: 取り込みの手順を Template Method にまとめる');

  // Act
  await page.getByTestId('method-importOrders').first().click();

  // Assert
  await expect(page.getByLabel('メソッド importOrders の可視性').first()).toBeVisible();
});
