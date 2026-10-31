import { expect, test, type Page } from '@playwright/test';
import { openHints, openRumors } from './hintPopover.js';
import { dismissClearScreen, selectStage } from './selectStage.js';

const TUTORIAL1 = 'チュートリアル1: 長いメソッドを分ける';
const STAGE2 = 'チュートリアル2: 太った placeOrder';

async function openTutorial1(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, TUTORIAL1);
}

async function extractAggregate(page: Page, name: string) {
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await dismissClearScreen(page);
}

const historyButton = (page: Page) => page.getByTestId('operation-history-button');
const entries = (page: Page) => page.getByTestId('operation-history-entry');

test('操作する前は「まだ操作していません」が出る', async ({ page }) => {
  // Arrange
  await openTutorial1(page);

  // Act
  await historyButton(page).click();

  // Assert
  await expect(page.getByTestId('operation-history')).toContainText('まだ操作していません。抽出や移動をすると、ここに点数の変化が残ります');
});

test('抽出すると、操作名・点数の増減・変わった減点が一覧に残る', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  await extractAggregate(page, 'aggregateSales');

  // Act
  await historyButton(page).click();

  // Assert
  await expect(entries(page)).toHaveCount(1);
  await expect(entries(page).first()).toContainText('1. メソッドの抽出');
  await expect(entries(page).first()).toContainText('90点 → 100点(+10)');
  await expect(entries(page).first().getByTestId('operation-history-change').first()).toContainText('件消えました(+');
  await expect(entries(page).first()).toHaveAttribute('aria-current', 'step');
});

test('元に戻すと「取り消し済み」になり、やり直しで消え、新しい操作で置き換わる', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  await extractAggregate(page, 'aggregateSales');
  await historyButton(page).click();

  // Act & Assert: 元に戻す
  await page.keyboard.press('Control+z');
  await expect(entries(page).first()).toContainText('(取り消し済み)');
  await expect(page.locator('[aria-current="step"]')).toHaveCount(0);

  // Act & Assert: やり直し
  await page.keyboard.press('Control+y');
  await expect(entries(page).first()).not.toContainText('(取り消し済み)');
  await expect(entries(page).first()).toHaveAttribute('aria-current', 'step');

  // Act & Assert: 取り消してから別の抽出をすると置き換わる
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Escape');
  await extractAggregate(page, 'summarizeSales');
  await historyButton(page).click();
  await expect(entries(page)).toHaveCount(1);
  await expect(entries(page).first()).not.toContainText('(取り消し済み)');
});

test('最初に戻すと、一覧の最後に「最初に戻す」の手が増える', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  await extractAggregate(page, 'aggregateSales');

  // Act
  await page.getByRole('button', { name: '最初に戻す' }).click();
  await historyButton(page).click();

  // Assert
  await expect(entries(page)).toHaveCount(2);
  await expect(entries(page).last()).toContainText('2. 最初に戻す');
  await expect(entries(page).last()).toContainText('100点 → 90点(-10)');
});

test('ステージを切り替えると一覧は空になる', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  await extractAggregate(page, 'aggregateSales');

  // Act
  await selectStage(page, STAGE2);
  await historyButton(page).click();

  // Assert
  await expect(entries(page)).toHaveCount(0);
  await expect(page.getByTestId('operation-history')).toContainText('まだ操作していません');
});

async function tabTo(page: Page, testId: string) {
  const focused = page.locator(`[data-testid="${testId}"]:focus`);
  for (let i = 0; i < 80 && (await focused.count()) === 0; i++) await page.keyboard.press('Tab');
  await expect(focused).toHaveCount(1);
}

test('Tab キーでボタンに移動し、Enter で開き、Esc で閉じるとボタンにフォーカスが戻る', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  await tabTo(page, 'operation-history-button');

  // Act
  await page.keyboard.press('Enter');

  // Assert
  await expect(page.getByTestId('operation-history')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('operation-history')).toBeHidden();
  await expect(historyButton(page)).toBeFocused();
});

test('ヒントやうわさを開いたあとに操作の記録を開くと前のポップオーバーが閉じ、逆も同じ', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  const hint = page.getByTestId('hint-popover-button');
  const rumor = page.getByTestId('rumor-popover-button');
  const history = page.getByTestId('operation-history');

  // Act & Assert: ヒント → 操作の記録
  await openHints(page);
  await expect(hint).toHaveAttribute('aria-expanded', 'true');
  await tabTo(page, 'operation-history-button');
  await page.keyboard.press('Enter');
  await expect(history).toBeVisible();
  await expect(hint).toHaveAttribute('aria-expanded', 'false');

  // Act & Assert: 操作の記録 → うわさ
  await openRumors(page);
  await expect(rumor).toHaveAttribute('aria-expanded', 'true');
  await expect(history).toBeHidden();

  // Act & Assert: うわさ → 操作の記録
  await historyButton(page).click();
  await expect(history).toBeVisible();
  await expect(rumor).toHaveAttribute('aria-expanded', 'false');

  // Act & Assert: 操作の記録 → ヒント
  await openHints(page);
  await expect(history).toBeHidden();
});
