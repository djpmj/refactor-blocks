# comparison-quiz-reason-choice: 設計くらべで、A・Bを選んだあとに「楽な理由」を3択で選ばせ、両方合って正解にする

## 背景・目的

実機で設計くらべ1問目を開き「Bのほうが楽」を押すと、すぐに `❌ 不正解(楽なのは設計A)` と解説(`quiz.explanation`)が出る。
A・Bの2択を当てるだけなので、当てずっぽうでも半分は正解になる。しかも「なぜ楽か」を自分で言えたかどうかは確かめられない。

A・Bを選んだあとに「そう考えた理由に近いもの」を3択で選ぶ2段目を挟む。**設計と理由の両方が合ったときだけ正解**にする。
誤答の解説は、選んだ理由ごとに出し分ける(よくある思い込みのそれぞれに、どこが違うかを返す)。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/quiz/ComparisonQuiz.ts` | domain | `explanation` を `reason: ConceptCheck` に置き換える。`QuizAnswer` 型を足す |
| 変更 | `src/domain/quiz/judgeComparison.ts` | domain | 設計と理由をまとめて判定する `judgeQuizAnswer` を足す(`judgeComparison` はそのまま残して中で使う) |
| 変更 | `src/domain/quiz/judgeComparison.test.ts` | domain | `quizOf` を `reason` 付きにし、`judgeQuizAnswer` のテストを足す |
| 変更 | `src/infrastructure/quizzes/comparisonQuizzes.ts` | infrastructure | 4問それぞれに理由の3択(選択肢ごとの解説つき)を書く。今の `explanation` の文は正解の選択肢の解説に移す |
| 変更 | `src/infrastructure/quizzes/comparisonQuizzes.test.ts` | infrastructure | 理由の3択が書き方の決まりを満たすことを確かめる |
| 変更 | `src/presentation/quiz/summarizeQuiz.ts` | presentation | 答えの型を `QuizAnswer` にし、`judgeQuizAnswer` で正誤を数える |
| 変更 | `src/presentation/quiz/summarizeQuiz.test.ts` | presentation | 上に合わせる |
| 変更 | `src/presentation/quiz/ComparisonQuizView.tsx` | presentation | A・Bを選んだあとに理由の3択を出し、両方答えたら判定と理由ごとの解説を出す |
| 変更 | `e2e/quiz.spec.ts` | E2E | 既存の回答操作を2段階にし、下の受け入れ基準を足す |

application 層は変更しない(設計くらべは presentation が domain を直接呼ぶ既存の書き方のまま)。新しい依存は足さない。

## データ・型の変更

ponytail: 理由の3択は、理解度チェックの型 `ConceptCheck`(`src/domain/stage/Stage.ts`。`choices: { text; explanation }[]` と正解の添字 `answer`)と、
その判定 `judgeCheck`・書き方の検査 `validateCheck`(`src/domain/stage/conceptCheck.ts`)がそのまま使えるので、新しい型を作らない。

```ts
// src/domain/quiz/ComparisonQuiz.ts
import type { ConceptCheck } from '../stage/Stage';

export type ComparisonQuiz = {
  // ...id / title / description / limits / designs / changeRequest は今のまま
  /** 2段目: 楽な設計を選んだ理由の3択。選択肢ごとの explanation が、その理由を選んだときの解説になる。 */
  readonly reason: ConceptCheck;
  // explanation は削除する(正解の選択肢の explanation に移す。同じ文を2か所に持たない)
};

/** 1問への答え。設計(1段目)と理由の添字(2段目)の両方がそろって初めて「答えた」ことになる。 */
export type QuizAnswer = { readonly design: DesignChoice; readonly reason: number };
```

```ts
// src/domain/quiz/judgeComparison.ts に追加
import { judgeCheck, type CheckJudgement } from '../stage/conceptCheck';

export type QuizAnswerVerdict = {
  readonly design: ComparisonVerdict;
  readonly reason: CheckJudgement;
  /** 設計と理由の両方が合っているときだけ true。 */
  readonly correct: boolean;
};

/** 設計くらべの1問の答えを判定する。設計の判定に失敗したら(tie / no-sites など)そのエラーを返す。 */
export function judgeQuizAnswer(quiz: ComparisonQuiz, answer: QuizAnswer): Result<QuizAnswerVerdict, JudgeError>;
```

- `reason.id` は `${quiz.id}-reason`、`reason.question` は4問共通の `'そう考えた理由に近いものは?'`(`comparisonQuizzes.ts` の定数)
- 保存形式の変更はなし(設計くらべの答えは今も画面の状態だけで、保存していない)

### 4問の理由の3択(`comparisonQuizzes.ts` に書く内容)

正解の添字は問題ごとにばらす(同じ位置を選び続けるだけで正解できないように)。正解の選択肢の解説は今の `explanation` の文をそのまま使う。
選択肢の文は、答える前に見せても設計A・Bのどちらが正解かを名指ししない書き方にする(「設計A」「設計B」の語を入れない)。

| 問題 | 添字 | 選択肢の文 | 正誤 | 解説(要旨。実装時に整えてよい) |
| --- | --- | --- | --- | --- |
| 1問目(正解の設計: A) | 0 | クラスの数が少ないほど、読む場所が減って変更しやすいから | 誤 | 数が少なくても、1クラスにHTTP・DB・メールが混ざっていると、メールを直すときに他の処理まで巻き込む。数より「変わる理由ごとに分かれているか」を見る |
| | 1 | メールの処理が1か所にまとまっていて、直すクラスがそこだけで済むから | 正 | 今の1問目の `explanation` |
| | 2 | ファイルやクラスが多いほど、きちんと整理された設計だから | 誤 | 分ける数が多いこと自体は良さではない。分けすぎると1つの変更で複数のクラスを直すことになる(4問目)。依頼で変わる処理が1か所に閉じているかで決まる |
| 2問目(正解の設計: B) | 0 | 税の計算が小さなクラスに閉じていて、変更がそのクラスの中で済むから | 正 | 今の2問目の `explanation` |
| | 1 | 帳票の整形を分けてあるほうが、どんな変更にも強いから | 誤 | 整形を分けた設計が強いのは整形が変わるとき(3問目)。税の変更は148行の SalesReportService に入り、上限150行を超える |
| | 2 | メソッドの数が少ないほうが、変更する場所を探しやすいから | 誤 | メソッドの数ではなく、依頼で変わる処理(税の計算)がどこにあるかで変更の大きさが決まる |
| 3問目(正解の設計: A) | 0 | 2問目で楽だった設計は、どんな依頼でも楽だから | 誤 | 同じ2つの設計でも、依頼が変われば答えは入れ替わる。どこが変わるかを先に見る |
| | 1 | 大きなクラスに処理が集まっているほうが、まとめて直せるから | 誤 | 148行の SalesReportService に+28行入ると上限150行を超える。大きなクラスへの追加は、上限超えと巻き込みが起きやすい |
| | 2 | 帳票の整形が小さなクラスに閉じていて、形式の変更がそのクラスの中で済むから | 正 | 今の3問目の `explanation` |
| 4問目(正解の設計: B) | 0 | 基底クラスを用意しておけば、将来ほかの出力形式を足しやすいから | 誤 | それは2つ目の出力形式が来たときの話。今の依頼(区切り文字の変更)では BaseExporter と CsvExporter の両方を直すことになる。拡張ポイントは本当に要るときに作れば間に合う |
| | 1 | CSVという1つの概念が1クラスにまとまっていて、区切り文字の変更が1か所で済むから | 正 | 今の4問目の `explanation` |
| | 2 | クラスが1つなら、メソッドがどれだけ長くなっても困らないから | 誤 | 1クラスにまとめても、メソッドが上限を超えて長くなれば読みにくくなる。この問題で楽なのは、変更が1か所で済むから |

## 動きの仕様

### 1段目: 設計を選ぶ(今の「Aのほうが楽」「Bのほうが楽」)

- 押すと、A・Bのボタンは両方とも無効になり、押した方に `aria-pressed="true"` を付ける(どちらを選んだか見えるように)
- **この時点では正誤・解説・点数・警告色(`methodLimit`)を出さない**(理由を選ぶ前に答えが透けないように。今の `verdict === null` の扱いのまま)
- 選んだ設計は `QuizQuestion` の中の `useState` に持つ。理由を答える前に別の問題へ移ったら、選んだ設計は捨てる(その問題は未回答のまま。もう一度1段目から答える)
- 2段目の欄(下)が出たら、そこへフォーカスを移す(押したボタンが無効になってフォーカスを見失わないように。今の判定欄と同じ `tabIndex={-1}` + `focus()` のやり方)

### 2段目: 理由を選ぶ

- 1段目のボタンの下に `<fieldset data-testid="quiz-reason">` を出す。`legend` は `reason.question`
- 3つの選択肢をラジオボタン(`name` は `quiz-reason-${quiz.id}`)で並べ、「答える」ボタン(`data-testid="quiz-reason-submit"`)を置く。何も選んでいなければ「答える」は無効
- 「答える」を押すと、親の `answers` に `{ design, reason }` を入れる。以後ラジオは無効になり、選んだものにチェックが付いたまま残る
- 書き方は `ConceptCheckPanel.tsx` の `CheckItem` と同じ形(ラジオ+「答える」)にそろえる。`QuizQuestion` が60行を超えないよう、2段目は `ReasonStep` などの別コンポーネントに分ける

### 判定(両方答えたあと)

`judgeQuizAnswer` の結果で、今の `Verdict` の中身を次のように出し分ける。`AnswerVerdict` の `correct` には `verdict.correct`(両方合ったときだけ true)を渡す。

| 設計 | 理由 | 判定の文(`AnswerVerdict` の `label`) |
| --- | --- | --- |
| 正 | 正 | `⭕ 正解!(楽なのは設計X)` |
| 正 | 誤 | `❌ 不正解: 設計は合っているが、理由がちがう(楽なのは設計X)` |
| 誤 | 正・誤どちらも | `❌ 不正解(楽なのは設計X)` |

その下の解説は、今の `<p>{quiz.explanation}</p>` を次に置き換える(`ConceptCheckPanel` の `CheckResult` と同じ出し方)。

- 選んだ理由の `explanation` を `あなたの理由について:` を頭に付けて出す(理由が正解なら頭は `解説:`)
- 理由が誤りなら、続けて正解の理由の文と `explanation` を `正解の理由:` を頭に付けて出す

A・Bそれぞれの点数・変更が必要な場所・減点の理由(`DesignResult`)と警告色は、今と同じく判定が出たあとに出す。

### まとめ・プルダウン

- `summarizeQuiz` / `answerMark` は `QuizAnswer` を受け取り、`judgeQuizAnswer` の `correct` で数える。設計だけ合って理由が違う問題も「まちがえた問題」に入り、プルダウンは `(✗)` になる
- 1段目だけ答えた問題は未回答のまま(`answers` に入らないため)
- 答え済みの問題を開き直すと、選んだ設計・選んだ理由・判定・解説が出たままになる(今の振る舞いを2段目にも広げる)。「もう一度解く」で全部消える

## TDD対象

### `judgeQuizAnswer`(domain、`judgeComparison.test.ts`)

テスト用の `quizOf` に `reason: { id: 'r', question: '理由', choices: [正, 誤, 誤], answer: 0 }` を持たせる。

- 正しい設計+正しい理由 → `ok`、`correct: true`、`design.correct: true`、`reason.correct: true`
- 正しい設計+違う理由(添字1) → `ok`、`correct: false`、`design.correct: true`、`reason.correct: false`、`reason.answer: 0`
- 違う設計+正しい理由 → `ok`、`correct: false`、`design.correct: false`、`reason.correct: true`
- 違う設計+違う理由 → `ok`、`correct: false`
- 理由の添字が範囲外(-1・3) → `ok`、`reason.correct: false`(`judgeCheck` と同じく例外にしない)
- 両方の設計のスコアが同じ → `{ ok: false, error: 'tie' }`(`judgeComparison` のエラーをそのまま返す)

### `comparisonQuizzes`(infrastructure、`comparisonQuizzes.test.ts`)

- 各問の `reason` が `validateCheck` で `ok` になる
- 各問の `reason.choices` がちょうど3つ
- 各問の理由の選択肢の文に「設計A」「設計B」が入っていない
- 4問の `reason.answer` がすべて同じ値ではない
- `reason.id` が全問で重複しない

### `summarizeQuiz` / `answerMark`(presentation、`summarizeQuiz.test.ts`)

- 全問で正しい設計+正しい理由 → `correct` が問題数、`wrongIds` が空
- 1問だけ正しい設計+違う理由 → その問題が `wrongIds` に入る。`answerMark` は `(✗)`
- 答えの無い問題 → `unansweredIds` に入る。`answerMark` は空文字

## 受け入れ基準

1. 設計くらべ1問目で「Aのほうが楽」を押すと、`quiz-reason` に3つの選択肢が出て、`quiz-verdict` はまだ出ない。設計Bのプレビューに `.method-chip--over` はまだ出ない
2. 1の状態で、A・Bのボタンは両方無効で、Aのボタンに `aria-pressed="true"` が付いている。理由を選ぶまで `quiz-reason-submit` は無効
3. 1問目で「A」→「メールの処理が1か所にまとまっていて…」→「答える」と進むと、`quiz-verdict` に `⭕ 正解!` と `解説:` が出て、`quiz__verdict--correct` が付く
4. 1問目で「A」→「クラスの数が少ないほど…」→「答える」と進むと、`quiz-verdict` に `設計は合っているが、理由がちがう` と、その選択肢の解説(`あなたの理由について:`)と `正解の理由:` が出て、`quiz__verdict--incorrect` が付く
5. 1問目で「B」→任意の理由→「答える」と進むと、`quiz-verdict` に `❌ 不正解(楽なのは設計A)` が出る
6. 1問目で4の答え方をしてから4問とも答えて「結果を見る」を押すと、まとめの「まちがえた問題」に1問目が入り、プルダウンの1問目に `(✗)` が付く
7. 1問目で「A」だけ押して(理由を答えずに)プルダウンで2問目へ移り、1問目へ戻ると、A・Bのボタンが押せる状態に戻っていて、`quiz-reason` は出ていない
8. 答え済みの問題をプルダウンで開き直すと、選んだ理由にチェックが付いたまま、判定と解説が出ている
9. キーボードだけで、A・Bのボタン → 理由のラジオ(矢印キー) → 「答える」と操作して判定まで出せる。「A」を Enter で押したあと、フォーカスが `quiz-reason` の欄に移っている
10. 既存の `e2e/quiz.spec.ts` の回答操作(`quiz-choose-*` のクリック)を、理由まで答える操作に置き換えても、すべて通る
11. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 理由を自由記述で書かせて採点すること、AIに理由を講評させること(選択式で足りる。自由記述の採点は別の仕組みが要る)
- 理由の選択肢を毎回シャッフルすること(正解の位置は問題ごとにばらしてあるので、まず固定で足りる。同じ問題を解き直して位置で覚えてしまうと分かったら足す)
- 設計を間違えたときに、理由の選択肢を「選んだ設計のための理由」に切り替えること(選択肢は設計を名指ししない文にしたので1組で足りる)
- 1段目だけ答えた状態を、別の問題へ移っても残すこと
- 設計くらべの答えの保存・学習記録への反映
- 理解度チェック(`ConceptCheckPanel`)・白紙設計の変更
- 新しい問題の追加
