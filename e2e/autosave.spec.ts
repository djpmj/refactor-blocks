import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE_1 = 'チュートリアル1: 長いメソッドを分ける';
const STAGE_2 = 'チュートリアル2: 太った placeOrder';

async function dragMethodToEmptyCanvas(page: Page, methodId: string) {
  const source = await page.getByTestId(methodId).boundingBox();
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (source === null || pane === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();
}

/** メソッドを空きスペースへ落として新しいクラスに切り出す(コードが1手変わる)。 */
async function makeOneChange(page: Page) {
  const before = await page.locator('.class-node').count();
  await dragMethodToEmptyCanvas(page, 'method-printMonthlyReport');
  await expect(page.locator('.class-node')).toHaveCount(before + 1);
  return before + 1;
}

test('作業したあとリロードすると続きから再開し、お知らせが出る。操作すると消える', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE_1);
  await expect(page.getByTestId('draft-restored')).toHaveCount(0);
  const changed = await makeOneChange(page);

  // Act
  await page.reload();
  await selectStage(page, STAGE_1);

  // Assert
  await expect(page.locator('.class-node')).toHaveCount(changed);
  await expect(page.getByTestId('draft-restored')).toBeVisible();

  // Act: 操作をする
  await page.getByRole('button', { name: '元に戻す' }).or(page.getByRole('button', { name: '最初に戻す' })).last().click();

  // Assert
  await expect(page.getByTestId('draft-restored')).toHaveCount(0);
});

test('ステージを切り替えて戻っても作業が残る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE_1);
  const changed = await makeOneChange(page);

  // Act
  await selectStage(page, STAGE_2);
  await expect(page.getByTestId('draft-restored')).toHaveCount(0);
  await selectStage(page, STAGE_1);

  // Assert
  await expect(page.locator('.class-node')).toHaveCount(changed);
  await expect(page.getByTestId('draft-restored')).toBeVisible();
});

test('最初に戻してからリロードすると初期状態で始まる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE_1);
  const initial = await page.locator('.class-node').count();
  await makeOneChange(page);
  await page.locator('.stage-panel__reset').click();
  await expect(page.locator('.class-node')).toHaveCount(initial);

  // Act
  await page.reload();
  await selectStage(page, STAGE_1);

  // Assert
  await expect(page.locator('.class-node')).toHaveCount(initial);
  await expect(page.getByTestId('draft-restored')).toHaveCount(0);
});

for (const broken of ['not json{', '{"x":{"fingerprint":1,"codebase":{}}}', '[]']) {
  test(`壊れた保存データ(${broken})でも初期状態で起動できる`, async ({ page }) => {
    // Arrange
    await page.addInitScript((value) => {
      localStorage.setItem('refactor-blocks:drafts', value);
    }, broken);

    // Act
    await page.goto('/');

    // Assert
    await expect(page.getByTestId('roadmap-open')).toBeVisible();
    await expect(page.getByTestId('draft-restored')).toHaveCount(0);
  });
}

test('指紋が違う下書きは使われない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE_1);
  await makeOneChange(page);
  await page.evaluate(() => {
    const drafts: Record<string, { fingerprint: string }> = JSON.parse(localStorage.getItem('refactor-blocks:drafts') ?? '{}');
    for (const draft of Object.values(drafts)) draft.fingerprint = 'stale';
    localStorage.setItem('refactor-blocks:drafts', JSON.stringify(drafts));
  });
  const initial = (await page.locator('.class-node').count()) - 1;

  // Act
  await page.reload();
  await selectStage(page, STAGE_2);
  await selectStage(page, STAGE_1);

  // Assert
  await expect(page.locator('.class-node')).toHaveCount(initial);
  await expect(page.getByTestId('draft-restored')).toHaveCount(0);
});
