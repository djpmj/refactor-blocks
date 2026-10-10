import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function extract(page: Page, fragmentLabel: string, name?: string) {
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel(fragmentLabel).check();
  if (name !== undefined) await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

async function move(page: Page, methodId: string, classId: string) {
  const source = await page.getByTestId(methodId).boundingBox();
  const target = await page.getByTestId(classId).boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

test('困りごと・クリア条件・ヒントが上に並び、ヒントは同じ欄に追加される', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await page.getByTestId('story-toggle').click();
  const sidebar = page.getByRole('complementary', { name: '課題とヒント' });
  await expect(sidebar.getByRole('heading', { name: '困っていること' })).toBeVisible();
  await expect(sidebar.getByText('placeOrderに検証と保存がまとまっている')).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'クリア条件' })).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'ヒント', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /ヒントを見る/ })).toBeVisible();
  await expect(page.getByTestId('stage-description')).toBeHidden();
  await expect(sidebar).not.toContainText('メソッドは20行以内');

  const order = await sidebar.evaluate((element) => {
    const selectors = ['.story-card', '.stage-panel__problem', '.clear-conditions', '.stage-panel__hints', '.change-pain', '.stage-panel__description'];
    return selectors.map((selector) => {
      const target = element.querySelector(selector);
      return target === null ? -1 : [...element.children].indexOf(target);
    });
  });
  expect(order.slice(1)).toEqual([...order.slice(1)].sort((left, right) => left - right));

  await page.getByRole('button', { name: /ヒントを見る/ }).click();
  await expect(sidebar.locator('.stage-panel__hint-list li')).toHaveCount(1);
});

test('ストーリーを閉じても1行で残り、押すと開き直せる', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await page.getByTestId('story-toggle').click();
  const story = page.getByTestId('story-intro');
  await expect(story).toBeVisible();
  await story.getByRole('button', { name: '閉じる' }).click();
  const reopen = page.getByRole('button', { name: /第2章/ });
  await expect(reopen).toHaveAttribute('aria-expanded', 'false');
  await reopen.click();
  await expect(page.getByTestId('story-intro')).toBeVisible();
});

test('変更の痛みは要約で閉じ、開くと詳細と手動修正が見える', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  const card = page.getByRole('region', { name: 'もし、この変更が来たら?' });
  await expect(card.locator('details')).not.toHaveAttribute('open', '');
  await expect(card.locator('summary')).toContainText('か所・');
  await expect(card.getByText('軽減税率8%に対応して')).toBeHidden();
  await card.locator('summary').click();
  await expect(card.getByText('軽減税率8%に対応して')).toBeVisible();
  await expect(card.getByRole('button', { name: '実際に直してみる' })).toBeVisible();
});

test('操作でクリア条件が更新され、100点では全件達成になる', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const conditions = page.locator('.clear-conditions');
  await expect(conditions.locator('li[aria-label^="未達成:"]')).toHaveCount(3);

  await extract(page, '消費税を計算する(軽減税率あり)', 'calculateTax');
  await move(page, 'method-calculateTax', 'class-TaxCalculator');
  await extract(page, '注文をDBに保存する', 'saveOrder');
  await extract(page, '確認メールを送る', 'sendConfirmationMail');
  await extract(page, '在庫があるか検証する', 'validateStock');

  await expect(page.getByTestId('score')).toContainText('100点');
  await expect(conditions.locator('li[aria-label^="達成:"]')).toHaveCount(await conditions.locator('li').count());
  await expect(page.getByRole('region', { name: 'なぜ分けるのか' }).locator('details')).toHaveAttribute('open', '');
});
