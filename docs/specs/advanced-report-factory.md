# 上級4: オブジェクト生成処理をFactoryへ集約する

## 背景・目的

上級1〜3はどれも継承(extends/implements)を使う組み替えだった(共通処理を基底クラスへ/インターフェース越しの呼び出し/Strategy)。
継承を使わずに「複製された生成処理を1箇所にまとめる」という、より単純で頻度の高いリファクタリング(Fowlerの
Replace Constructor with Factory Method に近い、いわゆるFactory)も学ばせたい。既存の `mergeMethods`
(Merge Methods、本物の重複を1つに統合する)と `moveMethod`(別クラスへ移す)だけで表現でき、
`setSuperclass` は使わない。上級1(継承)との対比を description・goal で明示する。

## 受け入れ条件

### `src/infrastructure/stages/advancedStages.ts` に新しいステージを追加する

- ステージID: `advanced-report-factory`
- タイトル: `上級4: レポート生成処理をFactoryへ集約する`
- 題材: `WeeklyReportController`(`src/report/WeeklyReportController.ts`)と
  `MonthlyReportController`(`src/report/MonthlyReportController.ts`)が、それぞれ
  「データを集計する」「レポートオブジェクトを組み立てる」「レポートを送信する」の3つの処理を1つの
  メソッドに詰め込んでいる。「レポートオブジェクトを組み立てる」だけは2クラスで内容が完全に同じ
  (コピペの重複、`duplicateGroup: 'report-building'`)。空のクラス `ReportFactory`
  (`src/report/ReportFactory.ts`)は用意されているが、まだ何も移されていない
- Fragment構成(行数は目安、実業務規模の80行以上メソッドを維持すること):
  - `WeeklyReportController.exportWeeklyReport`(public): 週次データを集計する(42行, `data-aggregation`) /
    レポートオブジェクトを組み立てる(28行, `report-building`, `duplicateGroup: 'report-building'`) /
    レポートを送信する(22行, `report-delivery`)
  - `MonthlyReportController.exportMonthlyReport`(public): 月次データを集計する(44行, `data-aggregation`) /
    レポートオブジェクトを組み立てる(26行, `report-building`, `duplicateGroup: 'report-building'`) /
    レポートを送信する(22行, `report-delivery`)
  - 行数はメソッド1つあたり+2行(シグネチャ・閉じ括弧の分、`METHOD_OVERHEAD_LINES`)が加算されることを踏まえて
    上限を割り込むよう調整すること
- `limits`: `{ method: 70, class: 230, file: 380 }`、`dependencyLimit: 1`、`responsibilityLimit: 2`
- `changeRequests`(2件、どちらも初期コードに変更箇所がある):
  - `report-building` 責務への依頼(帳票タイトルの書式見直しなど)。統合前は2クラスに散らばっているが、
    Factoryへ集約すると1クラスで済むようになる(変更容易性が上がることを`stageCatalog.test.ts`が確認する)
  - `report-delivery` 責務への依頼(送信の再送処理など)。このステージでは集約しないので、影響クラス数は
    集約前後で変わらない(悪化はしない)
- ファイル冒頭に、上級1(継承)との違いを説明するコメントを付ける

### `src/domain/stage/sampleAnswer.ts`

- `sampleAnswerSteps['advanced-report-factory']` に模範解答を追加する:
  1. `exportWeeklyReport` から `report-building` のFragmentを `buildWeeklyReport` として抽出
  2. `exportMonthlyReport` から同様に `buildMonthlyReport` として抽出
  3. `buildWeeklyReport` と `buildMonthlyReport` を Merge Methods で `buildReport` に統合
     (統合先は自動的に `WeeklyReportController`側に残る)
  4. `buildReport` を `ReportFactory` へ Move Method
  - `setSuperclass` の手順は使わない(継承なしで解ける、というこのステージの狙い)

### テスト

- `stageCatalog.test.ts` の `describe.each` は全ステージに自動適用されるため、新規テストの追加は不要。
  既存の受け入れ基準(80行以上のメソッドがある/初期は減点がある/模範解答で100点になる/変更依頼のコストが
  下がる/影響クラス数が増えない、など)がこの新ステージでも満たされることを `npm test` で確認する
- `advancedStages.test.ts` があれば内容を確認し、新ステージがそこでも扱われるべきか判断する

## スコープ外

- Observer・Decorator・Template Methodなど他のデザインパターンは扱わない(今回は1ステージのみ追加)
- `ReportFactory` に複数の生成メソッド(週次用・月次用を分けたFactory Method本来の形)を持たせることはしない。
  今回は「重複した生成ロジックを1箇所にまとめる」までをスコープとする(YAGNI)
