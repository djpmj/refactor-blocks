import { expect, test, type Page } from '@playwright/test';

/**
 * 実機プレイの探索。全ステージを開き、「人が見て気づく不具合」を機械で確かめる(docs/playtest/CHECKLIST.md)。
 * CIの `npm run test:e2e` には含めない。`npm run explore` で手動に回し、落ちた項目を仕様化する。
 * 既知の未修正の不具合があれば、その項目が落ちる(直したら通る)。
 */

type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function inside(inner: Box, outer: Box): boolean {
  return inner.left >= outer.left && inner.top >= outer.top && inner.right <= outer.right && inner.bottom <= outer.bottom;
}

async function boxesOf(page: Page, selector: string): Promise<Box[]> {
  return page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })),
  );
}

async function openStage(page: Page, index: number): Promise<string> {
  await page.getByTestId('roadmap-open').click();
  const card = page.locator('[data-testid^="roadmap-stage-"]').nth(index);
  const testId = (await card.getAttribute('data-testid')) ?? '';
  await card.click();
  return testId.replace('roadmap-stage-', '');
}

async function checkStage(page: Page, label: string, stageId: string): Promise<void> {
  const progress = await page.evaluate(() => localStorage.getItem('refactor-blocks:progress'));
  expect.soft(progress ?? '', `${label}: 開いただけで進捗に記録された`).not.toContain(`"${stageId}"`);

  const files = await boxesOf(page, '.react-flow__node-fileNode');
  const pairs = files.flatMap((a, i) => files.slice(i + 1).map((b) => [a, b] as const));
  expect.soft(pairs.some(([a, b]) => overlaps(a, b)), `${label}: ファイルの箱が重なっている`).toBe(false);

  const [canvas] = await boxesOf(page, '.react-flow');
  const banner = await boxesOf(page, '[data-testid="opening-fix-banner"]');
  for (const box of banner) {
    expect.soft(inside(box, canvas), `${label}: 案内バナーがキャンバスからはみ出している`).toBe(true);
    const nodes = await boxesOf(page, '.react-flow__node-fileNode, .react-flow__node-classNode');
    expect.soft(nodes.some((node) => overlaps(box, node)), `${label}: 案内バナーが図に重なっている`).toBe(false);
  }

  const overflow = await page.locator('html').evaluate((html) => html.scrollWidth > html.clientWidth);
  expect.soft(overflow, `${label}: 横スクロールが出ている`).toBe(false);
  expect.soft(await page.getByRole('alert').count(), `${label}: 何もしていないのに警告が出ている`).toBe(0);
}

test('全ステージで、開いた直後と、メソッドを選んだ後の表示が崩れていない', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();
  const count = await page.locator('[data-testid^="roadmap-stage-"]').count();
  await page.keyboard.press('Escape');

  for (let index = 0; index < count; index += 1) {
    await page.goto('/');
    const stageId = await openStage(page, index);
    const label = `ステージ${index + 1}(${stageId})`;
    await page.waitForTimeout(500);
    await checkStage(page, `${label} 開いた直後`, stageId);

    const method = page.locator('[data-method-id]').first();
    if (await method.count() > 0) {
      await method.click();
      await page.waitForTimeout(500);
      await checkStage(page, `${label} メソッドを選んだ後`, stageId);
    }
  }
});
