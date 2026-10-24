import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('参考メニューは6個のツールバー操作にまとまり、変更前の図を確認なしで開く', async ({ page }) => {
  await page.goto('/');
  const toolbar = page.locator('.toolbar');
  await expect(toolbar.getByRole('button')).toHaveCount(6);

  const menuButton = page.getByTestId('reference-menu-button');
  await menuButton.focus();
  await page.keyboard.press('Enter');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('reference-before')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuButton).toBeFocused();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

  await menuButton.click();
  await page.getByTestId('reference-before').click();
  await expect(page.getByTestId('answer-confirm')).not.toBeVisible();
  await expect(page.getByTestId('codebase-preview')).toBeVisible();
});

test('答えの前に問題ヒント、次の一手の順に開き、同じステージでは次から確認せず、ステージ変更後は再確認する', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級1: 循環依存を断ち切る', { completeOpeningFix: false });
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  const confirmation = page.getByTestId('answer-confirm');
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole('heading', { name: '答えを見ますか?' })).toBeVisible();
  await expect(confirmation).toContainText('ヒントはあと 5 個あります');
  await expect(confirmation.getByRole('button').first()).toBeFocused();
  await confirmation.getByRole('button', { name: 'ヒントを見る' }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(page.getByTestId('codebase-preview')).not.toBeVisible();
  const problemText = page.getByTestId('hint-problem-text');
  await expect(problemText).toContainText('いちばん大きい減点: 循環依存(-20点)');
  await expect(problemText).toContainText('AがBを、BがAを呼んでいると、片方を直すともう片方も直すことになり、どちらも単独でテスト・再利用できません。');
  await expect(problemText).not.toContainText('Move Method');
  await expect(page.getByTestId('class-Order')).toHaveClass(/class-node--flagged/);
  await expect(page.getByTestId('class-Customer')).toHaveClass(/class-node--flagged/);
  await expect(page.locator('.react-flow__edge.edge--cyclic')).toHaveCount(2);
  await expect(page.locator('.stage-panel__hint-list li')).toHaveCount(0);
  await expect(page.locator('#stage-sidebar')).toBeVisible();

  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'ヒントを見る' }).click();
  await expect(confirmation).not.toBeVisible();
  const nextStep = page.locator('.stage-panel__hint-list li');
  await expect(nextStep).toHaveCount(1);
  await expect(nextStep.first()).toContainText('calculateOrderTotal をMove Methodで Order へ移そう');

  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: '答えを見る' }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(page.getByTestId('codebase-preview')).toBeVisible();
  await page.getByTestId('codebase-preview').getByRole('button', { name: '閉じる' }).click();

  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  await expect(confirmation).not.toBeVisible();
  await expect(page.getByTestId('codebase-preview')).toBeVisible();
  await page.getByTestId('codebase-preview').getByRole('button', { name: '閉じる' }).click();

  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  await expect(confirmation).toBeVisible();
});

test('メニューは矢印キーで移動・選択でき、未登録の答えは無効で、確認ダイアログはEscで閉じる', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級6: 他人のデータばかり触るメソッド');
  const menuButton = page.getByTestId('reference-menu-button');
  await menuButton.click();
  const before = page.getByTestId('reference-before');
  const sample = page.getByTestId('reference-sample');
  const replay = page.getByTestId('reference-replay');

  await expect(before).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(sample).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuButton).toBeFocused();

  await page.evaluate(async () => {
    const modulePath: string = '/src/domain/stage/sampleAnswer.ts';
    const answers = await import(modulePath);
    delete answers.sampleAnswerSteps['intermediate-feature-envy'];
  });
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await selectStage(page, '中級6: 他人のデータばかり触るメソッド');
  await menuButton.click();
  await expect(sample).toHaveAttribute('aria-disabled', 'true');
  await expect(sample).toHaveAttribute('title', 'このステージには解答例が未登録です');
  await expect(replay).toHaveAttribute('aria-disabled', 'true');
  await expect(replay).toHaveAttribute('title', 'このステージには解答例が未登録です');
  await expect(before).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuButton).toBeFocused();

  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await menuButton.click();
  await page.getByTestId('reference-replay').click();
  const confirmation = page.getByTestId('answer-confirm');
  await expect(confirmation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmation).not.toBeVisible();
  await expect(menuButton).toBeFocused();
});

test('解答例プレビュー内のArrowDownはメニューに妨げられない', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  await page.getByTestId('answer-confirm').getByRole('button', { name: '答えを見る' }).click();

  const preview = page.getByTestId('codebase-preview');
  const previewButton = preview.getByTestId('codebase-preview-maximize');
  await expect(previewButton).toBeFocused();
  await page.evaluate("document.addEventListener('keydown', event => { if (event.key === 'ArrowDown') document.documentElement.dataset.arrowDownPrevented = String(event.defaultPrevented); }, { once: true })");
  await page.keyboard.press('ArrowDown');

  await expect(page.locator('html')).toHaveAttribute('data-arrow-down-prevented', 'false');
});
