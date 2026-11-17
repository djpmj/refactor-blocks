# reviewer-mode: 完成済みの問題ある設計に「気になる」印を付けて答え合わせする読み専用のレビューモード

## 背景・目的

今のゲームは「自分で組み替える」(リファクタリング・白紙設計)と「2つを見比べる」(設計くらべ)だけで、
**1つの設計を読んで、どこが臭うかを自分で指摘する**練習が無い。実務の新卒〜4年目が最初に求められるのは、
直すことより先に、コードレビューで「ここが気になる」と言えること。

そこで、既存ステージの開始状態(=問題を含む設計)を読み専用で見せ、プレイヤーが問題だと思うクラス・メソッドに
「気になる」印を付け、既存の採点ルール(`domain/scoring`)の違反を正解として答え合わせするモードを足す。
取りこぼし(見逃し)と見当違い(問題の無いブロックへの印)を分けて示し、レビューの嗅覚を鍛える。

### 第4のモードにするか、既存モードに組み込むか(調査結果と決定)

**第4のモード「コードレビュー」として足す**。理由:

- `App.tsx` のモードは `type Mode = 'refactor' | 'quiz' | 'blank'` と `MODE_LABEL`、`(['refactor','quiz','blank'] as const).map(...)` の
  3か所に1語ずつ足すだけで並べられ、初回表示でマウントする仕組み(`quizOpened`/`blankOpened`)もそのまま真似できる。
- リファクタリングモードに組み込むと、`useGameStore` の編集操作(ドラッグ・抽出・Undo・変更依頼・手で直すモード)を
  すべて「読み専用中は止める」分岐が要り、変更が大きい。白紙設計は専用ストアで部品を置く画面なので用途が違う。
- 設計くらべは A/B 2択の問題データ(`ComparisonQuiz`)前提で、1つの設計に印を付ける操作と合わない。
- 読み専用の描画は、設計くらべ・解答例で使っている `CodebasePreviewCanvas`(`presentation/preview/`)がそのまま使える。
  ドラッグも store も持たないので、プレイヤーがコードを変えてしまう心配がない。

### 正解の決め方(調査結果と決定)

`domain/scoring/violationTargets.ts` の `violationTargets(codebase, stage)` が、ルールごとに違反の対象
(`fileIds` / `classIds` / `methodIds`)を返している(キャンバスの強調表示で使用中)。
この `classIds` と `methodIds` を**そのまま正解の箇所**にする。採点ルールを新しく書かない。

- ファイルだけが対象の違反(ファイルの行数超え・空のファイル)は印を付けられないので正解に入れない。
  出題するステージは、開始状態のすべての減点がクラスかメソッドを対象に持つものに限る(infrastructure のテストで守る)。
- 照合は**IDの完全一致**。メソッドが正解なのにそのクラスへ印を付けても正解にしない(答え合わせで「見逃し」と「見当違い」の
  両方に出るので、どの粒度が問題だったかが分かる)。「惜しい」判定はYAGNIで作らない。

### 問題データ(調査結果と決定)

**新しいステージ・コードベースは作らない**。既存ステージの `stage.codebase`(開始状態)と、そのステージの
`limits` / `dependencyLimit` / `responsibilityLimit` / `visibilityEnforced` / `layers` / `cohesiveResponsibilities` をそのまま使う。
足すデータは「どのステージを出題するか」のID一覧だけ。減点の種類が重ならないよう、`docs/stages/report.md` から次の5つを、この順に出す。

| 順 | ステージID | 開始状態の主な減点 |
| --- | --- | --- |
| 1 | `intermediate-middle-man` | 横流しするだけのクラス(OrderManager)のみ。1問目の練習用 |
| 2 | `intermediate-misplaced-private` | 行数・結合度・アクセス制御 |
| 3 | `intermediate-cyclic-dependency` | 循環依存・行数・責務の混在 |
| 4 | `intermediate-feature-envy` | Feature Envy・カプセル化の破れ・行数 |
| 5 | `intermediate-extract-class` | 行数・凝集度 |

`reviewProblems.test.ts`(下記)が通らないIDがあれば、**そのIDを一覧から外す**(ステージデータを書き換えない・代わりのIDも足さない)。
外した結果3問を下回る場合は実装を止めて報告する。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/review/judgeReview.ts` | domain | 正解の箇所を作る `reviewSpots` と、印を照合する `judgeReview` |
| 新規 | `src/domain/review/judgeReview.test.ts` | domain | 上記のユニットテスト(先に書く) |
| 新規 | `src/infrastructure/review/reviewProblems.ts` | infrastructure | 出題するステージIDの一覧と、`stages` から引いた `Stage[]` |
| 新規 | `src/infrastructure/review/reviewProblems.test.ts` | infrastructure | 一覧のIDが全部引けること・各問題の減点が全部印を付けられることの検証 |
| 新規 | `src/presentation/review/ReviewerView.tsx` | presentation | レビューモードの画面(問題の選択・印・答え合わせ・結果) |
| 変更 | `src/presentation/App.tsx` | presentation | `Mode` に `'review'` を足し、モード切り替えに「コードレビュー」を並べる |
| 変更 | `src/presentation/preview/CodebasePreviewContext.ts` | presentation | 印の状態と、印を切り替えるコールバックを足す |
| 変更 | `src/presentation/preview/CodebasePreviewCanvas.tsx` | presentation | 上記2つの props を Context へ渡す |
| 変更 | `src/presentation/preview/PreviewClassNode.tsx` | presentation | クラス見出し・メソッドの行に「気になる」ボタンと結果のラベルを出す |
| 変更 | `src/index.css` | presentation | レビュー画面と印・結果ラベルの見た目 |
| 新規 | `e2e/reviewer-mode.spec.ts` | E2E | 印・答え合わせ・やり直し・キーボード操作 |

- `src/application/` は変更しない(設計くらべ・白紙設計と同じく、presentation から domain の純粋関数を直接呼ぶ既存の形に合わせる。
  副作用も保存も無いのでユースケースを挟む理由が無い)。
- `src/domain/scoring/` は変更しない(`violationTargets`・`scoreCodebase` を呼ぶだけ)。ステージデータ(`infrastructure/stages/`)も変更しない。
- 新しい依存は足さない。

## データ・型の変更

保存形式の変更なし(印・結果は画面の `useState` だけに持ち、保存しない)。

### domain(`src/domain/review/judgeReview.ts`)

```ts
import type { ScoreRule } from '../scoring/score';
import { violationTargets } from '../scoring/violationTargets';

/** violationTargets の第2引数と同じ。 */
export type ReviewStage = Parameters<typeof violationTargets>[1];

/** 正解の箇所1つ。同じブロックに複数ルールの違反があっても1つにまとめ、rules に全部並べる。 */
export type ReviewSpot = {
  readonly kind: 'class' | 'method';
  readonly targetId: string;
  /** scoreCodebase の deductions の順。重複なし。 */
  readonly rules: readonly ScoreRule[];
};

export type ReviewVerdict = {
  /** 印を付けた正解の箇所(spots の順)。 */
  readonly found: readonly ReviewSpot[];
  /** 印が無い正解の箇所(spots の順)。 */
  readonly missed: readonly ReviewSpot[];
  /** 正解ではないのに印を付けた、コードに存在するクラス・メソッドのID(印を付けた順・重複なし)。 */
  readonly wrong: readonly string[];
  /** missed も wrong も無いときだけ true。 */
  readonly perfect: boolean;
};

export function reviewSpots(codebase: Codebase, stage: ReviewStage): ReviewSpot[];
export function judgeReview(codebase: Codebase, spots: readonly ReviewSpot[], markedIds: readonly string[]): ReviewVerdict;
```

- `reviewSpots` のルールの並びは、`scoreCodebase(codebase, stage).deductions` の `rule` の順に `violationTargets(codebase, stage)[rule]` を引いて決める
  (`ScoreRule` の一覧を `as` なしで順に回すため。`score.ts` に一覧の export を足さない)。
  各ルールの中では `methodIds` → `classIds` の順に、初めて出たIDで箇所を作り、2回目以降は既存の箇所の `rules` に足す。`fileIds` は無視する。
- `judgeReview` は `checkManualFix`(`domain/change/checkManualFix.ts`)と同じ考え方: 存在しないIDは無視、重複は1つ。
  存在の判定は `findClass` / `findMethod`(`domain/codebase/Codebase.ts`)を使う。

### infrastructure(`src/infrastructure/review/reviewProblems.ts`)

```ts
export const REVIEW_STAGE_IDS: readonly string[] = [
  'intermediate-middle-man', 'intermediate-misplaced-private', 'intermediate-cyclic-dependency',
  'intermediate-feature-envy', 'intermediate-extract-class',
];
/** stages(stageCatalog)から引いた出題順のステージ。見つからないIDは飛ばす(! を使わず flatMap で落とす。テストで全部引けることを守る)。 */
export const reviewProblems: readonly Stage[];
```

### presentation(`CodebasePreviewContext.ts`)

```ts
/** marked: 答え合わせ前の印 / found: 見つけた / missed: 見逃し / wrong: 見当違い */
export type ReviewMark = 'marked' | 'found' | 'missed' | 'wrong';

// CodebasePreviewValue に足す(どちらも省略可。省略時は今までどおりの表示)
readonly reviewMarks?: ReadonlyMap<string, ReviewMark>;   // キーはクラスID・メソッドID
readonly onToggleReviewMark?: (targetId: string) => void;  // 渡したときだけ「気になる」ボタンを出す
```

`CodebasePreviewCanvas` の props にも同名で足し、そのまま Provider へ渡す。

## 動きの仕様

### モード切り替え(`App.tsx`)

- `type Mode = 'refactor' | 'quiz' | 'blank' | 'review'`、`MODE_LABEL.review = 'コードレビュー'`。ボタンは右端に並び `data-testid="mode-review"`。
- 設計くらべと同じく、初めて開いたときにマウントし(`reviewOpened`)、以降は `hidden` で隠すだけ(印を付けかけた状態を残す)。
  ラッパーは `<div className="app__view" hidden={mode !== 'review'} data-testid="review-view">`。
- ページタイトルは `pageTitle(MODE_LABEL.review, null)`(既存の式で `mode === 'refactor'` 以外は null になるので変更不要)。

### レビュー画面(`ReviewerView.tsx`)

上段に操作、下段に読み専用キャンバスとメソッドの中身。

1. **問題の選択**: `<select aria-label="レビュー課題">`。選択肢は `レビュー1` 〜 `レビューN`(**ステージ名は出さない**。
   ステージの `title` / `description` / `problem` / `goal` は答えを書いてしまっているため、答え合わせ前は一切出さない)。
   問題を切り替えると、印・結果・選択中のメソッドは捨てる(問題ごとに `key={stage.id}` で作り直す)。
2. **指示と前提**: 「このコードをレビューして、問題があると思うクラス・メソッドに『気になる』印を付けよう」と、
   そのステージの前提「行数の上限: メソッド◯行・クラス◯行・ファイル◯行 / 1クラスの依存先は◯個まで / 1クラスの責務は◯種類まで」を出す。
3. **キャンバス**: `CodebasePreviewCanvas` に `codebase={stage.codebase}` を渡す。
   - 答え合わせ前は `methodLimit={Infinity}`(行数超えの赤を出さない。設計くらべと同じ理由)、答え合わせ後は `stage.limits.method`。
   - `selectedMethodId` / `onSelectMethod` を渡し、メソッドを押すと右に `ResizablePreviewMethodPanel` で中身(処理の並び・コード)を出す
     (`CodebasePreviewDialog` と同じ組み方)。読むための操作で、印とは別。
   - 答え合わせ前は `onToggleReviewMark` を渡し、`reviewMarks` は印を付けたIDを `'marked'` にした Map。
   - 答え合わせ後は `onToggleReviewMark` を渡さず(印を固定)、`reviewMarks` は `found` / `missed` / `wrong` の Map
     (`found`・`missed` は spot の `targetId`、`wrong` は `verdict.wrong` のID)。
4. **「気になる」ボタン**(`PreviewClassNode`、`onToggleReviewMark` があるときだけ):
   - クラス見出しの右に `<button type="button" className="review-mark-button nodrag nopan" data-testid="review-mark-class-<クラス名>" aria-pressed={印あり} aria-label="<クラス名> に気になる印を付ける">`。
   - 各メソッドの行で、メソッドチップの右に同じボタン `data-testid="review-mark-method-<メソッドID>"`、`aria-label="<クラス名>.<メソッド名>() に気になる印を付ける"`。
   - 押すたびに印を付け外しする。`button` なので Tab で届き Enter / Space で切り替えられる。
5. **印と結果の表示**: `reviewMarks` に入っているクラス・メソッドに `review-mark review-mark--<状態>` クラスと `data-review-mark="<状態>"` を付け、
   ラベルを添える(`marked`: 気になる / `found`: 見つけた / `missed`: 見逃し / `wrong`: 見当違い)。色だけに頼らず文字で出す。
6. **答え合わせ**: ボタン「答え合わせ」(`data-testid="review-submit"`)。印が0個でも押せる(全部見逃しになる)。
   押すと `judgeReview(stage.codebase, reviewSpots(stage.codebase, stage), 印のID)` で判定し、結果欄へフォーカスを移す。
7. **結果欄**(`data-testid="review-result"`、`tabIndex={-1}`):
   - 見出しは既存の `AnswerVerdict`(`presentation/feedback/AnswerVerdict.tsx`)で、`perfect` なら「全部見つけた!」、
     それ以外は「`<spots数>`か所中`<found数>`か所を見つけた(見当違い`<wrong数>`件)」。
   - 箇所ごとの一覧(`found` → `missed` の順): 名前(`describeTargets` で `Class.method()` / `Class` にする)、
     「見つけた」「見逃し」、ルール名(`RULE_LABEL`)と、なぜ困るか(`RULE_WHY[rule].trouble`)。
   - 見当違いの一覧: 名前と「採点ルール上の問題は見つからなかった」。
   - 解説: ここで初めてステージの `title` と `why` を出す。
   - ボタン「やり直す」(`data-testid="review-retry"`): 印と結果を消して答え合わせ前に戻す。
8. 依存の矢印の警告色(循環依存の赤など)は、答え合わせ前も今の `CodebasePreviewCanvas` のまま出る(設計くらべと同じ)。

`ReviewerView.tsx` と `PreviewClassNode.tsx` は lint(1関数60行・複雑度12)に収まるよう、メソッドの行・結果欄・印のラベルを小さなコンポーネントに分ける。

## TDD対象

### `reviewSpots`(domain)

- 違反の無いコードベース → `[]`
- メソッドが行数上限を超えているだけ → `[{ kind: 'method', targetId: そのID, rules: ['line-limit'] }]`
- 同じクラスが2つのルールで違反(例: 行数超えと責務の混在)→ 箇所は1つで `rules` は `['line-limit', 'responsibility']`(score の順)
- メソッドとそのクラスが別々に違反 → 2箇所(`kind: 'method'` と `kind: 'class'`)
- ファイルだけが対象の違反(クラスは上限内でファイルだけ行数超え / 空のファイル)→ 正解に入らない
- 箇所の並びは、ルールの順(score の deductions 順)、同じルールの中では methodIds → classIds

### `judgeReview`(domain)

- 正解の箇所すべてに印 → `found` が全部・`missed` `[]`・`wrong` `[]`・`perfect: true`
- 印なし → `missed` が全部・`perfect: false`
- 正解でない、存在するクラスに印 → `wrong` にそのID・`perfect: false`
- 存在しないIDの印 → 無視(`wrong` に入らない)
- 同じIDの印が2つ → 1つとして扱う
- 正解がメソッドで、そのクラスにだけ印 → メソッドは `missed`、クラスは `wrong`(完全一致)
- 正解が0箇所で印も無し → `perfect: true`(境界)

### `reviewProblems`(infrastructure のデータ検証。TDD対象ではないが必ず書く)

- `REVIEW_STAGE_IDS` のIDがすべて `stages` に存在し、`reviewProblems.length === REVIEW_STAGE_IDS.length`
- 各問題で `reviewSpots(stage.codebase, stage)` が1件以上
- 各問題で、`scoreCodebase(stage.codebase, stage)` の `count > 0` の減点ルールそれぞれに、`violationTargets` の `classIds` か `methodIds` が1件以上ある
  (=減点がすべて印で指摘できる)
- 1問目 `intermediate-middle-man` の正解は `[{ kind: 'class', targetId: 'class-order-manager', rules: ['middle-man'] }]`(E2Eの前提を固定する)

## E2E(`e2e/reviewer-mode.spec.ts`)

1問目(`intermediate-middle-man`、クラスは OrderController / OrderManager / OrderService)を使う。

1. 「コードレビュー」に切り替えると `preview-class-OrderManager` が見え、`.method-chip--over` が0個、画面に「横流し」の文字が無い(答え前にネタバレしない)。
2. `review-mark-class-OrderManager` を押すと `aria-pressed="true"` になる。「答え合わせ」→ `review-result` に「全部見つけた」、
   OrderManager に `data-review-mark="found"`、`review-mark-class-*` ボタンが消える(印が固定される)。
3. 「やり直す」→ 印と結果が消える。`review-mark-class-OrderService` だけ印を付けて答え合わせ → OrderManager が `missed`、OrderService が `wrong`、
   結果欄に「1か所中0か所」「見当違い1件」と「横流し」のルール名が出る。
4. キーボード: `review-mark-class-OrderManager` にフォーカスして Space で `aria-pressed="true"` になる。
5. メソッドチップ(`preview-method-method-manager-place`)を押すと、メソッドの中身のパネルに「OrderService.place() を呼び出す」が出る(印は付かない)。

## 受け入れ基準

1. モード切り替えに「コードレビュー」が4つ目として並び、押すと読み専用のキャンバスで1問目が出る(ドラッグでコードが変わらない)。
2. 答え合わせ前にステージ名・説明・行数超えの赤が出ない。
3. クラス・メソッドに「気になる」印をマウスとキーボードの両方で付け外しでき、答え合わせで「見つけた・見逃し・見当違い」が
   キャンバスと結果欄の両方に文字で出る。正解は既存の採点ルールの違反(クラス・メソッド)と一致する。
4. 「やり直す」と問題の切り替えで印・結果が消える。別モードへ行って戻っても、答え合わせ前の印は残る。
5. `judgeReview.test.ts`・`reviewProblems.test.ts` が通り、domain のカバレッジ閾値を下回らない。
6. 既存の設計くらべ・解答例・変更の影響ダイアログの表示が変わらない(`CodebasePreviewCanvas` の新 props を渡さない呼び出しは今までどおり)。
7. `npm run check` と `npm run test:e2e` が通る(新規 `e2e/reviewer-mode.spec.ts` を含む)。

## スコープ外

- 新しいステージ・問題用コードベースの作成、ステージデータの書き換え(既存ステージの開始状態だけを使う)。
- ファイルへの印、「どのルールの問題か」まで選ばせる2段目の回答(本当に要るか: 今は場所を当てるだけで嗅覚の練習になる。
  ルール名は答え合わせで見せれば足りる。物足りないと分かったら設計くらべの理由3択と同じ形で足す)。
- クラスへの印でそのメソッドの違反も正解にするなどの部分点・「惜しい」判定。
- 成績の保存・学習記録・進捗への反映(`quizRecordStorage` のような保存は作らない)。
- 初回の案内(`ModeIntroGuide` / `MODE_INTRO_STEPS`)の追加。画面上の指示文で足りるため。
- 答え合わせ前に依存の矢印の警告色を消すオプション(`// ponytail: 循環依存の赤い矢印は答え前もヒントになる。易しすぎると分かったら CodebasePreviewCanvas に警告色を消す props を足す` を `ReviewerView.tsx` に残す)。
- AI講評、ステージ一覧・ロードマップからレビューモードへの導線。
- application 層のユースケース追加。
