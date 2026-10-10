import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('メソッドエディタが次の操作を示し、抽出できる状態を明確にする', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  const emptyState = page.getByTestId('method-editor-empty');
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toContainText('👈');
  await expect(emptyState).toContainText('中央の図から、直したいメソッドをクリックしてみよう');

  // Act: メソッドを選ぶ
  const method = page.getByTestId('method-printMonthlyReport');
  await expect(method).toHaveAttribute('title', 'クリックで中身を表示 / ドラッグで別のクラスへ移動 / ダブルクリックで名前を変更');
  await method.click();

  // Assert: 最初は未選択なので抽出できない
  await expect(emptyState).toHaveCount(0);
  const extract = page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' });
  await expect(extract).toBeDisabled();
  await expect(page.getByText('処理を1つ以上選ぶと押せます')).toBeVisible();

  // Act: 処理を選ぶ
  const fragment = page.getByRole('checkbox').first();
  await fragment.check();

  // Assert: 抽出ボタンが有効になり、説明が消える
  await expect(extract).toBeEnabled();
  await expect(extract).toHaveClass(/button--primary/);
  await expect(page.getByText('処理を1つ以上選ぶと押せます')).toHaveCount(0);

  // Act: 選択を外し、名前も空にする
  await fragment.uncheck();
  await expect(extract).toBeDisabled();
  await fragment.check();
  const name = page.getByLabel('新しいメソッド名');
  await name.fill(' ');
  await expect(page.getByText('メソッド名を入れると押せます')).toBeVisible();
});

test('ブロックのホバー説明と空状態の案内を出し、手動修正中の説明も切り替える', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, '中級6: 他人のデータばかり触るメソッド');

  // Assert: キャンバスの各種ブロックが操作を説明する
  const method = page.getByTestId('method-renewSubscription');
  await expect(method).toHaveAttribute('title', 'クリックで中身を表示 / ドラッグで別のクラスへ移動 / ダブルクリックで名前を変更');
  await expect(page.getByTestId('field-trialDays')).toHaveAttribute('title', 'クリックで説明を表示 / ドラッグで別のクラスへ移動');
  await expect(page.getByTestId('class-header-Subscription')).toHaveAttribute('title', 'ドラッグで別のファイルへ移動 / ダブルクリックで名前を変更');

  // Act: メソッドを選択して案内を閉じ、選択解除で再表示
  await method.click();
  await expect(page.getByTestId('method-editor-empty')).toHaveCount(0);
  await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } });
  await expect(page.getByTestId('method-editor-empty')).toBeVisible();

  // Act: 手動修正シミュレーションを始める
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');
  await page.locator('.change-pain summary').click();
  await page.getByRole('button', { name: '実際に直してみる' }).click();

  // Assert
  await expect(page.getByTestId('method-confirm')).toHaveAttribute('title', 'クリックで「直した」印を付け外し');
});
