# 仕様草案: キーボードでドラッグしたときの読み上げを日本語にし、内部IDではなくメソッド名・クラス名で伝える

- slug: `drag-announcements-ja`
- 元になった探索: `docs/pipeline/drag-announcements-ja/01-discovered.md`
- 関連する既存仕様: `docs/specs/move-via-context-menu.md`(「スクリーンリーダーからは候補も分からない」ので右クリックメニューという別の道を足した経緯)

## 1. 背景・目的

- キャンバスの `DndContext`(`src/presentation/canvas/CodebaseCanvas.tsx` 150〜157行目)には `KeyboardSensor` が登録されていて、
  メソッドのチップ・フィールドのチップ・クラスのヘッダーは「フォーカス → Space/Enter で掴む → 矢印キー → Space/Enter で置く(Esc で取り消し)」で動かせる。
- ところが `accessibility` を渡していないので、dnd-kit の既定の**英語**の文言が使われ、しかも `active.id` / `over.id` には `dndIds.ts` の
  **内部ID**(`method:method-place-order`、プレイヤーが作った部品なら `method:<UUID>`)が入る。`index.html` は `lang="ja"` なので、日本語の音声で
  英文とIDが読まれ、**何を掴んでいて、今どのクラスの上にいて、ここで置くと何が起きるのか**が伝わらない。
- 1か所(`CodebaseCanvas`)を直せば、リファクタリング画面・白紙設計・変更依頼の実装中のすべてに効く。

### 実物で確かめた dnd-kit の API(`@dnd-kit/core` 6.3.1 / `@dnd-kit/accessibility` 3.1.1。`package-lock.json` の版)

node_modules が無い環境だったため、GitHub の `clauderic/dnd-kit` のタグ `@dnd-kit/core@6.3.1` のソースで確認した。

- `DndContext` の props: `accessibility?: { announcements?: Announcements; container?: Element; restoreFocus?: boolean; screenReaderInstructions?: ScreenReaderInstructions }`
- 型は `@dnd-kit/core` から `export type { Announcements, ScreenReaderInstructions }` されている
  ```ts
  interface Announcements {
    onDragStart({ active }: Pick<Arguments, 'active'>): string | undefined;
    onDragMove?({ active, over }: Arguments): string | undefined;
    onDragOver({ active, over }: Arguments): string | undefined;
    onDragEnd({ active, over }: Arguments): string | undefined;
    onDragCancel({ active, over }: Arguments): string | undefined;
  }
  interface ScreenReaderInstructions { draggable: string }
  // Arguments = { active: Active; over: Over | null }。Active / Over は id: UniqueIdentifier のほかに data・rect を持つ
  ```
- 既定の説明文は `To pick up a draggable item, press the space bar. While dragging, use the arrow keys to move the item. Press space again to drop the item in its new position, or press escape to cancel.`、
  既定の読み上げは `Picked up draggable item ${active.id}.` / `Draggable item ${active.id} was moved over droppable area ${over.id}.` /
  `Draggable item ${active.id} is no longer over a droppable area.` / `... was dropped over droppable area ${over.id}` / `... was dropped.` /
  `Dragging was cancelled. Draggable item ${active.id} was dropped.`(01 の記憶ベースの表とほぼ同じ。説明文に Enter は書かれていない)
- 説明文は `DndContext` ごとに**1つ**の非表示テキスト(id は `DndDescribedBy-<連番>`)で、`useDraggable` の `attributes['aria-describedby']` がそれを指す。
  つまりメソッド・フィールド・クラスの**すべての掴める要素で同じ文**が読まれる
- 読み上げは `role="status" aria-live="assertive" aria-atomic` の要素(id は `DndLiveRegion-<連番>`)に、**最後の1文だけ**が入る。
  関数が `undefined` を返すと前の文のまま(上書きしない)
- `onDragOver` は `over` の**IDが変わったときだけ**呼ばれる(矢印キーを押すたびではない)
- `KeyboardSensor` の既定キー: 掴む = Space / Enter、取り消し = Esc、置く = Space / Enter / **Tab**(Tab でもその場に置かれる)
- 読み上げ関数は、`DndContext` の `onDragEnd`(= `useDropHandler` によるストア更新)の**直後に同期で**呼ばれる。登録されているのは直前の描画の関数なので、
  置いたときの文には「置く前の codebase」が使われる(置いた後の codebase でも名前は引けるので、どちらでも結果は同じ)

**本当に新しい仕組みが要るか**: 要らない。dnd-kit 標準の `accessibility` prop に日本語の文言を渡すだけ(ponytail の階段4で止まる)。
内部IDの読み解きは `dndIds.ts` の `parse*` 関数、名前の引き当ては `Codebase.ts` の `findMethod` / `findClassOfMethod` / `findField` / `findClassOfField` / `findClass` / `findFileOfClass` を再利用する。
新しい依存・domain / application / infrastructure・ストア・CSS の変更は無し。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/canvas/dragAnnouncements.ts` | presentation | 読み上げ文・説明文を組み立てる純粋関数と、`DndContext` の `accessibility` に渡すオブジェクトを作る関数。`CodebaseCanvas.tsx` から移す `dropTargetFileId` もここに置く |
| 新規 | `src/presentation/canvas/dragAnnouncements.test.ts` | presentation(test) | 上の純粋関数のテスト(**先に書く**) |
| 変更 | `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | ① `dropTargetFileId`(55〜58行目)を `dragAnnouncements.ts` へ移し import に置き換える。② 本体に `const accessibility = useMemo(() => dragAccessibility(codebase), [codebase]);` の1行と、`<DndContext` に `accessibility={accessibility}` の1行を足す |
| 新規 | `e2e/drag-announcements.spec.ts` | (E2E) | キーボードで掴む・置く・取り消すときの読み上げと説明文を守る(`refactor.spec.ts` は多くのパイプラインが追記するので分ける) |

変更しないもの: `src/domain/**`・`src/application/**`・`src/infrastructure/**`・`useGameStore.ts`・`dndIds.ts`(読むだけ)・
`MethodChip.tsx`・`FieldChip.tsx`・`ClassNode.tsx`・`FileNode.tsx`(`attributes` の `aria-describedby` がそのまま新しい説明文を指すため)・
`useDropHandler`(実際の振る舞い。文言はこれに合わせる側)・センサーの設定・`index.css`。

### `CodebaseCanvas` 本体の行数

`CodebaseCanvas` 関数(126〜186行目)は今、空行・コメントを除いて **56行**(lint 上限60行)。本件の増分は2行で **58行**。
`class-dependency-focus` もこの関数に数行足す予定なので、**後からマージする側**は `npm run lint` で60行を超えていないか確かめ、
超えたら後の側で本体の一部(例: `onDragCancel` のハンドラ3行)を外へ出す。本件では先回りの切り出しはしない。

## 3. データ/型の変更

ドメインモデル・永続化スキーマ・ストアの変更は無し。

### `src/presentation/canvas/dragAnnouncements.ts` の公開API

```ts
import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';
import type { Codebase } from '../../domain/codebase/Codebase';

/** クラスのドロップ先のファイル。クラスの上に落としたときは、そのクラスがあるファイルに移す。(CodebaseCanvas.tsx から移動。中身は変えない) */
export function dropTargetFileId(codebase: Codebase, overId: UniqueIdentifier): string | undefined;

/** 掴める要素すべてに結び付く説明文(aria-describedby の非表示テキスト)。 */
export const DRAG_INSTRUCTIONS: string;

export function announceDragStart(codebase: Codebase, activeId: UniqueIdentifier): string;
export function announceDragOver(codebase: Codebase, activeId: UniqueIdentifier, overId: UniqueIdentifier | null): string;
export function announceDragEnd(codebase: Codebase, activeId: UniqueIdentifier, overId: UniqueIdentifier | null): string;
export function announceDragCancel(codebase: Codebase, activeId: UniqueIdentifier): string;

/** DndContext の accessibility に渡す。上の関数に active.id / over?.id ?? null を渡すだけの薄い変換。 */
export function dragAccessibility(codebase: Codebase): {
  announcements: Announcements;
  screenReaderInstructions: ScreenReaderInstructions;
};
```

- 失敗しない(引けない名前は種類だけで読む)ので `Result` は使わない。例外も投げない
- `onDragMove` は渡さない(矢印キーのたびに読むとうるさい。場所が変わったときは `onDragOver` で足りる)
- `container`・`restoreFocus` は渡さない(既定のまま)
- 内部では「置いたら何が起きるか」を `'move' | 'new-home' | 'none'` のような Union で表す非公開の関数1つにまとめ、`announceDragOver` と `announceDragEnd` で共有してよい。
  判定は `useDropHandler` と同じ分岐にする(下の表)。`useDropHandler` 自体は書き換えない
  (`// ponytail: useDropHandler と分岐を二重に持っている。置き場所の種類が増えたら、判定をこのファイルに寄せて useDropHandler からも使う` を残す)

### 名前の呼び方(未決事項1・3の推奨案Aで書いている)

| 対象 | 文言 | 名前が引けないとき |
| --- | --- | --- |
| メソッド(`method:`) | `メソッド OrderService.placeOrder()` | `メソッド` |
| フィールド(`field:`) | `フィールド OrderService.taxRate` | `フィールド` |
| クラス(`class-drag:` / `class:`) | `クラス TaxCalculator` | `クラス` |
| ファイル(`file:`) | `ファイル src/tax/TaxCalculator.ts` | `ファイル` |
| どの接頭辞でもないID | `項目` | — |

名前が引けないのは、ドラッグ中に Ctrl+Z で消えた・ステージを切り替えた等。内部IDは**どの文にも出さない**。

### 置き場所ごとの結果(`useDropHandler` と、application 層の「同じクラス/同じファイルなら何もしない」に合わせる)

| 掴んだもの | `over` | 起きること | 分類 |
| --- | --- | --- | --- |
| メソッド | 別のクラス | Move Method | move |
| メソッド | 元のクラス | 何もしない(`same-class` は `ok(codebase)`) | none |
| メソッド | ファイルの枠(`file:`) | 何もしない | none |
| メソッド | `null`(余白) | 新しいファイルと新しいクラスを作って移す | new-home |
| フィールド | 別のクラス | Move Field | move |
| フィールド | 元のクラス / ファイルの枠 / `null` | 何もしない | none |
| クラス | 別のファイル、または別のファイルにあるクラス | そのファイルへ移す | move |
| クラス | 元のファイル、または同じファイルのクラス(自分を含む) | 何もしない(`same-file`) | none |
| クラス | `null`(余白) | 新しいファイルを作って移す | new-home |

名前の重複などで移動に失敗するケースは**読み上げでは予測しない**(失敗は既存の `role="alert"` のメッセージが読む)。

### 文言の案(未決事項2の推奨案A = 「上に来たとき」に結果まで言う、で書いている)

実装者は句読点・言い回しを整えてよいが、**名前・場所・結果(移す/移動しない/新しく作る)の3要素**と、テストで確かめる語(下の4章)は守る。

- 説明文 `DRAG_INSTRUCTIONS`(1文で全要素に共通):
  `スペースキーかEnterキーで掴みます。掴んでいる間は矢印キーで動かし、もう一度スペースキーかEnterキーで置きます(Tabキーでもその場に置かれます)。Escキーで取り消します。メソッドとフィールドはクラスの上に、クラスはファイルの上に置くと移動します。メソッドやクラスを何もない所に置くと、新しいファイルを作って移します。`
  (未決事項4で B/C を選んだら、末尾に右クリックメニュー・F2 の案内を足す)
- 掴んだとき: `メソッド OrderService.placeOrder() を掴みました。`
- 上に来たとき(`announceDragOver`):
  - move: `クラス TaxCalculator の上です。置くとこのクラスへ移します。`(クラスを運んでいてファイルの上なら `ファイル src/tax/TaxCalculator.ts の上です。置くとこのファイルへ移します。`)
  - クラスを運んでいて別のクラスの上: `クラス TaxCalculator があるファイル src/tax/TaxCalculator.ts の上です。置くとこのファイルへ移します。`(未決事項3)
  - none(元の場所): `元のクラス OrderService の上です。置いても移動しません。`/ クラスなら `元のファイル src/order/OrderService.ts の上です。置いても移動しません。`
  - none(メソッド・フィールドがファイルの枠の上): `ファイル src/order/OrderService.ts の上です。クラスの上ではないので、置いても移動しません。`
  - new-home(`null`): メソッドなら `どのファイルの上でもありません。置くと新しいファイルとクラスを作って移します。`、クラスなら `…置くと新しいファイルを作って移します。`
  - フィールドで `null`: `どのファイルの上でもありません。フィールドはここに置いても移動しません。`
- 置いたとき(`announceDragEnd`): 成功・失敗を断定しない言い方にする
  - move / new-home: `メソッド OrderService.placeOrder() をクラス TaxCalculator の上に置きました。` / `…を何もない所に置きました。`
  - none: `メソッド OrderService.placeOrder() を元のクラス OrderService の上に置きました。移動はしていません。`
- 取り消したとき: `ドラッグを取り消しました。メソッド OrderService.placeOrder() は元の場所のままです。`

## 4. TDD対象の純粋関数

`dragAnnouncements.test.ts` を**実装より先に**書く(Red → Green)。AAA パターン、1ケース1つの `it`。
フィクスチャは `layoutCodebase.test.ts` と同じくテスト内で `Codebase` を組み立てる:
`src/order/OrderService.ts`(`OrderService`: メソッド `placeOrder`、フィールド `taxRate`)と
`src/tax/TaxCalculator.ts`(`TaxCalculator`・`TaxTable` の2クラス)の2ファイル。IDは `dndIds.ts` の `methodDragId` / `fieldDragId` / `classDragId` / `classDropId` / `fileDropId` で作る。

1. `announceDragStart`: メソッドを掴むと `OrderService.placeOrder()` を含み、`method:` を含まない
2. `announceDragStart`: フィールドなら `OrderService.taxRate`、クラスなら `クラス TaxCalculator` を含む
3. `announceDragStart`: codebase に無いメソッドIDでも例外を投げず、`メソッド` を含み、IDの文字列を含まない
4. `announceDragOver`: メソッドを別のクラスの上 → `TaxCalculator` と「移します」を含む
5. `announceDragOver`: メソッドを元のクラスの上 → 「移動しません」を含む
6. `announceDragOver`: メソッドをファイルの枠の上 → ファイルのパスと「移動しません」を含む
7. `announceDragOver`: メソッドで `over` が `null` → 「新しいファイルとクラス」を含む
8. `announceDragOver`: フィールドで `over` が `null` → 「移動しません」を含み、「新しい」を含まない
9. `announceDragOver`: クラスを別のファイルの上 → そのファイルのパスと「移します」を含む
10. `announceDragOver`: クラスを別のファイルにあるクラス(`TaxTable`)の上 → `src/tax/TaxCalculator.ts` と「移します」を含む(未決事項3の決定どおりの文)
11. `announceDragOver`: クラスを自分自身のクラスの上(`classDropId` が自分)→ 「移動しません」を含む
12. `announceDragOver`: クラスで `over` が `null` → 「新しいファイル」を含む
13. `announceDragEnd`: 移す置き場所なら掴んだものと置き場所の名前を含み、「移動はしていません」を含まない。移動しない置き場所なら「移動はしていません」を含む
14. `announceDragCancel`: 「取り消しました」と掴んだものの名前を含む
15. `DRAG_INSTRUCTIONS`: 「スペースキー」「Enterキー」「矢印キー」「Escキー」を含む
16. どの関数の結果にも、使ったID(`method-place-order` など)が含まれない(上の各ケースの中で確かめてもよい)
17. `dropTargetFileId`: 移すだけなので既存の振る舞い(クラスの上ならそのクラスのファイル、ファイルの上ならそのファイル、どちらでもなければ `undefined`)を1〜2ケースで固定する

`dragAccessibility` は引数を詰め替えるだけなので、ユニットテストは任意(書くなら `Active` を `{ id, data: { current: undefined }, rect: { current: { initial: null, translated: null } } }` のように `as` を使わずに作る)。
E2E で守る。domain / application 層は変更しないので、カバレッジ閾値への影響は無い。

lint 上の注意: `sonarjs/no-nested-template-literals` に当たりやすいので、名前の部分は先に変数へ入れてから文を組み立てる。循環的複雑度12以下に収めるため、種類ごと(メソッド/フィールド/クラス)の分岐は小さな関数に分ける。

## 5. 受け入れ基準

- [ ] `dragAnnouncements.test.ts` を先に書いて Red を確認し、実装して Green になる
- [ ] `CodebaseCanvas.tsx` の差分が「`dropTargetFileId` の移動(import 置き換え)」「`useMemo` の1行」「`accessibility` の1行」だけで、`CodebaseCanvas` 本体が60行以内
- [ ] ドラッグの読み上げ・説明文に英語の既定文と内部ID(`method:` / `class:` / `field:` / `class-drag:` / `file:`・UUID)が出ない
- [ ] E2E `e2e/drag-announcements.spec.ts`(チュートリアル2 `openOrderStage` と同じ開き方。ヘルパーはファイル内に置く)が通る
  - `method-placeOrder` のチップの `aria-describedby` が指す要素のテキストに「スペースキー」と「Escキー」が含まれる(説明文は ID の接頭辞ではなく `aria-describedby` をたどって探す)
  - チップに `focus()` → Space → 読み上げ領域(`[id^="DndLiveRegion-"]`。dnd-kit の実装に依存するのでコメントを残す)のテキストに `OrderService` が含まれ、`method:` が含まれない
    (掴んだ直後に「元のクラスの上」の文へ置き換わるので、`placeOrder` ではなく両方の文に入る `OrderService` で確かめる)
  - 続けて Esc → 「取り消しました」と `placeOrder` が含まれ、`placeOrder` は `OrderService` の中にあるまま
  - もう一度 Space で掴み、Space で置く → 「移動はしていません」が含まれ、コードベースが変わっていない(`placeOrder` が `OrderService` の中にあり、ファイルが増えていない)
  - `class-header-TaxCalculator` に `focus()` → Space → 読み上げに `TaxCalculator` が含まれる → Esc で取り消せる
- [ ] 既存の E2E(マウスでのドラッグ&ドロップ、右クリックメニュー、余白へのドロップで新しいクラスができる等)がすべて通る
- [ ] `npm run check`(lint + typecheck + test)が通る

矢印キーで別のクラス・余白まで運ぶ E2E は書かない(1回25pxの移動量とレイアウトしだいで壊れやすい)。置き場所ごとの文はユニットテストで守る。

## 6. スコープ外

- 掴める要素の `aria-roledescription`(既定の英語 `draggable`)の日本語化。`useDraggable` を呼ぶ `MethodChip.tsx`・`FieldChip.tsx`・`ClassNode.tsx` に差分が出て、他パイプラインと衝突するため後回し
- React Flow の `ariaLabelConfig`(ズームボタン等の英語ラベル)の日本語化
- 置いた**結果**(成功・失敗の理由)の読み上げ。失敗は既存の `role="alert"` のメッセージが読む
- `onDragMove`(矢印キーのたびの読み上げ)
- `KeyboardSensor` の設定変更(移動量・Tab で置かれる挙動の変更、`coordinateGetter` で次のクラスへ飛ぶ操作など)。Tab で置かれることは説明文で伝えるだけにする
- `useDropHandler` のリファクタリング(置き場所の判定を共有する形への書き換え)。ponytail コメントを残すだけ
- `operation-guide` のガイドの文言との擦り合わせ(どちらが後にマージされても、後の件で言い回しをそろえる)
- `CodebasePreviewCanvas.tsx`(ドラッグできない読み取り専用の図なので対象外)

## 7. 衝突の注意

- `CodebaseCanvas.tsx`: `class-dependency-focus` が同じファイルにフック `useClassFocus` を足し、`ReactFlow` の props・`edges` の `useMemo` を変える予定。
  本件の差分は import(20行目付近)・`dropTargetFileId` の削除(55〜58行目)・本体の `useMemo` 1行・`<DndContext` の props 1行。
  テキスト上の競合が出ても手で直せる規模。**本体の60行**は2章のとおり後からマージする側が確かめる
- `dndIds.ts`・`Codebase.ts`: 読むだけ
- `e2e/drag-announcements.spec.ts`・`dragAnnouncements.ts`・`.test.ts`: 新規なので競合なし

## 未決事項

### 未決事項1: 掴んだメソッド・フィールドを、クラス名つきで読むか

- 選択肢A(推奨): クラス名つきで読む(`メソッド OrderService.placeOrder()`・`フィールド OrderService.taxRate`)。Extract Method のあとは別々のクラスに同じ名前のメソッドがあり得るので、どれを掴んだか取り違えない
- 選択肢B: 名前だけで読む(`メソッド placeOrder`・`フィールド taxRate`)。短く聞き取りやすいが、同名のメソッドを区別できない

### 未決事項2: 移動先の上に来たとき、場所だけでなく「ここで置くと何が起きるか」まで読むか

- 選択肢A(推奨): 結果まで読む(「クラス TaxCalculator の上です。置くとこのクラスへ移します」「元のクラスの上です。置いても移動しません」「どのファイルの上でもありません。置くと新しいファイルとクラスを作って移します」)。
  余白で置くと新しいクラスができることは画面にも書かれておらず、読み上げが唯一の手がかりになる
- 選択肢B: 場所だけ読む(「クラス TaxCalculator の上」「どのファイルの上でもありません」)。短いが、何も起きない場所(元のクラス・ファイルの枠)や新しいクラスができる場所の違いが伝わらない。結果は説明文にまとめて書く

### 未決事項3: クラスを運んでいて、別のクラスの上に来たときの読み方

実際には「そのクラスがあるファイルへ移す」(`dropTargetFileId`)。

- 選択肢A(推奨): クラス名とファイルの両方を読む(「クラス TaxCalculator があるファイル src/tax/TaxCalculator.ts の上です。置くとこのファイルへ移します」)。目印になるクラス名と、実際の移動先を両方伝える
- 選択肢B: ファイルだけ読む(「ファイル src/tax/TaxCalculator.ts の上です」)。ファイルの枠の上と同じ文になり短いが、クラスの上にいることは伝わらない
- 選択肢C: クラス名だけ読む(「クラス TaxCalculator の上です」)。メソッドを運ぶときと同じ文になるが、「クラスの中に入る」と誤解されやすい

### 未決事項4: 掴める要素の説明文に、ドラッグ以外のキー操作(右クリックメニューの Shift+F10、名前の変更の F2)を書き足すか

説明文は1つで、メソッド・フィールド・クラスのすべてに結び付く(要素ごとに変えられない)。

- 選択肢A(推奨): 書き足さない(ドラッグの操作だけ)。F2 はメソッドにしか効かず、`method-rename-keyboard` は `aria-keyshortcuts` で伝える方針。Shift+F10 は `move-class-via-context-menu` がマージされるまでクラスでは移動に使えない
- 選択肢B: Shift+F10 だけ書き足す(「Shift+F10 で開くメニューからも移動できます」)。ドラッグが難しいときの別の道が分かるが、説明文が長くなる
- 選択肢C: Shift+F10 と F2 の両方を書き足す(F2 は「メソッドは F2 で名前を変えられます」)。一番親切だが、フィールド・クラスでは F2 が効かないことを読み手が判断する必要がある
