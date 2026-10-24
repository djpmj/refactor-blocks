import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

const FIRST_STAGE = 'チュートリアル1: 長いメソッドを分ける';

test('tab title follows the current mode and stage', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await expect(page).toHaveTitle(`${FIRST_STAGE} - Refactor Blocks`);

  // Act / Assert: stage switch
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await expect(page).toHaveTitle('チュートリアル2: 太った placeOrder - Refactor Blocks');

  // Act / Assert: mode switch and back
  await page.getByTestId('mode-quiz').click();
  await expect(page).toHaveTitle('設計くらべ - Refactor Blocks');
  await page.getByTestId('mode-blank').click();
  await expect(page).toHaveTitle('白紙設計 - Refactor Blocks');
  await page.getByTestId('mode-refactor').click();
  await expect(page).toHaveTitle('チュートリアル2: 太った placeOrder - Refactor Blocks');
});
