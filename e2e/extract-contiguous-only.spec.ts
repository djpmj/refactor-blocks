import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

const REASON = '間の処理も選ぶか、選ぶ処理を連続させてください(離れた処理をまとめると実行順が変わります)';

test('離れた処理は抽出できず理由が出て、間の処理も選ぶと抽出できる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '初級1: 何でも屋の UserController');
  await page.getByTestId('method-registerUser').click();
  const checks = page.getByRole('checkbox');
  const extract = page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' });
  const summary = page.locator('.method-editor__extract-preview');

  // Act: 1番目(入力値を検証する)と4番目(レスポンスを組み立てる)だけを選ぶ
  await checks.nth(0).check();
  await checks.nth(3).check();

  // Assert: 押せず、理由が出て、プレビューは出ない
  await expect(extract).toBeDisabled();
  await expect(page.locator('#method-editor-extract-disabled-reason')).toHaveText(REASON);
  await expect(summary).toHaveCount(0);
  await expect(page.getByTestId('extract-preview-chip')).toHaveCount(0);

  // Act: 間の処理も選ぶ
  await checks.nth(1).check();
  await checks.nth(2).check();

  // Assert: 理由は消える
  await expect(page.locator('#method-editor-extract-disabled-reason')).toHaveCount(0);

  // Act: 4番目を外して、先頭から連続する3つにする
  await checks.nth(3).uncheck();

  // Assert: 押せて、プレビューが出る
  await expect(extract).toBeEnabled();
  await expect(summary).toBeVisible();
  await expect(page.getByTestId('extract-preview-chip')).toBeVisible();
});

test('連続した処理(先頭・途中・末尾)は押せて、抽出できる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '初級1: 何でも屋の UserController');
  await page.getByTestId('method-registerUser').click();
  const checks = page.getByRole('checkbox');
  const extract = page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' });

  // Act & Assert: 途中の連続(2・3番目)
  await checks.nth(1).check();
  await checks.nth(2).check();
  await expect(extract).toBeEnabled();
  await checks.nth(1).uncheck();
  await checks.nth(2).uncheck();

  // Act & Assert: 先頭の連続(1・2番目)
  await checks.nth(0).check();
  await checks.nth(1).check();
  await expect(extract).toBeEnabled();
  await checks.nth(0).uncheck();
  await checks.nth(1).uncheck();

  // Act & Assert: 末尾の連続(3・4番目)
  await checks.nth(2).check();
  await checks.nth(3).check();
  await expect(extract).toBeEnabled();

  // Act: 実際に抽出する
  await extract.click();

  // Assert: 元のメソッドに呼び出し行が入り、新しいメソッドが現れる
  await expect(page.getByTestId('method-registerUser')).toBeVisible();
  await expect(page.getByText('を呼び出す').first()).toBeVisible();
});
