import { expect, test } from '@playwright/test';

test('サイドバー開閉ボタンが境界の外側に接して動く', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: '課題とヒント' });
  const closeButton = page.getByRole('button', { name: 'サイドバーを閉じる' });
  const header = page.locator('header.stage-panel');
  await expect(sidebar).toBeVisible();
  await expect(header.getByRole('button', { name: /サイドバー/ })).toHaveCount(0);

  // Assert: 開いているときはサイドバーの右端に接し、ヘッダーより下にある
  const sidebarBox = await sidebar.boundingBox();
  const openButtonBox = await closeButton.boundingBox();
  const headerBox = await header.boundingBox();
  if (sidebarBox === null || openButtonBox === null || headerBox === null) throw new Error('要素の位置を取得できません');
  const buttonGap = openButtonBox.x - (sidebarBox.x + sidebarBox.width);
  expect(buttonGap).toBeGreaterThanOrEqual(0);
  expect(buttonGap).toBeLessThanOrEqual(2);
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

test('左サイドバーをドラッグとキーボードで調整し、開閉後も幅と境界を保つ', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: '課題とヒント' });
  const handle = page.getByRole('separator', { name: '課題とヒントの幅を変更' });
  const toggle = page.getByRole('button', { name: 'サイドバーを閉じる' });
  await expect(sidebar).toBeVisible();
  await expect(handle).toHaveAttribute('aria-valuenow', '260');
  await expect(handle).toHaveAttribute('aria-valuemin', '200');
  await expect(handle).toHaveAttribute('aria-valuemax', '480');

  // Act: 左サイドバーは右ドラッグで広がる
  const handleBox = await handle.boundingBox();
  if (handleBox === null) throw new Error('リサイズハンドルが見つかりません');
  await page.mouse.move(handleBox.x + 3, handleBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 103, handleBox.y + 100, { steps: 4 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '360');
  await handle.focus();
  await page.keyboard.press('ArrowLeft');

  // Assert
  await expect(handle).toHaveAttribute('aria-valuenow', '344');
  const narrowedHandleBox = await handle.boundingBox();
  if (narrowedHandleBox === null) throw new Error('リサイズハンドルが見つかりません');
  await page.mouse.move(narrowedHandleBox.x + 3, narrowedHandleBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(narrowedHandleBox.x - 500, narrowedHandleBox.y + 100, { steps: 4 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '200');
  await expect(sidebar).toHaveCSS('overflow-wrap', 'anywhere');
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '200');
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '216');
  const sidebarBox = await sidebar.boundingBox();
  const toggleBox = await toggle.boundingBox();
  if (sidebarBox === null || toggleBox === null) throw new Error('サイドバーまたは開閉ボタンの位置を取得できません');
  expect(toggleBox.x - (sidebarBox.x + sidebarBox.width)).toBeGreaterThanOrEqual(0);
  expect(toggleBox.x - (sidebarBox.x + sidebarBox.width)).toBeLessThanOrEqual(2);

  // Act: 閉じている間はハンドルを隠し、開き直す
  await toggle.click();
  await expect(handle).toHaveCount(0);
  await page.getByRole('button', { name: 'サイドバーを開く' }).click();

  // Assert
  await expect(handle).toHaveAttribute('aria-valuenow', '216');
  await page.reload();
  await expect(page.getByRole('separator', { name: '課題とヒントの幅を変更' })).toHaveAttribute('aria-valuenow', '260');
});

test('狭い画面では左サイドバーを40vw以内に収めてキャンバスを表示する', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: '課題とヒント' });
  await page.getByRole('button', { name: 'サイドバーを開く' }).click();

  // Assert
  const sidebarBox = await sidebar.boundingBox();
  const toggleBox = await page.getByRole('button', { name: 'サイドバーを閉じる' }).boundingBox();
  if (sidebarBox === null || toggleBox === null) throw new Error('サイドバーまたは開閉ボタンの位置を取得できません');
  expect(sidebarBox.width).toBeLessThanOrEqual(375 * 0.4 + 1);
  const buttonGap = toggleBox.x - (sidebarBox.x + sidebarBox.width);
  expect(buttonGap).toBeGreaterThanOrEqual(0);
  expect(buttonGap).toBeLessThanOrEqual(2);
  const handle = page.getByRole('separator', { name: '課題とヒントの幅を変更' });
  await expect(handle).toHaveAttribute('aria-valuenow', '150');
  await expect(handle).toHaveAttribute('aria-valuemin', '120');
  await expect(handle).toHaveAttribute('aria-valuemax', '150');
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '134');
  await expect(sidebar).toHaveCSS('width', '134px');
  await expect(page.locator('.app__canvas')).toBeVisible();
});

test('長い内容をスクロールしてもボタンがスクロールバー上端に重ならない', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: '上級3: 会員ランクの割引をStrategyパターンへ組み替える' });
  const sidebar = page.getByRole('complementary', { name: '課題とヒント' });
  const toggle = page.getByRole('button', { name: 'サイドバーを閉じる' });
  await expect(sidebar).toBeVisible();

  // Assert: 縦スクロールが必要な高さでも境界外にボタンがある
  const hasOverflow = await sidebar.evaluate((element) => element.scrollHeight > element.clientHeight);
  expect(hasOverflow).toBe(true);
  const sidebarBox = await sidebar.boundingBox();
  const toggleBox = await toggle.boundingBox();
  if (sidebarBox === null || toggleBox === null) throw new Error('サイドバーまたは開閉ボタンの位置を取得できません');
  const buttonGap = toggleBox.x - (sidebarBox.x + sidebarBox.width);
  expect(buttonGap).toBeGreaterThanOrEqual(0);
  expect(buttonGap).toBeLessThanOrEqual(2);

  // Act: スクロールしてもサイドバーがボタンの下に残る
  await sidebar.evaluate((element) => { element.scrollTop = element.scrollHeight; });

  // Assert
  const scrollTop = await sidebar.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  await expect(toggle).toBeVisible();
});

test('狭い画面でも閉じたサイドバーのボタンをキーボードで操作できる', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
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
  const closeButton = page.getByRole('button', { name: 'サイドバーを閉じる' });
  await expect(closeButton).toHaveAttribute('aria-expanded', 'true');
  await expect(closeButton).toBeFocused();
  await expect(closeButton).toBeVisible();
  const focusVisible = await closeButton.evaluate((element) => element.matches(':focus-visible'));
  expect(focusVisible).toBe(true);

  // Act: Enterでも閉じ、再度開く
  await page.keyboard.press('Enter');

  // Assert
  await expect(sidebar).toBeHidden();
  await expect(openButton).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(sidebar).toBeVisible();
  await expect(page.getByRole('button', { name: 'サイドバーを閉じる' })).toHaveAttribute('aria-expanded', 'true');
});
