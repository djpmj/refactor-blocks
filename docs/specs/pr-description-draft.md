# pr-description-draft: クリア画面で、今回の組み替えを説明するPR説明文の下書きを自動で作り、コピーできるようにする

## 背景・目的

ステージを100点にすると全画面のクリア画面(`ClearScreen`、[clear-celebration-screen](clear-celebration-screen.md))が出て、次の行き先を選べる。
ただし現場では、リファクタリングは「直したら終わり」ではなく、**何を・なぜ変えたか**をPRでレビュアーに説明して初めてマージされる。
今のゲームには、自分がした組み替えを文章にまとめる場がない(`src/` と `docs/specs` を「PR」「説明文」「clipboard」で grep し、該当する機能も仕様も無いことを確認済み)。

材料はすでにそろっている。

- 何をしたか: ステージの初期コード(`stage.codebase`)と今のコードの差(「組み替える前と比べる」の `fragmentChanges` と同じ考え方)
- どの順でしたか: 操作の記録([operation-score-history](operation-score-history.md))の `operationTimeline`
- なぜしたか: 初期コードと今のコードの採点の差(`describeRuleChanges`)

そこで、クリア画面に「PR説明文の下書き」の折りたたみ欄を足し、上の材料から**テンプレートで**日本語のPR説明文(Markdown)を組み立てて表示し、ボタン1つでコピーできるようにする。
学習者は下書きを読んで「この組み替えはこう説明するのか」を知り、コピーして手直しする練習ができる。AIは使わない。

### 設計判断(確定)

1. **置き場所はクリア画面(`ClearScreen`)の選択肢の下。既定は閉じた `<details>`。** 祝う演出と「次の行き先を選ぶ」主目的を邪魔しない。主ボタンへの初期フォーカス・Esc で閉じる扱い・選択肢の並びと `data-testid` は変えない(既存の `e2e/clear-screen.spec.ts` と、各E2Eの `dismissClearScreen` ヘルパーに影響させない)。
2. **欄は読み取り専用の `<textarea readOnly>`。** 学習者が下書きを書き換える場ではない(書き換えはコピーした先でする)。[clear-reflection-note](clear-reflection-note.md) が「クリア画面に入力欄を置くとフォーカスと Esc がぶつかる」としてメモ欄をサイドバーに置いた判断とも衝突しない(入力を受けないので、Esc はダイアログを閉じるまま)。振り返りメモの機能・保存には触れない。
3. **何を変えたか(変更内容・影響範囲・振る舞い)は「初期コード → 今のコード」の差から出す。** 操作の記録(`History`)は下書きから再開すると空になり、「最初に戻す」をまたぐと途中の手が混ざるため、差分のほうが確実。
4. **作業の流れだけは操作の記録から出す。** `operationTimeline` の結果のうち、取り消し済み(`undone`)の手を除き、最後の「最初に戻す」より後の手だけを、番号を振り直して並べる。記録が無ければ(下書きから再開した直後に100点にした場合など)その旨を1行で書く。
5. **動機は「初期コードの採点 → 今の採点」の `describeRuleChanges`。** 既存の文(「「行数」の減点が1件消えました(+10)」)をそのまま使い、新しい文言の表を作らない。
6. **振る舞いが変わっていないことは、ゲームが確かめられる事実だけを書く。** 「元からある処理(`call` 以外の Fragment)のうち、いくつを中身を変えずに残したか」と、取り除いた処理のラベル。ゲームはテストを実行しないので、テストが通ったとは書かず、`- [ ] 既存のテストがすべて通ることを確認した` の**未チェックの**チェック項目を置き、学習者に「PRでは振る舞いの保証を示すもの」と気づかせる。
7. **出力は Markdown の文字列。** GitHub などのPR本文にそのまま貼れる形にする。見出しは `## 概要` から始める。
8. **層の分け方**: コードの差の構造化は domain(`refactoringSummary`)、文の組み立ては presentation の純粋関数(`prDescriptionDraft`)。減点ルールの表示名 `RULE_LABEL` と `describeRuleChanges`・`operationTimeline` が presentation にあるため、文の組み立ても同じ層に置く(`describeOperationResult`・`operationTimeline` と同じ作法)。application・infrastructure は変えない。
9. **コピーは `navigator.clipboard.writeText`。** 失敗(権限が無い・安全でない接続)したら「コピーできませんでした。欄の文を選んでコピーしてください」と出す(欄は読み取り専用でも選択できる)。ブラウザAPIを直接呼ぶのは `LearningRecordSection` のダウンロードと同じ作法で、infrastructure に包まない。
10. **下書きの計算は `<details>` を開いたときだけ。** 開くまでは採点を増やさない(クリア画面のアニメーションを重くしない)。

## ponytailチェック

1. YAGNI: 本当に編集できる欄・テンプレートの選択・英語版が要るか → 要らない。読み取り専用の1種類で足りる。コピーした先で直せる。
   クリア画面を閉じたあとサイドバーからもう一度見る手段が要るか → 今は作らない(スコープ外)。要ると分かったら、同じ部品をサイドバーの `ReflectionNoteCard` の下に置くだけで済む形にしておく。
2. 既存の再利用: 操作の流れは `operationTimeline`(変更しない)、動機の文は `describeRuleChanges`(変更しない)、採点は `scoreCodebase`、「最初に戻す」の操作名は store で使っている文字列を定数にして共有する。処理の置き場所の比べ方は `fragmentChanges` / `designDiff` と同じく Fragment ID を軸にする。`call` の判定は `domain/scoring/responsibilities.ts` の `CALL_RESPONSIBILITY` を使う。
3. 標準機能: `<details>`/`<summary>`(キーボードで開閉できる)、`<textarea readOnly>`、`navigator.clipboard`、`role="status"`。新しい依存は足さない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/stage/refactoringSummary.ts` | domain | 初期コードと今のコードの差を、抽出・移動・追加クラス・消したメソッド・触ったファイル・残した処理の数にまとめる純粋関数 |
| 新規 | `src/domain/stage/refactoringSummary.test.ts` | domain(test) | 上のテスト(先に書く) |
| 新規 | `src/presentation/stage/prDescriptionDraft.ts` | presentation | `RefactoringSummary`・採点の前後・操作の記録から、PR説明文(Markdown)を組み立てる純粋関数 |
| 新規 | `src/presentation/stage/prDescriptionDraft.test.ts` | presentation(test) | 上のテスト(先に書く) |
| 変更 | `src/presentation/stage/operationTimeline.ts` | presentation | `export const RESET_OPERATION_LABEL = '最初に戻す'` を足す(関数 `operationTimeline` は変えない) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `resetStage` の `commit(…, '最初に戻す', false)` の文字列を `RESET_OPERATION_LABEL` に置き換える(振る舞いは変えない) |
| 新規 | `src/presentation/stage/PrDescriptionDraft.tsx` | presentation | クリア画面の折りたたみ欄(`<details>`・読み取り専用の欄・コピーボタン・結果の表示) |
| 変更 | `src/presentation/stage/ClearScreen.tsx` | presentation | `.clear-screen__choices` の直後に `PrDescriptionDraft` を置く |
| 変更 | `src/index.css` | presentation | `.pr-draft` 一式(クリア画面の上で読める色・幅・左寄せ) |
| 新規 | `e2e/pr-description-draft.spec.ts` | E2E | 受け入れ基準を確かめる |

`application` / `infrastructure` は変更しない。`History`・`operationTimeline` の関数本体・`describeRuleChanges`・`clearChoices`・ストアの状態(`GameState` の型)・保存形式は変更しない。新しい依存は足さない。

## データ・型の変更

### domain(`src/domain/stage/refactoringSummary.ts`)

```ts
import type { Codebase } from '../codebase/Codebase';

export type MethodRef = { readonly className: string; readonly methodName: string };

export type RefactoringSummary = {
  /**
   * 初期コードに無いメソッド(method.id で判定)。to は今のコードでの場所。
   * from は、そのメソッドの処理(call 以外)が初期コードで属していたメソッド(重複なし、処理の並び順)。
   * 処理がすべて新しい(初期コードに無い)ときは []。
   */
  readonly extracted: readonly { readonly to: MethodRef; readonly from: readonly MethodRef[] }[];
  /** 初期コードにもあるメソッドで、持ち主のクラスID が変わったもの。fromClass は初期コードでのクラス名、toClass は今のクラス名。 */
  readonly moved: readonly { readonly methodName: string; readonly fromClass: string; readonly toClass: string }[];
  /** 初期コードに無いクラス(class.id で判定)の今の名前。今のコードの並び順。 */
  readonly addedClasses: readonly string[];
  /** 初期コードにあって今のコードに無いメソッド(統合・呼び出し元へ戻す・削除)。初期コードでの名前。 */
  readonly removedMethods: readonly MethodRef[];
  /**
   * 中身(クラスID・メソッドID・処理ID の組の集合)が変わったファイルのパス。
   * 今のコードにあるファイルは今のパス、今のコードで消えたファイルは初期コードのパス。今のコード → 消えたファイルの順。
   */
  readonly touchedFiles: readonly string[];
  /** 初期コードの処理(call 以外)の数。 */
  readonly originalFragments: number;
  /** そのうち、今のコードにも同じ ID で残っている数。 */
  readonly keptFragments: number;
  /** 今のコードで消えた処理(call 以外)のラベル。初期コードの並び順。 */
  readonly removedFragmentLabels: readonly string[];
};

/** 初期コード before と今のコード after の差を、PR説明文の材料にまとめる。引数は変更しない。 */
export function refactoringSummary(before: Codebase, after: Codebase): RefactoringSummary;
```

- `call` の判定は `CALL_RESPONSIBILITY`(`src/domain/scoring/responsibilities.ts`)を import して使う。
- 名前の変更(クラス名・メソッド名)・可視性の変更・継承/実装先の変更・フィールドの移動は、この型では区別しない(ファイルの中身の比べ方にも入らない)。`// ponytail: 名前・可視性・継承・フィールドの変化は拾わない。PR説明に出したくなったら RefactoringSummary に項目を足す` を残す。

### presentation(`src/presentation/stage/prDescriptionDraft.ts`)

```ts
import type { Score } from '../../domain/scoring/score';
import type { RefactoringSummary } from '../../domain/stage/refactoringSummary';
import type { OperationTimelineEntry } from './operationTimeline';

/** PR説明文(Markdown)の下書きを組み立てる。末尾に改行を1つ付ける。 */
export function prDescriptionDraft(input: Readonly<{
  /** ステージ名(stage.title)。 */
  stageTitle: string;
  summary: RefactoringSummary;
  /** 初期コードの採点。 */
  before: Score;
  /** 今のコードの採点。 */
  after: Score;
  /** operationTimeline の結果(取り消し済みを含むそのまま)。 */
  steps: readonly OperationTimelineEntry[];
}>): string;
```

```ts
// src/presentation/stage/operationTimeline.ts に足す
/** 「最初に戻す」の操作名。ストアの resetStage と PR説明文の作業の流れで共有する。 */
export const RESET_OPERATION_LABEL = '最初に戻す';
```

ストアの状態・保存形式の変更はなし。

## 動きの仕様

### PR説明文のテンプレート(`prDescriptionDraft`)

次の5つの節をこの順で、節の間を空行1つで区切って出す。`<…>` は差し込み、`{…}` は条件つきの行。

```markdown
## 概要

<stageTitle> のコードをリファクタリングしました(<before.total>点 → <after.total>点)。

### 変更内容

- `<to.className>.<to.methodName>()` を `<from[0].className>.<from[0].methodName>()`・… から抽出
- `<methodName>()` を `<fromClass>` から `<toClass>` へ移動
- クラス `<addedClass>` を追加
- `<className>.<methodName>()` を削除

### 作業の流れ

1. <label>(<scoreBefore>点 → <scoreAfter>点)
2. …

## 動機

- <describeRuleChanges(before, after) の1文>
- …

## 振る舞いが変わっていないこと

- 元からある処理 <originalFragments> 個のうち <keptFragments> 個は、中身を変えずに置き場所だけを変えています
{- 取り除いた処理: 「<label>」・「<label>」}
- [ ] 既存のテストがすべて通ることを確認した

## 影響範囲

- `<touchedFiles[0]>`
- …
```

細かい規則:

- **変更内容**: 抽出 → 移動 → 追加クラス → 削除 の順、それぞれ `RefactoringSummary` の並び順。抽出で `from` が空なら「`X.m()` を追加」とする(` から抽出` を付けない)。`from` が複数なら `・` でつなぐ。4種類がすべて空なら `- 構造の変更はありません` の1行。
- **作業の流れ**: `steps` から `undone` の手を除き、残りのうち `label === RESET_OPERATION_LABEL` の最後の手より**後ろ**だけを使い、1から番号を振り直す。使う手が無ければ `- 操作の記録はありません(再読み込みの前や下書きから再開する前の操作は記録に残りません)` の1行。
- **動機**: `describeRuleChanges(before, after)` を1文1行で全部出す(切り詰めない)。空なら `- 解消した減点はありません`。
- **振る舞い**: `originalFragments` が0なら1行目を `- 元からある処理はありません` にする。`removedFragmentLabels` が空なら「取り除いた処理」の行は出さない。チェック項目は常に未チェック(`- [ ]`)で出す。
- **影響範囲**: `touchedFiles` を1行ずつ。空なら `- なし`。
- 文字列はすべて固定の日本語テンプレート。乱数・日時・AI は使わない(同じ入力なら同じ出力)。

### クリア画面の折りたたみ欄(`PrDescriptionDraft.tsx`)

- `ClearScreen` の `.clear-screen__choices` の直後に置く(主ボタンへの初期フォーカス・選択肢・`onCancel` は今のまま)。
- 構造:
  - `<details className="pr-draft" data-testid="pr-draft" onToggle=…>`(既定は閉じている)
  - `<summary>`: `PR説明文の下書きを見る`
  - 開いたときだけ中身を描く(開いたかどうかを `useState` で持つ):
    - `<p>`: `今回の組み替えを、レビュアーに説明する文の下書きです。コピーして、自分の言葉に直して使えます。`
    - `<textarea readOnly rows={14} aria-label="PR説明文の下書き" data-testid="pr-draft-text" value={下書き}>`
    - `<button type="button" data-testid="pr-draft-copy">コピー</button>`
    - `<p role="status" data-testid="pr-draft-status">`: 初めは空。コピーに成功したら `コピーしました`、失敗(`writeText` が reject、または `navigator.clipboard` が無い)したら `コピーできませんでした。欄の文を選んでコピーしてください`
- 下書きの材料(開いたときに `useMemo` で1回だけ計算する。依存は `stage`・`codebase`・`history`・`operationLabels`):
  - `summary = refactoringSummary(stage.codebase, codebase)`
  - `before = scoreCodebase(stage.codebase, stage)`、`after = scoreCodebase(codebase, stage)`
  - `steps = operationTimeline(history, codebase, (c) => scoreCodebase(c, stage), (c) => operationLabels.get(c))`(`OperationHistoryPopover` と同じ呼び方)
  - `stageTitle = stage.title`
- 見た目(`src/index.css`): `.pr-draft` は `width: min(100%, 640px); text-align: left;`、`summary` はボタンと同じくらいの押しやすさ(`min-height: 44px` 相当・`cursor: pointer`)、`textarea` は `width: 100%; font-family: monospace; color: #fff; background: #111827;`(クリア画面の背景の上で、ライト・ダークどちらのテーマでも読める)。選択肢と同じく `clear-choices-in` で遅れてフェードインし、`prefers-reduced-motion: reduce` では止める(既存の `@media` の対象に `.pr-draft` を足す)。幅375pxでも横にはみ出さない(ダイアログは今も `overflow: auto` で縦にスクロールできる)。
- キーボード: Tab で `summary` に移り Enter/Space で開閉、Tab で欄・コピーボタンへ進める。Esc は今までどおりクリア画面を閉じる(`dismissClearScreen`)。

## TDD対象

### `refactoringSummary`(domain、`refactoringSummary.test.ts`)

Codebase は最小のオブジェクトを手で組み立てる(`fragmentChanges.test.ts` と同じ作法)。

- 変化なし(同じ Codebase) → 4種類とも `[]`、`touchedFiles: []`、`keptFragments === originalFragments`、`removedFragmentLabels: []`
- 抽出: `Report.print` の処理 `a`・`b` を新しいメソッド `Report.aggregate`(新しい method.id)へ移し、`print` に call の処理を足す → `extracted: [{ to: { className: 'Report', methodName: 'aggregate' }, from: [{ className: 'Report', methodName: 'print' }] }]`、`moved: []`、`touchedFiles` に `Report` のファイルのパスだけ
- 抽出したメソッドの処理が2つのメソッドから来ている → `from` が2件、処理の並び順、重複なし
- 新しいメソッドの処理がすべて初期コードに無い(call だけなど) → `from: []`
- 移動: 同じ method.id が `A` から `B` へ → `moved: [{ methodName, fromClass: 'A', toClass: 'B' }]`、`extracted: []`、`touchedFiles` に `A` と `B` のファイル(別ファイルなら2件、同じファイルなら1件)
- 新しいクラスへの移動: 新しい class.id `C` にメソッドが移る → `addedClasses: ['C']` と `moved` の両方に出る
- 新しいファイル: 新しい file.id のファイルにクラスが入る → そのパスが `touchedFiles` に入る
- 削除・統合: 初期コードのメソッドが無くなる → `removedMethods` に初期コードでの名前。その処理(call 以外)が今のコードに無ければ `removedFragmentLabels` にラベルが入り、`keptFragments` が減る
- call の処理は `originalFragments`・`keptFragments`・`removedFragmentLabels` に数えない(呼び出し元へ戻すで call が消えても `removedFragmentLabels` は空)
- ファイルが消えた → 初期コードのパスが `touchedFiles` の末尾に入る
- クラス名だけを変えた(ID は同じ) → `moved`・`addedClasses`・`touchedFiles` に出ない(名前の変更は拾わない)
- 引数の Codebase を変更しない

### `prDescriptionDraft`(presentation、`prDescriptionDraft.test.ts`)

`summary`・`Score`・`steps` は手で組み立てる。期待値は出力全体の文字列で比べるケースを1つ持ち、残りは `toContain` / `not.toContain` で確かめる。

- 正常系(全体一致): 抽出1件・移動1件・追加クラス1件、動機1文、手2つ、触ったファイル2件 → テンプレートどおりの Markdown 全文(節の順・空行・末尾改行1つ)
- 抽出の `from` が空 → `を追加` の行になり、`から抽出` を含まない
- 抽出の `from` が2件 → `・` でつながる
- 変更内容が空 → `- 構造の変更はありません`
- 作業の流れ: 取り消し済みの手を含む → 出ない
- 作業の流れ: `[抽出, 最初に戻す, 移動, 抽出]` → `1. メソッドの移動` `2. メソッドの抽出` だけ(最初に戻すとそれより前は出ない、番号は1から)
- 作業の流れ: 最後の手が「最初に戻す」・`steps` が空・すべて取り消し済み → `操作の記録はありません` の行
- 作業の流れの各行は `(<scoreBefore>点 → <scoreAfter>点)` を含む
- 動機: `describeRuleChanges` の文が全部出る(3件なら3行、切り詰めない)。差が無ければ `- 解消した減点はありません`
- 概要: `<stageTitle> のコードをリファクタリングしました(90点 → 100点)。`
- 振る舞い: `removedFragmentLabels` が空なら `取り除いた処理` を含まない。2件なら `「a」・「b」`。`originalFragments` が0なら `元からある処理はありません`。チェック項目 `- [ ] 既存のテストがすべて通ることを確認した` を常に含む
- 影響範囲が空 → `## 影響範囲` の下が `- なし`
- 同じ入力で2回呼ぶと同じ文字列(決定的)

### ストア(`useGameStore.test.ts`)

- 既存の「`resetStage` で今のコードの操作名が「最初に戻す」になる」テストが、`RESET_OPERATION_LABEL` に置き換えたあとも変更なしで通る(新しいテストは足さない)

`PrDescriptionDraft.tsx`(表示とクリップボードの呼び出し)はユニットテストの対象外とし、E2E で確かめる。

## E2E対象(`e2e/pr-description-draft.spec.ts`)

ブラウザのコンテキストに `clipboard-read`・`clipboard-write` の権限を与える(`context.grantPermissions`)。100点にする手順は `e2e/clear-screen.spec.ts` の `clearTutorial1` と同じ(チュートリアル1で `printMonthlyReport` の1・2番目の処理を `aggregateSales` として抽出)。

1. クリア画面が出た時点で、主ボタン(`clear-choice-primary`)にフォーカスがあり、`pr-draft` は閉じていて `pr-draft-text` は見えない
2. `PR説明文の下書きを見る` を押すと、`pr-draft-text` の値に次の文字列がそれぞれ含まれる
   - `## 概要`
   - `チュートリアル1: 長いメソッドを分ける のコードをリファクタリングしました(90点 → 100点)。`
   - ``- `ReportService.aggregateSales()` を `ReportService.printMonthlyReport()` から抽出``
   - `1. メソッドの抽出(90点 → 100点)`
   - `「行数」の減点が`
   - `- [ ] 既存のテストがすべて通ることを確認した`
   - ``- `src/report/ReportService.ts` ``
3. `コピー` を押すと `pr-draft-status` が `コピーしました` になり、`navigator.clipboard.readText()` の結果が `pr-draft-text` の値と一致する
4. キーボードだけで: Tab で `summary` にフォーカスを移して Enter で開ける。欄が開いた状態で Esc を押すとクリア画面が閉じる
5. `今の画面へ戻る`(`clear-choice-back`)で今までどおり閉じられる
6. 既存の `e2e/clear-screen.spec.ts`・`e2e/operation-score-history.spec.ts`・`e2e/reflection-note.spec.ts` が変更なしで通る

(初期点・減点の文言は実装時に実機の表示で確かめ、上の期待値と違えば E2E の期待値を実機に合わせる。ただし節の見出しとチェック項目の文言は仕様どおりにする。)

## 受け入れ基準

1. チュートリアル1を操作で初めて100点にすると、クリア画面の選択肢の下に、閉じた状態の「PR説明文の下書きを見る」が出る。主ボタンへの初期フォーカス・選択肢の並び・Esc で閉じる動きは今までどおり
2. 開くと、`## 概要`・`### 変更内容`・`### 作業の流れ`・`## 動機`・`## 振る舞いが変わっていないこと`・`## 影響範囲` の節を持つ Markdown の下書きが読み取り専用の欄に出て、抽出したメソッド名と抽出元・解消した減点・触ったファイルのパスが入っている
3. 取り消した手と、最後の「最初に戻す」より前の手は「作業の流れ」に出ない
4. 「コピー」でクリップボードに下書きの全文が入り、`コピーしました` と表示される。コピーできない環境では `コピーできませんでした。欄の文を選んでコピーしてください` と表示される
5. 下書きはAIを使わず、同じ状態からは同じ文になる
6. キーボードだけで開閉・コピーでき、欄は `PR説明文の下書き` のラベルで取れる。ライト・ダーク両テーマで欄の文字が読め、幅375pxで横にはみ出さない
7. `refactoringSummary`・`prDescriptionDraft` に AAA パターンのテストが先にあり、上の TDD対象のケースを満たす
8. E2E(`e2e/pr-description-draft.spec.ts`)が上の「E2E対象」1〜5を確かめ、6の既存E2Eが変更なしで通る
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 下書きを画面の中で編集できるようにすること(コピーした先で直す)・下書きの保存・履歴
- クリア画面を閉じたあとにサイドバーやステージ一覧から下書きを見返すこと(要ると分かったら `PrDescriptionDraft` をサイドバーの `ReflectionNoteCard` の下に置く別仕様にする)
- AI講評を使った文の生成・言い回しの添削・下書きの採点
- 振り返りメモ(`reflectionNotes`)を下書きに含めること
- 名前の変更・可視性・継承/実装先・フィールドの移動を「変更内容」に出すこと
- 実際のテストやC#の実行(`StageRuntime`・`csharp-export`)を使って振る舞いの保証を示すこと
- 英語版・テンプレートの切り替え・GitHub への投稿などの連携
- 変更依頼(`changeRequests`)の実装中・設計くらべ(`quiz`)・白紙設計(`blank`)での表示(クリア画面が出る条件は [clear-celebration-screen](clear-celebration-screen.md) のまま変えない)
- `ClearScreen` の演出・選択肢・出す条件、`OperationHistoryPopover` の表示の変更
