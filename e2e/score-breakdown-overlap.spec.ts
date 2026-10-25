import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

type Box = { x: number; y: number; width: number; height: number };

const apart = (a: Box, b: Box) => a.y >= b.y + b.height || a.y + a.height <= b.y || a.x >= b.x + b.width || a.x + a.width <= b.x;

async function openBreakdown(page: Page, width: number) {
  // ステージ選択の補助操作は狭い幅だとサイドバーに隠れるため、広い幅で選んでから狭める
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.setViewportSize({ width, height: 1000 });
  await page.locator('.score-breakdown summary').click();
}

for (const width of [1800, 1280, 1024, 800, 480, 375, 320]) {
  test(`採点内訳を開いても、ツールバーのボタンが隠れずに押せる(幅${String(width)})`, async ({ page }) => {
    // Arrange
    await openBreakdown(page, width);

    // Act
    const items = await page.locator('.score-breakdown__items').boundingBox();

    // Assert: 内訳は画面内にあり、ツールバーのどのボタンとも重ならない
    expect(items).not.toBeNull();
    expect(items?.x).toBeGreaterThanOrEqual(0);
    for (const button of await page.locator('.toolbar button').all()) {
      const box = await button.boundingBox();
      if (box === null || items === null) continue;
      expect(apart(box, items), (await button.textContent()) ?? undefined).toBe(true);
    }

    // Act & Assert: ツールバーのポップオーバー系ボタンが実際に押せる(内訳が上に被っていれば Playwright の実クリックが失敗する)
    for (const button of ['hint-popover-button', 'rumor-popover-button']) {
      await page.getByTestId(button).click();
      await expect(page.getByTestId(button)).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId(button)).toHaveAttribute('aria-expanded', 'false');
    }
    await page.getByTestId('reference-menu-button').click();
    await expect(page.getByTestId('reference-before')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('operation-guide-open').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}

for (const width of [1280, 1001, 1000, 975, 961, 960, 600, 375]) {
  test(`手直しの案内バナーが出ていても、採点内訳はバナーに隠れずツールバーとも重ならない(幅${String(width)})`, async ({ page }) => {
    // Arrange: 広い幅でバナーの出るステージを選んでから幅を変えて内訳を開く
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/');
    await selectStage(page, '初級1: 何でも屋の UserController', { completeOpeningFix: false });
    await expect(page.locator('.opening-fix-banner')).toBeVisible();
    await page.setViewportSize({ width, height: 1000 });

    // Act
    await page.locator('.score-breakdown summary').click();
    const items = page.locator('.score-breakdown__items');
    const box = await items.boundingBox();

    // Assert: ツールバーのボタンと重ならない
    expect(box).not.toBeNull();
    for (const button of await page.locator('.toolbar button').all()) {
      const buttonBox = await button.boundingBox();
      if (buttonBox === null || box === null) continue;
      expect(apart(buttonBox, box), (await button.textContent()) ?? undefined).toBe(true);
    }
    // Assert: 内訳の四隅の少し内側と中心が、バナーなど他の要素ではなく内訳自身に当たる(前面にある)
    if (box === null) return;
    const points = [[4, 4], [box.width - 4, 4], [box.width / 2, box.height / 2], [4, box.height - 4], [box.width - 4, box.height - 4]];
    for (const [dx, dy] of points) {
      const onItems = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.score-breakdown__items') !== null, [box.x + dx, box.y + dy]);
      expect(onItems, `点(${String(dx)}, ${String(dy)})`).toBe(true);
    }
  });
}
