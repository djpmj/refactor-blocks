# dnd-announcements-ja: ドラッグ操作の読み上げを日本語にし、内部IDではなく名前で伝える

## 背景・目的

2026-10-17 に画面の状態を調べていて、dnd-kit のスクリーンリーダー向けの文が**英語の既定のまま**だと分かった。

- 操作説明(`DndDescribedBy-0`): `To pick up a draggable item, press the space bar. While dragging, use the arrow keys to move the item. …`
- 操作のあとに読み上げる文(`DndLiveRegion`): `Draggable item method:method-blank-send-shipped-mail was dropped over droppable area class:e7b024e0-2a1c-48e7-b6b9-ca0dd886da14`

ゲームの文はすべて日本語なのに、読み上げだけ英語になる。しかも内部ID(`method:…`・UUID)をそのまま読み上げるので、何をどこへ移したか分からない。
`CodebaseCanvas.tsx` の `DndContext` に `accessibility` を渡していないことが原因。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/canvas/dndAnnouncements.ts` | presentation | ドラッグ要素・ドロップ先のIDを名前にして、日本語の文を作る純粋関数 |
| 新規 | `src/presentation/canvas/dndAnnouncements.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | `DndContext` に `accessibility={{ announcements, screenReaderInstructions }}` を渡す |
| 新規 | `e2e/dnd-announcements-ja.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`domain` は変更しない。

## データ・型の変更

なし。ドラッグ要素のID(`method:<id>`・`field:<id>`・`class-drag:<id>`)とドロップ先のID(`class:<id>`・`file:<id>`・余白など)の形は今のまま使い、
`Codebase` から名前を引く。IDの組み立て・分解は既存の `src/presentation/canvas/dndIds.ts` を使う(接頭辞を新しく書かない)。

## 文の仕様

- 操作説明: `スペースキーで持ち上げ、矢印キーで動かします。もう一度スペースキーで置き、Esc で取り消します。`
- 持ち上げたとき: `<要素> を持ち上げました。`
- 動かしているとき(ドロップ先の上): `<要素> を <ドロップ先> の上に動かしています。` / ドロップ先が無い: `<要素> はどこの上にもありません。`
- 置いたとき: `<要素> を <ドロップ先> に置きました。` / 余白: `<要素> を余白に置きました。新しいクラスを作ります。` / どこでもない: `<要素> は元の場所に戻りました。`
- 取り消したとき: `<要素> の移動を取り消しました。`
- `<要素>` の書き方: メソッド `<クラス名>.<メソッド名>()`、フィールド `<クラス名>.<フィールド名>`、クラス `クラス <名前>`
- `<ドロップ先>` の書き方: クラス `クラス <名前>`、ファイル `<ファイルの中のクラス名を「・」でつないだもの> のファイル`(ファイル名は画面に出していないため)
- 名前が引けないIDは `項目` / `移動先` とし、IDそのものは読み上げない

## TDD対象の純粋関数

### `describeDraggable(codebase, id)` / `describeDroppable(codebase, id)`(`presentation/canvas/dndAnnouncements.ts`)

- `method:<id>` → `ReportService.printMonthlyReport()`
- `field:<id>` → `Order.lines`
- `class-drag:<id>` → `クラス ShippingService`
- `class:<id>` → `クラス Mailer`
- `file:<id>`(2クラス入り) → `CartService・PointService のファイル`
- 存在しないID → `項目` / `移動先`

## 受け入れ基準

1. メソッドのボタンの `aria-describedby` が指す要素の文が、上の日本語の操作説明になっている
2. キーボードでメソッドを持ち上げて別クラスへ置くと、ライブリージョンに `<クラス名>.<メソッド名>() を クラス <名前> に置きました。` が入り、英語とIDが含まれない
3. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- メソッドのボタン自体の読み上げ名(`method-chip-accessible-name` で扱う)
- ドラッグの操作方法そのものの変更
