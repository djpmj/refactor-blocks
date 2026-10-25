import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

type Rect = { left: number; right: number; top: number; bottom: number };

async function rectOf(page: Page, selector: string): Promise<Rect> {
  return page.locator(selector).first().evaluate((element) => {
    const r = element.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });
}

async function expectBannerInsideCanvas(page: Page) {
  await expect(page.getByTestId('opening-fix-banner')).toBeVisible();
  const banner = await rectOf(page, '[data-testid="opening-fix-banner"]');
  const canvas = await rectOf(page, '.app__canvas');
  const button = await rectOf(page, '[data-testid="opening-fix-banner"] button');
  for (const rect of [banner, button]) {
    expect(rect.left).toBeGreaterThanOrEqual(canvas.left - 1);
    expect(rect.right).toBeLessThanOrEqual(canvas.right + 1);
    expect(rect.top).toBeGreaterThanOrEqual(canvas.top - 1);
  }
  await expect(page.locator('[data-testid="opening-fix-banner"] button')).toBeEnabled();
}

async function expectBannerClearOfNodes(page: Page) {
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await page.waitForTimeout(300);
  const banner = await rectOf(page, '[data-testid="opening-fix-banner"]');
  const nodes = await page.locator('.react-flow__node').evaluateAll((elements) => elements.map((element) => {
    const r = element.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  expect(nodes.length).toBeGreaterThan(0);
  for (const node of nodes) {
    const overlaps = node.left < banner.right && node.right > banner.left && node.top < banner.bottom && node.bottom > banner.top;
    expect(overlaps).toBe(false);
  }
}

for (const width of [1280, 600]) {
  test.describe(`幅${String(width)}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
    });

    test('初級1でメソッドエディタを開いても、バナーがキャンバスの内側に収まりボタンを押せる', async ({ page }) => {
      await selectStage(page, '初級1: 何でも屋の UserController', { completeOpeningFix: false });
      await expectBannerInsideCanvas(page);
      const method = page.locator('.method-chip').first();
      await method.click();
      await expect(page.getByTestId('opening-fix-banner')).toBeVisible();
      await expectBannerInsideCanvas(page);
    });

    test('中級3を開いた直後、バナーがファイル・クラスの箱と重ならない', async ({ page }) => {
      await selectStage(page, '中級3: 越境する private メソッド', { completeOpeningFix: false });
      await expectBannerInsideCanvas(page);
      await expectBannerClearOfNodes(page);
    });
  });
}

test('「実際に直してみる」を押すとバナーが消え、図がキャンバスの中に見える', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await selectStage(page, '中級3: 越境する private メソッド', { completeOpeningFix: false });
  await page.locator('[data-testid="opening-fix-banner"] button').click();
  await expect(page.getByTestId('opening-fix-banner')).toHaveCount(0);
  await page.waitForTimeout(300);
  const canvas = await rectOf(page, '.app__canvas');
  const node = await rectOf(page, '.react-flow__node');
  expect(node.right).toBeGreaterThan(canvas.left);
  expect(node.left).toBeLessThan(canvas.right);
  expect(node.bottom).toBeGreaterThan(canvas.top);
  expect(node.top).toBeLessThan(canvas.bottom);
});
