import { expect, test, type Locator, type Page } from '@playwright/test';

function blankView(page: Page): Locator {
  return page.getByTestId('blank-view');
}

async function openBlank(page: Page) {
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
}

test('白紙設計の部品置き場には責務のバッジも警告色も出ず、見出しに残りの部品数が出る', async ({ page }) => {
  // Arrange & Act
  await openBlank(page);

  // Assert
  const tray = blankView(page).getByTestId('class-部品置き場');
  await expect(tray.getByTestId('tray-label')).toHaveText('部品置き場(あと 7 個)');
  await expect(tray.locator('.responsibility-count')).toHaveCount(0);
  await expect(tray.locator('.line-badge')).toHaveCount(0);
  await expect(blankView(page).getByTestId('file-部品置き場').locator('.line-badge, .file-mark')).toHaveCount(0);
  await expect(tray).toHaveCSS('border-style', 'dashed');
});

test('開いた直後、部品置き場のファイルの箱がキャンバスの内側に収まっている', async ({ page }) => {
  // Arrange & Act
  await openBlank(page);

  // Assert
  const view = blankView(page);
  await expect(view.getByTestId('method-placeOrder')).toBeVisible();
  const file = await view.getByTestId('file-部品置き場').boundingBox();
  const pane = await view.locator('.react-flow__pane').boundingBox();
  if (file === null || pane === null) throw new Error('位置を取得できません');
  expect(file.x).toBeGreaterThan(pane.x);
  expect(file.y).toBeGreaterThan(pane.y);
});

test('部品を余白へ移しても、部品置き場から新しいクラスへの矢印は出ない', async ({ page }) => {
  // Arrange
  await openBlank(page);
  const view = blankView(page);
  const method = await view.getByTestId('method-placeOrder').boundingBox();
  const pane = await view.locator('.react-flow__pane').boundingBox();
  if (method === null || pane === null) throw new Error('位置を取得できません');

  // Act
  await page.mouse.move(method.x + method.width / 2, method.y + method.height / 2);
  await page.mouse.down();
  await page.mouse.move(method.x + method.width / 2 + 20, method.y + method.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();

  // Assert
  await expect(view.getByTestId('class-OrderService')).toBeVisible();
  await expect(view.locator('.react-flow__edge')).toHaveCount(0);
});

test('白紙設計の問題文は本文と同じ大きさで表示される', async ({ page }) => {
  // Arrange & Act
  await openBlank(page);

  // Assert
  const bodySize = await page.locator('body').evaluate((body) => body.ownerDocument.defaultView?.getComputedStyle(body).fontSize ?? '');
  await expect(blankView(page).getByTestId('blank-requirement')).toHaveCSS('font-size', bodySize);
});
