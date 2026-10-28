import { expect, test, type Page } from '@playwright/test';
import { releaseAllManualFixSites, selectStage } from './selectStage.js';

async function extract(page: Page, methodId: string, fragmentLabel: string, name: string) {
  await page.getByTestId(`method-${methodId}`).click();
  await page.getByLabel(fragmentLabel).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('チュートリアル2の100点後は読む量だけを表示し、空条件は受け皿への意図を示す', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const openSidebar = page.getByRole('button', { name: 'サイドバーを開く' });
  if (await openSidebar.count() > 0) await openSidebar.click();

  await extract(page, 'placeOrder', '消費税を計算する(軽減税率あり)', 'calculateTax');
  const source = await page.getByTestId('method-calculateTax').boundingBox();
  const target = await page.getByTestId('class-TaxCalculator').boundingBox();
  if (source === null || target === null) throw new Error('移動対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await extract(page, 'placeOrder', '注文をDBに保存する', 'saveOrder');
  await extract(page, 'placeOrder', '確認メールを送る', 'sendConfirmationMail');
  await extract(page, 'placeOrder', '在庫があるか検証する', 'validateStock');
  await expect(page.getByTestId('score-value')).toContainText('100');
  await expect(page.locator('.clear-conditions li[aria-label="達成: 空のクラス・ファイル: 0件にする(中身を入れるか、消す)"]')).toBeVisible();
  await releaseAllManualFixSites(page);

  const reason = page.getByRole('region', { name: 'なぜ分けるのか' });
  await expect(reason).toContainText('読む量は 31 行 → 8 行 になりました。');
  await expect(reason).not.toContainText('1 か所 → 1 か所');
});

test('減点の内訳を開いたままステージを切り替えると閉じ、ツールバーを操作できる', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  const breakdown = page.locator('.score-breakdown');
  await breakdown.locator('summary').click();
  await selectStage(page, '中級3: 越境する private メソッド');
  await expect(page.locator('.score-breakdown')).not.toHaveAttribute('open', '');
  await page.getByTestId('operation-guide-open').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();
});

test('中級9で消費税計算を統合すると、変更箇所が減った文を表示する', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  await extract(page, 'confirm', '消費税を計算する', 'calculateOrderTax');
  await extract(page, 'issue', '消費税を計算する', 'calculateInvoiceTax');
  await page.getByTestId('method-calculateOrderTax').click();
  await expect(page.getByRole('heading', { name: '似た処理を持つメソッドと統合' })).toBeVisible();
  const mergedName = page.getByLabel('統合後の名前');
  await expect(mergedName).toBeVisible();
  await page.getByText('統合後の名前', { exact: true }).click();
  await expect(mergedName).toBeFocused();
  await mergedName.fill('calculateTax');
  const candidate = page.getByTestId('merge-candidate-calculateInvoiceTax');
  await expect(candidate).toHaveText('InvoiceService.calculateInvoiceTax() と統合する');
  await candidate.click();
  await extract(page, 'create', '消費税を計算する', 'calculateQuoteTax');
  await page.getByTestId('method-calculateTax').click();
  await page.getByLabel('統合後の名前').fill('calculateTax');
  await page.getByTestId('merge-candidate-calculateQuoteTax').click();
  const source = await page.getByTestId('method-calculateTax').boundingBox();
  const target = await page.getByTestId('class-TaxCalculator').boundingBox();
  if (source === null || target === null) throw new Error('統合したメソッドまたは移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId('score-value')).toContainText('100');
  await releaseAllManualFixSites(page);
  await expect(page.getByRole('region', { name: 'なぜ分けるのか' })).toContainText('3 か所 → 1 か所');
});
