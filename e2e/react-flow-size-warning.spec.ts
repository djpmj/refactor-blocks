import { expect, test, type Page } from '@playwright/test';

async function prepare(page: Page): Promise<{ warnings: string[]; flush: () => Promise<void> }> {
  const zeroSizeWarnings: string[] = [];
  const captures: Promise<void>[] = [];
  await page.addInitScript(() => {
    localStorage.setItem('refactor-blocks:mode-intro-seen:quiz', 'true');
    localStorage.setItem('refactor-blocks:mode-intro-seen:blank', 'true');
  });
  page.on('console', (message) => {
    if (!['warning', 'error'].includes(message.type())) return;
    if (!/error#004|parent container needs a width and a height/i.test(message.text())) return;
    zeroSizeWarnings.push(message.text());
    captures.push(page.locator('.react-flow').evaluateAll((flows) => flows
      .filter((flow) => flow.checkVisibility())
      .map((flow) => {
        const parent = flow.parentElement;
        const rect = parent?.getBoundingClientRect();
        return { parentClass: parent?.className, width: rect?.width, height: rect?.height };
      })).then(async (sizes) => {
      await test.info().attach(`react-flow-size-warning-${captures.length}`, {
        body: JSON.stringify(sizes, null, 2), contentType: 'application/json',
      });
    }));
  });
  return { warnings: zeroSizeWarnings, flush: async () => { await Promise.all(captures); } };
}

async function expectVisibleFlowsSized(page: Page, mode: 'refactor' | 'quiz' | 'blank', minSize = 100): Promise<void> {
  const view = page.locator('.app__view:not([hidden])');
  if (mode === 'quiz') {
    await expect(page.getByTestId('quiz-design-a').locator('.react-flow__node').first()).toBeVisible();
    await expect(page.getByTestId('quiz-design-b').locator('.react-flow__node').first()).toBeVisible();
  } else {
    await expect(view.locator('.react-flow__node').first()).toBeVisible();
  }
  const flows = view.locator('.react-flow');
  const count = await flows.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index++) {
    const box = await flows.nth(index).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(minSize);
    expect(box?.height).toBeGreaterThanOrEqual(minSize);
  }
}

test('モードを行き来しても React Flow の大きさの警告が出ない', async ({ page }) => {
  const { warnings, flush } = await prepare(page);
  await page.goto('/');
  await expectVisibleFlowsSized(page, 'refactor');
  for (const mode of ['quiz', 'refactor', 'blank', 'refactor', 'quiz', 'blank', 'refactor'] as const) {
    await page.getByTestId(`mode-${mode}`).click();
    await expectVisibleFlowsSized(page, mode);
  }
  await flush();
  expect(warnings).toEqual([]);
});

// 300px 幅の白紙設計では、メソッドエディタが幅を取って .app__canvas が 0 になる(原因インスタンス: canvas-column__flow)。
// 狭幅のレイアウト自体の改善はスコープ外なので、ここでは警告が出ないことと、外枠が 0 でない(1px 以上)ことだけを確かめる。
test('狭い画面で白紙設計に切り替えても警告が出ない', async ({ page }) => {
  const { warnings, flush } = await prepare(page);
  await page.setViewportSize({ width: 300, height: 600 });
  await page.goto('/');
  await expect(page.locator('.app__view:not([hidden]) .react-flow__node').first()).toBeVisible();
  for (const mode of ['quiz', 'blank', 'refactor', 'blank'] as const) {
    await page.getByTestId(`mode-${mode}`).click();
    await expect(page.locator('.app__view:not([hidden]) .react-flow__node').first()).toBeVisible();
    await expectVisibleFlowsSized(page, mode, 1);
  }
  // 1px の間に fitView が走っても、画面を広げ直せば全体が見える縮尺に戻る(縮尺が残らない)
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.getByTestId('mode-refactor').click();
  await expectVisibleFlowsSized(page, 'refactor');
  const flowBox = await page.locator('.app__view:not([hidden]) .react-flow').first().boundingBox();
  const nodeBox = await page.locator('.app__view:not([hidden]) .react-flow__node').first().boundingBox();
  expect(nodeBox?.width).toBeGreaterThan(20);
  expect(nodeBox?.x).toBeGreaterThanOrEqual(flowBox?.x ?? 0);
  expect((nodeBox?.x ?? 0) + (nodeBox?.width ?? 0)).toBeLessThanOrEqual((flowBox?.x ?? 0) + (flowBox?.width ?? 0));
  await flush();
  expect(warnings).toEqual([]);
});

test('課題サイドバーとメソッドエディタを開閉しても警告が出ない', async ({ page }) => {
  const { warnings, flush } = await prepare(page);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto('/');
  await expectVisibleFlowsSized(page, 'refactor');
  await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  await page.locator('[data-method-id]').first().click();
  await page.getByRole('button', { name: 'サイドバーを閉じる' }).click();
  await page.getByTestId('mode-quiz').click();
  await expectVisibleFlowsSized(page, 'quiz');
  await page.getByTestId('mode-refactor').click();
  await expectVisibleFlowsSized(page, 'refactor');
  await flush();
  expect(warnings).toEqual([]);
});
