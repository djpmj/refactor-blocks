# auto-public-on-move: 可視性を採点しないステージでは、別クラスから呼ばれるようになった private メソッドを自動で public にする

## 背景・目的

チュートリアル2で、抽出した `calculateTax()`(private で作られる)を `TaxCalculator` へドラッグで移した。
すると、`OrderService.placeOrder()` から呼ばれているのに、印が `-`(private)のままだった。

可視性を採点しないステージ(`visibilityEnforced` が無い。チュートリアル・初級・中級の多く)では、減点も警告の矢印も出ない。
しかもステージによっては、可視性を変えるセレクトも出ない(`showsVisibilityControl`)。
プレイヤーは「private でも外のクラスから呼べる」と誤って覚えてしまう。

そこで、**可視性を採点しないステージでは**、メソッドの移動の結果、別のクラスから呼ばれるようになった private / protected のメソッドを、自動で public にする。
変えたことはお知らせで伝える。
可視性を採点するステージ(中級3など)は、越境を自分で見つけて直すのが課題なので、今のまま自動では変えない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/codebase/publicizeCrossClassCalls.ts` | domain | 別クラスから届かない呼び出しを受けているメソッドを public にした Codebase と、変えたメソッドを返す純粋関数 |
| 新規 | `src/domain/codebase/publicizeCrossClassCalls.test.ts` | domain | 上のテスト |
| 変更 | `src/application/RefactorUseCases.ts` | application | メソッドを移すユースケース(`moveMethodUseCase`・`moveMethodToNewClassUseCase`・`moveMethodToNewClassInFileUseCase`)で、可視性を採点しないステージなら上の関数を通す |
| 変更 | `src/application/RefactorUseCases.test.ts` | application | 上のテスト |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | ユースケースに `visibilityEnforced` を渡し、public にしたメソッドがあればお知らせを出す |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | お知らせのテスト |
| 新規 | `e2e/auto-public-on-move.spec.ts` | E2E | 下の受け入れ基準を確かめる |

## データ・型の変更

```ts
// src/domain/codebase/publicizeCrossClassCalls.ts
/**
 * 可視性のせいで届かない呼び出し(findVisibilityViolations が見つけるもの)を受けているメソッドを、すべて public にする。
 * 変えたメソッドのIDを、findVisibilityViolations の出現順(重複なし)で返す。違反が無ければ codebase をそのまま返す。
 */
export function publicizeCrossClassCalls(codebase: Codebase): { readonly codebase: Codebase; readonly publicized: readonly string[] };
```

- ユースケースの戻り値に `publicized: readonly string[]` を足す(移動に成功したときだけ。可視性を採点するステージでは常に空)
- ユースケースの引数に、ステージの `visibilityEnforced` を受け取る(引数が4つを超える場合は、オプションのオブジェクトにまとめる)

## 見た目・動きの仕様

- 可視性を採点しないステージで、メソッドを別のクラスへ移す(ドラッグ・右クリックメニュー・新しいクラスを作って移す)と、次のメソッドが public になる
  - 移したメソッドが private / protected で、元のクラスから呼ばれているもの
  - 移したメソッドが呼んでいる、元のクラスに残った private / protected のメソッド
- public にしたメソッドがあれば、`notice`(今の削除時のお知らせと同じ仕組み)で次を出す
  - 1つ: `calculateTax() は TaxCalculator の外(OrderService)から呼ばれるようになったので、public にしました`
  - 2つ以上: `外のクラスから呼ばれるようになったので、calculateTax()・saveOrder() を public にしました`
- 「元に戻す」(Ctrl+Z)で、移動と一緒に可視性も元に戻る(1回の操作として履歴に積む)
- 可視性を採点するステージ(`visibilityEnforced: true`)では、今のまま何も変えず、お知らせも出さない

## TDD対象の純粋関数

### `publicizeCrossClassCalls`(`domain/codebase/publicizeCrossClassCalls.ts`)

- `A.caller` が `B.helper`(private)を呼ぶ → `helper` が public になり、`publicized` が `['helper のID']`
- `A.caller` が `B.helper`(protected)を呼び、A が B の子孫でない → public になる
- A が B の子孫で、`B.helper` が protected → 届くので変えない
- 同じクラスの中の呼び出しだけ → 何も変えず、同じ codebase を返す
- 2つのメソッドが越境 → 両方を変え、出現順に返す

### メソッドを移すユースケース(`application/RefactorUseCases.ts`)

- 可視性を採点しないステージで、private のメソッドを呼び出し元と別のクラスへ移す → public になり、`publicized` に入る
- 可視性を採点するステージで同じことをする → private のまま、`publicized` は空
- 呼び出し元と同じクラスの中で完結する移動 → `publicized` は空

## 受け入れ基準

1. チュートリアル2で `calculateTax()` を抽出して `TaxCalculator` へ移すと、印が `+`(public)になり、「public にしました」のお知らせが出る
2. Ctrl+Z で移動を戻すと、`calculateTax()` は `OrderService` に戻り、`-`(private)に戻る
3. 中級3(可視性を採点するステージ)で private のメソッドを別のクラスへ移しても、自動では public にならず、今どおり越境の警告が出る
4. 既存の模範解答・カタログのテスト(点数)が変わらない(可視性を採点しないステージでは、可視性は点数に入らないため)
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 可視性を採点するステージの振る舞い
- フィールドの可視性
- 抽出(同じクラスの中にメソッドを作る)のときの可視性
- 呼ばれなくなった public メソッドを private に戻すこと
