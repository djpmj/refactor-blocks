import { expect, type Locator, type Page } from '@playwright/test';

/** 「減点の内訳」を(閉じていれば)開いて返す。 */
export async function openBreakdown(page: Page): Promise<Locator> {
  const breakdown = page.locator('.score-breakdown');
  await expect(breakdown).toBeVisible();
  if (await breakdown.getAttribute('open') === null) await breakdown.locator('summary').click();
  await expect(breakdown).toHaveAttribute('open', '');
  return breakdown;
}

/** 減点の内訳に出るボタン(1ルール1つ)。 */
function deductionButtons(breakdown: Locator): Locator {
  return breakdown.locator('.score-breakdown__items button[aria-pressed]');
}

/**
 * 「減点の内訳」を開き、ルールごとの表示(例: `行数 ×1`)と減点額が過不足なく出ていることと、
 * ヘッダーの点数の横が `減点 N項目(-合計)` になっていることを確かめる。
 */
export async function expectDeductions(page: Page, items: ReadonlyArray<readonly [label: string, points: number]>): Promise<void> {
  const breakdown = await openBreakdown(page);
  await expect(breakdown.locator('summary')).toHaveText(`減点の内訳(${items.length})`);
  await expect(deductionButtons(breakdown)).toHaveCount(items.length);
  for (const [label] of items) {
    await expect(breakdown.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  const total = items.reduce((sum, [, points]) => sum + points, 0);
  await expect(page.getByTestId('score')).toHaveText(`減点 ${items.length}項目(-${total})`);
}

/** そのルールの減点が内訳に出ていない(内訳ごと消えている場合も含む)。 */
export async function expectNoDeduction(page: Page, label: string): Promise<void> {
  await expect(page.locator('.score-breakdown button', { hasText: label })).toHaveCount(0);
}

/** 内訳にそのルールの表示(例: `行数 ×1`。1件=10点)が出ている。 */
export async function expectDeduction(page: Page, label: string): Promise<void> {
  const breakdown = await openBreakdown(page);
  await expect(breakdown.getByRole('button', { name: label, exact: true })).toBeVisible();
}
