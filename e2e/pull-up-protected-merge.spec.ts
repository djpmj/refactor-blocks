import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('上級1: Pull Up後もprotectedの統合候補を表示し、統合できる', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '上級1: 通知クラスの共通処理を基底クラスへ集める');
  await page.getByTestId('method-notifyByEmail').click();
  await page.getByLabel('送信ログを記録する').check();
  await page.getByLabel('新しいメソッド名').fill('logEmailNotification');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Act: EmailNotifierの継承元を設定し、抽出メソッドをNotifierBaseへ移す
  await page.getByTestId('class-header-EmailNotifier').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '継承元を設定' }).click();
  await menu.getByRole('menuitem', { name: 'NotifierBase', exact: true }).click();
  const method = page.getByTestId('method-logEmailNotification');
  const target = page.getByTestId('class-NotifierBase');
  const sourceBox = await method.boundingBox();
  const targetBox = await target.boundingBox();
  if (sourceBox === null || targetBox === null) throw new Error('ドラッグ要素の位置を取得できません');
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2, { steps: 5 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 15 });
  await page.mouse.up();

  // Assert: protected化の表示
  await expect(page.getByTestId('method-logEmailNotification')).toContainText('#');
  await expect(page.getByText(/protected にしました/)).toBeVisible();

  // Act: SMS側の処理を抽出してから、protected同士の統合候補を選ぶ
  await page.getByTestId('method-notifyBySms').click();
  await page.getByLabel('送信ログを記録する').check();
  await page.getByLabel('新しいメソッド名').fill('logSmsNotification');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await page.getByTestId('method-logEmailNotification').click();
  const candidate = page.getByTestId('merge-candidate-logSmsNotification');
  await expect(candidate).toBeVisible();
  await page.getByLabel('統合後の名前').fill('logNotification');
  await page.getByTestId('merge-candidate-logSmsNotification').click();

  // Assert
  await expect(page.getByTestId('method-logEmailNotification')).toHaveCount(0);
  await expect(page.getByTestId('method-logSmsNotification')).toHaveCount(0);
  await expect(page.getByTestId('class-NotifierBase').getByTestId('method-logNotification')).toBeVisible();
});
