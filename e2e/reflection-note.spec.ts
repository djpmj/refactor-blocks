import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { dismissClearScreen, selectStage } from './selectStage.js';

const STAGE_ID = 'tutorial-extract-method';
const STAGE_NAME = 'チュートリアル1: 長いメソッドを分ける';
const STORAGE_KEY = 'refactor-blocks:reflection-notes';

async function clearTutorial(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, STAGE_NAME);
  await expect(page.getByTestId('reflection-note')).toHaveCount(0);
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await dismissClearScreen(page);
}

test('100点後に入力・自動保存・一覧での表示と削除ができる', async ({ page }) => {
  await clearTutorial(page);
  const input = page.getByLabel('今回気づいたこと(任意・140字まで)');
  await expect(input).toBeVisible();
  await expect(page.getByTestId('reflection-note-count')).toHaveText('0 / 140');
  await input.fill(' 分けると変更しやすい ');
  await expect(page.getByTestId('reflection-note-count')).toHaveText('12 / 140');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(JSON.stringify({ [STAGE_ID]: '分けると変更しやすい' }));
  await input.fill('x'.repeat(141));
  await expect(input).toHaveValue('x'.repeat(140));
  await expect(page.getByTestId('reflection-note-count')).toHaveText('140 / 140');
  await input.fill('分けると変更しやすい');
  await page.getByTestId('roadmap-open').click();
  await expect(page.getByTestId(`roadmap-note-${STAGE_ID}`)).toHaveText('メモ: 分けると変更しやすい');
  await expect(page.getByTestId('roadmap-note-tutorial-move-method')).toHaveCount(0);
  await page.getByTestId('stage-roadmap').getByRole('button', { name: '閉じる', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('reflection-note-input')).toHaveValue('分けると変更しやすい');
  await page.getByTestId('reflection-note-input').fill(' ');
  await page.reload();
  await expect(page.getByTestId('reflection-note-input')).toHaveValue('');
});

test('書き出しと読み込みにメモが含まれ、古いファイルも読める', async ({ page }) => {
  await clearTutorial(page);
  await page.getByTestId('reflection-note-input').fill('責務が明確になった');
  await page.getByTestId('roadmap-open').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('learning-record-export').click();
  const download = await downloadPromise;
  const content = await readFile(await download.path(), 'utf8');
  expect(JSON.parse(content)).toMatchObject({ reflectionNotes: { [STAGE_ID]: '責務が明確になった' } });
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.getByTestId('learning-record-file').setInputFiles({ name: 'record.json', mimeType: 'application/json', buffer: Buffer.from(content) });
  await expect(page.getByTestId('learning-record-confirm')).toContainText('振り返りメモ 1 件');
  await page.getByTestId('learning-record-apply').click();
  await page.getByTestId('roadmap-open').click();
  await expect(page.getByTestId(`roadmap-note-${STAGE_ID}`)).toContainText('責務が明確になった');
  const oldRecord = JSON.parse(content);
  delete oldRecord.reflectionNotes;
  await page.getByTestId('learning-record-file').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldRecord)) });
  await expect(page.getByTestId('learning-record-confirm')).toContainText('振り返りメモ 0 件');
});
