# wrong-move-reason-hint: 減点が変わらなかった一手に「効いていません」と、その理由を1文で出す

## 背景・目的

チュートリアル1(`tutorial-extract-method`)を実機で遊んで、次の不足を見つけた。

- `printMonthlyReport` から「画面に出力する」だけを抽出すると、`printMonthlyReport` は短くなる。でも上限28行はまだ超えているので、「行数」の減点1件は残り、点数は90点のまま変わらない
- このとき画面に出るのは、抽出の初回のお知らせ(「抽出すると、新しいメソッドの宣言と呼び出しの分だけ合計の行数は少し増えます…」。`useGameStore.ts` の `notice`)だけ。操作の結果(`operation-result-feedback`)は出ない
- 原因はコードで確かめた。`describeOperationResult`(`src/presentation/stage/describeOperationResult.ts`)は、どのルールも件数が変わらなければ `null` を返す。そのため、件数が変わらない一手では操作への評価が何も出ない
- 学習者には「今の一手が効いたのか、なぜ効かなかったのか」が分からない。そのため、同じ方向の一手をくり返すか、別の分け方を考えるかを決められない

そこで、**減点の件数が1つも変わらなかった組み替え**の直後に、既存の操作の結果と同じ場所へ「効いていません: 〜」を1文で出す。行数の上限を超えたまま短くなった対象があれば、「何行→何行に減ったが、上限をまだ何行超えているか」を伝える。なければ、変わらずに残っている減点を伝える。

既存の `operation-result-feedback` との差分は、件数が変わらないときの `null` を文にする部分だけ。件数が変わったとき(「増えました」「消えました」)の文と表示は変えない。

## ponytailチェック

1. YAGNI: 「効きました」の一文は足さない。件数が変わったときは、既存の「〜の減点が1件消えました(+10)」と↑↓の記号で、効いたこととその理由がもう伝わっている。足すのは、何も出ていない「件数が変わらない」場合だけ。責務の混在のような、採点にないものさしで「この一手は筋が悪い」と判定することもしない(採点と食い違う評価を見せないため)。
2. 既存の再利用: 表示は `OperationResult.tsx`・`operationResult` の状態・8秒で消えるタイマー(`clearStaleToasts`)をそのまま使う。行数の判定は `findLineLimitViolations`(`src/domain/scoring/lineLimits.ts`)、対象の名前は `describeTargets`(`src/presentation/stage/describeTargets.ts`)、ルール名は `RULE_LABEL`(`describeScore.ts`)を使う。前後の `Score` は `scoredOperation` で計算済みのものを渡す(採点を増やさない)。
3. 標準機能: 新しい依存は足さない。見た目は既存の `.operation-result` に、傾向の修飾子を1つ足すだけ。

## 設計判断(確定)

- **出すのは「組み替え」をしたときだけ**。メソッドがどのクラスにあり、どの処理(Fragment)をどの順に持つかが前後で変わったときを組み替えとみなす。クラス名の変更・可視性の変更のように配置が変わらない操作では、これまでどおり `null` にする。名前の変更のたびに「効いていません」と出すと、責められているように読めて邪魔になるため。判定は、操作の種類を `commit` に渡す形にはせず、前後の `Codebase` を比べる純粋関数で行う。`commit` を呼んでいる箇所(`applyResult`・抽出・インライン化・削除)を変えずに済むため。
- **減点が0のとき(100点で、さらに組み替えた)は出さない**。直すものがないので、「効いていない」と言う意味がない。
- **理由の優先順位は、行数の進み具合を先にする**。前後どちらでも上限を超えていて、行数が減った対象(メソッド・クラス・ファイル)があれば、それを1文にする。複数あれば、減った行数がいちばん多いものを選ぶ。同じ数なら、`findLineLimitViolations` の並び(メソッド→クラス→ファイル)で先のものにする。「分ける方向は合っているが、量が足りない」ことが伝わり、次の一手を決めやすいため。
- **行数が減った対象がなければ、残っている減点を出す**。`after.deductions` のうち `count > 0` のルールを、並びどおりに2つまで出す。3つ以上なら「ほかN項目」と付ける。
- **文は1行にまとめ、先頭に「効いていません:」を付ける**。既存の `lines` の形(1〜2行)に収まる。
- **傾向は新しく `'unchanged'` を足す**。記号は `→`(`aria-hidden`)で、左の線の色は `--muted`(`src/index.css` に定義済み)にする。点数は下がっていないので、赤(`worse`)にはしない。
- **変更依頼の実装中・「最初に戻す」・Undo/Redo では、これまでどおり `null`**。`scoredOperation` の既存の分岐をそのまま使う。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/stage/describeOperationResult.ts` | presentation | `OperationTone` に `'unchanged'` を足す。`describeNoEffect` と、配置が変わったかを調べる非公開の関数を足す |
| 変更 | `src/presentation/stage/describeOperationResult.test.ts` | presentation(test) | `describeNoEffect` のテスト(AAA) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `scoredOperation` で、`describeOperationResult` が `null` のとき `describeNoEffect` を呼ぶ |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation(test) | チュートリアル1で出力だけを抽出したときの記録のテスト |
| 変更 | `src/presentation/canvas/OperationResult.tsx` | presentation | `TONE_MARK` に `unchanged: '→'` を足す |
| 変更 | `src/index.css` | presentation | `.operation-result--unchanged` の左の線の色(`--muted`) |
| 新規 | `e2e/wrong-move-reason-hint.spec.ts` | E2E | 受け入れ基準のE2E |

`domain` / `application` / `infrastructure` は変更しない。新しい依存は足さない。`ErrorToast.tsx` と `notice` の文言は変更しない。

## データ・型の変更

```ts
// src/presentation/stage/describeOperationResult.ts
import type { Codebase } from '../../domain/codebase/Codebase';
import type { LineLimits } from '../../domain/scoring/lineLimits';

/** 'unchanged' は、組み替えたが減点の件数が1つも変わらなかったとき。 */
export type OperationTone = 'better' | 'worse' | 'mixed' | 'unchanged';

/**
 * 減点の件数が変わらなかった組み替えに、効いていない理由を1文で付ける。
 * 配置が変わっていない・減点が0のときは null。
 */
export function describeNoEffect(input: {
  readonly before: Codebase;
  readonly after: Codebase;
  readonly limits: LineLimits;
  /** 操作の後の採点(件数は操作の前と同じ)。 */
  readonly score: Score;
}): OperationResult | null;
```

`OperationResult` の形(`tone`・`lines`)と、ストアの `operationResult` の型は変えない。保存形式(下書き・進捗)の変更はなし。

## 動きの仕様

### `describeNoEffect(input)`

1. 配置が変わったかを調べる。前後の `Codebase` で、メソッドIDごとに「持ち主のクラスID」と「Fragment ID の並び」を比べる。メソッドが増えた・消えた場合も変わったとみなす。どれも同じなら `null`。
2. `score.deducted === 0` なら `null`。
3. 行数の進み具合: `findLineLimitViolations(before, limits)` と `findLineLimitViolations(after, limits)` で、`kind` と `targetId` が同じで、`after.lines < before.lines` のものを探す。見つかれば、減った行数がいちばん多いもの(同じなら後の結果の並びで先のもの)を選び、次の1行にする。
   - `効いていません: ${名前} は${前の行数}行→${後の行数}行に減りましたが、上限${limit}行をまだ${後の行数 - limit}行超えています`
   - `名前` は `describeTargets(after, 対象)` の先頭の `label`(メソッドなら `ReportService.printMonthlyReport()`、クラスなら `ReportService`、ファイルなら `〜 のファイル`)。名前が取れなければこの手順を飛ばす。
4. 3で文が作れなければ、残っている減点の1行にする。`score.deductions` のうち `count > 0` のものを並びどおりに取り、先頭の2つを `「${RULE_LABEL[rule]}」${count}件` にして `・` でつなぐ。3つ以上なら、末尾に `ほか${残りの数}項目` を `・` でつなぐ。
   - `効いていません: 残っている減点(${上の並び})は、この一手では減りませんでした`
5. 返り値は `{ tone: 'unchanged', lines: [作った1行] }`。
6. 引数を変更しない。

### 記録(`scoredOperation`)

- `describeOperationResult(before, after)` が `null` のときだけ、`describeNoEffect({ before: state.codebase, after: codebase, limits: state.stage.limits, score: after })` の結果を `operationResult` に入れる。件数が変わったときの動き・`celebration` は変えない。
- 消え方(8秒・×・Undo/Redo・「最初に戻す」・ステージ切り替えで消える)は、既存の `operationResult` と同じ。

### 表示(`OperationResult.tsx`)

- `tone` が `'unchanged'` のとき、記号 `→` と、`operation-result--unchanged`(左の線が `--muted`)で出す。それ以外の表示は変えない。

## TDD対象

### `describeNoEffect`(presentation、`src/presentation/stage/describeOperationResult.ts`)

テストの `Codebase` は小さく手で組み立ててよい。`Score` も `deductions` を手で組み立ててよい。

- 正常系: 上限28行のメソッドが39行→31行になる組み替え → `lines` が `['効いていません: <Class>.<method>() は39行→31行に減りましたが、上限28行をまだ3行超えています']`、`tone: 'unchanged'`
- 正常系: 上限を超えた対象が2つあり、それぞれ5行と8行減った → 8行減った方の文になる
- 正常系: 上限を超えた対象が同じ行数だけ減った → メソッドの方(`findLineLimitViolations` の並びで先)の文になる
- 正常系: 行数が減った対象がなく(メソッドを別クラスへ移しただけ)、`line-limit` が1件残っている → `効いていません: 残っている減点(「行数」1件)は、この一手では減りませんでした`
- 境界: 残っている減点のルールが3つ → `(「行数」1件・「結合度」1件・ほか1項目)`
- 境界: 操作の後に上限内に収まった対象は、3の候補にしない(件数が変わらないのは別の対象が増えた場合などで、その対象は「まだ超えて」いないため)
- 境界: 配置が同じ(メソッド名・クラス名だけが違う) → `null`
- 境界: `score.deducted` が0 → `null`
- 引数の `Codebase`・`Score` を変更しない

### ストア(`useGameStore.test.ts`)

- チュートリアル1で `frag-print` だけを抽出すると、`operationResult.tone` が `'unchanged'` で、`lines[0]` が `/^効いていません: ReportService\.printMonthlyReport\(\) は\d+行→\d+行に減りましたが、上限28行をまだ\d+行超えています$/` に一致する
- 既存の「減点が変わらない操作(`renameClass`)の後は null」のテストが、変更なしで通る

## 受け入れ基準

1. チュートリアル1で、`printMonthlyReport` から「画面に出力する」だけを抽出すると、キャンバス上部中央に「効いていません: ReportService.printMonthlyReport() は◯行→◯行に減りましたが、上限28行をまだ◯行超えています」が出る。記号は `→` で、左の線は灰色系。点数は90点のまま。
2. 1と同時に、画面下の抽出の初回のお知らせ(「抽出すると、新しいメソッドの宣言と呼び出しの分だけ…」)も読める。
3. 1の結果は、ほかの操作の結果と同じく8秒で消え、×でもキーボード(Tab→Enter)でも閉じられ、Undo(Ctrl+Z)で消える。
4. クラス名の変更のように配置が変わらない操作では、何も出ない。
5. 100点の状態からさらに抽出しても、件数が変わらなければ「効いていません」は出ない。
6. 減点の件数が変わる操作(集計だけを抽出、表の組み立てと出力をまとめて抽出)の結果は、これまでどおりの文と色で出る。
7. E2E(`e2e/wrong-move-reason-hint.spec.ts`): 1・2・3(Undoで消える)・4を確かめる。既存の `e2e/operation-result-feedback.spec.ts` が変更なしで通る。
8. `describeNoEffect` とストアの変更に、AAAパターンのテストがある。
9. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 件数が変わった操作に「効きました」の一文を足すこと。既存の「消えました」「増えました」で伝わっている。
- 採点にないものさし(元からあるメソッドの責務の混在など)での「筋が悪い一手」の判定。採点のルールを足すなら別の仕様にする。
- 次に何をすべきかの提案(「あと◯行分の処理を抽出しよう」「この処理を抽出しよう」など)。ヒント(`hint-strategy-phases`・`ghost-hint`)に任せる。
- 件数は変わったが、別の対象の行数がまだ上限を超えている、といった件数の変化と行数の進み具合を組み合わせた文。
- 変更依頼の実装中の操作の結果。
- 抽出の初回のお知らせ(`notice`)の文言・出し方の変更。
