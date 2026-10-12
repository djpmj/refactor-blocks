import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function openCopyPasteTax(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  await page.locator('.change-pain summary').click();
  await page.getByRole('button', { name: '実際に直してみる' }).click();
}

test('一部にしか印を付けずにリリースすると、直し忘れが報告される', async ({ page }) => {
  await openCopyPasteTax(page);
  const panel = page.getByRole('region', { name: '手で直すシミュレーション' });
  await expect(panel).toContainText('軽減税率8%に対応して');

  await page.getByTestId('method-confirm').click();
  await page.getByTestId('method-issue').click();
  await expect(page.getByTestId('fixed-mark')).toHaveCount(2);
  await expect(panel).toContainText('直した印: 2 個');
  await expect(page.locator('.method-chip--selected')).toHaveCount(0);

  await panel.getByRole('button', { name: 'リリースする' }).click();
  await expect(panel).toContainText('⚠ 直し忘れ 1 か所');
  await expect(panel).toContainText('QuoteService.create');
  await expect(panel).toContainText('3 か所を直す必要があります');

  await page.getByTestId('method-create').click();
  await expect(page.getByTestId('fixed-mark')).toHaveCount(2);
});

test('3つとも印を付ければ直し忘れなし。印はキーボードでも付け外しでき、閉じるとボタンが戻る', async ({ page }) => {
  await openCopyPasteTax(page);
  const panel = page.getByRole('region', { name: '手で直すシミュレーション' });

  await page.getByTestId('method-confirm').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fixed-mark')).toHaveCount(1);
  const viewer = page.getByRole('region', { name: '手で直す中のメソッドの内容' });
  await expect(viewer).toContainText('OrderService.confirm()');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('fixed-mark')).toHaveCount(0);
  await expect(viewer).toContainText('OrderService.confirm()');

  for (const name of ['confirm', 'issue', 'create']) await page.getByTestId(`method-${name}`).click();
  await panel.getByRole('button', { name: 'リリースする' }).click();
  await expect(panel).toContainText('✅ 直し忘れなし。3 か所すべてを直せました');

  await panel.getByRole('button', { name: '閉じる' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('button', { name: '実際に直してみる' })).toBeVisible();
});

test('クリックしたメソッドの処理を読み取り専用で表示し、リセット後は選択中の編集画面へ戻る', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  await page.getByTestId('method-issue').click();
  await expect(page.locator('.method-editor')).toContainText('InvoiceService.issue()');
  await expect(page.locator('.method-chip--selected')).toHaveCount(1);
  await expect(page.getByTestId('method-issue').locator('.method-chip--selected')).toHaveCount(1);

  await page.locator('.change-pain summary').click();
  await page.getByRole('button', { name: '実際に直してみる' }).click();
  const viewer = page.getByRole('region', { name: '手で直す中のメソッドの内容' });
  await expect(viewer).toContainText('メソッドをクリックすると、ここにそのメソッドの処理の一覧が出ます');
  await expect(page.locator('.method-editor')).toHaveCount(0);
  await expect(page.locator('.method-chip--selected')).toHaveCount(0);

  await page.getByTestId('method-confirm').click();
  await expect(viewer).toContainText('OrderService.confirm()');
  await expect(viewer).toContainText('消費税を計算する');
  await expect(viewer.getByRole('tab', { name: '編集' })).toBeVisible();
  await expect(viewer.getByRole('checkbox')).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: '選んだ処理をメソッドとして抽出' })).toHaveCount(0);

  await viewer.getByRole('tab', { name: 'コード' }).click();
  await expect(viewer.locator('pre')).toContainText('class OrderService');

  await page.getByTestId('method-issue').click();
  await expect(viewer).toContainText('InvoiceService.issue()');

  await page.getByTestId('method-create').focus();
  await page.keyboard.press('Enter');
  await expect(viewer).toContainText('QuoteService.create()');
  await expect(page.getByTestId('method-create')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('method-confirm').click();
  await expect(viewer).toContainText('OrderService.confirm()');
  const simulation = page.getByRole('region', { name: '手で直すシミュレーション' });
  await simulation.getByRole('button', { name: 'リリースする' }).click();
  await expect(simulation).toContainText('直し忘れ');
  const fixedCount = await page.getByTestId('fixed-mark').count();
  await page.getByTestId('method-issue').click();
  await expect(viewer).toContainText('InvoiceService.issue()');
  await expect(page.getByTestId('fixed-mark')).toHaveCount(fixedCount);

  await simulation.getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('.method-editor')).toContainText('InvoiceService.issue()');
  await expect(page.getByTestId('method-issue').locator('.method-chip--selected')).toHaveCount(1);

  await page.getByRole('button', { name: '実際に直してみる' }).click();
  await expect(viewer).toContainText('メソッドをクリックすると、ここにそのメソッドの処理の一覧が出ます');
  await expect(page.locator('.method-chip--selected')).toHaveCount(0);
  await simulation.getByRole('button', { name: 'リリースする' }).click();
  await simulation.getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('.method-editor')).toContainText('InvoiceService.issue()');
  await expect(page.getByTestId('method-issue').locator('.method-chip--selected')).toHaveCount(1);
});

test('手で直している最中にUndoで閲覧中メソッドが消えると案内に戻る', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  await page.getByTestId('method-confirm').click();
  await page.getByLabel('消費税を計算する').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  await page.locator('.change-pain summary').click();
  await page.getByRole('button', { name: '実際に直してみる' }).click();
  const viewer = page.getByRole('region', { name: '手で直す中のメソッドの内容' });
  await page.getByTestId('method-calculateTax').click();
  await expect(viewer).toContainText('OrderService.calculateTax()');

  await page.keyboard.press('Control+z');
  await expect(viewer).toContainText('メソッドをクリックすると、ここにそのメソッドの処理の一覧が出ます');
});

test('変更箇所が1か所のコードではボタンが出ず、ステージを切り替えると終わる', async ({ page }) => {
  await openCopyPasteTax(page);
  await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeVisible();

  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeHidden();
  await expect(page.getByRole('region', { name: 'もし、この変更が来たら?' })).toBeVisible();
  await expect(page.getByRole('button', { name: '実際に直してみる' })).toBeHidden();
});


