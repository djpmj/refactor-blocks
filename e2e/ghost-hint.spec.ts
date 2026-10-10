import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

const STAGE = '中級3: 越境する private メソッド';
const MULTI_MOVE_STAGE = '中級2: 何でも入った1つのファイル';

async function openStage(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, STAGE);
}

async function dragMethodToClass(page: Page, methodId: string, classId: string) {
  const source = await page.getByTestId(methodId).boundingBox();
  const target = await page.getByTestId(classId).boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function expectGhostAtDestination(page: Page, announcement: string, targetTestId: string) {
  const animation = page.locator('.ghost-hint-animation--travel');
  await expect(page.getByTestId('ghost-hint-live')).toContainText(announcement);
  await expect(animation).toBeVisible();
  const target = await page.getByTestId(targetTestId).boundingBox();
  if (target === null) throw new Error('ゴーストの移動先が見つかりません');
  const style = await animation.evaluate((element) => element.getAttribute('style') ?? '');
  const value = (property: string) => Number.parseFloat(style.match(new RegExp(`${property}:\\s*([\\d.]+)px`))?.[1] ?? 'NaN');
  const position = { left: value('left'), top: value('top'), width: value('width'), height: value('height') };
  expect(Math.abs(position.left + position.width / 2 - (target.x + target.width / 2))).toBeLessThan(2);
  expect(Math.abs(position.top + position.height / 2 - (target.y + target.height / 2))).toBeLessThan(2);
  await expect(page.locator('.ghost-hint-animation')).toHaveCount(0, { timeout: 5000 });
}

test('plays a visual-only ghost, leaves hint count and undo history alone, then advances to the next draggable step', async ({ page }) => {
  // Arrange
  await openStage(page);
  const button = page.getByTestId('ghost-hint');
  const hintButton = page.getByRole('button', { name: 'ヒントを見る' });
  const score = await page.getByTestId('score').innerText();
  await expect(button).toBeEnabled();
  await expect(page.getByRole('button', { name: '元に戻す' })).toBeDisabled();

  // Act
  await button.click();

  // Assert
  await expect(page.locator('.ghost-hint-animation')).toBeVisible();
  await expect(page.getByText('renderTemplate を NotificationService へ動かすと良さそうです')).toBeAttached();
  await expect(page.getByTestId('score')).toHaveText(score);
  await expect(page.getByRole('button', { name: '元に戻す' })).toBeDisabled();
  await expect(hintButton).toHaveText('ヒントを見る');
  await expect(button).toBeDisabled();
  await expect(page.locator('.ghost-hint-animation')).toHaveCount(0, { timeout: 5000 });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByTestId('ghost-hint-live')).toContainText('renderTemplate');
  await expect(hintButton).toHaveText('ヒントを見る');
  await expect(page.locator('.ghost-hint-animation')).toHaveCount(0, { timeout: 5000 });

  // Act: perform the suggested drag.
  await dragMethodToClass(page, 'method-renderTemplate', 'class-NotificationService');

  // Assert: only non-drag steps remain.
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('title', 'ドラッグで動かす手は残っていません');
});

test('shows the idle affordance without playing a ghost and clears it on interaction', async ({ page }) => {
  // Arrange
  await page.clock.install();
  await openStage(page);
  const button = page.getByTestId('ghost-hint');

  // Act
  await page.clock.fastForward(30_000);

  // Assert
  await expect(button).toHaveClass(/ghost-hint-button--idle/);
  await expect(page.locator('.ghost-hint-animation')).toHaveCount(0);

  // Act
  await page.locator('#stage-problem-title').click();

  // Assert
  await expect(button).not.toHaveClass(/ghost-hint-button--idle/);
});

test('switches the ghost target after moving the first of multiple sample-answer methods', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, MULTI_MOVE_STAGE);
  const button = page.getByTestId('ghost-hint');

  // Act / Assert: first step and its destination coordinates.
  await button.click();
  await expectGhostAtDestination(page, 'calculateShippingFee を ShippingService へ動かすと良さそうです', 'class-ShippingService');

  // Act: perform the first suggested move.
  await dragMethodToClass(page, 'method-calculateShippingFee', 'class-ShippingService');

  // Assert: the next step now points at PointService, including its actual target coordinates.
  await expect(button).toBeEnabled();
  await button.click();
  await expectGhostAtDestination(page, 'addPoints を PointService へ動かすと良さそうです', 'class-PointService');
});

test('uses a source and destination highlight when reduced motion is requested', async ({ page }) => {
  // Arrange
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openStage(page);

  // Act
  await page.getByTestId('ghost-hint').click();

  // Assert
  await expect(page.locator('.ghost-hint-animation')).toHaveCount(0);
  await expect(page.getByTestId('class-TemplateEngine')).toHaveClass(/ghost-hint-target/);
  await expect(page.getByTestId('class-NotificationService')).toHaveClass(/ghost-hint-target/);
  await expect(page.getByTestId('ghost-hint-live')).toContainText('renderTemplate');
});
