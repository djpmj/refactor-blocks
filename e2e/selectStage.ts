import { expect, type Page } from '@playwright/test';

export async function releaseAllManualFixSites(page: Page, options: { readonly restoreSidebar?: boolean } = {}): Promise<void> {
  const wasCollapsed = await page.getByRole('button', { name: 'サイドバーを開く' }).count() > 0;
  if (wasCollapsed) await page.getByRole('button', { name: 'サイドバーを開く' }).evaluate((element) => (element as { click(): void }).click());
  const card = page.locator('.change-pain');
  const details = card.locator('details');
  if (await details.count() === 0) {
    if (wasCollapsed && options.restoreSidebar !== false) await page.getByRole('button', { name: 'サイドバーを閉じる' }).click();
    return;
  }
  await details.evaluate((element) => element.setAttribute('open', ''));
  const panel = page.getByRole('region', { name: '手で直すシミュレーション' });
  if (await panel.count() > 0 && await panel.getByRole('button', { name: 'もう一度やる' }).count() > 0) {
    await panel.getByRole('button', { name: 'もう一度やる' }).click();
  }
  const button = card.getByRole('button', { name: '実際に直してみる' });
  if (await panel.count() === 0) {
    if (await button.count() === 0) return;
    await button.click();
  }
  const locationItems = await card.locator('ul li').allTextContents();
  const tour = page.getByTestId('first-visit-tour');
  const tourActive = await tour.count() > 0 && await tour.isVisible();
  const methodLocations = [...new Map(locationItems.flatMap((item) => {
    const match = item.match(/([\w$]+)\.([\w$]+)(?:\(|$)/);
    return match === null ? [] : [[match[2], match[1]] as const];
  }))];
  for (const [name, className] of tourActive ? [] : methodLocations) {
    const method = page.getByTestId(`class-${className}`).getByTestId(`method-${name}`);
    if (await method.count() > 0) await method.click();
  }
  await panel.getByRole('button', { name: 'リリースする' }).click();
  const restart = panel.getByRole('button', { name: 'もう一度やる' });
  if (await restart.count() > 0) {
    const missed = await panel.locator('[role="status"] li').allTextContents();
    if (missed.length > 0) {
      await restart.click();
      for (const item of missed) {
        const match = item.match(/([\w$]+)\.([\w$]+)$/);
        if (match !== null) await page.getByTestId(`class-${match[1]}`).getByTestId(`method-${match[2]}`).click();
      }
      await panel.getByRole('button', { name: 'リリースする' }).click();
    }
  }
  if (wasCollapsed && options.restoreSidebar !== false) await page.getByRole('button', { name: 'サイドバーを閉じる' }).click();
}

export async function completeManualFix(page: Page): Promise<void> {
  await releaseAllManualFixSites(page);
  const panel = page.getByRole('region', { name: '手で直すシミュレーション' });
  if (await panel.getByRole('button', { name: '組み替えを始める' }).count() > 0) {
    await panel.getByRole('button', { name: '組み替えを始める' }).click();
  }
}

export async function completeOpeningFix(page: Page): Promise<void> {
  const wasSidebarClosed = await page.getByRole('button', { name: 'サイドバーを開く' }).count() > 0;
  const tour = page.getByTestId('first-visit-tour');
  if (await tour.count() > 0 && await tour.isVisible()) await tour.getByRole('button', { name: '次へ' }).click();
  if (wasSidebarClosed) await page.getByRole('button', { name: 'サイドバーを開く' }).evaluate((element) => (element as { click(): void }).click());
  await releaseAllManualFixSites(page, { restoreSidebar: false });
  if (await tour.count() > 0 && await tour.isVisible()) await tour.getByRole('button', { name: 'ガイドを終了' }).click();
  const panel = page.getByRole('region', { name: '手で直すシミュレーション' });
  const begin = panel.getByRole('button', { name: '組み替えを始める' });
  if (await begin.count() > 0) await begin.click();
  if (wasSidebarClosed) {
    const closeSidebar = page.getByRole('button', { name: 'サイドバーを閉じる' });
    if (await closeSidebar.count() > 0) await closeSidebar.click();
  }
}

export async function selectStage(page: Page, title: string, options: { readonly completeOpeningFix?: boolean } = {}): Promise<void> {
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
  if (options.completeOpeningFix !== false) await completeOpeningFix(page);
}

export async function startChangeRequests(page: Page): Promise<void> {
  const button = page.getByTestId('change-request-start');
  if (await button.isDisabled() && (await button.getAttribute('title'))?.includes('もう一度解いて')) {
    await completeManualFix(page);
  }
  await button.click();
}
