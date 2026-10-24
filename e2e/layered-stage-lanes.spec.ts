import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE = '中級11: Controller に全部書いてある注文API';
const CONTROLLER = 'file-src/order/OrderController.ts';
const SERVICE = 'file-src/order/OrderService.ts';
const REPOSITORY = 'file-src/order/OrderRepository.ts';

async function top(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox();
  if (box === null) throw new Error(`要素 ${testId} の位置を取得できません`);
  return box.y;
}

async function stableBoundingBox(page: Page, testId: string) {
  const deadline = Date.now() + 3000;
  let previous = await page.getByTestId(testId).boundingBox();
  while (Date.now() < deadline) {
    await page.waitForTimeout(50);
    const current = await page.getByTestId(testId).boundingBox();
    if (previous !== null && current !== null && current.x === previous.x && current.y === previous.y) return current;
    previous = current;
  }
  if (previous === null) throw new Error(`要素 ${testId} の位置を取得できません`);
  return previous;
}

async function dragMethodToClass(page: Page, methodTestId: string, classTestId: string) {
  const from = await stableBoundingBox(page, methodTestId);
  const to = await stableBoundingBox(page, classTestId);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await expect(page.getByTestId(classTestId)).toHaveClass(/class-node--drop-target/);
  await page.mouse.up();
}

test('中級11では Controller・Service・Repository のファイルが上から順に段になり、各段に層の名前の帯が出る', async ({ page }) => {
  // Arrange & Act
  await page.goto('/');
  await selectStage(page, STAGE);

  // Assert
  await expect(page.getByTestId(REPOSITORY)).toBeVisible();
  const [controller, service, repository] = [await top(page, CONTROLLER), await top(page, SERVICE), await top(page, REPOSITORY)];
  expect(controller).toBeLessThan(service);
  expect(service).toBeLessThan(repository);
  const bands = page.getByTestId('lane-band');
  await expect(bands).toHaveCount(3);
  await expect(bands.nth(0)).toHaveText('Controller');
  await expect(bands.nth(1)).toHaveText('Service');
  await expect(bands.nth(2)).toHaveText('Repository');
});

test('保存の処理を Controller から Repository へ直接移すと、その矢印が赤い破線になり「層を飛ばしています」と出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE);
  await expect(page.locator('.edge--layer')).toHaveCount(0);
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('注文を保存して在庫を減らす').check();
  await page.getByLabel('新しいメソッド名').fill('saveOrder');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('method-saveOrder')).toBeVisible();

  // Act
  await dragMethodToClass(page, 'method-saveOrder', 'class-OrderRepository');

  // Assert
  const edge = page.locator('.react-flow__edge.edge--layer');
  await expect(edge).toHaveCount(1);
  await expect(edge.locator('.react-flow__edge-path')).toHaveCSS('stroke-dasharray', '8px, 5px');
  await expect(page.locator('.warning-edge__badge-text', { hasText: '層を飛ばしています' })).toBeVisible();
});

test('層のないステージには帯も層の違反の矢印も出ない', async ({ page }) => {
  // Arrange & Act
  await page.goto('/');
  await selectStage(page, '中級1: 循環依存を断ち切る');

  // Assert
  await expect(page.locator('.react-flow__node-fileNode').first()).toBeVisible();
  await expect(page.getByTestId('lane-band')).toHaveCount(0);
  await expect(page.locator('.edge--layer')).toHaveCount(0);
});
