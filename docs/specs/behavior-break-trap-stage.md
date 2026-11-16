# behavior-break-trap-stage: 移し方を誤るとテストが赤くなるドリルを足し、赤の理由と「戻す/別の切り方」を示す

## 背景・目的

`behavior-tests-badge` で、ヘッダーに「🧪 テスト N/N ✓」を出すようにした。しかし今のステージでは、ふつうに遊ぶとテストが**一度も赤くならない**。
そのため「リファクタリング = 振る舞いを変えない。テストが赤くなったら、その組み替えは失敗」という体験ができない。

そこで、**ある移し方をするとテストが赤くなる**ステージを1本足す。赤くなったら理由を1文で示し、元に戻すか、別の切り方を試すよう促す。

### 既存の仕組みで、どこまで表現できるか(調査の結論)

| 例に挙がった組み替え | 今のコードでの扱い | このステージで使うか |
| --- | --- | --- |
| 処理の順序を入れ替える抽出 | `extract-contiguous-only` で、離れた処理の抽出は**操作の時点で拒否される**(ボタンが押せず理由が出る)。並べ替えの操作もない。テストが赤くなる前に止まるので、赤くする題材にはできない | 使わない |
| 状態(フィールド)を共有するメソッドの移動 | `moveMethod`/`moveField` は `reads`/`writes` をIDのまま持ち越すので、モデルの上では振る舞いは変わらない。別クラスの private フィールドに触る形は `findBuildIssues`(C#書き出し)では見つかるが、**`runBehaviorTests` はフィールドを見ない** | 使わない(下の「スコープ外」) |
| private の補助メソッドを呼んでいるメソッドの移動 | `visibilityEnforced: true` のステージでは、移した結果**新しく**生まれた private の越境が、入口から届けば `runBehaviorTests` の `compile` で赤になる(中級7の E2E が同じ形で確かめ済み) | **使う** |

ゲームの操作(抽出・移動・統合・インライン化・名前の変更など)は、もともと振る舞いを変えないように作ってある。プレイヤーの操作でテストが赤くなる道は、今のところ `compile`(呼べないメソッドを呼ぶ形)だけ。
そこで、新しいテストの仕組みは足さない。**`visibilityEnforced: true` のドリルを1本足し、「private の補助メソッドを置き去りにして移す」と `compile` で赤くなる**題材にする。

本当に新しい判定(順序・フィールド)が要るか → 要らない。今の判定だけで「赤くなる → 戻す/別の切り方で緑に戻す」の流れが作れる。足すのは、ステージ1本と、赤のときの案内(1文)と、赤くなった瞬間に中身を開くことだけにする。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/drillStages.ts` | infrastructure | ドリル4 `drill-keep-tests-green` を末尾に足す(下記) |
| 新規 | `src/infrastructure/stages/runtime/drill-keep-tests-green.ts` | infrastructure | ドリル4の `StageRuntime`(C# 書き出し用。全ステージが runtime を持つ決まりのため) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps['drill-keep-tests-green']` を足す(下記) |
| 変更 | `src/infrastructure/stages/drillStages.test.ts` | infrastructure(テスト) | ドリルを4本にし、ドリル4のテストを足す(下記「TDD対象」) |
| 変更 | `src/presentation/stage/TestStatus.tsx` | presentation | 赤のときの案内の1文。緑→赤に変わったら中身を自動で開く |
| 変更 | `src/index.css` | presentation | `.test-status__hint` のスタイル |
| 変更 | `docs/stages/report.md` | (生成物) | `npm run stage-report` で作り直す(`stageReport.test.ts` のスナップショット) |
| 新規 | `e2e/behavior-break-trap.spec.ts` | E2E | 罠の移動で赤 → 理由と案内 → 元に戻す → 別の切り方で緑・100点 |
| 変更 | `e2e/micro-drills.spec.ts` | E2E | 「ドリル3本」→「ドリル4本」。一覧の確認にドリル4を足す |
| 変更 | `e2e/behavior-tests.spec.ts` | E2E | 中級7のテストで、赤になった後の `summary.click()` を消す(自動で開くため。押すと閉じてしまう) |
| 変更 | `e2e/reference-menu.spec.ts` | E2E | `runtimeStages` にドリル4を足す(C# の zip をダウンロードできる) |

`src/domain/testing/behaviorTests.ts`・`src/domain/codebase/`・`src/domain/scoring/`・`src/application/` は変更しない。新しい依存は足さない。

## データ・型の変更

型の変更はない。足すのはステージのデータだけ。

### ドリル4 `drill-keep-tests-green`(`drillStages.ts` の末尾)

- `level: 'drill'`、`title: 'ドリル4: テストを緑のまま移す'`、`visibilityEnforced: true`
- `problem`: `送料の計算が、補助メソッドごと OrderService に入っている`
- `description`: `注文を確定する OrderService。送料を計算する calculateShippingFee は、地域ごとの単価を決める private の ratePerKilometer を呼んでいる。送料を担当する ShippingCalculator は空のまま。`
- `why`: `送料を変えるとき OrderService を読まずに済みます。テストが緑のままなら、移しても動作は変わっていないと確かめられます。`
- `goal`: `送料の計算を ShippingCalculator へ移そう。🧪テストが赤くなったら、元に戻して別の切り方を試そう`
- `outcome`: `テストが赤くなったら、戻して別の切り方を選べる`
- `learns: ['Move Method', 'Inline Method / Inline Class']`(中級12と同じ表記にし、概念マップで同じ概念に数える)、`principles: ['srp', 'encapsulation']`
- `checks: []`、`changeRequests: []`
- `limits: { method: 14, class: 30, file: 35 }`、`dependencyLimit: 1`、`responsibilityLimit: 1`
- `classNames: { ordering: 'OrderHandler', shipping: 'ShippingFeeHandler' }`、`methodNames: { ordering: 'placeOrder', shipping: 'calculateShippingFee' }`、`responsibilityNames: { ordering: '注文の確定', shipping: '送料計算' }`
- `runtime: drillKeepTestsGreenRuntime`

コード(IDは `drill-trap-` で始め、他のドリルと重ねない。C# のコードと `variables` は、`stageCode.test.ts` の変数のつながりの検査が通る形で書く):

```
file-drill-trap-order  src/order/OrderService.ts
  class-drill-trap-order  OrderService
    method-drill-trap-place  placeOrder(Order order)  public
      frag-drill-trap-validate   「注文を確認する」            ordering  (order を使う)
      frag-drill-trap-call-fee   「calculateShippingFee(order) を呼び出す」  call  uses: [method-drill-trap-fee]  callArguments: ['order']  fee を作る
      frag-drill-trap-confirm    「送料を付けて注文を確定する」  ordering  (order, fee を使う)
    method-drill-trap-fee  calculateShippingFee(Order order)  public  returns fee
      frag-drill-trap-call-rate  「ratePerKilometer(order) を呼び出す」  call  uses: [method-drill-trap-rate]  callArguments: ['order']  rate を作る
      frag-drill-trap-fee-calc   「距離に単価を掛けて送料を出す」  shipping  (order, rate を使い fee を作る)
    method-drill-trap-rate  ratePerKilometer(Order order)  private  returns rate
      frag-drill-trap-rate       「地域から1kmあたりの単価を決める」  shipping  (order を使い rate を作る)
file-drill-trap-shipping  src/shipping/ShippingCalculator.ts
  class-drill-trap-shipping  ShippingCalculator  (メソッドなし)
```

- 処理は6個(ドリルの上限内)。入口は `placeOrder` の1つだけ(他の2つは呼ばれている)→ テストは1本
- 初期状態の減点: OrderService に注文と送料の責務が混在、ShippingCalculator が空。初期の越境はない

### `drillKeepTestsGreenRuntime`(`runtime/drill-keep-tests-green.ts`)

- `entryMethodId: 'method-drill-trap-place'`、`entryArguments: ['SampleData.Order']`
- `support`: `Order`(`Id`・`Items`・`Region`・`Distance`・`ShippingFee` と、確認の1行を出す `Validate()`)、`InvalidOrderException`、
  保存したことと送料を1行出す `FakeOrderRepository.SaveAsync`、`SampleData.Order`。`drill-move-method.ts` と同じ書き方にする
- `expectedBuildFailures` は書かない(模範解答のどの手の後もビルドできる)

### 模範解答(`sampleAnswerSteps['drill-keep-tests-green']`)

```ts
[
  { inline: { method: 'ratePerKilometer' } },
  { move: { method: 'calculateShippingFee', toClass: 'ShippingCalculator' } },
]
```

補助メソッドを呼び出し元へ戻して(Inline Method)から移すので、**どの手の後もテストは緑**。
「`ratePerKilometer` も一緒に ShippingCalculator へ移す」(2手。間で一度赤くなる)でも100点になる。どちらも正解として扱う。

## 動きの仕様

### ドリル4で起きること

| 操作 | テスト | 点数 |
| --- | --- | --- |
| `calculateShippingFee` だけを ShippingCalculator へドラッグ(ドリル3で覚えた動き = 罠) | **赤**。`コンパイルエラー: ShippingCalculator から OrderService.ratePerKilometer は呼べません(private)` | 100点にならない(越境・責務の混在・循環依存) |
| 罠の後に「元に戻す」(ボタン / Ctrl+Z) | 緑に戻る | 初期に戻る |
| 罠の後に `ratePerKilometer` を public にする | 緑 | 100点にならない(ShippingCalculator → OrderService の依存で循環し、OrderService に送料が残る) |
| 罠の後に `ratePerKilometer` も ShippingCalculator へ移す | 緑 | 100点 |
| `ratePerKilometer` を「呼び出し元へ戻す」→ `calculateShippingFee` を移す(模範解答) | ずっと緑 | 100点 |

可視性を採点するステージなので、移動しても自動で public にはしない(`auto-public-on-move` のとおり)。

### テストバッジ(全ステージ共通の変更)

- **赤の案内**: 赤のテストが1本以上あるとき、バッジの中身の説明文の下に、次の1文を出す(`data-testid="test-status-hint"`、クラス `test-status__hint`)
  `テストが赤くなりました。この組み替えは動作を守れていません。「元に戻す」(Ctrl+Z)で戻すか、別の切り方を試してください。`
  - 赤くなった理由は、今までどおりテストの行の下に1文ずつ出る(`describeFailure`。変更しない)
  - 全部緑のときは出さない
- **自動で開く**: テストが「全部緑」から「赤あり」に変わったとき、バッジの `<details>` を自動で開く。赤のままの間にプレイヤーが閉じたら、再び開かない。
  緑に戻ったら閉じる。次に赤になったら、また開く
  - 実装は、`<details>` に `key={allGreen ? 'green' : 'red'}` と `open={!allGreen}` を付け、緑/赤が切り替わるたびに作り直す形で足りる(状態を store に持たない)
  - ステージを開いた時点(初期コード)は緑なので、開かない
- 色だけに頼らない・`aria-live="polite"` は今のまま

## TDD対象

`domain`・`application` 層に新しいロジックは無い(テストの判定・操作は既存のものを使う)。
ステージのデータの正しさを、**ステージを書く前に** `drillStages.test.ts` に書いて Red にしてから、ステージを足して Green にする。

### `drillStages.test.ts`(infrastructure のテスト。AAA で書く)

- ドリルは `['drill-extract-tail', 'drill-extract-middle', 'drill-move-method', 'drill-keep-tests-green']` の順でカタログの最後の4本
- 既存の「1手で100点」のテストは、ドリル1〜3に絞る(ドリル4は2手なので、下の専用テストで確かめる)。`learns` の許可リストに `['Move Method', 'Inline Method / Inline Class']` を足す
- ドリル4の初期状態: 100点未満。`runBehaviorTests` は1本で緑
- ドリル4の罠(`move calculateShippingFee → ShippingCalculator` の1手): `runBehaviorTests` の失敗が `compile` 1件で、違反は `ratePerKilometer` を `ShippingCalculator` から呼ぶもの。点数は100点未満
- 罠の後に `changeVisibility ratePerKilometer → public`: テストは緑、点数は100点未満
- 罠の後に `move ratePerKilometer → ShippingCalculator`: テストは緑、100点
- 模範解答(inline → move): どの手の後もテストが全部緑(`compile` を含めて)、最後は100点
- 既存の `failures` 表(100点にならない手)に、上の罠と public 化の2件を足してもよい(点数の確認が重なる場合はどちらか一方)

### 既存のテストで自動的に守られるもの(変更不要、通ることを確かめる)

- `stageCatalog.test.ts`: 模範解答で100点、どの手の後もテストが緑、問題文の識別子、責務名、`outcome` の書き方、IDの重複なし など
- `stageCode.test.ts`: runtime を持たないステージが無い、変数のつながり
- `stageReport.test.ts`: `docs/stages/report.md` のスナップショット(`npm run stage-report` で作り直す)

### presentation

`TestStatus.tsx` の変更は表示だけなのでユニットテストは書かない。E2E で守る(下記)。

## 受け入れ基準

1. ステージ一覧の「ドリル」の最後に `ドリル4: テストを緑のまま移す` が出る。開くとヘッダーに `🧪 テスト 1/1 ✓`
2. ドリル4で `calculateShippingFee` を ShippingCalculator へドラッグすると、バッジが `🧪 テスト 0/1 ✗` になり、**クリックしなくても**中身が開いて、
   `コンパイルエラー: ShippingCalculator から OrderService.ratePerKilometer は呼べません(private)` と、案内の1文(`test-status-hint`)が見える。点数は100点ではない
3. 2の後に「元に戻す」を押すと `✓` に戻り、案内が消える
4. `ratePerKilometer` を「呼び出し元へ戻す」でインライン化してから `calculateShippingFee` を ShippingCalculator へドラッグすると、テストは `✓` のまま100点になる
5. 中級7の既存の流れ(private のまま移すと赤 → public で緑)が、自動で開く形で通る(`e2e/behavior-tests.spec.ts` を更新)
6. 他のステージの点数・模範解答・テストの結果が変わらない
7. 上の 2〜4 を `e2e/behavior-break-trap.spec.ts` で確かめる(ドラッグは `e2e/behavior-tests.spec.ts` の `dragMethodToClass` と同じ手順。`nodrag nopan`・`distance: 5` の約束は既存のまま)
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- フィールド(状態)の private の越境を `runBehaviorTests` の `compile` に含めること。`findBuildIssues` には既にあるが、テストに足すと既存ステージの模範解答の途中で赤が出ないかの洗い出しが要る。フィールドを共有するメソッドの移動を題材にしたステージを作るときに足す
- 実行順・回数・引数まで比べる振る舞いの判定(`behaviorTests.ts` の ponytail コメントのとおり、順序を変える操作を足すときに見直す)
- 処理の並べ替え操作、離れた処理を抽出できるようにすること(`extract-contiguous-only` の決定を変えない)
- 可視性を採点しないステージで赤くする題材(自動で public になるため赤くならない)
- 赤になったことのお知らせ(notice)・トースト、赤の回数の記録や採点への反映
- 「わざと壊す」モード、プレイヤーがテストを書く・選ぶ操作
- C# の書き出しで罠の状態をビルド失敗として見せること(`expectedBuildFailures` は使わない)
