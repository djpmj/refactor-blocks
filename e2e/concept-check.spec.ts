import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

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
  await expect(page.getByTestId('score')).toContainText('100');
}

test('100点未満では出ず、100点で出る。キーボードで答えると解説が出て、もう一度で戻る', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await expect(page.getByRole('region', { name: '理解度チェック' })).toBeHidden();

  await clearTutorial2(page);
  const panel = page.getByRole('region', { name: '理解度チェック' });
  await expect(panel.getByRole('group')).toHaveCount(2);
  const answerButtons = panel.getByRole('button', { name: '答える' });
  await expect(answerButtons.first()).toBeDisabled();

  // 1問目: 不正解の選択肢(1番目)を選んで答える
  await panel.getByRole('group').first().getByRole('radio').first().check();
  await answerButtons.first().click();
  const first = panel.getByRole('group').first();
  await expect(first).toContainText('✗ 不正解(正解: 税率の変更が来ても');
  await expect(first.locator('.answer-verdict')).toHaveClass(/answer-verdict--incorrect/);
  await expect(first.locator('.answer-verdict')).toHaveCSS('color', 'rgb(166, 31, 31)');
  await expect(first.locator('.answer-verdict__confetti')).toHaveCount(0);
  await expect(first).toContainText('正解です。軽減税率のような変更');
  await expect(first.getByRole('radio').first()).toBeDisabled();

  // 2問目: キーボードだけで、正解(1番目)を選んで答える
  const second = panel.getByRole('group').nth(1);
  await second.getByRole('radio').first().focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(second).toContainText('✓ 正解');
  await expect(panel.getByTestId('check-summary')).toHaveText('2問中1問正解');
  await expect(panel.getByTestId('check-summary')).not.toHaveClass(/concept-check__summary--perfect/);

  await panel.getByRole('button', { name: 'もう一度' }).click();
  await expect(panel.getByTestId('check-summary')).toBeHidden();
  await expect(panel.getByRole('button', { name: '答える' })).toHaveCount(2);

  // 再回答ですべて正解すると、全問正解の演出が表示される
  const groups = panel.getByRole('group');
  for (const [index, group] of (await groups.all()).entries()) {
    await group.getByRole('radio').nth(index === 0 ? 2 : 0).check();
    await group.getByRole('button', { name: '答える' }).click();
  }
  await expect(panel.getByTestId('check-summary')).toHaveText('全問正解!(2問中2問正解)');
  await expect(panel.getByTestId('check-summary')).toHaveClass(/concept-check__summary--perfect/);
  await expect(panel.locator('.answer-verdict--correct')).toHaveCount(2);
  await expect(panel.locator('.answer-verdict--correct').first()).toHaveCSS('color', 'rgb(23, 107, 68)');
  await expect(panel.locator('.concept-check__perfect-confetti span')).toHaveCount(20);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('reduced motionでは判定・完全正解の動きを止め、紙吹雪を隠す', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await clearTutorial2(page);
  const panel = page.getByRole('region', { name: '理解度チェック' });
  const groups = panel.getByRole('group');
  for (const [index, group] of (await groups.all()).entries()) {
    await group.getByRole('radio').nth(index === 0 ? 2 : 0).check();
    await group.getByRole('button', { name: '答える' }).click();
    const verdict = group.locator('.answer-verdict');
    await expect(verdict).toHaveCSS('animation-name', 'none');
    await expect(verdict.locator('.answer-verdict__confetti')).toHaveCSS('display', 'none');
  }
  await expect(panel.getByTestId('check-summary')).toHaveClass(/concept-check__summary--perfect/);
  await expect(panel.getByTestId('check-summary')).toHaveCSS('animation-name', 'none');
  await expect(panel.locator('.concept-check__perfect-confetti')).toHaveCSS('display', 'none');
});

test('変更依頼の実装中は出ず、ステージを切り替えると消える', async ({ page }) => {
  await clearTutorial2(page);
  await expect(page.getByRole('region', { name: '理解度チェック' })).toBeVisible();

  await page.getByTestId('change-request-start').click();
  await expect(page.getByTestId('change-panel')).toBeVisible();
  await expect(page.getByRole('region', { name: '理解度チェック' })).toBeHidden();
});

test('ステージを切り替えると理解度チェックが消える', async ({ page }) => {
  await clearTutorial2(page);
  await expect(page.getByRole('region', { name: '理解度チェック' })).toBeVisible();

  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await expect(page.getByRole('region', { name: '理解度チェック' })).toBeHidden();
});
