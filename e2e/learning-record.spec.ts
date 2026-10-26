import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const PROGRESS_KEY = 'refactor-blocks:progress';
const MILESTONES_KEY = 'refactor-blocks:milestones';
const STAGE_CARD = 'roadmap-stage-tutorial-extract-method';

function learningRecordFile(progress: Record<string, number>, overrides: Record<string, unknown> = {}) {
  const body = { app: 'refactor-blocks', version: 1, progress, drafts: {}, lastStageId: null, storyEnabled: true, tourSeen: true, ...overrides };
  return { name: 'record.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(body)) };
}

/** このブラウザの点数(と、100点が「クリア」になるための終えた段階)を localStorage に入れて読み込み直し、ステージ一覧を開く。 */
async function openRoadmapWithProgress(page: Page, progress: Record<string, number>) {
  await page.goto('/');
  const milestones = { 'tutorial-extract-method': ['concept-check', 'change-request'] };
  await page.evaluate(([key, value, milestonesKey, milestonesValue]) => {
    localStorage.setItem(key, value);
    localStorage.setItem(milestonesKey, milestonesValue);
  }, [PROGRESS_KEY, JSON.stringify(progress), MILESTONES_KEY, JSON.stringify(milestones)]);
  await page.reload();
  await page.getByTestId('roadmap-open').click();
}

test('学習記録を書き出すと、名前と中身の決まったJSONがダウンロードされる', async ({ page }) => {
  // Arrange
  await openRoadmapWithProgress(page, { 'tutorial-extract-method': 100 });
  const downloadPromise = page.waitForEvent('download');

  // Act
  await page.getByTestId('learning-record-export').click();
  const download = await downloadPromise;

  // Assert
  expect(download.suggestedFilename()).toMatch(/^refactor-blocks-learning-record-\d{4}-\d{2}-\d{2}\.json$/);
  const text = await readFile(await download.path(), 'utf-8');
  expect(JSON.parse(text)).toMatchObject({ app: 'refactor-blocks', version: 1, progress: { 'tutorial-extract-method': 100 } });
});

test('マージで読み込むと、点数の高いファイルの値(クリア)になる', async ({ page }) => {
  // Arrange
  await openRoadmapWithProgress(page, { 'tutorial-extract-method': 40 });

  // Act
  await page.getByTestId('learning-record-file').setInputFiles(learningRecordFile({ 'tutorial-extract-method': 100 }));
  await expect(page.getByTestId('learning-record-mode-merge')).toBeChecked();
  await expect(page.getByTestId('learning-record-mode-merge')).toBeFocused();
  await page.getByTestId('learning-record-apply').click();
  await page.getByTestId('roadmap-open').click();

  // Assert
  await expect(page.getByTestId(STAGE_CARD)).toContainText('クリア');
});

test('マージでは、このブラウザの点数のほうが高ければ残る', async ({ page }) => {
  // Arrange
  await openRoadmapWithProgress(page, { 'tutorial-extract-method': 100 });

  // Act
  await page.getByTestId('learning-record-file').setInputFiles(learningRecordFile({ 'tutorial-extract-method': 40 }));
  await page.getByTestId('learning-record-apply').click();
  await page.getByTestId('roadmap-open').click();

  // Assert
  await expect(page.getByTestId(STAGE_CARD)).toContainText('クリア');
});

test('上書きで読み込むと、ファイルの点数に置き換わる。注意書きは上書きを選んだときだけ出る', async ({ page }) => {
  // Arrange
  await openRoadmapWithProgress(page, { 'tutorial-extract-method': 100 });
  await page.getByTestId('learning-record-file').setInputFiles(learningRecordFile({ 'tutorial-extract-method': 40 }));
  await expect(page.getByTestId('learning-record-confirm')).not.toContainText('今の記録は消えます');

  // Act
  await page.getByTestId('learning-record-mode-overwrite').check();
  await expect(page.getByTestId('learning-record-confirm')).toContainText('このブラウザの今の記録は消えます');
  await page.getByTestId('learning-record-apply').click();
  await page.getByTestId('roadmap-open').click();

  // Assert
  await expect(page.getByTestId(STAGE_CARD)).toContainText('40点');
});

test('不正なファイル(version 2)は理由を出し、localStorage を変えない', async ({ page }) => {
  // Arrange
  await openRoadmapWithProgress(page, { 'tutorial-extract-method': 40 });

  // Act
  await page.getByTestId('learning-record-file').setInputFiles(learningRecordFile({}, { version: 2 }));

  // Assert
  await expect(page.getByTestId('learning-record-error')).toContainText('新しいバージョンのゲームで書き出されたファイルです');
  await expect(page.getByTestId('learning-record-confirm')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY)).toBe('{"tutorial-extract-method":40}');
});

test('「やめる」で閉じると、何も保存せず、フォーカスが読み込みボタンへ戻る', async ({ page }) => {
  // Arrange
  await openRoadmapWithProgress(page, { 'tutorial-extract-method': 40 });
  await page.getByTestId('learning-record-file').setInputFiles(learningRecordFile({ 'tutorial-extract-method': 100 }));

  // Act
  await page.getByTestId('learning-record-cancel').click();

  // Assert
  await expect(page.getByTestId('learning-record-confirm')).toHaveCount(0);
  await expect(page.getByTestId('learning-record-import')).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY)).toBe('{"tutorial-extract-method":40}');
});
