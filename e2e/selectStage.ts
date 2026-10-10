import { expect, type Page } from '@playwright/test';

export async function selectStage(page: Page, title: string): Promise<void> {
  const openButton = page.getByTestId('roadmap-open');
  await expect(openButton).toBeEnabled();
  await openButton.click();

  const dialog = page.getByTestId('stage-roadmap');
  await expect(dialog).toBeVisible();
  const card = dialog.locator('[data-testid^="roadmap-stage-"]').filter({
    has: page.getByText(title, { exact: true }),
  });
  await card.click();
  await expect(dialog).toHaveCount(0);
}
