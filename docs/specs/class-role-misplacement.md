# 用意されたクラスに「役割」を持たせ、役割と違う処理を入れたら減点する

## 背景・目的

チュートリアル2「太った placeOrder」で、**税の計算を `OrderService` に残したまま100点になる**抜け道が見つかった。

再現手順: `placeOrder` から「注文をDBに保存する」「確認メールを送る」を1つのメソッド
(`saveOrderAndSendConfirmationMail`)として抽出し、それを `TaxCalculator` へドラッグで移す。

このとき、どの採点ルールにも当たらない。

- `OrderService` の責務は検証・小計・税の3種類(呼び出し行 `call` は数えない)で、上限4種類以内
- `TaxCalculator` は保存・通知の2種類で、空のクラスでもない
- 行数・依存先の数も上限以内

原因は、採点が「`TaxCalculator` は税の置き場所として用意されたクラス」という意図を知らないこと。
ステージの理解度チェック・`goal`・変更依頼(軽減税率)はすべて「税を `TaxCalculator` に分ける」前提なので、
税を分けずに100点になると、学ばせたいことと採点が食い違う。

ステージ作者が移し先として用意したクラスに、隠しタグで**役割(置いてよい責務)**を持たせ、
役割と違う責務の処理が入っていたら減点する、一般的なルールを足す。初期状態で空のクラスを持つ全ステージに役割を付ける(ユーザー決定)。

## ルールの定義

- `CodeClass` に省略可能な `roleResponsibilities?: readonly string[]` を足す。Fragment の `responsibility` と同じ値で、
  「このクラスに置いてよい責務」を表す。`responsibility`・`duplicateGroup` と同じく**プレイヤーには表示しない**隠しタグ
- 採点ルール `'misplaced'`(表示名「役割と違う処理が入ったクラス」): `roleResponsibilities` を持つクラスのうち、
  メソッドの中に `roleResponsibilities` に含まれない責務のFragmentが1つ以上あるクラスを、**1クラスにつき1件**の違反として数える(1件10点、既存ルールと同じ)
  - 呼び出し行(`CALL_RESPONSIBILITY`)は対象外(役割の処理から別クラスを呼ぶのは正当なため。`findResponsibilityViolations` と同じ扱い)
  - `roleResponsibilities` を持たないクラスは対象外(既存ステージの他のクラスの採点は変わらない)
- クラスの中身を空にしたまま役割の処理を元のクラスに残す、という逃げ方は、既存の「空のクラス」ルール(`'empty'`)で減点されるので、新ルールでは扱わない
- 減点の内訳・違反箇所の表示では、責務名(`tax` など)は出さず、役割と違う処理の `label`(例: 「注文をDBに保存する」「確認メールを送る」)をクラス名と一緒に出す

## 変更対象ファイル一覧

### 新規

- `src/domain/scoring/misplacedResponsibilities.ts`(domain): `findMisplacedResponsibilities(codebase)` — 違反クラスと、役割と違う Fragment の一覧を返す純粋関数
- `src/domain/scoring/misplacedResponsibilities.test.ts`(domain・TDD対象)

### 変更

- `src/domain/codebase/Codebase.ts`(domain): `CodeClass` に `roleResponsibilities?: readonly string[]` を足す(コメントで隠しタグであることを書く)
- `src/domain/codebase/isCodebase.ts`(domain): ステージ定義の読み込み時の型ガードで、`roleResponsibilities` があれば文字列の配列であることを検証する(信頼境界の入力検証)
- リファクタリング操作(`domain/codebase/` の Extract Class・Move Class・Rename Class・クラスの複製や統合など、`CodeClass` を作り直す操作)で、
  既存クラスの `roleResponsibilities` が失われないようにする(スプレッドで引き継いでいれば変更不要。新しく作るクラスには付けない)
- `src/domain/scoring/score.ts`(domain): `ScoreRule` に `'misplaced'` を足し、`scoreCodebase` の集計・減点の並びに加える
- `src/domain/scoring/violationTargets.ts`(domain): 違反箇所の対象(クラス)に `'misplaced'` を足す。ほかのルールと同じく、減点の内訳から該当クラスへ移動・ハイライトできるようにする
- `src/presentation/stage/describeScore.ts`・`src/presentation/stage/ruleWhy.ts`(presentation): 表示名「役割と違う処理が入ったクラス」と、
  「なぜ減点?」の説明(用意されたクラスは決まった役割の置き場所で、別の理由で変わる処理を混ぜると、そのクラスを直す理由が増える、という趣旨)を足す
- `Record<ScoreRule, …>` を持つその他のファイル(型エラーで分かる)にも `'misplaced'` を足す
- `src/infrastructure/stages/*.ts`(infrastructure): 初期状態で空のクラスに `roleResponsibilities` を付ける。対象(調査時点):

  | ファイル | ステージ | クラス |
  | --- | --- | --- |
  | `tutorialStages.ts` | チュートリアル2(`orderServiceStage`) | `TaxCalculator`(`['tax']`) |
  | `beginnerStages.ts` | `userControllerStage` | `Mailer`・`UserRepository` |
  | `intermediateStages.ts` | `copyPasteTaxStage` | `TaxCalculator` |
  | `intermediateStages.ts` | `featureEnvyStage` | `Subscription` |
  | `intermediateStages.ts` | `layeredOrderApiStage` | `OrderService`・`OrderRepository` |
  | `advancedStages.ts` | `notifierHierarchyStage` | `NotifierBase` |
  | `advancedStages.ts` | `reportFactoryStage` | `ReportFactory` |

  - 値は、**そのステージの模範解答の最終状態で、そのクラスに置かれている責務(`call` を除く)**にする。模範解答で空のままのクラス・
    メソッドを持たないインターフェースは付けない
  - 実装時に `methods: []` のクラスを grep し直し、上の表から漏れているものがあれば同じ基準で付ける
- `docs/stages/report.md`: `npm run stage-report` で再生成する(変化があれば)
- `e2e/`: チュートリアル2の抜け道の手順で100点にならないことを確かめるケースを、既存のチュートリアル2のE2E(`e2e/refactor.spec.ts` など)に足す

## データ・型の変更

```ts
export type CodeClass = {
  // …既存のフィールド
  /**
   * ステージ作者が移し先として用意したクラスの役割。このクラスに置いてよい責務(Fragment の responsibility)。
   * responsibility と同じくプレイヤーには表示しない隠しタグ。省略時は役割の採点をしない。
   */
  readonly roleResponsibilities?: readonly string[];
};
```

ステージ定義の保存形式(自動保存の下書き)に `CodeClass` がそのまま入る場合も、省略可能なフィールドの追加なので、既存の下書きは読み込める
(読み込んだ下書きに `roleResponsibilities` が無い場合は、ステージ定義の初期状態から引き継ぐかどうかを実装時に確認する。引き継がないと、
保存済みの下書きでは抜け道が残るため、引き継ぐ形にする)。

## TDD対象の純粋関数

`findMisplacedResponsibilities(codebase)`(`misplacedResponsibilities.test.ts`):

- 役割 `['tax']` のクラスに `tax` の処理だけ → 違反なし
- 役割 `['tax']` のクラスに `persistence` と `notification` の処理 → そのクラスが1件。役割と違う Fragment 2つ(label つき)を返す
- 役割 `['tax']` のクラスに `tax` と `persistence` → 1件(違う Fragment は `persistence` の1つ)
- 役割を持つクラスに `call` の処理だけ → 違反なし
- 役割を持つクラスが空 → 違反なし(空は `'empty'` ルールの担当)
- 役割を持たないクラスに何が入っていても → 違反なし
- 役割 `['persistence', 'notification']` のように複数の責務 → どちらも置いてよい

`scoreCodebase`(`score.test.ts`):

- チュートリアル2の抜け道の状態(保存+メールを抽出して `TaxCalculator` へ移す)→ `'misplaced'` が1件で、100点にならない

ステージの回帰テスト(既存の模範解答のテストに追加):

- 役割を付けた全ステージで、模範解答の最終状態に `'misplaced'` の違反が出ない(100点のまま)
- 役割を付けた全ステージで、初期状態の点数・減点の内訳が変わらない

## 受け入れ基準

- `npm run check` と `npm run test:e2e` がすべて通る
- チュートリアル2で、保存とメール送信を抽出して `TaxCalculator` へ移す(税の計算は `OrderService` に残す)と、100点にならず、
  減点の内訳に「役割と違う処理が入ったクラス」が出る。違反箇所として `TaxCalculator` と、「注文をDBに保存する」「確認メールを送る」が分かる
- チュートリアル2で、税の計算を抽出して `TaxCalculator` へ移す本来の手順では、今どおり100点になる
- 役割を付けた全ステージで、模範解答の最終状態は100点のまま、初期状態の点数は変わらない
- 責務名(`tax` など)が画面に出ない
- リファクタリング操作の後も、用意されたクラスの役割は保たれる。自動保存の下書きから再開しても、抜け道の手順で100点にならない

## スコープ外

- 役割を持つクラスに、役割の処理が**足りない**ことを減点するルール(空でなければよい。必要になったら別Issue)
- 初期状態で中身のあるクラスへの役割の付与
- 役割をプレイヤーに見せる表示(クラスノードに「税の計算用」と出す、など)
- クラス名から役割を推測する仕組み
