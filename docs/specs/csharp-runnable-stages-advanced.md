# C#エクスポート: 上級のステージを実行できるようにする

C#実行可能エクスポートの6本のうち6本目(最後)。前提は `csharp-runnable-stages-intermediate`(5本目)まで。

## 背景・目的

中級までを実行できるようにした。このIssueでは、上級の9ステージを同じ形に整え、全ステージでダウンロードと実行ができる状態にする。

- `advanced-notifier-hierarchy`・`advanced-payment-gateway-interface`・`advanced-discount-strategy`
- `advanced-report-factory`・`advanced-collapse-hierarchy`・`advanced-interface-segregation`
- `advanced-value-object`・`advanced-template-method`・`advanced-order-state`

上級では、継承・インターフェース・デザインパターン(Strategy・Factory・Template Method・State)・値オブジェクトがコードに出る。
1〜3本目のコード生成では足りない部分(下記)を、このIssueで生成側に足す。

## 進め方

`docs/specs/csharp-runnable-stages-basic.md` の「共通の進め方」1〜5と、
`csharp-runnable-stages-intermediate.md` の `expectedBuildFailures` の扱いに従う。

上級で、コード生成に足すもの:

- **インターフェース**(`isInterfaceLike` のクラス): `public interface I…` として出す。メソッドは本体なしの宣言(`decimal Calculate(Order order);`)にする。
  実装クラスのメソッドは `public` のまま出す
- **継承**:
  - 基底クラスで本体の無いメソッドは `public abstract` にし、クラスも `abstract class` にする
  - 子クラスで同名・同じ引数のメソッドは `public override` にする
  - 子の呼び出しから基底へ移したメソッド(Pull Up)は `protected` のまま出す
- **複数の実装**(Strategy・State など): どれを注入するかを `runtime.bindings` に書く。
  実行時に実装を切り替える題材(State など)は、切り替えをゲームのブロックとしてではなく、補助コード(`support`)かフィールドの初期値として書く
- **値オブジェクト**(`advanced-value-object`): `Money` のような型は、ゲームのクラスとして出す。
  `record` にはせず、ゲームのクラス生成のまま `public class` で出す(ゲームの見た目と一致させる)

これらの生成の変更は `src/domain/codebase/generateClassSource.ts` / `csharpProject.ts` に入れ、Vitest で先にテストを書く(下記)。

## 変更対象ファイル一覧

### 新規

- `src/infrastructure/stages/runtime/<stageId>.ts` を上級の9ステージ分(infrastructure)

### 変更

- `src/infrastructure/stages/advancedStages.ts`(infrastructure):
  `runtime` の追加、`Fragment.code.csharp` の修正(行数は変えない)、`variables`・`parameters`・`returns`・`Field.type` の記入
- `src/domain/codebase/generateClassSource.ts`(domain): インターフェース・`abstract`・`override` の生成(上記)
- `src/domain/codebase/csharpWiring.ts`(domain): 必要なら、インターフェース型の依存の解決を直す(3本目の `bindings` の扱いで足りなければ)

## データ・型の変更

なし(既存の `superclassId`・`interfaceIds`・`isInterfaceLike` から生成する)。

## TDD対象の純粋関数

`generateClassSourceLines`(既存テストに追加)

1. `isInterfaceLike` のクラスが `public interface` になり、メソッドが本体なしの宣言になる
2. 本体の無いメソッドを持つ基底クラスが `public abstract class` になり、そのメソッドが `public abstract` になる
3. 基底と同じ名前・同じ引数の子のメソッドが `public override` になる
4. 継承もインターフェースも無いクラスの出力は、今までと変わらない

ほかは、4本目で足した `stageCode.test.ts` の変数の検査を、上級の各ステージで Red → Green にする。

## 受け入れ基準

1. 全ステージ(チュートリアル・ドリル・初級・中級・上級)で、「ソースをダウンロード(C#)」が出る
2. 上級の9ステージで、初期状態(`expectedBuildFailures` を除く)と、模範解答の各手順・完成形がビルドでき、出力が一致する
3. Strategy・State のステージでは、`bindings` で選んだ実装が実行され、出力に表れる
4. CI の `csharp` ジョブが、全ステージの全スナップショットで成功する
5. 画面のコードプレビューに、`interface`・`abstract`・`override` が出る
6. `npm run stage-report` で `docs/stages/report.md` に差分が出ない
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 変更依頼のコード(全ステージが片付いたので、次のIssueとして別に起こす)
- ジェネリクス・`record`・`sealed` など、ステージに出てこない C# の機能
- 模範解答と違う組み替え方での、ビルドの保証
