# 抽出する前に結果をプレビューする

## 背景・目的

メソッドエディタで処理のまとまりを選び、「選んだ処理をメソッドとして抽出」を押すまで、キャンバスがどう変わるか(元のメソッドが何行になるか、新しいメソッドが何行でできるか)が分からない。Undo はあるが、「押したら取り返しがつかないかも」と操作をためらうプレイヤーがいる。

そこで、**処理を選んでいる間ずっと、キャンバス上の元のメソッドに「84行 → 62行」の変化と、その下に新しくできるメソッドの仮の姿(半透明・点線の枠)を表示する**。押す前に結果が分かるので、失敗を恐れずに試せる。

### 設計判断(対話で確定済み)

- **いつ出すか**: 処理を1つ以上選んでいる間ずっと(抽出ボタンのホバーではなく)。キーボードやタッチでも見られる。

## ponytailチェック

1. YAGNI: クラス・ファイルの行数の変化や、点数の変化(抽出したら何点になるか)のプレビューは作らない。メソッド2つの行数で足りる。
2. 既存の再利用: 抽出後の姿は既存の `extractMethodUseCase`(=`extractMethod`)に仮のIDを渡して計算し、行数は `methodLines` で出す。抽出のルールを画面側に書き直さない。仮のメソッドの見た目は `MethodChipView` を半透明にして使う。
3. 新しい依存は足さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/application/RefactorUseCases.ts` | application | 変更 | `previewExtractMethod`(抽出したら元のメソッドと新しいメソッドが何行になるかを返す)を足す |
| `src/application/RefactorUseCases.test.ts` | application(test) | 変更 | 上記のテストを足す |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | 選択中の抽出の下書き `extractDraft: { sourceMethodId; fragmentIds; newMethodName } \| null` と、設定・解除のアクションを足す。コードベースが変わる操作・ステージ切り替え・メソッドの選択変更で `null` にする |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | 選んだ処理と新しい名前が変わるたびに `extractDraft` を更新する(抽出に成功したら・メソッドエディタを閉じたら解除)。抽出ボタンの近くに、プレビューと同じ内容の短い文(`抽出すると: printMonthlyReport 84行 → 62行 / 新しい aggregateSales 27行`)を出す |
| `src/presentation/canvas/ClassNode.tsx` | presentation | 変更 | `extractDraft` の元のメソッドを持つクラスで、そのメソッドのすぐ下に仮の新しいメソッドを出す |
| `src/presentation/canvas/MethodChip.tsx` | presentation | 変更 | 元のメソッドの行数を `84行 → 62行` と表示できるようにする |
| `src/index.css` | presentation | 変更 | 仮のメソッド(半透明・点線の枠)、行数の変化の見た目 |
| `e2e/extract-preview.spec.ts` | e2e | 新規 | 下記受け入れ基準のE2E |

`#106`(`action-affordance`)も抽出ボタンの周りを変更する。後から実装するほうが、先にマージされたほうに合わせる。

## データ/型の変更

```ts
// src/application/RefactorUseCases.ts
export type ExtractPreview = {
  readonly sourceMethodId: string;
  /** 抽出前・後の元のメソッドの行数(methodLines)。 */
  readonly sourceLinesBefore: number;
  readonly sourceLinesAfter: number;
  /** 新しいメソッドの名前と行数。 */
  readonly newMethodName: string;
  readonly newMethodLines: number;
};

/** 抽出したらどうなるかを返す。抽出できない(処理が0個・全部選んでいる・名前が空など)ときは undefined。元のCodebaseは変更しない。 */
export function previewExtractMethod(codebase: Codebase, input: ExtractMethodInput): ExtractPreview | undefined;
```

ストアに足す状態(`useGameStore.ts`):

```ts
extractDraft: ExtractMethodInput | null;
setExtractDraft: (draft: ExtractMethodInput | null) => void;
```

## 仕様

### `previewExtractMethod`

- `extractMethodUseCase(codebase, input, () => 仮のID)` を呼ぶ(仮のIDは既存のIDとぶつからない固定の文字列、例 `'extract-preview'`)。失敗なら `undefined`。
- 成功したら、抽出前のコードベースの元のメソッドの `methodLines` と、抽出後のコードベースの元のメソッド・新しいメソッドの `methodLines` を返す。`newMethodName` は抽出後の新しいメソッドの名前(前後の空白を除いたもの)。
- 元のCodebaseは変更しない。

### キャンバスの表示

- `extractDraft` があり、`previewExtractMethod` が `undefined` でないとき:
  - 元のメソッドの行数を `84行 → 62行` と表示する。抽出後の行数が上限(`stage.limits.method`)以内なら、上限超えの赤(`method-chip--over`)を外した見た目にし、`→ 62行` を「上限内」と分かる色にする。
  - 元のメソッドのすぐ下に、新しいメソッドの仮の姿(`MethodChipView` に `private` の印・名前・行数)を半透明(不透明度0.5前後)・点線の枠で出す。仮の姿はドラッグもクリックもできない(`pointer-events: none`)。読み上げでは `抽出後のプレビュー: aggregateSales() 27行` のように分かるようにする(`aria-label` か、視覚的に隠した文)。
  - 元のメソッドがある場所にキャンバスが寄っていなくても、自動で寄せない(プレイヤーの視点を勝手に動かさない)。
- `extractDraft` が `null`、または抽出できない組み合わせのときは何も出さない。
- 変更依頼の実装中・手で直すシミュレーション中は出さない。

### メソッドエディタの表示

- 抽出ボタンの近くに、キャンバスと同じ内容の短い文を出す(キャンバスが見えていない・画面の外にあるときのため)。`aria-live="polite"` にし、選択を変えたら読み上げられるようにする。抽出できない組み合わせのときは出さない。

### 下書きの寿命

- 処理の選択・新しい名前の入力が変わるたびに `setExtractDraft` で更新する。処理が0個になったら `null`。
- 抽出に成功した・別のメソッドを選んだ・メソッドエディタが閉じた・Undo/Redo・ステージ切り替え・「最初に戻す」で `null` にする(古い下書きのプレビューが残らないように)。

## TDD対象の純粋関数

### `previewExtractMethod`(`src/application/RefactorUseCases.ts`)

- 正常系: 84行のメソッドから24行の処理を1つ選ぶ → `sourceLinesBefore: 84`、`sourceLinesAfter` は「84 − 24 + 呼び出し1行」、`newMethodLines` は「24 + メソッドの決まった行数(METHOD_OVERHEAD_LINES)」(実際の値は `methodLines` の定義に従い、テストでは `methodLines` で期待値を組み立ててよい)
- 正常系: 処理を2つ選ぶ → 2つ分が新しいメソッドに入る
- 正常系: 名前の前後の空白は除かれる
- 異常系: 処理が0個 → `undefined`
- 異常系: 全部の処理を選ぶ(抽出のルールで失敗する組み合わせ) → `undefined`
- 異常系: 名前が空白だけ → `undefined`
- 異常系: 存在しないメソッドID → `undefined`
- 元のCodebaseを変更しない(点数・Undo 履歴にも影響しない)

## 受け入れ基準

1. `npm run check` が通る。`previewExtractMethod` にAAAパターンのテストがある。
2. チュートリアル1で `printMonthlyReport()` を選び、処理を1つ選ぶと、キャンバスの `printMonthlyReport()` が `84行 → ○行` になり、すぐ下に半透明の新しいメソッドが出る。メソッドエディタにも同じ内容の文が出る。
3. 選ぶ処理を増やす・減らす・名前を変えると、プレビューがすぐに変わる。全部外すと消える。
4. 抽出ボタンを押すと、プレビューと同じ行数・名前で本物のメソッドができ、プレビューは消える。
5. プレビュー中、点数・Undo 履歴・自動保存の下書きは変わらない。
6. 抽出後の行数が上限内になる選び方では、元のメソッドの上限超えの赤い表示が消えて見える。
7. 別のメソッドを選ぶ・Undo・ステージ切り替えで、古いプレビューが残らない。
8. E2E(`e2e/extract-preview.spec.ts`): 2〜4、7を確認する。既存の抽出のE2Eが無変更で通る。
9. `npm run test:e2e` が通る。

## スコープ外

- クラス・ファイルの行数の変化、点数の変化のプレビュー。
- Move Method など他の操作のプレビュー(ドラッグ中の置ける場所の表示は `drag-drop-targets.md`)。
- 抽出ボタンのホバーだけで出すプレビュー。
- プレビューの位置へキャンバスを自動で寄せること。

## 未決事項

なし。いつ出すかは対話で確定済み。仮の姿の見た目・文言は受け入れ基準を満たす範囲で実装者の裁量。
