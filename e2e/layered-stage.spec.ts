import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE = '中級11: Controller に全部書いてある注文API';

/** 位置が2回連続で同じになるまで待ってから返す(クラスの伸び縮みで古い位置をドラッグしないため)。 */
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

test('層のあるステージでは、層を持つクラスにだけ層の名前のタグが出る', async ({ page }) => {
  // Arrange & Act
  await page.goto('/');
  await selectStage(page, STAGE);

  // Assert
  await expect(page.getByTestId('layer-OrderController')).toHaveText('Controller');
  await expect(page.getByTestId('layer-OrderService')).toHaveCount(0);
  await expect(page.getByTestId('layer-OrderRepository')).toHaveCount(0);
});

test('層を持たない既存ステージにはタグが出ない', async ({ page }) => {
  // Arrange & Act
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');

  // Assert
  await expect(page.locator('.class-node__layer')).toHaveCount(0);
});

test('保存の処理だけを Repository へ移すと、タグが付き、層を飛ばしたので減点される', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE);
  await expect(page.getByTestId('score')).not.toContainText('層の依存の向き');
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('注文を保存して在庫を減らす').check();
  await page.getByLabel('新しいメソッド名').fill('saveOrder');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('method-saveOrder')).toBeVisible();

  // Act
  await dragMethodToClass(page, 'method-saveOrder', 'class-OrderRepository');

  // Assert
  await expect(page.getByTestId('layer-OrderRepository')).toHaveText('Repository');
  await expect(page.getByTestId('score')).toContainText('層の依存の向き -10');
});
