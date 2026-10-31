import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE_1 = 'チュートリアル1: 長いメソッドを分ける';
const STAGE_2 = 'チュートリアル2: 太った placeOrder';
const INTERMEDIATE_1 = '中級1: 循環依存を断ち切る';
const PROGRESS_KEY = 'refactor-blocks:progress';

async function openWithProgress(page: Page, progress: Record<string, number>) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [PROGRESS_KEY, JSON.stringify(progress)]);
  await page.reload();
}

test('前提を飛ばして中級1を開くと案内が出て、押すと前提のステージへ移り、その先の案内も出る', async ({ page }) => {
  // Arrange
  await openWithProgress(page, {});

  // Act
  await selectStage(page, INTERMEDIATE_1);

  // Assert
  const note = page.getByTestId('prerequisite-note');
  await expect(note).toContainText(`先に「${STAGE_2}」をやると分かりやすいです(Move Method)`);
  await expect(note.getByTestId('prerequisite-go')).toHaveText('開く');

  // Act
  await note.getByTestId('prerequisite-go').click();

  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STAGE_2);
  await expect(page.getByTestId('prerequisite-note')).toContainText(`先に「${STAGE_1}」をやると分かりやすいです(Extract Method)`);
});

test('チュートリアル1には案内が出ない', async ({ page }) => {
  // Arrange
  await openWithProgress(page, {});

  // Act
  await selectStage(page, STAGE_1);

  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STAGE_1);
  await expect(page.getByTestId('prerequisite-note')).toHaveCount(0);
});

test('前提を100点にしている、または中級1自身が100点なら案内が出ない', async ({ page }) => {
  // Arrange
  await openWithProgress(page, { 'tutorial-order-service': 100 });

  // Act
  await selectStage(page, INTERMEDIATE_1);

  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(INTERMEDIATE_1);
  await expect(page.getByTestId('prerequisite-note')).toHaveCount(0);

  // Arrange
  await openWithProgress(page, { 'intermediate-cyclic-dependency': 100 });

  // Act
  await selectStage(page, INTERMEDIATE_1);

  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(INTERMEDIATE_1);
  await expect(page.getByTestId('prerequisite-note')).toHaveCount(0);
});

test('キーボードで「開く」にフォーカスし、Enter で前提のステージへ移れる', async ({ page }) => {
  // Arrange
  await openWithProgress(page, {});
  await selectStage(page, INTERMEDIATE_1);
  const go = page.getByTestId('prerequisite-go');

  // Act
  await go.focus();
  await expect(go).toBeFocused();
  await page.keyboard.press('Enter');

  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STAGE_2);
});
