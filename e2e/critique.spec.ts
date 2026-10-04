import { expect, test } from '@playwright/test';

/** AI講評の呼び出し先(.env.test の VITE_CRITIQUE_ENDPOINT)。実際のClaude APIは呼ばず、ここでモックする。 */
const CRITIQUE_ENDPOINT = '**/__critique-test__';

test('AIの講評をもらうと、講評文が表示される', async ({ page }) => {
  // Arrange
  await page.route(CRITIQUE_ENDPOINT, async (route) => {
    await route.fulfill({ json: { critique: 'よく分解できています。' } });
  });
  await page.goto('/');

  // Act
  await page.getByRole('button', { name: 'AIの講評をもらう' }).click();

  // Assert
  await expect(page.getByTestId('critique-text')).toHaveText('よく分解できています。');
});

test('取得中は「AIが講評中…」を表示する', async ({ page }) => {
  // Arrange
  await page.route(CRITIQUE_ENDPOINT, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ json: { critique: '講評文' } });
  });
  await page.goto('/');

  // Act
  await page.getByRole('button', { name: 'AIの講評をもらう' }).click();

  // Assert
  await expect(page.getByRole('button', { name: 'AIが講評中…' })).toBeVisible();
  await expect(page.getByTestId('critique-text')).toHaveText('講評文');
});

test('講評の取得に失敗したら、エラーメッセージを表示する', async ({ page }) => {
  // Arrange
  await page.route(CRITIQUE_ENDPOINT, async (route) => {
    await route.fulfill({ status: 500, json: { error: 'critique-failed' } });
  });
  await page.goto('/');

  // Act
  await page.getByRole('button', { name: 'AIの講評をもらう' }).click();

  // Assert
  const error = page.locator('.critique-panel__error');
  await expect(error).toHaveText('AI講評を取得できませんでした。しばらくしてからもう一度お試しください');
  await expect(error).toHaveAttribute('role', 'status');
});
