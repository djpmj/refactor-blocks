import type { Page } from '@playwright/test';

/** 既存のプレビュー・再生 E2E 用に参考メニューから項目を開く。 */
export async function openReferenceItem(page: Page, itemTestId: string) {
  await page.getByTestId('reference-menu-button').click();
  await page.getByTestId(itemTestId).click();
  const confirmation = page.getByTestId('answer-confirm');
  if (await confirmation.isVisible()) await confirmation.getByRole('button', { name: '答えを見る' }).click();
}
