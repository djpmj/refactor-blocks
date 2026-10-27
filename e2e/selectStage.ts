import { expect, type Page } from '@playwright/test';

export async function dismissClearScreen(page: Page): Promise<void> {
  const screen = page.getByTestId('clear-screen');
  if (await screen.isVisible()) await page.getByTestId('clear-choice-back').click();
}

export async function releaseAllManualFixSites(page: Page, options: { readonly restoreSidebar?: boolean } = {}): Promise<void> {
  await dismissClearScreen(page);
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
  for (const [name, className] of methodLocations) {
    const method = page.getByTestId(`class-${className}`).getByTestId(`method-${name}`);
    if (await method.count() > 0) {
      await method.click();
      if (tourActive) await expect(method).toHaveAttribute('aria-pressed', 'true');
    }
  }
  await panel.getByRole('button', { name: 'リリースする' }).click();
  if (tourActive) {
    const begin = panel.getByRole('button', { name: '\u7d44\u307f\u66ff\u3048\u3092\u59cb\u3081\u308b' });
    const close = panel.getByRole('button', { name: '\u9589\u3058\u308b' });
    const resultAction = await begin.count() > 0 ? begin : close;
    await expect(resultAction).toBeVisible();
    await resultAction.click();
    await expect(tour).toContainText('4/6');
  }
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
  const impactReview = page.getByTestId('impact-review');
  await impactReview.waitFor({ state: 'visible', timeout: 1000 }).catch(() => undefined);
  if (await impactReview.isVisible()) await impactReview.getByRole('button', { name: '閉じる' }).click();
  if (wasCollapsed && options.restoreSidebar !== false) await page.getByRole('button', { name: 'サイドバーを閉じる' }).click();
}

export async function completeManualFix(page: Page): Promise<void> {
  await dismissClearScreen(page);
  await releaseAllManualFixSites(page);
  const panel = page.getByRole('region', { name: '手で直すシミュレーション' });
  if (await panel.getByRole('button', { name: '組み替えを始める' }).count() > 0) {
    await panel.getByRole('button', { name: '組み替えを始める' }).click();
  }
  const impactReview = page.getByTestId('impact-review');
  await impactReview.waitFor({ state: 'visible', timeout: 1000 }).catch(() => undefined);
  if (await impactReview.isVisible()) {
    await impactReview.getByRole('button', { name: '閉じる' }).click();
  }
}

export async function completeOpeningFix(page: Page): Promise<void> {
  const wasSidebarClosed = await page.getByRole('button', { name: 'サイドバーを開く' }).count() > 0;
  const tour = page.getByTestId('first-visit-tour');
  if (await tour.count() > 0 && await tour.isVisible()) await tour.getByRole('button', { name: '次へ' }).click();
  if (wasSidebarClosed) await page.getByRole('button', { name: 'サイドバーを開く' }).evaluate((element) => (element as { click(): void }).click());
  const bannerStart = page.getByTestId('opening-fix-banner').getByRole('button', { name: '実際に直してみる' });
  if (await bannerStart.count() > 0) await bannerStart.click();
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
  await dismissClearScreen(page);
  const openButton = page.getByTestId('roadmap-open');
  // 負荷が高いとき(複数worktreeの並列実行など)、goto直後は描画前でヘッダーが見つからないことが稀にある。待つ上限だけ延ばす
  await expect(openButton).toBeEnabled({ timeout: 15_000 });
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
  await dismissClearScreen(page);
  const button = page.getByTestId('change-request-start');
  if (await button.isDisabled() && (await button.getAttribute('title'))?.includes('もう一度解いて')) {
    await completeManualFix(page);
  }
  await button.click();
}

/** 部品を置いたあとの「実装を終える」から、その依頼の結果を確定して次へ進むまで。ドラッグ直後の1回目のクリックはdnd-kitに握りつぶされることがあるので、結果が出るまで押し直す。 */
export async function finishAndAdvance(page: Page): Promise<void> {
  await expect(async () => {
    await page.getByTestId('change-request-finish').click({ timeout: 1000 });
    await expect(page.getByTestId('change-request-next')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByTestId('change-request-next').click();
}
