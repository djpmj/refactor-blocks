import { expect, test, type Page } from '@playwright/test';

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
  await page.getByLabel('ステージ').selectOption({ label: '中級1: 循環依存を断ち切る' });

  const card = page.getByRole('region', { name: 'もし、この変更が来たら?' });
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
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル2: 太った placeOrder' });
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
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await page.getByRole('button', { name: 'サイドバーを閉じる' }).click();
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByTestId('score')).not.toContainText('100');
  await page.getByRole('button', { name: 'やり直し' }).click();
  await expect(page.getByTestId('score')).toContainText('100');
  await expect(page.getByRole('button', { name: 'サイドバーを開く' })).toHaveAttribute('aria-expanded', 'false');

  await page.getByTestId('change-request-start').click();
  await expect(page.getByTestId('change-panel')).toBeVisible();
  await expect(page.locator('.change-pain')).toHaveCount(0);
});
