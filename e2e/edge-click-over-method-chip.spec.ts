import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('矢印が重なるメソッドチップの中央をクリックできる', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto('/');
  await selectStage(page, '中級12: 横流しするだけの OrderManager');
  const manager = page.getByTestId('class-OrderManager');
  await manager.getByTestId('method-placeOrder').click();
  await page.getByRole('button', { name: '呼び出し元へ戻す' }).click();
  const chip = manager.getByTestId('method-cancelOrder');
  const box = await chip.boundingBox();
  if (box === null) throw new Error('メソッドチップの位置を取得できません');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const crossesChip = await page.evaluate(`(() => {
    const path = document.querySelector('[data-id="dep-class-order-controller-class-order-service"] .react-flow__edge-interaction');
    if (!path) return false;
    const matrix = path.getScreenCTM();
    if (!matrix) return false;
    const point = new DOMPoint(${center.x}, ${center.y}).matrixTransform(matrix.inverse());
    return path.isPointInStroke(point);
  })()`);
  expect(crossesChip).toBe(true);

  // Act
  await chip.click();

  // Assert
  await expect(page.getByRole('heading', { name: /OrderManager\.cancelOrder\(\)/ })).toBeVisible();
  const chipOnTop = await chip.evaluate((element, point) => {
    const top = element.ownerDocument.elementFromPoint(point.x, point.y);
    return top === element || element.contains(top);
  }, center);
  expect(chipOnTop).toBe(true);
});

test('矢印が重なるメソッドチップを掴んで別クラスへドラッグできる', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto('/');
  await selectStage(page, '中級12: 横流しするだけの OrderManager');
  const manager = page.getByTestId('class-OrderManager');
  await manager.getByTestId('method-placeOrder').click();
  await page.getByRole('button', { name: '呼び出し元へ戻す' }).click();
  const chip = manager.getByTestId('method-cancelOrder');
  const target = page.locator('[data-testid^="class-"]').filter({ hasNot: chip }).first();
  const from = await chip.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('ドラッグ元またはドロップ先の位置を取得できません');

  // Act
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });

  // Assert
  await expect(page.locator('.drag-overlay')).toBeVisible();
  await expect(target).toHaveClass(/class-node--drop-target/);
  await page.mouse.up();
});
