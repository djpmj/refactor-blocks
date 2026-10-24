import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE = '初級1: 何でも屋の UserController';

async function savedProgress(page: Page): Promise<Record<string, number>> {
  const raw = await page.evaluate(() => localStorage.getItem('refactor-blocks:progress'));
  return raw === null ? {} : JSON.parse(raw);
}

/** registerUser を UserRepository へ移す(点数が上がる)。 */
async function moveOnce(page: Page) {
  const from = await page.getByTestId('method-registerUser').boundingBox();
  const to = await page.getByTestId('class-UserRepository').boundingBox();
  if (from === null || to === null) throw new Error('位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await expect(page.getByTestId('class-UserRepository')).toHaveClass(/class-node--drop-target/);
  await page.mouse.up();
  await expect(page.getByTestId('class-UserRepository').getByTestId('method-registerUser')).toBeVisible();
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
  await page.getByTestId('method-registerUser').click();

  // Assert
  expect(await savedProgress(page)).toEqual({});
  expect(await stageCardText(page)).toContain('未挑戦');
});

test('メソッドの移動などで点数が上がると一覧に点数が出て、再読み込みしても残る。元に戻しても自己ベストは下がらない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE);

  // Act
  await moveOnce(page);

  // Assert
  await expect.poll(async () => Object.values(await savedProgress(page)).length).toBe(1);
  const best = Object.values(await savedProgress(page))[0];
  expect(await stageCardText(page)).toContain(`${String(best)}点`);

  // Act: 元に戻して初期点に戻っても
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByTestId('class-UserController').getByTestId('method-registerUser')).toBeVisible();

  // Assert
  expect(Object.values(await savedProgress(page))).toEqual([best]);

  // Act
  await page.reload();
  await expect(page.getByTestId('roadmap-open')).toBeEnabled();

  // Assert
  expect(Object.values(await savedProgress(page))).toEqual([best]);
});
