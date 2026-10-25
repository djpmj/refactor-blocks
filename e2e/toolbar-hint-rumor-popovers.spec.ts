import { expect, test, type Page } from '@playwright/test';
import { openHints, openRumors } from './hintPopover.js';
import { releaseAllManualFixSites, selectStage } from './selectStage.js';

const TUTORIAL1 = 'チュートリアル1: 長いメソッドを分ける';
const NO_RUMOR_STAGE = '中級10: 会員ランクごとのif分岐をクラスに分ける';

async function openTutorial1(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, TUTORIAL1);
}

async function reach100(page: Page) {
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score-value')).toContainText('100');
  await releaseAllManualFixSites(page);
}

async function tabOutOfPopover(page: Page, popoverId: string) {
  const focusedInside = page.locator(`.popover:has([data-testid="${popoverId}"]) :focus`);
  for (let i = 0; i < 30 && (await focusedInside.count()) > 0; i++) await page.keyboard.press('Tab');
  await expect(focusedInside).toHaveCount(0);
}

test('ツールバーが 挑戦・元に戻す・やり直し・最初に戻す・参考・答え・ヒント・うわさ・操作ガイド の順に並ぶ', async ({ page }) => {
  // Arrange
  await openTutorial1(page);

  // Act
  const names = await page.locator('.stage-panel__actions > button, .stage-panel__actions > div > button').evaluateAll((buttons) => buttons.map((button) => button.textContent.trim()));

  // Assert
  expect(names).toEqual(['変更依頼に挑戦', '元に戻す', 'やり直し', '最初に戻す', '参考・答え ▾', 'ヒント ▾', 'うわさ(2) ▾', '操作ガイド']);
  await expect(page.locator('#stage-sidebar [data-testid="hint-problem"], #stage-sidebar [data-testid="rumor-list"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '課題', exact: true })).toBeVisible();
});

test('ヒントのポップオーバーは、ボタンで開閉し、Esc・外側クリックで閉じ、開くと最初のボタンにフォーカスする', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  const button = page.getByTestId('hint-popover-button');
  const popover = page.getByTestId('hint-popover');
  await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(button).toHaveAttribute('aria-expanded', 'false');

  // Act
  await button.click();

  // Assert
  await expect(popover).toBeVisible();
  await expect(popover).toHaveAttribute('role', 'dialog');
  await expect(popover).toHaveAccessibleName('ヒント');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(button).toHaveAttribute('aria-controls', (await popover.getAttribute('id')) ?? '');
  await expect(page.getByTestId('hint-problem')).toBeFocused();

  // Act: Esc
  await page.keyboard.press('Escape');

  // Assert
  await expect(popover).toBeHidden();
  await expect(button).toBeFocused();

  // Act: ボタンの再押下
  await button.click();
  await expect(popover).toBeVisible();
  await button.click();

  // Assert
  await expect(popover).toBeHidden();

  // Act: 外側クリック
  await button.click();
  await expect(popover).toBeVisible();
  await page.locator('#stage-problem-title').click();

  // Assert
  await expect(popover).toBeHidden();
});

test('うわさのポップオーバーは件数をボタンに出し、パネルにフォーカスし、Esc・外側クリックで閉じる', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  const button = page.getByTestId('rumor-popover-button');
  const popover = page.getByTestId('rumor-popover');
  await expect(button).toHaveText('うわさ(2) ▾');
  await expect(button).toHaveAttribute('aria-haspopup', 'dialog');

  // Act
  await button.click();

  // Assert
  await expect(popover).toBeVisible();
  await expect(popover).toHaveAccessibleName('気になるうわさ');
  await expect(popover).toBeFocused();
  await expect(popover.getByTestId('rumor-list')).toBeVisible();
  await expect(popover.locator('li')).toHaveCount(2);
  await expect(popover.getByTestId('rumor-req-report-share')).toContainText('表の見せ方');

  // Act: Esc
  await page.keyboard.press('Escape');

  // Assert
  await expect(popover).toBeHidden();
  await expect(button).toBeFocused();

  // Act: 外側クリック
  await button.click();
  await page.locator('#stage-problem-title').click();

  // Assert
  await expect(popover).toBeHidden();
});

for (const [label, buttonId, popoverId] of [['ヒント', 'hint-popover-button', 'hint-popover'], ['うわさ', 'rumor-popover-button', 'rumor-popover']] as const) {
  test(`${label}のポップオーバーは、Tab で外へ出たあとでも Esc で閉じてボタンにフォーカスが戻る`, async ({ page }) => {
    // Arrange
    await openTutorial1(page);
    const button = page.getByTestId(buttonId);
    const popover = page.getByTestId(popoverId);
    await button.click();
    await expect(popover).toBeVisible();
    await tabOutOfPopover(page, popoverId);
    await expect(popover).toBeVisible();

    // Act
    await page.keyboard.press('Escape');

    // Assert
    await expect(popover).toBeHidden();
    await expect(button).toBeFocused();
  });
}

test('うわさの無いステージでは、うわさのボタンを出さない', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');

  // Act
  await selectStage(page, NO_RUMOR_STAGE, { completeOpeningFix: false });

  // Assert
  await expect(page.getByTestId('hint-popover-button')).toBeVisible();
  await expect(page.getByTestId('rumor-popover-button')).toHaveCount(0);
});

test('同時に開くのは1つだけで、参考・答えを開くとヒントとうわさは閉じる', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  await openHints(page);

  // Act
  await page.getByTestId('rumor-popover-button').click();

  // Assert
  await expect(page.getByTestId('hint-popover')).toBeHidden();
  await expect(page.getByTestId('rumor-popover')).toBeVisible();

  // Act
  await page.getByTestId('reference-menu-button').click();

  // Assert
  await expect(page.getByTestId('rumor-popover')).toBeHidden();
  await expect(page.getByTestId('reference-before')).toBeVisible();

  // Act
  await page.getByTestId('hint-popover-button').click();

  // Assert
  await expect(page.getByTestId('reference-before')).toBeHidden();
  await expect(page.getByTestId('hint-popover')).toBeVisible();
});

test('「どこが問題?」「次の一手」では閉じず、閉じて開き直しても開いたヒントが残る', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  const popover = page.getByTestId('hint-popover');
  await openHints(page);

  // Act
  await page.getByTestId('hint-problem').click();
  await page.getByRole('button', { name: /次の一手/ }).click();

  // Assert
  await expect(popover).toBeVisible();
  await expect(page.getByTestId('hint-problem-text')).toBeVisible();
  await expect(popover.locator('.stage-panel__hint-list li')).toHaveCount(1);

  // Act
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await openHints(page);

  // Assert
  await expect(page.getByTestId('hint-problem-text')).toBeVisible();
  await expect(popover.locator('.stage-panel__hint-list li')).toHaveCount(1);
});

test('「キャンバスで見る」と「動きで見る」を押すとポップオーバーが閉じ、キャンバスに出る', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級3: 越境する private メソッド');
  const popover = page.getByTestId('hint-popover');
  await openHints(page);
  await page.getByTestId('hint-problem').click();
  await page.getByRole('button', { name: /次の一手/ }).click();

  // Act
  await page.getByRole('button', { name: 'ヒント1の場所をキャンバスで見る' }).click();

  // Assert
  await expect(popover).toBeHidden();
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).not.toHaveCount(0);

  // Act
  await openHints(page);
  await page.getByTestId('ghost-hint').click();

  // Assert
  await expect(popover).toBeHidden();
  await expect(page.getByTestId('ghost-hint-live')).not.toBeEmpty();
});

test('変更依頼に挑戦している間は、ヒントとうわさのボタンが無効になり、開いていたら閉じる', async ({ page }) => {
  // Arrange
  await openTutorial1(page);
  await reach100(page);
  await openRumors(page);
  await expect(page.getByTestId('rumor-popover')).toBeVisible();

  // Act: ポインターを使わず、キーボードで挑戦を始める(外側クリックで閉じてしまわないように)
  await page.getByTestId('change-request-start').focus();
  await page.keyboard.press('Enter');

  // Assert
  await expect(page.getByTestId('change-panel')).toBeVisible();
  await expect(page.getByTestId('rumor-popover')).toBeHidden();
  await expect(page.getByTestId('rumor-popover-button')).toBeDisabled();
  await expect(page.getByTestId('hint-popover-button')).toBeDisabled();
});

test('手が止まると「ヒント ▾」が脈打ち、ポップオーバーを開いている間と「どこが問題?」を開いたあとは脈打たない', async ({ page }) => {
  // Arrange
  await page.clock.install();
  await openTutorial1(page);
  const button = page.getByTestId('hint-popover-button');

  // Act
  await page.clock.fastForward(30_000);

  // Assert
  await expect(button).toHaveClass(/ghost-hint-button--idle/);

  // Act: 開くと止まる
  await button.click();

  // Assert
  await expect(button).not.toHaveClass(/ghost-hint-button--idle/);
  await expect(page.getByTestId('hint-problem')).not.toHaveClass(/ghost-hint-button--idle/);

  // Act: 「どこが問題?」を開いたあとは、手が止まっても脈打たない
  await page.getByTestId('hint-problem').click();
  await page.keyboard.press('Escape');
  await page.clock.fastForward(30_000);

  // Assert
  await expect(button).not.toHaveClass(/ghost-hint-button--idle/);
});

test('参考・答えの確認ダイアログの「ヒントを見る」で、ヒントのポップオーバーが開いて次のヒントが1つ開く', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級1: 循環依存を断ち切る', { completeOpeningFix: false });
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();

  // Act
  await page.getByTestId('answer-confirm').getByRole('button', { name: 'ヒントを見る' }).click();

  // Assert
  await expect(page.getByTestId('answer-confirm')).not.toBeVisible();
  await expect(page.getByTestId('hint-popover')).toBeVisible();
  await expect(page.getByTestId('hint-problem-text')).toBeVisible();
  await expect(page.getByTestId('hint-popover').getByRole('button').first()).toBeFocused();
});

test('狭い画面(375px)でも、ポップオーバーが横にはみ出さず操作できる', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  await selectStage(page, TUTORIAL1, { completeOpeningFix: false });

  for (const [buttonId, popoverId] of [['hint-popover-button', 'hint-popover'], ['rumor-popover-button', 'rumor-popover']] as const) {
    // Act
    await page.getByTestId(buttonId).click();

    // Assert
    const box = await page.getByTestId(popoverId).boundingBox();
    if (box === null) throw new Error(`${popoverId} が表示されていません`);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(375);
  }

  // Act: 狭い画面でもパネルの中を操作できる
  await page.getByTestId('hint-popover-button').click();
  await page.getByTestId('hint-problem').click();

  // Assert
  await expect(page.getByTestId('hint-problem-text')).toBeVisible();
});
