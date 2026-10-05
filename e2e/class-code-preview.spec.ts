import { expect, test } from '@playwright/test';

test('コードタブにチュートリアル1のクラスソースを表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル1: 長いメソッドを分ける' });
  await page.getByTestId('method-printMonthlyReport').click();
  await expect(page.getByTestId('class-ReportService').locator('.line-badge')).toHaveText('32行');
  await expect(page.locator('.method-editor__title .line-badge')).toHaveText('29行');

  // Act
  await page.getByRole('tab', { name: 'コード' }).click();

  // Assert
  const panel = page.getByRole('tabpanel', { name: 'コード' });
  await expect(panel.locator('pre code')).toContainText('public class ReportService');
  await expect(panel.locator('pre code')).toContainText('var monthlySales');
  await expect(panel.locator('pre code')).toContainText('Console.WriteLine');
  const source = panel.locator('pre code');
  expect(await source.locator('.hljs-keyword').count()).toBeGreaterThan(0);
  await expect(source.locator('.hljs-string').first()).toContainText('商品名 | 数量 | 売上');
  await expect(source.locator('.hljs-comment')).toContainText('レポートを出力する');
  expect(await source.locator('.hljs-number').count()).toBeGreaterThan(0);
  const sourceLineCount = (await source.textContent() ?? '').split('\n').length;
  const sourceLines = panel.locator('.code-preview__line');
  await expect(sourceLines).toHaveCount(sourceLineCount);
  await expect(sourceLines.first()).toHaveCSS('display', 'grid');
  await expect(sourceLines.first()).toHaveAttribute('data-line-number', '1');
  await expect(sourceLines.last()).toHaveAttribute('data-line-number', String(sourceLineCount));
  await expect(sourceLines.last()).toHaveAttribute('data-line-number', '32');
  await expect(source).toContainText('public void printMonthlyReport()\n    {');
  await expect(source).toContainText('foreach (var row in rows)\n        {\n            Console.WriteLine(row);\n        }');
  await expect(source).toContainText('.GroupBy(s => s.ProductName)\n            .Select(');
  await expect(panel.getByRole('combobox', { name: 'コードの言語' })).toHaveValue('csharp');
  await page.getByRole('tab', { name: '編集' }).click();
  await expect(page.getByRole('tabpanel', { name: '編集' })).toBeVisible();
  await expect(page.locator('.fragment-list__lines')).toHaveText(['6行', '7行', '1行', '3行', '9行']);

  await page.getByLabel('今月の売上を集計する').check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.locator('.method-editor__title .line-badge')).toHaveText('24行');
  await expect(page.getByTestId('class-ReportService').locator('.line-badge')).toHaveText('37行');
  await page.getByRole('tab', { name: 'コード' }).click();
  const extractedSourceLines = page.getByRole('tabpanel', { name: 'コード' }).locator('.code-preview__line');
  await expect(extractedSourceLines.last()).toHaveAttribute('data-line-number', '37');

  await page.getByTestId('method-aggregateSales').click();
  await expect(page.locator('.method-editor__title .line-badge')).toHaveText('9行');
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('前月比を計算する').check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await expect(page.locator('.method-editor__title .line-badge')).toHaveText('18行');
  await expect(page.getByTestId('class-ReportService').locator('.line-badge')).toHaveText('42行');
  await page.getByRole('tab', { name: 'コード' }).click();
  await expect(page.getByRole('tabpanel', { name: 'コード' }).locator('.code-preview__line').last()).toHaveAttribute('data-line-number', '42');
  await page.getByTestId('method-compareWithLastMonth').click();
  await expect(page.locator('.method-editor__title .line-badge')).toHaveText('10行');
  await expect(page.getByTestId('score')).toContainText('100');
});

test('コードタブはサイドバー幅に合わせて折り返し、横スクロールを出さない', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル1: 長いメソッドを分ける' });
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByRole('tab', { name: 'コード' }).click();
  const panel = page.getByRole('tabpanel', { name: 'コード' });
  const source = panel.locator('pre code');
  const preview = panel.locator('.code-preview');
  const sourceText = await source.textContent();
  const sidebar = panel.locator('xpath=ancestor::div[contains(@class, "sidebar-resizable")][1]');
  const handle = sidebar.getByRole('separator', { name: 'サイドバーの幅を変更' });

  // Act: 初期幅、拡大、縮小で折り返しと横幅を確認する
  const measure = () => preview.evaluate((element) => {
    const pre = element.querySelector('pre');
    if (pre === null) throw new Error('コードの pre が見つかりません');
    return { previewWidth: element.clientWidth, previewScrollWidth: element.scrollWidth, preWidth: pre.clientWidth, preScrollWidth: pre.scrollWidth, preHeight: pre.clientHeight };
  });
  const initial = await measure();
  const handleBox = await handle.boundingBox();
  if (handleBox === null) throw new Error('サイドバーのハンドルが見つかりません');
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 240, handleBox.y + handleBox.height / 2, { steps: 5 });
  await page.mouse.up();
  const expanded = await measure();
  const expandedBox = await handle.boundingBox();
  if (expandedBox === null) throw new Error('サイドバーのハンドルが見つかりません');
  await page.mouse.move(expandedBox.x + expandedBox.width / 2, expandedBox.y + expandedBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(expandedBox.x + 400, expandedBox.y + expandedBox.height / 2, { steps: 5 });
  await page.mouse.up();
  const narrowed = await measure();

  // Assert
  expect(initial.preHeight).toBeGreaterThan(expanded.preHeight);
  expect(narrowed.preHeight).toBeGreaterThan(expanded.preHeight);
  for (const dimensions of [initial, expanded, narrowed]) {
    expect(dimensions.previewScrollWidth).toBeLessThanOrEqual(dimensions.previewWidth);
    expect(dimensions.preScrollWidth).toBeLessThanOrEqual(dimensions.preWidth);
  }
  await expect(source).toContainText('changeRate');
  expect(await source.textContent()).toBe(sourceText);
  await expect(panel.locator('pre')).toHaveCSS('white-space', 'pre-wrap');
  const changeRateLineIndex = (sourceText ?? '').split('\n').findIndex((line) => line.includes('changeRate'));
  const wrappedLine = panel.locator('.code-preview__line').nth(changeRateLineIndex);
  const wrappedSourceBox = await wrappedLine.locator('.code-preview__line-source').boundingBox();
  const followingLineBox = await panel.locator('.code-preview__line').nth(changeRateLineIndex + 1).boundingBox();
  const wrappedLineBox = await wrappedLine.boundingBox();
  if (wrappedSourceBox === null || followingLineBox === null || wrappedLineBox === null) {
    throw new Error('折り返し行または行番号が見つかりません');
  }
  await expect(wrappedLine).toHaveAttribute('data-line-number', String(changeRateLineIndex + 1));
  expect(wrappedSourceBox.y).toBe(wrappedLineBox.y);
  expect(wrappedLineBox.height).toBeGreaterThan(20);
  expect(followingLineBox.y).toBeGreaterThanOrEqual(wrappedSourceBox.y + wrappedSourceBox.height - 1);
  await page.getByRole('tab', { name: '編集' }).click();
  await expect(page.getByRole('tabpanel', { name: '編集' })).toBeVisible();
});

test('抽出後の呼び出し行をコードタブに呼び出し文として表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await page.getByLabel('ステージ').selectOption({ label: 'チュートリアル1: 長いメソッドを分ける' });
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByLabel('今月の売上を集計する').check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
  await page.getByTestId('method-printMonthlyReport').click();

  // Act
  await page.getByRole('tab', { name: 'コード' }).click();

  // Assert
  const source = page.getByRole('tabpanel', { name: 'コード' }).locator('pre code');
  await expect(source).toContainText('aggregateSales();');
  await expect(source).not.toContainText('// 未入力: aggregateSales() を呼び出す');
});
