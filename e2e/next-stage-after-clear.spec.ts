import { expect, test, type Page } from '@playwright/test';
import { startChangeRequests, selectStage } from './selectStage.js';

const STAGE_1 = 'チュートリアル1: 長いメソッドを分ける';
const STAGE_2 = 'チュートリアル2: 太った placeOrder';

async function clearTutorial1(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, STAGE_1);
  await page.getByTestId('method-printMonthlyReport').click();
  const checks = page.getByRole('checkbox');
  await checks.nth(0).check();
  await checks.nth(1).check();
  await page.getByLabel('新しいメソッド名').fill('summarizeSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
}

async function setStory(page: Page, on: boolean) {
  const toggle = page.getByTestId('story-toggle');
  if ((await toggle.getAttribute('aria-pressed')) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', String(on));
}

test('ストーリーオフで100点にすると、次のおすすめへ進むカードが出て、押すと次のステージが開く', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await setStory(page, false);

  // Act
  await clearTutorial1(page);

  // Assert
  const card = page.getByTestId('next-stage-card');
  await expect(card.getByRole('heading', { name: 'ステージクリア' })).toBeVisible();
  await expect(card).toContainText(`次のおすすめ: ${STAGE_2}`);
  await expect(page.getByTestId('next-stage-go')).toHaveText('次のステージへ');
  await expect(page.getByTestId('story-outro')).toHaveCount(0);

  // Act
  await page.getByTestId('next-stage-go').click();

  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STAGE_2);
  await expect(page.getByTestId('next-stage-card')).toHaveCount(0);
});

test('ストーリーがオンなら「第1章 おわり / 次の章へ」だけが出て、新しいカードは出ない', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await setStory(page, true);

  // Act
  await clearTutorial1(page);

  // Assert
  await expect(page.getByTestId('story-outro')).toContainText('第1章 おわり');
  await expect(page.getByTestId('story-next')).toHaveText('次の章へ');
  await expect(page.getByTestId('next-stage-card')).toHaveCount(0);
});

test('100点でないときは、ストーリーがオフでもカードは出ない', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await setStory(page, false);

  // Act
  await selectStage(page, STAGE_1);

  // Assert
  await expect(page.getByTestId('score-announcement')).not.toHaveText('100点');
  await expect(page.getByTestId('next-stage-card')).toHaveCount(0);
});

test('全ステージをクリア済みなら「全ステージをクリアしました」が出て、ボタンは出ない', async ({ page }) => {
  // Arrange: ロードマップに並ぶ全ステージを、自己ベスト100として保存してから開き直す
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();
  const testIds = await page.locator('[data-testid^="roadmap-stage-"]').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-testid') ?? ''));
  const cleared = Object.fromEntries(testIds.map((testId) => [testId.replace('roadmap-stage-', ''), 100]));
  expect(Object.keys(cleared).length).toBeGreaterThan(10);
  await page.evaluate((progress) => localStorage.setItem('refactor-blocks:progress', JSON.stringify(progress)), cleared);
  await page.reload();
  await setStory(page, false);

  // Act
  await clearTutorial1(page);

  // Assert
  const card = page.getByTestId('next-stage-card');
  await expect(card.getByRole('heading', { name: 'ステージクリア' })).toBeVisible();
  await expect(card).toContainText('全ステージをクリアしました');
  await expect(page.getByTestId('next-stage-go')).toHaveCount(0);
});

test('変更依頼の実装中はカードを出さない', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await setStory(page, false);
  await clearTutorial1(page);
  await expect(page.getByTestId('next-stage-card')).toBeVisible();

  // Act
  await startChangeRequests(page);

  // Assert
  await expect(page.getByTestId('change-request-start')).toBeDisabled();
  await expect(page.getByTestId('next-stage-card')).toHaveCount(0);
});
