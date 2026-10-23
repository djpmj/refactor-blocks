import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('狭い画面では課題とエディタをキャンバスに重ねて開閉できる', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける', { completeOpeningFix: false });
  const closeSidebar = page.getByRole('button', { name: 'サイドバーを閉じる' });
  if (await closeSidebar.count() > 0) await closeSidebar.click();

  const canvas = page.getByRole('region', { name: 'コードベース' });
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox?.width).toBeGreaterThanOrEqual(340);
  const sidebar = page.getByRole('complementary', { name: '課題とヒント' });
  await expect(sidebar).toBeHidden();
  await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox())?.width).toBeGreaterThanOrEqual(315);
  await page.getByRole('button', { name: 'サイドバーを閉じる' }).click();
  await expect(sidebar).toBeHidden();
  await expect(page.getByRole('button', { name: 'サイドバーを開く' })).toBeFocused();

  await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  await page.keyboard.press('Escape');
  await expect(sidebar).toBeHidden();
  await expect(page.getByRole('button', { name: 'サイドバーを開く' })).toBeFocused();

  const method = page.getByTestId('method-printMonthlyReport');
  await method.click();
  const editor = page.locator('.method-editor');
  await expect(editor).toBeVisible();
  await expect(page.getByTestId('editor-rail')).toBeHidden();
  expect((await editor.boundingBox())?.width).toBeGreaterThanOrEqual(315);
  const fragment = page.getByRole('checkbox').first();
  await fragment.check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(editor).toContainText('抽出');
  const editorClose = page.getByRole('button', { name: 'メソッドエディタを閉じる' });
  await editorClose.click();
  await expect(editor).toBeHidden();
  await expect(method).toBeFocused();
});

test('デスクトップ幅では3列配置を保つ', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  const openSidebar = page.getByRole('button', { name: 'サイドバーを開く' });
  if (await openSidebar.count() > 0) await openSidebar.click();
  const sidebar = page.getByRole('complementary', { name: '課題とヒント' });
  const canvas = page.getByRole('region', { name: 'コードベース' });
  const editor = page.getByTestId('method-editor');
  await expect(sidebar).toBeVisible();
  await expect(page.getByTestId('editor-rail')).toBeVisible();
  const sidebarBox = await sidebar.boundingBox();
  const canvasBox = await canvas.boundingBox();
  const editorBox = await page.getByTestId('editor-rail').boundingBox();
  expect(sidebarBox?.x).toBeLessThan(canvasBox?.x ?? 0);
  expect(editorBox?.x).toBeGreaterThan((canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) - 1);
  await expect(editor).toBeHidden();
});
