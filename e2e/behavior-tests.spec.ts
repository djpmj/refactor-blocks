import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function openStage(page: Page, label: string) {
  await page.goto('/');
  await selectStage(page, label);
}

async function dragMethodToClass(page: Page, methodTestId: string, classTestId: string) {
  const from = await page.getByTestId(methodTestId).boundingBox();
  const to = await page.getByTestId(classTestId).boundingBox();
  if (from === null || to === null) throw new Error('位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await expect(page.getByTestId(classTestId)).toHaveClass(/class-node--drop-target/);
  await page.mouse.up();
}

test('開くとヘッダーに緑のテストバッジが出て、説明と入口ごとのテスト一覧が見える', async ({ page }) => {
  // Arrange & Act
  await openStage(page, 'チュートリアル2: 太った placeOrder');
  const summary = page.getByTestId('test-status-summary');
  await summary.click();

  // Assert
  await expect(summary).toHaveText(/テスト 1\/1 ✓/);
  const status = page.getByTestId('test-status');
  await expect(status).toContainText('振る舞いを変えずに構造だけを変えること');
  await expect(status).toContainText('OrderService.placeOrder の振る舞い(処理');
});

test('メソッドを抽出して別クラスへ移しても、テストは緑のままで名前は今のコードに追従する', async ({ page }) => {
  // Arrange
  await openStage(page, 'チュートリアル2: 太った placeOrder');
  const summary = page.getByTestId('test-status-summary');
  await expect(summary).toHaveText(/テスト 1\/1 ✓/);

  // Act: 税の計算を抽出して TaxCalculator へ移す
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await dragMethodToClass(page, 'method-calculateTax', 'class-TaxCalculator');
  await expect(page.getByTestId('class-TaxCalculator').getByTestId('method-calculateTax')).toBeVisible();

  // Assert
  await expect(summary).toHaveText(/テスト 1\/1 ✓/);

  // Act: クラス名を変える
  await page.getByTestId('class-header-OrderService').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'クラスの名前を変更' }).click();
  await menu.getByLabel('新しいクラス名').fill('OrderUseCase');
  await menu.getByLabel('新しいクラス名').press('Enter');
  await summary.click();

  // Assert
  await expect(summary).toHaveText(/テスト 1\/1 ✓/);
  await expect(page.getByTestId('test-status')).toContainText('OrderUseCase.placeOrder の振る舞い');
});

test('中級7: 初期状態は緑で、抽出して private のまま別クラスへ移すと赤くなり、public にすると緑に戻る', async ({ page }) => {
  // Arrange
  await openStage(page, '中級7: getter/setter だけの口座クラス');
  const summary = page.getByTestId('test-status-summary');
  await expect(summary).toHaveText(/✓/);
  const withdraw = page.getByTestId('method-withdraw');
  await expect(async () => {
    await page.getByRole('button', { name: 'Zoom In' }).click();
    await expect(withdraw).toBeVisible({ timeout: 500 });
  }).toPass();
  await withdraw.click();
  await page.getByLabel('getStatus() で状態を取り出し、凍結されていないか確かめる').check();
  await page.getByLabel('残高と1日の引き出し上限から引き出せるか確かめる').check();
  await page.getByLabel('残高を減らし、本日の引き出し額を足して setter で書き戻す').check();
  await page.getByLabel('新しいメソッド名').fill('debit');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(summary).toHaveText(/✓/);

  // Act: private の debit を Account へ移すと、AccountService から呼べなくなる
  await dragMethodToClass(page, 'method-debit', 'class-Account');
  await summary.click();

  // Assert
  await expect(summary).toHaveText(/✗/);
  await expect(page.getByTestId('test-status')).toContainText('コンパイルエラー: AccountService から Account.debit は呼べません(private)');

  // Act: debit を public にする
  await page.getByTestId('method-debit').click();
  const visibility = page.getByLabel('メソッド debit の可視性');
  await visibility.focus();
  await visibility.press('ArrowUp');

  // Assert
  await expect(visibility).toHaveValue('public');
  await expect(summary).toHaveText(/✓/);
});
