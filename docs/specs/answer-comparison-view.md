# answer-comparison-view: 解答例の図を、自分の設計と並べて違いが分かるように見せる

## 背景・目的

2026-10-17 に初級2・中級6・上級2を100点まで遊んだあと「解答例の図を見る」を開くと、**解答例だけが1枚の図で出る**。

- 初級2では、私は `InvoiceStorage` に PDF の保存と送信履歴の記録の両方を入れたが、解答例は送信履歴を `InvoiceService.sendInvoice()` に残していた。
  この違いは、自分の図を覚えておいて見比べないと気付けない
- 中級6では、解答例は `trialDays` フィールドまで `Subscription` に移していた。自分の形との差を探すのに、図を何度も行き来した
- 同じ100点でも、解答例と何が違い、それぞれ何が良い・悪いのかの説明が無い

クラス設計は「唯一の正解」ではなく「どう分けたか・なぜか」を比べて学ぶものなので、自分の設計と解答例の**差**を見せたい。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/stage/designDiff.ts` | domain | 2つのコードベースで、各処理(Fragment)がどのクラスにあるかを比べ、置き場所の違う処理を列挙する |
| 新規 | `src/domain/stage/designDiff.test.ts` | domain | 上のテスト |
| 変更 | 解答例の図のダイアログ(「解答例の図を見る」) | presentation | 左に「あなたの設計」、右に「解答例」を並べ、違いの一覧を下に出す |
| 新規 | `src/presentation/stage/describeDesignDiff.ts` | presentation | 違いを文にする |
| 新規 | `src/presentation/stage/describeDesignDiff.test.ts` | presentation | 上のテスト |
| 新規 | `e2e/answer-comparison-view.spec.ts` | E2E | 下の受け入れ基準を確かめる |

## データ・型の変更

```ts
export type FragmentPlacementDiff = {
  readonly fragmentLabel: string;
  readonly responsibility: string;
  /** プレイヤーの設計で、その処理を持つクラスの名前。 */
  readonly playerClass: string;
  /** 解答例で、その処理を持つクラスの名前。 */
  readonly answerClass: string;
};
export function designDiff(player: Codebase, answer: Codebase): FragmentPlacementDiff[];
```

- 処理は `Fragment.id` で対応づける(抽出しても処理のIDは変わらない前提。変わる操作があれば、元の処理のIDを辿れるようにしてから使う)
- 呼び出し行(`call`)は比べない
- 置き場所が同じ処理は出さない

## 表示の仕様

- ダイアログを2列にし、左に「あなたの設計」(今のキャンバスと同じ図)、右に「解答例」を同じ縮尺で並べる
- 違いの一覧(`data-testid="design-diff"`): `「送信履歴を記録する」: あなた InvoiceStorage / 解答例 InvoiceService` の形で、責務ごとにまとめて出す
- 違いが無ければ `解答例と同じ置き方です` を出す
- 違いの行を押すと、両方の図でその処理を持つクラスを光らせる
- 違いが「どちらが良い」とは書かない。点数(採点ルールの減点)が違うときだけ、`あなたの設計は <ルール名> で -N 点` のように事実を添える
- 狭い画面では上下に積む

## TDD対象の純粋関数

### `designDiff`(`domain/stage/designDiff.ts`)

- 同じコード → 空配列
- 1つの処理だけ別のクラスにある → その1件
- 抽出してメソッドが変わっても、同じクラスにあれば違いにしない
- 呼び出し行は比べない

### `describeDesignDiff`(`presentation/stage/describeDesignDiff.ts`)

- 違いの一覧を責務ごとにまとめ、上の書式の文の配列にする

## 受け入れ基準

1. 初級2で、PDF の保存と送信履歴の記録を同じ新しいクラスに入れて100点にし、「解答例の図を見る」を開くと、
   左右に図が並び、違いの一覧に `「送信履歴を記録する」: あなた <自分のクラス名> / 解答例 InvoiceService` が出る
2. 解答例と同じ手順で100点にしたステージでは `解答例と同じ置き方です` が出る
3. 答えを見る前の確認(「答えを見ますか?」)は今どおり出る
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 解答例を複数用意すること
- AI講評との連携
