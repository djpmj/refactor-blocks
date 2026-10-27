# extract-class-limit-heads-up: 抽出でクラス・ファイルが上限を超えるとき、「次は受け皿のクラスへ移す段階」と前後に伝える

## 背景・目的

チュートリアル1(`tutorial-extract-method`、上限 `{ method: 28, class: 54, file: 61 }`)を実機で遊ぶと、次のことが起きる。

- 抽出は1回ごとに、宣言・呼び出し・メソッドの間の空行の分だけクラスを +6行 大きくする(`METHOD_OVERHEAD_LINES` などによる)。クラスは 42行 → 48行 → 54行 → 60行 と増える
- 例: 「画面に出力する」「今月の売上を集計する」「前月比を計算する」を1つずつ抽出する。2回目でメソッドの行数は上限内になる。ところが3回目で `ReportService` が 54行 → 60行 になり、クラスの上限(54行)を超える
- 操作の結果(`operation-result-feedback`)に「「行数」の減点が1件増えました(-10)」と出る。学習者は「正しく分けたのに減点された」と感じて手が止まる
- 「抽出すると行数が増える」ことは、すでに次の2か所で伝えている(`extract-lines-and-editor-rail`)
  - 初回の抽出のお知らせ
  - プレビューの `(ファイルは +6行: 宣言と呼び出しの分)`
- 次にやること(受け皿のクラスを用意して移す)は、ヒントの方針(`solutionPhaseTable` の `from: 3`)を後半まで開かないと出てこない

そこで、**その抽出でクラスまたはファイルが新しく上限を超えるときだけ**、抽出の前(プレビュー)と後(操作の結果)に「上限を超えるのは分けた結果で、次は受け皿のクラスへ移す段階」という流れを1文で伝える。

既存の表示との差分は、この1文だけにする。行数が増える理由の説明、減点の増減の文、ルールの説明(`LINE_LIMIT_WHY`)、ヒントの方針は変えない。

## ponytailチェック

1. YAGNI: 「上限に近づいた(あと N行)」の予告は作らない。実際に超える瞬間に1回出せば、減点の驚きは防げる。Move Method・統合など、抽出以外の操作には出さない。抽出以外でクラスが上限を超えることは、今回の問題になっていない。
2. 既存の再利用: 抽出後の行数は既存の `previewExtractMethod` で出す。今の `fileLinesBefore/After` と同じ作りで、`classLinesBefore/After` を足す。文は、前(プレビュー)と後(操作の結果)で同じ関数の結果を使う。後の表示は、既存の `operationResult`(8秒で消える・×で閉じる・`role="status"`)に1行足すだけにする。新しいトースト・タイマー・フラグは作らない。
3. 本当に別の表示が要るか: ヒントの方針(`hint-strategy-phases`)で足りるかを考えた。足りない。ヒントは自分から開かないと見えず、減点が出た瞬間には見えていないため。
4. 新しい依存は足さない。

## 設計判断(確定)

- **出す条件は「新しく超える」ときだけにする**。抽出元のクラスについて `classLinesBefore <= limits.class && classLinesAfter > limits.class` が成り立つときに出す。クラスでは成り立たず、抽出元のファイルで同じ条件(`limits.file`)が成り立つときもファイルの文で出す。抽出前からすでに超えていたときは出さない(抽出のたびに同じ文が出続けるのを防ぐ)。ちょうど上限(54行 → 54行など、`>` でない)のときも出さない。
- **クラスとファイルが同時に新しく超えるときは、クラスの文だけを出す**。1文に収めるため。クラスを分ければ、ファイルの行数も同じ操作の流れで直せる。
- **文は前後で同じものを使う**。時制に依らない書き方にする。
  - クラス: `クラスが ${before}行 → ${after}行 になり、上限(${limit}行)を超えます。分けたメソッドは、次の段階で受け皿のクラスへ移しましょう`
  - ファイル: `ファイルが ${before}行 → ${after}行 になり、上限(${limit}行)を超えます。分けたメソッドは、次の段階で受け皿のクラス(別のファイル)へ移しましょう`
  - クラス名は文に入れない(プレビューの対象は選んでいるメソッドのクラスで明らか。名前を考えさせる・意識させる要素も増やさない)
- **前(プレビュー)**: メソッドエディタの抽出プレビューの文(`describeExtractPreview` の結果)のすぐ下に、別の段落で出す。`describeExtractPreview` の文は変えない(既存のテストとE2Eを守るため)。キャンバス上の仮のメソッドの表示(`ClassNode`)には出さない。
- **後(操作の結果)**: `OperationResult` 型に、省略できる `nextStep?: string` を足す。`lines`(1〜2行)とは別の行として、`lines` の下に出す。`describeOperationResult` は変えない(`Score` だけからは、どの操作でどのクラスが超えたか分からないため)。ストアの `extractMethod` アクションが、抽出に成功し、`operationResult` が `null` でないときだけ、`nextStep` を足した新しいオブジェクトに置き換える。`operationResult` が `null` のときは足さない。これは、行数の減点がメソッド側で1件消え、クラス側で1件増えて、件数が変わらないときに起きる。このときは減点が増えたように見えないので、前のプレビューの文で足りる。
- **見た目**: `nextStep` の行は `data-testid="operation-result-next-step"` にする。先頭に `次の段階:` を太字で付け、`lines` と区別する。色は既存のトークン(`--text-muted` など、`src/index.css` に定義済みのもの)だけを使う。消え方(8秒・×・Undo などで消える)は `operationResult` のまま変えない。
- **変更依頼の実装中・手で直すシミュレーション中**は、プレビュー自体が出ない。`operationResult` も `null` になる(既存の動き)。なので、この文も出ない。追加の条件は書かない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/application/RefactorUseCases.ts` | application | `ExtractPreview` に `classLinesBefore` / `classLinesAfter`(抽出元のクラスの `classLines`)を足す |
| 変更 | `src/application/RefactorUseCases.test.ts` | application(test) | 上記のテスト |
| 新規 | `src/presentation/editor/describeGrowthHeadsUp.ts` | presentation | `describeGrowthHeadsUp`(プレビューと上限から、次の段階を伝える1文を作る純粋関数) |
| 新規 | `src/presentation/editor/describeGrowthHeadsUp.test.ts` | presentation(test) | 上記のテスト(AAA) |
| 変更 | `src/presentation/editor/describeExtractPreview.test.ts` | presentation(test) | テストの `preview` リテラルに `classLinesBefore/After` を足す(期待する文は変えない) |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | `useExtractPreviewSummary` の近くで `describeGrowthHeadsUp` を呼び、プレビューの文の下に出す |
| 変更 | `src/presentation/stage/describeOperationResult.ts` | presentation | `OperationResult` 型に `readonly nextStep?: string` を足す(関数は変えない) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `extractActions` の `extractMethod` で、成功後に `operationResult` に `nextStep` を足す |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation(test) | 上記のテスト |
| 変更 | `src/presentation/canvas/OperationResult.tsx` | presentation | `nextStep` があれば `lines` の下に出す |
| 変更 | `src/index.css` | presentation | `.operation-result__next-step` と、プレビューの下の文の見た目 |
| 新規 | `e2e/extract-class-limit-heads-up.spec.ts` | E2E | 受け入れ基準のE2E |

`domain` / `infrastructure` は変更しない(`lineCount.ts`・`lineLimits.ts`・`solutionPhaseTable.ts`・ステージ定義はそのまま)。新しい依存は足さない。

## データ・型の変更

```ts
// src/application/RefactorUseCases.ts
export type ExtractPreview = {
  // 既存のフィールドに加えて
  /** 抽出前後の、元のメソッドがあるクラスの行数(classLines)。 */
  readonly classLinesBefore: number;
  readonly classLinesAfter: number;
};
```

```ts
// src/presentation/editor/describeGrowthHeadsUp.ts
import type { ExtractPreview } from '../../application/RefactorUseCases';
import type { LineLimits } from '../../domain/scoring/lineLimits';

/** その抽出で抽出元のクラス(なければファイル)が新しく上限を超えるとき、次の段階を伝える1文。超えなければ undefined。 */
export function describeGrowthHeadsUp(preview: ExtractPreview, limits: LineLimits): string | undefined;
```

```ts
// src/presentation/stage/describeOperationResult.ts
export type OperationResult = {
  readonly tone: OperationTone;
  readonly lines: readonly string[];
  /** 抽出でクラス・ファイルが新しく上限を超えたときの、次の段階の1文。 */
  readonly nextStep?: string;
};
```

保存形式(下書き・進捗)の変更はなし。

## 動きの仕様

### `previewExtractMethod`

- 既存の `sourceFile` / `resultFile` と同じように、抽出前のコードベースで抽出元のクラスを `findClassOfMethod` で取る。抽出後のコードベースでは、同じIDのクラスを取る。それぞれの `classLines` を `classLinesBefore` / `classLinesAfter` にする。
- 抽出後のクラスが見つからなければ `undefined`(既存の `resultFile` と同じ扱い)。

### メソッドエディタ(前)

- プレビューの文が出ているとき、`describeGrowthHeadsUp(preview, stage.limits)` が文を返したら、プレビューの文のすぐ下に `<p data-testid="extract-growth-heads-up">` で出す。
- プレビューと同じ `aria-live="polite"` の範囲に入れ、選択を変えたときに読み上げられるようにする。
- 選択を変えて条件が成り立たなくなったら消える(毎回プレビューから計算し直すので、状態は持たない)。

### ストア(後)

- `extractMethod` で、既存の `preview`(抽出前に計算済み)が `undefined` でなく、抽出に成功し、`describeGrowthHeadsUp(preview, state.stage.limits)` が文を返し、`get().operationResult` が `null` でないとき、`set({ operationResult: { ...get().operationResult, nextStep } })` のように置き換える(型キャストは使わない)。
- 初回のお知らせ(`extractOverheadExplained` の `notice`)の動きは変えない。同じ抽出で両方の条件が成り立てば、画面下のお知らせと上部の操作の結果の両方が出る。

### 表示(`OperationResult.tsx`)

- `result.nextStep` があれば、`lines` の下に `<p className="operation-result__next-step" data-testid="operation-result-next-step"><strong>次の段階:</strong> {nextStep}</p>` を出す。`role="status"` の箱の中なので、一緒に読み上げられる。

## TDD対象

### `previewExtractMethod`(application、`src/application/RefactorUseCases.test.ts`)

- 正常系: 1クラス1メソッドのコードベースから処理を1つ抽出する → `classLinesAfter - classLinesBefore` が、`fileLinesAfter - fileLinesBefore` と同じになる(1ファイル1クラスのため)。値はテスト内で `classLines` を使って組み立ててよい
- 正常系: 1ファイルに2クラスあるコードベース → `classLinesBefore` は抽出元のクラスだけの行数(`fileLinesBefore` より小さい)
- 既存のテストはそのまま通る

### `describeGrowthHeadsUp`(presentation、`src/presentation/editor/describeGrowthHeadsUp.test.ts`)

`preview` はリテラルで組み立ててよい。`limits = { method: 28, class: 54, file: 61 }`。

- 正常系: クラス 54 → 60、ファイル 54 → 60 → `クラスが 54行 → 60行 になり、上限(54行)を超えます。分けたメソッドは、次の段階で受け皿のクラスへ移しましょう`
- 正常系: クラス 40 → 46(上限内)、ファイル 58 → 64 → ファイルの文(`ファイルが 58行 → 64行 になり、上限(61行)を超えます。…受け皿のクラス(別のファイル)へ移しましょう`)
- 正常系: クラスもファイルも新しく超える(クラス 50 → 56、ファイル 58 → 64) → クラスの文だけ
- 境界: クラス 48 → 54(ちょうど上限) → `undefined`
- 境界: クラスが抽出前から超えている(60 → 66)、ファイルは上限内 → `undefined`
- 境界: クラスが抽出前から超えていて、ファイルが新しく超える(クラス 60 → 66、ファイル 58 → 66) → ファイルの文
- 境界: 行数が増えない(クラス 30 → 30) → `undefined`
- 引数を変更しない

### ストア(`src/presentation/store/useGameStore.test.ts`)

- チュートリアル1で「画面に出力する」→「今月の売上を集計する」→「前月比を計算する」を1つずつ抽出する。3回目のあと、`operationResult.lines` に `「行数」の減点が1件増えました(-10)` があり、`operationResult.nextStep` がクラスの文になる
- 同じ手順の1回目・2回目のあとは `operationResult?.nextStep` が `undefined`(2回目はクラスが 54行 でちょうど上限)
- 3回目のあとに `undo` すると `operationResult` が `null`(既存の動きのまま)
- 抽出に失敗した(例: 全部の処理を選んだ)ときは `operationResult` を変えない

## 受け入れ基準

1. チュートリアル1で、`printMonthlyReport` から「画面に出力する」「今月の売上を集計する」を1つずつ抽出する。そのあと3回目として「前月比を計算する」を選ぶと、メソッドエディタのプレビューの文の下に「クラスが 54行 → 60行 になり、上限(54行)を超えます。分けたメソッドは、次の段階で受け皿のクラスへ移しましょう」が出る。1回目・2回目の選択では出ない。
2. そのまま抽出すると、キャンバス上部中央の操作の結果に「「行数」の減点が1件増えました(-10)」の行と、その下に `次の段階:` で始まる上と同じ文の行が出る。
3. 操作の結果の消え方はこれまでどおり。8秒で消え、×・Undo(Ctrl+Z)・「最初に戻す」・ステージ切り替えでも消える。Undoのあとに、もう一度「前月比を計算する」を選ぶと、プレビューの下の文がまた出る。
4. 選んでいる処理を外す・別の処理に変えて条件が成り立たなくなると、プレビューの下の文は消える。
5. 既存のプレビューの文(`(ファイルは +N行: 宣言と呼び出しの分)`)、初回の抽出のお知らせ、ヒントの方針の表示は変わらない。
6. スクリーンリーダーでは、プレビューの下の文が選択の変更で、`次の段階:` の行が操作の結果と一緒に読み上げられる。
7. E2E(`e2e/extract-class-limit-heads-up.spec.ts`)で1〜4を確かめる(8秒で消えることは除く)。既存の `e2e/extract-preview.spec.ts`・`e2e/extract-lines-and-editor-rail.spec.ts`・`e2e/operation-result-feedback.spec.ts` が変更なしで通る。
8. `previewExtractMethod`・`describeGrowthHeadsUp`・ストアの変更に、AAAパターンのテストがある。
9. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 上限に近づいたこと(あと N行で超える)の予告。
- 抽出以外の操作(Move Method・統合・インライン化など)でクラス・ファイルが上限を超えたときの文。
- 受け皿のクラスを自動で作る・移す先を提案する・候補のクラスを光らせること(ヒントの方針・ゴーストヒントで扱う)。
- 文にクラス名・ファイル名を入れること。
- 行数の数え方(`METHOD_OVERHEAD_LINES` など)、ステージの上限の値、採点の変更。
- `describeOperationResult` の文・並び順・行数の上限(1〜2行)の変更。
- キャンバス上の仮のメソッド(`ClassNode` のプレビュー)にこの文を出すこと。
- 白紙設計モード(`BlankDesignView`)。
