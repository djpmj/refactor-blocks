# C#エクスポート: 中級のステージを実行できるようにする

C#実行可能エクスポートの6本のうち5本目。前提は `csharp-runnable-stages-basic`(4本目)まで。

## 背景・目的

4本目でチュートリアル・ドリル・初級を実行できるようにした。このIssueでは、中級の12ステージを同じ形に整える。

- `intermediate-cyclic-dependency`・`intermediate-god-file`・`intermediate-misplaced-private`・`intermediate-volatile-tax`
- `intermediate-volatile-format`・`intermediate-feature-envy`・`intermediate-anemic-domain-model`・`intermediate-extract-class`
- `intermediate-copy-paste-tax`・`intermediate-member-rank-branching`・`intermediate-layered-order-api`・`intermediate-middle-man`

中級では、次のような構造がコードに出てくる。

- クラス間の循環依存(中級1)
- 越境する `private`(中級3)
- フィールドの移動(中級6〜8)
- 重複コードの統合(中級9)
- 条件分岐のクラス化(中級10)
- 層の分離(中級11)
- 横流しクラスの Inline(中級12)

これらを含む模範解答の各手順で、ビルドが通り、出力が変わらないことを確かめる。

## 進め方

`docs/specs/csharp-runnable-stages-basic.md` の「共通の進め方」1〜5に従う。中級で特に注意すること:

- **中級1(循環依存)**: 初期状態は循環しているので、`csharp-move-wiring` のプロパティ代入で組み立てられる。
  循環を断ったあとはコンストラクタ注入だけになる。どちらも同じ出力になることを確かめる
- **中級3(越境する private)**: 初期状態で「ビルドが通らない箇所」が出るなら、それはこのステージで学ぶ問題そのもの。
  この場合、初期状態のビルド失敗は許す。ダイアログの一覧に出ることを確かめ、模範解答の完成形がビルド・実行できることを受け入れ基準にする。
  検証スクリプトで、ビルド失敗を許すスナップショットを `runtime` に書けるよう、
  `StageRuntime` に `readonly expectedBuildFailures?: readonly string[]`(スナップショット名: `'initial'`・`'01'` …)を足す。
  `scripts/verify-csharp.sh` は、ここに書いたものだけビルド失敗を成功として扱う。
  さらに出力の比較は、ビルドできた最初のスナップショットを基準にする
- **中級9(コピペの統合)**: `duplicateGroup` が同じ処理は、統合前も統合後も同じ出力になるよう、コードを文字どおり同じにする(今もそうなっているはず。崩さない)
- **中級6〜8(フィールドの移動)**: 移動するフィールドに `Field.type.csharp` を必ず書く

## 変更対象ファイル一覧

### 新規

- `src/infrastructure/stages/runtime/<stageId>.ts` を中級の12ステージ分(infrastructure)

### 変更

- `src/infrastructure/stages/intermediateStages.ts`(infrastructure):
  `runtime` の追加、`Fragment.code.csharp` の修正(行数は変えない)、`variables`・`parameters`・`Field.type` の記入
- `src/domain/stage/StageRuntime.ts`(domain): `expectedBuildFailures?` を足す(上記)
- `src/domain/codebase/csharpExport.export.test.ts`・`scripts/verify-csharp.sh`: `expectedBuildFailures` の扱いを足す

## データ・型の変更

- `StageRuntime.expectedBuildFailures?: readonly string[]` を追加する

## TDD対象の純粋関数

新しい純粋関数はない。4本目で足した `stageCode.test.ts` の変数の検査を、中級の各ステージで Red → Green にする。
`expectedBuildFailures` を書いたスナップショットが、本当に `findBuildIssues` で1件以上になることも、同じテストで確かめる
(書いただけで実際は通る、という食い違いを防ぐ)。

## 受け入れ基準

1. 中級の12ステージすべてで、「ソースをダウンロード(C#)」が出る
2. 初期状態(`expectedBuildFailures` に書いたものを除く)と、模範解答の各手順・完成形がビルドでき、出力が一致する
3. 中級1の初期状態(循環あり)もビルド・実行できる
4. CI の `csharp` ジョブが、中級を含む全スナップショットで成功する
5. `npm run stage-report` で `docs/stages/report.md` に差分が出ない
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 上級のステージ(6本目)
- 変更依頼のコード
- 模範解答と違う組み替え方での、ビルドの保証
