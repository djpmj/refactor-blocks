import { expect, test, type Locator, type Page } from '@playwright/test';
import { selectStage, startChangeRequests } from './selectStage.js';
import discountDraft from './discount-solved.json' with { type: 'json' };
import templateMethodDraft from './template-method-solved.json' with { type: 'json' };

async function startPaymentChange(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '上級2: 決済ゲートウェイをインターフェース越しに呼ぶ');
  for (const [gateway, log] of [['Stripe', '決済ログを記録する(Stripe)'], ['Paypal', '決済ログを記録する(PayPal)']] as const) {
    await page.getByTestId(`class-${gateway}Gateway`).getByTestId('method-charge').click();
    await page.getByLabel(log).check();
    await page.getByLabel('新しいメソッド名').fill(`log${gateway}Payment`);
    await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
    await page.getByTestId(`class-header-${gateway}Gateway`).click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await menu.getByRole('menuitem', { name: '実装するインターフェースを設定' }).click();
    await menu.getByRole('menuitemcheckbox', { name: 'PaymentGateway' }).click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  }
  await startChangeRequests(page);
}

async function insideCanvas(canvas: Locator, items: Locator): Promise<boolean> {
  const bounds = await canvas.boundingBox();
  if (bounds === null || await items.count() === 0) return false;
  for (const item of await items.all()) {
    const box = await item.boundingBox();
    if (box === null || box.x < bounds.x || box.y < bounds.y
      || box.x + box.width > bounds.x + bounds.width
      || box.y + box.height > bounds.y + bounds.height) return false;
  }
  return true;
}

test('1440幅の上級2で部品置き場と全ファイルが見え、倍率0.6以上になる', async ({ page }) => {
  test.setTimeout(90_000);
  // Arrange / Act
  await startPaymentChange(page);
  const canvas = page.locator('.app__view:not([hidden]) .canvas-column__flow');
  const trayParts = page.getByTestId('class-部品置き場').locator('[data-method-id]');
  const files = canvas.locator('.react-flow__node-fileNode');

  // Assert
  await expect(page.getByRole('button', { name: 'サイドバーを開く' })).toBeVisible();
  await expect.poll(async () => insideCanvas(canvas, trayParts)).toBe(true);
  await expect.poll(async () => insideCanvas(canvas, files)).toBe(true);
  await expect.poll(async () => {
    const transform = await canvas.locator('.react-flow__viewport').getAttribute('style');
    return Number(transform?.match(/scale\(([^)]+)\)/)?.[1] ?? 0);
  }).toBeGreaterThanOrEqual(0.6);
});

test('1440幅の上級3で部品置き場を含む全ファイルが見え、全体表示後も切れない', async ({ page }) => {
  test.setTimeout(90_000);
  // Arrange
  await page.addInitScript(({ id, value }) => {
    localStorage.setItem('refactor-blocks:drafts', JSON.stringify({ [id]: value }));
  }, { id: 'advanced-discount-strategy', value: discountDraft });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '上級3: 会員ランクの割引をStrategyパターンへ組み替える');

  // Act
  await startChangeRequests(page);
  const canvas = page.locator('.app__view:not([hidden]) .canvas-column__flow');
  const trayParts = page.getByTestId('class-部品置き場').locator('[data-method-id]');
  const files = canvas.locator('.react-flow__node-fileNode');
  await expect(page.getByRole('button', { name: 'サイドバーを開く' })).toBeVisible();
  await expect.poll(async () => insideCanvas(canvas, trayParts)).toBe(true);
  await expect.poll(async () => insideCanvas(canvas, files)).toBe(true);
  await expect.poll(async () => Number((await canvas.locator('.react-flow__viewport').getAttribute('style'))?.match(/scale\(([^)]+)\)/)?.[1] ?? 0)).toBeGreaterThanOrEqual(0.4);
  await canvas.getByRole('button', { name: 'Fit View' }).click();
  await expect.poll(async () => insideCanvas(canvas, trayParts)).toBe(true);
  await expect.poll(async () => insideCanvas(canvas, files)).toBe(true);
});

test('1440幅の上級8で部品置き場が見え、倍率0.6以上になる', async ({ page }) => {
  test.setTimeout(90_000);
  // Arrange
  await page.addInitScript(({ id, value }) => {
    localStorage.setItem('refactor-blocks:drafts', JSON.stringify({ [id]: value }));
  }, { id: 'advanced-template-method', value: templateMethodDraft });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, '上級8: 取り込みの手順を Template Method にまとめる');

  // Act
  await startChangeRequests(page);
  const canvas = page.locator('.app__view:not([hidden]) .canvas-column__flow');
  const trayParts = page.getByTestId('class-部品置き場').locator('[data-method-id]');

  // Assert
  await expect(page.getByRole('button', { name: 'サイドバーを開く' })).toBeVisible();
  await expect.poll(async () => insideCanvas(canvas, trayParts)).toBe(true);
  await expect.poll(async () => Number((await canvas.locator('.react-flow__viewport').getAttribute('style'))?.match(/scale\(([^)]+)\)/)?.[1] ?? 0)).toBeGreaterThanOrEqual(0.6);
});
