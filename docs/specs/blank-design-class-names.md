# blank-design-class-names: 白紙設計でも、作ったクラスに役割から名前を付ける

## 背景・目的

2026-10-17 に白紙設計「白紙1: 注文と発送」を遊んで、部品を余白へドラッグして作ったクラスが `NewClass`・`NewClass2`・`NewClass3`・`NewClass4` になった。
どのクラスに何を置いたのか図から読み取れず、答え合わせの文(`波及: 変更したクラスを呼んでいる NewClass、NewClass2 も影響を受け…`)も意味が取りにくい。

リファクタリングモードでは `auto-class-naming` により、新しく作ったクラスへ中身の責務から名前が付く(`autoNameClasses` + `Stage.classNames`)。
白紙設計の問題(`BlankDesignProblem` は `Stage` を広げた型)も同じ仕組みに乗っているが、`blankDesignProblems.ts` の `classNames` が `{}` のため、常に `NewClass` になる。
`auto-class-naming` の仕様にも「白紙設計の問題に `classNames` が無ければ `NewClass` のまま(今どおり)でよい」とあり、ここを埋める。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/blankDesigns/blankDesignProblems.ts` | infrastructure | `classNames` に責務ごとのクラス名を入れる |
| 変更 | `src/infrastructure/blankDesigns/blankDesignProblems.test.ts` | infrastructure | 部品の責務がすべて `classNames` にあることを確かめる |
| 変更 | 白紙設計でクラスを作る経路(`useGameStore.ts` の白紙設計の操作) | presentation | リファクタリングモードと同じく `autoNameClasses` を通っているか確認し、通っていなければ通す |
| 変更 | `NewClass` を前提にしている白紙設計の E2E | E2E | 新しい名前に合わせる |

## データ・型の変更

なし(既存の `Stage.classNames` を埋めるだけ)。

`白紙1` の `classNames` は、模範解答のクラス名に合わせて次のようにする(模範解答のクラス名が違えば、模範解答の名前を正とする)。

| 責務 | クラス名 |
| --- | --- |
| `order-flow` | `OrderService` |
| `tax` | `TaxCalculator` |
| `persistence` | `OrderRepository` |
| `notification` | `OrderMailer` |

## TDD対象の純粋関数

`domain` に新しいロジックは無い。

### `blankDesignProblems.test.ts`(infrastructure)

- すべての問題で、部品(`codebase` の部品置き場のメソッド)の処理の責務(`call` を除く)が、すべて `classNames` のキーにある
- `classNames` の値が、模範解答(`modelAnswerCodebase`)に出てくるクラス名のどれかと一致する

## 受け入れ基準

1. 白紙1で `sendOrderConfirmMail()` を余白へドラッグすると、できたクラスの名前が `OrderMailer` になる
2. 続けて `saveOrder()` を別の余白へドラッグすると `OrderRepository` になる
3. 1のクラスへ `calculateOrderTax()`(処理3行)も入れると、通知の処理(3行)と同じ行数なので、`auto-class-naming` の規則どおり先に入っていた処理の責務の名前 `OrderMailer` のままになる
4. 右クリックの「名前を変更」で付けた名前は、以後自動で変わらない
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- クラス名の良し悪しの採点
- 白紙設計の問題の追加
