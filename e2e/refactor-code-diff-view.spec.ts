import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE_1 = 'チュートリアル1: 長いメソッドを分ける';
const STAGE_2 = 'チュートリアル2: 太った placeOrder';

async function openCodeChange(page: Page) {
  await page.getByRole('tab', { name: 'コード' }).click();
  await page.getByRole('button', { name: '組み替える前と比べる' }).click();
  const dialog = page.getByTestId('code-change-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '組み替える前と今のコード' })).toBeVisible();
  return dialog;
}

test('組み替える前は変化なしで、2列のダイアログが開く。Escapeと閉じるボタンで閉じ、フォーカスがボタンへ戻る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE_1);
  await page.getByTestId('method-printMonthlyReport').click();

  // Act
  const dialog = await openCodeChange(page);

  // Assert
  await expect(page.getByTestId('code-change-summary')).toHaveText('まだ組み替えていません');
  await expect(page.getByTestId('code-before')).toContainText('public class ReportService');
  await expect(page.getByTestId('code-after')).toContainText('public class ReportService');
  await expect(dialog.locator('[data-change]')).toHaveCount(0);

  // Act: Escapeで閉じる
  await page.keyboard.press('Escape');

  // Assert
  await expect(dialog).toHaveCount(0);
  const openButton = page.getByRole('button', { name: '組み替える前と比べる' });
  await expect(openButton).toBeFocused();

  // Act: 閉じるボタンで閉じる
  await openButton.click();
  await page.getByTestId('code-change-dialog').getByRole('button', { name: '閉じる' }).click();

  // Assert
  await expect(page.getByTestId('code-change-dialog')).toHaveCount(0);
  await expect(openButton).toBeFocused();
});

test('処理を抽出すると、移動と追加が色と文字で示され、抽出しなかった処理には付かない', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, STAGE_1);
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByLabel('新しいメソッド名').fill('aggregateSales');
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await page.getByTestId('method-printMonthlyReport').click();

  // Act
  await openCodeChange(page);

  // Assert
  await expect(page.getByTestId('code-change-summary')).toHaveText('移動 1 件・追加 1 件');
  const before = page.getByTestId('code-before');
  const after = page.getByTestId('code-after');
  const beforeMoved = before.locator('[data-change="moved"]');
  const afterMoved = after.locator('[data-change="moved"]');
  await expect(beforeMoved.first()).toContainText('// 今月の売上を集計する');
  await expect(beforeMoved.first()).toContainText('→ ReportService.aggregateSales() へ');
  await expect(afterMoved.first()).toContainText('// 今月の売上を集計する');
  await expect(afterMoved.first()).toContainText('← ReportService.printMonthlyReport() から');
  const added = after.locator('[data-change="added"]');
  await expect(added.first()).toContainText('追加');
  await expect(added.filter({ hasText: 'aggregateSales();' })).toHaveCount(1);
  await expect(before.locator('[data-change="added"]')).toHaveCount(0);
  await expect(after.locator('[data-change="removed"]')).toHaveCount(0);
  await expect(afterMoved.first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(after.locator('[data-fragment-id]', { hasText: '前月比を計算する' }).first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  // 抽出しなかった処理は色もラベルも付かない
  const untouched = after.locator('[data-fragment-id]', { hasText: '前月比を計算する' });
  await expect(untouched.first()).not.toHaveAttribute('data-change', /.+/);
  await expect(untouched.first()).not.toContainText('→');
  await expect(untouched.first()).not.toContainText('←');
});

test('メソッドを別クラスへドラッグで移すと、移した処理に元のクラスからのラベルが付く', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, STAGE_2);
  const method = page.getByTestId('method-placeOrder');
  const box = await method.boundingBox();
  if (box === null) throw new Error('ドラッグ元が見つかりません');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2, { steps: 5 });
  const targetBox = await page.getByTestId('class-TaxCalculator').boundingBox();
  if (targetBox === null) throw new Error('移動先クラスが見つかりません');
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('class-TaxCalculator').getByTestId('method-placeOrder')).toBeVisible();
  await page.getByTestId('method-placeOrder').click();

  // Act
  await openCodeChange(page);

  // Assert
  await expect(page.getByTestId('code-after').locator('[data-change="moved"]').first()).toContainText('← OrderService.placeOrder() から');
  await expect(page.getByTestId('code-before').locator('[data-change="moved"]').first()).toContainText('→ TaxCalculator.placeOrder() へ');
});
