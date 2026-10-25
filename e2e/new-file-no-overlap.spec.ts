import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

type Box = { x: number; y: number; width: number; height: number };

async function box(page: Page, testId: string): Promise<Box> {
  const found = await page.getByTestId(testId).boundingBox();
  if (found === null) throw new Error(`${testId} の座標を取得できません`);
  return found;
}

async function dragMethodTo(page: Page, methodId: string, x: number, y: number) {
  await dragTo(page, methodId, x, y);
}

async function dragTo(page: Page, testId: string, x: number, y: number) {
  const method = await box(page, testId);
  // ドラッグ中の表示(DragOverlay)が元のファイルに重ならないよう、メソッドの左端をつかむ
  await page.mouse.move(method.x + 10, method.y + method.height / 2);
  await page.mouse.down();
  await page.mouse.move(method.x + 30, method.y + method.height / 2, { steps: 5 });
  await page.mouse.move(x, y, { steps: 15 });
  await page.mouse.up();
}

async function openStage(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await selectStage(page, '初級2: クラスを自分で作る');
  // 画面を縮め、ドラッグ中の表示が元のファイルに触れない余白を作る
  await page.getByRole('button', { name: /zoom out|縮小/i }).click();
  await page.getByRole('button', { name: /zoom out|縮小/i }).click();
  await page.waitForTimeout(500);
}

async function newFileTestId(page: Page, before: readonly string[]): Promise<string> {
  const ids = async () => page.locator('[data-testid^="file-src/"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
  await expect.poll(async () => (await ids()).length).toBe(before.length + 1);
  const created = (await ids()).find((id) => !before.includes(id));
  if (created === undefined) throw new Error('新しいファイルが見つかりません');
  return created;
}

const fileIds = (page: Page) => page.locator('[data-testid^="file-src/"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));

test('元のファイルのすぐ右の余白へ落としても、新しいファイルが元のファイルと重ならない', async ({ page }) => {
  // Arrange
  await openStage(page);
  const before = await fileIds(page);
  const source = before.map((id) => id).find((id) => id.includes('InvoiceService'));
  if (source === undefined) throw new Error('元のファイルが見つかりません');
  const sourceBox = await box(page, source);

  // Act: 元のファイルの右端から少しだけ右の余白(新しい箱は約300px幅なので、素直に置くと重なる位置)へ落とす
  await dragMethodTo(page, 'method-issueInvoice', sourceBox.x + sourceBox.width + 25, sourceBox.y + sourceBox.height - 40);

  // Assert: 外接矩形が交わらない
  const created = await newFileTestId(page, before);
  await page.waitForTimeout(250);
  const a = await box(page, source);
  const b = await box(page, created);
  const intersects = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  expect(intersects).toBe(false);
});

test('元のファイルから十分離れた余白へ落としたときは、落とした点を中心に置かれる', async ({ page }) => {
  // Arrange: 元のファイルの真下の余白(新しい箱がぶつからない位置)
  await openStage(page);
  const before = await fileIds(page);
  const source = before.find((id) => id.includes('InvoiceService'));
  if (source === undefined) throw new Error('元のファイルが見つかりません');
  const sourceBox = await box(page, source);
  const dropX = sourceBox.x + sourceBox.width / 2;
  const dropY = sourceBox.y + sourceBox.height + 90;

  // Act
  await dragMethodTo(page, 'method-issueInvoice', dropX, dropY);

  // Assert: 箱の中心x が落とした点のxと一致し、右へずらされていない
  const created = await newFileTestId(page, before);
  await page.waitForTimeout(250);
  const b = await box(page, created);
  expect(Math.abs(b.x + b.width / 2 - dropX)).toBeLessThan(4);
});

test('「整列」は新しいファイルを、今までどおりの並びに並べ直す', async ({ page }) => {
  // Arrange: 元のファイルの真下の余白へ落とす(整列前は、元のファイルの下にいる)
  await openStage(page);
  const before = await fileIds(page);
  const source = before.find((id) => id.includes('InvoiceService'));
  if (source === undefined) throw new Error('元のファイルが見つかりません');
  const sourceBox = await box(page, source);
  await dragMethodTo(page, 'method-issueInvoice', sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height + 90);
  const created = await newFileTestId(page, before);
  await page.waitForTimeout(250);
  expect((await box(page, created)).y).toBeGreaterThan((await box(page, source)).y + 100);

  // Act
  await page.getByTestId('canvas-arrange').click();

  // Assert: 依存のない2つのファイルは同じ高さに、重ならず横へ並ぶ
  await expect.poll(async () => Math.abs((await box(page, created)).y - (await box(page, source)).y)).toBeLessThan(2);
  const a = await box(page, source);
  const b = await box(page, created);
  expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
});

// ファイルの箱の幅(CLASS_WIDTH 280 + 余白 24×2)。画面上の倍率を求めるのに使う
const FILE_WIDTH = 328;

test('複数メソッドを持つクラスを既存ファイルのすぐ上の余白へ落としても、新しいファイルが重ならない', async ({ page }) => {
  // Arrange: 2メソッドのクラス(空クラス用の寸法より約18px高い)。新しい箱の下端が、空クラス用の高さだと既存ファイルの手前に収まって見える位置へ落とす
  await openStage(page);
  const before = await fileIds(page);
  const source = before.find((id) => id.includes('InvoiceService'));
  if (source === undefined) throw new Error('元のファイルが見つかりません');
  const sourceBox = await box(page, source);
  const scale = sourceBox.width / FILE_WIDTH;
  const dropX = sourceBox.x + sourceBox.width / 2;
  const dropY = sourceBox.y - (203 - 18) * scale;

  // Act
  await dragTo(page, 'class-header-InvoiceService', dropX, dropY);

  // Assert: 外接矩形が交わらない
  const created = await newFileTestId(page, before);
  await page.waitForTimeout(250);
  const a = await box(page, source);
  const b = await box(page, created);
  const intersects = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  expect(intersects).toBe(false);
});

test('複数メソッドを持つクラスを既存ファイルのすぐ右の余白へ落としても、新しいファイルが重ならない', async ({ page }) => {
  // Arrange
  await openStage(page);
  const before = await fileIds(page);
  const source = before.find((id) => id.includes('InvoiceService'));
  if (source === undefined) throw new Error('元のファイルが見つかりません');
  const sourceBox = await box(page, source);

  // Act
  await dragTo(page, 'class-header-InvoiceService', sourceBox.x + sourceBox.width + 25, sourceBox.y + sourceBox.height - 40);

  // Assert
  const created = await newFileTestId(page, before);
  await page.waitForTimeout(250);
  const a = await box(page, source);
  const b = await box(page, created);
  const intersects = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  expect(intersects).toBe(false);
});
