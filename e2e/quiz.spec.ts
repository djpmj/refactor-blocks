import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

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

test('答える前は設計Bに空のクラスも赤枠も出ず、答えたあとに赤枠が出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  const designB = page.getByTestId('quiz-design-b');

  // Assert: 答える前
  await expect(designB).toContainText('登録・保存・メール送信を UserController にまとめた設計');
  await expect(designB.getByTestId('preview-class-UserRepository')).toHaveCount(0);
  await expect(designB.getByTestId('preview-class-Mailer')).toHaveCount(0);
  await expect(page.getByTestId('quiz-design-a').locator('.method-chip--over')).toHaveCount(0);
  await expect(designB.locator('.method-chip--over')).toHaveCount(0);

  // Act
  await page.getByTestId('quiz-choose-a').click();

  // Assert: 答えたあと
  await expect(designB.locator('.method-chip--over').first()).toBeVisible();
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
  await expect(verdict).toHaveClass(/quiz__verdict--correct/);
  await expect(verdict.locator('.answer-verdict')).toHaveCSS('color', 'rgb(23, 107, 68)');
  await expect(verdict.locator('.answer-verdict__label')).toHaveCSS('font-weight', '700');
  await expect(verdict.locator('.answer-verdict__confetti .answer-verdict__piece')).toHaveCount(8);
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
  await expect(page.getByTestId('quiz-verdict')).toHaveClass(/quiz__verdict--incorrect/);
  await expect(page.getByTestId('quiz-verdict').locator('.answer-verdict')).toHaveCSS('color', 'rgb(166, 31, 31)');
  await expect(page.getByTestId('quiz-verdict').locator('.answer-verdict__confetti')).toHaveCount(0);
});

test('ダークテーマでも正誤の文字色に十分なコントラストがあり、判定文が太字になる', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await page.getByTestId('quiz-choose-a').click();
  const correctLabel = page.getByTestId('quiz-verdict').locator('.answer-verdict__label');
  await expect(correctLabel).toHaveCSS('color', 'rgb(117, 227, 176)');
  await expect(correctLabel).toHaveCSS('font-weight', '700');

  await page.getByTestId('quiz-next').click();
  await page.getByTestId('quiz-choose-a').click();
  await expect(page.getByTestId('quiz-verdict').locator('.answer-verdict')).toHaveCSS('color', 'rgb(255, 138, 138)');
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
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
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

/** 1問目はわざと間違え(B)、残りは A を選んで最後の問題まで進む(最後の問題は答えたところで止まる)。 */
async function answerAllFirstWrong(page: Page) {
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  for (let question = 0; question < 3; question += 1) {
    await page.getByTestId(question === 0 ? 'quiz-choose-b' : 'quiz-choose-a').click();
    await page.getByTestId('quiz-next').click();
  }
  await page.getByTestId('quiz-choose-a').click();
}

test('4問とも答えて「結果を見る」を押すと、N問中M問正解と不正解の問題の一覧が出る', async ({ page }) => {
  // Arrange
  await answerAllFirstWrong(page);

  // Act
  await page.getByRole('button', { name: '結果を見る' }).click();

  // Assert
  const summary = page.getByTestId('quiz-summary');
  await expect(summary).toContainText(/4問中\d問正解/);
  await expect(summary.getByRole('button', { name: /問目:/ }).first()).toBeVisible();
});

test('答えていない問題があるまま「結果を見る」を押すと、まとめの代わりに未回答の問題を知らせる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await page.getByLabel('クイズ').selectOption({ index: 3 });
  await page.getByTestId('quiz-choose-a').click();

  // Act
  await page.getByRole('button', { name: '結果を見る' }).click();

  // Assert
  await expect(page.getByTestId('quiz-unanswered')).toContainText('まだ答えていない問題があります: 1問目');
  await expect(page.getByTestId('quiz-summary')).toHaveCount(0);
});

test('2問目に答えてから1問目へ戻り、また2問目を開くと、答えと解説が残っていて、プルダウンに(✓)か(✗)が付く', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await page.getByLabel('クイズ').selectOption({ index: 1 });
  await page.getByTestId('quiz-choose-a').click();
  await expect(page.getByTestId('quiz-verdict')).toBeVisible();

  // Act
  await page.getByLabel('クイズ').selectOption({ index: 0 });
  await expect(page.getByTestId('quiz-verdict')).toHaveCount(0);
  await page.getByLabel('クイズ').selectOption({ index: 1 });

  // Assert
  await expect(page.getByTestId('quiz-verdict')).toBeVisible();
  await expect(page.getByTestId('quiz-choose-a')).toBeDisabled();
  await expect(page.getByLabel('クイズ').locator('option').nth(1)).toHaveText(/\((✓|✗)\)$/);
  await expect(page.getByLabel('クイズ').locator('option').nth(0)).not.toHaveText(/\(/);
});

test('「もう一度解く」で、すべての答えが消えて1問目に戻る', async ({ page }) => {
  // Arrange
  await answerAllFirstWrong(page);
  await page.getByRole('button', { name: '結果を見る' }).click();

  // Act
  await page.getByRole('button', { name: 'もう一度解く' }).click();

  // Assert
  await expect(page.getByRole('heading', { name: /^1問目/ })).toBeVisible();
  await expect(page.getByTestId('quiz-verdict')).toHaveCount(0);
  await expect(page.getByLabel('クイズ').locator('option').filter({ hasText: /\(/ })).toHaveCount(0);
  await page.getByLabel('クイズ').selectOption({ index: 3 });
  await expect(page.getByTestId('quiz-verdict')).toHaveCount(0);
});

test('まとめの「リファクタリングに戻る」「白紙設計に挑戦する」でモードが切り替わる', async ({ page }) => {
  // Arrange
  await answerAllFirstWrong(page);
  await page.getByRole('button', { name: '結果を見る' }).click();

  // Act
  await page.getByRole('button', { name: 'リファクタリングに戻る' }).click();

  // Assert
  await expect(page.getByTestId('mode-refactor')).toHaveAttribute('aria-pressed', 'true');

  // Act
  await page.getByTestId('mode-quiz').click();
  await page.getByRole('button', { name: '白紙設計に挑戦する' }).click();

  // Assert
  await expect(page.getByTestId('mode-blank')).toHaveAttribute('aria-pressed', 'true');
});
