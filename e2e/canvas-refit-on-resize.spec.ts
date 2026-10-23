import { expect, test, type Page } from '@playwright/test';
import { completeOpeningFix, selectStage } from './selectStage.js';

async function expectNodesInsideCanvas(page: Page) {
  const canvas = await page.locator('.app__canvas').boundingBox();
  if (canvas === null) throw new Error('キャンバスの位置を取得できません');
  const nodes = await page.locator('.app__canvas .react-flow__node').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  expect(nodes.length).toBeGreaterThan(0);
  for (const node of nodes) {
    expect(node.left).toBeGreaterThanOrEqual(canvas.x - 2);
    expect(node.right).toBeLessThanOrEqual(canvas.x + canvas.width + 2);
    expect(node.top).toBeGreaterThanOrEqual(canvas.y - 2);
    expect(node.bottom).toBeLessThanOrEqual(canvas.y + canvas.height + 2);
  }
}

/** 自動の合わせは 0.6 未満に縮めない(detail-zoom-floor)ので、狭いときは全体が収まる代わりにメソッドが読める倍率を保つ。 */
async function expectReadableZoom(page: Page) {
  expect(await viewportZoom(page)).toBeGreaterThanOrEqual(0.599);
}

async function viewportZoom(page: Page): Promise<number> {
  const transform = await page.locator('.react-flow__viewport').getAttribute('style');
  const match = transform?.match(/scale\(([^)]+)\)/);
  if (match === undefined || match === null) throw new Error('ズーム倍率を取得できません');
  return Number(match[1]);
}

async function openFirstStage(page: Page, completeOpeningFix = true) {
  await page.goto('/');
  await selectStage(page, '初級1: 何でも屋の UserController', { completeOpeningFix });
  if (completeOpeningFix) await expect(page.locator('.method-chip').first()).toBeVisible();
}

test('画面を狭めても図全体が収まり、広げたときは詳細を読める倍率に戻る', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 1000 });
  await openFirstStage(page, false);
  await page.waitForTimeout(250);
  await expectReadableZoom(page);

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(250);
  await completeOpeningFix(page);
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.waitForTimeout(250);
  await expectReadableZoom(page);

  await page.setViewportSize({ width: 600, height: 1000 });
  await page.waitForTimeout(250);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(250);
  await expectNodesInsideCanvas(page);
  await expect(page.locator('.method-chip').first()).toBeVisible();
});

test('プレイヤーのズームを保ち、全体表示後のサイズ変更には再度合わせる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFirstStage(page);
  const canvas = page.locator('.app__canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('キャンバスの位置を取得できません');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -500);
  await expect.poll(() => viewportZoom(page)).toBeGreaterThan(0.8);
  const userZoom = await viewportZoom(page);

  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.waitForTimeout(250);
  expect(await viewportZoom(page)).toBeCloseTo(userZoom, 2);

  await page.getByRole('button', { name: /fit view/i }).click();
  await page.waitForTimeout(100);
  const fitZoom = await viewportZoom(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(250);
  await expectNodesInsideCanvas(page);
  expect(await viewportZoom(page)).toBeGreaterThan(fitZoom);
});

test('ステージ切り替え直後は計測済みの図が収まり、メソッドを表示する', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await openFirstStage(page);

  await selectStage(page, '初級2: クラスを自分で作る');

  await expectReadableZoom(page);
  await expect(page.locator('.method-chip').first()).toBeVisible();
});

test('手直し中も画面幅の変化に合わせて倍率を更新する', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openFirstStage(page, false);
  await page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' }).click();
  await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeVisible();

  await page.setViewportSize({ width: 600, height: 1000 });
  await page.waitForTimeout(250);
  const narrowZoom = await viewportZoom(page);

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(250);
  await expectNodesInsideCanvas(page);
  await expect(page.locator('.method-chip').first()).toBeVisible();
  expect(await viewportZoom(page)).toBeGreaterThan(narrowZoom);
});

test('左サイドバーを開閉すると未操作の図を合わせ直す', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openFirstStage(page);
  const before = await viewportZoom(page);

  await page.getByRole('button', { name: 'サイドバーを閉じる' }).click();
  await page.waitForTimeout(250);
  const closed = await viewportZoom(page);
  expect(closed).toBeGreaterThanOrEqual(before);
  await expectNodesInsideCanvas(page);

  await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  await page.waitForTimeout(250);
  await expectNodesInsideCanvas(page);
});
