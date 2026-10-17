import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('フィールドの外部アクセスと直し方を表示し、処理を持ち主へ移すと消す', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '中級6: 他人のデータばかり触るメソッド');
  const panel = page.getByLabel('メソッドエディタ');
  const field = page.getByTestId('field-status');

  // Act: 外から読み書きする field を選ぶ
  await field.click();

  // Assert
  const accessor = panel.locator('.field-info__access--write');
  await expect(accessor).toContainText('BillingService.cancelSubscription() — 読み書き');
  await expect(accessor).toContainText('外から');
  const danger = await page.locator('body').evaluate((body) => {
    const probe = body.ownerDocument.createElement('span');
    probe.style.color = 'var(--danger)';
    body.append(probe);
    const color = body.ownerDocument.defaultView?.getComputedStyle(probe).color ?? '';
    probe.remove();
    return color;
  });
  expect(await accessor.evaluate((element) => element.ownerDocument.defaultView?.getComputedStyle(element).color ?? '')).toBe(danger);
  await expect(panel.getByTestId('field-fix-hint')).toHaveText(
    'BillingService.cancelSubscription() が、Subscription の外からこのデータを書き換えています。書き換える処理を Subscription へ移すと、カプセル化の破れが直ります',
  );

  // Act: cancelSubscription を Subscription へ移す
  await page.getByTestId('method-cancelSubscription').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '別のクラスへ移動' }).click();
  await menu.getByRole('menuitem', { name: 'Subscription', exact: true }).click();
  await field.click();

  // Assert: 書き換えとその案内は消え、残る外部読み取りには読み取りの案内が出る
  await expect(panel.locator('.field-info__access--write')).toHaveCount(0);
  await expect(panel.getByTestId('field-fix-hint')).toHaveText(
    'BillingService.renewSubscription() が Subscription のデータを読んでいます。読む処理が多いなら、Subscription へ移すことを考えてみよう',
  );

  // Act: 持ち主の中だけで使われる canceledAt を選ぶ
  await page.getByTestId('field-canceledAt').click();

  // Assert
  await expect(panel.locator('.field-info__access')).toContainText('Subscription.cancelSubscription() — 読み書き');
  await expect(panel.getByText('外から', { exact: true })).toHaveCount(0);
  await expect(panel.getByTestId('field-fix-hint')).toHaveCount(0);
});
