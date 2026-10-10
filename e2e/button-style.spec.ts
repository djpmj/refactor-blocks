import { expect, test, type Locator } from '@playwright/test';
import { selectStage } from './selectStage.js';

async function expectButtonBackgroundToMatchVariable(locator: Locator, variable: '--surface' | '--accent') {
  const colors = await locator.evaluate((element, name) => {
    const view = element.ownerDocument.defaultView;
    if (view === null) throw new Error('ページのウィンドウがありません');
    const styles = view.getComputedStyle(element);
    const probe = element.ownerDocument.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    element.ownerDocument.body.append(probe);
    const expected = view.getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      background: styles.backgroundColor,
      expected,
    };
  }, variable);
  expect(colors.background).toBe(colors.expected);
}

test('tutorial buttons use shared default and primary styles without changing React Flow controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');

  const hintButton = page.getByRole('button', { name: 'ヒントを見る' });
  const ghostHintButton = page.getByRole('button', { name: '少しだけヒント' });
  for (const button of [hintButton, ghostHintButton]) {
    await expect(button).toHaveCSS('border-top-style', 'solid');
    await expect(button).toHaveCSS('border-radius', '6px');
    await expectButtonBackgroundToMatchVariable(button, '--surface');
  }

  const primaryToolbarButton = page.locator('.toolbar__primary');
  await primaryToolbarButton.evaluate((button) => button.removeAttribute('disabled'));
  await expectButtonBackgroundToMatchVariable(primaryToolbarButton, '--accent');

  const zoomButton = page.locator('.react-flow__controls-button').first();
  await expect(zoomButton).toBeVisible();
  await expect(zoomButton).not.toHaveCSS('border-radius', '6px');

  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  await page.locator('.change-pain summary').click();
  await expectButtonBackgroundToMatchVariable(page.getByRole('button', { name: '実際に直してみる' }), '--accent');
});
