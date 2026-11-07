import { expect, test, type Page } from '@playwright/test';
import { dismissClearScreen, selectStage } from './selectStage.js';

async function extract(page: Page, label: string, name: string) {
  await page.getByTestId('method-notifyShipment').click();
  await page.getByLabel(label).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

async function moveRenderTemplate(page: Page) {
  const source = page.getByTestId('method-renderTemplate');
  const target = page.getByTestId('class-NotificationService');
  await expect(async () => {
    await page.getByRole('button', { name: 'Fit View' }).click();
    await expect(source).toBeInViewport();
  }).toPass();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error('要素の位置を取得できません');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(target.getByTestId('method-renderTemplate')).toBeVisible();
}

test('中級3: 空のクラスができても、クリア条件の分母は6のまま「操作で生じた問題」として別に出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '中級3: 越境する private メソッド');
  await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  const progress = page.getByTestId('clear-conditions-progress');
  const arisen = page.getByTestId('clear-conditions-arisen');
  const arisenRow = page.locator('li.clear-condition--arisen');
  await expect(progress).toHaveText('3/6 達成');
  await expect(arisen).toHaveCount(0);

  // Act: 抽出して renderTemplate を移し、TemplateEngine を空にする
  await extract(page, 'メールを送信する', 'sendMail');
  await extract(page, '送信ログを記録する', 'logDelivery');
  await moveRenderTemplate(page);

  // Assert
  await expect(progress).toHaveText(/\/6 達成$/);
  await expect(arisen).toHaveText('操作で生じた問題 1件');
  await expect(arisenRow).toHaveCount(1);
  await expect(arisenRow).toHaveAttribute('aria-label', /^操作で生じた問題: 空のクラス・ファイル/);
  await expect(progress).not.toHaveClass(/clear-conditions__progress--complete/);

  // Act: 空になった TemplateEngine.ts を削除する
  await page.getByTestId('file-src/notification/TemplateEngine.ts').click({ button: 'right', position: { x: 10, y: 10 } });
  await page.getByTestId('context-menu').getByRole('menuitem', { name: 'このファイルを削除' }).click();
  await dismissClearScreen(page);

  // Assert
  await expect(progress).toHaveText('6/6 達成');
  await expect(arisen).toHaveCount(0);
  await expect(arisenRow).toHaveCount(0);
  await expect(progress).toHaveClass(/clear-conditions__progress--complete/);

  // Act: 元に戻す
  await page.getByRole('button', { name: '元に戻す' }).click();

  // Assert
  await expect(progress).toHaveText(/\/6 達成$/);
  await expect(arisen).toHaveText('操作で生じた問題 1件');
});
