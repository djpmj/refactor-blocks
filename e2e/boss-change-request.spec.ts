import { expect, test, type Page } from '@playwright/test';
import { finishAndAdvance, releaseAllManualFixSites, selectStage, startChangeRequests } from './selectStage.js';

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

async function extract(page: Page, method: string, fragmentLabels: string[], name: string) {
  await page.getByTestId(method).click();
  for (const label of fragmentLabels) await page.getByLabel(label).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

/** 部品を置いて「実装を終える」。次の依頼か結果に進むまで繰り返し押す。 */
async function implement(page: Page, partId: string, classId: string, next: ReturnType<Page['getByTestId']>) {
  await dragMethodToClass(page, partId, classId);
  await finishAndAdvance(page);
  await expect(next).toBeVisible();
}

test('組み替えたチュートリアル2では、ボスが最後に出て、100点で入れられて組み替える前と比べられる', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await extract(page, 'method-placeOrder', ['消費税を計算する(軽減税率あり)'], 'calculateTax');
  await dragMethodToClass(page, 'method-calculateTax', 'class-TaxCalculator');
  await extract(page, 'method-placeOrder', ['注文をDBに保存する'], 'saveOrder');
  await extract(page, 'method-placeOrder', ['確認メールを送る'], 'sendConfirmationMail');
  await extract(page, 'method-placeOrder', ['在庫があるか検証する'], 'validateStock');
  await expect(page.getByTestId('score-value')).toContainText('100');
  await releaseAllManualFixSites(page);
  await startChangeRequests(page);

  // 最後の依頼の前は、ボスの印が出ない
  await expect(page.getByTestId('boss-label')).toHaveCount(0);
  await implement(page, 'method-addReducedTaxItems', 'class-TaxCalculator', page.getByTestId('change-request-title').filter({ hasText: '確認メールの文面' }));
  await implement(page, 'method-addContactGuide', 'class-OrderService', page.getByTestId('change-request-title').filter({ hasText: '在庫の検証ルール' }));
  await implement(page, 'method-validateQuantityLimit', 'class-OrderService', page.getByTestId('boss-label'));

  await expect(page.getByTestId('boss-label')).toHaveText('⚠ 鬼の変更');
  await expect(page.getByTestId('change-request-title')).toContainText('作り直して');
  await expect(page.getByText('依頼 4 / 4')).toBeVisible();
  await implement(page, 'method-calculateTaxByItem', 'class-TaxCalculator', page.getByTestId('boss-comparison'));

  const comparison = page.getByTestId('boss-comparison');
  await expect(comparison).toContainText('鬼の変更の置き方の点数で比べています');
  await expect(comparison).toContainText('組み替える前のコードなら');
  await expect(comparison).toContainText('最善の置き方でも 90点');
  await expect(comparison).toContainText('あなたの設計では');
  await expect(comparison).toContainText('置き方 100点');
  await expect(comparison).toContainText('冒頭の「軽減税率の対象を増やして」の処理を切り出しておいたおかげで');
  await expect(comparison).toContainText('最善の置き方でも');
});

test('組み替えていないと、ボスの比較にも行数の上限を超えるクラスが出る', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await extract(page, 'method-printMonthlyReport', ['今月の売上を集計する', '前月比を計算する'], 'aggregateSales');
  await expect(page.getByTestId('score-value')).toContainText('100');
  await releaseAllManualFixSites(page);
  await startChangeRequests(page);

  await implement(page, 'method-compareWithLastYear', 'class-ReportService', page.getByTestId('change-request-title').filter({ hasText: '構成比' }));
  await implement(page, 'method-buildShareColumn', 'class-ReportService', page.getByTestId('boss-label'));
  await implement(page, 'method-rebuildAggregation', 'class-ReportService', page.getByTestId('boss-comparison'));

  const comparison = page.getByTestId('boss-comparison');
  await expect(comparison).toContainText('ReportService が行数の上限を超える');
});
