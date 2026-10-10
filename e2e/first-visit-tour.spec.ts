import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

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
  await expect(tour).toContainText('1/5');
  await expect(page.locator('#stage-sidebar')).toBeVisible();
  await expect(page.locator('.spotlight-tour__shade')).toHaveCount(4);
  await expect(page.locator('.spotlight-tour__hole')).toBeVisible();
  await tour.getByRole('button', { name: '次へ' }).click();
  await expect(tour).toContainText('2/5');

  await page.getByTestId('method-printMonthlyReport').click();
  await expect(tour).toContainText('3/5');
  const fragments = page.locator('[data-tour="fragment-list"]');
  await expect(fragments).toBeVisible();
  await fragments.locator('input[type="checkbox"]').first().check();
  await expect(tour).toContainText('4/5');
  await page.locator('[data-tour="extract-button"]').click();
  await expect(tour).toContainText('5/5');
  await tour.getByRole('button', { name: '次へ' }).click();
  await expect(tour).toHaveCount(0);
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
  await expect(tour).toContainText('1/5');
  await expect(page.getByTestId('operation-guide')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('refactor-blocks:tour-seen'))).toBe('true');
});

test('Escape and the exit button work from interactive steps 2 through 4', async ({ page }) => {
  // Arrange
  await clearTourSeenOnce(page);
  await page.goto('/');

  // Act / Assert: step 2
  let tour = page.getByTestId('first-visit-tour');
  await tour.getByRole('button', { name: '次へ' }).click();
  await expect(tour).toContainText('2/5');
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);

  // Act / Assert: step 3
  await page.getByTestId('operation-guide-open').click();
  await page.getByTestId('repeat-first-visit-tour').click();
  tour = page.getByTestId('first-visit-tour');
  await tour.getByRole('button', { name: '次へ' }).click();
  await page.getByTestId('method-printMonthlyReport').click();
  await expect(tour).toContainText('3/5');
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);

  // Act / Assert: step 4
  await page.getByTestId('operation-guide-open').click();
  await page.getByTestId('repeat-first-visit-tour').click();
  tour = page.getByTestId('first-visit-tour');
  await tour.getByRole('button', { name: '次へ' }).click();
  await page.getByTestId('method-printMonthlyReport').click();
  await page.locator('[data-tour="fragment-list"] input[type="checkbox"]').first().check();
  await expect(tour).toContainText('4/5');
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
  await expect(page.getByTestId('first-visit-tour')).toContainText('1/5');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('チュートリアル1');
});
