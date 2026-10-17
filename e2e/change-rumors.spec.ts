import { expect, test } from '@playwright/test';
import { releaseAllManualFixSites, selectStage, startChangeRequests } from './selectStage.js';

async function dragMethodToClass(page: import('@playwright/test').Page, method: string, codeClass: string) {
  const source = await page.getByTestId(method).boundingBox();
  const target = await page.getByTestId(codeClass).boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await expect(page.getByTestId(codeClass)).toHaveClass(/class-node--drop-target/);
  await page.mouse.up();
  await expect(page.locator('.drag-overlay')).toHaveCount(0);
}

async function extract(page: import('@playwright/test').Page, method: string, fragmentIndexes: number[], name: string) {
  await page.getByTestId(method).click();
  const checkboxes = page.locator('.fragment-list__item input[type=checkbox]');
  for (const index of fragmentIndexes) await checkboxes.nth(index).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('サイドバーに本文だけのうわさを出し、ストーリー中は話し手も表示する', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');

  const rumors = page.getByTestId('rumor-list');
  const storyToggle = page.getByTestId('story-toggle');
  if (await storyToggle.getAttribute('aria-pressed') === 'false') await storyToggle.click();
  await expect(rumors).toBeVisible();
  await expect(page.getByTestId('rumor-req-report-share')).toContainText('営業の佐藤さんから');
  await expect(page.getByTestId('rumor-req-report-share')).toContainText('表の見せ方');
  await expect(rumors).not.toContainText('表に「構成比」列を追加して');
  await expect(page.getByTestId('rumor-list')).toHaveAttribute('aria-labelledby', 'rumor-list-title');

  await storyToggle.click();
  await expect(page.getByTestId('rumor-req-report-share')).not.toContainText('営業の佐藤さんから');
  await expect(page.getByTestId('rumor-req-report-share')).toContainText('表の見せ方');
});

test('噂の対象がないステージでは欄を表示しない', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級10: 会員ランクごとのif分岐をクラスに分ける', { completeOpeningFix: false });
  await expect(page.getByTestId('rumor-list')).toHaveCount(0);
});

test('変更依頼中はうわさ欄を隠す', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('前月比を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.getByTestId('score')).toContainText('100');
  await releaseAllManualFixSites(page);
  await startChangeRequests(page);
  await expect(page.getByTestId('change-panel')).toBeVisible();
  await expect(page.getByTestId('rumor-list')).toHaveCount(0);
  await dragMethodToClass(page, 'method-compareWithLastYear', 'class-ReportService');
  await expect(async () => {
    await page.getByTestId('change-request-finish').click({ timeout: 1000 });
    await expect(page.getByTestId('change-request-title')).not.toHaveText('前年同月比も出して', { timeout: 1000 });
  }).toPass();
  await expect(page.getByTestId('change-request-title')).toHaveText('表に「構成比」列を追加して');
  await expect(page.getByTestId('rumor-came-true')).toContainText('レポートの表の見せ方');
  await expect(page.getByTestId('rumor-came-true')).not.toContainText('「「');
  await dragMethodToClass(page, 'method-buildShareColumn', 'class-ReportService');
  await expect(async () => {
    await page.getByTestId('change-request-finish').click({ timeout: 1000 });
    await expect(page.getByTestId('boss-label')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(page.getByTestId('rumor-came-true')).toContainText('数字の出し方');
  await dragMethodToClass(page, 'method-rebuildAggregation', 'class-ReportService');
  await expect(async () => {
    await page.getByTestId('change-request-finish').click({ timeout: 1000 });
    await expect(page.getByTestId('change-outcome-req-report-share')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(page.getByTestId('change-outcome-req-report-share').getByTestId('rumor-payoff')).toContainText('✗ うわさに備えきれず');
});

test('100点の置き方では、噂のpayoffに備えていた✓文を出す', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級11: Controller に全部書いてある注文API');

  await extract(page, 'method-placeOrder', [1, 2, 3], 'processOrder');
  await extract(page, 'method-processOrder', [2], 'saveOrder');
  await extract(page, 'method-cancelOrder', [1, 2], 'processCancel');
  await extract(page, 'method-processCancel', [1], 'saveCancellation');
  await dragMethodToClass(page, 'method-saveOrder', 'class-OrderRepository');
  await dragMethodToClass(page, 'method-saveCancellation', 'class-OrderRepository');
  await dragMethodToClass(page, 'method-processOrder', 'class-OrderService');
  await dragMethodToClass(page, 'method-processCancel', 'class-OrderService');
  await expect(page.getByTestId('score')).toContainText('100');
  await releaseAllManualFixSites(page);
  await startChangeRequests(page);

  await dragMethodToClass(page, 'method-switchToExternalApi', 'class-OrderRepository');
  await page.getByTestId('change-request-finish').click();
  await expect(page.getByTestId('change-request-title')).toHaveText('送料無料の条件を変えて');
  await dragMethodToClass(page, 'method-reviseFreeShippingRule', 'class-OrderService');
  await expect(async () => {
    await page.getByTestId('change-request-finish').click({ timeout: 1000 });
    await expect(page.getByTestId('boss-label')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await dragMethodToClass(page, 'method-rebuildPersistence', 'class-OrderRepository');
  await expect(async () => {
    await page.getByTestId('change-request-finish').click({ timeout: 1000 });
    await expect(page.getByTestId('change-outcome-req-free-shipping')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(page.getByTestId('change-outcome-req-free-shipping').getByTestId('rumor-payoff')).toContainText('✓ うわさに備えた設計だったので');
});
