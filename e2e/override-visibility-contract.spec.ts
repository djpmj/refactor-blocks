import { expect, test } from '@playwright/test';
import { expectDeduction, expectNoDeduction } from './scoreBreakdown.js';
import { selectStage } from './selectStage.js';

const OWNERS = [
  ['CsvOrderImporter', 'CSVの列を注文データに変換する'],
  ['JsonOrderImporter', 'JSONの項目を注文データに変換する'],
] as const;

test('上級8: 子のparseをprivateで上書きすると約束違反になり、protectedにすると消える', async ({ page }) => {
  // Arrange: 変換処理をparseとして抽出し(private)、継承元をOrderImporterにする
  await page.goto('/');
  await selectStage(page, '上級8: 取り込みの手順を Template Method にまとめる');
  for (const [owner, parseLabel] of OWNERS) {
    await page.getByTestId(`class-${owner}`).getByTestId('method-importOrders').click();
    await page.getByLabel(parseLabel).check();
    await page.getByLabel('新しいメソッド名').fill('parse');
    await page.getByRole('button', { name: '選んだ処理をメソッドとして抽出' }).click();
    await page.getByTestId(`class-header-${owner}`).click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await menu.getByRole('menuitem', { name: '継承元を設定' }).click();
    await menu.getByRole('menu', { name: '継承元を設定' }).getByRole('menuitem', { name: 'OrderImporter', exact: true }).click();
  }

  // Assert: 狭めた上書き2件が約束違反になり、「なぜ?」に理由が出る
  await expectDeduction(page, 'インターフェースの約束違反 ×2');
  const item = page.locator('.score-breakdown__item', { hasText: 'インターフェースの約束違反' });
  await item.getByRole('button', { name: 'なぜ?' }).click();
  await expect(item.locator('.score-breakdown__why')).toContainText('親のメソッドを上書きするときは、公開範囲を狭められません');

  // Act: 理由を読み終えたら内訳を閉じ(開いたままだとキャンバスの左側に被さる)、2つのparseをprotectedにする
  await page.locator('.score-breakdown summary').click();
  for (const [owner] of OWNERS) {
    await page.getByTestId(`class-${owner}`).getByTestId('method-parse').click();
    await page.getByLabel('メソッド parse の可視性').selectOption('protected');
  }

  // Assert
  await expectNoDeduction(page, 'インターフェースの約束違反');
});
