import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

function contrastWithWhite(hex: string): number {
  const luminance = (component: number) => {
    const value = component / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const red = luminance(Number.parseInt(hex.slice(1, 3), 16));
  const green = luminance(Number.parseInt(hex.slice(3, 5), 16));
  const blue = luminance(Number.parseInt(hex.slice(5, 7), 16));
  const brightness = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  return 1.05 / (brightness + 0.05);
}

async function moveMethod(page: Page, methodId: string, classId: string) {
  const source = await page.getByTestId(methodId).boundingBox();
  const target = await page.getByTestId(classId).boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

test('責務の印とクラスごとの種類数を表示し、移動後も印を保つ', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '中級1: 循環依存を断ち切る');
  const orderBadge = page.getByTestId('class-responsibilities-Order');
  await expect(orderBadge).toHaveText('責務 5種類(上限 4)');
  await expect(orderBadge).toHaveClass(/responsibility-count--over/);

  await page.getByTestId('method-checkout').click();
  const list = page.locator('.fragment-list');
  const pricingMarks = list.locator('li').filter({ hasText: '合計金額を求める' }).getByLabel(/^責務 /);
  await expect(pricingMarks).toHaveAttribute('aria-label', '責務 B');
  await expect(list.locator('li').filter({ hasText: '会員ランクで割引する' }).getByLabel(/^責務 /)).toHaveAttribute('aria-label', '責務 C');

  await page.getByLabel('合計金額を求める').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTotal');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(list.getByLabel('責務 B')).toHaveCount(0);
  await expect(list.getByText('calculateTotal() を呼び出す')).toBeVisible();
  await expect(list.getByText('calculateTotal() を呼び出す').getByLabel(/^責務 /)).toHaveCount(0);

  await page.getByTestId('method-countOrdersOf').click();
  await expect(page.getByLabel('責務 E')).toBeVisible();
  await moveMethod(page, 'method-countOrdersOf', 'class-Customer');
  await expect(page.getByTestId('class-responsibilities-Order')).toHaveText('責務 4種類');
  await expect(page.getByTestId('class-responsibilities-Order')).not.toHaveClass(/responsibility-count--over/);
  await page.getByTestId('method-countOrdersOf').click();
  await expect(page.getByLabel('責務 E')).toBeVisible();

  const mark = page.getByLabel('責務 E');
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(mark).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(mark).toHaveCSS('background-color', colorScheme === 'light' ? 'rgb(52, 95, 156)' : 'rgb(71, 120, 181)');
    const palette = colorScheme === 'light'
      ? ['#4d3da8', '#006b86', '#8a4d00', '#8b3f72', '#345f9c', '#665600', '#76502b', '#006b68']
      : ['#6858c6', '#087d9b', '#a86600', '#a34f86', '#4778b5', '#806c00', '#8e6838', '#007d79'];
    expect(palette.every((color) => contrastWithWhite(color) >= 4.5)).toBe(true);
  }
});
