import { expect, test, type Page } from '@playwright/test';

async function openStage(page: Page, label: string) {
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label });
}

async function dragMethodToClass(page: Page, methodId: string, classId: string) {
  const source = await page.getByTestId(methodId).boundingBox();
  const target = await page.getByTestId(classId).boundingBox();
  if (source === null || target === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
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

test('処理のあるファイルは削除できず、循環依存の減点が残る', async ({ page }) => {
  await openStage(page, '中級1: 循環依存を断ち切る');
  const file = page.getByTestId('file-src/order/Order.ts');
  await file.click({ button: 'right', position: { x: 10, y: 10 } });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'ファイルを削除' }).click();

  await expect(page.getByRole('alert')).toHaveText('処理が残っているクラスがあるファイルは削除できません。先にメソッドを別のクラスへ移してください');
  await expect(file).toBeVisible();
  await expect(page.getByTestId('class-Order')).toBeVisible();
  await expect(page.getByTestId('score')).toContainText('循環依存 -20');
});

test('public にした抽出メソッドが残るクラスは削除できない', async ({ page }) => {
  await openStage(page, 'チュートリアル2: 太った placeOrder');
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await dragMethodToClass(page, 'method-calculateTax', 'class-TaxCalculator');
  const visibility = page.getByLabel('メソッド calculateTax の可視性');
  await clickInCanvas(page, 'method-calculateTax');
  await expect(visibility).toBeVisible();
  await visibility.selectOption('public');
  await page.getByTestId('class-header-TaxCalculator').click({ button: 'right' });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'クラスを削除' }).click();

  await expect(page.getByRole('alert')).toHaveText('処理が残っているクラスは削除できません。先にメソッドを別のクラスへ移してください');
  await expect(page.getByTestId('class-TaxCalculator').getByTestId('method-calculateTax')).toBeVisible();
});
