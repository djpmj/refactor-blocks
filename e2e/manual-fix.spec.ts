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
  await page.keyboard.press('Space');
  await expect(page.getByTestId('fixed-mark')).toHaveCount(0);

  for (const name of ['confirm', 'issue', 'create']) await page.getByTestId(`method-${name}`).click();
  await panel.getByRole('button', { name: 'リリースする' }).click();
  await expect(panel).toContainText('✅ 直し忘れなし。3 か所すべてを直せました');

  await panel.getByRole('button', { name: '閉じる' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('button', { name: '実際に直してみる' })).toBeVisible();
});

test('変更箇所が1か所のコードではボタンが出ず、ステージを切り替えると終わる', async ({ page }) => {
  await openCopyPasteTax(page);
  await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeVisible();

  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeHidden();
  await expect(page.getByRole('region', { name: 'もし、この変更が来たら?' })).toBeVisible();
  await expect(page.getByRole('button', { name: '実際に直してみる' })).toBeHidden();
});
