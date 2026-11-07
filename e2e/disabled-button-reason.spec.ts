import { expect, test, type Locator, type Page } from '@playwright/test';
import { releaseAllManualFixSites, selectStage, startChangeRequests } from './selectStage.js';

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === element.ownerDocument.activeElement)) return;
  }
  throw new Error('Tab で対象のボタンへ到達できません');
}

async function openTutorial2(page: Page): Promise<void> {
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
}

test('変更依頼ボタンの理由をキーボードで読める', async ({ page }) => {
  await openTutorial2(page);
  const button = page.getByTestId('change-request-start');
  await tabTo(page, button);
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(button).toHaveAccessibleDescription('点数が100点になると挑戦できます');
  const reason = page.locator('.reason-button', { has: button }).locator('.reason-button__reason');
  await expect(reason).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('change-panel')).toHaveCount(0);
  await expect(reason).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(reason).toBeHidden();
});

test('元に戻すボタンの理由をキーボードで読める', async ({ page }) => {
  await openTutorial2(page);
  const button = page.getByRole('button', { name: '元に戻す' });
  await tabTo(page, button);
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(button).toHaveAccessibleDescription('まだ元に戻せる操作がありません');
  await expect(page.locator('.reason-button', { has: button }).locator('.reason-button__reason')).toBeVisible();
});

test('クリックで理由を表示し、本来の処理を止める', async ({ page }) => {
  await openTutorial2(page);
  const button = page.getByTestId('change-request-start');
  // aria-disabled の操作可能チェックを避け、押されたときの処理を確認する。
  await button.click({ force: true });
  await expect(page.locator('.reason-button', { has: button }).locator('.reason-button__reason')).toBeVisible();
  await expect(page.getByTestId('change-panel')).toHaveCount(0);
});

test('抽出ボタンへ Tab で到達し理由を読める', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.locator('.method-chip-button').first().click();
  const input = page.getByRole('textbox', { name: '新しいメソッド名' });
  await input.click();
  await page.keyboard.press('Tab');
  const button = page.locator('[data-tour="extract-button"]');
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(button).toHaveAccessibleDescription('処理を1つ以上選ぶと押せます');
});

test('抽出後は元に戻すボタンが押せる', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('画面に出力する').check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const undo = page.getByRole('button', { name: '元に戻す' });
  await tabTo(page, undo);
  await expect(undo).not.toHaveAttribute('aria-disabled', 'true');
  await expect(undo).not.toHaveAttribute('aria-describedby', /.+/);
  await expect(undo).toHaveAttribute('title', 'Ctrl+Z');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('method-printSalesReport')).toHaveCount(0);
});

async function extractTutorial2(page: Page, fragment: string, name: string): Promise<void> {
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel(fragment).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('実装中は最初に戻す理由が付く', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openTutorial2(page);
  const sidebarOpen = page.getByRole('button', { name: 'サイドバーを開く' });
  if (await sidebarOpen.count() > 0) await sidebarOpen.click();
  await extractTutorial2(page, '消費税を計算する(軽減税率あり)', 'calculateTax');
  const source = await page.getByTestId('method-calculateTax').boundingBox();
  const target = await page.getByTestId('class-TaxCalculator').boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象がありません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await extractTutorial2(page, '注文をDBに保存する', 'saveOrder');
  await extractTutorial2(page, '確認メールを送る', 'sendConfirmationMail');
  await extractTutorial2(page, '在庫があるか検証する', 'validateStock');
  await releaseAllManualFixSites(page);
  await startChangeRequests(page);
  await expect(page.getByRole('button', { name: '最初に戻す' })).toHaveAccessibleDescription('変更依頼の実装中は使えません(「実装を終える」か「やめる」で戻ります)');
});
