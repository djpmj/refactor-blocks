# 設計くらべクイズ

## 背景・目的

今のゲームは「直す」練習ばかりで、「見分ける」練習がない。実務で設計の目が試されるのは、レビューや
設計相談で**2つの案のどちらが良いかを判断する**場面が多い。

そこで、同じ機能を実装した設計A・Bと変更依頼を1つ見せ、「この変更が楽なのはどちらか」を選ばせるクイズを追加する。
答え合わせでは、A・Bそれぞれに依頼を当てた結果(変更が必要な場所・減点の理由)を並べる。
手を動かさずに判断だけを繰り返せるので、1問が数十秒で終わる。

**ponytail**: 判定には既存の `measureChange` / `scoreChange` をそのまま使う。設計A・Bは、既存ステージの
初期コードと模範解答(`applySolutionSteps`)から作る。新しい設計データを手で書く量を最小にするため。
表示には「解答例の図」の読み取り専用キャンバスを再利用する。

前提: `docs/specs/volatility-axis-stages.md`(中級4・中級5)が実装済みであること。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/quiz/ComparisonQuiz.ts` | domain | 新規 | クイズの型 |
| `src/domain/quiz/judgeComparison.ts` | domain | 新規 | 回答を判定する純粋関数 |
| `src/domain/quiz/judgeComparison.test.ts` | domain | 新規 | 上記のテスト |
| `src/infrastructure/quizzes/comparisonQuizzes.ts` | infrastructure | 新規 | クイズの一覧(3問) |
| `src/infrastructure/quizzes/comparisonQuizzes.test.ts` | infrastructure | 新規 | 全クイズの答えが明確であることのテスト |
| `src/presentation/preview/CodebasePreviewCanvas.tsx` | presentation | 新規 | `CodebasePreviewDialog` の中のキャンバス部分を切り出したもの |
| `src/presentation/preview/CodebasePreviewDialog.tsx` | presentation | 変更 | 上記を使うようにする(見た目は変えない) |
| `src/presentation/quiz/ComparisonQuizView.tsx` | presentation | 新規 | クイズ画面 |
| `src/presentation/change/describeChange.ts` | presentation | 変更 | `describeDeductions` を `ChangeOutcome` ではなく `{ impact, score }` で受けるようにする(下記) |
| `src/presentation/App.tsx` | presentation | 変更 | 「リファクタリング」と「設計くらべ」の切り替え |
| `src/presentation/useUndoRedoShortcut.ts` | presentation | 変更 | クイズ中は Ctrl+Z / Ctrl+Y を無効にする |
| `e2e/quiz.spec.ts` | — | 新規 | E2Eテスト |

application 層にはユースケースを作らない。クイズの判定は domain の純粋関数1つで済み、
presentation が domain を直接呼ぶ既存の書き方(`StagePanel` の `scoreCodebase` など)に合わせる。

## データ/型の変更

```ts
// src/domain/quiz/ComparisonQuiz.ts
export type DesignChoice = 'a' | 'b';

export type QuizDesign = {
  /** 画面に出す短い説明。例: 「税の計算を TaxCalculator に分けた設計」 */
  readonly label: string;
  readonly codebase: Codebase;
};

export type ComparisonQuiz = {
  readonly id: string;
  readonly title: string;
  /** 状況の説明(何のコードで、どんな依頼が来たか)。 */
  readonly description: string;
  readonly limits: LineLimits;
  readonly designs: Readonly<Record<DesignChoice, QuizDesign>>;
  readonly changeRequest: ChangeRequest;
  /** 答え合わせで出す、なぜその設計が楽なのかの1〜2文。 */
  readonly explanation: string;
};
```

```ts
// src/domain/change/scoreChange.ts(application の ChangeRequestUseCases.ts から移す)
export type ChangeAssessment = { readonly impact: ChangeImpact; readonly score: ChangeScore };

// src/domain/quiz/judgeComparison.ts
export type ComparisonVerdict = {
  readonly choice: DesignChoice;
  /** 変更依頼のスコアが高い方。 */
  readonly answer: DesignChoice;
  readonly correct: boolean;
  readonly assessments: Readonly<Record<DesignChoice, ChangeAssessment>>;
};

export type JudgeError = ChangeError | 'tie';

export function judgeComparison(quiz: ComparisonQuiz, choice: DesignChoice): Result<ComparisonVerdict, JudgeError>;
```

- `{ impact, score }` の型は、変更依頼の概念なので `domain/change/scoreChange.ts` に `ChangeAssessment` として置き、
  quiz と application の両方がそれを参照する(型を重複させない)
- `describeDeductions(outcome, codebase)` と `siteNames(outcome, codebase)` は `outcome.current` しか使っていない。
  引数を `ChangeAssessment` に変え、`ChangeRequestPanel` / `ChangeMemo` からは `outcome.current` を渡す

## TDD対象の純粋関数

### `judgeComparison`(`judgeComparison.test.ts`)

テスト用の小さなクイズを作る。変更したい責務が、設計Aでは1クラス、設計Bでは2クラスに散らばっているものにする。

- 正常系: 変更依頼のスコアが高い方を選ぶと `correct: true`、`answer` はその設計
- 正常系: 低い方を選ぶと `correct: false`、`answer` は高い方
- 正常系: `assessments.a` / `assessments.b` の `impact.classesTouched` が、それぞれの設計の実際の値になる
- 異常系: 両方のスコアが同じなら `err('tie')`
- 異常系: どちらかの設計に変更箇所がない(依頼の責務を持つ処理がない)なら `err('no-sites')`

### `comparisonQuizzes.test.ts`(全クイズに `describe.each`)

- クイズIDは重複しない
- どのクイズも `judgeComparison` が `ok` を返す(引き分けにならず、両方の設計に変更箇所がある)
- 2つの設計のスコアの差が5点以上ある(答えが明確)
- 正解が全問同じ側(全部A、または全部B)に偏っていない

## クイズの一覧(`comparisonQuizzes.ts`)

設計は `applySolutionSteps(stage.codebase, sampleAnswerSteps[stage.id])` と、ステージの初期コードから作る。
ステージは `stageCatalog` の `stages` から ID で探す。見つからなければモジュールの読み込み時に例外を投げる
(開発時にすぐ気づけるように。ステージの定義は信頼できるデータなので、`Result` にしなくてよい)。

| # | id | 設計A | 設計B | 変更依頼 | 正解 |
| --- | --- | --- | --- | --- | --- |
| 1 | `quiz-user-controller-mail` | 初級1の模範解答 | 初級1の初期コード | 初級1の `req-mail-footer` | A |
| 2 | `quiz-sales-report-tax` | 中級5の模範解答(整形を分けた) | 中級4の模範解答(税を分けた) | 中級4の依頼1件目 | B |
| 3 | `quiz-sales-report-format` | 中級5の模範解答(整形を分けた) | 中級4の模範解答(税を分けた) | 中級5の依頼1件目 | A |

- 2と3は**同じ2つの設計**で、依頼だけが違う。一覧でもこの順に並べ、続けて解かせる。
  explanation には「同じ設計でも、どこが変わるかで良し悪しが入れ替わる」と書く
- `limits` には元のステージの `limits` を使う

## 画面

- `App` の上部に「リファクタリング」「設計くらべ」を切り替えるボタン(`role="tab"` を使うか、`aria-pressed` 付きのボタン)を置く。
  「設計くらべ」を選んでいる間は `StagePanel` / キャンバス / サイドパネルの代わりに `ComparisonQuizView` を出す。
  リファクタリング中の状態(コードベース・履歴)は保持したままにし、切り替えても消えないようにする。
  画面はアンマウントせず `hidden` で隠す(ファイルの箱の位置・ズーム・選びかけの処理・ヒント・クイズの回答も残すため)。
  クイズの画面は初めて開いたときにマウントする(見えないまま React Flow の fitView が走ると表示がずれるため)
- 設計のキャンバスはホイールでズームしない(`wheelZoom={false}`)。スクロールするページの中にあるので、ホイールはページのスクロールに使う
- 問題文に行数の上限と「変更箇所1つにつき+◯行」を、答え合わせに「+◯行」を出す(2問目・3問目は上限超えで答えが決まるため)
- 回答したら判定結果へ、「次のクイズへ」で進んだら新しい問題の見出しへフォーカスを移す
- `ComparisonQuizView`(状態はコンポーネント内の `useState` で持つ。Zustand には入れない)
  - クイズの選択(`select`)、title・description・変更依頼の title / description
  - 設計A・Bを左右に並べる(狭い画面では縦に積む)。各設計に label と `CodebasePreviewCanvas` を付ける
  - 「Aのほうが楽」「Bのほうが楽」のボタン。回答後は押せなくする
  - 回答後の表示: 正解か不正解か、explanation、設計ごとの「変更が必要なメソッド名・クラス数・ファイル数・スコア」と
    `describeDeductions` の減点理由
  - 「次のクイズへ」ボタン。最後のクイズでは出さない
- `CodebasePreviewCanvas`: `CodebasePreviewDialog` の `<div className="codebase-preview__canvas">` の中身
  (Provider + ReactFlow)を、props `{ codebase, methodLimit }` で切り出す
- `data-testid`: `mode-quiz`、`mode-refactor`、`quiz-choose-a`、`quiz-choose-b`、`quiz-verdict`、`quiz-next`

## 受け入れ基準

- `npm run check` が通る
- `judgeComparison.test.ts` と `comparisonQuizzes.test.ts` が上記のケースを持ち、通る
- `e2e/quiz.spec.ts`:
  - 「設計くらべ」に切り替えると、1問目の設計A・Bが表示される
  - 正解の側を選ぶと `quiz-verdict` に「正解」が出る。不正解の側を選ぶと「不正解」が出る
  - 「次のクイズへ」で2問目に進む
  - 「リファクタリング」に戻ると、切り替える前に操作したコードベースがそのまま残っている
- 既存の E2E(`refactor.spec.ts` / `preview.spec.ts`)が通る(`CodebasePreviewDialog` を切り出した影響がない)
- キーボードだけで、モードの切り替え・回答・次へ進む操作ができる

## スコープ外

- クイズの正解数の保存(localStorage)と、ステージ選択への ✅ 表示
- 3つ以上の設計から選ぶ形式、複数の変更依頼をまとめて判定する形式
- 「なぜそう思ったか」を書かせて AI に講評させる機能
- 上級5(`docs/specs/lone-superclass-scoring.md`)を使う4問目。上級5の仕様の側で追加する

## 未決事項

- なし(正解・不正解の数を記録するかは、遊んでもらってから決める)
