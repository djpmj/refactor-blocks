import { expect, test } from '@playwright/test';

for (const [width, height] of [[300, 600], [400, 700], [500, 700], [900, 700]] as const) {
  test(`${width}x${height} で、白紙設計のキャンバスが200px以上の幅で表示され、部品を操作できる`, async ({ page }) => {
    const flowWarnings: string[] = [];
    page.on('console', (message) => {
      if (message.text().includes('error#004')) flowWarnings.push(message.text());
    });
    // Arrange
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByTestId('mode-blank').click();
    const view = page.getByTestId('blank-view');
    const method = view.getByTestId('class-部品置き場').locator('[data-testid^="method-"]').first();

    // Act
    await method.scrollIntoViewIfNeeded();
    await method.click();

    // Assert
    const canvas = await view.locator('.app__canvas').boundingBox();
    expect(canvas?.width ?? 0).toBeGreaterThanOrEqual(200);
    await expect(view.locator('.method-editor')).toBeVisible();

    if (width <= 500) {
      const editor = await view.locator('.method-editor').boundingBox();
      expect(editor?.y ?? 0).toBeGreaterThan((canvas?.y ?? 0) + (canvas?.height ?? 0) - 1);
      const pane = view.locator('.react-flow__pane');
      await pane.scrollIntoViewIfNeeded();
      const source = await view.getByTestId('method-placeOrder').boundingBox();
      const target = await pane.boundingBox();
      if (source === null || target === null) throw new Error('ドラッグ座標を取得できません');
      const corners = [
        { x: target.x + target.width - 30, y: target.y + target.height - 30 },
        { x: target.x + 30, y: target.y + target.height - 30 },
        { x: target.x + target.width - 30, y: target.y + 30 },
        { x: target.x + 30, y: target.y + 30 },
      ];
      let destination;
      const files = await view.locator('.file-node').all();
      const fileBoxes = await Promise.all(files.map((file) => file.boundingBox()));
      for (const corner of corners) {
        const covered = fileBoxes.some((box) => box !== null && corner.x >= box.x && corner.x <= box.x + box.width && corner.y >= box.y && corner.y <= box.y + box.height);
        if (!covered) { destination = corner; break; }
      }
      if (destination === undefined) throw new Error('キャンバスの余白が見つかりません');
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
      await page.mouse.down();
      await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
      await page.mouse.move(destination.x, destination.y, { steps: 15 });
      await page.mouse.up();
      await expect(view.getByTestId('class-OrderService').getByTestId('method-placeOrder')).toBeVisible();
      await expect(view.getByTestId('blank-unplaced')).toContainText('あと6個');
      await view.locator('.method-editor').scrollIntoViewIfNeeded();
      expect(await view.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    }
    expect(flowWarnings).toEqual([]);
  });
}

test('1440pxではキャンバスとエディタが横並びになる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
  const view = page.getByTestId('blank-view');
  await view.getByTestId('method-placeOrder').click();
  const canvas = await view.locator('.app__canvas').boundingBox();
  const editor = await view.locator('.method-editor').boundingBox();
  expect(canvas?.width ?? 0).toBeGreaterThanOrEqual(200);
  expect(editor?.x ?? 0).toBeGreaterThanOrEqual((canvas?.x ?? 0) + (canvas?.width ?? 0) - 1);
});

test('400pxで縦積みでも、キーボードのTab順はキャンバスの部品からエディタへ進む', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 400, height: 700 });
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
  const view = page.getByTestId('blank-view');
  const method = view.getByTestId('method-placeOrder');
  await method.click();
  const editor = view.locator('.method-editor');
  await expect(editor).toBeVisible();
  await method.focus();

  // Act
  let reachedEditor = false;
  for (let i = 0; i < 60 && !reachedEditor; i += 1) {
    await page.keyboard.press('Tab');
    reachedEditor = (await editor.locator(':focus').count()) > 0;
  }

  // Assert
  expect(reachedEditor).toBe(true);
  const focused = await editor.locator(':focus').boundingBox();
  const canvas = await view.locator('.app__canvas').boundingBox();
  expect(focused?.y ?? 0).toBeGreaterThan((canvas?.y ?? 0) + (canvas?.height ?? 0) - 1);
});
