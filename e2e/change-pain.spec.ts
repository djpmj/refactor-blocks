import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function dragMethodToClass(page: Page, methodId: string, classId: string) {
  const source = await page.getByTestId(methodId).boundingBox();
  const target = await page.getByTestId(classId).boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function extract(page: Page, fragmentLabel: string, name?: string) {
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel(fragmentLabel).check();
  if (name !== undefined) await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('開始時に変更の痛みが見え、責務を寄せると直すクラス数が減る', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '中級1: 循環依存を断ち切る');

  const card = page.getByRole('region', { name: 'もし、この変更が来たら?' });
  await card.locator('summary').click();
  await expect(card).toContainText('価格の計算ルールを変えて');
  await expect(card).toContainText('直す場所は今 3 か所');
  await expect(card).toContainText('2 クラス');

  await dragMethodToClass(page, 'method-calculateOrderTotal', 'class-Order');
  await dragMethodToClass(page, 'method-getLines', 'class-Order');
  await expect(card).toContainText('直す場所は今 3 か所');
  await expect(card).toContainText('1 クラス');
});

test('100点で理由を見せてサイドバーを一度だけ自動で開く', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const openToggle = page.getByRole('button', { name: 'サイドバーを開く' });
  await expect(openToggle).toBeVisible();
  await expect(page.getByRole('region', { name: 'もし、この変更が来たら?' })).toBeHidden();

  await extract(page, '消費税を計算する(軽減税率あり)', 'calculateTax');
  await dragMethodToClass(page, 'method-calculateTax', 'class-TaxCalculator');
  await extract(page, '注文をDBに保存する', 'saveOrder');
  await extract(page, '確認メールを送る', 'sendConfirmationMail');
  await extract(page, '在庫があるか検証する', 'validateStock');

  const reason = page.getByRole('region', { name: 'なぜ分けるのか' });
  const toggle = page.locator('.sidebar-toggle');
  await expect(page.getByTestId('score')).toContainText('100');
  await expect(reason).toContainText('税率');
  await expect(reason).toContainText('読む量は');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await page.getByRole('button', { name: 'サイドバーを閉じる' }).click();
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByTestId('method-validateStock')).toHaveCount(0);
  await page.getByRole('button', { name: 'やり直し' }).click();
  await expect(page.getByTestId('method-validateStock')).toBeVisible();
  await expect(page.getByTestId('score')).toContainText('100');
  await expect(page.getByRole('button', { name: 'サイドバーを開く' })).toHaveAttribute('aria-expanded', 'false');

  await page.getByTestId('change-request-start').click();
  await expect(page.getByTestId('change-panel')).toBeVisible();
  await expect(page.locator('.change-pain')).toHaveCount(0);
});

test('チュートリアル1の読む行数は実コードと一致する', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  const card = page.getByRole('region', { name: 'もし、この変更が来たら?' });
  await card.locator('summary').click();
  await expect(card).toContainText('目を通す行数は今 30 行');
  await expect(card).toContainText('ReportService.printMonthlyReport(30行)');

  const locations = page.locator('.change-pain li');
  const originalLocations = await locations.evaluateAll((items) => items.map((item) => ({
    text: item.textContent,
    childCount: item.childElementCount,
  })));
  await expect(locations).toHaveCount(1);
  await expect.poll(() => locations.first().evaluate((item) => item.scrollWidth <= item.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 600, height: 900 });
  await expect.poll(() => locations.first().evaluate((item) => item.scrollWidth <= item.clientWidth)).toBe(true);
  expect(await locations.evaluateAll((items) => items.map((item) => ({
    text: item.textContent,
    childCount: item.childElementCount,
  })))).toEqual(originalLocations);
  await expect(card).toContainText('ReportService.printMonthlyReport(30行)');
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('表のヘッダーを組み立てる').check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(card).toContainText('目を通す行数は今 29 行');
  await expect(card).toContainText('最初は 30 行でした');
  await expect(card).toContainText('ReportService.printMonthlyReport(29行)');
});

test('種類を足すときに書き換えるクラス数が見え、ランクごとのクラスに組み替えると0になる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '中級10: 会員ランクごとのif分岐をクラスに分ける');
  const card = page.getByRole('region', { name: 'もし、この変更が来たら?' });
  await card.locator('summary').click();
  await expect(card.getByRole('heading', { name: '新しい種類を足すなら?' })).toBeVisible();
  await expect(card).toContainText('ゴールド会員を追加して');
  await expect(card).toContainText('既存の 1 クラスを書き換えます');
  await expect(card.locator('.change-pain__extend li')).toContainText('PriceCalculator');

  // Extract Method だけでは数字は変わらない
  await page.getByTestId('method-quotePrice').click();
  await page.getByLabel('会員ランクが「通常」なら、定価で計算する').check();
  await page.getByLabel('新しいメソッド名').fill('calculatePrice');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(card).toContainText('既存の 1 クラスを書き換えます');
  await expect(page.getByTestId('score')).not.toContainText('100');
});

test('ランクのクラスにMemberRankを実装させると、新しいクラスを足すだけで済む表示に変わる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '中級10: 会員ランクごとのif分岐をクラスに分ける');
  const card = page.getByRole('region', { name: 'もし、この変更が来たら?' });
  await card.locator('summary').click();
  await expect(card).toContainText('既存の 1 クラスを書き換えます');

  await page.getByTestId('method-quotePrice').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'このファイルにクラスを追加' }).click();
  await menu.getByLabel('追加するクラス名').fill('RegularRank');
  await menu.getByRole('button', { name: '追加' }).click();
  await expect(card).toContainText('既存の 1 クラスを書き換えます');

  await page.getByTestId('class-header-RegularRank').click({ button: 'right' });
  await menu.getByRole('menuitem', { name: '実装するインターフェースを設定' }).click();
  await menu.getByRole('menuitemcheckbox', { name: 'MemberRank' }).click();
  await page.keyboard.press('Escape');

  await expect(card).toContainText('既存のクラスを書き換えずに、新しいクラスを足すだけで済みます');
  await expect(card).toContainText('最初は 1 クラスでした');
  await expect(page.getByTestId('score')).not.toContainText('100');
});
