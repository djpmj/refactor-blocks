import { expect, test, type Page } from '@playwright/test';
import { finishAndAdvance, releaseAllManualFixSites, selectStage, startChangeRequests } from './selectStage.js';

const STAGE_1 = 'チュートリアル1: 長いメソッドを分ける';
const STAGE_1_ID = 'tutorial-extract-method';
const STAGE_2 = 'チュートリアル2: 太った placeOrder';
const REMAINING_ALL = '100点(あと: 理解度チェック・変更依頼)';
const REMAINING_CHANGE = '100点(あと: 変更依頼)';

async function dragMethodToClass(page: Page, methodId: string, classId: string) {
  const source = await page.getByTestId(methodId).boundingBox();
  const target = await page.getByTestId(classId).boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await expect(page.getByTestId(classId)).toHaveClass(/class-node--drop-target/);
  await page.mouse.up();
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
}

async function clearTutorial1(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, STAGE_1);
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
}

/** ステージ一覧を開いて、チュートリアル1の状態と「次のおすすめ」を読み、閉じる。 */
async function readRoadmap(page: Page) {
  await page.getByTestId('roadmap-open').click();
  const dialog = page.getByTestId('stage-roadmap');
  await expect(dialog).toBeVisible();
  const status = (await dialog.getByTestId(`roadmap-stage-${STAGE_1_ID}`).locator('.stage-roadmap__status').innerText()).trim();
  const next = (await dialog.getByTestId('roadmap-next').innerText()).trim();
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(dialog).toHaveCount(0);
  return { status, next };
}

/** 理解度チェックの2問に答える(正解は 2問とも「正解の選択肢」)。wrongFirst なら1問目をわざと間違える。 */
async function answerChecks(page: Page, wrongFirst: boolean) {
  const panel = page.getByRole('region', { name: '理解度チェック' });
  const groups = panel.getByRole('group');
  const correct = [1, 0];
  for (const [index, answer] of correct.entries()) {
    const choice = wrongFirst && index === 0 ? (answer + 1) % 2 : answer;
    await groups.nth(index).getByRole('radio').nth(choice).check();
    await groups.nth(index).getByRole('button', { name: '答える' }).click();
  }
  await expect(panel.getByTestId('check-summary')).toBeVisible();
  return panel;
}

async function startChallenge(page: Page) {
  await releaseAllManualFixSites(page);
  await startChangeRequests(page);
  await expect(page.getByTestId('change-panel')).toBeVisible();
}

const PARTS = ['compareWithLastYear', 'buildShareColumn', 'rebuildAggregation'] as const;

/** 3件すべてを ReportService に置いて確定する。 */
async function placeAllInReportService(page: Page) {
  for (const part of PARTS) {
    await dragMethodToClass(page, `method-${part}`, 'class-ReportService');
    await finishAndAdvance(page);
  }
}

test('100点にしただけでは「クリア」にならず、残りの段階が一覧に出る(おすすめもそのまま)', async ({ page }) => {
  // Arrange & Act
  await clearTutorial1(page);
  const { status, next } = await readRoadmap(page);

  // Assert
  expect(status).toContain(REMAINING_ALL);
  expect(status).not.toContain('✅');
  expect(next).toBe(`次のおすすめ: ${STAGE_1}`);
});

test('理解度チェックは、1問間違えると変わらず、「もう一度」で全問正解すると残りから消える', async ({ page }) => {
  // Arrange
  await clearTutorial1(page);

  // Act: 1問間違える
  const panel = await answerChecks(page, true);

  // Assert
  expect((await readRoadmap(page)).status).toContain(REMAINING_ALL);

  // Act: もう一度で全問正解
  await panel.getByRole('button', { name: 'もう一度' }).click();
  await answerChecks(page, false);

  // Assert
  expect((await readRoadmap(page)).status).toContain(REMAINING_CHANGE);
});

test('全件を置いて最後まで確定すると「クリア」になり、再読み込みしても残る', async ({ page }) => {
  // Arrange
  await clearTutorial1(page);
  await answerChecks(page, false);
  await startChallenge(page);

  // Act
  await placeAllInReportService(page);

  // Assert
  await expect(page.getByTestId('change-panel')).toBeVisible();
  await page.getByTestId('change-request-close').click();
  const roadmap = await readRoadmap(page);
  expect(roadmap.status).toContain('✅ クリア');
  expect(roadmap.next).toBe(`次のおすすめ: ${STAGE_2}`);
  await page.reload();
  expect((await readRoadmap(page)).status).toContain('✅ クリア');
});

test('変更依頼の途中で戻ると、(あと: 変更依頼)のまま', async ({ page }) => {
  // Arrange
  await clearTutorial1(page);
  await answerChecks(page, false);
  await startChallenge(page);
  await dragMethodToClass(page, `method-${PARTS[0]}`, 'class-ReportService');
  await finishAndAdvance(page);

  // Act
  await page.getByRole('button', { name: 'やめる' }).click();

  // Assert
  expect((await readRoadmap(page)).status).toContain(REMAINING_CHANGE);
});

test('解答例より低い置き方のまま確定すると、(あと: 変更依頼)のまま', async ({ page }) => {
  // Arrange
  await clearTutorial1(page);
  await answerChecks(page, false);
  await startChallenge(page);
  for (const part of PARTS.slice(0, 2)) {
    await dragMethodToClass(page, `method-${part}`, 'class-ReportService');
    await finishAndAdvance(page);
  }

  // Act: 最後の依頼の部品を、既存クラスでなく余白へ出して確定する
  const source = await page.getByTestId(`method-${PARTS[2]}`).boundingBox();
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (source === null || pane === null) throw new Error('ドラッグ対象または余白が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();
  await finishAndAdvance(page);
  await page.getByTestId('change-request-close').click();

  // Assert
  expect((await readRoadmap(page)).status).toContain(REMAINING_CHANGE);
});

test('点数だけの古い保存データや壊れた記録でも、画面は壊れず残りが出る', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await page.evaluate((id) => localStorage.setItem('refactor-blocks:progress', JSON.stringify({ [id]: 100 })), STAGE_1_ID);
  for (const broken of ['{', '{"a":"x"}']) {
    await page.evaluate((value) => localStorage.setItem('refactor-blocks:milestones', value), broken);

    // Act
    await page.reload();

    // Assert
    expect((await readRoadmap(page)).status).toContain(REMAINING_ALL);
  }
  await page.evaluate(() => localStorage.removeItem('refactor-blocks:milestones'));
  await page.reload();
  expect((await readRoadmap(page)).status).toContain(REMAINING_ALL);
});
