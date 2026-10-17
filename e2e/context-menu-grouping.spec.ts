import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('中級10の右クリックメニューを対象別に分ける', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級10: 会員ランクごとのif分岐をクラスに分ける');
  await page.getByTestId('method-quotePrice').click({ button: 'right' });

  const menu = page.getByTestId('context-menu');
  const groups = menu.getByRole('group');
  await expect(groups).toHaveCount(4);
  await expect(groups.nth(0)).toHaveAttribute('aria-label', 'メソッド quotePrice()');
  await expect(groups.nth(1)).toHaveAttribute('aria-label', 'クラス PriceCalculator');
  await expect(groups.nth(2)).toHaveAttribute('aria-label', 'このファイル');
  await expect(groups.nth(3)).toHaveAttribute('aria-label', 'キャンバス');
  await expect(menu.locator(':scope > div[role="menu"] > div[role="separator"]')).toHaveCount(3);
  const deleteClass = menu.getByRole('menuitem', { name: 'PriceCalculator を削除' });
  await expect(deleteClass).toBeVisible();
  await expect(deleteClass).toHaveCSS('color', 'rgb(214, 69, 69)');
});

test('キーボードでメソッドを新しいクラスへ移動し、Ctrl+Zで戻せる', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級10: 会員ランクごとのif分岐をクラスに分ける');
  const method = page.getByTestId('method-quotePrice');
  await method.click({ button: 'right' });
  await page.mouse.move(0, 0);

  const menu = page.getByTestId('context-menu');
  const moveTrigger = menu.getByRole('menuitem', { name: '別のクラスへ移動' });
  await expect(moveTrigger).toBeFocused();
  await expect(moveTrigger).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowRight');
  const submenu = menu.getByRole('menu', { name: '別のクラスへ移動' });
  const newClass = submenu.getByRole('menuitem', { name: '新しいクラスへ' });
  await expect(moveTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(newClass).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(newClass).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('class-PriceCalculator').getByTestId('method-quotePrice')).toHaveCount(0);
  const generatedFile = page.getByTestId('file-src/NewClass.ts');
  const generatedClass = page.getByTestId('class-RegularRank');
  await expect(generatedFile).toBeVisible();
  await expect(generatedClass.getByTestId('method-quotePrice')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('class-PriceCalculator').getByTestId('method-quotePrice')).toBeVisible();
});
