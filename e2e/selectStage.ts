import { expect, type Page } from '@playwright/test';

export async function selectStage(page: Page, title: string): Promise<void> {
  await page.getByTestId('roadmap-open').click();

  const dialog = page.getByTestId('stage-roadmap');
  const card = dialog.locator('[data-testid^="roadmap-stage-"]').filter({
    has: page.getByText(title, { exact: true }),
  });
  await card.click();
  await expect(dialog).toHaveCount(0);
}
