# 依存関係と採点

## 目的

メソッドの呼び出し関係(依存)をデータとして持ち、クラス間の依存をキャンバスに矢印で描く。
そのうえで「行数・結合度・循環依存」を100点満点の点数にして、リファクタリングの良し悪しを数字で返す。
責務の混在(`docs/auto-dev/TASKS.md`)とAI講評は今回の範囲外。

## ドメインモデルの変更(domain)

- `Fragment` に `uses?: readonly string[]` を追加する。その処理が呼び出す**メソッドのID**。省略時は依存なし。
- `extractMethod` が差し込む呼び出し行(`<newMethodId>:call`)は `uses: [newMethodId]` を持つ。
  → 抽出したメソッドを別クラスへ移すと、元のクラスから移動先クラスへの依存が生まれる。
- `Stage['limits']`(`LineLimits`)とは別に、`Stage` に `dependencyLimit: number`(1クラスが依存してよいクラス数の上限)を追加する。

## 依存の算出(`src/domain/codebase/dependencies.ts`)

```ts
export type ClassDependency = { readonly from: string; readonly to: string; readonly cyclic: boolean };
export function classDependencies(codebase: Codebase): ClassDependency[];
```

- クラスAのいずれかのメソッドのFragmentが、クラスB(A≠B)のメソッドを `uses` に含むとき、A→B の依存が1本ある。
- 同じ from/to の組は1本にまとめる。同じクラス内の呼び出し・存在しないメソッドIDは無視する。
- `cyclic`: B から依存をたどって A に戻れるとき true(A→B は循環の一部)。
- 並び順はクラスの出現順(from)→ 最初に見つかった順(to)。

## 採点(`src/domain/scoring/score.ts`)

```ts
export type ScoreDeduction = { readonly rule: 'line-limit' | 'coupling' | 'cycle'; readonly count: number; readonly points: number };
export type Score = { readonly total: number; readonly deductions: readonly ScoreDeduction[] };
export function scoreCodebase(codebase: Codebase, stage: Pick<Stage, 'limits' | 'dependencyLimit'>): Score;
```

| ルール | 数えるもの | 1件あたり |
| --- | --- | --- |
| `line-limit` | `findLineLimitViolations` の件数 | -10 |
| `coupling` | 依存先クラス数が `dependencyLimit` を超えたクラスの数 | -10 |
| `cycle` | `cyclic: true` の依存の本数 | -10 |

- `total = max(0, 100 - 減点の合計)`。`deductions` は3ルールを常にこの順で返す(0件なら `count: 0, points: 0`)。

## 画面(presentation)

- `ClassNode` に非表示の `Handle`(target: 左、source: 右)を置き、`CodebaseCanvas` が `classDependencies` から
  エッジを作って渡す。エッジID は `dep-<from>-<to>`、循環している依存は赤(`edge--cyclic` クラス)。
- `StagePanel` の状態表示を点数にする: `85点(行数 -10 / 結合度 0 / 循環依存 -5 ...)` のように、減点のあるルールだけ内訳を出す。
  操作するたびにその場で更新する(ボタンは作らない)。`data-testid="score"`。
- チュートリアルステージ: `dependencyLimit: 2`。`frag-tax` などに `uses` を足す必要はない(抽出→移動で依存が生まれる)。

## 受け入れ基準

1. `classDependencies` / `scoreCodebase` / `extractMethod` の `uses` について、AAAパターンのユニットテストがある。
   循環(A→B→A)・3クラスの循環・自クラス呼び出し・存在しないID・重複のまとめを含む。
2. E2E: `placeOrder` から `calculateTax` を抽出して `TaxCalculator` へドラッグすると、
   `OrderService`→`TaxCalculator` のエッジ(`rf__edge-dep-class-order-service-class-tax-calculator`)が表示される。
3. E2E: 初期状態の点数表示が行数違反を反映している(チュートリアルの placeOrder は上限超え)。
4. `npm run check` と `npm run test:e2e` が通る。

## 省いたもの

- 結合度の指標はクラス単位の依存先数(Ce)だけ。被依存数・不安定度は必要になったら足す。
- 循環はエッジごとの到達判定(O(E·(V+E)))。ステージは数十クラス程度なので十分。
