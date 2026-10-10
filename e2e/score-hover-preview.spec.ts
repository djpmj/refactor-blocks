import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('減点ルールはホバーとキーボードフォーカス中だけ原因を光らせ、クリック固定を優先する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '中級3: 越境する private メソッド');
  const breakdown = page.locator('.score-breakdown');
  await breakdown.locator('summary').click();
  const accessRule = breakdown.locator('.score-breakdown__items button[aria-pressed]').filter({ hasText: 'アクセス制御' });
  const targetMethod = page.getByTestId('method-renderTemplate');
  const viewport = page.locator('.react-flow__viewport');
  const initialTransform = await viewport.getAttribute('style');

  // Act: ホバー
  await accessRule.hover();

  // Assert: 原因が光り、視点は動かない
  const flaggedMethod = targetMethod.locator('.method-chip--flagged');
  await expect(flaggedMethod).toBeVisible();
  await expect(flaggedMethod).toHaveCSS('animation-name', 'flagged-flash');
  await expect(flaggedMethod).toHaveCSS('animation-duration', '0.42s');
  await expect(accessRule).toHaveAttribute('aria-pressed', 'false');
  expect(await viewport.getAttribute('style')).toBe(initialTransform);

  // Act: ホバー解除
  await breakdown.locator('summary').hover();

  // Assert
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(0);

  // Act: Tabでキーボードフォーカス
  await breakdown.locator('summary').focus();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    if (await accessRule.evaluate((element) => element.ownerDocument.activeElement === element)) break;
  }

  // Assert
  await expect(accessRule).toBeFocused();
  await expect(targetMethod.locator('.method-chip--flagged')).toBeVisible();
  await accessRule.hover();
  await breakdown.locator('summary').hover();
  await expect(targetMethod.locator('.method-chip--flagged')).toBeVisible();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Shift+Tab');
    if (await breakdown.locator('summary').evaluate((element) => element.ownerDocument.activeElement === element)) break;
  }
  await expect(breakdown.locator('summary')).toBeFocused();
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(0);

  // Act: クリックすると固定され、キャンバスが原因へ寄る。もう一度押すと解除する
  const beforeClickTransform = await viewport.getAttribute('style');
  await accessRule.click();
  await expect(accessRule).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => viewport.getAttribute('style')).not.toBe(beforeClickTransform);
  await accessRule.click();
  await expect(accessRule).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(0);

  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const rules = breakdown.locator('.score-breakdown__items button[aria-pressed]');
  if (!(await rules.first().isVisible())) await breakdown.locator('summary').click();
  const fixedRule = rules.nth(0);
  const otherRule = rules.nth(1);

  // Act: ホバーとフォーカスの対象を別々に動かす
  await breakdown.locator('summary').focus();
  await page.keyboard.press('Tab');
  await expect(fixedRule).toBeFocused();
  const focusTargets = await page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-testid')).sort(),
  );
  await otherRule.hover();
  await breakdown.locator('summary').hover();
  await expect.poll(() => page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-testid')).sort(),
  )).toEqual(focusTargets);

  // Act: 固定ルールをクリック
  await fixedRule.click();
  await expect(fixedRule).toHaveAttribute('aria-pressed', 'true');
  const fixedTargets = await page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-testid')).sort(),
  );
  await otherRule.hover();

  // Assert: 固定したルールと強調対象を保つ
  await expect(fixedRule).toHaveAttribute('aria-pressed', 'true');
  await expect(otherRule).toHaveAttribute('aria-pressed', 'false');
  expect(await page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-testid')).sort(),
  )).toEqual(fixedTargets);

  // Act: フォーカスだけ移すと固定強調は解除されない
  await otherRule.focus();
  await expect(fixedRule).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).not.toHaveCount(0);
  await page.locator('.score-breakdown > summary').focus();
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).not.toHaveCount(0);

  // Act: 固定を解除すると、フォーカス中の別ルールがプレビューされる
  await fixedRule.click();
  await breakdown.locator('summary').hover();
  await otherRule.focus();
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).not.toHaveCount(0);
  expect(await page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-testid')).sort(),
  )).not.toEqual(fixedTargets);
});

test('減点の内訳を閉じるとホバー強調が消え、reduced motionではアニメーションしない', async ({ page }) => {
  // Arrange
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await selectStage(page, '中級3: 越境する private メソッド');
  const breakdown = page.locator('.score-breakdown');
  await breakdown.locator('summary').click();
  const accessRule = breakdown.locator('.score-breakdown__items button[aria-pressed]').filter({ hasText: 'アクセス制御' });
  const targetMethod = page.getByTestId('method-renderTemplate');

  // Act
  await accessRule.hover();

  // Assert: 静止した強調のみ
  const flagged = targetMethod.locator('.method-chip--flagged');
  await expect(flagged).toBeVisible();
  await expect(flagged).toHaveCSS('animation-name', 'none');

  // Act: 詳細を閉じる
  await breakdown.locator('summary').click();

  // Assert
  await expect(page.locator('.method-chip--flagged, .class-node--flagged, .file-node--flagged')).toHaveCount(0);
});
