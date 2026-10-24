import { expect, test, type Locator, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';
import { openReferenceItem } from './referenceMenuActions.js';

function luminance([red, green, blue]: readonly number[]): number {
  const [r, g, b] = [red, green, blue].map((value) => {
    const channel = (value ?? 0) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrastRatio(a: readonly number[], b: readonly number[]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

function parseRgb(color: string): number[] {
  return (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
}

async function zoomInButtonColors(flow: Locator): Promise<{ readonly background: string; readonly icon: string }> {
  return flow.locator('.react-flow__controls-zoomin').evaluate((button) => {
    const view = button.ownerDocument.defaultView;
    const svg = button.querySelector('svg');
    if (view === null || svg === null) throw new Error('ズームボタンのアイコンが見つかりません');
    return { background: view.getComputedStyle(button).backgroundColor, icon: view.getComputedStyle(svg).fill };
  });
}

async function expectReadableControls(flow: Locator) {
  await expect(flow).toHaveClass(/\bdark\b/);
  const colors = await zoomInButtonColors(flow);
  expect(contrastRatio(parseRgb(colors.background), parseRgb(colors.icon))).toBeGreaterThanOrEqual(3);
}

async function openPreview(page: Page): Promise<Locator> {
  await openReferenceItem(page, 'reference-sample');
  return page.getByTestId('codebase-preview').getByTestId('answer-diagram').locator('.react-flow');
}

test.describe('ダークモード', () => {
  test.use({ colorScheme: 'dark' });

  test('キャンバスのズームボタンがダーク配色になり、アイコンが読める', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    await selectStage(page, '中級1: 循環依存を断ち切る');

    // Assert
    await expectReadableControls(page.locator('.react-flow').first());
  });

  test('解答例の図のズームボタンもダーク配色になり、アイコンが読める', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    const flow = await openPreview(page);

    // Assert: 解答例と自分の設計、どちらの図も
    await expectReadableControls(flow);
    await expectReadableControls(page.getByTestId('codebase-preview').getByTestId('player-diagram').locator('.react-flow'));
  });
});

test.describe('ライトモード', () => {
  test.use({ colorScheme: 'light' });

  test('キャンバスのズームボタンは今までの明るい配色のまま', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    await selectStage(page, '中級1: 循環依存を断ち切る');

    // Assert
    const flow = page.locator('.react-flow').first();
    await expect(flow).toHaveClass(/\blight\b/);
    expect((await zoomInButtonColors(flow)).background).toBe('rgb(254, 254, 254)');
  });
});
