import { expect, test, type Page } from '@playwright/test';
import { openHints } from './hintPopover.js';
import { openReferenceItem } from './referenceMenuActions.js';
import { completeOpeningFix, dismissClearScreen, selectStage } from './selectStage.js';

const STAGE_1 = 'チュートリアル1: 長いメソッドを分ける';
const ID_1 = 'tutorial-extract-method';

/** 一覧の「✅ クリア」は100点のあとの段階(理解度チェック・変更依頼)も終えているときに出るので、その記録を先に入れておく。 */
async function seedMilestones(page: Page) {
  await page.addInitScript((id) => {
    localStorage.setItem('refactor-blocks:milestones', JSON.stringify({ [id]: ['concept-check', 'change-request'] }));
  }, ID_1);
}

async function open(page: Page) {
  await seedMilestones(page);
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, STAGE_1);
}

async function extractTo100(page: Page) {
  await page.getByTestId('method-printMonthlyReport').click();
  const checks = page.getByRole('checkbox');
  await checks.nth(0).check();
  await checks.nth(1).check();
  await page.getByLabel('新しいメソッド名').fill('summarizeSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await dismissClearScreen(page);
}

async function openRoadmap(page: Page) {
  await page.getByTestId('roadmap-open').click();
  await expect(page.getByTestId('stage-roadmap')).toBeVisible();
}

async function closeRoadmap(page: Page) {
  await page.getByTestId('stage-roadmap').getByRole('button', { name: '閉じる' }).click();
  await expect(page.getByTestId('stage-roadmap')).toHaveCount(0);
}

async function expectMarked(page: Page, label: string) {
  await openRoadmap(page);
  await expect(page.getByTestId(`roadmap-stage-${ID_1}`)).toContainText('✅ クリア');
  await expect(page.getByTestId(`roadmap-retry-${ID_1}`)).toHaveText(label);
  await expect(page.getByTestId('roadmap-review')).toHaveText(`復習のおすすめ: ${STAGE_1}(もう一度自力で)`);
  await expect(page.getByTestId('roadmap-next')).toContainText('チュートリアル2: 太った placeOrder');
}

async function expectNoMark(page: Page) {
  await openRoadmap(page);
  await expect(page.getByTestId(`roadmap-stage-${ID_1}`)).toContainText('✅ クリア');
  await expect(page.getByTestId(`roadmap-retry-${ID_1}`)).toHaveCount(0);
  await expect(page.getByTestId('roadmap-review')).toHaveCount(0);
}

async function answerThenClear(page: Page) {
  await open(page);
  await openReferenceItem(page, 'reference-replay');
  await page.getByTestId('sample-replay').getByRole('button', { name: '閉じる' }).click();
  await expect(page.getByTestId('sample-replay')).toHaveCount(0);
  await extractTo100(page);
}

test('解答を再生してから100点にすると印と復習のおすすめが出て、再読み込みしても残る', async ({ page }) => {
  // Arrange・Act
  await answerThenClear(page);

  // Assert
  await expectMarked(page, 'もう一度自力で(答えを見てクリア)');

  // Act
  await page.reload();

  // Assert
  await expectMarked(page, 'もう一度自力で(答えを見てクリア)');
});

test('「どこが問題?」だけ開いて100点にしても印は付かない', async ({ page }) => {
  // Arrange
  await open(page);
  await openHints(page);
  await page.getByTestId('hint-problem').click();
  await page.keyboard.press('Escape');

  // Act
  await extractTo100(page);

  // Assert
  await expectNoMark(page);
});

test('「次の一手」を1つ開いてから100点にすると印が付く', async ({ page }) => {
  // Arrange
  await open(page);
  await openHints(page);
  await page.getByTestId('hint-problem').click();
  await page.getByRole('button', { name: /^次の一手/ }).click();
  await page.keyboard.press('Escape');

  // Act
  await extractTo100(page);

  // Assert
  await expectMarked(page, 'もう一度自力で(次の一手を見てクリア)');
});

test('「最初に戻す」から助けなしで100点にすると、印と復習のおすすめが消える', async ({ page }) => {
  // Arrange
  await answerThenClear(page);
  await expectMarked(page, 'もう一度自力で(答えを見てクリア)');
  await closeRoadmap(page);

  // Act
  await page.getByRole('button', { name: '最初に戻す' }).click();
  await extractTo100(page);

  // Assert
  await expectNoMark(page);
});

test('助けなしで100点にしたあと解答例の図を見て再読み込みしても、印は付かない', async ({ page }) => {
  // Arrange
  await open(page);
  await extractTo100(page);

  // Act
  await openReferenceItem(page, 'reference-sample');
  await page.reload();

  // Assert
  await expectNoMark(page);
});

test('解答例の図を見たあと100点にする前に再読み込みして、続きから100点にしても印が付く', async ({ page }) => {
  // Arrange
  await open(page);
  await openReferenceItem(page, 'reference-sample');
  await page.reload();
  await completeOpeningFix(page);

  // Act
  await extractTo100(page);

  // Assert
  await expectMarked(page, 'もう一度自力で(答えを見てクリア)');
});

test('答えの確認でやめるを選んでから100点にしても、印は付かない', async ({ page }) => {
  // Arrange
  await open(page);
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();

  // Act
  await page.getByTestId('answer-confirm').getByRole('button', { name: 'やめる' }).click();
  await page.reload();
  await completeOpeningFix(page);
  await extractTo100(page);

  // Assert
  await expectNoMark(page);
});

test('記録の無い古いデータの100点には、印も復習のおすすめも出ない', async ({ page }) => {
  // Arrange
  await page.addInitScript((id) => {
    localStorage.setItem('refactor-blocks:progress', JSON.stringify({ [id]: 100 }));
    localStorage.setItem('refactor-blocks:milestones', JSON.stringify({ [id]: ['concept-check', 'change-request'] }));
  }, ID_1);
  await page.goto('/');

  // Act
  await openRoadmap(page);

  // Assert
  await expect(page.getByTestId(`roadmap-stage-${ID_1}`)).toContainText('✅ クリア');
  await expect(page.getByTestId(`roadmap-retry-${ID_1}`)).toHaveCount(0);
  await expect(page.getByTestId('roadmap-review')).toHaveCount(0);
});

test('助けの記録が壊れていても画面は開き、印は出ない', async ({ page }) => {
  // Arrange
  await page.addInitScript((id) => {
    localStorage.setItem('refactor-blocks:progress', JSON.stringify({ [id]: 100 }));
    localStorage.setItem('refactor-blocks:milestones', JSON.stringify({ [id]: ['concept-check', 'change-request'] }));
    localStorage.setItem('refactor-blocks:assists', '{');
  }, ID_1);
  await page.goto('/');

  // Act
  await openRoadmap(page);

  // Assert
  await expect(page.getByTestId(`roadmap-stage-${ID_1}`)).toContainText('✅ クリア');
  await expect(page.locator('[data-testid^="roadmap-retry-"]')).toHaveCount(0);
  await expect(page.getByTestId('roadmap-review')).toHaveCount(0);
});
