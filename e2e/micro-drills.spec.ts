import { expect, test, type Page } from '@playwright/test';

async function openDrill(page: Page, id: string): Promise<void> {
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();
  await page.getByTestId(`roadmap-stage-${id}`).click();
}

async function extract(page: Page, method: string, labels: readonly string[]): Promise<void> {
  await page.getByTestId(`method-${method}`).click();
  for (const label of labels) await page.getByLabel(label).check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('一覧の最後にドリル3本が並び、本編がおすすめされる', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();
  const roadmap = page.getByTestId('stage-roadmap');
  await expect(roadmap.getByRole('heading', { name: 'ドリル' })).toBeVisible();
  const headings = await roadmap.getByRole('heading', { level: 3 }).allTextContents();
  expect(headings.indexOf('ドリル')).toBe(headings.indexOf('上級') + 1);
  for (const [id, title] of [
    ['drill-extract-tail', 'ドリル1: 後ろのまとまりを抜き出す'],
    ['drill-extract-middle', 'ドリル2: 途中のまとまりを抜き出す'],
    ['drill-move-method', 'ドリル3: メソッドを持ち主のクラスへ移す'],
  ]) {
    await expect(roadmap.getByTestId(`roadmap-stage-${id}`)).toContainText(title);
    await expect(roadmap.getByTestId(`roadmap-stage-${id}`)).toContainText('未挑戦');
  }
  await expect(roadmap.getByTestId('roadmap-next')).toContainText('チュートリアル1');
});

test('ドリル1は後半を1回抽出するとクリアし、再読み込み後も記録が残る', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('roadmap-open').click();
  await page.getByTestId('roadmap-view-concepts').click();
  await expect(page.getByTestId('concept-mastery-row').first()).toContainText('4件中0件クリア');
  await openDrill(page, 'drill-extract-tail');
  await extract(page, 'registerMember', ['歓迎メールの本文を組み立てる', '歓迎メールを送る']);
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
  await expect(page.locator('.concept-check')).toHaveCount(0);
  await expect(page.getByTestId('change-request-start')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ステージクリア' })).toBeVisible();
  await page.reload();
  await page.getByTestId('roadmap-open').click();
  await expect(page.getByTestId('roadmap-stage-drill-extract-tail')).toContainText('✅ クリア');
  await page.getByTestId('roadmap-view-concepts').click();
  await expect(page.getByTestId('concept-mastery-row').first()).toHaveAttribute('data-concept', 'Extract Method');
  await expect(page.getByTestId('concept-mastery-row').first()).toContainText('4件中1件クリア');
});

test('ドリル2は途中の1処理だけでは未完了で、2処理なら100点になる', async ({ page }) => {
  await openDrill(page, 'drill-extract-middle');
  await extract(page, 'issueInvoice', ['小計を計算する']);
  await expect(page.getByTestId('score-announcement')).not.toHaveText('100点');
  await page.getByRole('button', { name: '最初に戻す' }).click();
  await extract(page, 'issueInvoice', ['小計を計算する', '税額を計算する']);
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
});

test('ドリル3は送料計算をクラスへドラッグすると100点になる', async ({ page }) => {
  await openDrill(page, 'drill-move-method');
  const source = await page.getByTestId('method-calculateShippingFee').boundingBox();
  const target = await page.getByTestId('class-ShippingCalculator').boundingBox();
  if (source === null || target === null) throw new Error('ドラッグ対象が見つかりません');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
  await expect(page.getByTestId('class-ShippingCalculator')).toHaveClass(/class-node--drop-target/);
  await page.mouse.up();
  await expect(page.getByTestId('score-announcement')).toHaveText('100点');
});
