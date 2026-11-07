import { expect, test, type Locator, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE2 = '上級2: 決済ゲートウェイをインターフェース越しに呼ぶ';
const STAGE1 = '上級1: 通知クラスの共通処理を基底クラスへ集める';

async function viewportZoom(page: Page): Promise<number> {
  const transform = await page.locator('.react-flow__viewport').getAttribute('style');
  const match = transform?.match(/scale\(([^)]+)\)/);
  if (match === undefined || match === null) throw new Error('ズーム倍率を取得できません');
  return Number(match[1]);
}

async function expectInsideCanvas(page: Page, nodes: Locator) {
  const canvas = await page.locator('.app__canvas').boundingBox();
  if (canvas === null) throw new Error('キャンバスの位置を取得できません');
  const rects = await nodes.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  expect(rects.length).toBeGreaterThan(0);
  for (const rect of rects) {
    expect(rect.left).toBeGreaterThanOrEqual(canvas.x - 2);
    expect(rect.right).toBeLessThanOrEqual(canvas.x + canvas.width + 2);
    expect(rect.top).toBeGreaterThanOrEqual(canvas.y - 2);
    expect(rect.bottom).toBeLessThanOrEqual(canvas.y + canvas.height + 2);
  }
}

async function openStage(page: Page, size: { width: number; height: number }, title: string) {
  await page.setViewportSize(size);
  await page.goto('/');
  await selectStage(page, title, { completeOpeningFix: true });
  await expect(page.locator('.method-chip').first()).toBeVisible();
}

async function clickFirstMethodOf(page: Page, className: string) {
  await page.getByTestId(`class-${className}`).locator('.method-chip').first().click();
  await expect(page.locator('.method-editor').first()).toBeVisible();
  await page.waitForTimeout(250);
}

test('1440x900の上級2で、PaypalGatewayのメソッドを開くとそのクラスがキャンバスに収まり、倍率は保たれる', async ({ page }) => {
  await openStage(page, { width: 1440, height: 900 }, STAGE2);
  await clickFirstMethodOf(page, 'PaypalGateway');
  await expectInsideCanvas(page, page.locator('.app__canvas .react-flow__node-classNode', { has: page.getByTestId('class-PaypalGateway') }));
  expect(await viewportZoom(page)).toBeGreaterThanOrEqual(0.599);
});

test('1920x1080の上級2では、エディタを開いても全ノードがキャンバスに収まる', async ({ page }) => {
  await openStage(page, { width: 1920, height: 1080 }, STAGE2);
  await clickFirstMethodOf(page, 'PaypalGateway');
  await expectInsideCanvas(page, page.locator('.app__canvas .react-flow__node'));
  expect(await viewportZoom(page)).toBeGreaterThanOrEqual(0.599);
});

test('プレイヤーがズームしたあとは、エディタを開いても倍率を合わせ直さない', async ({ page }) => {
  await openStage(page, { width: 1440, height: 900 }, STAGE2);
  const box = await page.locator('.app__canvas').boundingBox();
  if (box === null) throw new Error('キャンバスの位置を取得できません');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -500);
  await expect.poll(() => viewportZoom(page)).toBeGreaterThan(0.8);
  const userZoom = await viewportZoom(page);
  await clickFirstMethodOf(page, 'PaypalGateway');
  expect(await viewportZoom(page)).toBeCloseTo(userZoom, 3);
});

test('1440x900の上級1で、通知クラスのメソッドを開くとそのクラスがキャンバスに収まる', async ({ page }) => {
  await openStage(page, { width: 1440, height: 900 }, STAGE1);
  await clickFirstMethodOf(page, 'SmsNotifier');
  // NotifierBase はメソッドを持たず選べない。保証するのは選んだクラス(SmsNotifier)だけ
  await expectInsideCanvas(page, page.locator('.app__canvas .react-flow__node-classNode', { has: page.getByTestId('class-SmsNotifier') }));
  expect(await viewportZoom(page)).toBeGreaterThanOrEqual(0.599);
});
