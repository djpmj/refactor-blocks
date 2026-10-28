import { expect, test, type Page } from '@playwright/test';
import { dismissClearScreen, releaseAllManualFixSites, selectStage } from './selectStage.js';

async function dragMethodToClass(page: Page, methodId: string, classId: string) {
  const source = await page.getByTestId(methodId).boundingBox();
  const target = await page.getByTestId(classId).boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function extract(page: Page, fragmentLabel: string, name: string) {
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel(fragmentLabel).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

async function clearTutorial2(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await extract(page, '消費税を計算する(軽減税率あり)', 'calculateTax');
  await dragMethodToClass(page, 'method-calculateTax', 'class-TaxCalculator');
  await extract(page, '注文をDBに保存する', 'saveOrder');
  await extract(page, '確認メールを送る', 'sendConfirmationMail');
  await extract(page, '在庫があるか検証する', 'validateStock');
  await expect(page.getByTestId('score-value')).toContainText('100');
  await dismissClearScreen(page);
}

test('保存値が無ければオンで始まり、導入と押下中の色が出る。オフにするとリロード後も残る', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('story-preference-initialized') !== 'true') {
      localStorage.removeItem('refactor-blocks:story');
      sessionStorage.setItem('story-preference-initialized', 'true');
    }
  });
  await page.goto('/');
  const toggle = page.getByTestId('story-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('story-intro')).toContainText('第1章');
  const colors = await toggle.evaluate((element) => {
    const view = element.ownerDocument.defaultView;
    if (view === null) throw new Error('ページのウィンドウがありません');
    const buttonColor = view.getComputedStyle(element).backgroundColor;
    const probe = element.ownerDocument.createElement('div');
    probe.style.backgroundColor = 'var(--accent)';
    element.ownerDocument.body.append(probe);
    const accentColor = view.getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { buttonColor, accentColor };
  });
  expect(colors.buttonColor).toBe(colors.accentColor);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('story-intro')).toBeHidden();

  await page.reload();
  await expect(page.getByTestId('story-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('story-intro')).toBeHidden();
});

test('100点で結びが出て、依頼を受けると変更依頼が始まる', async ({ page }) => {
  await clearTutorial2(page);
  await expect(page.getByTestId('story-outro')).toBeHidden();
  await page.getByTestId('story-toggle').click();
  await expect(page.getByTestId('story-outro')).toBeVisible();
  await expect(page.getByTestId('story-request-title')).toHaveCount(0);
  await expect(page.getByTestId('story-accept')).toHaveCount(0);

  await releaseAllManualFixSites(page);
  await expect(page.getByTestId('story-accept')).toBeVisible();
  await expect(page.getByTestId('story-request-title')).toHaveText('軽減税率の対象を増やして');

  await page.getByTestId('story-accept').click();
  await expect(page.getByTestId('story-outro')).toBeHidden();
  await expect(page.getByTestId('change-request-start')).toBeDisabled();
});

test('次の章へで次のステージへ移り、次の章の導入が出る', async ({ page }) => {
  await clearTutorial2(page);
  await page.getByTestId('story-toggle').click();
  await page.getByTestId('story-next').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('初級1: 何でも屋の UserController');
  await expect(page.getByTestId('story-intro')).toContainText('第3章');
});
