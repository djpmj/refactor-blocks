import { expect, test, type Locator, type Page } from '@playwright/test';

async function clearTourSeenOnce(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('first-visit-tour-test-reset') !== 'done') {
      localStorage.removeItem('refactor-blocks:tour-seen');
      sessionStorage.setItem('first-visit-tour-test-reset', 'done');
    }
  });
}

async function clearIntroSeen(page: Page, kind: 'quiz' | 'blank'): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
  }, `refactor-blocks:mode-intro-seen:${kind}`);
}

const OVERLAP_UNKNOWN = Number.NEGATIVE_INFINITY;

// 2つの要素の重なりの大きさ(幅と高さの小さい方)。1px以下の誤差は重なりとみなさない
async function overlapPx(a: Locator, b: Locator): Promise<number> {
  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  if (boxA === null || boxB === null) return OVERLAP_UNKNOWN;
  const width = Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x);
  const height = Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y);
  return Math.min(width, height);
}

async function expectNoOverlap(callout: Locator, other: Locator): Promise<void> {
  await expect.poll(async () => {
    const overlap = await overlapPx(callout, other);
    return overlap !== OVERLAP_UNKNOWN && overlap <= 1;
  }).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('設計くらべ: 手順1は照らす枠、手順2は依頼の文章と回答ボタンを吹き出しが覆わない', async ({ page }) => {
  // Arrange
  await clearIntroSeen(page, 'quiz');
  await page.goto('/');
  await page.getByTestId('mode-quiz').click();
  const guide = page.getByTestId('mode-intro-guide');
  await expect(guide).toContainText('1/3');

  // Act / Assert
  await expectNoOverlap(guide, page.locator('.spotlight-tour__hole'));
  await guide.getByRole('button', { name: '次へ' }).click();
  await expect(guide).toContainText('2/3');
  await expectNoOverlap(guide, page.locator('.quiz__question'));
});

test('チュートリアル1: 手順3で吹き出しが左パネルを覆わない', async ({ page }) => {
  // Arrange
  await clearTourSeenOnce(page);
  await page.goto('/');
  const tour = page.getByTestId('first-visit-tour');
  await tour.getByRole('button', { name: '次へ' }).click();

  // Act
  await page.locator('[data-tour="manual-fix-start"]').click();

  // Assert
  await expect(tour).toContainText('3/6');
  await expectNoOverlap(tour, page.locator('#stage-sidebar'));
});

test('白紙設計: 手順1で吹き出しが照らす枠も操作行も覆わない', async ({ page }) => {
  // Arrange
  await clearIntroSeen(page, 'blank');
  await page.goto('/');

  // Act
  await page.getByTestId('mode-blank').click();

  // Assert
  const guide = page.getByTestId('mode-intro-guide');
  await expect(guide).toContainText('1/3');
  await expectNoOverlap(guide, page.locator('.spotlight-tour__hole'));
  await expectNoOverlap(guide, page.locator('[data-testid="blank-view"] .stage-panel__actions'));
});
