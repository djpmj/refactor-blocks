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
  await page.getByRole('button', { name: 'Fit View' }).click();
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
