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
