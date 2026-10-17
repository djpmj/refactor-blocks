import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('中級3の越境矢印を説明し、Move Method後に警告を消す', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級3: 越境する private メソッド');

  const edge = page.locator('.react-flow__edge.edge--visibility');
  await expect(edge).toHaveCount(1);
  await expect(edge).toHaveClass(/animated/);
  await expect(edge.locator('.react-flow__edge-path')).toHaveCSS('stroke-dasharray', '2px, 5px');
  await expect(edge.locator('.react-flow__edge-path')).toHaveCSS('animation-duration', '1.5s');

  const badge = page.getByRole('button', { name: 'この矢印の問題を見る' });
  await badge.focus();
  await page.keyboard.press('Enter');
  await expect(badge).toHaveAttribute('aria-expanded', 'true');
  const popover = page.getByRole('dialog', { name: '矢印の問題の説明' });
  await expect(popover).toContainText('private のメソッドが外のクラスから呼ばれています');
  await expect(popover).toContainText('renderTemplate');
  await expect(popover).toContainText('こう困ります:');
  await expect(popover).toContainText('だから:');
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);

  await badge.click();
  await expect(popover).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(popover).toHaveCSS('background-color', 'rgb(31, 34, 44)');
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await expect(edge.locator('.react-flow__edge-path')).toHaveCSS('animation-name', 'none');

  await page.keyboard.press('Escape');
  const source = page.getByTestId('method-renderTemplate');
  const target = page.getByTestId('class-NotificationService');
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('Move Method の要素位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(target.getByTestId('method-renderTemplate')).toBeVisible();
  await expect(edge).toHaveCount(0);
});

test('中級3では越境先を別クラスへ移してもprivateを自動public化せず、警告を残す', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '中級3: 越境する private メソッド');
  await page.getByTestId('method-renderTemplate').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'クラスを追加' }).click();
  await menu.getByLabel('追加するクラス名').fill('NewClass');
  await menu.getByRole('button', { name: '追加' }).click();

  // Act
  const target = page.getByTestId('class-InvoicePdfRenderer');
  await page.getByTestId('method-renderTemplate').click({ button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: '別のクラスへ移動' }).click();
  const moveMenu = page.getByTestId('context-menu').getByRole('menu', { name: '別のクラスへ移動', exact: true });
  await moveMenu.getByRole('menuitem', { name: 'NewClass', exact: true }).click();

  // Assert
  await expect(target.getByTestId('method-renderTemplate').locator('.method-chip')).toHaveClass(/method-chip--private/);
  await expect(page.locator('.react-flow__edge.edge--visibility')).toHaveCount(1);
  await expect(page.locator('.error-toast[role="status"]')).toHaveCount(0);
});

test('中級1の循環矢印に説明バッジを表示する', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級1: 循環依存を断ち切る');

  const edge = page.locator('.react-flow__edge.edge--cyclic');
  await expect(edge).toHaveCount(2);
  await expect(edge.first()).toHaveClass(/animated/);
  await expect(edge.first().locator('.react-flow__edge-path')).toHaveCSS('stroke', 'rgb(214, 69, 69)');
  await expect(edge.first().locator('.react-flow__edge-path')).toHaveCSS('animation-duration', '1.5s');
  const badge = page.getByRole('button', { name: 'この矢印の問題を見る' }).first();
  await badge.click();
  const popover = page.getByRole('dialog', { name: '矢印の問題の説明' });
  await expect(popover).toContainText('2つのクラスが互いに呼び合っています');
  await expect(popover).toContainText('こう困ります:');
  await expect(popover).toContainText('だから:');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(edge.first().locator('.react-flow__edge-path')).toHaveCSS('animation-name', 'none');
});

test('中級1の循環説明はどちらを開いても隣のバッジより前に表示され、閉じると重なり順が戻る', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await selectStage(page, '中級1: 循環依存を断ち切る');

  const badges = page.getByRole('button', { name: 'この矢印の問題を見る' });
  await expect(badges).toHaveCount(2);
  const first = badges.nth(0);
  const second = badges.nth(1);
  const firstWrapper = first.locator('..');
  const secondWrapper = second.locator('..');
  const popover = page.getByRole('dialog', { name: '矢印の問題の説明' });

  const expectPopoverAtBadgeCenter = async (badge: typeof first) => {
    const box = await badge.boundingBox();
    if (box === null) throw new Error('循環バッジの位置を取得できません');
    const topmost = await page.locator('body').evaluate((body, { x, y }) => body.ownerDocument.elementFromPoint(x, y)?.closest('.warning-edge__popover') !== null, {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    expect(topmost).toBe(true);
  };

  await first.click();
  await expect(popover).toBeVisible();
  await expect(popover).toContainText('2つのクラスが互いに呼び合っています');
  await expect(popover).toContainText('依存を一方通行にすると、片方だけを安心して変えられます。');
  await expect(firstWrapper).toHaveCSS('z-index', '30');
  await expect(secondWrapper).toHaveCSS('z-index', '10');
  await expectPopoverAtBadgeCenter(second);
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);
  await expect(firstWrapper).toHaveCSS('z-index', '10');
  await expect(secondWrapper).toHaveCSS('z-index', '10');
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();

  await second.click();
  await expect(popover).toBeVisible();
  await expect(popover).toContainText('2つのクラスが互いに呼び合っています');
  await expect(popover).toContainText('依存を一方通行にすると、片方だけを安心して変えられます。');
  await expect(secondWrapper).toHaveCSS('z-index', '30');
  await expect(firstWrapper).toHaveCSS('z-index', '10');
  await expect(secondWrapper.getByRole('dialog', { name: '矢印の問題の説明' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);
  await expect(secondWrapper).toHaveCSS('z-index', '10');
});
