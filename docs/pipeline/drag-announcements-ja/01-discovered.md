# 01 機能探索: キーボードでのドラッグ操作の読み上げを日本語にし、内部IDではなくメソッド名・クラス名で伝える

- slug: `drag-announcements-ja`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

CLAUDE.md の「手を抜かないもの: … アクセシビリティ(キーボード操作を含む)」と、「ドラッグ&ドロップの操作は壊れやすいので…E2Eで必ず守る」に当たる穴として見つけた。

## 背景・目的

キャンバスの `DndContext`(`src/presentation/canvas/CodebaseCanvas.tsx` 150行目)には `KeyboardSensor` が登録されており、
メソッドのチップ・フィールドのチップ・クラスのヘッダーは「フォーカス → Space で掴む → 矢印キー → Space で置く(Esc で取り消し)」で動かせる。
ところが `DndContext` に `accessibility` を渡していないため、dnd-kit の**既定の英語の文言**がそのまま使われている。

| 何が読まれるか | 今(dnd-kit v6 の既定。記憶ベースで、node_modules 未インストールのため実物は仕様設計で要確認) |
| --- | --- |
| 掴めるボタンの説明(`aria-describedby` の非表示テキスト) | `To pick up a draggable item, press the space bar or enter. While dragging, use the arrow keys …` |
| 掴んだとき(`aria-live` の読み上げ) | `Picked up draggable item method:<UUIDなど>.` |
| 移動先の上に来たとき | `Draggable item method:… was moved over droppable area class:<ID>.` |
| 置いた/取り消したとき | `Draggable item … was dropped over droppable area class:<ID>` / `Dragging was cancelled. …` |

- `index.html` は `lang="ja"` なので、日本語の音声で英文が読まれる。さらに `active.id` / `over.id` は `dndIds.ts` の**内部ID**
  (`method:` / `field:` / `class-drag:` / `class:` / `file:` + ID。プレイヤーが作ったメソッド・クラスは `crypto.randomUUID()`)で、
  **何を掴んで、今どのクラスの上にいるのかが分からない**。キーボードでドラッグしている人に、移動先が分からないまま置かせている
- 置き場所の意味(クラスの上なら Move Method、余白なら「新しいファイル(+クラス)を作って移す」、クラスのドラッグはファイルの上/クラスの上ならそのファイルへ)も伝わらない。
  特に「余白で置くと新しいクラスができる」は `useDropHandler`(`CodebaseCanvas.tsx` 100〜123行目)にしか書かれていない振る舞い
- `move-via-context-menu`(マージ済み)・`move-class-via-context-menu`(進行中)は「スクリーンリーダーからは移動先の候補が分からない」ことを理由に
  **右クリックメニュー(Shift+F10)という別の道**を足した。本件はそれと補い合う形で、**既にあるドラッグの道**そのものを、読み上げで使える状態にする
- `operation-guide`(進行中)の02は、`KeyboardSensor` の操作(Space で掴む・矢印・Space で置く)をガイドに書く案(未決事項3・選択肢A)を推奨している。
  ガイドどおりに操作したスクリーンリーダー利用者に英語とIDが読まれる、という食い違いを本件で埋める
- リファクタリング画面・白紙設計・変更依頼の実装中はどれも同じ `CodebaseCanvas` を使うので、1か所直せば全モードに効く

ponytail の階段では「React Flow/dnd-kit の標準機能でできるか?」で止まる見込み: dnd-kit の `DndContext` の
`accessibility={{ announcements, screenReaderInstructions }}` に日本語の文言を渡すだけ。新しい依存・domain・application・ストアの変更は要らない。
名前の引き当ては既存の `parseMethodDragId` などと `findMethod` / `findClass` / `findField` / `findFileOfClass` を再利用できる。

### 既存テーマとの重複確認

- `move-via-context-menu`(仕様・実装済み)・`move-class-via-context-menu`: **右クリックメニュー**からの移動。ドラッグの読み上げは扱わない
- `operation-guide`: 操作の**一覧(ガイド画面)**。dnd-kit の読み上げの文言は扱わない(02は `CodebaseCanvas.tsx` を「変更しない(読むだけ)」と明記)
- `method-rename-keyboard`: チップ上の **F2** で名前の変更。02のスコープ外に「dnd-kit のスクリーンリーダー向け説明文に F2 を書き足す」が
  **`aria-keyshortcuts` で足りる**として挙がっている。本件は説明文そのものの日本語化で、F2 を書き足すかどうかは本件の仕様設計で決めればよい(下の論点)
- `color-contrast-a11y`: 色のコントラストと「行数オーバー」の文字化。キー操作・読み上げの文言は扱わない
- `class-dependency-focus`: 未決事項4で「注目したクラスの依存を文字で伝えるか」を扱うが、ドラッグ中の読み上げではない
- `implements-arrow-style`: 矢印の `ariaLabel` を論点に挙げているが、辺の話でドラッグとは無関係
- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 24件を `announcements|screenReaderInstructions|DndLiveRegion|DndDescribedBy|読み上げ|スクリーンリーダー|KeyboardSensor`
  でgrepし、dnd-kit の読み上げの文言を主題にしたものは無い
- 呼び出し元が列挙した24件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **VSCode風ファイルツリー**: 過去の探索と同じ理由(新しいペイン・dnd-kitのドロップ先・E2Eが要り、1回のPRには大きい)
- **新ステージ(Middle Man を外す・Replace Conditional with Polymorphism・Facade など)**: ステージ追加がすでに4件並走しており、
  `sampleAnswer.ts`・`stageCatalog.test.ts`・各ステージ定義ファイルへの同時追記がさらに増える。Middle Man は `law-of-demeter-stage` の
  Hide Delegate と対になる題材なので、そちらのマージ後に「委譲しすぎ」を扱う形で検討したい
- **`cohesion.ts` の ponytail(未使用フィールド・継承元のフィールドを凝集度に入れる)**: 採点ルールの変更で、`score.ts` 周り(`duplicate-code-scoring`・`inline-method-stage`)
  と時期が重なり、全ステージの点数の試算にも響く
- **抽出前に「選んだ処理の合計行数と、抽出後の元メソッドの行数」をメソッドエディタに出す**: 小さく有用だが、`MethodEditor.tsx` は `method-call-references` が変更予定
- **ドラッグ可能な要素の `aria-roledescription`(既定は英語の `draggable`)の日本語化**: 本件と同じ穴だが、`useDraggable` を呼ぶ `MethodChip.tsx`(`color-contrast-a11y`・
  `method-rename-keyboard`)・`ClassNode.tsx`(`class-dependency-focus`・`template-method-stage` の可能性)・`FieldChip.tsx` の3ファイルに差分が出る。
  本件の後回し候補にする(下のスコープを参照)
- **React Flow の `ariaLabelConfig`(ズームボタン等の英語ラベル)の日本語化**: React Flow 12 の比較的新しい機能で、`CodebaseCanvas.tsx`・`CodebasePreviewCanvas.tsx` の両方の
  `ReactFlow` の props に触る。`class-dependency-focus` が `ReactFlow` の props にハンドラを足す予定で、同じ要素の属性行が隣り合う。本件のマージ後、または別件で

## 関連する既存コード

- `src/presentation/canvas/CodebaseCanvas.tsx` — **変更先(数行の想定)**。150〜157行目の `<DndContext sensors … onDragStart … onDragEnd … onDragCancel>` に
  `accessibility` を渡す。`useDropHandler`(100〜123行目)と `dropTargetFileId`(55〜58行目)が、置いた場所ごとの実際の振る舞い(文言をそろえる元)
- `src/presentation/canvas/dndIds.ts` — `parseMethodDragId` / `parseFieldDragId` / `parseClassDragId` / `parseClassDropId` / `parseFileDropId`。内部IDから種類とIDを取り出す既存の関数(**読むだけ**)
- `src/domain/codebase/Codebase.ts` — `findMethod` / `findClass` / `findField` / `findFileOfClass` / `findClassOfMethod`。名前の引き当て(**読むだけ**)
- `src/presentation/canvas/MethodChip.tsx`(53・92〜93行目)・`FieldChip.tsx`(21行目)・`ClassNode.tsx`(88〜107行目) — `useDraggable` の `attributes`(`aria-describedby` で説明文に結び付く)を
  展開している所。**変更不要の見込み**(説明文と読み上げは `DndContext` 側だけで差し替わる)
- `src/presentation/canvas/layoutCodebase.test.ts` — presentation 層の純粋関数を Vitest で守っている前例。文言を組み立てる純粋関数を切り出すなら同じ形でテストを先に書ける
- `src/presentation/blank/BlankDesignView.tsx`・`src/presentation/change/ChangeRequestPanel.tsx` — 同じ `CodebaseCanvas` を使う(自動で効く。**読むだけ**)
- `docs/specs/move-via-context-menu.md` 10〜12行目 — 「スクリーンリーダーからは候補も分からない」と書いた経緯
- `docs/pipeline/operation-guide/02-draft-spec.md` 173〜180行目 — `KeyboardSensor` の操作をガイドに書く案
- `e2e/refactor.spec.ts` — キーボード操作のE2Eの前例(1490行目付近の Tab/Enter など)。本件のE2Eは新しい spec ファイルに置けば競合しない

## スコープの見立て

小さい。1回のPRに十分収まる。presentation 層の新しい純粋関数1ファイル(+そのVitest)と、`CodebaseCanvas.tsx` の数行、E2E 1〜2本が中心。
domain / application / infrastructure・ストア・ステージデータ・CSS は変更しない見込み。

1. **今回やる**:
   - `DndContext` の `screenReaderInstructions` を日本語にする(Space/Enter で掴む・矢印キーで動かす・Space/Enter で置く・Esc で取り消す)
   - `announcements`(掴んだ・上に来た・どこにも乗っていない・置いた・取り消した)を日本語にし、内部IDの代わりに
     「メソッド `OrderService.calculateTax()`」「クラス `TaxCalculator`」「ファイル `tax.ts`」のような**名前**で伝える。
     余白で置いたときは「新しいクラス(ファイル)を作って移す」ことが分かる文にする
   - 文言を組み立てる部分は `codebase` と dnd-kit の `active.id` / `over.id` を受け取る純粋関数にし、Vitest でテストを先に書く(TDD)
   - E2E: チップにフォーカス → Space で掴む → dnd-kit の読み上げ用の領域(`aria-live`)にメソッド名入りの日本語が出る → Esc で取り消すと取り消しの文が出る、を確かめる
2. **後回し**:
   - `aria-roledescription` の日本語化(上の見送り候補。`MethodChip.tsx`・`ClassNode.tsx`・`FieldChip.tsx` の衝突が解けてから)
   - React Flow の `ariaLabelConfig`(ズームボタン・ノードの説明)の日本語化
   - 置いた**結果**(成功・失敗の理由)の読み上げ: 失敗時は既存の `role="alert"` のメッセージ(`MethodEditor.tsx`・`ChangeRequestPanel.tsx`)が読まれるので、今回は足さない見込み

仕様設計者に決めてほしい論点(ここでは決めない):

- **文言の粒度**: 名前は `クラス名.メソッド名()` まで出すか、メソッド名だけか。移動先はクラス名だけか、ファイルのパスも添えるか。フィールドは `クラス名.フィールド名` でよいか
- **「上に来たとき」の文で結果まで言うか**: 「`TaxCalculator` の上。ここで置くと Move Method します」まで言うか、場所だけにするか。
  自分のクラスの上(`same-class` で何もしない)・フィールドをファイルの枠や余白に置いたとき(何もしない。`CodebaseCanvas.tsx` 114行目)をどう伝えるか
- **クラスのドラッグで、クラスの上に来たとき**: 実際には「そのクラスがあるファイルへ移す」(`dropTargetFileId`)ので、クラス名とファイル名のどちらで伝えるか
- **説明文に右クリックメニュー(Shift+F10)・F2 を書き足すか**: 書けば道が分かるが長くなる。`method-rename-keyboard` の02は「`aria-keyshortcuts` で足りる」としている
- **文言の置き場所**: 純粋関数を `src/presentation/canvas/` の新しいファイル(例: `dragAnnouncements.ts`)に置く想定でよいか。
  `CodebaseCanvas` 本体は約60行で lint の「1関数60行」に近い(`class-dependency-focus` の02も同じ理由でフックを切り出す予定)。
  本体に足すのは1〜2行(`accessibility` の受け渡し)にとどめ、`codebase` から `accessibility` を作る処理は新しいファイル側に置くのが安全
- **名前が引けないID**(ドラッグ中に Undo されて消えた等)のときの文言。例外は投げず、「メソッド」「クラス」など種類だけで読む、でよいか
- **E2E の確かめ方**: dnd-kit が描く読み上げ用の要素(`role="status"` + `aria-live`)と説明文の非表示テキストを、ID の接頭辞(`DndLiveRegion-` / `DndDescribedBy-`)で探すか、
  チップの `aria-describedby` をたどって探すか(実装の詳細に依存しにくい後者を推奨する見立て)

### 既存パイプラインとの衝突可能性

- **`src/presentation/canvas/CodebaseCanvas.tsx`**: `class-dependency-focus` の02が、同じファイル内にフック `useClassFocus` を**追加**し、
  `ReactFlow` にホバー・フォーカスのハンドラを渡し、`edges`(131行目)に `focusClassEdges` をかける予定。
  本件の差分は `<DndContext` の開きタグの props(150〜157行目)に1行と、本体のフック呼び出し1行、import 1行の想定。
  `ReactFlow` の props(158〜169行目)とは数行離れているが**近い**ので、行の位置が隣り合った場合はテキスト上の競合があり得る(小さい。どちらが先でも手で直せる規模)。
  `move-class-via-context-menu`・`operation-guide`・`method-rename-keyboard`(センサー設定を含め変更しない)・`implements-arrow-style`・`color-contrast-a11y` は「変更しない」と明記
- **意味上の衝突(本体の行数)**: `CodebaseCanvas` 本体は lint の「1関数60行」に近く、`class-dependency-focus` もこれを理由にフックを切り出す予定。
  本件も本体の増分を1〜2行にとどめれば、どちらが先にマージされても60行を超えない見込み(仕様設計で行数を確認してほしい)
- **`src/presentation/canvas/dndIds.ts`**: 24件のどのパイプラインも変更予定なし。本件も**読むだけ**の想定
- **新しいファイル(例: `src/presentation/canvas/dragAnnouncements.ts` と `.test.ts`)**: 新規なので競合なし
- **`e2e/`**: `refactor.spec.ts` は多くのパイプラインが追記するので、**新しい spec ファイル**(例: `e2e/drag-announcements.spec.ts`)に置けば競合なし
- **意味上の依存**:
  - `operation-guide` がキーボードでのドラッグ手順をガイドに書く場合、その手順と本件の説明文(`screenReaderInstructions`)の言い回しをそろえるとよい(どちらが先でも、後の件で合わせる)
  - `move-class-via-context-menu` がマージされたあと、説明文で右クリックメニューに触れるなら「クラスも移せる」と書ける。触れない選択なら影響なし
  - 新ステージ(`inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage`)には、同じ `CodebaseCanvas` を通るので自動で効く。
    E2E はどの件も題材を変えないチュートリアル2で確かめれば、マージ順に左右されない
- `src/domain/`・`src/application/`・`src/infrastructure/`(ステージ定義・`sampleAnswer.ts`・`stageCatalog.test.ts` を含む)・`useGameStore.ts`・`score.ts`・`describeScore.ts`・
  `StagePanel.tsx`・`MethodChip.tsx`・`FieldChip.tsx`・`ClassNode.tsx`・`FileNode.tsx`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`layoutCodebase.ts`・
  `CodebasePreviewCanvas.tsx`・`index.css`・`workers/critique/` には触らない想定
