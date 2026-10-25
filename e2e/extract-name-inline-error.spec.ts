import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const nameOf = (name: string) => `同じクラスに「${name}」というメソッドがあります。別の名前にしてください`;

async function startExtract(page: Page) {
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByRole('checkbox').first().check();
}

for (const duplicate of ['aggregateSales', 'printMonthlyReport']) {
  test(`名前を ${duplicate} にすると押す前に説明が出て、直すと押せてプレビューが戻る`, async ({ page }) => {
    // Arrange
    await startExtract(page);
    const input = page.getByLabel('新しいメソッド名');
    const extract = page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' });
    const reason = page.locator('#method-editor-extract-disabled-reason');
    const preview = page.locator('.method-editor__extract-preview');
    const suggested = await input.inputValue();
    await expect(extract).toBeEnabled();
    await expect(preview).toBeVisible();
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');

    // Act
    await input.fill(duplicate);

    // Assert
    await expect(extract).toBeDisabled();
    await expect(reason).toHaveText(nameOf(duplicate));
    await expect(preview).toHaveCount(0);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAttribute('aria-describedby', 'method-editor-extract-disabled-reason');
    await expect(extract).toHaveAttribute('aria-describedby', 'method-editor-extract-disabled-reason');

    // Act
    await input.fill(suggested);

    // Assert
    await expect(extract).toBeEnabled();
    await expect(reason).toHaveCount(0);
    await expect(preview).toBeVisible();
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await expect(input).not.toHaveAttribute('aria-describedby', /.+/);
  });
}

test('前後に空白があっても重複と判定する', async ({ page }) => {
  // Arrange
  await startExtract(page);

  // Act
  await page.getByLabel('新しいメソッド名').fill('  aggregateSales ');

  // Assert
  await expect(page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' })).toBeDisabled();
  await expect(page.locator('#method-editor-extract-disabled-reason')).toHaveText(nameOf('aggregateSales'));
});
