import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function clearTutorial1(page: import('@playwright/test').Page, preserveFocus = false) {
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  const checks = page.getByRole('checkbox');
  await checks.nth(0).check();
  await checks.nth(1).check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  const extract = page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' });
  if (preserveFocus) {
    await extract.evaluate((button: HTMLButtonElement) => button.click());
  } else {
    await extract.click();
  }
  await expect(page.getByTestId('clear-screen')).toBeVisible();
}

test('初めて100点にするとクリア画面が出て、戻ると再表示しない', async ({ page }) => {
  await clearTutorial1(page);
  const screen = page.getByTestId('clear-screen');
  await expect(screen.getByRole('heading', { name: 'STAGE CLEAR!' })).toBeVisible();
  await expect(screen.locator('.clear-screen__confetti')).toHaveCount(24);
  await expect(page.getByTestId('clear-choice-primary')).toBeFocused();
  await expect(page.getByTestId('clear-screen-score')).toHaveText('100点');
  await page.getByTestId('clear-choice-back').click();
  await expect(screen).toHaveCount(0);
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await page.getByRole('button', { name: '元に戻す' }).click();
  await page.getByRole('button', { name: 'やり直し' }).click();
  await expect(screen).toHaveCount(0);
});

test('閉じると開く前の要素へフォーカスが戻る', async ({ page }) => {
  await clearTutorial1(page, true);
  await page.getByTestId('clear-choice-back').click();
  await expect(page.getByLabel('新しいメソッド名')).toBeFocused();
});

test('再読み込みではクリア画面を再表示しない', async ({ page }) => {
  await clearTutorial1(page);
  await page.reload();
  await expect(page.getByTestId('clear-screen')).toHaveCount(0);
});

test('仕上げの手直しを選ぶと手直しが始まる', async ({ page }) => {
  await clearTutorial1(page);
  await page.getByTestId('clear-choice-closing-fix').click();
  await expect(page.getByTestId('clear-screen')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeVisible();
});

test('次のステージを選ぶとおすすめへ進む', async ({ page }) => {
  await clearTutorial1(page);
  await page.getByTestId('clear-choice-next-stage').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('チュートリアル2: 太った placeOrder');
});

test('動きを減らす設定では最初から100点', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await clearTutorial1(page);
  await expect(page.getByTestId('clear-screen-score')).toHaveText('100点');
  await expect(page.locator('.clear-screen__confetti').first()).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('clear-screen')).toHaveCount(0);
});
