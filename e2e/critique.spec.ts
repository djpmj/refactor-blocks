import { expect, test, type Page } from '@playwright/test';
import { dismissClearScreen, selectStage } from './selectStage.js';

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
  await expect(page.getByTestId('critique-fallback-text')).toHaveCount(0);
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
  await expect(page.locator('.critique-panel__details summary')).toHaveText('簡易講評(AI講評ではありません)');
  const fallback = page.getByTestId('critique-fallback-text');
  await expect(fallback).toContainText('※ AIの講評ではありません。採点の内訳から自動で作った簡易講評です。');
  expect((await fallback.innerText()).split('\n')[0]).toBe('※ AIの講評ではありません。採点の内訳から自動で作った簡易講評です。');
  await expect(page.getByTestId('critique-text')).toHaveCount(0);
});

test('400が返ったら、リクエスト形式の不具合を知らせる', async ({ page }) => {
  // Arrange
  await page.route(CRITIQUE_ENDPOINT, async (route) => {
    await route.fulfill({ status: 400, json: { error: 'invalid-request' } });
  });
  await page.goto('/');

  // Act
  await page.getByRole('button', { name: 'AIの講評をもらう' }).click();

  // Assert
  await expect(page.locator('.critique-panel__error')).toHaveText(
    'AI講評のリクエストの形が合いませんでした(不具合です)。時間をおいてもう一度お試しください',
  );
});

test('409が返ったら、サーバーの更新待ちを知らせる', async ({ page }) => {
  // Arrange
  await page.route(CRITIQUE_ENDPOINT, async (route) => {
    await route.fulfill({ status: 409, json: { error: 'version-mismatch', expected: 2 } });
  });
  await page.goto('/');

  // Act
  await page.getByRole('button', { name: 'AIの講評をもらう' }).click();

  // Assert
  await expect(page.locator('.critique-panel__error')).toHaveText(
    'AI講評のサーバーが、このゲームの版にまだ対応していません。サーバーの更新をお待ちください(ゲーム側の操作は不要です)',
  );
});

async function openStage1AndAskCritique(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByRole('button', { name: 'AIの講評をもらう' }).click();
}

async function extractAggregateSales(page: Page) {
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await dismissClearScreen(page);
}

test('簡易講評は、コードを変えると古いと出て、もう一度もらうと今の時点になる', async ({ page }) => {
  // Arrange
  await page.route(CRITIQUE_ENDPOINT, async (route) => {
    await route.fulfill({ status: 500, json: { error: 'critique-failed' } });
  });
  await openStage1AndAskCritique(page);
  const timing = page.getByTestId('critique-timing');
  await expect(timing).toContainText('点・0手の時点の講評です');
  await expect(page.getByRole('button', { name: 'もう一度もらう' })).toHaveCount(0);

  // Act
  await extractAggregateSales(page);

  // Assert
  await expect(timing).toContainText('この講評は古くなりました(');
  await expect(timing).toContainText('点・0手の時点)。今のコードとは違います');
  await expect(page.getByTestId('critique-fallback-text')).toBeVisible();

  // Act
  await page.getByRole('button', { name: 'もう一度もらう' }).click();

  // Assert
  await expect(timing).toHaveText('100点・1手の時点の講評です');
  await expect(page.getByRole('button', { name: 'もう一度もらう' })).toHaveCount(0);
});

test('AI講評も古いと出て、元に戻して取得時と同じコードに戻ると消える', async ({ page }) => {
  // Arrange
  await page.route(CRITIQUE_ENDPOINT, async (route) => {
    await route.fulfill({ json: { critique: 'よく分解できています。' } });
  });
  await openStage1AndAskCritique(page);
  const timing = page.getByTestId('critique-timing');
  await expect(timing).toContainText('点・0手の時点の講評です');

  // Act
  await extractAggregateSales(page);

  // Assert
  await expect(page.getByTestId('critique-text')).toHaveText('よく分解できています。');
  await expect(timing).toContainText('この講評は古くなりました(');

  // Act
  await page.getByRole('button', { name: '元に戻す' }).click();

  // Assert
  await expect(timing).toContainText('点・0手の時点の講評です');
  await expect(page.getByRole('button', { name: 'もう一度もらう' })).toHaveCount(0);
});
