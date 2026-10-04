import { expect, test, type Page } from '@playwright/test';

async function openStage(page: Page, label: string) {
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label });
}

async function dragMethodToEmptyCanvas(page: Page, methodId: string) {
  const source = await page.getByTestId(methodId).boundingBox();
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (source === null || pane === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();
}

async function clickInCanvas(page: Page, testId: string) {
  const target = page.getByTestId(testId);
  const box = await target.boundingBox();
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (box === null || pane === null) throw new Error('要素の位置を取得できません');
  const point = await page.evaluate<{ x: number; y: number } | null>(`(() => {
    const rect = document.querySelector('.react-flow__pane')?.getBoundingClientRect();
    if (rect === undefined) return null;
    for (let y = rect.top + 10; y < rect.bottom; y += 20) {
      for (let x = rect.left + 10; x < rect.right; x += 20) {
        if (document.elementFromPoint(x, y)?.classList.contains('react-flow__pane')) return { x, y };
      }
    }
    return null;
  })()`);
  if (point === null) throw new Error('キャンバスに空いている場所がありません');
  const dx = pane.x + pane.width / 2 - (box.x + box.width / 2);
  const dy = pane.y + pane.height / 2 - (box.y + box.height / 2);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 10 });
  await page.mouse.up();
  await target.click();
}

async function expectToastClearOfControls(page: Page) {
  const canvas = await page.locator('.app__canvas').boundingBox();
  const toast = await page.locator('.error-toast').boundingBox();
  const controls = await page.locator('.react-flow__controls').boundingBox();
  const closeButton = page.getByLabel('メッセージを閉じる');
  const closeBox = await closeButton.boundingBox();
  const viewport = page.viewportSize();
  if (canvas === null || toast === null || controls === null || closeBox === null || viewport === null) {
    throw new Error('キャンバス、トースト、またはコントロールの位置を取得できません');
  }
  expect(canvas.width).toBeGreaterThanOrEqual(120);
  expect(toast.width).toBeGreaterThan(100);
  await expect(page.locator('.error-toast')).toBeInViewport();
  await expect(closeButton).toBeInViewport();
  expect(toast.x).toBeGreaterThanOrEqual(0);
  expect(toast.x + toast.width).toBeLessThanOrEqual(viewport.width);
  expect(toast.y).toBeGreaterThanOrEqual(0);
  expect(toast.y + toast.height).toBeLessThanOrEqual(viewport.height);
  expect(closeBox.y).toBeGreaterThanOrEqual(0);
  expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(900);
  const overlaps =
    toast.x < controls.x + controls.width &&
    toast.x + toast.width > controls.x &&
    toast.y < controls.y + controls.height &&
    toast.y + toast.height > controls.y;
  expect(overlaps).toBe(false);
}

test('処理のあるファイルは削除できず、循環依存の減点が残る', async ({ page }) => {
  await openStage(page, '中級1: 循環依存を断ち切る');
  const file = page.getByTestId('file-src/order/Order.ts');
  await file.click({ button: 'right', position: { x: 10, y: 10 } });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'ファイルを削除' }).click();

  const toast = page.locator('.app__canvas').getByRole('alert');
  await expect(toast).toHaveText('⚠処理が残っているクラスがあるファイルは削除できません。先にメソッドを別のクラスへ移してください×');
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(file).toBeVisible();
  await expect(page.getByTestId('class-Order')).toBeVisible();
  await expect(page.getByTestId('score')).toContainText('循環依存 -20');
  const sidebarToggle = page.getByRole('button', { name: /サイドバーを(開く|閉じる)/ });
  await sidebarToggle.click();
  await expect(sidebarToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toast).toBeVisible();
  await sidebarToggle.click();
  await expect(sidebarToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toast).toBeVisible();

  // Act: トーストを閉じ、同じ拒否操作で再び表示する
  await page.getByLabel('メッセージを閉じる').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await file.click({ button: 'right', position: { x: 10, y: 10 } });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'ファイルを削除' }).click();

  // Assert
  await expect(page.locator('.app__canvas').getByRole('alert')).toContainText('処理が残っているクラスがあるファイルは削除できません');
  await expect(page.getByRole('alert')).toHaveCount(1);

  // Act: トースト表示中もキャンバスのドロップ操作を行える
  const method = page.getByTestId('class-Customer').getByTestId('method-calculateOrderTotal');
  const target = page.getByTestId('class-Order');
  const methodBox = await method.boundingBox();
  const targetBox = await target.boundingBox();
  if (methodBox === null || targetBox === null) throw new Error('ドラッグ対象の位置を取得できません');
  await page.mouse.move(methodBox.x + methodBox.width / 2, methodBox.y + methodBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 15 });
  await page.mouse.up();

  // Assert: 有効なドラッグが完了し、成功操作によってトーストが消える
  await expect(target.getByTestId('method-calculateOrderTotal')).toBeVisible();
  await expect(method).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('狭い画面でもトーストはキャンバスコントロールに重ならない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openStage(page, '中級1: 循環依存を断ち切る');
  const file = page.getByTestId('file-src/order/Order.ts');
  await file.click({ button: 'right', position: { x: 10, y: 10 } });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'ファイルを削除' }).click();

  const toggle = page.getByRole('button', { name: /サイドバーを(開く|閉じる)/ });
  for (const width of [600, 800, 1000, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    for (const expanded of [false, true]) {
      const current = await toggle.getAttribute('aria-expanded');
      if (current !== String(expanded)) await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', String(expanded));
      await expectToastClearOfControls(page);
    }
  }
});

test('public にした抽出メソッドが残るクラスは削除できない', async ({ page }) => {
  await openStage(page, '中級3: 越境する private メソッド');
  await page.getByTestId('method-notifyShipment').click();
  await page.getByLabel('通知に必要な情報を集める').check();
  await page.getByLabel('新しいメソッド名').fill('gatherNotificationInfo');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await dragMethodToEmptyCanvas(page, 'method-gatherNotificationInfo');
  const visibility = page.getByLabel('メソッド gatherNotificationInfo の可視性');
  await clickInCanvas(page, 'method-gatherNotificationInfo');
  await expect(visibility).toBeVisible();
  await visibility.selectOption('public');
  await page.getByTestId('class-header-NewClass').click({ button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'クラスを削除' }).click();

  await expect(page.locator('.app__canvas').getByRole('alert')).toContainText('処理が残っているクラスは削除できません。先にメソッドを別のクラスへ移してください');
  await expect(page.getByTestId('class-NewClass').getByTestId('method-gatherNotificationInfo')).toBeVisible();
});
