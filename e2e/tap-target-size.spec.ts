import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

type Box = { x: number; y: number; width: number; height: number };

const apart = (a: Box, b: Box) => a.y >= b.y + b.height || a.y + a.height <= b.y || a.x >= b.x + b.width || a.x + a.width <= b.x;

async function openPage(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
}

async function makeLayerDeduction(page: Page) {
  await selectStage(page, '中級11: Controller に全部書いてある注文API');
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('注文を保存して在庫を減らす').check();
  await page.getByLabel('新しいメソッド名').fill('saveOrder');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  const method = page.getByTestId('method-saveOrder');
  const repository = page.getByTestId('class-OrderRepository');
  await expect(method).toBeVisible();
  const from = await method.boundingBox();
  const to = await repository.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  if (from === null || to === null) return;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await expect(repository).toHaveClass(/class-node--drop-target/);
  await page.mouse.up();
}

test('減点内訳の対象ボタンは高さ24px以上で互いに重ならない', async ({ page }) => {
  // Arrange
  await openPage(page);
  await makeLayerDeduction(page);

  // Act
  await page.locator('.score-breakdown summary').click();
  const groups = await page.locator('.score-breakdown__targets').all();
  await expect(page.getByTestId('score-targets-layer').locator('.score-breakdown__target')).toHaveCount(1);

  // Assert
  expect(groups.length).toBeGreaterThan(0);
  for (const group of groups) {
    const buttons = await group.locator('.score-breakdown__target').all();
    expect(buttons.length).toBeGreaterThan(0);
    const boxes: Box[] = [];
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      if (box !== null) {
        expect(box.height).toBeGreaterThanOrEqual(24);
        boxes.push(box);
      }
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(apart(boxes[i], boxes[j])).toBe(true);
      }
    }
  }
});

test('クリア条件の用語ボタンは高さ24px以上', async ({ page }) => {
  // Arrange
  await openPage(page);
  await selectStage(page, '中級3: 越境する private メソッド');

  // Act
  await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  const box = await page.locator('.clear-conditions').getByTestId('glossary-term-coupling').boundingBox();

  // Assert
  expect(box).not.toBeNull();
  expect(box?.height).toBeGreaterThanOrEqual(24);
});

test('サイドバーの開閉ボタンは両状態で24px以上', async ({ page }) => {
  // Arrange
  await openPage(page);
  const toggle = page.locator('.sidebar-toggle');

  // Act & Assert
  for (const label of ['サイドバーを開く', 'サイドバーを閉じる']) {
    await expect(toggle).toHaveAttribute('aria-label', label);
    const box = await toggle.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
    await toggle.click();
  }
});
