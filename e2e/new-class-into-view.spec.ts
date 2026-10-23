import { expect, test, type Page } from '@playwright/test';

async function viewportZoom(view: ReturnType<Page['getByTestId']>): Promise<number> {
  const style = await view.locator('.react-flow__viewport').getAttribute('style');
  const match = style?.match(/scale\(([^)]+)\)/);
  if (match === undefined || match === null) throw new Error('React Flowのzoomを取得できません');
  return Number(match[1]);
}

test('白紙設計で余白に作ったクラス全体を表示し、zoomを保つ', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
  const view = page.getByTestId('blank-view');
  const pane = view.locator('.react-flow__pane');
  const canvas = view.locator('.app__canvas');
  const firstMethod = view.getByTestId('method-placeOrder');
  const paneBox = await pane.boundingBox();
  const canvasBox = await canvas.boundingBox();
  const methodBox = await firstMethod.boundingBox();
  if (paneBox === null || canvasBox === null || methodBox === null) throw new Error('キャンバス座標を取得できません');
  const zoomBefore = await viewportZoom(view);

  // Act: キャンバス下端から30px以内の余白へ落とす
  const dropX = paneBox.x + paneBox.width - 40;
  const dropY = canvasBox.y + canvasBox.height - 30;
  await page.mouse.move(methodBox.x + methodBox.width / 2, methodBox.y + methodBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(methodBox.x + methodBox.width / 2 + 20, methodBox.y + methodBox.height / 2, { steps: 5 });
  await page.mouse.move(dropX, dropY, { steps: 15 });
  await page.mouse.up();

  // Assert
  const file = view.getByTestId('file-src/NewClass.ts');
  await expect(file).toBeVisible();
  await page.waitForTimeout(250);
  const fileBox = await file.boundingBox();
  if (fileBox === null) throw new Error('新しいファイルの位置を取得できません');
  expect(fileBox.x).toBeGreaterThanOrEqual(canvasBox.x + 23);
  expect(fileBox.y).toBeGreaterThanOrEqual(canvasBox.y + 23);
  expect(fileBox.x + fileBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width - 23);
  expect(fileBox.y + fileBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height - 23);
  expect(await viewportZoom(view)).toBeCloseTo(zoomBefore, 3);
});

test('既存クラスへのドロップではviewportを動かさない', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
  const view = page.getByTestId('blank-view');
  const viewport = view.locator('.react-flow__viewport');
  const method = view.getByTestId('method-placeOrder');
  const empty = view.locator('.react-flow__pane').last();
  const methodBoxForCreate = await method.boundingBox();
  const emptyBox = await empty.boundingBox();
  if (methodBoxForCreate === null || emptyBox === null) throw new Error('初期配置を取得できません');
  await page.mouse.move(methodBoxForCreate.x + methodBoxForCreate.width / 2, methodBoxForCreate.y + methodBoxForCreate.height / 2);
  await page.mouse.down();
  await page.mouse.move(methodBoxForCreate.x + methodBoxForCreate.width / 2 + 20, methodBoxForCreate.y + methodBoxForCreate.height / 2, { steps: 5 });
  await page.mouse.move(emptyBox.x + emptyBox.width - 50, emptyBox.y + emptyBox.height - 50, { steps: 10 });
  await page.mouse.up();
  await expect(view.getByTestId('file-src/NewClass.ts')).toBeVisible();
  await page.waitForTimeout(250);
  const beforeExistingDrop = await viewport.getAttribute('style');
  const target = view.getByTestId('class-header-NewClass');
  const methodBox = await method.boundingBox();
  const targetBox = await target.boundingBox();
  if (methodBox === null || targetBox === null) throw new Error('ドラッグ対象の座標を取得できません');
  await page.mouse.move(methodBox.x + methodBox.width / 2, methodBox.y + methodBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(methodBox.x + methodBox.width / 2 + 20, methodBox.y + methodBox.height / 2, { steps: 5 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
  await page.mouse.up();
  const styleAfterDrop = await viewport.getAttribute('style');
  const beforeTranslate = beforeExistingDrop?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
  const afterTranslate = styleAfterDrop?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
  expect(beforeTranslate).not.toBeNull();
  expect(afterTranslate).not.toBeNull();
  expect(Math.abs(Number(afterTranslate?.[1]) - Number(beforeTranslate?.[1]))).toBeLessThan(2);
  expect(Math.abs(Number(afterTranslate?.[2]) - Number(beforeTranslate?.[2]))).toBeLessThan(2);
});

test('通常モードで端に作ったクラスは24px余白で見え、通常motionは200ms', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
  const pane = page.getByTestId('blank-view').locator('.react-flow__pane');
  const canvas = page.locator('.app__canvas').last();
  const method = page.getByTestId('method-placeOrder');
  const view = page.getByTestId('blank-view');
  const paneBox = await pane.boundingBox();
  const canvasBox = await canvas.boundingBox();
  const methodBox = await method.boundingBox();
  if (paneBox === null || canvasBox === null || methodBox === null) throw new Error('キャンバス座標を取得できません');
  const dropX = paneBox.x + paneBox.width - 40;
  const dropY = canvasBox.y + canvasBox.height - 30;
  await page.mouse.move(methodBox.x + methodBox.width / 2, methodBox.y + methodBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(methodBox.x + methodBox.width / 2 + 20, methodBox.y + methodBox.height / 2, { steps: 5 });
  await page.mouse.move(dropX, dropY, { steps: 15 });
  await page.mouse.up();
  const file = view.getByTestId('file-src/NewClass.ts');
  await expect(file).toBeVisible();
  const transform = view.locator('.react-flow__viewport');
  const initialTransform = await transform.getAttribute('style');
  const startTime = Date.now();
  let observedIntermediate = false;
  while (Date.now() - startTime < 500) {
    const current = await transform.getAttribute('style');
    if (current !== initialTransform && current !== null) {
      observedIntermediate = true;
      break;
    }
    await page.waitForTimeout(10);
  }
  expect(observedIntermediate).toBe(true);
  const fileBox = await file.boundingBox();
  if (fileBox === null) throw new Error('新規ファイル位置を取得できません');
  await expect.poll(async () => {
    const box = await file.boundingBox();
    return box !== null && box.x >= canvasBox.x + 23 && box.y >= canvasBox.y + 23
      && box.x + box.width <= canvasBox.x + canvasBox.width - 23
      && box.y + box.height <= canvasBox.y + canvasBox.height - 23;
  }).toBe(true);
});

test('reduced-motionでは新規クラスのpanを即時適用する', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
  const view = page.getByTestId('blank-view');
  const canvas = view.locator('.app__canvas');
  const method = view.getByTestId('method-placeOrder');
  const canvasBox = await canvas.boundingBox();
  const methodBox = await method.boundingBox();
  if (canvasBox === null || methodBox === null) throw new Error('キャンバス座標を取得できません');
  await page.mouse.move(methodBox.x + methodBox.width / 2, methodBox.y + methodBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(methodBox.x + methodBox.width / 2 + 20, methodBox.y + methodBox.height / 2, { steps: 5 });
  await page.mouse.move(canvasBox.x + canvasBox.width - 40, canvasBox.y + canvasBox.height - 30, { steps: 15 });
  await page.mouse.up();
  const file = view.getByTestId('file-src/NewClass.ts');
  await expect(file).toBeVisible();
  await expect.poll(async () => {
    const box = await file.boundingBox();
    return box === null ? 0 : box.x;
  }).toBeGreaterThan(canvasBox.x);
});
