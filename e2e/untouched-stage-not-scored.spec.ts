import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE = 'チュートリアル1: 長いメソッドを分ける';

async function savedProgress(page: Page): Promise<Record<string, number>> {
  const raw = await page.evaluate(() => localStorage.getItem('refactor-blocks:progress'));
  return raw === null ? {} : JSON.parse(raw);
}

/** printMonthlyReport から集計と前月比を抽出する(行数超過が解消して点数が上がる)。 */
async function extractOnce(page: Page) {
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('method-aggregateSales')).toBeVisible();
}

async function stageCardText(page: Page): Promise<string> {
  await page.getByTestId('roadmap-open').click();
  const dialog = page.getByTestId('stage-roadmap');
  await expect(dialog).toBeVisible();
  const text = await dialog.locator('[data-testid^="roadmap-stage-"]').filter({ has: page.getByText(STAGE, { exact: true }) }).innerText();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  return text;
}

test('開いてメソッドをクリックしただけでは記録されず、一覧は未挑戦のまま', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE);

  // Act
  await page.getByTestId('method-printMonthlyReport').click();

  // Assert
  expect(await savedProgress(page)).toEqual({});
  expect(await stageCardText(page)).toContain('未挑戦');
});

test('処理を抽出して点数が上がると一覧にクリアが出て、再読み込みしても残る。元に戻しても自己ベストは下がらない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE);
  expect(await savedProgress(page)).toEqual({});

  // Act
  await extractOnce(page);

  // Assert: 初期点を超えた点数が保存される
  await expect.poll(async () => Object.values(await savedProgress(page)).length).toBe(1);
  const best = Object.values(await savedProgress(page))[0];
  expect(best).toBe(100);
  // 100点のステージは一覧では「クリア」と表示される
  expect(await stageCardText(page)).toContain('クリア');

  // Act: 元に戻して初期点に戻っても
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByTestId('method-aggregateSales')).toHaveCount(0);

  // Assert
  expect(Object.values(await savedProgress(page))).toEqual([best]);

  // Act
  await page.reload();
  await expect(page.getByTestId('roadmap-open')).toBeEnabled();

  // Assert
  expect(Object.values(await savedProgress(page))).toEqual([best]);
});
