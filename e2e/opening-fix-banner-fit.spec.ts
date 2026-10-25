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
}

/** 幅700px以下のドロワー表示中: ドロワーはバナーの下から始まり、バナー以外の図は操作できない(inert)。 */
async function expectDrawerBelowBannerAndCanvasInert(page: Page) {
  const banner = await rectOf(page, '[data-testid="opening-fix-banner"]');
  const drawer = await rectOf(page, '.sidebar-resizable--mobile-open');
  expect(drawer.top).toBeGreaterThanOrEqual(banner.bottom - 1);
  await expect(page.locator('.canvas-column__flow')).toHaveJSProperty('inert', true);
}

async function nodeRects(page: Page): Promise<Rect[]> {
  return page.locator('.react-flow__node').evaluateAll((elements) => elements.map((element) => {
    const r = element.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
}

/** 図の全ノードがキャンバスの中に収まるまで待って確かめる(自動の合わせ直しは非同期)。 */
async function expectWholeDiagramInsideCanvas(page: Page) {
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await expect.poll(async () => {
    const canvas = await rectOf(page, '.app__canvas');
    const nodes = await nodeRects(page);
    return nodes.length > 0 && nodes.every((node) => node.left >= canvas.left - 1 && node.right <= canvas.right + 1 && node.top >= canvas.top - 1 && node.bottom <= canvas.bottom + 1);
  }).toBe(true);
}

async function expectBannerClearOfNodes(page: Page) {
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await page.waitForTimeout(300);
  const banner = await rectOf(page, '[data-testid="opening-fix-banner"]');
  const nodes = await nodeRects(page);
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

    test('初級1でエディタを開く前も、バナーがキャンバスの内側に収まりボタンを押せる', async ({ page }) => {
      await selectStage(page, '初級1: 何でも屋の UserController', { completeOpeningFix: false });
      await expectBannerInsideCanvas(page);
      await page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' }).click();
      await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeVisible();
      await expect(page.getByTestId('opening-fix-banner')).toHaveCount(0);
    });

    test('初級1でメソッドエディタを開いたまま(閉じずに)、バナーがキャンバスの内側に収まりボタンを実際に押せる', async ({ page }) => {
      await selectStage(page, '初級1: 何でも屋の UserController', { completeOpeningFix: false });
      await page.locator('.method-chip').first().click();
      await expect(page.locator('.method-editor')).toBeVisible();
      await expectBannerInsideCanvas(page);
      if (width <= 700) await expectDrawerBelowBannerAndCanvasInert(page);
      // エディタ(幅700px以下ではドロワー)を開いたまま押す。他の要素に隠れていればPlaywrightのクリックが失敗する
      await page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' }).click();
      await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeVisible();
      await expect(page.getByTestId('opening-fix-banner')).toHaveCount(0);
    });

    test('初級1でメソッドエディタを開いたまま、キーボードでバナーのボタンへ届き、Enterで始められる', async ({ page }) => {
      await selectStage(page, '初級1: 何でも屋の UserController', { completeOpeningFix: false });
      await page.locator('.method-chip').first().click();
      await expect(page.locator('.method-editor')).toBeVisible();
      const button = page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' });
      await button.focus();
      await expect(button).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeVisible();
      await expect(page.getByTestId('opening-fix-banner')).toHaveCount(0);
    });

    test('中級3を開いた直後、バナーがファイル・クラスの箱と重ならない', async ({ page }) => {
      await selectStage(page, '中級3: 越境する private メソッド', { completeOpeningFix: false });
      await expectBannerInsideCanvas(page);
      await expectBannerClearOfNodes(page);
    });
  });
}

test('「実際に直してみる」を押すとバナーが消え、図の全体がキャンバスの中に見える', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await selectStage(page, '中級3: 越境する private メソッド', { completeOpeningFix: false });
  await expectWholeDiagramInsideCanvas(page);
  await page.locator('[data-testid="opening-fix-banner"] button').click();
  await expect(page.getByTestId('opening-fix-banner')).toHaveCount(0);
  await expectWholeDiagramInsideCanvas(page);
});

test('手直し中はバナーが出ず、「やめる」で手直しを閉じると(まだ直していないので)また出る', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await selectStage(page, '初級1: 何でも屋の UserController', { completeOpeningFix: false });
  await expect(page.getByTestId('opening-fix-banner')).toBeVisible();
  await page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' }).click();
  const panel = page.getByRole('region', { name: '手で直すシミュレーション' });
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('opening-fix-banner')).toHaveCount(0);
  await panel.getByRole('button', { name: 'やめる' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('opening-fix-banner')).toBeVisible();
});

test('操作ガイド(ツアー)の表示中はバナーが出ず、ガイドを終えるとまた出る', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('first-visit-tour-test-reset') !== 'done') {
      localStorage.removeItem('refactor-blocks:tour-seen');
      sessionStorage.setItem('first-visit-tour-test-reset', 'done');
    }
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const tour = page.getByTestId('first-visit-tour');
  await expect(tour).toBeVisible();
  await expect(page.getByTestId('opening-fix-banner')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);
  await expect(page.getByTestId('opening-fix-banner')).toBeVisible();
});
