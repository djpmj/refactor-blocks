# manual-fix-clarity: 「手で直してみる」の答えを隠し、結果の文言とロックの予告を分かりやすくする

## 背景・目的

2026-10-17 に実際にチュートリアル1〜中級1を遊んで、「手で直してみる」(`missed-fix-experience`)の流れに3つの問題が見つかった。

1. **練習の答えが丸見え**: 冒頭の手直し(`opening-fix`)の前から、左パネルの「もし、この変更が来たら?」カード(`ChangePainCard` の `ModifyBefore`)が
   `直す場所は今 3 か所`・`Order.checkout(23行)` のように直す場所のメソッド名を列挙している。そのすぐ下で
   「直す必要があるメソッドに印を付けてリリースします」と出題しているので、読めば必ず正解できる。
   `missed-fix-experience` の「どの変更箇所かのヒント(答え)は出さない」に反している。見出し横の要約(`1か所・39行を読む`)も箇所数を明かしている
2. **結果の文言が設計の良し悪しと合わない**:
   - `ManualFixPanel` の `PainSummary` は直す場所が2か所以上なら必ず
     「今のコードでは、この変更を入れるのに N か所を直す必要があります。1か所にまとめれば、直し忘れは起きません」と出す。
     初級1で解答例どおりに `Mailer.sendWelcomeMail` / `Mailer.sendFarewellMail` に分けた**正しい設計**でも、2か所とも同じ `Mailer` の中なのにこの文が出て、やり直せと言われているように読める
   - 冒頭の手直しで直し忘れが0件でも「この痛みを覚えておこう」と出るが、何が痛かったのかが書かれていない
3. **操作ロックが事前に分からない**: 冒頭の手直しが終わるまで抽出・移動はできない(`blockDuringOpeningFix`)が、
   抽出ボタンは押せる見た目のままで、押して初めてトースト「まず「もし、この変更が来たら?」で…」が出る。
   しかも「実際に直してみる」「リリースする」「組み替えを始める」は左パネルの下の方にあり、画面の高さが足りないと画面外で見つけにくい

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/change/checkManualFix.ts` | domain | 結果に、直す場所が属するクラスのID(`siteClassIds`)を足す |
| 変更 | `src/domain/change/checkManualFix.test.ts` | domain | 上のテスト |
| 新規 | `src/presentation/stage/describeManualFix.ts` | presentation | 手直しの結果の説明文を組み立てる純粋関数 |
| 新規 | `src/presentation/stage/describeManualFix.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/stage/ManualFixPanel.tsx` | presentation | `PainSummary` を `describeManualFix` に置き換える。開いたとき・リリースしたときに自分を画面内へスクロールする |
| 変更 | `src/presentation/stage/ChangePainCard.tsx` | presentation | `opening-fix` の間は直す場所の数・メソッド名を出さない。「実際に直してみる」に `data-tour="manual-fix-start"` を付ける |
| 新規 | `src/presentation/canvas/OpeningFixBanner.tsx` | presentation | `opening-fix` の間、キャンバス上部に「まず手で直してみよう」と開始ボタンを出す |
| 変更 | キャンバスを描いているコンポーネント(`OpeningFixBanner` を置く場所) | presentation | バナーを置く |
| 変更 | 上の文言・表示を確かめている既存の E2E(`e2e/` の manual-fix / missed-fix / change-pain 系) | E2E | 新しい表示に合わせる |
| 新規 | `e2e/manual-fix-clarity.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`application` / `infrastructure` は変更しない。

## データ・型の変更

`ManualFixResult`(`domain/change/checkManualFix.ts`)にフィールドを1つ足す。

```ts
export type ManualFixResult = {
  readonly missed: readonly string[];
  readonly extra: readonly string[];
  readonly sites: number;
  /** 変更箇所が属するクラスのID。重複なし、変更箇所の並び順で最初に現れた順。 */
  readonly siteClassIds: readonly string[];
};
```

## 見た目・動きの仕様

### 1. 冒頭の手直しの前は答えを出さない

- `stageStep` が `opening-fix` の間、`ChangePainCard` は `ModifyBefore` の代わりに、依頼のタイトルと説明だけを出す(今の `closing-fix` と同じ形)
  - 直す場所の数(`直す場所は今 N か所`)、目を通す行数、`LocationList`(メソッド名の列挙)、`describePainTrend` の文は出さない
  - 見出し横の要約(`summarizePain`)の代わりに `まず手で直してみよう` を出す
- 冒頭の手直しをリリースして「組み替えを始める」を押したあと(`opening-fix` を抜けたあと)は、今どおり `ModifyBefore` を出す(これが答え合わせになる)
- 新しい種類を足す依頼(`ExtendBefore`)の表示は変えない

### 2. 手直しの結果の文言(`describeManualFix`)

`ResultView` の `PainSummary` を、`describeManualFix` が返す文の並びに置き換える。今の `関係のないメソッドに印を付けていました: …` の行はそのまま残す。

- 直す場所が2か所以上で、**2クラス以上に散らばっている**とき:
  `今のコードでは、この変更を入れるのに N か所(M クラス)を直す必要があります。1つのクラスにまとめれば、直し忘れが起きにくくなります`
- 直す場所が2か所以上で、**すべて同じクラスの中**のとき:
  `直す N か所は、どれも <クラス名> の中です`
- 直す場所が1か所のとき: この行は出さない
- 冒頭の手直し(`opening-fix`)の結果では、さらに次のどちらかを出す(今の「この痛みを覚えておこう…」の行を置き換える)
  - 直し忘れか関係のない印があったとき: `この痛みを覚えておこう。組み替えたあと、同じ変更がどう変わるかを確かめます`
  - 正解だったとき: `この変更のために <R> 行を読みました。組み替えたあと、同じ変更で読む量がどう変わるかを確かめます`
    (`R` は `measurePain(stage, codebase).current.readLines`)

### 3. 操作ロックの予告と、ボタンを画面内に出す

- `OpeningFixBanner`: 次のすべてを満たすとき、キャンバスの上部(ツールバーの下)に帯を出す(`data-testid="opening-fix-banner"`)
  - `openingFixEnabled` が `true` で、`stageStep` が `opening-fix`
  - 手直しをしていない(`manualFix === null`)、変更依頼の挑戦中でない(`changeSession === null`)、ツアー中でない(`tourStep === null`)
  - 文: `組み替える前に、まずこのコードのまま「<依頼のタイトル>」を手で入れてみよう。抽出や移動は、そのあとでできます`
  - ボタン: `実際に直してみる`(`startManualFix` を呼ぶ。左パネルのボタンと同じ動き)
- `ManualFixPanel` は、手直しを始めたとき(セクションが現れたとき)と、リリースしたとき(結果に切り替わったとき)に、
  自分の `section` を `scrollIntoView({ block: 'nearest' })` で左パネルの中へスクロールする
  (`prefers-reduced-motion: reduce` でなければ `behavior: 'smooth'`)
- ロック中に操作したときのトースト(`OPENING_FIX_MESSAGE`)は今のまま残す

## TDD対象の純粋関数

### `checkManualFix`(`domain/change/checkManualFix.ts`)

- 変更箇所が同じクラスの2メソッド → `siteClassIds` はそのクラス1件
- 変更箇所が2クラスにまたがる → 2件、変更箇所の並び順で最初に現れた順
- 変更箇所が0件 → 空配列
- 既存のケース(`missed` / `extra` / `sites`)は今のまま通る

### `describeManualFix`(`presentation/stage/describeManualFix.ts`)

入力: `{ result: ManualFixResult; classNames: readonly string[]; opening: boolean; readLines: number }`(`classNames` は `siteClassIds` を名前にしたもの)。出力: 表示する文の配列。

- 3か所・2クラス・冒頭でない → `…3 か所(2 クラス)を直す必要があります。1つのクラスにまとめれば…` の1文
- 2か所・1クラス(`Mailer`)・冒頭でない → `直す 2 か所は、どれも Mailer の中です` の1文
- 1か所・冒頭でない → 空配列
- 1か所・冒頭・正解・`readLines: 39` → `この変更のために 39 行を読みました。…` の1文
- 2か所・2クラス・冒頭・直し忘れ1件 → 散らばりの文と `この痛みを覚えておこう。…` の2文(この順)

`ChangePainCard` の出し分け、バナー、スクロールは表示の変更なので E2E で確かめる。

## 受け入れ基準

1. 中級1「循環依存を断ち切る」を開くと、左パネルの「もし、この変更が来たら?」に `Order.checkout`・`Customer.calculateOrderTotal` などのメソッド名と `直す場所は今 3 か所` が出ず、見出し横は `まず手で直してみよう` になっている
2. 1のステージで冒頭の手直しをリリースして「組み替えを始める」を押すと、カードに今どおり直す場所の数とメソッド名が出る
3. 初級1「何でも屋の UserController」で、`sendWelcomeMail` / `sendFarewellMail` を `Mailer` へ移して100点にしたあと、もう一度手で直して両方に印を付けると、
   `直す 2 か所は、どれも Mailer の中です` が出て、`1か所にまとめれば` の文は出ない
4. 初級1の冒頭の手直しで `registerUser` だけに印を付けると、`今のコードでは、この変更を入れるのに 2 か所(1 クラス)…` ではなく
   `直す 2 か所は、どれも UserController の中です` と `この痛みを覚えておこう…` が出る
5. チュートリアル2の冒頭の手直しで正解すると、`この変更のために 31 行を読みました。…` が出る
6. ツアーを終えた状態でチュートリアル2を開くと、キャンバス上部に `opening-fix-banner` が出る。そのボタンを押すと手直しが始まり、バナーが消える。冒頭の手直しを終えるとバナーは出ない
7. 画面の高さが 700px のとき、バナーのボタンで手直しを始めると「リリースする」ボタンが画面内に見えている。リリースすると「組み替えを始める」ボタンが画面内に見えている
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 冒頭の手直しを必須にするかどうか(`openingFixEnabled`)の見直し
- ロック中の抽出ボタン・ドラッグを `disabled` にすること(トーストは残し、バナーで予告する)
- 変更依頼に挑戦(`changeSession`)中の表示
- チュートリアルのツアーの手順(`tutorial-tour-fixes` で扱う)
