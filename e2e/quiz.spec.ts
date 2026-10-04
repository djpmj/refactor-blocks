import { expect, test, type Page } from '@playwright/test';

test('「設計くらべ」に切り替えると、1問目の設計A・Bが表示される', async ({ page }) => {
  // Arrange
  await page.goto('/');

  // Act
  await page.getByTestId('mode-quiz').click();

  // Assert
  await expect(page.getByTestId('quiz-design-a').getByTestId('preview-class-Mailer')).toBeVisible();
  await expect(page.getByTestId('quiz-design-b').getByTestId('preview-class-UserController')).toBeVisible();
  await expect(page.locator('.preview-file-node__path, .file-node__path')).toHaveCount(0);
  await expect(page.getByTestId('quiz-design-a')).not.toContainText('.ts');
  await expect(page.getByTestId('quiz-design-b')).not.toContainText('.ts');
});

test('変更が楽な設計を選ぶと正解になり、それぞれの設計の点数と理由が出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();

  // Act
  await page.getByTestId('quiz-choose-a').click();

  // Assert
  const verdict = page.getByTestId('quiz-verdict');
  await expect(verdict).toContainText('正解');
  await expect(verdict).not.toContainText('不正解');
  await expect(page.getByTestId('quiz-result-a')).toContainText('点');
  await expect(page.getByTestId('quiz-result-b')).toContainText('巻き込み');
  await expect(page.getByTestId('quiz-choose-b')).toBeDisabled();
});

test('変更が大変な設計を選ぶと不正解になる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();

  // Act
  await page.getByTestId('quiz-choose-b').click();

  // Assert
  await expect(page.getByTestId('quiz-verdict')).toContainText('不正解');
});

test('「次のクイズへ」で2問目に進み、回答がリセットされる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await page.getByTestId('quiz-choose-a').click();

  // Act
  await page.getByTestId('quiz-next').click();

  // Assert
  await expect(page.getByRole('heading', { name: '2問目: 税の計算ルールが変わるなら' })).toBeVisible();
  await expect(page.getByTestId('quiz-verdict')).toHaveCount(0);
  await expect(page.getByTestId('quiz-choose-a')).toBeEnabled();
});

test('キーボードだけでモードを切り替えて回答できる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').focus();

  // Act
  await page.keyboard.press('Enter');
  await page.getByTestId('quiz-choose-a').focus();
  await page.keyboard.press('Enter');

  // Assert
  await expect(page.getByTestId('quiz-verdict')).toContainText('正解');
});

/** チュートリアル2で税の計算を抽出する(リファクタリング側の状態を作る)。 */
async function extractTax(page: Page) {
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル2: 太った placeOrder' });
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel('消費税を計算する(軽減税率あり)').check();
  await page.getByLabel('新しいメソッド名').fill('calculateTax');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('リファクタリングに戻ると、切り替える前に操作したコードベースが残っていて、Ctrl+Zで1手戻せる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await extractTax(page);
  const calculateTax = page.getByTestId('class-OrderService').getByTestId('method-calculateTax');

  // Act
  await page.getByTestId('mode-quiz').click();
  await page.getByTestId('mode-refactor').click();

  // Assert
  await expect(calculateTax).toBeVisible();

  // Act: 履歴も残っている
  await page.keyboard.press('Control+z');

  // Assert
  await expect(calculateTax).toHaveCount(0);
});

test('設計くらべの間は、Ctrl+Zでリファクタリングの操作が戻らない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await extractTax(page);
  await page.getByTestId('mode-quiz').click();

  // Act
  await page.keyboard.press('Control+z');
  await page.getByTestId('mode-refactor').click();

  // Assert
  await expect(page.getByTestId('class-OrderService').getByTestId('method-calculateTax')).toBeVisible();
});

test('リファクタリングへ行って戻っても、クイズの何問目か・回答が残っている', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await page.getByTestId('quiz-choose-a').click();
  await page.getByTestId('quiz-next').click();
  await page.getByTestId('quiz-choose-b').click();

  // Act
  await page.getByTestId('mode-refactor').click();
  await page.getByTestId('mode-quiz').click();

  // Assert
  await expect(page.getByRole('heading', { name: '2問目: 税の計算ルールが変わるなら' })).toBeVisible();
  await expect(page.getByTestId('quiz-verdict')).toContainText('楽なのは設計B');
  await expect(page.getByTestId('quiz-verdict')).not.toContainText('不正解');
});

test('右クリックメニューを開いたままキーボードで設計くらべに切り替えると、メニューが閉じる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('class-ReportService').click({ button: 'right' });
  await expect(page.getByTestId('context-menu')).toBeVisible();

  // Act
  await page.getByTestId('mode-quiz').focus();
  await page.keyboard.press('Enter');

  // Assert
  await expect(page.getByTestId('context-menu')).toHaveCount(0);
});
