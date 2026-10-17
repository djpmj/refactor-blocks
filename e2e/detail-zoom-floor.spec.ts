import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function viewportZoom(page: Page): Promise<number> {
  const transform = await page.locator('.react-flow__viewport').getAttribute('style');
  const match = transform?.match(/scale\(([^)]+)\)/);
  if (match === undefined || match === null) throw new Error('ズーム倍率を取得できません');
  return Number(match[1]);
}

test('図が大きいステージでも、自動の合わせはメソッドが見える倍率で最初のファイルを左上に出す', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.goto('/');

  await selectStage(page, '上級6: 太ったインターフェースを役割ごとに分ける');

  await expect.poll(() => viewportZoom(page)).toBeGreaterThanOrEqual(0.599);
  await expect(page.locator('.method-chip').first()).toBeVisible();
  await expect(page.getByTestId('detail-zoom-notice')).toHaveCount(0);
  const canvas = await page.locator('.app__canvas').boundingBox();
  const firstFile = await page.locator('.react-flow__node-fileNode').first().boundingBox();
  if (canvas === null || firstFile === null) throw new Error('位置を取得できません');
  expect(firstFile.x).toBeGreaterThanOrEqual(canvas.x);
  expect(firstFile.y).toBeGreaterThanOrEqual(canvas.y);
});

test('全体を表示すると知らせが出て、「中身が見える大きさにする」でメソッドが戻る', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.goto('/');
  await selectStage(page, '上級6: 太ったインターフェースを役割ごとに分ける');

  await page.getByRole('button', { name: /fit view/i }).click();

  await expect.poll(() => viewportZoom(page)).toBeLessThan(0.6);
  const notice = page.getByTestId('detail-zoom-notice');
  await expect(notice).toHaveAttribute('role', 'status');
  await expect(notice).toContainText('縮小中はメソッドを隠しています');
  await expect(page.locator('.method-chip')).toHaveCount(0);

  await notice.getByRole('button', { name: '中身が見える大きさにする' }).click();

  await expect(notice).toHaveCount(0);
  await expect(page.locator('.method-chip').first()).toBeVisible();
});

test('全体が0.6以上で収まるステージは、今までどおり全体が中央に収まる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');

  await expect(page.getByTestId('detail-zoom-notice')).toHaveCount(0);
  const canvas = await page.locator('.app__canvas').boundingBox();
  const nodes = await page.locator('.react-flow__node-fileNode').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()));
  if (canvas === null) throw new Error('位置を取得できません');
  for (const node of nodes) {
    expect(node.left).toBeGreaterThanOrEqual(canvas.x - 2);
    expect(node.right).toBeLessThanOrEqual(canvas.x + canvas.width + 2);
  }
});

test('中級10はキャンバスが狭くてもメソッドを隠さずに開く', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.goto('/');

  await selectStage(page, '中級10: 会員ランクごとのif分岐をクラスに分ける');

  await expect.poll(() => viewportZoom(page)).toBeGreaterThanOrEqual(0.599);
  await expect(page.locator('.method-chip').first()).toBeVisible();
});
