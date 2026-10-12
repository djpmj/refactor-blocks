# answer-feedback-animation: 正解・不正解の色分けとアニメーション演出

## 背景・目的

ステージを100点にしたあとの「理解度チェック」(`ConceptCheckPanel`)では、答えると `✓ 正解` / `✗ 不正解(正解: …)` が
太字の黒文字で出るだけで、正解と不正解が色で見分けられない。答えた瞬間の手応えも無い。
「設計くらべ」クイズ(`ComparisonQuizView`)の判定(`⭕ 正解!` / `❌ 不正解`)も、灰色の枠で表示されるだけである。

対象プレイヤー(新卒〜4年目)が学びを続けたくなるように、次の2点を行う。

- 正解は緑、不正解は赤で、ひと目で分かるようにする
- 正解したときは弾むような気持ちのよい演出、不正解のときは「惜しい」と伝わる短い演出を、答えた瞬間に出す

演出はCSSアニメーションだけで作り、新しい依存は足さない(既存の `resolved-success` / `score-glow-perfect` と同じ作り方にする)。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/feedback/AnswerVerdict.tsx` | presentation | 正解・不正解の見出しと演出をまとめた共通コンポーネント。紙吹雪(装飾用の `span`)もここで出す |
| 変更 | `src/presentation/stage/ConceptCheckPanel.tsx` | presentation | `CheckResult` の判定行を `AnswerVerdict` に置き換える。全問正解のときにまとめの行へ演出用のクラスと紙吹雪を付ける |
| 変更 | `src/presentation/quiz/ComparisonQuizView.tsx` | presentation | `Verdict` の判定行を `AnswerVerdict` に置き換え、判定枠に正解・不正解のクラスを付ける |
| 変更 | `src/index.css` | presentation | 正解・不正解の色、`@keyframes`(ポップ・シェイク・紙吹雪)、`prefers-reduced-motion` への対応 |
| 変更 | `e2e/concept-check.spec.ts` | E2E | 正解・不正解・全問正解の表示クラスを確かめるケースを足す |
| 変更 | `e2e/quiz.spec.ts` | E2E | 判定枠の正解・不正解クラスを確かめるケースを足す |

`domain` / `application` / `infrastructure` は変更しない。

## 見た目・動きの仕様

### 共通: `AnswerVerdict`

- props は `correct: boolean`、表示する文言 `label: string`、`celebrate?: boolean`(紙吹雪を出すかどうか。既定は `correct` と同じ)とする
- ルート要素にクラス `answer-verdict` を付け、さらに正解なら `answer-verdict--correct`、不正解なら `answer-verdict--incorrect` を付ける
- 文言の先頭の記号(`✓` / `✗` / `⭕` / `❌`)は、既存の文言をそのまま使う(文言は呼び出し側が渡す)

### 正解(`answer-verdict--correct`)

- 文字色は `var(--success)`。背景は `color-mix(in srgb, var(--success) 14%, var(--surface))`、左に `4px` の `var(--success)` の線を引く
- 表示された瞬間に、判定行が `scale(0.8) → 1.12 → 1` と弾む(約450ms、`ease-out` 系)
- 判定行の周りから、小さな紙吹雪(6〜10個の色付きの小片)が放射状に飛んで消える(約800ms)。
  小片は `aria-hidden="true"` の `span` にし、`pointer-events: none` とする。色は `--success` / `--accent` / 黄色系など、ライト・ダーク両方で見える色にする。
  紙吹雪は判定行の要素の中に閉じ(`position: relative` + `overflow: visible`)、サイドパネルの横スクロールを生まないこと

### 不正解(`answer-verdict--incorrect`)

- 文字色は `var(--danger)`。背景は `color-mix(in srgb, var(--danger) 12%, var(--surface))`、左に `4px` の `var(--danger)` の線を引く
- 表示された瞬間に、判定行が左右に小さく揺れる(シェイク、振幅 6px 程度・約400ms)。紙吹雪は出さない

### 理解度チェック(`ConceptCheckPanel`)

- 各問の判定行を `AnswerVerdict` で表示する。文言は今と同じ(`✓ 正解` / `✗ 不正解(正解: …)`)
- `data-testid="check-result"` と `aria-live="polite"` は今のまま残す
- 全問に答え終わり、かつ全問正解のときだけ、まとめの行(`data-testid="check-summary"`)を次のようにする
  - 文言を `全問正解!(N問中N問正解)` にする
  - クラス `concept-check__summary--perfect` を付け、`var(--success)` の太字で、1問ごとより大きい弾み(`score-glow-perfect` 相当)と、多め(16〜24個)の紙吹雪を出す
- 1問でも外したときのまとめは今と同じ `N問中M問正解`(演出なし)
- 「もう一度」を押すと、各問の判定・まとめは今と同じく消え、次に答えたときにまた演出が出る

### 設計くらべクイズ(`ComparisonQuizView`)

- `Verdict` の判定行(`quiz__verdict-title`)を `AnswerVerdict` で表示する。文言は今と同じ
- 判定枠 `.quiz__verdict` にも `quiz__verdict--correct` / `quiz__verdict--incorrect` を付け、枠線の色をそれぞれ `--success` / `--danger` にする
- 判定枠へのフォーカス移動(`tabIndex={-1}` + `focus()`)は今のまま

### 動きを減らす設定(アクセシビリティ)

- `@media (prefers-reduced-motion: reduce)` のときは、ポップ・シェイク・紙吹雪のアニメーションをすべて止める(紙吹雪は `display: none`)。
  色・背景・左の線は残し、正解・不正解は色と記号で分かるようにする
- 色だけに頼らず、今ある記号と文言(`✓ 正解` / `✗ 不正解`)は消さない

## データ・型の変更

なし(表示だけの変更)。

## TDD対象の純粋関数

なし。正解かどうかの判定は既存の `judgeCheck`(`domain/stage/conceptCheck.ts`)と `judgeComparison` をそのまま使い、
新しい判定ロジックは足さない。全問正解かどうかは `ConceptCheckPanel` で既に計算している `correctCount === checks.length` から出す。
表示の変更なので、確認はE2Eで行う。

## 受け入れ基準

1. 理解度チェックで正解の選択肢を答えると、`check-result` の中に `answer-verdict--correct` の要素が出て、文字色が `--success` の色になる
2. 理解度チェックで不正解の選択肢を答えると、`answer-verdict--incorrect` の要素が出て、文字色が `--danger` の色になり、紙吹雪の要素は出ない
3. 理解度チェックで全問正解すると、`check-summary` が `全問正解!` を含み、`concept-check__summary--perfect` が付く。1問でも外すと従来どおり `N問中M問正解` で、そのクラスは付かない
4. 設計くらべクイズで正解・不正解したとき、`quiz-verdict` にそれぞれ `quiz__verdict--correct` / `quiz__verdict--incorrect` が付く
5. `prefers-reduced-motion: reduce` をエミュレートしたとき、判定行と紙吹雪の `animation-name` が `none`(または紙吹雪が非表示)になる
6. 紙吹雪が出ている間も、サイドパネルに横スクロールバーが出ない
7. 既存の E2E(`e2e/concept-check.spec.ts`・`e2e/quiz.spec.ts` の文言の確認を含む)が通る。上の1〜5を確かめるケースを E2E に足す
8. `npm run check`(lint・型チェック・テスト)と `npm run test:e2e` が通る
9. ライトテーマ・ダークテーマの両方で、正解の緑・不正解の赤が背景に対して読める

## スコープ外

- 効果音・バイブレーション
- ステージクリア(100点)時の演出の変更(既存の `score-glow-perfect` などには手を入れない)
- 設計くらべクイズ全体を通した「全問正解」のまとめ(今はまとめの表示自体が無いため、作らない)
- 紙吹雪のための外部ライブラリ(canvas-confetti など)の追加
- 選択肢(ラジオボタン)自体の色付け
- 正解数・連続正解数の記録や保存
