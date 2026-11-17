# testability-score: クラスごとに「単体テストで用意する依存クラス数」をクラスノードに表示する

## 背景・目的

`docs/feature-ideas/IDEAS.md` の「8. テスト容易性スコア」。結合度は今、採点の `coupling`(直接の依存先クラス数が
`dependencyLimit` を超えたクラス)と `cycle`、キャンバスの依存の矢印でしか見えない。プレイヤーには
「依存が多い・深いと何が困るのか」が数字として返ってこない。

各クラスに **「このクラスを単体テストするとき、用意しなければならない別クラスの数」** を出し、
依存をたどった芋づるがそのままテストの書きにくさになることを実感させる。

- 例(チュートリアル2): 初期の `OrderService` は `テスト準備 0クラス`。`calculateTax` を抽出して `TaxCalculator` へ移すと
  `OrderService` は `テスト準備 1クラス`(TaxCalculator)になる。
- 例(連鎖): A→B→C→D とつながっていると、A は直接の依存が1本でも `テスト準備 3クラス`。直接の依存数(`coupling`)では見えない深さが見える。
- 例(インターフェース): A がインターフェース役のクラス I を呼んでいるだけなら、I の実装クラスの先はたどらず `テスト準備 1クラス`(I のスタブだけ)。
  依存の向きを逆転させると準備が減ることが数字で分かる。

`behavior-tests-badge.md` のスコープ外に挙げた「テストの書きやすさ(モックの数)の表示」を、この仕様で扱う。

### 指標の定義(確定)

**クラスCの「テスト準備クラス数」= `classDependencies` の依存の矢印を C からたどって到達できる、C 以外のクラスの数(推移閉包)。**

- 「モックを使わずに本物で組み立てるとき、用意が必要になるクラス」の数。直接の依存数(Ce)は既存の `coupling` が数えているので、
  同じ数をもう1つ出しても新しい情報にならない。推移的に数えることで連鎖の深さと、インターフェースで依存を切る効果が見える。
- 依存の元データは既存の `classDependencies`(メソッド呼び出し `uses` とフィールドの読み書き)をそのまま使う。新しい依存の定義は作らない。
- インターフェース役のクラス(`isInterfaceLike`)は処理を持たないので、依存の矢印が出ない。結果として「インターフェースの先はたどらない」が特別扱いなしで成り立つ。
- 循環していて自分に戻ってくる場合も、自分自身は数えない。

### 採点に入れるか(確定: 表示のみ。採点・点数は変えない)

調べた結果、今回は**減点ルールにしない**。理由:

1. **二重減点になる。** 同じ依存の矢印を、すでに `coupling`(依存先が上限超え)と `cycle`(循環1本ごと)が -10 点ずつ数えている
   (`docs/specs/dependency-scoring.md`、`src/domain/scoring/score.ts`)。推移的な数にさらに減点を足すと、1本の依存が最大3重に引かれる。
2. **既存ステージの初期点と模範解答の100点が崩れる。** `ScoreRule` を増やして減点すると、次がすべて影響を受ける。
   - `src/infrastructure/stages/stageCatalog.test.ts` の「`%s keeps the baseline initial violation rule types`」(各ステージの初期の減点ルールの一覧)と、
     全ステージの模範解答が `total: 100` になることを確かめるテスト
   - `scoreCodebase` の `total` を固定値で確かめている各ステージのテスト(`src/infrastructure/stages/*Stage.test.ts`・`advancedStages.test.ts`・
     `drillStages.test.ts`・`volatilityStages.test.ts` など約20ファイル)、`src/domain/scoring/score.test.ts`・`fileScores.test.ts`・`violationTargets.test.ts`、
     `src/presentation/store/useGameStore.test.ts`、`src/domain/critique/critiqueRequest.test.ts`・`src/application/CritiqueUseCases.test.ts`
   - `npm run stage-report` が出す `docs/stages/report.md`、保存済みのベストスコア(`src/domain/progress/updateProgress.ts`)との比較
   - 層構成のステージ(Controller→Service→Repository など)は正解の形でも推移的な依存が2〜3クラスあるため、上限をステージごとに調整しないと模範解答が100点にならない
3. 「表示だけで実感させる」ことが目的なので、まず表示で足りるかを確かめてから採点を検討すればよい(YAGNI)。

よって `score.ts`・`ScoreRule`・`Stage` 型・ステージ定義・上記のテストは**変更しない**。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/dependencies.ts` | domain | `testSetupClassIds` を追加(推移的に到達できるクラスID) |
| 変更 | `src/domain/codebase/dependencies.test.ts` | domain | `testSetupClassIds` のユニットテスト(先に書く) |
| 変更 | `src/presentation/canvas/ClassNode.tsx` | presentation | ヘッダーのバッジに `テスト準備 Nクラス` を追加(`ClassTestSetupBadge`) |
| 変更 | `src/index.css` | presentation | `.test-setup-count`(`.responsibility-count` と同じ控えめな見た目) |
| 変更 | `e2e/refactor.spec.ts` | E2E | 抽出→移動でテスト準備クラス数が 0→1 になることを確かめる |

- `application` 層は変更しない(既存の `ClassNode` と同じく、表示用の純粋関数を presentation から直接呼ぶ。`cyclicClassIds` と同じ扱い)。
- `infrastructure` 層(ステージ定義・ステージのテスト・stageReport)は変更しない。
- 採点(`src/domain/scoring/`)は変更しない。新しい依存パッケージは足さない。

## データ・型の変更

ドメインモデル・`Stage`・保存形式の変更はなし。追加する関数だけ:

```ts
// src/domain/codebase/dependencies.ts
/**
 * クラスを単体テストするとき用意する別クラスのID。依存の矢印を classId から推移的にたどって到達できるクラスを、
 * 見つかった順(幅優先、同じ深さでは dependencies の並び順)に重複なく返す。classId 自身は含めない(循環して戻ってきても数えない)。
 */
export function testSetupClassIds(dependencies: readonly ClassDependency[], classId: string): string[];
```

- 数は `testSetupClassIds(...).length`。数を返す関数は別に作らない。
- 実装は既存の `canReach` と同じく素朴な走査でよい。呼び出しごとに `dependencies` から隣接リストを作るので、クラスごとに呼ぶと O(V·(V+E))。
  `// ponytail: クラスごとに隣接リストを作り直すので O(V·(V+E))。数百クラス規模のステージを作るときに隣接リストを共有する` を残す。

## 動きの仕様

### バッジ(`ClassNode` のヘッダー)

- `ClassHeaderBadges` の、責務バッジと行数バッジの並びに `テスト準備 Nクラス` を足す(並び: 責務 → テスト準備 → 行数)。
- 出す条件は行数・責務バッジと同じ `showCounts`(詳細表示 `showDetails` のときだけ、部品置き場 `TRAY_CLASS_ID` では出さない)に加えて、
  **インターフェース役のクラス(`isInterfaceLike(codeClass)`)では出さない**(テストする対象ではないため)。
- 0 のときも出す(`テスト準備 0クラス`)。「用意するものが無い = テストしやすい」ことも情報なので隠さない。
- 対象のコードは、循環依存の印(`isCyclic`)と同じく `state.codebase`。依存は `classDependencies(state.codebase)` から求める。
- 数えるクラスIDから `TRAY_CLASS_ID` は除く(白紙設計で部品置き場の部品を呼んでいる途中の状態を、用意するクラスに数えない)。
- 要素:
  - 表示: `<span className="test-setup-count" data-testid="class-test-setup-<クラス名>" title="…">テスト準備 {N}クラス</span>`
  - `title`: `このクラスを単体テストするとき、呼び出しをたどって用意する別クラスの数(インターフェースの先はたどらない): <クラス名>、<クラス名>`(0件のときは `: なし`)
  - スクリーンリーダー用に、責務バッジと同じく `sr-only` の span を添える:
    `<span className="sr-only" data-testid="class-test-setup-names-<クラス名>">(用意するクラス: TaxCalculator、…)</span>`。0件のときは `(用意するクラス: なし)`。
  - クラス名は `findClass` で引いた今の名前。見つからないIDは飛ばす(`testSetupClassIds` は存在するクラスしか返さないので通常は起きない)。
- 上限や超過の色分けはしない(採点に入れないので「超えた」の基準が無い)。色は `var(--muted)`。
- 操作(抽出・移動・統合・削除・Undo など)のたびにその場で更新される(ストアの `codebase` 由来なので追加の仕組みは不要)。

### lint の注意

- `ClassHeaderBadges` は引数・複雑度が上限に近いので、バッジは `ClassResponsibilityBadge` と同じく別コンポーネント `ClassTestSetupBadge({ codeClass })` に切り出し、
  中で `useGameStore` から `codebase` を読む。表示条件の `isInterfaceLike` 判定もこのコンポーネント内で行う。

## TDD対象

### `testSetupClassIds`(domain, `src/domain/codebase/dependencies.ts`)

`dependencies.test.ts` に `describe('testSetupClassIds')` を足し、AAA パターンで先に書く。入力は `ClassDependency[]` を直接組み立ててよい
(`cyclicClassIds` のテストと同じ形)。最後の2件は `classDependencies` と組み合わせた結合寄りのケース。

- 依存が空 → `[]`
- 指定したクラスが依存元にない(依存されるだけ・どこにも出てこない) → `[]`
- A→B だけ → A は `['B']`、B は `[]`
- 直接の依存が2本 A→B, A→C → `['B', 'C']`(dependencies の並び順)
- 連鎖 A→B→C→D → A は `['B', 'C', 'D']`、B は `['C', 'D']`
- 幅優先の順: A→B, B→D, A→C → `['B', 'C', 'D']`
- ひし形 A→B, A→C, B→D, C→D → D は1回だけ: `['B', 'C', 'D']`
- 循環 A→B→A → A は `['B']`(自分自身を含めない)。3クラスの循環 A→B→C→A → A は `['B', 'C']`
- 循環の外へ出る A→B, B→A, B→C → A は `['B', 'C']`
- (`classDependencies` と組み合わせ)OrderService の処理が TaxCalculator のメソッドを `uses` に持つコードベース → OrderService は `['class-tax-calculator']`
- (`classDependencies` と組み合わせ)A がインターフェース役のクラス I のメソッドを呼び、実装クラス Impl が I を `interfaceIds` に持ち、Impl が別クラス X を呼ぶ →
  A は `['I']`(Impl・X を含まない)

presentation(`ClassTestSetupBadge`)は表示のみなのでユニットテスト対象外。E2E で守る。

## E2E 対象

`e2e/refactor.spec.ts` に1件追加する(既存の `openOrderStage`・「抽出したメソッドを別クラスへ移すと、クラス間に依存の矢印が引かれる」と同じ手順):

- テスト名: `抽出したメソッドを別クラスへ移すと、テスト準備のクラス数が増える`
- Arrange: `openOrderStage(page)`(チュートリアル2)。`class-test-setup-OrderService` が `テスト準備 0クラス`。
- Act: `placeOrder` から「消費税を計算する(軽減税率あり)」を `calculateTax` として抽出し、`method-calculateTax` を `class-TaxCalculator` へドラッグする。
- Assert: `class-test-setup-OrderService` が `テスト準備 1クラス`、`class-test-setup-names-OrderService` が `TaxCalculator` を含む。
  `class-test-setup-TaxCalculator` は `テスト準備 0クラス` のまま。

ヘッダーにバッジが1つ増えるので、既存の E2E(特にヘッダーを掴むドラッグ・クラスノードの大きさに依存するもの)がすべて通ることを確かめる。

## 受け入れ基準

1. `testSetupClassIds` について、上記「TDD対象」のケースが AAA パターンのユニットテストとして `dependencies.test.ts` にあり、通る。
2. 詳細表示のクラスノードのヘッダーに `テスト準備 Nクラス` が出る。部品置き場とインターフェース役のクラスには出ない。ズームで詳細を隠すと出ない。
3. チュートリアル2で、抽出→ `TaxCalculator` への移動をすると `OrderService` の表示が 0→1 に変わる(E2E で確認)。Undo で 0 に戻る(手動確認)。
4. バッジの `title` と `sr-only` のテキストで、用意するクラスの名前が分かる(色に頼らない)。
5. `scoreCodebase` の結果・各ステージの初期点・模範解答の点数・`docs/stages/report.md` が変わらない(`score.ts`・ステージ定義・既存のステージのテストを変更していない)。
6. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- **採点(減点)への組み込み**。上記「採点に入れるか」のとおり、`coupling`・`cycle` との二重減点と全ステージの初期点・模範解答への影響があるため今回はしない。
  表示を使ってみて「数字が大きいのに点が下がらないのが分かりにくい」という声が出たら、`coupling` の数え方を推移的にするか別ルールにするかを、そのときに別仕様で決める。
- ステージごとの上限値(`testSetupLimit` のような `Stage` のフィールド)と、上限超過の色分け。基準が無いまま色を付けると減点と誤解されるため。
- 継承元(`superclassId`)の依存を子クラスの準備に含めること。今は `classDependencies` に現れる依存(呼び出し・フィールド)だけをたどる。
  親クラスのメソッドを呼んでいれば既存の依存として数えられる。
- 直接の依存(モックを使う場合の数)との2本立て表示。本当に要るか → 直接の依存は依存の矢印の本数で見えるので、推移的な数1つで足りる。
- AI講評(`critiqueRequest`)への指標の受け渡し、クリア画面・ステージ一覧・ステージレポートへの表示。
- ファイル単位・コードベース全体の合計値。
- 白紙設計モード・設計くらべクイズ・変更依頼の挑戦中(`changeSession`)での特別な扱い(表示は `state.codebase` のまま)。
