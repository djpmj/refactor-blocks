import { expect, test } from '@playwright/test';

test('サイドバー開閉ボタンが境界に沿って動く', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: '課題とヒント' });
  const closeButton = page.getByRole('button', { name: 'サイドバーを閉じる' });
  const header = page.locator('header.stage-panel');
  await expect(sidebar).toBeVisible();
  await expect(header.getByRole('button', { name: /サイドバー/ })).toHaveCount(0);

  // Assert: 開いているときはサイドバー右端に重なり、ヘッダーより下にある
  const sidebarBox = await sidebar.boundingBox();
  const openButtonBox = await closeButton.boundingBox();
  const headerBox = await header.boundingBox();
  if (sidebarBox === null || openButtonBox === null || headerBox === null) throw new Error('要素の位置を取得できません');
  expect(Math.abs(openButtonBox.x - (sidebarBox.x + sidebarBox.width))).toBeLessThanOrEqual(30);
  expect(openButtonBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);

  // Act: 閉じる
  await closeButton.click();

  // Assert
  const openButton = page.getByRole('button', { name: 'サイドバーを開く' });
  await expect(sidebar).toBeHidden();
  await expect(openButton).toHaveAttribute('aria-expanded', 'false');
  const closedButtonBox = await openButton.boundingBox();
  if (closedButtonBox === null) throw new Error('開閉ボタンの位置を取得できません');
  expect(closedButtonBox.x).toBeLessThan(40);

  // Act: 再度開く
  await openButton.click();

  // Assert
  await expect(sidebar).toBeVisible();
  await expect(page.getByRole('button', { name: 'サイドバーを閉じる' })).toHaveAttribute('aria-expanded', 'true');
});

test('狭い画面でも閉じたサイドバーのボタンをキーボードで操作できる', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: '課題とヒント' });
  const openButton = page.getByRole('button', { name: 'サイドバーを開く' });
  await expect(sidebar).toBeHidden();
  await expect(openButton).toBeVisible();
  const buttonBox = await openButton.boundingBox();
  if (buttonBox === null) throw new Error('開閉ボタンの位置を取得できません');
  expect(buttonBox.x).toBeLessThan(40);

  // Act: ヘッダーの操作部品をTabで進み、Spaceで開く
  for (let tab = 0; tab < 11; tab++) await page.keyboard.press('Tab');
  await expect(openButton).toBeFocused();
  await page.keyboard.press('Space');

  // Assert
  await expect(sidebar).toBeVisible();
  await expect(page.getByRole('button', { name: 'サイドバーを閉じる' })).toHaveAttribute('aria-expanded', 'true');
});
