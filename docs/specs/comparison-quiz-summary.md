# comparison-quiz-summary: 設計くらべの最後の問題のあとに、結果のまとめと次の行き先を出す

## 背景・目的

2026-10-17 に設計くらべを4問目まで解くと、最後の問題で答えたあとに何も起きなかった。「次のクイズへ」ボタンが消えるだけで、

- 4問中何問正解したか
- 終わったのかどうか
- 次に何をすればよいか(リファクタリングに戻る、白紙設計に挑戦する、など)

が分からない。問題の切り替えはプルダウン(`select`)でもできるが、各問の答えは問題を切り替えると消える(`QuizQuestion` が `key={quiz.id}` で作り直されるため)ので、
解いた問題を見返しても自分の答えが残っていない。

理解度チェックには `N問中M問正解` のまとめがある(`ConceptCheckPanel`)ので、同じ形にそろえる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/quiz/ComparisonQuizView.tsx` | presentation | 各問の答えを `ComparisonQuizView` で持ち、最後の問題のあとにまとめを出す |
| 新規 | `src/presentation/quiz/summarizeQuiz.ts` | presentation | 答えからまとめの文を作る純粋関数 |
| 新規 | `src/presentation/quiz/summarizeQuiz.test.ts` | presentation | 上のテスト |
| 変更 | 設計くらべの E2E(`e2e/` の design-comparison 系) | E2E | 下の受け入れ基準を確かめる |

`domain` は変更しない(正誤の判定は既存の `judge` 相当を使う)。

## データ・型の変更

- `ComparisonQuizView` の状態に `answers: Readonly<Record<string, 'a' | 'b'>>`(クイズのID → 選んだ側)を持つ
- `QuizQuestion` は、その問題の答えを props で受け取り、選んだら `onAnswer(choice)` で親へ返す(答えた問題を開き直すと、答えと解説が出たままになる)
- 保存(localStorage)はしない。ページを開き直したら最初から

## 表示の仕様

- 最後の問題に答えたあと、「次のクイズへ」の代わりに `結果を見る` ボタンを出す。全問に答えていれば、押すとまとめを出す
- まとめ(`data-testid="quiz-summary"`):
  - `全問正解!(4問中4問正解)` / `4問中3問正解`(理解度チェックと同じ書き方)
  - 不正解だった問題のタイトルの一覧(押すとその問題へ移る)
  - ボタン: `もう一度解く`(答えを消して1問目へ)・`リファクタリングに戻る`・`白紙設計に挑戦する`
- 答えていない問題があるときに `結果を見る` を押すと、まとめの代わりに `まだ答えていない問題があります: <タイトル>…` を出す
- プルダウンの各問の表示名の末尾に、答えた問題は `(✓)` / `(✗)` を付ける

## TDD対象の純粋関数

### `summarizeQuiz(quizzes, answers)`(`presentation/quiz/summarizeQuiz.ts`)

- 4問すべて正解 → `{ correct: 4, total: 4, wrongIds: [], unansweredIds: [] }`
- 1問不正解 → `wrongIds` にそのID
- 1問未回答 → `unansweredIds` にそのID、`correct` は答えた問題だけで数える

## 受け入れ基準

1. 設計くらべを4問とも答えて `結果を見る` を押すと、`4問中N問正解` と不正解の問題の一覧が出る
2. 2問目に答えてから1問目へ戻り、また2問目を開くと、2問目の答えと解説が残っている
3. `もう一度解く` で、すべての答えが消えて1問目に戻る
4. `リファクタリングに戻る` でリファクタリングモードに切り替わる
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 設計くらべの問題の追加
- 結果の保存・進捗への反映
