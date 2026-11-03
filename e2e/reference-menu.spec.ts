import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('参考メニューは9個のツールバー操作の1つにまとまり、変更前の図を確認なしで開く', async ({ page }) => {
  await page.goto('/');
  const toolbar = page.locator('.toolbar');
  await expect(toolbar.getByRole('button')).toHaveCount(9);

  const menuButton = page.getByTestId('reference-menu-button');
  await menuButton.focus();
  await page.keyboard.press('Enter');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('reference-before')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuButton).toBeFocused();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

  await menuButton.click();
  await page.getByTestId('reference-before').click();
  await expect(page.getByTestId('answer-confirm')).not.toBeVisible();
  await expect(page.getByTestId('codebase-preview')).toBeVisible();
});

test('答えの前に問題ヒント、次の一手の順に開き、同じステージでは次から確認せず、ステージ変更後は再確認する', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '中級1: 循環依存を断ち切る', { completeOpeningFix: false });
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  const confirmation = page.getByTestId('answer-confirm');
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole('heading', { name: '答えを見ますか?' })).toBeVisible();
  await expect(confirmation).toContainText('ヒントはあと 5 個あります');
  await expect(confirmation.getByRole('button').first()).toBeFocused();
  await confirmation.getByRole('button', { name: 'ヒントを見る' }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(page.getByTestId('codebase-preview')).not.toBeVisible();
  const problemText = page.getByTestId('hint-problem-text');
  await expect(problemText).toContainText('いちばん大きい減点: 循環依存(-20点)');
  await expect(problemText).toContainText('AがBを、BがAを呼んでいると、片方を直すともう片方も直すことになり、どちらも単独でテスト・再利用できません。');
  await expect(problemText).not.toContainText('Move Method');
  await expect(page.getByTestId('class-Order')).toHaveClass(/class-node--flagged/);
  await expect(page.getByTestId('class-Customer')).toHaveClass(/class-node--flagged/);
  await expect(page.locator('.react-flow__edge.edge--cyclic')).toHaveCount(2);
  await expect(page.locator('.stage-panel__hint-list li')).toHaveCount(0);
  await expect(page.getByTestId('hint-popover')).toBeVisible();
  await expect(page.getByTestId('hint-popover').getByRole('button').first()).toBeFocused();

  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'ヒントを見る' }).click();
  await expect(confirmation).not.toBeVisible();
  const nextStep = page.locator('.stage-panel__hint-list li');
  await expect(nextStep).toHaveCount(1);
  await expect(nextStep.first()).toContainText('calculateOrderTotal をMove Methodで Order へ移そう');

  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: '答えを見る' }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(page.getByTestId('codebase-preview')).toBeVisible();
  await page.getByTestId('codebase-preview').getByRole('button', { name: '閉じる' }).click();

  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  await expect(confirmation).not.toBeVisible();
  await expect(page.getByTestId('codebase-preview')).toBeVisible();
  await page.getByTestId('codebase-preview').getByRole('button', { name: '閉じる' }).click();

  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  await expect(confirmation).toBeVisible();
});

test('メニューは矢印キーで移動・選択でき、未登録の答えは無効で、確認ダイアログはEscで閉じる', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '上級1: 通知クラスの共通処理を基底クラスへ集める');
  const menuButton = page.getByTestId('reference-menu-button');
  await menuButton.click();
  const before = page.getByTestId('reference-before');
  const sample = page.getByTestId('reference-sample');
  const replay = page.getByTestId('reference-replay');

  await expect(before).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(sample).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuButton).toBeFocused();

  await page.evaluate(async () => {
    const modulePath: string = '/src/domain/stage/sampleAnswer.ts';
    const answers = await import(modulePath);
    delete answers.sampleAnswerSteps['advanced-notifier-hierarchy'];
  });
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await selectStage(page, '上級1: 通知クラスの共通処理を基底クラスへ集める');
  await menuButton.click();
  await expect(sample).toHaveAttribute('aria-disabled', 'true');
  await expect(sample).toHaveAttribute('title', 'このステージには解答例が未登録です');
  await expect(replay).toHaveAttribute('aria-disabled', 'true');
  await expect(replay).toHaveAttribute('title', 'このステージには解答例が未登録です');
  await expect(before).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuButton).toBeFocused();

  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await menuButton.click();
  await page.getByTestId('reference-replay').click();
  const confirmation = page.getByTestId('answer-confirm');
  await expect(confirmation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmation).not.toBeVisible();
  await expect(menuButton).toBeFocused();
});

test('解答例プレビュー内のArrowDownはメニューに妨げられない', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-sample').click();
  await page.getByTestId('answer-confirm').getByRole('button', { name: '答えを見る' }).click();

  const preview = page.getByTestId('codebase-preview');
  const previewButton = preview.getByTestId('codebase-preview-maximize');
  await expect(previewButton).toBeFocused();
  await page.evaluate("document.addEventListener('keydown', event => { if (event.key === 'ArrowDown') document.documentElement.dataset.arrowDownPrevented = String(event.defaultPrevented); }, { once: true })");
  await page.keyboard.press('ArrowDown');

  await expect(page.locator('html')).toHaveAttribute('data-arrow-down-prevented', 'false');
});

test('runtime を持つステージでは、メニューから C# プロジェクトの zip をダウンロードできる', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける', { completeOpeningFix: false });
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId('reference-source-download').click();
  const dialog = page.getByTestId('source-download-dialog');
  await expect(dialog).toContainText('Visual Studio');

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByTestId('source-download-confirm').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('tutorial-extract-method.zip');
  await expect(dialog).not.toBeVisible();
});

const runtimeStages = [
  ['チュートリアル2: 太った placeOrder', 'tutorial-order-service'],
  ['ドリル1: 後ろのまとまりを抜き出す', 'drill-extract-tail'],
  ['ドリル2: 途中のまとまりを抜き出す', 'drill-extract-middle'],
  ['ドリル3: メソッドを持ち主のクラスへ移す', 'drill-move-method'],
  ['初級1: 何でも屋の UserController', 'beginner-user-controller'],
  ['初級2: クラスを自分で作る', 'beginner-invoice-service'],
  ['中級1: 循環依存を断ち切る', 'intermediate-cyclic-dependency'],
  ['中級2: 何でも入った1つのファイル', 'intermediate-god-file'],
  ['中級3: 越境する private メソッド', 'intermediate-misplaced-private'],
  ['中級4: 変わるのは税の計算', 'intermediate-volatile-tax'],
  ['中級5: 変わるのは帳票の形式', 'intermediate-volatile-format'],
  ['中級6: 他人のデータばかり触るメソッド', 'intermediate-feature-envy'],
  ['中級7: getter/setter だけの口座クラス', 'intermediate-anemic-domain-model'],
  ['中級8: 給与と住所を抱えた社員クラス', 'intermediate-extract-class'],
  ['中級9: コピペされた消費税計算を1か所にまとめる', 'intermediate-copy-paste-tax'],
  ['中級10: 会員ランクごとのif分岐をクラスに分ける', 'intermediate-member-rank-branching'],
  ['中級11: Controller に全部書いてある注文API', 'intermediate-layered-order-api'],
  ['中級12: 横流しするだけの OrderManager', 'intermediate-middle-man'],
] as const;

for (const [title, stageId] of runtimeStages) {
  test(`${title} でも、メニューから C# プロジェクトの zip をダウンロードできる`, async ({ page }) => {
    await page.goto('/');
    await selectStage(page, title, { completeOpeningFix: false });
    await page.getByTestId('reference-menu-button').click();
    await page.getByTestId('reference-source-download').click();
    const dialog = page.getByTestId('source-download-dialog');

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByTestId('source-download-confirm').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`${stageId}.zip`);
  });
}

test('runtime の無いステージでは、メニューに C# のダウンロードが出ない', async ({ page }) => {
  await page.goto('/');
  await selectStage(page, '上級1: 通知クラスの共通処理を基底クラスへ集める', { completeOpeningFix: false });
  await page.getByTestId('reference-menu-button').click();
  await expect(page.getByTestId('reference-before')).toBeVisible();
  await expect(page.getByTestId('reference-source-download')).toHaveCount(0);
});

type DraftMethod = { id: string; name?: string; visibility?: string; fragments?: object[] };
type DraftClass = { methods: DraftMethod[] };
type DraftStore = Record<string, { codebase: { files: { classes: DraftClass[] }[] } }>;

test('別クラスの private を使う状態では、ダイアログに「ビルドが通らない箇所」が出ても、キーボードだけでダウンロードできる', async ({ page }) => {
  // Arrange: 抽出で2クラスにしたあと、下書きを書き換えて「別クラスの private メソッドを呼ぶ」状態にする
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  const source = await page.getByTestId('method-printMonthlyReport').boundingBox();
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (source === null || pane === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 20, pane.y + pane.height - 20, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator('.class-node')).toHaveCount(2);
  await page.evaluate(() => {
    const drafts: DraftStore = JSON.parse(localStorage.getItem('refactor-blocks:drafts') ?? '{}');
    for (const draft of Object.values(drafts)) {
      const classes = draft.codebase.files.flatMap((file) => file.classes);
      const owner = classes.find((codeClass) => codeClass.methods.some((method) => method.id === 'method-print-monthly-report'));
      const caller = classes.find((codeClass) => codeClass !== owner);
      const target = owner?.methods.find((method) => method.id === 'method-print-monthly-report');
      if (owner === undefined || caller === undefined || target === undefined) throw new Error('下書きの形が想定と違います');
      target.visibility = 'private';
      caller.methods.push({ id: 'method-caller', name: 'run', visibility: 'public', fragments: [{ id: 'frag-caller', label: '呼ぶ', lines: 1, responsibility: 'output', uses: ['method-print-monthly-report'], code: { csharp: 'printMonthlyReport();' } }] });
    }
    localStorage.setItem('refactor-blocks:drafts', JSON.stringify(drafts));
  });
  await page.reload();
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');

  // Act: 開いて、Esc で閉じて、もう一度開く
  const menuButton = page.getByTestId('reference-menu-button');
  await menuButton.click();
  await page.getByTestId('reference-source-download').click();
  const dialog = page.getByTestId('source-download-dialog');
  await expect(dialog.getByTestId('source-download-issues')).toContainText('1件');
  await expect(dialog).toContainText('printMonthlyReport(private)');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await menuButton.click();
  await page.getByTestId('reference-source-download').click();

  // Assert: 開いた直後は「ダウンロードする」にフォーカスがあり、Tab / Shift+Tab で「やめる」と行き来でき、Enter で問題があってもダウンロードできる
  await expect(dialog.getByTestId('source-download-confirm')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'やめる' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByTestId('source-download-confirm')).toBeFocused();
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  expect((await downloadPromise).suggestedFilename()).toBe('tutorial-extract-method.zip');
  await expect(dialog).not.toBeVisible();
});
