# 仕様草案: 設計くらべの答え合わせで、「変更が必要なメソッド」を設計A・Bの図の上に印で示す

- slug: `quiz-change-site-marks`
- 元になった探索: `docs/pipeline/quiz-change-site-marks/01-discovered.md`
- 関連する既存仕様: `docs/specs/design-comparison-quiz.md`(設計くらべクイズ本体)、`docs/specs/implement-change-request.md`(「変更×N」の印 `change-site-badge` の前例)

## 1. 背景・目的

設計くらべクイズの答え合わせは、変更が必要だったメソッドを `DesignResult` の1行の文(「変更が必要: sendWelcomeMail、sendFarewellMail(1クラス・1ファイル・+8行)」)
でしか見せていない。図(`CodebasePreviewCanvas` → `PreviewClassNode`)は回答の前後で変わらないので、プレイヤーは文に出たメソッド名を
左右の図から自分で探すことになる。

リファクタリング画面では、変更依頼のあとキャンバスのメソッドに「変更×N」の印(`MethodChipView` の `changeCount`、`data-testid="change-site-badge"`)
がすでに出る。この**同じ印を、答え合わせのあとのクイズの図にも出す**。「Aは Mailer の中だけ、Bは UserController の太いメソッドに入る」が
図を見ただけで分かり、ゲームの中心の学び(何個のブロックを触る必要があったか)を短い手数で体感させられる。

### ponytail の階段での判断

- 作る必要があるか: ある(01の背景のとおり。文だけでは図との対応をプレイヤーが自分で探す必要がある)
- もうあるか: ある。変更箇所は `judgeComparison` が返す `verdict.assessments[choice].impact.sites`(メソッドIDの配列)、印の見た目は
  `MethodChipView` の `changeCount` と `.method-chip__badge`。**新しく書くのは「sites を図のノードまで届ける経路」だけ**
- 経路: `PreviewClassNode` は React Flow のカスタムノードなので親から props を直接渡せない。ノードの `data` に載せると `layoutCodebase.ts`
  (他パイプラインも触る共通のレイアウト)を変えることになる。すでにプレビュー用ノードへ `codebase`・`methodLimit` を届けている
  `CodebasePreviewContext` に1フィールド足すのが最小
- domain / application / infrastructure の変更は要らない。新しい依存も足さない

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割・変更内容 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/preview/CodebasePreviewContext.ts` | presentation | `CodebasePreviewValue` に `changeSites: readonly string[]` を足す |
| 変更 | `src/presentation/preview/CodebasePreviewCanvas.tsx` | presentation | 任意の props `changeSites?: readonly string[]`(既定は空配列)を足し、Context に載せる |
| 変更 | `src/presentation/preview/PreviewClassNode.tsx` | presentation | Context から `changeSites` を読み、`MethodChipView` に `changeCount={changeSites.includes(method.id) ? 1 : 0}` を渡す |
| 変更 | `src/presentation/quiz/ComparisonQuizView.tsx` | presentation | `DesignPanel` で、回答後だけ `changeSites={verdict.assessments[choice].impact.sites}` を `CodebasePreviewCanvas` に渡す |
| 変更 | `e2e/quiz.spec.ts` | (E2E) | 末尾にテストを1本足す(5章) |

**変更しないもの**: `src/domain/**`、`src/application/**`、`src/infrastructure/**`、`src/presentation/canvas/MethodChip.tsx`
(`changeCount` の既存 props を使うだけ。未決事項1で選択肢B・Cを選んだ場合のみ変更)、`src/index.css`(既存の `.method-chip__badge` を使うだけ。
未決事項2で選択肢Bを選んだ場合のみ追記)、`src/presentation/canvas/layoutCodebase.ts`、`src/presentation/preview/CodebasePreviewDialog.tsx`
とその呼び出し元(`StagePanel.tsx`・`ChangeRequestPanel.tsx`・`BlankDesignResultPanel.tsx`。`changeSites` を渡さないので今までどおり印は出ない)、
`docs/specs/design-comparison-quiz.md`。

## 3. データ/型の変更

ドメインモデル・永続化スキーマ・ストア(`useGameStore.ts`)の変更は無し。presentation 層の型だけ変わる。

```ts
// src/presentation/preview/CodebasePreviewContext.ts
export type CodebasePreviewValue = {
  readonly codebase: Codebase;
  readonly methodLimit: number;
  /** 印を付けるメソッドのID(変更が必要な場所)。印が要らない図では空配列。 */
  readonly changeSites: readonly string[];
};
```

```ts
// src/presentation/preview/CodebasePreviewCanvas.tsx の props
type CodebasePreviewCanvasProps = {
  readonly codebase: Codebase;
  readonly methodLimit: number;
  readonly wheelZoom?: boolean;
  /** 「変更×1」の印を付けるメソッドのID。設計くらべの答え合わせで使う。省略すると印を出さない。 */
  readonly changeSites?: readonly string[];
};
```

- Context 側の `changeSites` は必須にする(Provider を使うのは `CodebasePreviewCanvas` だけなので、既定値はそこで一度だけ決める)
- `ComparisonQuizView.tsx` の `DesignPanel` では `verdict === null` のとき `changeSites` を渡さない(=空配列)。回答前に印が出ると答えが見えるため
  (リファクタリング画面で「実装中は印を出さない」としているのと同じ理由)
- `impact.sites` は重複の無いメソッドIDの配列(`findChangeSites` が1メソッド1回で返す)で、クイズの依頼は1件なので `changeCount` は常に 0 か 1。
  数える処理(`filter(...).length`)は書かず `includes` で足りる
- 問題を変えたときの消去は、既存の `QuizQuestion` の `key={quiz.id}` による `choice` のリセット → `verdict` が `null` になる流れにそのまま乗る
  (追加の処理は要らない)

### 決めたこと(未決事項にしないもの)

- **読み上げ**: 印を `aria-hidden` にはしない。`PreviewClassNode` のメソッドは `div` で、印の文字「変更×1」はメソッド名の直後に読まれ、
  図の中でも意味が通る。`aria-hidden` にするには `MethodChipView` に props を足す必要があり、情報を隠す理由も無い。
  図の下の `DesignResult` の文も今までどおり残す
- **fitView**: 変えない。クラスノードの幅は `layoutCodebase.ts` の `CLASS_WIDTH`(280px)で固定され、印が増えてもノードの大きさ・配置は変わらない
  (リファクタリング画面のキャンバスで同じ印が出ているのと同じ)。回答後に図を再フィットする処理は要らない
- **印の `data-testid`**: 既存の `change-site-badge` をそのまま使う。クイズの画面は切り替えてもアンマウントせず `hidden` で残る(`App.tsx` 55行目)ため、
  E2E では必ず `quiz-design-a`/`quiz-design-b` の中に絞って数える(ページ全体で数えると、隠れた別画面の印まで数える)

## 4. TDD対象の純粋関数

**なし。** domain / application 層に新しいロジックを書かない(`impact.sites` は既存の `measureChange` が計算し、`measureChange.test.ts`・
`judgeComparison.test.ts` で守られている)。presentation 層で書くのは `includes` による受け渡しだけで、切り出す純粋関数は無い。
プレイヤーの操作(回答・次のクイズへ)に関わる表示の変化なので、CLAUDE.md の方針どおり **Playwright の E2E で守る**。

カバレッジの閾値(`vite.config.ts`、domain / application 対象)には影響しない。

## 5. 受け入れ基準

1. クイズの1問目(`quiz-user-controller-mail`、依頼は `notification`)で、`e2e/quiz.spec.ts` の末尾に足した次のE2Eが通る
   (テスト名の例: 「答え合わせのあと、設計A・Bの図で変更が必要なメソッドに印が出て、次のクイズへ進むと消える」。AAAのコメントを付け、
   既存テストと同じく Act / Assert を段階ごとに繰り返してよい)
   - 回答前: `quiz-design-a`・`quiz-design-b` それぞれの中の `change-site-badge` が 0 個
   - `quiz-choose-a` を押したあと:
     - `quiz-design-a` の `preview-class-Mailer` の中の `change-site-badge` が 2 個(`sendWelcomeMail`・`sendFarewellMail`)
     - `quiz-design-a` の `preview-class-UserController` の中の `change-site-badge` が 0 個(模範解答で呼び出し行だけになっている)
     - `quiz-design-b` の `preview-class-UserController` の中の `change-site-badge` が 2 個(`registerUser`・`deleteUser`)
   - `quiz-next` を押したあと: `quiz-design-a`・`quiz-design-b` の中の `change-site-badge` が 0 個
   - 数は `toHaveCount` で確かめる(小さい図の `fitView` の見え方に左右されないように)
2. 既存の `e2e/quiz.spec.ts`・`e2e/refactor.spec.ts`(`change-site-badge` を使う2本を含む)が変更なしで通る
3. 変更前の図・解答例の図(`CodebasePreviewDialog` 経由)には印が出ない(呼び出し元のコードに差分が無いことで確認)
4. `npm run check`(lint + typecheck + test)が通る。`as`・非nullアサーション・不要な `?.`/`??` を使わない
5. 2章の「変更しないもの」に差分が無い(未決事項で B・C を選んだ場合はその分だけ例外)

## 6. スコープ外

- 白紙設計の答え合わせ(`BlankDesignResultPanel.tsx`)・変更依頼の「解答例の図」「変更前の図」(`CodebasePreviewDialog`)への同じ印。
  `changeSites` を渡せば出せる形にはなるが、他パイプラインが触るファイルなので要望が出てから
- 印の付いたメソッドを含むクラス・ファイルの枠の強調、波及(`rippleClasses`)のクラスへの印(未決事項2で選ばれた場合を除く)
- 印をクリック・ホバーしたときの説明(どの処理が依頼に当たるかの表示など)
- 回答後に印の付いたメソッドへ自動でズーム・パンすること
- 印の色・コントラストの変更(`color-contrast-a11y` が扱う)
- `domain`/`application` 層の変更、`ComparisonQuiz` の問題データの変更・追加(`data-placement-quizzes` が扱う)

## 未決事項

### 未決事項1: クイズの図に出す印の文言・ツールチップ(`title`)をどうするか

今の印は「変更×N」、`title` は「直前の変更依頼で、変更が必要だったメソッド」。クイズの依頼は1件なので常に「変更×1」になる。

- 選択肢A(推奨): 既存の印をそのまま使う。「変更×1」、`title` もそのまま。クイズでも画面上部に出ている依頼が「直前の依頼」なので意味はほぼ通る。
  `MethodChip.tsx` は変更なしで、`color-contrast-a11y` と競合しない
- 選択肢B: `title` だけを、どちらの画面にも合う「変更依頼で、変更が必要なメソッド」に1行書き換える(両画面共通)。
  `MethodChip.tsx` に1行の差分が出て、`color-contrast-a11y` が同じ `MethodChipView` を触るので軽い競合の可能性がある
- 選択肢C: `MethodChipView` に任意の props(例: `badgeLabel`)を足し、クイズでは「要変更」など別の文言にする。
  `color-contrast-a11y` の02が「`MethodChipView` の props は変えない」としているので、競合がいちばん大きい

### 未決事項2: メソッドの印のほかに、クラス単位の印も出すか

- 選択肢A(推奨): メソッドの印だけ。散らばり(何クラスに散ったか)は印の位置で読め、波及は図の下の減点理由の文に出ている。スコープを広げない
- 選択肢B: 変更が必要なメソッドを含むクラスの枠も強調する(`PreviewClassNode` に CSS クラスを1つ足し、`index.css` に1行追記)。
  色だけに頼らないよう、枠の形か文字の印も合わせて要る
- 選択肢C: B に加えて、波及(`rippleClasses`: 変更したクラスを呼んでいるクラス)にも「波及」などの印を出す。Context に2つ目のフィールドが要り、
  E2Eも増える
