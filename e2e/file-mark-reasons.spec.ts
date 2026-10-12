import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('ファイルの警告にマウス・キーボードで理由を表示し、キャンバス操作を妨げない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '初級1: 何でも屋の UserController');
  const repository = page.getByTestId('file-src/user/UserRepository.ts');
  const warning = repository.getByTestId('file-mark');

  // Act / Assert: 空クラスの理由を表示し、隣接ノードより前面に出す
  await warning.hover();
  const tooltip = page.getByTestId('file-mark-reasons');
  await expect(tooltip).toContainText('空のクラス・ファイル: UserRepository -10点');
  await expect(tooltip).toContainText('何も入っていないクラスやファイル');
  await expect(tooltip).toHaveCSS('position', 'fixed');
  await expect(tooltip).toHaveCSS('z-index', '10000');
  await expect(tooltip).toHaveAttribute('role', 'tooltip');
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);

  // Act / Assert: Tab でアイコンに移動すると開き、Escape とフォーカス移動で閉じる
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await warning.evaluate((element) => element.ownerDocument.activeElement === element)) break;
    await page.keyboard.press('Tab');
  }
  await expect(warning).toBeFocused();
  await expect(tooltip).toBeVisible();
  const tooltipId = await tooltip.getAttribute('id');
  if (tooltipId === null) throw new Error('ポップオーバーのIDがありません');
  await expect(warning).toHaveAttribute('aria-describedby', tooltipId);
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(warning).not.toBeFocused();
  await expect(tooltip).toHaveCount(0);

  // Act / Assert: アイコンを押してもファイルやキャンバスを動かさない
  const fileBoundsBefore = await repository.boundingBox();
  const viewport = page.locator('.react-flow__viewport');
  const transformBefore = await viewport.getAttribute('style');
  await warning.hover();
  const iconBounds = await warning.boundingBox();
  if (iconBounds === null) throw new Error('ファイル警告アイコンが見つかりません');
  await page.mouse.move(iconBounds.x + iconBounds.width / 2, iconBounds.y + iconBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(iconBounds.x + iconBounds.width / 2 + 18, iconBounds.y + iconBounds.height / 2 + 12, { steps: 3 });
  await page.mouse.up();
  expect(await repository.boundingBox()).toEqual(fileBoundsBefore);
  expect(await viewport.getAttribute('style')).toBe(transformBefore);

  // Act / Assert: dnd-kit のドラッグ開始後はフォーカス中でもポップオーバーを隠す
  await warning.evaluate((element) => element.blur());
  await warning.focus();
  await expect(tooltip).toBeVisible();
  const method = page.locator('.method-chip-button[data-testid^="method-"]').first();
  const methodBounds = await method.boundingBox();
  if (methodBounds === null) throw new Error('メソッドが見つかりません');
  await page.mouse.move(methodBounds.x + 10, methodBounds.y + methodBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(methodBounds.x + 30, methodBounds.y + methodBounds.height / 2 + 3, { steps: 3 });
  await expect(tooltip).toHaveCount(0);
  await page.mouse.up();

  // Act / Assert: 危険ファイルの項目合計と見出しの点数が一致する
  const dangerMark = page.locator('[data-testid="file-mark"][data-severity="danger"]');
  await dangerMark.hover();
  const dangerTooltip = page.getByTestId('file-mark-reasons');
  await expect(dangerTooltip).toContainText('危険: -');
  const header = (await dangerTooltip.locator('strong').innerText()).match(/-(\d+)点/);
  const itemPoints = await dangerTooltip.locator('li').allInnerTexts();
  const sum = itemPoints.reduce((total, item) => total + Number(item.match(/-(\d+)点/)?.[1] ?? 0), 0);
  expect(header).not.toBeNull();
  expect(sum).toBe(Number(header?.[1]));
});
