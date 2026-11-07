import { expect, test, type Locator, type Page } from '@playwright/test';

function blankView(page: Page): Locator {
  return page.getByTestId('blank-view');
}

async function openBlank(page: Page) {
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
}

test('800x600 で、部品置き場の7部品がすべてキャンバスの内側に見え、最後の部品をドラッグして置ける', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 800, height: 600 });
  await openBlank(page);
  const view = blankView(page);
  await view.locator('.app__canvas').scrollIntoViewIfNeeded();
  const methods = view.getByTestId('class-部品置き場').locator('[data-testid^="method-"]');
  await expect(methods).toHaveCount(7);

  // Assert(位置)
  await expect
    .poll(async () => {
      const pane = await view.locator('.react-flow__pane').boundingBox();
      if (pane === null) return false;
      for (const method of await methods.all()) {
        const box = await method.boundingBox();
        if (box === null) return false;
        const inside =
          box.x >= pane.x &&
          box.y >= pane.y &&
          box.x + box.width <= pane.x + pane.width &&
          box.y + box.height <= pane.y + pane.height &&
          box.y + box.height <= 600;
        if (!inside) return false;
      }
      return true;
    })
    .toBe(true);

  // Act
  const last = await methods.last().boundingBox();
  const pane = await view.locator('.react-flow__pane').boundingBox();
  if (last === null || pane === null) throw new Error('位置を取得できません');
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width / 2 + 20, last.y + last.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();

  // Assert
  await expect(view.getByTestId('blank-unplaced')).toContainText('部品置き場に残っている部品: あと6個');
});

test('800x600 で、白紙設計の画面がスクロールでき、キャンバスの高さが 420px 以上ある', async ({ page }) => {
  // Arrange & Act
  await page.setViewportSize({ width: 800, height: 600 });
  await openBlank(page);

  // Assert
  const view = blankView(page);
  const scrollable = await view.evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrollable).toBe(true);
  const canvas = await view.locator('.app__canvas').boundingBox();
  if (canvas === null) throw new Error('位置を取得できません');
  expect(canvas.height).toBeGreaterThanOrEqual(420);
});

test('1024x700 で7部品がキャンバス内に収まり、先頭の部品もドラッグできる', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1024, height: 700 });
  await openBlank(page);
  const view = blankView(page);
  await view.locator('.app__canvas').scrollIntoViewIfNeeded();
  const methods = view.getByTestId('class-部品置き場').locator('[data-testid^="method-"]');
  await expect(methods).toHaveCount(7);

  // Assert
  await expect.poll(async () => {
    const pane = await view.locator('.react-flow__pane').boundingBox();
    if (pane === null) return false;
    for (const method of await methods.all()) {
      const box = await method.boundingBox();
      if (box === null || box.x < pane.x || box.y < pane.y ||
        box.x + box.width > pane.x + pane.width || box.y + box.height > pane.y + pane.height) return false;
    }
    return true;
  }).toBe(true);

  // Act: 最後以外の部品を選び、既存のドラッグ操作と同じ手順で移す。
  const first = await methods.first().boundingBox();
  const pane = await view.locator('.react-flow__pane').boundingBox();
  if (first === null || pane === null) throw new Error('位置を取得できません');
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + first.width / 2 + 20, first.y + first.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();

  // Assert
  await expect(view.getByTestId('blank-unplaced')).toContainText('部品置き場に残っている部品: あと6個');
});

test('1440x900 では、白紙設計の画面はスクロールしない', async ({ page }) => {
  // Arrange & Act
  await page.setViewportSize({ width: 1440, height: 900 });
  await openBlank(page);

  // Assert
  const diff = await blankView(page).evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(diff).toBeLessThanOrEqual(1);
});
