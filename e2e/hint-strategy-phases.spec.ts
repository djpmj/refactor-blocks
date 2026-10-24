import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('上級8の次の一手は、方針の最初の手順の前にだけ方針の見出しと理由を出す', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '上級8: 取り込みの手順を Template Method にまとめる');
  await page.getByTestId('hint-problem').click();
  const next = page.getByRole('button', { name: /次の一手/ });
  const phases = page.getByTestId('hint-phase');
  const hintList = page.locator('.stage-panel__hint-list');

  // Act: 1回目
  await next.click();

  // Assert
  await expect(phases).toHaveCount(1);
  await expect(phases.first()).toContainText('方針: 2つの取り込みを、同じ部品に分ける');
  await expect(phases.first()).toContainText('違うのは「変換」だけです');
  await expect(hintList.locator('li').first().locator('[data-testid="hint-phase"]')).toHaveCount(1);

  // Act: 9回目までに2つ目の方針に入る
  for (let pressed = 1; pressed < 9; pressed++) await next.click();

  // Assert
  await expect(next).toContainText('9/20');
  await expect(phases).toHaveCount(2);
  await expect(phases.nth(1)).toContainText('方針: 共通の部品を1つにまとめる');
  await expect(hintList).not.toContainText('Template Method)');
  await expect(hintList.locator('li').nth(8).locator('[data-testid="hint-phase"]')).toHaveCount(1);

  // Act: 12回目で3つ目の方針に入る
  for (let pressed = 9; pressed < 12; pressed++) await next.click();

  // Assert
  await expect(phases).toHaveCount(3);
  await expect(phases.nth(2)).toContainText('方針: 親クラスに流れを持たせ、違う部分を子に任せる(Template Method)');
});

test('手数の少ないステージの次の一手には方針の見出しが出ない', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級1: 循環依存を断ち切る');
  await page.getByTestId('hint-problem').click();
  const next = page.getByRole('button', { name: /次の一手/ });

  // Act
  await next.click();

  // Assert
  await expect(page.locator('.stage-panel__hint-list li')).toHaveCount(1);
  await expect(page.getByTestId('hint-phase')).toHaveCount(0);
});
