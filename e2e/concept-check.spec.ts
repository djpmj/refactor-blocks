import { expect, test, type Page } from '@playwright/test';

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
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル2: 太った placeOrder' });
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
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル2: 太った placeOrder' });
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

  await panel.getByRole('button', { name: 'もう一度' }).click();
  await expect(panel.getByTestId('check-summary')).toBeHidden();
  await expect(panel.getByRole('button', { name: '答える' })).toHaveCount(2);
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

  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル1: 長いメソッドを分ける' });
  await expect(page.getByRole('region', { name: '理解度チェック' })).toBeHidden();
});
