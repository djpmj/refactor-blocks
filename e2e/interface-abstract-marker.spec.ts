import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';
import { openReferenceItem } from './referenceMenuActions.js';

test('中級10のインターフェース役は印と契約メソッド表示を持つ', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級10: 会員ランクごとのif分岐をクラスに分ける');
  const memberRank = page.getByTestId('class-MemberRank');
  await expect(memberRank.getByText('«interface»')).toBeVisible();
  await expect(memberRank.getByTestId('method-calculatePrice').getByText('中身なし')).toBeVisible();
  await expect(page.getByTestId('class-PriceCalculator').getByText('«interface»')).toHaveCount(0);
  await expect(memberRank).toHaveCSS('border-top-style', 'dashed');
  const markerBox = await memberRank.getByText('«interface»').boundingBox();
  const nameBox = await memberRank.locator('.class-node__name').boundingBox();
  if (markerBox === null || nameBox === null) throw new Error('インターフェース印またはクラス名が見つかりません');
  expect(markerBox.y + markerBox.height).toBeLessThanOrEqual(nameBox.y);
});

test('上級3の解答例プレビューでStrategyにinterface印を出す', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '上級3: 会員ランクの割引をStrategyパターンへ組み替える');
  await openReferenceItem(page, 'reference-sample');
  await expect(page.getByTestId('codebase-preview').getByTestId('preview-class-DiscountStrategy').getByText('«interface»')).toBeVisible();
});

test('抽象クラスは名前の上に印を置き、枠を破線にしない', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '上級8: 取り込みの手順を Template Method にまとめる');
  const baseImporter = page.getByTestId('class-OrderImporter');
  await expect(baseImporter.getByText('«abstract»')).toBeVisible();
  await expect(baseImporter).toHaveCSS('border-top-style', 'solid');
  await expect(baseImporter.locator('.class-node__name')).toHaveCSS('font-style', 'italic');
});
