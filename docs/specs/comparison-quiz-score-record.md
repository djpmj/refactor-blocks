# comparison-quiz-score-record: 設計くらべの正答状況を保存し、ステージ一覧に出す

## 背景・目的

実機で設計くらべに答えると「次のクイズへ」しか出ず、何問中何問正解したかが見えなかった。
コードを確認すると、全問を終えたときのまとめ(`4問中N問正解`・まちがえた問題へ戻るボタン・`もう一度解く`)は
`comparison-quiz-summary` で実装済みで、最後の問題で答えたあとの `結果を見る`(`quiz-results`)から出る。
ただし、各問の答えは `ComparisonQuizView` の `useState`(`answers`)にしか無く、**保存されない**
(`src/infrastructure/progress/` に設計くらべ用の保存は無い)。そのため、ページを読み込み直すと正答状況が消え、
ステージ一覧(`StageRoadmapDialog`)にも設計くらべの記録が出ない。

今回は、**正答状況の保存**と、**ステージ一覧への表示**を足す。まとめの画面は今のまま使う(作り直さない)。

本当に問題ごとの「選んだ側」まで保存が要るか → 要らない。一覧に出すのは「正解したことがあるか」で足りるので、
問題ごとに `'correct' | 'wrong'` だけを持つ。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/quiz/quizRecord.ts` | domain | 正答状況の型、答えを記録に足す関数、一覧用に数える関数 |
| 新規 | `src/domain/quiz/quizRecord.test.ts` | domain | 上のテスト |
| 新規 | `src/infrastructure/progress/quizRecordStorage.ts` | infrastructure | localStorage への読み書きと形の検証(`moveBestStorage.ts` と同じ書き方) |
| 新規 | `src/infrastructure/progress/quizRecordStorage.test.ts` | infrastructure | 形の検証(`isQuizRecord`)のテスト |
| 変更 | `src/presentation/quiz/ComparisonQuizView.tsx` | presentation | 答えたときに判定結果を記録に足して保存する |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | 「次のおすすめ」の下に設計くらべの正答状況を1行出す |
| 変更 | `e2e/quiz.spec.ts` | E2E | 保存と読み込み直し後の表示を確かめる |
| 変更 | `e2e/roadmap.spec.ts` | E2E | ステージ一覧の設計くらべの行を確かめる |

application 層・Zustand ストア(`useGameStore.ts`)・学習記録の書き出し/読み込み(`LearningRecordUseCases.ts`・`learningRecordStorage.ts`)は変更しない。
新しい依存は足さない。

## データ・型の変更

`src/domain/quiz/quizRecord.ts`:

```ts
export type QuizOutcome = 'correct' | 'wrong';
/** クイズのID → その問題の正答状況。一度でも正解したら 'correct'。 */
export type QuizRecord = Readonly<Record<string, QuizOutcome>>;

export function recordQuizAnswer(record: QuizRecord, quizId: string, correct: boolean): QuizRecord;

export type QuizRecordSummary = { readonly correct: number; readonly answered: number; readonly total: number };
export function summarizeQuizRecord(quizIds: readonly string[], record: QuizRecord): QuizRecordSummary;
```

保存形式: localStorage キー `refactor-blocks:quiz-record` に `QuizRecord` を JSON で書く(例: `{"quiz-1":"correct","quiz-2":"wrong"}`)。

`src/infrastructure/progress/quizRecordStorage.ts`:

- `isQuizRecord(value: unknown): value is QuizRecord` — 配列でないオブジェクトで、値がすべて `'correct'` か `'wrong'`
- `loadQuizRecord(): QuizRecord` — 無い・JSONが壊れている・形が違うときは `{}`(例外を投げない)
- `saveQuizRecord(record: QuizRecord): void` — 書けなくても例外を投げない(`saveMoveBests` と同じ)

## 動きの仕様

### 設計くらべ(`ComparisonQuizView`)

- A・Bのどちらかを選んだとき(`onAnswer`)、`judgeComparison` の判定(`summarizeQuiz.ts` の判定と同じ。`judged.ok && judged.value.correct`)で
  `recordQuizAnswer(loadQuizRecord(), quiz.id, correct)` を作り、`saveQuizRecord` で保存する
- 画面の `answers`(今回の回答。まとめ・プルダウンの ✓/✗ に使う)は今のまま。読み込み直したら今回の回答は空に戻る(記録は残る)
- `もう一度解く` は今回の回答だけを消す。保存した記録は消さない
- 一度 `'correct'` になった問題は、あとでまちがえても `'correct'` のまま(自己ベストと同じ考え方)

### ステージ一覧(`StageRoadmapDialog`)

- 「次のおすすめ」(`roadmap-next`)の下に、`data-testid="roadmap-quiz"` の行を出す。開いたときに `loadQuizRecord()` を読む
  (設計くらべで答えたあとにリファクタリングへ戻って開いても、最新の記録が出る)
- 文言は `summarizeQuizRecord(comparisonQuizzes.map((quiz) => quiz.id), record)` から作る:
  - 1問も答えていない(`answered === 0`): `設計くらべ: 未挑戦`
  - それ以外: `設計くらべ: ${total}問中${correct}問正解`
  - 全問正解(`correct === total`): 末尾に ` ✅` を付ける
- 「次のおすすめ」(`recommendNextStage`)・「全ステージをクリアしました」の判定には設計くらべを含めない

## 設計判断(確定)

- 保存するのは問題ごとの `'correct' | 'wrong'` だけ。選んだ側・回答の日時・回数は持たない(一覧の表示に要らない)
- 記録は「一度でも正解したら正解」。最新の回答で上書きすると、復習でまちがえたときに記録が下がり、再挑戦をためらわせるため
- 記録に無いクイズID(問題を消した後の古い記録)は `summarizeQuizRecord` で数えない。`quizIds` にあるものだけを数える
- 学習記録の書き出し/読み込み(`LearningRecordSection`)には含めない。手数の自己ベスト(`move-bests`)・段階(`milestones`)も含めていないのと合わせる
- 保存の呼び出しは presentation から infrastructure を直接呼ぶ(`ComparisonQuizView` が `comparisonQuizzes` を直接読んでいる既存の書き方に合わせ、ストアは足さない)

## TDD対象

### `recordQuizAnswer`(domain)

- `{}` に `('q1', true)` → `{ q1: 'correct' }`
- `{}` に `('q1', false)` → `{ q1: 'wrong' }`
- `{ q1: 'wrong' }` に `('q1', true)` → `{ q1: 'correct' }`
- `{ q1: 'correct' }` に `('q1', false)` → `{ q1: 'correct' }`(下がらない)
- 他の問題の記録は残る: `{ q2: 'wrong' }` に `('q1', true)` → `{ q1: 'correct', q2: 'wrong' }`
- 元の記録オブジェクトを変更しない

### `summarizeQuizRecord`(domain)

- `['q1','q2']`・`{}` → `{ correct: 0, answered: 0, total: 2 }`
- `['q1','q2']`・`{ q1: 'correct', q2: 'wrong' }` → `{ correct: 1, answered: 2, total: 2 }`
- `['q1','q2']`・`{ q1: 'correct', q2: 'correct' }` → `{ correct: 2, answered: 2, total: 2 }`
- `quizIds` に無いID: `['q1']`・`{ q1: 'wrong', old: 'correct' }` → `{ correct: 0, answered: 1, total: 1 }`
- `[]`・`{}` → `{ correct: 0, answered: 0, total: 0 }`

### `isQuizRecord`(infrastructure)

- `{}`・`{ q1: 'correct', q2: 'wrong' }` → `true`
- `null`・`[]`・`'x'`・`{ q1: true }`・`{ q1: 'a' }` → `false`

## 受け入れ基準

1. 設計くらべの1問目で正解の側を選び、ページを読み込み直してリファクタリングモードのステージ一覧を開くと、`roadmap-quiz` に `設計くらべ: 4問中1問正解` と出る
2. localStorage を空にしてステージ一覧を開くと、`roadmap-quiz` に `設計くらべ: 未挑戦` と出る
3. 1問目で不正解の側を選ぶと、ステージ一覧に `設計くらべ: 4問中0問正解` と出る。ページを読み込み直して1問目で正解の側を選ぶと `4問中1問正解` になり、
   もう一度読み込み直して1問目で不正解の側を選んでも `4問中1問正解` のまま
4. 4問すべて正解すると `設計くらべ: 4問中4問正解 ✅` と出る
5. 4問答えてまとめで `もう一度解く`(`quiz-retry`)を押しても、ステージ一覧の表示は変わらない(記録は消えない)
6. 既存の設計くらべのまとめ(`quiz-summary`・`quiz-retry`・まちがえた問題へ戻る)は今まで通り動く(`e2e/quiz.spec.ts` の既存ケースが通る)
7. localStorage の `refactor-blocks:quiz-record` に壊れた JSON を入れて読み込み直しても、画面は壊れず `未挑戦` と出る
8. 「次のおすすめ」の表示は、設計くらべの記録で変わらない
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 設計くらべの今回の回答(選んだ側)の復元。読み込み直したらプルダウンの ✓/✗ とまとめは空から始まる
- 学習記録の書き出し/読み込みへの設計くらべの記録の追加
- 設計くらべを「次のおすすめ」や「学べることごと」(`ConceptMasteryList`)に含めること
- 白紙設計モードの記録
- 記録を消すボタン
- 設計くらべのまとめ画面の見た目の変更(`comparison-quiz-summary` で実装済み)
