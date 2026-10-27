import { expect, test, type Page } from '@playwright/test';
import { dismissClearScreen, selectStage } from './selectStage.js';

const TUTORIAL = 'チュートリアル1: 長いメソッドを分ける';

async function refactorTutorial1(page: Page) {
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score-value')).toContainText('100');
}

async function openTutorial(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await selectStage(page, TUTORIAL, { completeOpeningFix: false });
  const tourClose = page.getByRole('button', { name: 'ガイドを終了' });
  if (await tourClose.isVisible()) await tourClose.click();
  const openSidebar = page.getByRole('button', { name: 'サイドバーを開く' });
  if (await openSidebar.count() > 0) await openSidebar.click();
  await expect(page.locator('.change-pain').getByRole('button', { name: '実際に直してみる' })).toBeVisible();
}

async function reachImpactReview(page: Page, leaveOpeningMissed: boolean) {
  await page.locator('.change-pain').getByRole('button', { name: '実際に直してみる' }).click();
  if (!leaveOpeningMissed) await page.getByRole('checkbox', { name: 'ReportService.printMonthlyReport() を直した' }).check();
  await page.getByRole('button', { name: 'リリースする' }).click();
  if (leaveOpeningMissed) await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toContainText('直し忘れ 1 か所');
  await page.getByRole('button', { name: '組み替えを始める' }).click();
  await refactorTutorial1(page);
  await dismissClearScreen(page);
  await page.locator('.change-pain').getByRole('button', { name: '実際に直してみる' }).click();
  await page.getByRole('checkbox', { name: 'ReportService.aggregateSales() を直した' }).check();
  await page.getByRole('button', { name: 'リリースする' }).click();
  await expect(page.getByTestId('impact-review')).toBeVisible();
}

test('正解後に答え合わせを開き、前後の図・直し忘れ・因果を表示して再表示できる', async ({ page }) => {
  await openTutorial(page);
  await reachImpactReview(page, true);

  const dialog = page.getByTestId('impact-review');
  await expect(dialog.getByRole('heading', { name: '答え合わせ: 「前年同月比も出して」' })).toBeVisible();
  await expect(dialog.getByRole('region', { name: '組み替える前' }).locator('.impact-highlight--missed')).toContainText('直し忘れ');
  await expect.poll(() => dialog.getByRole('region', { name: '組み替える前' }).locator('[data-testid^="preview-method-"]:not([data-impact-highlight])').evaluateAll((nodes) => nodes.every((node) => !node.classList.contains('impact-highlight')))).toBe(true);
  await expect(dialog.getByRole('region', { name: '組み替える前' })).toContainText('冒頭のあなた: 直し忘れ 1 か所');
  await expect(dialog.getByRole('region', { name: '今' }).locator('.impact-highlight--site')).toContainText('直す');
  await expect(dialog.getByTestId('impact-explanation')).toContainText('aggregateSales');
  await expect(dialog.getByTestId('impact-explanation')).toContainText('読む量は 39 行 → 19 行');

  await page.setViewportSize({ width: 800, height: 900 });
  await expect.poll(() => dialog.locator('.impact-review__previews').evaluate((element) => {
    const view = element.ownerDocument.defaultView;
    return view === null ? 0 : view.getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length;
  })).toBe(1);
  await expect.poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'やり直し' }).click();
  await expect(dialog).toBeHidden();
  await page.getByTestId('impact-review-open').first().click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('impact-explanation')).toContainText('aggregateSales');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await expect(dialog).toBeHidden();
});

test('下書き再開後は答え合わせを表示し、opening fixが無いことを説明に出さない', async ({ page }) => {
  await openTutorial(page);
  await reachImpactReview(page, false);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('impact-review')).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('score-value')).toContainText('100');
  await page.locator('.change-pain').getByRole('button', { name: '実際に直してみる' }).click();
  await page.getByRole('checkbox', { name: 'ReportService.aggregateSales() を直した' }).check();
  await page.getByRole('button', { name: 'リリースする' }).click();
  const dialog = page.getByTestId('impact-review');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('region', { name: '組み替える前' }).locator('.impact-highlight--site')).toContainText('直す');
  await expect(dialog.getByRole('region', { name: '組み替える前' })).not.toContainText('冒頭のあなた:');
  await expect(dialog.getByTestId('impact-explanation')).not.toContainText('冒頭では');
});
