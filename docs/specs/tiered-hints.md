# tiered-hints: ヒントを「どこが問題?」→「次の一手」→「動きで見る」の3段階にする

## 背景・目的

サイドバーのヒントには、2つのボタンがある。

- `ヒントを見る`: 模範解答の手順を1つずつ文で開く(例:「calculateOrderTotal をMove Methodで Order へ移そう」)。**答えの手順そのもの**
- `少しだけヒント`: 次にドラッグで動かす手を、キャンバス上の動き(ゴースト)で見せる(`GhostHintButton`)。**これも答えそのもの**。ボタンには説明が無い

「少しだけ」と書いてあるほうも答えで、方向だけを教える段階が無い。困ったプレイヤーは、いきなり答えを見ることになる。
自分で気づくことが学びの中心なので、答えの前に「どこが問題か」だけを教える段階を置く。

そこで、ヒントを次の3段階にする。①を見るまで②③は押せない。

1. **どこが問題?**: 今のコードでいちばん大きい減点の場所をキャンバスで光らせ、そのルールで何が困るかだけを言う。どう直すかは言わない
2. **次の一手**: 今の `ヒントを見る` の文
3. **動きで見る**: 今の `少しだけヒント` の動き

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/scoring/biggestProblem.ts` | domain | いちばん大きい減点のルールを選ぶ純粋関数 |
| 新規 | `src/domain/scoring/biggestProblem.test.ts` | domain | 上のテスト |
| 新規 | `src/presentation/stage/ProblemHint.tsx` | presentation | ①「どこが問題?」のボタンと説明 |
| 変更 | `src/presentation/stage/HintPanel.tsx` | presentation | `HintButton` の文言を「次の一手」に変える |
| 変更 | `src/presentation/stage/GhostHintButton.tsx` | presentation | 文言を「動きで見る」に変え、説明の `title` を付ける |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | 3つのボタンを順に並べ、①を見るまで②③を無効にする |
| 変更 | `src/index.css` | presentation | 3段階の並び |
| 変更 | ヒントのボタンを押している既存の E2E(`ghost-hint.spec.ts`・`hint-highlight.spec.ts` ほか) | E2E | 先に①を押す手順と、新しい文言に合わせる |
| 新規 | `e2e/tiered-hints.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`application` / `infrastructure` は変更しない。

## データ・型の変更

```ts
// src/domain/scoring/biggestProblem.ts
/**
 * いちばん大きい減点のルール。score.deductions のうち points が最大のもの。同点なら score.deductions の並び順で先のもの。
 * 減点が無ければ undefined。
 */
export function biggestProblem(score: Score): ScoreRule | undefined;
```

- ①を見たかどうかは `StagePanel` の状態(今の `revealed` と同じく、ステージIDを添えた `useState`)で持つ。ステージを切り替えたら見ていない状態に戻す。保存はしない

## 見た目・動きの仕様

### ヒントの欄の並び

- 見出し `ヒント` の下に、左から次の3つを並べる。各ボタンの前に小さく段階の番号(`1` `2` `3`)を付ける
  1. `どこが問題?`(`data-testid="hint-problem"`)
  2. `次の一手` + 開いた数(`次の一手(1/3)`。今の `ヒントを見る` の数の出し方のまま)
  3. `動きで見る`(`data-testid="ghost-hint"` はそのまま)
- ②③は、そのステージで①を一度も押していなければ無効にし、`title` を `先に「どこが問題?」を見てみよう` にする
- ③の `title` は、押せるときは `次に動かす手を、キャンバスの上で動きで見せます(答えが分かります)`。動かす手が無いときは今の `title` のまま
- 今 `少しだけヒント` に付いている、しばらく操作が無いときに目立たせる動き(`ghost-hint-button--idle`)は、①のボタンに移す

### ①「どこが問題?」(`ProblemHint`)

- 押すと、`biggestProblem(score)` のルールを、減点の内訳の「場所へ移動」と同じ処理(`focusRule`)でキャンバスに光らせる
- ボタンの下に説明(`data-testid="hint-problem-text"`、`aria-live="polite"`)を出す
  - 1行目: `いちばん大きい減点: <RULE_LABEL>(-<点>点)`
  - 2行目: `RULE_WHY[rule].trouble`
  - 3行目: `光っている場所を見て、どう直せばよいか考えてみよう`
- 押すたびに、そのときのコードで選び直す(直していくと、次に大きい減点に移る)
- 減点が無い(100点)ときは無効にする

## TDD対象の純粋関数

### `biggestProblem`(`domain/scoring/biggestProblem.ts`)

- 行数 -10・循環依存 -20・責務の混在 -10 → `'cycle'`
- 行数 -10・責務の混在 -10(同点) → `deductions` の並びで先のもの
- 減点なし → `undefined`
- `points` が 0 の減点は選ばない

## 受け入れ基準

1. 中級1を開くと、ヒントの欄に `どこが問題?` `次の一手` `動きで見る` が並び、`次の一手` と `動きで見る` は無効になっている
2. `どこが問題?` を押すと、循環依存(いちばん大きい減点)の場所がキャンバスで光り、説明に `いちばん大きい減点: 循環依存(-20点)` と、何が困るかが出る。どう直すかは書かれていない
3. ①を押したあとは `次の一手` `動きで見る` が押せ、今までどおり手順の文・動きが見られる
4. ステージを切り替えると、また①から始まる
5. 100点では `どこが問題?` が無効になっている
6. 既存のヒントの E2E は、①を押す手順と新しい文言に合わせて通る
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 模範解答の手順(②の中身)や動き(③の中身)の変更
- ①で、減点のルールごとに書き分けた、より具体的な問いかけ(例:「どのメソッドが相手のデータを使っている?」)
- ヒントを使った回数の採点・記録
- `toolbar-answer-menu`(#171)の確認ダイアログの「ヒントを見る」の扱い。#171 が先にマージされていたら、確認ダイアログの「ヒントを見る」は、①をまだ見ていなければ①、見ていれば②を開くようにする
