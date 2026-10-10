import { expect, test, type Locator, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function startPointerDrag(page: Page, source: Locator) {
  const box = await source.boundingBox();
  if (box === null) throw new Error('ドラッグ元が見つかりません');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2, { steps: 2 });
}

test('メソッドの移動先を表示し、ドロップとEscで強調を解除する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const sourceClass = page.getByTestId('class-OrderService');
  const targetClass = page.getByTestId('class-TaxCalculator');
  const method = page.getByTestId('method-placeOrder');
  await page.getByRole('button', { name: 'Fit View' }).click();

  // Act: pointer drag中は有効/無効のクラスが分かる
  await startPointerDrag(page, method);

  // Assert
  await expect(sourceClass).toHaveClass(/class-node--cannot-drop/);
  await expect(targetClass).toHaveClass(/class-node--can-drop/);
  await expect(page.getByTestId('file-src\/order\/OrderService.ts')).not.toHaveClass(/file-node--cannot-drop/);
  for (const stateClass of ['class-node--flagged', 'class-node--cyclic']) {
    const combinedStyle = await targetClass.evaluate((element, modifier) => {
      element.classList.add(modifier);
      const style = element.ownerDocument.defaultView?.getComputedStyle(element);
      if (style === undefined) throw new Error('computed style unavailable');
      const result = { border: style.borderTopColor, outline: style.outlineStyle, outlineColor: style.outlineColor, boxShadow: style.boxShadow };
      element.classList.remove(modifier);
      return result;
    }, stateClass);
    expect(combinedStyle.outline).toBe('solid');
    expect(combinedStyle.border).not.toBe(combinedStyle.outlineColor);
    expect(combinedStyle.boxShadow).not.toBe('none');
  }

  // Act: 有効なクラスへドロップする
  const targetBox = await targetClass.boundingBox();
  if (targetBox === null) throw new Error('移動先クラスが見つかりません');
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 5 });
  await expect(targetClass).toHaveClass(/class-node--drop-target/);
  const flaggedHoverStyle = await targetClass.evaluate((element) => {
    element.classList.add('class-node--flagged');
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (style === undefined) throw new Error('computed style unavailable');
    const result = { boxShadow: style.boxShadow, outline: style.outlineStyle };
    element.classList.remove('class-node--flagged');
    return result;
  });
  expect(flaggedHoverStyle.boxShadow).not.toBe('none');
  expect(flaggedHoverStyle.outline).toBe('solid');
  await page.mouse.up();

  // Assert
  await expect(page.locator('.class-node--can-drop, .class-node--cannot-drop')).toHaveCount(0);
  await expect(targetClass.getByTestId('method-placeOrder')).toBeVisible();

  // Act: キーボードでドラッグを開始してEscで取り消す
  const movedMethod = targetClass.getByTestId('method-placeOrder');
  await movedMethod.focus();
  await page.keyboard.press('Space');

  // Assert: KeyboardSensorでも同じ対象表示になり、取消時に消える
  await expect(targetClass).toHaveClass(/class-node--cannot-drop/);
  await expect(sourceClass).toHaveClass(/class-node--can-drop/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.class-node--can-drop, .class-node--cannot-drop')).toHaveCount(0);
});

test('フィールドとクラスの移動候補を表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '中級6: 他人のデータばかり触るメソッド');
  const sourceClass = page.getByTestId('class-Subscription');
  const targetClass = page.getByTestId('class-BillingService');
  const field = page.getByTestId('field-status');
  await page.getByRole('button', { name: 'Fit View' }).click();

  // Act: キーボードドラッグでもフィールド候補を表示し、Escで解除する
  await field.focus();
  await page.keyboard.press('Space');

  // Assert
  await expect(sourceClass).toHaveClass(/class-node--cannot-drop/);
  await expect(targetClass).toHaveClass(/class-node--can-drop/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.class-node--can-drop, .class-node--cannot-drop')).toHaveCount(0);

  // Act: フィールドをドラッグする
  await startPointerDrag(page, field);

  // Assert
  await expect(sourceClass).toHaveClass(/class-node--cannot-drop/);
  await expect(targetClass).toHaveClass(/class-node--can-drop/);
  await page.mouse.up();
  await expect(page.locator('.class-node--can-drop, .class-node--cannot-drop')).toHaveCount(0);

  // Act: 2ファイルあるステージでクラスをドラッグする
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await page.getByRole('button', { name: 'Fit View' }).click();
  const classHeader = page.getByTestId('class-header-OrderService');
  await startPointerDrag(page, classHeader);

  // Assert: 有効なファイルだけを強調し、同じファイルは暗くする
  await expect(page.getByTestId('file-src/order/OrderService.ts')).toHaveClass(/file-node--cannot-drop/);
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts')).toHaveClass(/file-node--can-drop/);
  await expect(page.locator('.class-node--can-drop, .class-node--cannot-drop')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.file-node--can-drop, .file-node--cannot-drop')).toHaveCount(0);

  // Act: KeyboardSensorでもクラスの移動先を表示する
  await classHeader.focus();
  await page.keyboard.press('Space');

  // Assert
  await expect(page.getByTestId('file-src/order/OrderService.ts')).toHaveClass(/file-node--cannot-drop/);
  await expect(page.getByTestId('file-src/tax/TaxCalculator.ts')).toHaveClass(/file-node--can-drop/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.file-node--can-drop, .file-node--cannot-drop')).toHaveCount(0);
});
