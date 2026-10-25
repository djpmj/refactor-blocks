import { expect, test, type Page } from '@playwright/test';
import { openHints } from './hintPopover.js';
import { releaseAllManualFixSites, selectStage } from './selectStage.js';

async function extract(page: Page, fragmentLabel: string, name?: string) {
  await page.getByTestId('method-placeOrder').click();
  await page.getByLabel(fragmentLabel).check();
  if (name !== undefined) await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

async function move(page: Page, methodId: string, classId: string) {
  const source = await page.getByTestId(methodId).boundingBox();
  const target = await page.getByTestId(classId).boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象または移動先が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

test('困りごと・クリア条件が上に並び、ヒントとうわさはサイドバーではなくツールバーに出る', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await page.getByTestId('story-toggle').click();
  const sidebar = page.getByRole('complementary', { name: '課題' });
  await expect(sidebar.getByRole('heading', { name: '困っていること' })).toBeVisible();
  await expect(sidebar.getByText('printMonthlyReportに集計・計算・表の組み立て・出力がまとまっている')).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'クリア条件' })).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: '課題', exact: true })).toBeVisible();
  await expect(sidebar.getByTestId('hint-problem')).toHaveCount(0);
  await expect(sidebar.getByTestId('rumor-list')).toHaveCount(0);
  await expect(sidebar).not.toContainText('気になるうわさ');
  await expect(page.getByTestId('stage-description')).toBeHidden();
  await expect(sidebar).not.toContainText('メソッドは20行以内');

  const order = await sidebar.evaluate((element) => {
    const selectors = ['.story-card', '.stage-panel__problem', '.clear-conditions', '.change-pain', '.stage-panel__description'];
    return selectors.map((selector) => {
      const target = element.querySelector(selector);
      return target === null ? -1 : [...element.children].indexOf(target);
    });
  });
  expect(order.slice(1)).toEqual([...order.slice(1)].sort((left, right) => left - right));

  await openHints(page);
  await page.getByTestId('hint-problem').click();
  await page.getByRole('button', { name: /次の一手/ }).click();
  await expect(page.getByTestId('hint-popover').locator('.stage-panel__hint-list li')).toHaveCount(1);
  await expect(sidebar.locator('.stage-panel__hint-list')).toHaveCount(0);
});

test('ストーリーを閉じても1行で残り、押すと開き直せる', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  await page.getByTestId('story-toggle').click();
  const story = page.getByTestId('story-intro');
  await expect(story).toBeVisible();
  await story.getByRole('button', { name: '閉じる' }).click();
  const reopen = page.getByRole('button', { name: /第2章/ });
  await expect(reopen).toHaveAttribute('aria-expanded', 'false');
  await reopen.click();
  await expect(page.getByTestId('story-intro')).toBeVisible();
});

test('変更の痛みは要約で閉じ、開くと詳細と手動修正が見える', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  const card = page.getByRole('region', { name: 'もし、この変更が来たら?' });
  await expect(card.locator('details')).not.toHaveAttribute('open', '');
  await expect(card.locator('summary')).toContainText('か所・');
  await expect(card.getByText('軽減税率8%に対応して')).toBeHidden();
  await card.locator('summary').click();
  await expect(card.getByText('軽減税率8%に対応して')).toBeVisible();
  await expect(card.getByRole('button', { name: '実際に直してみる' })).toBeVisible();
});

test('操作でクリア条件が更新され、100点では全件達成になる', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const conditions = page.locator('.clear-conditions');
  await expect(conditions.locator('li[aria-label^="未達成:"]')).toHaveCount(3);
  await expect(page.getByTestId('clear-conditions-progress')).toHaveText('3/6 達成');
  await expect(conditions.locator('li.clear-condition--unmet')).toHaveCount(3);
  await expect(conditions.locator('li.clear-condition--met')).toHaveCount(3);
  await expect(conditions.locator('.clear-condition__goal', { hasText: /^(メソッド|クラス|ファイル)の行数/ })).toHaveCount(3);
  await expect(conditions.getByText(/^行数: /)).toHaveCount(0);
  await expect(conditions.locator('li.clear-condition--just-met')).toHaveCount(0);
  const firstUnmet = conditions.locator('li.clear-condition--unmet').first();
  await expect(firstUnmet.locator('.clear-condition__badge')).toHaveText('✗');
  await expect(firstUnmet.locator('.clear-condition__goal')).toBeVisible();
  await expect(firstUnmet.locator('.clear-condition__current')).toContainText('今: ');
  const initiallyMet = conditions.locator('li.clear-condition--met').first();
  await expect(initiallyMet.locator('.clear-condition__badge')).toHaveText('✓');
  await expect(initiallyMet.locator('.clear-condition__current')).toHaveCount(0);
  await expect(initiallyMet).not.toHaveClass(/clear-condition--just-met/);

  await extract(page, '消費税を計算する(軽減税率あり)', 'calculateTax');
  await move(page, 'method-calculateTax', 'class-TaxCalculator');
  const justMet = conditions.locator('li.clear-condition--just-met');
  await expect.poll(() => justMet.count()).toBeGreaterThan(0);
  await expect(justMet.first().locator('.clear-condition__badge')).toHaveCSS('animation-name', 'clear-condition-bounce');
  await expect(page.getByTestId('clear-conditions-progress')).not.toHaveText('3/6 達成');
  await expect(justMet).toHaveCount(0, { timeout: 1000 });
  await page.getByRole('button', { name: '元に戻す' }).click();
  await page.getByRole('button', { name: 'やり直し' }).click();
  await expect(page.getByTestId('clear-conditions-progress')).not.toHaveText('3/6 達成');
  await expect(justMet).toHaveCount(0);
  const methodRow = conditions.locator('li[aria-label*="メソッドの行数:"]');
  const otherLineRows = conditions.locator('li[aria-label*="クラスの行数:"], li[aria-label*="ファイルの行数:"]');
  await expect(methodRow).toHaveClass(/clear-condition--unmet/);
  await page.evaluate(`(() => {
    window.justMetSeen = new Set();
    new MutationObserver(() => {
      document.querySelectorAll('.clear-conditions li.clear-condition--just-met').forEach((li) => {
        window.justMetSeen.add(li.getAttribute('aria-label') ?? '');
      });
    }).observe(document.querySelector('.clear-conditions') ?? document.body, { subtree: true, attributes: true, childList: true });
  })()`);
  await extract(page, '注文をDBに保存する', 'saveOrder');
  await extract(page, '確認メールを送る', 'sendConfirmationMail');
  await extract(page, '在庫があるか検証する', 'validateStock');
  // メソッドの行数だけが達成した瞬間になり、最初から達成済みのクラス・ファイルの行は弾まない
  await expect(methodRow).toHaveClass(/clear-condition--met/);
  const seenLabels: string = await page.evaluate('Array.from(window.justMetSeen).join("|")');
  expect(seenLabels).toContain('メソッドの行数:');
  expect(seenLabels).not.toMatch(/(クラス|ファイル)の行数:/);
  await expect(otherLineRows.locator('.clear-condition__badge')).toHaveText(['✓', '✓']);

  await expect(page.getByTestId('score-value')).toContainText('100点');
  await expect(conditions.locator('li[aria-label^="達成:"]')).toHaveCount(await conditions.locator('li').count());
  const changePain = page.locator('.change-pain');
  await expect(changePain.getByRole('heading', { name: /\u3082\u3046\u4e00\u5ea6/ })).toBeVisible();
  await expect(changePain.locator('details')).toHaveAttribute('open', '');
  await expect(page.getByTestId('change-request-start')).toBeDisabled();
  await releaseAllManualFixSites(page);
  await expect(page.getByRole('region', { name: 'なぜ分けるのか' }).locator('details')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: '最初に戻す' }).click();
  await expect(page.getByTestId('clear-conditions-progress')).toHaveText('3/6 達成');
  await expect(conditions.locator('li.clear-condition--just-met')).toHaveCount(0);
});

test('達成済みの条件を一度未達に戻してから通常操作で再達成するともう一度演出する', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const conditions = page.locator('.clear-conditions');
  const responsibility = conditions.locator('li[aria-label*="責務の混在:"]');
  await extract(page, '消費税を計算する(軽減税率あり)', 'calculateTax');
  await move(page, 'method-calculateTax', 'class-TaxCalculator');
  await expect(responsibility).toHaveClass(/clear-condition--met/);
  await expect(responsibility).not.toHaveClass(/clear-condition--just-met/, { timeout: 1000 });

  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(responsibility).toHaveClass(/clear-condition--unmet/);
  await expect(responsibility).not.toHaveClass(/clear-condition--just-met/);
  await responsibility.evaluate((element) => {
    element.addEventListener('animationstart', () => element.setAttribute('data-animation-started', 'true'), { once: true });
  });
  await move(page, 'method-calculateTax', 'class-TaxCalculator');
  await expect(responsibility).toHaveClass(/clear-condition--met/);
  await expect(responsibility).toHaveAttribute('data-animation-started', 'true');
});

test('reduced motionでは達成バッジを弾ませない', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await selectStage(page, 'チュートリアル2: 太った placeOrder');
  const conditions = page.locator('.clear-conditions');
  await extract(page, '消費税を計算する(軽減税率あり)', 'calculateTax');
  await move(page, 'method-calculateTax', 'class-TaxCalculator');
  const justMet = conditions.locator('li.clear-condition--just-met');
  await expect.poll(() => justMet.count()).toBeGreaterThan(0);
  await expect(justMet.first().locator('.clear-condition__badge')).toHaveCSS('animation-name', 'none');
  await expect(justMet.first()).toHaveCSS('animation-name', 'clear-condition-feedback');
});
