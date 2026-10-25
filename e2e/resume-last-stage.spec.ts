import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE_1 = 'チュートリアル1: 長いメソッドを分ける';
const BEGINNER_2 = '初級2: クラスを自分で作る';
const TITLE = '.stage-panel__title';

test('初級2を開いて再読み込みすると、初級2が開く', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, BEGINNER_2);
  await expect(page.locator(TITLE)).toHaveText(BEGINNER_2);

  // Act
  await page.reload();

  // Assert
  await expect(page.locator(TITLE)).toHaveText(BEGINNER_2);
});

test('初級2の途中まで操作して再読み込みすると、途中のコードで「前回の続きから再開しました」が出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, BEGINNER_2);
  const before = await page.locator('.class-node').count();
  const source = await page.getByTestId('method-sendInvoice').boundingBox();
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (source === null || pane === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator('.class-node')).toHaveCount(before + 1);

  // Act
  await page.reload();

  // Assert
  await expect(page.locator(TITLE)).toHaveText(BEGINNER_2);
  await expect(page.locator('.class-node')).toHaveCount(before + 1);
  await expect(page.getByTestId('draft-restored')).toBeVisible();
});

test('存在しないステージIDが保存されていても、画面が壊れずチュートリアル1が開く', async ({ page }) => {
  // Arrange
  await page.addInitScript(() => {
    localStorage.setItem('refactor-blocks:last-stage', 'no-such-stage');
  });

  // Act
  await page.goto('/');

  // Assert
  await expect(page.locator(TITLE)).toHaveText(STAGE_1);
});

test('初回の訪問(保存なし)はチュートリアル1が開き、ツアーが出る', async ({ page }) => {
  // Arrange: 設定で立てているツアー済みの印を消す
  await page.addInitScript(() => {
    localStorage.removeItem('refactor-blocks:tour-seen');
  });

  // Act
  await page.goto('/');

  // Assert
  await expect(page.locator(TITLE)).toHaveText(STAGE_1);
  await expect(page.getByTestId('first-visit-tour')).toBeVisible();
});
