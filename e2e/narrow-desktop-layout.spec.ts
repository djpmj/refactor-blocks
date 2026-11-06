import { expect, test, type Page } from '@playwright/test';
import { completeOpeningFix, selectStage } from './selectStage.js';

const TUTORIAL = 'チュートリアル1: 長いメソッドを分ける';
const MIN_CANVAS_WIDTH = 300;

async function canvasBox(page: Page) {
  const box = await page.getByRole('region', { name: 'コードベース' }).boundingBox();
  if (box === null) throw new Error('キャンバスの位置を取得できません');
  return box;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('/');
  await selectStage(page, TUTORIAL, { completeOpeningFix: false });
});

test('800x600で手で直すシミュレーションを開いても、キャンバスが潰れず「直した」を押せる', async ({ page }) => {
  await page.getByRole('button', { name: '実際に直してみる' }).click();

  await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeVisible();
  const left = await page.getByRole('complementary', { name: '課題' }).boundingBox();
  const canvas = await canvasBox(page);
  expect(left).not.toBeNull();
  expect(canvas.width).toBeGreaterThanOrEqual(MIN_CANVAS_WIDTH);
  expect(canvas.x).toBeGreaterThanOrEqual((left?.x ?? 0) + (left?.width ?? 0) - 1);

  const checkbox = page.getByRole('checkbox', { name: /を直した$/ }).first();
  const box = await checkbox.boundingBox();
  expect(box).not.toBeNull();
  const centerX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  expect(centerX).toBeGreaterThanOrEqual(canvas.x);
  expect(centerX).toBeLessThanOrEqual(canvas.x + canvas.width);
  await checkbox.check();
  await expect(checkbox).toBeChecked();
});

test('800x600で抽出エディタを開いても、キャンバスの幅が残る', async ({ page }) => {
  await completeOpeningFix(page);
  await page.getByTestId('method-printMonthlyReport').click();

  await expect(page.getByLabel('新しいメソッド名')).toBeVisible();
  expect((await canvasBox(page)).width).toBeGreaterThanOrEqual(MIN_CANVAS_WIDTH);
});
