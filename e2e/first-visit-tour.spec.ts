import { expect, test } from '@playwright/test';
import { completeOpeningFix, releaseAllManualFixSites, selectStage } from './selectStage.js';

async function clearTourSeenOnce(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('first-visit-tour-test-reset') !== 'done') {
      localStorage.removeItem('refactor-blocks:tour-seen');
      sessionStorage.setItem('first-visit-tour-test-reset', 'done');
    }
  });
}

test('first visit guides a player through Extract Method using the actual actions', async ({ page }) => {
  // Arrange
  await clearTourSeenOnce(page);
  await page.goto('/');

  // Act / Assert
  const tour = page.getByTestId('first-visit-tour');
  await expect(tour).toBeVisible();
  await expect(tour).toContainText('1/6');
  await expect(page.locator('#stage-sidebar')).toBeVisible();
  await expect(page.locator('.spotlight-tour__shade')).toHaveCount(4);
  await expect(page.locator('.spotlight-tour__hole')).toBeVisible();
  await tour.getByRole('button', { name: '次へ' }).click();
  await expect(tour).toContainText('2/6');
  await page.locator('[data-tour="manual-fix-start"]').click();
  await expect(tour).toContainText('3/6');
  const markedMethod = page.getByTestId('method-printMonthlyReport');
  await markedMethod.click();
  await expect(markedMethod).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '\u30ea\u30ea\u30fc\u30b9\u3059\u308b' }).click();
  await expect(page.locator('.manual-fix [role=\"status\"]')).toContainText('\u76f4\u3057\u5fd8\u308c');
  await expect(page.getByRole('button', { name: '\u7d44\u307f\u66ff\u3048\u3092\u59cb\u3081\u308b' })).toBeVisible();
  await page.getByRole('button', { name: '\u7d44\u307f\u66ff\u3048\u3092\u59cb\u3081\u308b' }).click();
  await expect(tour).toContainText('4/6');

  await page.getByTestId('method-printMonthlyReport').click();
  await expect(tour).toContainText('5/6');
  const fragments = page.locator('[data-tour="fragment-list"]');
  await expect(fragments).toBeVisible();
  await fragments.getByLabel('今月の売上を集計する').check();
  await fragments.getByLabel('前月比を計算する').check();
  await expect(tour).toContainText('5/6');
  await page.locator('[data-tour="extract-button"]').click();
  await expect(tour).toContainText('6/6');
  await expect(tour).not.toContainText('50行');
  await tour.getByRole('button', { name: '次へ' }).click();
  await expect(tour).toHaveCount(0);
});

test('step 2 spotlights the start button inside the viewport and pressing it advances', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1280, height: 700 });
  await clearTourSeenOnce(page);
  await page.goto('/');
  const tour = page.getByTestId('first-visit-tour');
  await tour.getByRole('button', { name: '次へ' }).click();
  await expect(tour).toContainText('2/6');

  // Assert: the start button is inside the viewport and the spotlight hole covers it.
  const start = page.locator('[data-tour="manual-fix-start"]').first();
  await expect(start).toBeInViewport();
  await expect.poll(async () => {
    const button = await start.boundingBox();
    const hole = await page.locator('.spotlight-tour__hole').boundingBox();
    if (button === null || hole === null) return false;
    const tolerance = 1; // 画面端にぴったりのときの端数の誤差
    return hole.x <= button.x && hole.y <= button.y
      && hole.x + hole.width + tolerance >= button.x + button.width && hole.y + hole.height + tolerance >= button.y + button.height;
  }).toBe(true);

  // Act
  await start.click();

  // Assert
  await expect(tour).toContainText('3/6');
  const method = page.getByTestId('method-printMonthlyReport');
  await method.click();
  await page.getByRole('button', { name: 'リリースする' }).click();
  await expect(page.locator('.manual-fix [role="status"]')).toContainText('直し忘れ');
  await page.getByRole('button', { name: '組み替えを始める' }).click();
  await expect(tour).toContainText('4/6');
});

test('shade blocks clicks outside the spotlight while the tour can be exited with Escape', async ({ page }) => {
  // Arrange
  await clearTourSeenOnce(page);
  await page.goto('/');
  const tour = page.getByTestId('first-visit-tour');
  await expect(tour).toBeVisible();

  // Act
  const operationGuide = page.getByTestId('operation-guide-open');
  const buttonBox = await operationGuide.boundingBox();
  if (buttonBox === null) throw new Error('Operation guide button should have a visible bounding box');
  await page.mouse.click(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);

  // Assert
  await expect(tour).toContainText('1/6');
  await expect(page.getByTestId('operation-guide')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('refactor-blocks:tour-seen'))).toBe('true');
});

test('Escape and the exit button work from interactive steps 2 through 5', async ({ page }) => {
  // Arrange
  await clearTourSeenOnce(page);
  await page.goto('/');

  // Act / Assert: step 2
  let tour = page.getByTestId('first-visit-tour');
  await tour.getByRole('button', { name: '次へ' }).click();
  await expect(tour).toContainText('2/6');
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);

  // Act / Assert: finish the opening fix before replaying the interactive tour.
  await completeOpeningFix(page);

  // Act / Assert: step 3
  await page.getByTestId('operation-guide-open').click();
  await page.getByTestId('repeat-first-visit-tour').click();
  tour = page.getByTestId('first-visit-tour');
  await tour.getByRole('button', { name: '次へ' }).click();
  await page.locator('[data-tour="manual-fix-start"]').click();
  await releaseAllManualFixSites(page);
  await expect(tour).toContainText('4/6');
  await page.getByTestId('method-printMonthlyReport').click();
  await expect(tour).toContainText('5/6');
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);

  // Act / Assert: step 4
  await page.getByTestId('operation-guide-open').click();
  await page.getByTestId('repeat-first-visit-tour').click();
  tour = page.getByTestId('first-visit-tour');
  await tour.getByRole('button', { name: '次へ' }).click();
  await page.locator('[data-tour="manual-fix-start"]').click();
  await releaseAllManualFixSites(page);
  await expect(tour).toContainText('4/6');
  await page.getByTestId('method-printMonthlyReport').click();
  await expect(tour).toContainText('5/6');
  await page.locator('[data-tour="fragment-list"] input[type="checkbox"]').first().check();
  await expect(tour).toContainText('5/6');
  await tour.getByRole('button', { name: 'ガイドを終了' }).click();
  await expect(tour).toHaveCount(0);
});

test('closing the tour persists the seen marker across reloads', async ({ page }) => {
  // Arrange
  await clearTourSeenOnce(page);
  await page.goto('/');
  const tour = page.getByTestId('first-visit-tour');
  await expect(tour).toBeVisible();

  // Act
  await tour.getByRole('button', { name: 'ガイドを終了' }).click();
  await page.reload();

  // Assert
  await expect(page.getByTestId('first-visit-tour')).toHaveCount(0);
});

test('does not auto-start elsewhere and can be replayed from the operation guide', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');

  // Act
  await expect(page.getByTestId('first-visit-tour')).toHaveCount(0);
  await page.getByTestId('operation-guide-open').click();
  await page.getByTestId('repeat-first-visit-tour').click();

  // Assert
  await expect(page.getByTestId('first-visit-tour')).toContainText('1/6');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('チュートリアル1');
});

test('after the tour extraction, re-fixing "前年同月比も出して" has one site and nothing is missed', async ({ page }) => {
  // Arrange: play the tour all the way through the extraction with both A fragments.
  await clearTourSeenOnce(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const tour = page.getByTestId('first-visit-tour');
  await tour.getByRole('button', { name: '次へ' }).click();
  await page.locator('[data-tour="manual-fix-start"]').click();
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByRole('button', { name: 'リリースする' }).click();
  await page.getByRole('button', { name: '組み替えを始める' }).click();
  await page.getByTestId('method-printMonthlyReport').click();
  const fragments = page.locator('[data-tour="fragment-list"]');
  await fragments.getByLabel('今月の売上を集計する').check();
  await fragments.getByLabel('前月比を計算する').check();
  await page.locator('[data-tour="extract-button"]').click();
  await expect(tour).toContainText('6/6');
  await tour.getByRole('button', { name: '次へ' }).click();
  await expect(page.getByTestId('score-value')).toContainText('100');

  // Act: the post-100 re-fix, marking only what the change list points at.
  const card = page.locator('.change-pain');
  await card.locator('details').evaluate((element) => element.setAttribute('open', ''));
  await card.getByRole('button', { name: '実際に直してみる' }).click();
  await page.getByTestId('method-aggregateSales').click();
  await page.getByRole('button', { name: 'リリースする' }).click();

  // Assert
  await expect(page.locator('.manual-fix [role="status"]')).toContainText('直し忘れなし');
  await expect(page.locator('.manual-fix [role="status"]')).toContainText('1 か所すべて');
});
