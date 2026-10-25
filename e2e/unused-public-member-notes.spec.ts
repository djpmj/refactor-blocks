import { expect, test, type Page } from '@playwright/test';
import { selectStage } from './selectStage.js';

/** 右クリックメニューの「別のクラスへ移動」で、メソッド・フィールドを別クラスへ移す。 */
async function moveViaMenu(page: Page, memberTestId: string, className: string) {
  await page.getByRole('button', { name: 'Fit View' }).click();
  await page.getByTestId(memberTestId).click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: '別のクラスへ移動' }).click();
  await menu.getByRole('menuitem', { name: className, exact: true }).click();
  await expect(page.getByTestId(`class-${className}`).getByTestId(memberTestId)).toBeVisible();
}

async function extractMethod(page: Page, from: string, labels: readonly string[], name: string) {
  await page.getByRole('button', { name: 'Fit View' }).click();
  await page.getByTestId(`method-${from}`).click();
  for (const label of labels) await page.getByLabel(label).check();
  await page.getByLabel('新しいメソッド名').fill(name);
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
}

test('中級7: 100点になる前は出ず、解答例どおりに100点にすると外から呼ばれない getter が一覧に出る', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '中級7: getter/setter だけの口座クラス');
  const note = page.getByTestId('unused-public-note');
  await expect(page.getByTestId('score-value')).not.toHaveText('100点');
  await expect(note).toHaveCount(0);

  // Act: 解答例の手順で debit・credit を Account へ移し、setter を private にする
  await extractMethod(page, 'withdraw', [
    'getStatus() で状態を取り出し、凍結されていないか確かめる',
    '残高と1日の引き出し上限から引き出せるか確かめる',
    '残高を減らし、本日の引き出し額を足して setter で書き戻す',
  ], 'debit');
  await moveViaMenu(page, 'method-debit', 'Account');
  await page.getByTestId('method-debit').click();
  await page.getByLabel('メソッド debit の可視性').selectOption('public');
  await extractMethod(page, 'deposit', ['getStatus() で状態を取り出し、凍結されていないか確かめる', '残高を増やして setBalance() で書き戻す'], 'credit');
  await moveViaMenu(page, 'method-credit', 'Account');
  await page.getByTestId('method-credit').click();
  await page.getByLabel('メソッド credit の可視性').selectOption('public');
  for (const setter of ['setBalance', 'setDailyWithdrawn']) {
    await page.getByTestId(`method-${setter}`).click();
    await page.getByLabel(`メソッド ${setter} の可視性`).selectOption('private');
  }

  // Assert
  await expect(page.getByTestId('score-value')).toHaveText('100点');
  await expect(note).toBeVisible();
  await expect(note).toContainText('外から使われていない公開メンバーがあります。隠せるものは隠すと、あとで中身を変えても外に影響しません');
  await expect(note).toContainText('メソッドエディタの「可視性」で private にできます');
  await expect(note.getByRole('listitem')).toHaveText(['Account.getBalance()', 'Account.getStatus()', 'Account.getDailyWithdrawn()']);

  // さらに良くできるところのカードが出る場合は、仕上げのヒントより上にある
  const room = page.getByTestId('room-to-improve-note');
  if (await room.count() > 0) {
    const [roomBox, noteBox] = await Promise.all([room.boundingBox(), note.boundingBox()]);
    expect(roomBox?.y ?? Infinity).toBeLessThan(noteBox?.y ?? 0);
  }

  // Act: 名前を押すとキャンバスで選ばれる
  await note.getByRole('button', { name: 'Account.getBalance()' }).click();

  // Assert
  await expect(page.getByTestId('method-getBalance').locator('.method-chip--selected')).toBeVisible();
});

test('中級6: 解答例どおりに100点にすると Subscription の外から使われていないフィールドが出る(可視性の案内は出ない)', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, '中級6: 他人のデータばかり触るメソッド');
  const note = page.getByTestId('unused-public-note');
  await expect(page.getByTestId('score-value')).not.toHaveText('100点');
  await expect(note).toHaveCount(0);

  // Act
  await extractMethod(page, 'renewSubscription', ['トライアル期間中なら請求しない'], 'isInTrial');
  await moveViaMenu(page, 'method-isInTrial', 'Subscription');
  await moveViaMenu(page, 'field-trialDays', 'Subscription');
  await extractMethod(page, 'renewSubscription', ['解約済み・支払い停止中なら請求しない。それ以外は席数と単価から今月の請求額を計算する'], 'monthlyFee');
  await moveViaMenu(page, 'method-monthlyFee', 'Subscription');
  await extractMethod(page, 'cancelSubscription', ['解約できる状態か確かめる', '状態を解約済みにし、解約日を記録する'], 'cancel');
  await moveViaMenu(page, 'method-cancel', 'Subscription');

  // Assert
  await expect(page.getByTestId('score-value')).toHaveText('100点');
  await expect(note).toBeVisible();
  await expect(note.getByRole('listitem')).toHaveText([
    'Subscription.status(フィールド)',
    'Subscription.startedAt(フィールド)',
    'Subscription.seats(フィールド)',
    'Subscription.unitPrice(フィールド)',
    'Subscription.canceledAt(フィールド)',
  ]);
  await expect(note).not.toContainText('可視性');

  // Act: 名前を押すとキャンバスでそのフィールドが選ばれる
  await note.getByRole('button', { name: 'Subscription.status(フィールド)' }).click();

  // Assert
  await expect(page.getByTestId('field-status')).toHaveAttribute('aria-pressed', 'true');
});
