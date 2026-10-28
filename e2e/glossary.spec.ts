import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE_2 = 'チュートリアル2: 太った placeOrder';
const COUPLING_STAGE = '中級3: 越境する private メソッド';

test('クリア条件の用語にマウスを乗せると定義が出て、ポップオーバーの上でも消えず、外へ出すと消える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, COUPLING_STAGE);
  await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  const term = page.locator('.clear-conditions').getByTestId('glossary-term-coupling');
  const popover = page.locator('.clear-conditions').getByTestId('glossary-popover-coupling');
  await expect(popover).toBeHidden();

  // Act
  await term.hover();

  // Assert
  await expect(popover).toBeVisible();
  await expect(popover).toContainText('結合度');
  await expect(popover).toContainText('例:');

  // Act: ポップオーバーの上へ移す
  const box = await popover.boundingBox();
  expect(box).not.toBeNull();
  if (box !== null) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });

  // Assert
  await expect(popover).toBeVisible();

  // Act
  await page.mouse.move(0, 0);

  // Assert
  await expect(popover).toBeHidden();
});

test('Tab でフォーカスすると出て、Esc で消えてフォーカスは残り、開き直さない。Tab で次へ移ると消える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, COUPLING_STAGE);
  await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  const term = page.locator('.clear-conditions').getByTestId('glossary-term-coupling');
  const popover = page.locator('.clear-conditions').getByTestId('glossary-popover-coupling');

  // Act
  await term.focus();

  // Assert
  await expect(popover).toBeVisible();

  // Act
  await page.keyboard.press('Escape');

  // Assert
  await expect(popover).toBeHidden();
  await expect(term).toBeFocused();
  await page.waitForTimeout(100);
  await expect(popover).toBeHidden();

  // Act: 別のところへ移って戻り、Tab で離れる
  await term.blur();
  await term.focus();
  await expect(popover).toBeVisible();
  await page.keyboard.press('Tab');

  // Assert
  await expect(popover).toBeHidden();
});

test('用語ボタンの aria-describedby は定義を含む要素を指し、閉じていても読める。クリックで開き、外を押すと消える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, COUPLING_STAGE);
  await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  const term = page.locator('.clear-conditions').getByTestId('glossary-term-coupling');
  const popover = page.locator('.clear-conditions').getByTestId('glossary-popover-coupling');

  // Assert
  const describedBy = await term.getAttribute('aria-describedby');
  expect(describedBy).not.toBeNull();
  await expect(page.locator(`[id="${String(describedBy)}"]`)).toContainText('依存している');
  await expect(popover).toBeHidden();

  // Act
  await term.click();

  // Assert
  await expect(popover).toBeVisible();

  // Act
  await page.getByRole('heading', { level: 1 }).click();

  // Assert
  await expect(popover).toBeHidden();
});

test('ステージ一覧のタグの用語を押してもステージは変わらずダイアログも閉じず、Esc は用語→ダイアログの順に閉じる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();
  const dialog = page.getByTestId('stage-roadmap');
  const card = dialog.getByTestId('roadmap-card-tutorial-extract-method');
  const term = card.getByTestId('glossary-term-extract-method');
  const popover = card.getByTestId('glossary-popover-extract-method');

  // Act
  await term.click();

  // Assert
  await expect(popover).toBeVisible();
  await expect(dialog).toBeVisible();

  // Act
  await page.keyboard.press('Escape');

  // Assert
  await expect(popover).toBeHidden();
  await expect(dialog).toBeVisible();

  // Act
  await page.keyboard.press('Escape');

  // Assert
  await expect(dialog).toHaveCount(0);
});

test('ステージ一覧のカードのタイトル部分を押すと、これまでどおりそのステージへ移る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();

  // Act
  await page.getByTestId('roadmap-stage-tutorial-order-service').click();

  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STAGE_2);
});

test('減点の内訳の「なぜ?」を開くと「ことば:」の行から定義を引ける', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, COUPLING_STAGE);
  const breakdown = page.locator('.score-breakdown');
  await breakdown.locator('summary').click();
  const item = breakdown.locator('.score-breakdown__item').filter({ hasText: '結合度 ×' });

  // Act
  await item.getByRole('button', { name: 'なぜ?' }).click();

  // Assert
  const terms = item.locator('.score-breakdown__terms');
  await expect(terms).toContainText('ことば:');
  await terms.getByTestId('glossary-term-coupling').hover();
  await expect(terms.getByTestId('glossary-popover-coupling')).toBeVisible();
  await expect(item.getByText('こう困ります:')).toBeVisible();
});

test('用語を含まない減点項目には「ことば:」の行が出ない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE_2);
  const breakdown = page.locator('.score-breakdown');
  await breakdown.locator('summary').click();
  const item = breakdown.locator('.score-breakdown__item').filter({ hasText: '行数 ×' });

  // Act
  await item.getByRole('button', { name: 'なぜ?' }).click();

  // Assert
  await expect(item.locator('.score-breakdown__terms')).toHaveCount(0);
});
