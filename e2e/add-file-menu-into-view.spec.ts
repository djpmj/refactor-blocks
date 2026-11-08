import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function addFile(page: Page): Promise<void> {
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (pane === null) throw new Error('キャンバスがありません');
  await page.mouse.click(pane.x + pane.width - 20, pane.y + pane.height - 20, { button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'ファイルを追加' }).click();
}

async function visibleInCanvas(page: Page, testId: string): Promise<boolean> {
  const canvas = await page.locator('.app__canvas:not([hidden])').boundingBox();
  const target = await page.getByTestId(testId).boundingBox();
  if (canvas === null || target === null) return false;
  return target.x >= canvas.x + 23 && target.y >= canvas.y + 23
    && target.x + target.width <= canvas.x + canvas.width - 23
    && target.y + target.height <= canvas.y + canvas.height - 23;
}

async function zoom(page: Page): Promise<number> {
  const transform = await page.locator('.react-flow__viewport').getAttribute('style');
  const match = transform?.match(/scale\(([^)]+)\)/);
  if (match === undefined || match === null) throw new Error('zoomがありません');
  return Number(match[1]);
}

test('上級3で三つ目のメニュー追加ファイルが画面内に入り、倍率を保つ', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '上級3: 会員ランクの割引をStrategyパターンへ組み替える');
  await addFile(page);
  await expect(page.getByTestId('file-src/NewFile.ts')).toBeVisible();
  await addFile(page);
  await expect(page.getByTestId('file-src/NewFile2.ts')).toBeVisible();
  const before = await zoom(page);
  await addFile(page);
  await expect.poll(() => visibleInCanvas(page, 'file-src/NewFile3.ts')).toBe(true);
  expect(await zoom(page)).toBeCloseTo(before, 3);
});

test('上級6でメニュー追加のクラスが画面内に入る', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '上級6: 太ったインターフェースを役割ごとに分ける');
  await addFile(page);
  await expect.poll(() => visibleInCanvas(page, 'file-src/NewFile.ts')).toBe(true);
  await page.getByTestId('file-src/NewFile.ts').click({ button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'クラスを追加' }).click();
  await expect.poll(() => visibleInCanvas(page, 'class-header-NewClass')).toBe(true);
});
