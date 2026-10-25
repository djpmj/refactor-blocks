import { expect, test } from '@playwright/test';

const STAGE_1 = 'チュートリアル1: 長いメソッドを分ける';
const STAGE_2 = 'チュートリアル2: 太った placeOrder';

test('ヘッダーにはステージ選択コンボボックスがない', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'ステージ' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STAGE_1);
  await expect(page.getByTestId('roadmap-open')).toBeVisible();
  await expect(page.getByTestId('story-toggle')).toBeVisible();
});

test('ステージ一覧を開き、カードを選ぶとそのステージへ移ってダイアログが閉じる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  const dialog = page.getByTestId('stage-roadmap');

  // Act
  await page.getByTestId('roadmap-open').click();

  // Assert
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'ステージ一覧' })).toBeVisible();
  await expect(dialog.getByTestId('roadmap-next')).toContainText('次のおすすめ');
  await expect(page.getByTestId('roadmap-stage-tutorial-extract-method')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('roadmap-stage-tutorial-extract-method')).toContainText('Extract Method');

  // Act
  await page.getByTestId('roadmap-stage-tutorial-order-service').click();

  // Assert
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STAGE_2);
});

test('今いるステージのカードを押すと閉じるだけで、ステージは変わらない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();

  // Act
  await page.getByTestId('roadmap-stage-tutorial-extract-method').click();

  // Assert
  await expect(page.getByTestId('stage-roadmap')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STAGE_1);
});

test('Escで閉じてボタンにフォーカスが戻り、キーボードだけでカードを選べる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  const open = page.getByTestId('roadmap-open');
  await open.click();

  // Act
  await page.keyboard.press('Escape');

  // Assert
  await expect(page.getByTestId('stage-roadmap')).toHaveCount(0);
  await expect(open).toBeFocused();

  // Act
  await open.click();
  await page.getByTestId('roadmap-stage-tutorial-order-service').focus();
  await page.keyboard.press('Enter');

  // Assert
  await expect(page.getByTestId('stage-roadmap')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STAGE_2);
});

test('学べることごとの表示で習得状況が見え、未クリアのステージへ移れる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('refactor-blocks:progress', JSON.stringify({ 'tutorial-extract-method': 100, 'tutorial-order-service': 100 })),
  );
  await page.reload();
  await page.getByTestId('roadmap-open').click();
  await expect(page.getByTestId('roadmap-view-stages')).toHaveAttribute('aria-pressed', 'true');

  // Act
  await page.getByTestId('roadmap-view-concepts').click();

  // Assert
  await expect(page.getByTestId('roadmap-view-concepts')).toHaveAttribute('aria-pressed', 'true');
  const rows = page.getByTestId('concept-mastery-row');
  await expect(rows.nth(0)).toHaveAttribute('data-concept', 'Extract Method');
  await expect(rows.nth(1)).toHaveAttribute('data-concept', 'Move Method');
  await expect(rows.nth(0)).toContainText('2件中2件クリア');
  await expect(rows.nth(0)).toContainText('✅ すべてクリア');
  await expect(rows.nth(0).locator('button')).toHaveCount(0);
  await expect(rows.nth(1)).toContainText('件中1件クリア');

  // Act
  await rows.nth(1).getByRole('button', { name: /初級1: 何でも屋の UserController/ }).click();

  // Assert
  await expect(page.getByTestId('stage-roadmap')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('初級1: 何でも屋の UserController');
});

test('記録が無ければ全行が0件クリアで、キーボードで切り替えられる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();

  // Act
  await page.getByTestId('roadmap-view-concepts').focus();
  await page.keyboard.press('Enter');

  // Assert
  const rows = page.getByTestId('concept-mastery-row');
  const count = await rows.count();
  for (let i = 0; i < count; i++) await expect(rows.nth(i)).toContainText('件中0件クリア');
});

test('学べることごとに切り替えて閉じ、再度開くと「ステージ順」に戻っている', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();
  await page.getByTestId('roadmap-view-concepts').click();
  await expect(page.getByTestId('roadmap-view-concepts')).toHaveAttribute('aria-pressed', 'true');

  // Act
  await page.getByRole('button', { name: '閉じる' }).click();
  await expect(page.getByTestId('stage-roadmap')).toHaveCount(0);
  await page.getByTestId('roadmap-open').click();

  // Assert
  await expect(page.getByTestId('roadmap-view-stages')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('roadmap-view-concepts')).toHaveAttribute('aria-pressed', 'false');
});
