import { expect, test } from '@playwright/test';
import { selectStage } from './selectStage.js';

test('未選択の右パネルを帯に畳み、キーボードでも案内を開ける', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');

  // Assert
  const rail = page.getByTestId('editor-rail');
  await expect(rail).toHaveCSS('width', '48px');
  await expect(page.getByRole('separator', { name: 'サイドバーの幅を変更' })).toHaveCount(0);

  // Act
  await rail.focus();
  await page.keyboard.press('Space');

  // Assert
  await expect(page.getByTestId('method-editor-empty')).toBeVisible();
  await page.getByRole('button', { name: '案内を閉じる' }).click();
  await expect(rail).toBeVisible();

  // Act
  await page.getByTestId('method-printMonthlyReport').click();

  // Assert
  await expect(page.getByTestId('editor-rail')).toHaveCount(0);
  const sidebar = page.locator('.sidebar-resizable').last();
  await expect(sidebar).toHaveCSS('width', '360px');
  await page.locator('.react-flow__pane').click({ position: { x: 10, y: 100 } });
  await expect(page.getByTestId('editor-rail')).toBeVisible();
});

test('ステージ変更後と手動修正終了後は開いていた空の案内を帯へ戻す', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('editor-rail').click();
  await expect(page.getByTestId('method-editor-empty')).toBeVisible();

  // Act
  await selectStage(page, '中級9: コピペされた消費税計算を1か所にまとめる');

  // Assert
  await expect(page.getByTestId('editor-rail')).toBeVisible();
  await expect(page.locator('.sidebar-resizable')).toHaveCSS('width', '48px');

  // Act: 手動修正を始めて中止する
  await page.getByTestId('editor-rail').click();
  await page.locator('.change-pain summary').click();
  await page.getByRole('button', { name: '実際に直してみる' }).click();
  await expect(page.getByRole('region', { name: '手で直すシミュレーション' })).toBeVisible();
  await page.getByRole('button', { name: 'やめる' }).click();

  // Assert
  await expect(page.getByTestId('editor-rail')).toBeVisible();
  await expect(page.locator('.sidebar-resizable')).toHaveCSS('width', '48px');
});

test('抽出プレビューにファイル全体の増加行数を表示する', async ({ page }) => {
  // Arrange
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('editor-rail').click();
  await page.getByTestId('method-printMonthlyReport').click();

  // Act
  await page.getByRole('checkbox', { name: '今月の売上を集計する' }).check();

  // Assert
  await expect(page.locator('.method-editor__extract-preview')).toContainText(/ファイルは \+\d+行: 宣言と呼び出しの分/);
});

test('抽出の行数通知は一度だけで、集計をまとめると痛みの傾向も消える', async ({ page }) => {
  // Arrange
  const notice = '抽出すると、新しいメソッドの宣言と呼び出しの分だけ合計の行数は少し増えます。1つのメソッドが短くなり、読む範囲が絞れることが大事です';
  await page.setViewportSize({ width: 1800, height: 1400 });
  await page.goto('/');
  await selectStage(page, 'チュートリアル1: 長いメソッドを分ける');
  await page.getByTestId('editor-rail').click();
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByRole('checkbox', { name: '今月の売上を集計する' }).check();

  // Act: 集計の一部だけを抽出する
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Assert
  await expect(page.locator('.error-toast[role="status"]')).toContainText(notice);
  await expect(page.getByTestId('pain-trend')).toContainText('今は 2 か所に分かれています');

  // Act: Undoし、集計の処理をまとめて抽出する
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.getByTestId('pain-trend')).toHaveCount(0);
  await page.getByTestId('method-printMonthlyReport').click();
  await page.getByRole('checkbox', { name: '今月の売上を集計する' }).check();
  await page.getByRole('checkbox', { name: '前月比を計算する' }).check();
  await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();

  // Assert
  await expect(page.getByTestId('pain-trend')).toHaveCount(0);
  await expect(page.locator('.error-toast[role="status"]').filter({ hasText: notice })).toHaveCount(0);
});
