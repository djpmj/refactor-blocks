# disabled-button-reason-visible: 押せないボタンの理由が、キーボード・タッチ・読み上げで分からない

## 症状(背景・目的)

実機確認(2026-11-03)で見つかった問題。ツールバーなどの押せないボタンは、押せない理由を `title` 属性(マウスのホバー)でしか伝えていない。

- 「変更依頼に挑戦」(`change-request-start`): `disabled` + `title="点数が100点になると挑戦できます"`
- 「元に戻す」「やり直し」: `disabled` + `title="Ctrl+Z"` / `"Ctrl+Y"`(理由ではなくショートカットの説明しかない)
- 「最初に戻す」「参考・答え ▾」「ヒント ▾」「操作履歴」「うわさ」「ステージ一覧」「AIの講評をもらう」: 変更依頼の実装中は `disabled` で、理由がどこにも書かれていない

再現手順: 「チュートリアル2: 太った placeOrder」を開き(100点未満)、キーボードの Tab でツールバーへ進む。`disabled` のボタンはフォーカスを受けないので飛ばされ、理由を読む手段がない。タッチ操作ではホバーできないので `title` が出ない。スクリーンリーダーも `disabled` のボタンにはフォーカスできず、「なぜ押せないのか」が伝わらない。

CLAUDE.md の方針で、アクセシビリティ(キーボード操作を含む)は手を抜かない項目。関連する仕様: `action-affordance.md`(抽出ボタンの押せない理由を `aria-describedby` で結んだ)、`operation-guide-keyboard.md`、`method-chip-accessible-name.md`。

## 原因

- 各コンポーネントが、ボタンを個別に `disabled` 属性で止め、理由をホバー用の `title` に書いている(`src/presentation/stage/StagePanel.tsx` の `ActionToolbar`・`RoadmapButton`、`HintPanel.tsx`、`GhostHintButton.tsx`、`HintList.tsx` など)。ネイティブの `disabled` はフォーカスもクリックも受けないので、`title` 以外に理由を出す余地がない。
- 理由を見える文で出しているのは、抽出ボタン(`MethodEditor.tsx` の `ExtractControls`)と白紙設計の「答え合わせ」(`BlankDesignPanel.tsx`)の2か所だけ。ただしこの2つも `disabled` なので、Tab では理由の段落に結ばれたボタン自体へ到達できない。
- 「押せない理由を出すボタン」の共通の部品がないため、直す場所がボタンごとに散らばっている。共通の小さなヘルパーと部品を1つずつ作り、全部をそれに寄せれば、今後のボタンも同じ形で直せる。

## 修正

### ponytailチェック

1. YAGNI: 汎用のツールチップライブラリや、配置を自動計算するポップオーバーは作らない。ボタンの直下に絶対配置で出す CSS だけで足りる。
2. 既存の再利用: `ReferenceMenu.tsx` で `aria-disabled` を使っている前例と、`action-affordance.md` の「理由の段落を `aria-describedby` で結ぶ」形に揃える。理由文の判定には既存の `stageStep`(`domain/change/stageStep.ts`)をそのまま使い、`domain` には手を入れない。
3. 標準機能: `aria-disabled`・`aria-describedby`・React の `useId` で足りる。新しい依存は足さない。
4. 本当に共通部品が要るか: 対象のボタンは15か所以上あり、フォーカス・クリック・Escape・ホバーで理由を見せる処理を毎回書くと重複する。部品1つ(`ReasonButton`)と、その中身の純粋関数1つ(`disabledButtonProps`)で足りる。理由の段落がすでに常に見えている2か所(抽出・答え合わせ)は、部品を使わず純粋関数だけを使う。

### 方針

- 押せないボタンは `disabled` をやめ、`aria-disabled="true"` と無効の見た目にする。フォーカスは受けるので、Tab で到達できる。
- 押せない理由の文を要素として描き、ボタンの `aria-describedby` で結ぶ。スクリーンリーダーはフォーカス時に理由を読み上げる。
- 理由の文は、ボタンにフォーカスがあるとき、マウスでホバーしたとき、押した(クリック・タップ・Enter・Space)ときに、ボタンの直下に見える形で出す。Escape かフォーカスが外れると隠す(ホバー中の表示は CSS の `:hover` に任せる)。
- 押せないときに押されても、本来の処理は呼ばない(理由を出すだけ)。
- 押せるときは今までどおり。`aria-disabled`・`aria-describedby` は付けず、理由の要素も描かない。

### 新しい共通の部品

#### `src/presentation/disabledButtonProps.ts`(純粋関数、TDD対象)

```ts
export function disabledButtonProps(input: Readonly<{
  reason: string | null;
  reasonId: string;
  onClick: () => void;
  onBlockedClick?: () => void;
}>): Readonly<{
  'aria-disabled': true | undefined;
  'aria-describedby': string | undefined;
  onClick: () => void;
}>;
```

- `reason === null`(押せる): `aria-disabled`・`aria-describedby` は `undefined`。`onClick` は渡された `onClick` をそのまま呼ぶ。
- `reason !== null`(押せない): `aria-disabled: true`、`aria-describedby: reasonId`。返す `onClick` は渡された `onClick` を呼ばず、`onBlockedClick` があればそれを呼ぶ。

#### `src/presentation/ReasonButton.tsx`(表示部品)

- props: `Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'onClick' | 'type' | 'aria-describedby'>` に、`disabledReason: string | null`・`onClick: () => void`・`ref?: Ref<HTMLButtonElement>`(React 19 の ref を props で受ける形)を足したもの。型から `disabled` を外し、この部品で `disabled` を使えないようにする。
- 描く DOM:
  ```html
  <span class="reason-button" data-reason-shown="">  <!-- data-reason-shown は表示中だけ -->
    <button type="button" aria-disabled="true" aria-describedby="{useIdのid}" ...>ラベル</button>
    <span id="{useIdのid}" class="reason-button__reason">押せない理由</span>  <!-- disabledReason !== null のときだけ -->
  </span>
  ```
- 表示の状態 `shown`(`useState`)を持つ。`onFocus` で `true`、`onBlur` で `false`、押せないときのクリック(`onBlockedClick`)で `true`、`onKeyDown` の `Escape` で `false`。Escape のイベントは止めない(ポップオーバーやダイアログの Escape 処理を邪魔しない)。
- `title` は押せるときだけ付ける(押せないときに理由の表示とブラウザのツールチップが二重に出ないように)。「元に戻す」の `Ctrl+Z` など、押せるときの説明はそのまま残る。
- `className`・`data-testid`・`aria-expanded`・`aria-haspopup`・`aria-controls`・`aria-pressed`・`aria-label`・`ref` などはそのまま `<button>` に渡す。

#### `src/index.css`

- `:where(button:not(.react-flow__controls-button):disabled)` の無効の見た目(`opacity: 0.4; cursor: default`)を、`[aria-disabled="true"]` にも効くようにする。ホバー時の枠線(81行目の `:hover:not(:disabled)`)も `[aria-disabled="true"]` を除く。
- `.button--primary:disabled` と `.ghost-hint-button--idle:not(:disabled)`(2か所)も、`aria-disabled="true"` を同じ扱いにする。
- 新規: `.reason-button { position: relative; display: inline-flex; }`。`.reason-button__reason` は通常 `display: none`。`.reason-button:hover > .reason-button__reason` と `.reason-button[data-reason-shown] > .reason-button__reason` で表示する。表示時は `position: absolute; top: calc(100% + 4px); left: 0; z-index: 40`(`.popover__panel` と同じ)、`width: max-content; max-width: 16rem`、文字は 12px、背景・枠・影は `.popover__panel` の配色(`--surface`・`--border`)に揃える。
- ツールバーのボタンは右寄せなので、`.toolbar .reason-button__reason { left: auto; right: 0; }` で画面の右端からはみ出さないようにする。
- `display: none` の要素でも `aria-describedby` の説明文としては読まれるので、読み上げのために常に表示しておく必要はない。

#### `src/presentation/stage/usePopoverDismiss.ts`

- パネルを開いたときに最初に押せるボタンへフォーカスする `button:not(:disabled)` を、`button:not(:disabled):not([aria-disabled="true"])` にする(「ヒント ▾」を開いたとき、押せない「次の一手」などに先にフォーカスしないように、今の動きを保つ)。

### 対象のボタン(`src/presentation/` の `disabled` をすべて確認した結果)

#### 直すもの(`ReasonButton` に置き換える)

| 場所 | ボタン | 押せない条件 → 理由の文 |
| --- | --- | --- |
| `stage/StagePanel.tsx` `ActionToolbar` | 変更依頼に挑戦 / もう一度挑戦(`change-request-start`) | `changeRequestStartReason` の結果(下記) |
| 同上 | 元に戻す | `!canUndo` → `まだ元に戻せる操作がありません` |
| 同上 | やり直し | `!canRedo` → `やり直せる操作がありません(元に戻した直後に使えます)` |
| 同上 | 最初に戻す | 実装中 → `INVESTIGATING_REASON` |
| `stage/ReferenceMenu.tsx` | 参考・答え ▾(`reference-menu-button`) | 実装中 → `INVESTIGATING_REASON` |
| `stage/HintPopover.tsx` | ヒント ▾(`hint-popover-button`) | 実装中 → `INVESTIGATING_REASON` |
| `stage/OperationHistoryPopover.tsx` | 操作履歴のボタン | 実装中 → `INVESTIGATING_REASON` |
| `stage/RumorPopover.tsx` | うわさのボタン(`rumor-popover-button`) | 実装中 → `INVESTIGATING_REASON` |
| `stage/StagePanel.tsx` `RoadmapButton` | ステージ一覧(`roadmap-open`) | 実装中 → `INVESTIGATING_REASON` |
| `critique/CritiquePanel.tsx` `CritiqueButton` | AIの講評をもらう | 実装中 → `INVESTIGATING_REASON`。講評中(`loading`)→ `AIの講評を待っています` |
| `guide/OperationGuideDialog.tsx` | 初回ガイドをもう一度(`repeat-first-visit-tour`) | 実装中 → `INVESTIGATING_REASON` |
| `stage/ProblemHint.tsx` | どこが問題?(`hint-problem`) | `disabled` → `INVESTIGATING_REASON`。減点なし(`rule === undefined`)→ `減点がないので、見る問題はありません` |
| `stage/HintPanel.tsx` `HintButton` | 次の一手 | `hintStepReason` の結果(下記) |
| `stage/GhostHintButton.tsx` | 動きで見る(`ghost-hint`) | `ghostHintReason` の結果(下記)。押せるときの `title`(`次に動かす手を、キャンバスの上で動きで見せます(答えが分かります)`)は残す |
| `stage/HintList.tsx` | キャンバスで見る | `disabled` → `INVESTIGATING_REASON`。対象なし → `まだこの名前のブロックがありません`(今の `title` と同じ文) |
| `change/ChangeRequestPanel.tsx` `Implementing` | 実装を終える(`change-request-finish`) | 部品を置いていない → `部品置き場の ${部品名}() をクラスへ置くと押せます` |
| `blank/BlankDesignPanel.tsx` | 元に戻す / やり直し | ツールバーと同じ文 |

`INVESTIGATING_REASON` = `変更依頼の実装中は使えません(「実装を終える」か「やめる」で戻ります)`

#### 直すもの(理由の段落はそのまま、`disabledButtonProps` だけ使う)

| 場所 | ボタン | 内容 |
| --- | --- | --- |
| `editor/MethodEditor.tsx` `ExtractControls` | 選んだ処理をメソッドとして抽出 | `disabled` を外し、`disabledButtonProps({ reason: disabledReason, reasonId: 'method-editor-extract-disabled-reason', onClick: onExtract })` を広げる。理由の段落(`method-editor-extract-disabled-reason`)と文言は今のまま。`className` の `button--primary` の切り替えも今のまま |
| `blank/BlankDesignPanel.tsx` | 答え合わせ(`blank-review`) | 同様に `reasonId: 'blank-review-disabled-reason'`。理由の段落と文言は今のまま |

#### 直さないもの(理由が見れば分かる、または別の形で説明済み)

- `quiz/ComparisonQuizView.tsx`・`stage/ConceptCheckPanel.tsx` の選択肢のラジオ(答えたあとは固定)と「答える」(選択肢を選ぶ前): フォームの慣例どおりで、選べば押せることが見て分かる。
- `stage/SampleAnswerReplayDialog.tsx` の最初へ / 前へ / 次へ / 最後へ: 端にいることが位置の表示から分かる。
- `canvas/CanvasContextMenu.tsx` の候補なしの項目: ラベル自体が理由(`インターフェース役のクラスがありません…`)。
- `editor/MethodEditor.tsx` `VisibilitySelect` の `<option disabled>`: `describeVisibility` で選べない理由を説明済み。
- `stage/ScoreBreakdown.tsx` の減点の内訳のボタン(実装中に `disabled`): スコープ外(下記)。
- `stage/ReferenceMenu.tsx` の解答例の項目(すでに `aria-disabled` + `title`): スコープ外(下記)。

### 理由文の組み立て(純粋関数、TDD対象)

新規 `src/presentation/stage/disabledReasons.ts`(表示の文言なので `presentation` に置く。`describeVisibility.ts` と同じ扱い):

```ts
export const INVESTIGATING_REASON = '変更依頼の実装中は使えません(「実装を終える」か「やめる」で戻ります)';
export const UNDO_UNAVAILABLE_REASON = 'まだ元に戻せる操作がありません';
export const REDO_UNAVAILABLE_REASON = 'やり直せる操作がありません(元に戻した直後に使えます)';
export const PROBLEM_FIRST_REASON = '先に「どこが問題?」を見てみよう';

export function changeRequestStartReason(input: Readonly<{ investigating: boolean; step: StageStep }>): string | null;
export function hintStepReason(input: Readonly<{ problemRevealed: boolean; revealed: number; total: number }>): string | null;
export function ghostHintReason(input: Readonly<{
  investigating: boolean; unlocked: boolean; manualFixing: boolean; playing: boolean; hasMove: boolean; perfect: boolean;
}>): string | null;
```

- `changeRequestStartReason`(上から順に判定)
  - `investigating` → `INVESTIGATING_REASON`
  - `step === 'opening-fix'` → `先に、このコードのまま変更を手で入れてみてください(「実際に直してみる」)`
  - `step === 'refactor'` → `点数が100点になると挑戦できます`
  - `step === 'closing-fix'` → `先に「もし、この変更が来たら?」をもう一度解いてください`(今の `title` と同じ文。`e2e/selectStage.ts` がこの文を見ている)
  - `step === 'change-request'` → `null`
  - 補足: 今の `ActionToolbar` は `opening-fix` のときも「100点になると挑戦できます」を出しており、100点でも冒頭の手直しが終わっていないと誤った理由になる。この関数で直す。
- `hintStepReason`
  - `!problemRevealed` → `PROBLEM_FIRST_REASON`
  - `revealed >= total` → `ヒントはすべて開きました`
  - それ以外 → `null`
- `ghostHintReason`(上から順。今の `ghostHintTitle` の優先順を保つ)
  - `investigating` → `INVESTIGATING_REASON`
  - `!unlocked` → `PROBLEM_FIRST_REASON`
  - `manualFixing` → `手で直している間は使えません`
  - `playing`(`ghost !== null`)→ `動きを再生しています`
  - `!hasMove` → `ドラッグで動かす手は残っていません`(今の `title` と同じ文)
  - `perfect`(`score >= 100`)→ `100点なので、見せる手はもうありません`
  - それ以外 → `null`
- 今の `GhostHintButton.tsx` の `ghostHintTitle` は、押せるときの `title`(`次に動かす手を…`)だけを返すように小さくする(押せないときの文は `ghostHintReason` へ移る)。`StagePanel.tsx` の `challengeTitle` は消す。

ステージ一覧などの「実装中なら `INVESTIGATING_REASON`」は、呼び出し側で `investigating ? INVESTIGATING_REASON : null` と1式で書く(関数にしない)。

### 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/disabledButtonProps.ts` | presentation | 新規 | `aria-disabled`・`aria-describedby`・クリックの止め方を決める純粋関数 |
| `src/presentation/disabledButtonProps.test.ts` | presentation | 新規 | 上のテスト |
| `src/presentation/ReasonButton.tsx` | presentation | 新規 | 押せない理由を結び、フォーカス・ホバー・押下で見せるボタン |
| `src/presentation/stage/disabledReasons.ts` | presentation | 新規 | 理由文の定数と組み立て(`changeRequestStartReason`・`hintStepReason`・`ghostHintReason`) |
| `src/presentation/stage/disabledReasons.test.ts` | presentation | 新規 | 上のテスト |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | `ActionToolbar`・`RoadmapButton` のボタンを `ReasonButton` に。`challengeTitle` を削除 |
| `src/presentation/stage/ReferenceMenu.tsx` | presentation | 変更 | メニューを開くボタンを `ReasonButton` に |
| `src/presentation/stage/HintPopover.tsx` | presentation | 変更 | 「ヒント ▾」を `ReasonButton` に |
| `src/presentation/stage/OperationHistoryPopover.tsx` | presentation | 変更 | 開くボタンを `ReasonButton` に |
| `src/presentation/stage/RumorPopover.tsx` | presentation | 変更 | 開くボタンを `ReasonButton` に |
| `src/presentation/stage/ProblemHint.tsx` | presentation | 変更 | 「どこが問題?」を `ReasonButton` に |
| `src/presentation/stage/HintPanel.tsx` | presentation | 変更 | 「次の一手」を `ReasonButton` に。`title` を削除 |
| `src/presentation/stage/GhostHintButton.tsx` | presentation | 変更 | 「動きで見る」を `ReasonButton` に。`ghostHintTitle` を押せるときの説明だけにする |
| `src/presentation/stage/HintList.tsx` | presentation | 変更 | 「キャンバスで見る」を `ReasonButton` に。理由の `title` を削除 |
| `src/presentation/stage/usePopoverDismiss.ts` | presentation | 変更 | 最初にフォーカスするボタンの選び方から `aria-disabled="true"` を除く |
| `src/presentation/critique/CritiquePanel.tsx` | presentation | 変更 | 「AIの講評をもらう」を `ReasonButton` に |
| `src/presentation/guide/OperationGuideDialog.tsx` | presentation | 変更 | 「初回ガイドをもう一度」を `ReasonButton` に |
| `src/presentation/change/ChangeRequestPanel.tsx` | presentation | 変更 | 「実装を終える」を `ReasonButton` に |
| `src/presentation/blank/BlankDesignPanel.tsx` | presentation | 変更 | 「答え合わせ」は `disabledButtonProps`、「元に戻す」「やり直し」は `ReasonButton` に |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | 抽出ボタンに `disabledButtonProps` を使う |
| `src/index.css` | presentation | 変更 | `aria-disabled` の無効の見た目、`.reason-button` と理由の表示 |
| `e2e/disabled-button-reason.spec.ts` | e2e | 新規 | 下記のE2E |
| `e2e/selectStage.ts` | e2e | 変更 | `startChangeRequests` の判定を `title` から理由の文に変える(下記) |
| `e2e/tiered-hints.spec.ts`・`e2e/ghost-hint.spec.ts`・`e2e/hint-highlight.spec.ts` | e2e | 変更 | `toHaveAttribute('title', 理由)` を `toHaveAccessibleDescription(理由)` に置き換える(文言は同じ) |

`domain`/`application`/`infrastructure` 層は変更しない。

### データ/型の変更

なし(ドメインモデル・永続化スキーマ・ストアの状態は変えない)。

## テスト

### Vitest(先に書いて Red を確認する。AAA を明示する)

`src/presentation/disabledButtonProps.test.ts`

- 正常系: `reason` が `null` なら、`aria-disabled` と `aria-describedby` が `undefined` で、返した `onClick` を呼ぶと渡した `onClick` が1回呼ばれる。
- 異常系: `reason` が文字列なら、`aria-disabled` が `true`、`aria-describedby` が `reasonId` になる。
- 異常系: `reason` が文字列のとき、返した `onClick` を呼んでも渡した `onClick` は呼ばれず、`onBlockedClick` が1回呼ばれる。
- 異常系: `reason` が文字列で `onBlockedClick` を省いたとき、返した `onClick` を呼んでも例外にならず、渡した `onClick` も呼ばれない。

`src/presentation/stage/disabledReasons.test.ts`

- `changeRequestStartReason`
  - `step: 'change-request'` かつ実装中でない → `null`
  - 実装中なら、`step` が `'change-request'` でも `INVESTIGATING_REASON`
  - `'opening-fix'` → 手で入れてみる理由(100点相当でも「100点になると」と言わない)
  - `'refactor'` → `点数が100点になると挑戦できます`
  - `'closing-fix'` → `もう一度解いて` を含む文
- `hintStepReason`
  - 問題を見ていない → `PROBLEM_FIRST_REASON`(ヒントが残っていても)
  - 問題を見た・残りあり → `null`
  - 問題を見た・`revealed === total` → `ヒントはすべて開きました`
- `ghostHintReason`
  - すべて押せる条件 → `null`
  - 未解放と手が残っていないが重なる → `PROBLEM_FIRST_REASON`(優先順)
  - 手で直している間 → `手で直している間は使えません`
  - 再生中 → `動きを再生しています`
  - 手が残っておらず100点 → `ドラッグで動かす手は残っていません`(手なしが100点より先)
  - 手は残っているが100点 → `100点なので、見せる手はもうありません`
  - 実装中 → `INVESTIGATING_REASON`

### E2E(`e2e/disabled-button-reason.spec.ts`、新規)

Tab で目的のボタンまで進む小さなヘルパー(`page.keyboard.press('Tab')` を、目的のボタンが `toBeFocused` になるまで最大60回繰り返し、届かなければ失敗)をこのファイル内に書く。キーボードだけで届くことを確かめるため、`locator.focus()` は使わない。

1. キーボードで「変更依頼に挑戦」の理由が読める
   - 「チュートリアル2: 太った placeOrder」を開く(`selectStage`、冒頭の手直しは済ませる。100点未満)。
   - Tab で `change-request-start` まで進める。
   - `aria-disabled="true"` で、`toHaveAccessibleDescription('点数が100点になると挑戦できます')`。理由の文(`.reason-button__reason`)が `toBeVisible()`。
   - Enter を押しても変更依頼が始まらない(`change-panel` が出ない)。理由の文は見えたまま。
   - Escape を押すと理由の文が隠れる。
2. キーボードで「元に戻す」の理由が読める
   - 同じステージを開いた直後(操作なし)に、Tab で「元に戻す」まで進める。
   - `toHaveAccessibleDescription('まだ元に戻せる操作がありません')`、理由の文が見える。
   - 抽出を1回すると、`aria-disabled` と説明が無くなり、Tab で同じボタンへ進んで Enter で元に戻せる。
3. マウス・タップで押しても理由が見える
   - 「変更依頼に挑戦」をクリックする(`aria-disabled` の要素は Playwright の操作可能チェックで待たされるので `{ force: true }` を付け、理由をコメントに書く)。
   - 理由の文が見え、変更依頼は始まらない。
4. 抽出ボタンにキーボードで到達できる
   - 「チュートリアル1: 長いメソッドを分ける」でメソッドを選び、処理を1つも選んでいない状態で、新しいメソッド名の入力欄から Tab を1回押すと抽出ボタンにフォーカスがある。
   - `aria-disabled="true"` で、`toHaveAccessibleDescription('処理を1つ以上選ぶと押せます')`。Enter を押してもメソッドが増えない。
5. 実装中は「最初に戻す」に実装中の理由が付く
   - 「チュートリアル2」を100点にして `startChangeRequests` で変更依頼を始め、「最初に戻す」が `toHaveAccessibleDescription(INVESTIGATING_REASONの文)`。

### 既存のE2Eの更新

- `e2e/selectStage.ts` の `startChangeRequests`: `button.isDisabled()` と `getAttribute('title')` の判定を、`aria-disabled` が `'true'` で、`page.locator('.reason-button', { has: button }).locator('.reason-button__reason')` の文が `もう一度解いて` を含むか、に置き換える。
- `e2e/tiered-hints.spec.ts`(20・22行目)、`e2e/ghost-hint.spec.ts`(75行目)、`e2e/hint-highlight.spec.ts`(81行目)の `toHaveAttribute('title', …)` を `toHaveAccessibleDescription(…)` に置き換える(文言は同じ)。
- 既存の `toBeDisabled()` / `toBeEnabled()` は、Playwright が `aria-disabled="true"` も無効として扱うので、そのまま通る想定。通らないものがあれば、テストではなく実装の側(`aria-disabled` の付け忘れ)を疑う。

## 受け入れ基準

1. 「チュートリアル2: 太った placeOrder」を開き、キーボードの Tab だけで「変更依頼に挑戦」「元に戻す」へ到達でき、フォーカスしたときに押せない理由がボタンの直下に見え、スクリーンリーダー向けの説明(`aria-describedby`)にも同じ文が入っている。
2. 押せないボタンを Enter・Space・クリック・タップで押しても本来の処理は動かず、理由の文が見える。Escape かフォーカスが外れると隠れる。
3. 押せるようになったボタンには `aria-disabled`・`aria-describedby`・理由の文が無く、今までどおり動く。押せるときの `title`(`Ctrl+Z` など)は残っている。
4. 「対象のボタン」の表にあるボタンが、`disabled` 属性を使わず `ReasonButton` か `disabledButtonProps` で押せない状態を表している(`src/presentation/` を `disabled=\{` で grep して、残るのは「直さないもの」に挙げた要素だけ)。
5. 無効の見た目(薄い表示・ホバーで枠が光らない・強調色が消える)が、`disabled` のときと同じに見える。
6. 冒頭の手直しが終わっていない間の「変更依頼に挑戦」の理由が「100点になると」ではなく、手で入れてみる案内になっている。
7. Vitest の `disabledButtonProps.test.ts`・`disabledReasons.test.ts` が先に Red で書かれ、Green になっている。
8. `e2e/disabled-button-reason.spec.ts` が通り、既存のE2E(ドラッグ・抽出・変更依頼・ヒント)が通る。
9. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 汎用のツールチップ部品(遅延表示・画面端での自動の向き替え・矢印付きの吹き出し)。画面の右端に寄るツールバーだけ右揃えにする。はみ出しが実機で問題になったら別仕様にする。
- `stage/ScoreBreakdown.tsx` の減点の内訳のボタン(実装中に `disabled`)。数が多く、インラインの対象名のボタンに包む要素を足すと行の折り返しが変わるため、必要になったら同じ `ReasonButton` で別Issueにする。
- `stage/ReferenceMenu.tsx` の解答例の項目(`aria-disabled` + `title` で、矢印キーの移動から外している)。メニュー内の無効な項目へ矢印キーで移れるようにするかはメニューの操作の見直しになるので別Issue。
- クイズ・確認問題・解答の再生ダイアログなど、「直さないもの」に挙げたボタン。
- 押せないときのクリックを読み上げで知らせる `aria-live`(フォーカス時に説明として読まれるので足さない)。
- `ProblemHint` の `disabled`・`HintList` の `disabled`・`GhostHintButton` の `investigating` が、今の呼び出し元では常に `false` であることの整理(使われていない props の削除は別の片付け)。
- `aria-keyshortcuts` の追加など、ショートカットの説明の見直し。

## 未決事項

なし。
