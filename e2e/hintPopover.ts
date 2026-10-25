import type { Page } from '@playwright/test';

/** ツールバーの「ヒント ▾」を、閉じていれば開く。 */
export async function openHints(page: Page): Promise<void> {
  const button = page.getByTestId('hint-popover-button');
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}

/** ツールバーの「うわさ(N) ▾」を、閉じていれば開く。 */
export async function openRumors(page: Page): Promise<void> {
  const button = page.getByTestId('rumor-popover-button');
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}
