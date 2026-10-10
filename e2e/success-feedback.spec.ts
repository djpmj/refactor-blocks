import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function resolveTutorialMethod(page: Page) {
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  const checks = page.getByRole('checkbox');
  await checks.nth(0).check();
  await checks.nth(1).check();
  await page.getByLabel('新しいメソッド名').fill('summarizeSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('点数が変わらない名前変更では演出しない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  const method = page.getByTestId('method-printMonthlyReport');
  await method.dblclick();
  const name = method.getByLabel('メソッド名');

  // Act
  await name.fill('printMonthlyReportRenamed');
  await name.press('Enter');

  // Assert
  await expect(page.getByTestId('score-announcement')).toHaveText('90点');
  await expect(page.getByTestId('score-ring')).not.toHaveClass(/score-badge__ring--celebrate/);
  await expect(page.getByTestId('method-printMonthlyReportRenamed')).not.toHaveClass(/method-chip-button--resolved/);
});

test('成功した操作では点数と解決したメソッドを演出し、Undoとリセットは演出しない', async ({ page }) => {
  // Arrange
  await resolveTutorialMethod(page);
  const ring = page.getByTestId('score-ring');
  const method = page.getByTestId('method-printMonthlyReport');

  // Assert
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await expect(ring).toHaveClass(/score-badge__ring--perfect/);
  await expect(method).toHaveClass(/method-chip-button--resolved/);

  // Act: カウントアップ中に Undo する
  await page.getByRole('button', { name: '元に戻す' }).click();

  // Assert
  await expect(page.getByTestId('score-announcement')).toHaveText('90点');
  await expect(page.getByTestId('score-value')).toHaveText('90点');
  await expect(ring).not.toHaveClass(/score-badge__ring--celebrate/);
  await expect(method).not.toHaveClass(/method-chip-button--resolved/);

  // Act: Redoで同じ点数に戻っても、古い celebration を再生しない
  await page.getByTitle('Ctrl+Y').click();

  // Assert
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await expect(page.getByTestId('score-value')).toHaveText('100点');
  await expect(ring).not.toHaveClass(/score-badge__ring--celebrate/);
  await expect(method).not.toHaveClass(/method-chip-button--resolved/);

  // Act: リセットしても、初期状態への戻しを成功演出として扱わない
  await page.getByRole('button', { name: '最初に戻す' }).click();

  // Assert
  await expect(page.getByTestId('score-announcement')).toHaveText('90点');
  await expect(ring).not.toHaveClass(/score-badge__ring--celebrate/);
});

test('ステージ切り替えは以前の celebration を表示しない', async ({ page }) => {
  // Arrange
  await resolveTutorialMethod(page);
  await expect(page.getByTestId('method-printMonthlyReport')).toHaveClass(/method-chip-button--resolved/);

  // Act
  await selectStage(page, 'チュートリアル2: 太った placeOrder');

  // Assert
  await expect(page.getByTestId('score-ring')).not.toHaveClass(/score-badge__ring--celebrate/);
  await expect(page.getByTestId('score-value')).toHaveText(await page.getByTestId('score-announcement').innerText());

  // Act: 解決した元ステージへ戻っても古い対象を再表示しない
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');

  // Assert
  await expect(page.getByTestId('score-ring')).not.toHaveClass(/score-badge__ring--celebrate/);
  await expect(page.getByTestId('method-printMonthlyReport')).not.toHaveClass(/method-chip-button--resolved/);
});

test('通常の操作で点数が下がるときは即時更新し成功演出を出さない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await expect(page.getByTestId('score-announcement')).toHaveText('70点');

  // Act: 空クラスを追加して通常操作で違反を増やす
  await page.getByTestId('method-placeOrder').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'このファイルにクラスを追加' }).click();
  await menu.getByLabel('追加するクラス名').fill('EmptyClass');
  await menu.getByRole('button', { name: '追加' }).click();

  // Assert
  await expect(page.getByTestId('class-EmptyClass')).toBeVisible();
  await expect(page.getByTestId('score-announcement')).toHaveText('60点');
  await expect(page.getByTestId('score-value')).toHaveText('60点');
  await expect(page.getByTestId('score-ring')).not.toHaveClass(/score-badge__ring--celebrate/);
});

test('reduced motion では点数は即時更新し、解決したメソッドには静的な緑の縁取りを出す', async ({ page }) => {
  // Arrange
  await page.emulateMedia({ reducedMotion: 'reduce' });

  // Act
  await resolveTutorialMethod(page);

  // Assert
  const ring = page.getByTestId('score-ring');
  const method = page.getByTestId('method-printMonthlyReport');
  await expect(page.getByTestId('score-value')).toHaveText('100点');
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await expect(ring).not.toHaveClass(/score-badge__ring--celebrate/);
  await expect(method).toHaveClass(/method-chip-button--resolved/);
  await expect(method.locator('.method-chip')).toHaveCSS('animation-name', 'none', { timeout: 500 });
  await expect(method.locator('.method-chip')).toHaveCSS('outline-color', 'rgb(46, 158, 106)', { timeout: 500 });
});
