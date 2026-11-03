# blocked-operation-affordance: 冒頭の手直しの前は、抽出ボタンがロック中だと見た目と読み上げで分かるようにする

小さな不具合修正。`manual-fix-clarity.md` のスコープ外に回した「ロック中の抽出ボタン」を、ボタンそのもので伝える。

## 症状

2026-11-03、チュートリアル2「太った placeOrder」を開いた直後(冒頭の手直し `opening-fix` の前)。

1. キャンバス上部のバナー(`組み替える前に、まずこのコードのまま「…」を手で入れてみよう。抽出や移動は、そのあとでできます`)は出ている
2. `placeOrder` をクリックし、右のメソッドエディタで処理を選ぶと、「選んだ処理をメソッドとして抽出」が**青い強調色の有効ボタン**になる
3. 押して初めて、赤いトースト `まず「もし、この変更が来たら?」で、この変更を手で入れてみてください` が出て弾かれる

ボタンは押せる見た目のままで、読み上げでもロックが分からない。押す前に「今は押せない」「何をすれば押せるか」が伝わらない。

ドラッグ&ドロップ(メソッド移動)も、コードで確認したとおり**ドロップした後で**同じトーストで弾かれる(`moveMethodAction` / `moveMethodToNewClassInFileAction` の先頭の `blockDuringOpeningFix`)。こちらは今回は直さない(スコープ外を参照)。

## 原因

- ロックの判定は `src/presentation/store/useGameStore.ts` の `blockDuringOpeningFix(state)`(`state.openingFixEnabled && currentStep(state) === 'opening-fix'`)にあり、**操作を実行するときにしか呼ばれない**(`createApply`・`applyResult`・移動・削除・統合・インライン・Undo/Redo の各入口)。モジュール内の非公開関数で、画面からは参照できない
- 抽出ボタン(`src/presentation/editor/MethodEditor.tsx` の `ExtractControls`)は `extractDisabledReason`(選択なし・非連続・名前が空・重複)しか見ておらず、ロックを知らない。理由がないと `button--primary` になる

直す場所は2か所で済む: ロック判定を公開して画面からも使えるようにする(`useGameStore.ts`)、抽出ボタンがそれを見る(`MethodEditor.tsx` + 表示の決め方の純粋関数)。

## 修正

### ponytailチェック

- ロック判定は新しく作らず、`blockDuringOpeningFix` の条件を名前付きの関数として取り出し、`blockDuringOpeningFix` 自身もそれを使う(判定を1か所に保つ)
- 押しても弾く動き(トースト `OPENING_FIX_MESSAGE`)は既存のまま使う。ボタンは `disabled` にせず `aria-disabled="true"` にする(フォーカスでき、読み上げで「使用不可」と理由が分かり、押せばトーストで同じことを言う)
- 理由の文は既存の `#method-editor-extract-disabled-reason`(`method-editor__extract-hint`)の段落と `aria-describedby` の結び付けをそのまま使う。`title` だけにはしない
- 無効の見た目は既存のグローバルな `button:disabled` のスタイル(`opacity: 0.4`)に `aria-disabled="true"` を足すだけ。新しい見た目は作らない
- 本当にドラッグも止める必要があるか: バナーが「抽出や移動は、そのあとでできます」と予告しており、ボタンのように「押せる見た目」をしているわけではないので、今回は抽出ボタンだけで足りる

### 1. ロック判定を公開する(`src/presentation/store/useGameStore.ts`、presentation)

```ts
/** 冒頭の手直し(opening-fix)が終わるまで、組み替えの操作をロックしているか。stageStep が 'opening-fix' を返す条件と同じ(点数に依らないので採点しない)。 */
export function isOpeningFixLocked(state: Pick<GameState, 'openingFixEnabled' | 'openingFixes' | 'stage'>): boolean
```

- 中身: `state.openingFixEnabled && painRequestsOf(state.stage).modify !== undefined && !Object.hasOwn(state.openingFixes, state.stage.id)`
  - `stageStep` は `hasModifyRequest && !openingDone` のとき点数を見ずに `'opening-fix'` を返すので、`currentStep(state) === 'opening-fix'` と同値。セレクタとして毎回の状態変化で呼ばれるため、`scoreCodebase` を避ける
- `blockDuringOpeningFix` は `isOpeningFixLocked(state) ? { message: OPENING_FIX_MESSAGE, notice: null } : null` に置き換える(動きは変えない)
- `currentStep` は `change-request` のロック(`CHANGE_REQUEST_LOCK_MESSAGE` の箇所)で引き続き使うので残す

### 2. 抽出ボタンの表示の決め方(`src/presentation/editor/extractDisabledReason.ts`、presentation)

同じファイルに、ロック中の理由文の定数と、ボタンの表示を決める純粋関数を足す。

```ts
export const OPENING_FIX_LOCK_REASON = '先に「実際に直してみる」を押してください';

export type ExtractButtonView = {
  /** ボタンの下に出す理由(出さないなら null) */
  readonly reason: string | null;
  /** ネイティブの disabled(押しても何も起きない) */
  readonly disabled: boolean;
  /** aria-disabled="true"(無効に見せて読み上げるが、押せばロックのトーストを出す) */
  readonly ariaDisabled: boolean;
  /** 強調色(button--primary)にするか */
  readonly primary: boolean;
};

/** locked は isOpeningFixLocked の結果、disabledReason は extractDisabledReason の結果。ロックを最優先する。 */
export function extractButtonView(locked: boolean, disabledReason: string | null): ExtractButtonView
```

| locked | disabledReason | reason | disabled | ariaDisabled | primary |
| --- | --- | --- | --- | --- | --- |
| true | 何でも(null を含む) | `OPENING_FIX_LOCK_REASON` | false | true | false |
| false | 文字列 | その文字列 | true | false | false |
| false | null | null | false | false | true |

ロック中は、選択なし・名前が空などの理由より**ロックの理由を優先**して1つだけ出す(先に手直しをしないと、どの理由を解消しても押せないため)。

### 3. 抽出ボタン(`src/presentation/editor/MethodEditor.tsx`、presentation)

- `MethodEditorBody` で `const locked = useGameStore(isOpeningFixLocked);` を取り、`extractButtonView(locked, disabledReason)` を `ExtractControls` に渡す(`disabledReason` の prop を `button: ExtractButtonView` に置き換える)
- `ExtractControls` のボタン:
  - `className={button.primary ? 'button--primary' : undefined}`
  - `disabled={button.disabled}`
  - `aria-disabled={button.ariaDisabled ? true : undefined}`
  - `aria-describedby={button.reason === null ? undefined : 'method-editor-extract-disabled-reason'}`
  - `onClick` は今のまま `onExtract`(ロック中に押すと、ストアの `blockDuringOpeningFix` が今までどおりトーストを出し、抽出は起きない)
- 理由の段落: `button.reason` を今の `#method-editor-extract-disabled-reason`(`method-editor__extract-hint`)にそのまま出す。位置はボタンのすぐ下(今の段落の位置。プレビューの文がある場合はその後ろでよい。ロック中もプレビューは今のまま出る)
- 名前の入力欄の `aria-invalid` / `aria-describedby`(重複の理由への結び付け): ロック中は重複の理由を出していないので、`isDuplicate={!locked && extractNameInvalid(...)}` にする(出ていない理由に結び付けない)

### 4. 見た目(`src/index.css`、presentation)

既存のグローバルなボタンの規則に `aria-disabled="true"` を足す。

- 81行目のホバーの規則: `:hover:not(:disabled)` に `:not([aria-disabled="true"])` を足す
- 83行目の無効の規則: `:disabled` と同じ `opacity: 0.4; cursor: default;` を `[aria-disabled="true"]` にも当てる(`:where(...)` の中で並べる。詳細度は0のまま)

`ReferenceMenu` の `aria-disabled` なメニュー項目は自分の規則(`opacity: .5`)を後に持っているので、見た目は変わらない。

## テスト

### Vitest(先に書いて失敗させる)

`src/presentation/editor/extractDisabledReason.test.ts` に `describe('extractButtonView')` を足す(AAA)。

- ロック中・理由なし → `{ reason: OPENING_FIX_LOCK_REASON, disabled: false, ariaDisabled: true, primary: false }`
- ロック中・`処理を1つ以上選ぶと押せます` → reason はロックの文(ロックが優先)、`disabled: false`、`ariaDisabled: true`
- ロックなし・`メソッド名を入れると押せます` → reason はその文、`disabled: true`、`ariaDisabled: false`、`primary: false`
- ロックなし・理由なし → `{ reason: null, disabled: false, ariaDisabled: false, primary: true }`
- `OPENING_FIX_LOCK_REASON` が `先に「実際に直してみる」を押してください` であること

`src/presentation/store/useGameStore.test.ts` に `describe('isOpeningFixLocked')` を足す(ステージは `stages` から `painRequestsOf(stage).modify` の有無で選ぶ)。

- 手直しの依頼があるステージを開いた直後(`createGameStore([stage], false)`)→ `true`
- 同じストアで `openingFixes` に `{ [stage.id]: null }` を入れる(手直し済み)→ `false`
- `openingFixEnabled = false`(`createGameStore([stage], false, false)`)→ `false`
- 手直しの依頼がないステージ → `false`
- 上の各状態で、`isOpeningFixLocked` が `true` のときだけ、`extractMethod` が `false` を返し `message` が `まず「もし、この変更が来たら?」…` になる(`blockDuringOpeningFix` との一致。既存の460行目付近のテストと同じ組み立てでよい)

### E2E(新規 `e2e/blocked-operation-affordance.spec.ts`)

`selectStage(page, 'チュートリアル2: 太った placeOrder', { completeOpeningFix: false })`、画面は 1800×1400(`stage-flow.spec.ts` と同じ)。

1. ロック中の見た目と読み上げ: `method-placeOrder` をクリックし、`消費税を計算する(軽減税率あり)` を選ぶ。抽出ボタンは
   - `aria-disabled="true"` を持ち、`button--primary` クラスを持たない
   - アクセシブルな説明(`toHaveAccessibleDescription`)が `先に「実際に直してみる」を押してください`
   - その文がメソッドエディタ内に見えている(`toBeVisible`)
2. 押しても弾く: そのボタンを押すと、トーストに `まず「もし、この変更が来たら?」` が出て、`method-calculateTax` は増えない(既存の動きの維持)
3. 手直し後に解ける: バナーの「実際に直してみる」→「リリースする」→「組み替えを始める」を押したあと、もう一度処理を選ぶと、抽出ボタンは `aria-disabled` を持たず `button--primary` で、ロックの文は出ていない。押すと抽出できる

既存の `e2e/stage-flow.spec.ts`(ロック中に押してトーストが出る)・`e2e/toast-clears-when-stale.spec.ts`(ドラッグで弾かれる)は無変更で通ること。

## 受け入れ基準

1. ツアーを終えた状態でチュートリアル2を開き、`placeOrder` の処理を選んでも、抽出ボタンは青い強調色にならず、無効の見た目(薄い表示)になっている。ボタンのすぐ下に `先に「実際に直してみる」を押してください` が見える文で出ている
2. 1のボタンにキーボードでフォーカスでき、スクリーンリーダーで「使用不可」と、説明として上の文が読み上げられる(`aria-disabled="true"` と `aria-describedby`)
3. 1のボタンを押すと、今までどおりトースト `まず「もし、この変更が来たら?」で、この変更を手で入れてみてください` が出て、抽出は起きない
4. 冒頭の手直しをリリースして「組み替えを始める」を押したあとは、今までどおり(処理を選べば強調色、選んでいなければ `処理を1つ以上選ぶと押せます` で `disabled`)
5. 手直しの依頼がないステージ、`openingFixEnabled` が `false` のときは、表示が今と変わらない
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- ドラッグ&ドロップ(メソッド・フィールド・クラスの移動)をロック中に掴めなくすること、ドラッグ中にロックを示すこと。今までどおりドロップ後にトーストで弾く(バナーで予告済み)
- 抽出ボタン以外のロック対象(統合・呼び出し元へ戻す・空実装の削除・名前変更・Undo/Redo)の見た目。必要になったら同じ `isOpeningFixLocked` を使って別仕様で足す
- トーストの文言 `OPENING_FIX_MESSAGE` の変更(ボタンの理由文と言い回しが違うが、どちらも正しい行き先を指している。`stage-flow` / `toast-clears-when-stale` の E2E が依存している)
- 変更依頼(`change-request`)のロック(`CHANGE_REQUEST_LOCK_MESSAGE`)の見た目
- 手直し中(`manualFix !== null`)・変更依頼の挑戦中のメソッドエディタ(もともと抽出ボタンを出していない)
- `title` によるツールチップ

## 未決事項

なし。
