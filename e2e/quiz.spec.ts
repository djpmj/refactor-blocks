import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

/** 設計(1段目)を選び、理由(2段目)を添字で選んで「答える」まで進める。 */
async function answerQuiz(page: Page, design: 'a' | 'b', reason = 0) {
  await page.getByTestId(`quiz-choose-${design}`).click();
  await page.getByTestId('quiz-reason').getByRole('radio').nth(reason).check();
  await page.getByTestId('quiz-reason-submit').click();
}

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

  // Act: 設計だけ選んだ段階ではまだ出ない
  await page.getByTestId('quiz-choose-a').click();
  await expect(designB.locator('.method-chip--over')).toHaveCount(0);
  await page.getByTestId('quiz-reason').getByRole('radio').nth(1).check();
  await page.getByTestId('quiz-reason-submit').click();

  // Assert: 答えたあと
  await expect(designB.locator('.method-chip--over').first()).toBeVisible();
});

test('変更が楽な設計を選ぶと正解になり、それぞれの設計の点数と理由が出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();

  // Act
  await answerQuiz(page, 'a', 1);

  // Assert
  const verdict = page.getByTestId('quiz-verdict');
  await expect(verdict).toContainText('⭕ 正解!');
  await expect(verdict).toContainText('解説:');
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
  await answerQuiz(page, 'b');

  // Assert
  await expect(page.getByTestId('quiz-verdict')).toContainText('❌ 不正解(楽なのは設計A)');
  await expect(page.getByTestId('quiz-verdict')).toHaveClass(/quiz__verdict--incorrect/);
  await expect(page.getByTestId('quiz-verdict').locator('.answer-verdict')).toHaveCSS('color', 'rgb(166, 31, 31)');
  await expect(page.getByTestId('quiz-verdict').locator('.answer-verdict__confetti')).toHaveCount(0);
});

test('ダークテーマでも正誤の文字色に十分なコントラストがあり、判定文が太字になる', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await answerQuiz(page, 'a', 1);
  const correctLabel = page.getByTestId('quiz-verdict').locator('.answer-verdict__label');
  await expect(correctLabel).toHaveCSS('color', 'rgb(117, 227, 176)');
  await expect(correctLabel).toHaveCSS('font-weight', '700');

  await page.getByTestId('quiz-next').click();
  await answerQuiz(page, 'a');
  await expect(page.getByTestId('quiz-verdict').locator('.answer-verdict')).toHaveCSS('color', 'rgb(255, 138, 138)');
});

test('「次のクイズへ」で2問目に進み、回答がリセットされる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await answerQuiz(page, 'a', 1);

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

  // Assert: 1段目を押したあと、フォーカスが理由の欄に移る
  await expect(page.getByTestId('quiz-reason')).toBeFocused();

  // Act: 理由のラジオ(矢印キー)→「答える」
  await page.getByTestId('quiz-reason').getByRole('radio').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('quiz-reason').getByRole('radio').nth(1)).toBeChecked();
  await page.getByTestId('quiz-reason-submit').focus();
  await page.keyboard.press('Enter');

  // Assert
  await expect(page.getByTestId('quiz-verdict')).toContainText('正解');
});

test('設計だけ選ぶと、理由の3択が出て、判定・警告色はまだ出ず、A・Bのボタンは無効でAが押された状態になる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();

  // Act
  await page.getByTestId('quiz-choose-a').click();

  // Assert
  await expect(page.getByTestId('quiz-reason').getByRole('radio')).toHaveCount(3);
  await expect(page.getByTestId('quiz-verdict')).toHaveCount(0);
  await expect(page.getByTestId('quiz-choose-a')).toBeDisabled();
  await expect(page.getByTestId('quiz-choose-b')).toBeDisabled();
  await expect(page.getByTestId('quiz-choose-a')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('quiz-reason-submit')).toBeDisabled();
  await page.getByTestId('quiz-reason').getByRole('radio').first().check();
  await expect(page.getByTestId('quiz-reason-submit')).toBeEnabled();
});

test('設計は合っていても理由がちがうと不正解になり、選んだ理由と正解の理由の解説が出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();

  // Act
  await answerQuiz(page, 'a', 0);

  // Assert
  const verdict = page.getByTestId('quiz-verdict');
  await expect(verdict).toContainText('設計は合っているが、理由がちがう');
  await expect(verdict).toContainText('あなたの理由について:');
  await expect(verdict).toContainText('正解の理由:');
  await expect(verdict).toHaveClass(/quiz__verdict--incorrect/);
});

test('設計だけ選んで別の問題へ移ると、戻ったときに1段目から答え直せる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await page.getByTestId('quiz-choose-a').click();

  // Act
  await page.getByLabel('クイズ').selectOption({ index: 1 });
  await page.getByLabel('クイズ').selectOption({ index: 0 });

  // Assert
  await expect(page.getByTestId('quiz-choose-a')).toBeEnabled();
  await expect(page.getByTestId('quiz-choose-b')).toBeEnabled();
  await expect(page.getByTestId('quiz-reason')).toHaveCount(0);
});

test('答え済みの問題を開き直すと、選んだ理由にチェックが付いたまま、判定と解説が出ている', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await answerQuiz(page, 'a', 2);

  // Act
  await page.getByLabel('クイズ').selectOption({ index: 1 });
  await page.getByLabel('クイズ').selectOption({ index: 0 });

  // Assert
  await expect(page.getByTestId('quiz-reason').getByRole('radio').nth(2)).toBeChecked();
  await expect(page.getByTestId('quiz-reason').getByRole('radio').nth(2)).toBeDisabled();
  await expect(page.getByTestId('quiz-verdict')).toContainText('あなたの理由について:');
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
  await answerQuiz(page, 'a');
  await page.getByTestId('quiz-next').click();
  await answerQuiz(page, 'b');

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

async function previewScale(page: Page, choice: 'a' | 'b'): Promise<number> {
  const transform = await page.getByTestId(`quiz-design-${choice}`).locator('.react-flow__viewport').getAttribute('style');
  const match = /scale\(([\d.]+)\)/.exec(transform ?? '');
  return Number(match?.[1] ?? 'NaN');
}

for (const questionNumber of [1, 2, 3, 4, 5, 6, 7, 8]) {
  test(`設計くらべ${questionNumber}問目は、設計A・Bのプレビューが同じ縮尺で、読める大きさになっている`, async ({ page }) => {
    // Arrange
    await page.goto('/');
    await page.getByTestId('mode-quiz').click();

    // Act
    await page.getByLabel('クイズ').selectOption({ index: questionNumber - 1 });

    // Assert
    await expect.poll(async () => (await previewScale(page, 'a')) - (await previewScale(page, 'b'))).toBeCloseTo(0, 5);
    expect(await previewScale(page, 'a')).toBeGreaterThanOrEqual(0.6 - 1e-6);
  });
}

/** 1問目はわざと間違え(B)、残りは A を選んで最後の問題まで進む(最後の問題は答えたところで止まる)。 */
async function answerAllFirstWrong(page: Page) {
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  for (let question = 0; question < 7; question += 1) {
    await answerQuiz(page, question === 0 ? 'b' : 'a');
    await page.getByTestId('quiz-next').click();
  }
  await answerQuiz(page, 'a');
}

test('8問とも答えて「結果を見る」を押すと、N問中M問正解と不正解の問題の一覧が出る', async ({ page }) => {
  // Arrange
  await answerAllFirstWrong(page);

  // Act
  await page.getByRole('button', { name: '結果を見る' }).click();

  // Assert
  const summary = page.getByTestId('quiz-summary');
  await expect(summary).toContainText(/8問中\d問正解/);
  await expect(summary.getByRole('button', { name: /問目:/ }).first()).toBeVisible();
});

test('5問目で設計は正解・理由は誤答のとき、プルダウンに(✗)が付き、まとめの不正解の一覧に5問目が出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  for (let question = 0; question < 8; question += 1) {
    await page.getByLabel('クイズ').selectOption({ index: question });
    await answerQuiz(page, 'a', question === 4 ? 0 : 2);
  }

  // Act
  await expect(page.getByLabel('クイズ').locator('option').nth(4)).toHaveText(/\(✗\)$/);
  await page.getByRole('button', { name: '結果を見る' }).click();

  // Assert
  await expect(page.getByTestId('quiz-summary').getByRole('button', { name: /^5問目:/ })).toBeVisible();
});

test('答えていない問題があるまま「結果を見る」を押すと、まとめの代わりに未回答の問題を知らせる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await page.getByLabel('クイズ').selectOption({ index: 7 });
  await answerQuiz(page, 'a');

  // Act
  await page.getByRole('button', { name: '結果を見る' }).click();

  // Assert
  await expect(page.getByTestId('quiz-unanswered')).toContainText('まだ答えていない問題があります: 1問目');
  await expect(page.getByTestId('quiz-summary')).toHaveCount(0);
});

test('5問目で設計Aを選ぶと、正解になる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await page.getByLabel('クイズ').selectOption({ index: 4 });

  // Act
  await answerQuiz(page, 'a', 2);

  // Assert
  await expect(page.getByTestId('quiz-verdict')).toContainText('楽なのは設計A');
  await expect(page.getByTestId('quiz-verdict')).toContainText('正解');
  await expect(page.getByTestId('quiz-verdict')).not.toContainText('不正解');
});

test('2問目に答えてから1問目へ戻り、また2問目を開くと、答えと解説が残っていて、プルダウンに(✓)か(✗)が付く', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await page.getByLabel('クイズ').selectOption({ index: 1 });
  await answerQuiz(page, 'a');
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

const QUIZ_KEY = 'refactor-blocks:quiz-record';
/** 各問の正解の設計と理由の添字(comparisonQuizzes の順)。 */
const CORRECT_ANSWERS: readonly (readonly ['a' | 'b', number])[] = [['a', 1], ['b', 0], ['a', 2], ['b', 1], ['a', 2], ['b', 0], ['a', 2], ['b', 1]];

/** 読み込み直してから設計くらべの1問目だけに答える。 */
async function answerFirstQuiz(page: Page, correct: boolean) {
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  await answerQuiz(page, correct ? 'a' : 'b', correct ? 1 : 0);
}

/** 読み込み直してリファクタリングモードのステージ一覧を開き、設計くらべの行の文言を返す。 */
async function roadmapQuizText(page: Page): Promise<string | null> {
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();
  return page.getByTestId('roadmap-quiz').textContent();
}

test('1問目で正解すると、読み込み直したステージ一覧に設計くらべの正答数が出る', async ({ page }) => {
  // Arrange
  await answerFirstQuiz(page, true);

  // Act
  const text = await roadmapQuizText(page);

  // Assert
  expect(text).toBe('設計くらべ: 8問中1問正解');
});

test('不正解は0問正解、一度正解した問題はあとでまちがえても正解のまま', async ({ page }) => {
  // Arrange・Act・Assert
  await answerFirstQuiz(page, false);
  expect(await roadmapQuizText(page)).toBe('設計くらべ: 8問中0問正解');
  await answerFirstQuiz(page, true);
  expect(await roadmapQuizText(page)).toBe('設計くらべ: 8問中1問正解');
  await answerFirstQuiz(page, false);
  expect(await roadmapQuizText(page)).toBe('設計くらべ: 8問中1問正解');
});

test('全問正解するとステージ一覧に ✅ が付き、「もう一度解く」でも記録は消えず、おすすめも変わらない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();
  const nextBefore = await page.getByTestId('roadmap-next').textContent();
  await page.getByRole('button', { name: '閉じる' }).click();
  await page.getByTestId('mode-quiz').click();
  for (const [index, [design, reason]] of CORRECT_ANSWERS.entries()) {
    await page.getByLabel('クイズ').selectOption({ index });
    await answerQuiz(page, design, reason);
  }

  // Act
  await page.getByRole('button', { name: '結果を見る' }).click();
  await page.getByTestId('quiz-retry').click();

  // Assert
  await page.getByTestId('mode-refactor').click();
  await page.getByTestId('roadmap-open').click();
  await expect(page.getByTestId('roadmap-quiz')).toHaveText('設計くらべ: 8問中8問正解 ✅');
  await expect(page.getByTestId('roadmap-next')).toHaveText(nextBefore ?? '');
});

test('記録の JSON が壊れていても、画面は壊れず未挑戦と出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.setItem(key, '{broken');
  }, QUIZ_KEY);

  // Act・Assert
  expect(await roadmapQuizText(page)).toBe('設計くらべ: 未挑戦');
});
