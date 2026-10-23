import { expect, test } from '@playwright/test';
import { releaseAllManualFixSites, selectStage, startChangeRequests } from './selectStage.js';

async function perfectOrderRefactor(page: import('@playwright/test').Page) {
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await drag(page, 'method-calculateTax', 'class-TaxCalculator');
  for (const [fragment, name] of [['注文をDBに保存する', 'saveOrder'], ['確認メールを送る', 'sendConfirmationMail'], ['在庫があるか検証する', 'validateStock']] as const) {
    await page.getByTestId('method-placeOrder').click();
    await page.getByLabel(fragment).check();
    await page.getByLabel('新しいメソッド名').fill(name);
    await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  }
  await expect(page.getByTestId('score')).toContainText('100');
}

async function extract(page: import('@playwright/test').Page, fragment: string, name: string) {
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel(fragment).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

async function drag(page: import('@playwright/test').Page, method: string, target: string) {
  const source = await page.getByTestId(method).boundingBox();
  const destination = await page.getByTestId(target).boundingBox();
  if (source === null || destination === null) throw new Error('ドラッグ対象が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 10 });
  await page.mouse.up();
}

test('冒頭の手直しを終えるまで編集を止め、仕上げを正解してから変更依頼へ進む', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder', { completeOpeningFix: false });

  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.locator('.error-toast')).toContainText('まず「もし、この変更が来たら?」');
  await expect(page.getByTestId('method-calculateTax')).toHaveCount(0);

  await page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' }).click();
  const opening = page.getByRole('region', { name: '手で直すシミュレーション' });
  await opening.getByRole('button', { name: 'リリースする' }).click();
  await expect(opening).toContainText('直し忘れ');
  await opening.getByRole('button', { name: '組み替えを始める' }).click();

  await extract(page, '消費税を計算する(軽減税率あり)', 'calculateTax');
  await drag(page, 'method-calculateTax', 'class-TaxCalculator');
  await extract(page, '注文をDBに保存する', 'saveOrder');
  await extract(page, '確認メールを送る', 'sendConfirmationMail');
  await extract(page, '在庫があるか検証する', 'validateStock');
  await expect(page.getByTestId('score')).toContainText('100');
  await expect(page.getByTestId('change-request-start')).toBeDisabled();
  const card = page.locator('.change-pain');
  await expect(card).toContainText('もし、この変更が来たら?(もう一度)');
  await expect(card).not.toContainText('か所 →');

  await card.getByRole('button', { name: '実際に直してみる' }).click();
  const closing = page.getByRole('region', { name: '手で直すシミュレーション' });
  await page.getByTestId('method-placeOrder').click();
  await closing.getByRole('button', { name: 'リリースする' }).click();
  await expect(closing).toContainText('関係のないメソッド');
  await expect(page.getByTestId('change-request-start')).toBeDisabled();

  await releaseAllManualFixSites(page);
  await expect(closing.getByTestId('fix-comparison')).toBeVisible();
  await expect(page.getByTestId('change-request-start')).toBeEnabled();
  await startChangeRequests(page);
  await expect(page.getByTestId('change-panel')).toBeVisible();
});

test('reset後はclosing fixを正解し直すまで変更依頼に進めない', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await perfectOrderRefactor(page);
  const card = page.locator('.change-pain');
  await card.getByRole('button', { name: '実際に直してみる' }).click();
  await releaseAllManualFixSites(page);
  await expect(page.getByTestId('change-request-start')).toBeEnabled();

  await page.getByRole('button', { name: '最初に戻す' }).click();
  await expect(page.getByTestId('change-request-start')).toBeDisabled();
  await perfectOrderRefactor(page);
  await expect(page.getByTestId('change-request-start')).toBeDisabled();
  await card.getByRole('button', { name: '実際に直してみる' }).click();
  await releaseAllManualFixSites(page);
  await expect(page.getByTestId('change-request-start')).toBeEnabled();
});

test('draft再開後はopening fixを省略し、比較に冒頭結果がない説明を表示する', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await perfectOrderRefactor(page);
  await page.reload();
  await selectStage(page, 'チュートリアル2: 太った placeOrder', { completeOpeningFix: false });
  await expect(page.getByTestId('score')).toContainText('100');
  await expect(page.getByTestId('change-request-start')).toBeDisabled();

  await page.locator('.change-pain').getByRole('button', { name: '実際に直してみる' }).click();
  const closing = page.getByRole('region', { name: '手で直すシミュレーション' });
  await releaseAllManualFixSites(page);
  const comparison = closing.getByTestId('fix-comparison');
  await expect(comparison).toBeVisible();
  await expect(comparison).toContainText('直す場所');
  await expect(comparison).not.toContainText('冒頭');
  await expect(page.getByTestId('change-request-start')).toBeEnabled();
});
