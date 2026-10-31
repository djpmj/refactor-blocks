import { expect, test, type Page } from '@playwright/test';

async function clearIntroSeen(page: Page, kind: 'quiz' | 'blank'): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
  }, `refactor-blocks:mode-intro-seen:${kind}`);
}

test('設計くらべを初めて開くと3ステップのミニガイドが出て、終えると再び出ない', async ({ page }) => {
  // Arrange
  await clearIntroSeen(page, 'quiz');
  await page.goto('/');

  // Act
  await page.getByTestId('mode-quiz').click();

  // Assert
  const guide = page.getByTestId('mode-intro-guide');
  await expect(guide).toContainText('1/3');
  await expect(guide).toContainText('設計くらべでは、同じ機能を持つ2つの設計A・B');
  await expect(page.locator('.spotlight-tour__hole')).toBeVisible();
  await guide.getByRole('button', { name: '次へ' }).click();
  await guide.getByRole('button', { name: '次へ' }).click();
  await expect(guide).toContainText('3/3');
  await guide.getByRole('button', { name: '次へ' }).click();
  await expect(guide).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('refactor-blocks:mode-intro-seen:quiz'))).toBe('true');
  await page.getByTestId('mode-refactor').click();
  await page.getByTestId('mode-quiz').click();
  await expect(guide).toHaveCount(0);
});

test('白紙設計を初めて開くとミニガイドが出て、手順2・3で該当の場所を囲む', async ({ page }) => {
  // Arrange
  await clearIntroSeen(page, 'blank');
  await page.goto('/');

  // Act
  await page.getByTestId('mode-blank').click();

  // Assert
  const guide = page.getByTestId('mode-intro-guide');
  await expect(guide).toContainText('1/3');
  await expect(guide).toContainText('白紙設計では、要求文を読んで');
  await guide.getByRole('button', { name: '次へ' }).click();
  await expect(guide).toContainText('2/3');
  await expect(guide).toContainText('部品置き場にメソッドの部品が並んでいます');
  await guide.getByRole('button', { name: '次へ' }).click();
  await expect(guide).toContainText('3/3');
  await expect(guide).toContainText('「答え合わせ」が押せます');
});

test('ミニガイドは「ガイドを終了」で閉じ、開き直しても再び出ない', async ({ page }) => {
  // Arrange
  await clearIntroSeen(page, 'quiz');
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  const guide = page.getByTestId('mode-intro-guide');
  await expect(guide).toBeVisible();

  // Act
  await guide.getByRole('button', { name: 'ガイドを終了' }).click();

  // Assert
  await expect(guide).toHaveCount(0);
  await page.getByTestId('mode-refactor').click();
  await page.getByTestId('mode-quiz').click();
  await expect(guide).toHaveCount(0);
});

test('ミニガイドは Esc で閉じ、開き直しても再び出ない', async ({ page }) => {
  // Arrange
  await clearIntroSeen(page, 'blank');
  await page.goto('/');
  await page.getByTestId('mode-blank').click();
  const guide = page.getByTestId('mode-intro-guide');
  await expect(guide).toBeVisible();

  // Act
  await page.keyboard.press('Escape');

  // Assert
  await expect(guide).toHaveCount(0);
  await page.getByTestId('mode-refactor').click();
  await page.getByTestId('mode-blank').click();
  await expect(guide).toHaveCount(0);
});

test('ミニガイドの表示中に別のモードへ切り替えると閉じ、戻っても再び出ない', async ({ page }) => {
  // Arrange
  await clearIntroSeen(page, 'quiz');
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  const guide = page.getByTestId('mode-intro-guide');
  await expect(guide).toBeVisible();

  // Act
  // 暗幕が上に乗っているので、クリックイベントを直接送る
  await page.getByTestId('mode-refactor').dispatchEvent('click');

  // Assert
  await expect(guide).toHaveCount(0);
  await page.getByTestId('mode-quiz').click();
  await expect(guide).toHaveCount(0);
});

test('白紙設計の右パネルは、何も選んでいないときモードに合った案内を出す', async ({ page }) => {
  // Arrange
  await page.goto('/');

  // Act
  await page.getByTestId('mode-blank').click();

  // Assert
  const empty = page.getByTestId('blank-view').getByTestId('method-editor-empty');
  await expect(empty).toContainText('部品置き場の部品を、置きたいクラスへドラッグしよう');
  await expect(empty).not.toContainText('直したいメソッドをクリック');
  await page.getByTestId('mode-refactor').click();
  await expect(page.getByTestId('method-editor-empty').first()).toContainText('直したいメソッドをクリック');
});
