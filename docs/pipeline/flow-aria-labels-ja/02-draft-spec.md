# 02 仕様草案: キャンバスの React Flow 標準の文言(ズームのボタン・ノード/矢印の説明・矢印キー移動の読み上げ)を日本語にし、実際の操作と合わせる

- slug: `flow-aria-labels-ja`
- 入力: `docs/pipeline/flow-aria-labels-ja/01-discovered.md`

## 1. 背景・目的

リファクタリング画面・白紙設計のキャンバス(`CodebaseCanvas.tsx`)と、読み取り専用の図(`CodebasePreviewCanvas.tsx`。「変更前の図」「解答例の図」・設計くらべ)は、
React Flow の既定の英語の文言をそのまま使っている。`index.html` は `lang="ja"` で、ほかの文字はすべて日本語なのに、次の文言だけ英語で残る。

- 左下のズームのボタンの `aria-label` と `title`(マウスを乗せたときの表示)が `Zoom In` / `Zoom Out` / `Fit View`、ボタンの並びの名前が `Control Panel`
- ノード(ファイルの箱・クラス)に Tab でフォーカスしたときの説明文が英語で、しかも**今のゲームの動きと合っていない**
  - 「Press delete to remove it」と読まれるが、ノードは Delete/Backspace では消えない(`useFlowOverrides` が `position`・`dimensions` だけ反映して `remove` を無視する。85〜97行目)
  - 「矢印キーで動かせる」と読まれるが、動くのは**ファイルの箱だけ**(`arrangeNodes` がクラスのノードを `draggable: false` にする。73〜79行目)。読み取り専用の図は `nodesDraggable={false}` で何も動かない
- 矢印(依存・継承)にフォーカスしたときの説明文も「delete で消せる」と読まれるが、消えない
- 選んだファイルの箱を矢印キーで動かしたときの読み上げが `Moved selected node up. New position, x: …, y: …`

スクリーンリーダーの利用者に英文が日本語の音声で読まれるうえ、できない操作を案内してしまう。CLAUDE.md の「手を抜かないもの: アクセシビリティ」に当たる。

### ponytail の階段

React Flow の標準機能(階段4)で止まる。`ReactFlow` の `ariaLabelConfig` プロパティに日本語の文言を渡すだけで、
新しい依存・domain・application・infrastructure・ストア・ステージデータ・CSS の変更は要らない。

- 本当に `deleteKeyCode={null}`(Delete キーを無効にする)が要るか → 要らない。`remove` はすでに無視されていて消えないので、説明文で言わなければ足りる
- 本当にノードごと(ファイルの箱/クラス)に説明文を分ける仕組みが要るか → 要らない(React Flow の説明文はキャンバス1つにつき1つ。分けるには
  `aria-describedby` を自前で配線することになる)。「選んだファイルの箱は矢印キーで動かせます」と書けば、クラスのノードで読まれても誤りにならない

### 実物で確認した事実(`@xyflow/react` 12.11.6 / `@xyflow/system` 0.0.82。`package-lock.json` の解決バージョン)

`node_modules` は未インストールだったため、GitHub の `xyflow/xyflow` リポジトリのタグ `@xyflow/react@12.11.6`・`@xyflow/system@0.0.82` のソースで確認した。

- `ReactFlow` の props に `ariaLabelConfig?: Partial<AriaLabelConfig>` がある。「渡したキーだけ既定を上書きする」(JSDoc)。
  型 `AriaLabelConfig` は `@xyflow/react` から re-export されている(`import type { AriaLabelConfig } from '@xyflow/react'`)。既定値の `defaultAriaLabelConfig` は re-export されていない
- `AriaLabelConfig` のキーと既定の文言(`packages/system/src/constants.ts`):

  | キー | 既定 | 本件で使う場所 |
  | --- | --- | --- |
  | `node.a11yDescription.default` | `Press enter or space to select a node. Press delete to remove it and escape to cancel.` | **使われない**(下の注意) |
  | `node.a11yDescription.keyboardDisabled` | `Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.` | **ノードの説明文(実際に読まれる方)** |
  | `node.a11yDescription.ariaLiveMessage` | `({ direction, x, y }: { direction: string; x: number; y: number }) => \`Moved selected node ${direction}. New position, x: ${x}, y: ${y}\`` | 矢印キーで動かしたときの読み上げ |
  | `edge.a11yDescription.default` | `Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.` | 矢印の説明文 |
  | `controls.ariaLabel` | `Control Panel` | ボタンの並びの `aria-label` |
  | `controls.zoomIn.ariaLabel` / `controls.zoomOut.ariaLabel` / `controls.fitView.ariaLabel` | `Zoom In` / `Zoom Out` / `Fit View` | 各ボタンの `aria-label` と `title` の**両方** |
  | `controls.interactive.ariaLabel` / `minimap.ariaLabel` / `handle.ariaLabel` | `Toggle Interactivity` / `Mini Map` / `Handle` | 使っていない(`showInteractive={false}`、MiniMap なし、React 版の `Handle` はこのキーを参照しない)。**設定しない** |

- **キー名と使われ方が逆に見えるので注意**: `A11yDescriptions` は
  `disableKeyboardA11y ? config['node.a11yDescription.default'] : config['node.a11yDescription.keyboardDisabled']` を描く。
  このゲームは `disableKeyboardA11y` を指定していない(既定 `false`)ので、**読まれるのは `keyboardDisabled` の方**。
  `disableKeyboardA11y` が `true` のときはノードの `aria-describedby` 自体が付かないので、`default` はどこからも参照されない → `default` は設定しない(YAGNI)。
  定数ファイルに、このことを1行コメントで残す
- `ariaLiveMessage` は、ノードが `draggable` かつ選択中のときの矢印キーでだけ呼ばれる。`direction` は `event.key.replace('Arrow', '').toLowerCase()`
  (`'up' | 'down' | 'left' | 'right'`、型は `string`)。`x`・`y` は**動かす前**の絶対座標
- 説明文の要素 ID は `react-flow__node-desc-${rfId}` / `react-flow__edge-desc-${rfId}`、読み上げ領域は `react-flow__aria-live-${rfId}`。
  **`rfId` は `ReactFlow` の `id` prop、未指定なら `'1'`**。今は全キャンバスが `id` を指定していないので、同じ画面に複数のキャンバスがあると ID が重複する
  (下の「設計の要点」参照)
- 矢印の要素の `aria-label` は、辺ごとの `ariaLabel` が無いと `Edge from ${source} to ${target}`(英語)になる。これは `ariaLabelConfig` では変えられない(スコープ外)

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/canvas/flowAriaLabels.ts` | presentation | 日本語の文言の定数2つ(編集できるキャンバス用・読み取り専用の図用)と、矢印キー移動の読み上げ文を作る関数 `movedNodeMessage` |
| 新規 | `src/presentation/canvas/flowAriaLabels.test.ts` | presentation(テスト) | `movedNodeMessage` のユニットテスト(先に書く) |
| 変更 | `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | import 1行、`ReactFlow` の props に `ariaLabelConfig={CANVAS_ARIA_LABELS}` を1行。`nodesConnectable={false}`(164行目)の直後に置き、`class-dependency-focus` が足す `on…` ハンドラの並び(`onPaneContextMenu` の後ろ)から離す |
| 変更 | `src/presentation/preview/CodebasePreviewCanvas.tsx` | presentation | import 1行、`react` の import に `useId` を追加、`const flowId = useId();` を1行、`ReactFlow` の props に `id={flowId}` と `ariaLabelConfig={PREVIEW_ARIA_LABELS}` の2行(未決事項2で B を選んだ場合は `id` と `useId` は不要) |
| 変更 | `e2e/refactor.spec.ts` | E2E | 230・240・1102・1167・1262・1375行目のボタン名を新しい名前に書き換え(`exact: true` を付ける)。74・1098行目のコメントの `Fit View` も新しい名前に。実装時点の master で他の件が英語名を足していればそれも書き換える |
| 新規 | `e2e/flowAriaLabels.spec.ts` | E2E | 本件の E2E(下の受け入れ基準) |

読むだけで変更しないファイル: `index.html`・`semanticZoom.ts`・`layoutCodebase.ts`・`App.tsx`・`CodebasePreviewDialog.tsx`・`ComparisonQuizView.tsx`・`BlankDesignView.tsx`

触らないファイル: `src/domain/`・`src/application/`・`src/infrastructure/`・`useGameStore.ts`・`ClassNode.tsx`・`FileNode.tsx`・`MethodChip.tsx`・`FieldChip.tsx`・`DependencyHandles.tsx`・`index.css`・ステージ定義

## 3. データ/型の変更

ドメインモデル・永続化スキーマ・ストアの変更は無い。presentation 層の定数だけ。

`src/presentation/canvas/flowAriaLabels.ts` の形(文言は未決事項1〜3の推奨案で書いた例。確定後に差し替える):

```ts
import type { AriaLabelConfig } from '@xyflow/react';

const DIRECTION_LABELS: Partial<Record<string, string>> = { up: '上', down: '下', left: '左', right: '右' };

/** 選んだファイルの箱を矢印キーで動かしたときの読み上げ。動くのはファイルの箱だけ(クラスは draggable: false)。 */
export function movedNodeMessage({ direction }: Readonly<{ direction: string }>): string {
  return `ファイルの箱を${DIRECTION_LABELS[direction] ?? direction}へ動かしました`;
}

const CONTROLS_LABELS = {
  'controls.ariaLabel': 'ズームの操作',
  'controls.zoomIn.ariaLabel': '拡大',
  'controls.zoomOut.ariaLabel': '縮小',
  'controls.fitView.ariaLabel': '全体を表示',
} satisfies Partial<AriaLabelConfig>;

const EDGE_DESCRIPTION = '依存・継承の矢印です。見るだけで、削除やつなぎ替えはできません。';

// disableKeyboardA11y が false(既定)のときに読まれるのは 'node.a11yDescription.keyboardDisabled' の方(React Flow のキー名が逆に見える)。
// 'node.a11yDescription.default' は disableKeyboardA11y のときだけ使われ、そのときは aria-describedby 自体が付かないので設定しない。
export const CANVAS_ARIA_LABELS: Partial<AriaLabelConfig> = {
  ...CONTROLS_LABELS,
  'node.a11yDescription.keyboardDisabled': 'Enterキーかスペースキーで選び、Escキーで選択を外します。選んだファイルの箱は矢印キーで動かせます。',
  'node.a11yDescription.ariaLiveMessage': movedNodeMessage,
  'edge.a11yDescription.default': EDGE_DESCRIPTION,
};

export const PREVIEW_ARIA_LABELS: Partial<AriaLabelConfig> = {
  ...CONTROLS_LABELS,
  'node.a11yDescription.keyboardDisabled': '読み取り専用の図です。見るだけで、動かしたり変更したりはできません。',
  'edge.a11yDescription.default': EDGE_DESCRIPTION,
};
```

- `DIRECTION_LABELS` を `Partial<Record<…>>` にするのは、`tsconfig` に `noUncheckedIndexedAccess` が無く、`Record<string, string>` だと `?? direction` が
  `no-unnecessary-condition` に引っかかるため。`as` は使わない(lint で禁止)
- `movedNodeMessage` の引数は `{ direction }` だけ受け取る(`{ direction, x, y }` を渡されても型上は代入可能)。未決事項3で座標を読む案を選んだ場合は `x`・`y` も受け取る
- 読み取り専用の図は `nodesDraggable={false}` なので `ariaLiveMessage` は呼ばれない → `PREVIEW_ARIA_LABELS` には入れない
- 文言の言い回しは `drag-announcements-ja` の説明文(「スペースキーかEnterキーで…」「Escキーで取り消します」)と、`operation-guide` の表(「拡大・縮小」「左下の +/− ボタン」)にそろえる

### 設計の要点: 読み取り専用の図に一意な `id` を渡す(未決事項2で A を選んだ場合)

`rfId` の既定が `'1'` なので、「変更前の図」ダイアログを開いている間や設計くらべ(図が2つ+隠れたリファクタリング画面)では、
`react-flow__node-desc-1` などの ID が**複数の要素に重複する**。`aria-describedby` は ID で先頭の要素を指すので、
読み取り専用の図のノードに、リファクタリング画面の説明文(「矢印キーで動かせます」)が読まれてしまう(DOM の順しだいで逆も起きる)。
2つのキャンバスで説明文を分けるなら、`CodebasePreviewCanvas` で `useId()` の値を `ReactFlow` の `id` に渡して重複を避ける。

- リファクタリング画面と白紙設計の `CodebaseCanvas` はどちらも `id` 未指定(`'1'`)のまま残る。両方とも `CANVAS_ARIA_LABELS` なので、重複しても読まれる文言は同じで実害は無い。
  `CodebaseCanvas` には `id` を足さない(`CodebaseCanvas` 関数は `class-dependency-focus` も行を足す予定で、1関数60行の上限に近い)。
  この手抜きは `flowAriaLabels.ts` か `CodebaseCanvas.tsx` の `ariaLabelConfig` の行の近くに
  `// ponytail: リファクタリング画面と白紙設計のキャンバスは rfId が同じ '1' で説明文の ID が重複する(文言が同じなので実害なし)。文言を分けるときは id を渡す`
  と残す
- `id` を変えると React Flow の矢印の先の `marker` の ID もその `id` を含む形に変わるが、React Flow が内部で一貫して組み立てるので見た目は変わらない
  (E2E の既存の矢印のテストが通ることで確かめる)

## 4. TDD対象の純粋関数

domain/application 層の新しいロジックは無い。presentation 層の `movedNodeMessage` だけ、先にテストを書く
(既存にも `layoutCodebase.test.ts`・`clampMenuPosition.test.ts` と presentation のユニットテストがある。カバレッジの閾値の対象外)。

`src/presentation/canvas/flowAriaLabels.test.ts`(AAA パターン、`it.each` 可):

| # | 入力 | 期待 |
| --- | --- | --- |
| 1 | `{ direction: 'up' }` | `ファイルの箱を上へ動かしました` |
| 2 | `{ direction: 'down' }` | `ファイルの箱を下へ動かしました` |
| 3 | `{ direction: 'left' }` | `ファイルの箱を左へ動かしました` |
| 4 | `{ direction: 'right' }` | `ファイルの箱を右へ動かしました` |
| 5(異常系) | `{ direction: 'north' }`(想定外の値) | 例外を投げず `ファイルの箱をnorthへ動かしました`(そのまま埋め込む) |

(未決事項3で座標を読む案を選んだ場合は、`{ direction: 'up', x: 120, y: 40 }` で座標が含まれるケースを足す)

定数そのもの(文言)はユニットテストしない。文言が画面に出ることは E2E で守る。

## 5. 受け入れ基準

### 静的チェック

1. `npm run check`(lint + typecheck + test)が通る。`as`・非 null アサーションを使っていない
2. `grep -rnE "'(Zoom In|Zoom Out|Fit View)'" e2e/` が0件(実装時点の master で他の件が足した分も書き換える)。`src/` にも英語のボタン名の参照が無い

### E2E(`npm run test:e2e` がすべて通る)

既存: `e2e/refactor.spec.ts` のズーム・Fit View を使う6本(230・240・1102・1167・1262・1375行目を含むテスト)が、新しいボタン名で通る。矢印の数を確かめる既存テストも通る。

新規 `e2e/flowAriaLabels.spec.ts`(題材は、他の件が変えないチュートリアル2 と、矢印が必ずある中級1。AAA パターン):

1. **ズームのボタンが日本語で引ける**: チュートリアル2 を開く → `getByRole('button', { name: '拡大', exact: true })`・`'縮小'`・`'全体を表示'` が見え、
   それぞれ `title` 属性が同じ文字列。`getByRole('button', { name: 'Zoom In' })` は0件。ボタンの並び(`.react-flow__controls`)の `aria-label` が `ズームの操作`。
   `縮小` を4回押すとメソッド `placeOrder` が隠れ、`拡大` を4回押すと戻る(既存230〜245行目のテストと同じ確かめ方で十分なら、そちらの書き換えで兼ねてよい)
2. **ノードの説明文が日本語で、できない操作を言わない**: チュートリアル2 のファイルの箱のノード
   (`page.locator('.react-flow__node-fileNode', { has: page.getByTestId('file-src/order/OrderService.ts') })`)の `aria-describedby` をたどった要素のテキストが、
   「矢印キー」を含み、「削除」「delete」「Delete」を含まない。クラスのノード(`.react-flow__node-classNode`)の説明文も同じ要素を指す
3. **矢印の説明文**: 中級1 を開き、最初の `.react-flow__edge` の `aria-describedby` をたどった要素のテキストが「矢印」を含み、「delete」「Delete」を含まず、「できません」を含む
4. **矢印キーでファイルの箱を動かしたときの読み上げ**: チュートリアル2 でファイルの箱のノードに `focus()` → Enter で選ぶ → ArrowRight →
   `page.getByText('ファイルの箱を右へ動かしました')` が DOM にある(`toBeAttached()`。読み上げ領域は視覚的に隠れているので `toBeVisible` は使わない)。
   ファイルの箱の x 座標が押す前より大きくなる(`toPass` で待つ)
5. **読み取り専用の図は別の説明文を指す**(未決事項2で A の場合): チュートリアル2 で「変更前の図を見る」を押す →
   ダイアログ内のノードの `aria-describedby` をたどった要素のテキストが「読み取り専用」を含み「矢印キー」を含まない。
   同時に、リファクタリング画面のファイルの箱のノードの説明文は「矢印キー」を含んだまま(ID の重複で入れ替わっていないこと)。
   ダイアログ内に `getByRole('button', { name: '拡大', exact: true })` がある

説明文は ID の接頭辞ではなく `aria-describedby` をたどって探す(`drag-announcements-ja` と同じ方針)。
例: `const id = await node.getAttribute('aria-describedby'); await expect(page.locator(\`[id="${id}"]\`)).toContainText('矢印キー')`
(`useId()` の値が CSS セレクタで特別な文字を含んでも壊れないよう、`#${id}` ではなく属性セレクタで引く)

### 手動確認(実装者が実機で)

- ズームのボタンにマウスを乗せると `拡大`・`縮小`・`全体を表示` の吹き出しが出る
- 設計くらべを開いても、2つの図のズームのボタン・矢印の見た目(矢印の先の三角)が変わっていない

## 6. スコープ外

- **矢印の `aria-label`(既定の英語 `Edge from {source} to {target}`)**: `ariaLabelConfig` では変えられず、辺ごとに `ariaLabel` を渡す必要がある(`layoutCodebase.ts` の
  `dependencyEdges`・`inheritanceEdges`)。「何から何への矢印か」を言う文言は `implements-arrow-style`・`class-dependency-focus` の結果を見てから別件にする。
  本件は「何ができるか」の説明文(`edge.a11yDescription.default`)だけを扱う
- dnd-kit の `aria-roledescription`(既定の `draggable`)の日本語化(`drag-announcements-ja` の後回し欄)
- ノード・矢印を Tab で止まらせるか(`nodesFocusable`・`edgesFocusable`)、読み取り専用の図で選べなくするか(`elementsSelectable`)の見直し。
  `class-dependency-focus` のフォーカスでの強調に影響するので、今回は文言だけ
- ファイルの箱とクラスのノードで説明文を分けること(React Flow の説明文はキャンバスに1つ。自前の `aria-describedby` 配線が要るので見送り)
- `CodebaseCanvas` への `id` の付与(リファクタリング画面と白紙設計で文言が同じなので不要。ponytail コメントで残す)
- `deleteKeyCode` の変更(すでに削除は無視されているので不要)
- 使っていないキー(`controls.interactive.ariaLabel`・`minimap.ariaLabel`・`handle.ariaLabel`・`node.a11yDescription.default`)の設定
- ミニマップの追加・ズームのボタンの見た目の変更

## 7. 衝突の見立て(01 からの更新)

| ファイル | 相手 | 見立て |
| --- | --- | --- |
| `CodebaseCanvas.tsx` | `class-dependency-focus`(`ReactFlow` の props にハンドラ、フック追加)・`drag-announcements-ja`(`DndContext` の props・import) | テキスト上の小さな競合のみ。本件は import 1行(`./FileNode` の次)と `nodesConnectable={false}` の直後の1行 |
| `CodebasePreviewCanvas.tsx` | `quiz-change-site-marks`(props の型・Provider の value) | 本件は `react` の import 行・関数本体の1行目・`ReactFlow` の props。Provider の value の行とは離れている |
| `e2e/refactor.spec.ts` | ほぼ全件(末尾に追記) | テキスト上は小さい。**意味上の衝突**(本件のブランチ作成後・マージ前に、他件が英語のボタン名を使う E2E をマージすると、本件のマージ後に落ちる)は未決事項4 |

## 8. 未決事項

### 未決事項1: ズームのボタンの名前(`aria-label` と `title` の両方に出る。E2E の書き換え先)

- 選択肢A(推奨): 「拡大」「縮小」「全体を表示」、並びの名前は「ズームの操作」。`operation-guide` の表の「拡大・縮小」とそろい、吹き出しとしても短い
- 選択肢B: 「ズームイン」「ズームアウト」「全体表示」、並びの名前は「ズームの操作」。英語の既定に近く、React Flow を知っている人には対応が分かりやすい

### 未決事項2: 読み取り専用の図(変更前の図・解答例の図・設計くらべ)のノードの説明文を、リファクタリング画面と分けるか

- 選択肢A(推奨): 分ける。図の方は「読み取り専用の図です。見るだけで、動かしたり変更したりはできません。」にする。
  `rfId` の重複で説明文が入れ替わらないよう、`CodebasePreviewCanvas` で `useId()` を `ReactFlow` の `id` に渡す(1行+props 1行)
- 選択肢B: 分けない。両方に同じ説明文(「Enterキーかスペースキーで選び、Escキーで選択を外します。選んだファイルの箱は矢印キーで動かせます。」)を渡す。
  `id` は触らない。図では「矢印キーで動かせます」が当てはまらないが、変更は最小(ボタン名と「削除」の除去は効く)

### 未決事項3: 選んだファイルの箱を矢印キーで動かしたときの読み上げに座標を入れるか

- 選択肢A(推奨): 入れない。「ファイルの箱を右へ動かしました」だけ。座標はプレイヤーにとって意味が薄く、しかも React Flow が渡すのは**動かす前**の座標
- 選択肢B: 入れる。「ファイルの箱を右へ動かしました(x: 120, y: 40)」。英語の既定と同じ情報量。動かす前の座標である点は受け入れる

### 未決事項4: E2E で英語のボタン名を使う他件との意味上の衝突をどう防ぐか

本件より前にブランチを作った他件が、新しい E2E で `'Zoom In'` などを使ったまま本件の後にマージされると、master の E2E が落ちる
(本件のマージ後にブランチを作る件は、既存の E2E を見て日本語の名前を使うので問題にならない)。

- 選択肢A(推奨): **マージ順を後ろに回す**。進行中の件(特に `refactor.spec.ts` に追記する件)の実装 PR がマージされてから、この件の `/spec-confirm` を実行する。
  あわせて受け入れ基準2(`e2e/` 全体で英語名0件の grep)で実装時点の master の分を書き換え、evaluate でも master を grep し直す。ヘルパーは作らない(1行の呼び出しを包むだけの抽象化になるため)
- 選択肢B: **E2E の共通ヘルパーを作る**。新規 `e2e/canvasControls.ts` に `zoomIn(page)`・`zoomOut(page)`・`fitView(page)` を置き、6か所をそれに寄せる。
  ボタン名が1か所になり、今後ボタン名を変えても直す場所は1つ。ただし進行中の件はヘルパーを知らないので、今回の衝突はこれだけでは防げない(Aの grep も併用する)
- 選択肢C: 早めにマージして危ない期間を短くする。進行中の件で落ちたら、その件の codex-review / claude-review の差し戻し、または evaluate の後の USER_FIXES で直す
