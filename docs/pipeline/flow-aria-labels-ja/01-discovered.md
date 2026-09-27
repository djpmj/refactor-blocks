# 01 機能探索: キャンバスの React Flow 標準の読み上げ・ボタン名(Zoom In / Fit View など)を日本語にし、実際の操作と合わない説明を直す

- slug: `flow-aria-labels-ja`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

CLAUDE.md の「手を抜かないもの: … アクセシビリティ(キーボード操作を含む)」に当たる穴として見つけた。
`drag-announcements-ja` の01・02が「後回し」「スコープ外」に挙げた **React Flow の `ariaLabelConfig` の日本語化**を、独立した1件として拾ったもの
(`drag-announcements-ja/01-discovered.md` 64〜65・95行目、`drag-announcements-ja/02-draft-spec.md` 202行目)。

### 既存テーマとの重複確認

- `drag-announcements-ja`: dnd-kit の `DndContext` の `accessibility`(メソッド・フィールド・クラスを**掴んで運ぶ**ときの説明文と読み上げ)。
  React Flow 側の文言(ズームのボタン・ノード/矢印にフォーカスしたときの説明・ファイルの箱を矢印キーで動かしたときの読み上げ)は**スコープ外と明記**している → 重ならない。
  両方がそろうと、キャンバスの読み上げが全部日本語になる(補い合う関係)
- `operation-guide`: 操作の**一覧**を見せるガイド。React Flow の文言は変えない
- `color-contrast-a11y`: 文字色のコントラストと「行数オーバー」の文字化。読み上げの文言・ボタン名は扱わない
- `method-rename-keyboard`: F2 での名前の変更。React Flow のノードの説明文は扱わない
- `class-dependency-focus`: ノードへのホバー・フォーカスで矢印を強調する。ノードの説明文(`aria-describedby`)は変えない
- `implements-arrow-style`: 矢印の見た目。01で辺の `ariaLabel` を論点に挙げているが、React Flow 全体の既定文言(`edge.a11yDescription`)の置き換えではない。
  辺ごとの `ariaLabel` を足すかどうかは向こうの判断で、本件は既定の説明文だけを扱う(下の意味上の依存を参照)
- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 26件を `ariaLabelConfig|a11yDescription|Zoom In|Zoom Out|Fit View|ズームボタン` でgrepし、
  主題にしたものは無い(`drag-announcements-ja` の見送り欄に名前が出ているだけ)。呼び出し元が列挙した26件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **新ステージ(Middle Man を外す・Push Down Method / 継承より委譲・Facade・Mediator など)**: チュートリアル2・初級2・中級8・上級7の計19ステージに対し、
  すでに4件(`template-method-stage`・`inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`)が並走し、`sampleAnswer.ts`・ステージ定義ファイル・
  `stageCatalog.test.ts` への同時追記がさらに増える。Facade・Mediator は依存がまとめ役へ移るだけで `dependencyLimit` の減点がそちらへ移り、今の採点では改善が点数に出にくい。
  Push Down / 継承より委譲は新しい採点ルールが要り、`score.ts` は `duplicate-code-scoring`・`inline-method-stage` が追記予定。Middle Man は `law-of-demeter-stage`(Hide Delegate)のマージ後に「委譲しすぎ」として扱うのが自然
- **フィールドを余白へ落として新しいクラスを作る(`CodebaseCanvas.tsx` 114行目の ponytail)**: `drag-announcements-ja` の02が
  「フィールドを余白に置いても移動しません」という読み上げと、そのテスト(02の8番)を決めているため、今やると**意味上の衝突**になる。
  `moveToNewHome.ts`・`RefactorUseCases.ts`(`identifier-name-validation`)、`useGameStore.ts`(多数)にも同時に差分が出る。`drag-announcements-ja` のマージ後の候補
- **Slide Statements(処理の並べ替え)**: `extractMethod.ts` は離れた処理をまとめて選んで抽出できる(連続している必要がない)ので、並べ替えが前提の手にならず、動機が弱い
- **ステージをクリアしたら「このステージで使ったリファクタリング手法」を見せる**: 模範解答の手の種類から導けるので題材データは要らないが、表示先が `StagePanel.tsx` で、
  `score-deduction-locations`・`stage-rules-summary`・`codebase-code-view` の3件が同じファイルに差分を出す予定。学びの中身は魅力的なので、それらのマージ後の候補
- **`measurePlacement.ts` の「呼ばれていない既存クラスに置く抜け道」(ponytail)**: `extend` の依頼が上級2の1件しか無く実害が小さい(`method-rename-keyboard` の01と同じ判断)
- **ミニマップ(React Flow の `MiniMap`)**: 標準部品1つで足りるが、上級でも10ファイル前後で `fitView` と「Fit View」ボタンで見渡せており、困りごとが見当たらない(YAGNI)

## 背景・目的

キャンバス(`CodebaseCanvas.tsx`)と読み取り専用の図(`CodebasePreviewCanvas.tsx`。「変更前の図」「解答例の図」・設計くらべ)は、どちらも React Flow の
`ReactFlow` と `Controls` を**既定の英語の文言のまま**使っている。`index.html` は `lang="ja"` で、画面の文字はすべて日本語なのに、次の文言だけが英語で残る。

| どこに出るか | 今(React Flow 12 の既定。node_modules 未インストールのため**記憶ベース**。実物は仕様設計で要確認) |
| --- | --- |
| 左下のズームのボタン(`aria-label` とマウスを乗せたときの `title`) | `Zoom In` / `Zoom Out` / `Fit View`、ボタンの並びの名前 `Control Panel` |
| ファイルの箱・クラスのノードに Tab でフォーカスしたときの説明(`aria-describedby`) | `Press enter or space to select a node. (You can then use the arrow keys to move the node around.) Press delete to remove it and escape to cancel.` |
| 矢印(依存・継承)にフォーカスしたときの説明 | `Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.` |
| 選んだファイルの箱を矢印キーで動かしたときの読み上げ(`aria-live`) | `Moved selected node up. New position, x: …, y: …` |

- 目が見える人にとっても、ズームのボタンにマウスを乗せると英語の `title`(`zoom in` など)が出る。日本語の画面の中で、そこだけ英語になっている
- スクリーンリーダーの利用者には、英文が日本語の音声で読まれる。さらに**説明の中身が今のゲームの動きと合っていない**:
  - 「delete で消せる」と読まれるが、このゲームではノードも矢印も Delete/Backspace では消えない(`CodebaseCanvas.tsx` の `useFlowOverrides` は
    `position`・`dimensions` の変更だけを反映し、`remove` は無視する。ノードはストアから毎回作り直す)。クラスの削除は右クリックメニューの操作
  - 「矢印キーで動かせる」は、動かせるのは**ファイルの箱だけ**(クラスのノードは `draggable: false`、`arrangeNodes`)。読み取り専用の図は `nodesDraggable={false}`
- `drag-announcements-ja` で dnd-kit 側(掴んで運ぶ操作)の読み上げを日本語にしても、ノード・矢印・ズームの文言が英語のままだと、同じキャンバスの中で日本語と英語が混ざる

ponytail の階段では「React Flow/dnd-kit の標準機能でできるか?」で止まる見込み: React Flow 12(`package.json` は `^12.11.5`)の
`ReactFlow` の `ariaLabelConfig` プロパティ(12.8 で追加された記憶。要確認)に、日本語の文言を渡すだけ。新しい依存・domain・application・ストア・ステージデータの変更は要らない。
2つのキャンバスで同じ文言を使うので、定数を1か所(presentation 層の小さなファイル)に置いて両方から渡す形が最小になる見込み。

## 関連する既存コード

- `src/presentation/canvas/CodebaseCanvas.tsx` 158〜173行目 — リファクタリング画面・白紙設計・変更依頼の実装中が共通で使う `ReactFlow` と `<Controls showInteractive={false} />`。
  **変更先(props に1行 + import 1行の想定)**。`useFlowOverrides`(85〜97行目)と `arrangeNodes`(73〜79行目)が「ファイルの箱だけ動く・削除は無視」の根拠
- `src/presentation/preview/CodebasePreviewCanvas.tsx` 25〜39行目 — 読み取り専用の図の `ReactFlow` と `Controls`。**変更先(props に1行 + import 1行の想定)**。
  `nodesDraggable={false}` なので、ノードの説明文は「動かせる」を言わない方が正しい(2つのキャンバスで説明文を変えるかは論点)
- `index.html` — `lang="ja"`(読むだけ)
- `e2e/refactor.spec.ts` 230・240・1102・1167・1262・1375行目 — `getByRole('button', { name: 'Zoom In' | 'Zoom Out' | 'Fit View' })` でズームのボタンを押している。
  **ボタン名を日本語にすると、この6か所の書き換えが必要**(74行目のコメントも `Fit View` に触れている)
- `docs/pipeline/drag-announcements-ja/02-draft-spec.md` — dnd-kit 側の日本語の言い回し(「スペースキーかEnterキーで…」)。本件の説明文と言い回しをそろえる元
- `docs/pipeline/operation-guide/02-draft-spec.md` — 操作ガイドの表。ズームのボタン・矢印キーでファイルの箱を動かす操作の呼び方をそろえる元
- `src/presentation/canvas/semanticZoom.ts` — ズーム倍率 0.6 未満でメソッドを隠す(読むだけ。ズームのボタンが何に効くかの説明を書くときの参考)

## スコープの見立て

小さい。1回のPRに十分収まる。新しい定数ファイル1つ、2つのキャンバスの `ReactFlow` の props に1行ずつ、既存E2Eのボタン名の書き換え6か所、E2E 1〜2本(新しい spec ファイル)。
domain / application / infrastructure・ストア・ステージデータ・採点・CSS は変更しない見込み。

1. **今回やる**:
   - ズームのボタン(拡大・縮小・全体を表示)とボタンの並びの名前を日本語にする(`aria-label`・`title` の両方に効く想定)
   - ノード・矢印にフォーカスしたときの説明文を日本語にし、**このゲームで実際にできることだけ**を書く(「Delete で消せる」を言わない。動かせるのはファイルの箱だけ)
   - ファイルの箱を矢印キーで動かしたときの読み上げを日本語にする
   - リファクタリング画面のキャンバスと、読み取り専用の図(変更前の図・解答例の図・設計くらべ)の両方に効かせる
   - 既存E2E(`e2e/refactor.spec.ts`)のボタン名を新しい名前に書き換える。新しい spec ファイルで、ボタンが日本語の名前で引けること・
     ノードの説明文(`aria-describedby` の先)が日本語で「削除」に触れないことを確かめる
2. **後回し**:
   - dnd-kit の `aria-roledescription`(既定の `draggable`)の日本語化(`drag-announcements-ja` の後回し欄。`MethodChip.tsx`・`ClassNode.tsx`・`FieldChip.tsx` に差分が出る)
   - 矢印ごとの `ariaLabel`(「OrderService → TaxCalculator への依存」など)。`implements-arrow-style`・`class-dependency-focus` の結果を見てから
   - 矢印・読み取り専用の図のノードをそもそも Tab で止まらせるか(`edgesFocusable`・`nodesFocusable`)の見直し。止まらせると説明文が要るが、止めないと
     `class-dependency-focus` のフォーカスでの強調が効かなくなる可能性がある。今回は文言だけにとどめる

仕様設計者に決めてほしい論点(ここでは決めない):

- **`ariaLabelConfig` のキーと既定の文言の確認**: 12.11 で実際にどのキーがあり(`controls.zoomIn.ariaLabel`・`node.a11yDescription.default`・
  `node.a11yDescription.keyboardDisabled`・`node.a11yDescription.ariaLiveMessage`・`edge.a11yDescription.default` など、記憶ベース)、
  どちらのノードの説明がどの条件で使われるか。`ariaLiveMessage` のような関数のキーの型。`node_modules` を入れて型定義を確かめてから決めてほしい
- **ボタン名**: 「拡大」「縮小」「全体を表示」か、「ズームイン」「ズームアウト」「全体表示」か。E2Eの書き換え先になる
- **ノードの説明文を2つのキャンバスで分けるか**: リファクタリング画面(ファイルの箱は矢印キーで動く・クラスは右クリックメニュー/Shift+F10 や Space で掴める)と、
  読み取り専用の図(見るだけ)で、同じ文言にするか別にするか。ファイルの箱とクラスのノードで説明を分けられるか(React Flow 全体で1つの設定なら分けられない)
- **説明文に何を書くか**: 「Enter/Space で選ぶ」「矢印キーでファイルの箱を動かす」だけにするか、Shift+F10(右クリックメニュー)まで書き足すか。
  `drag-announcements-ja` の説明文・`operation-guide` の表との言い回しのそろえ方
- **矢印キーで動かしたときの読み上げ**: 座標(x, y)をそのまま読むか、「上へ動かしました」だけにするか(座標はプレイヤーには意味が薄い)
- **定数の置き場所**: 例 `src/presentation/canvas/flowAriaLabels.ts`。表示用の定数だけならユニットテストは任意で、E2Eで守る形でよいか
- **E2Eの確かめ方**: ボタンは `getByRole('button', { name: … })`、説明文はノードの `aria-describedby` をたどって確かめる(実装の詳細に依存しにくい)想定でよいか

### 既存パイプラインとの衝突可能性

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 衝突の見立て |
|---|---|---|---|
| 新規 `src/presentation/canvas/<名前>.ts` | 日本語の文言の定数 | なし | なし |
| `src/presentation/canvas/CodebaseCanvas.tsx` | `ReactFlow` の props に1行、import 1行 | `class-dependency-focus`(同じ `ReactFlow` の props にホバー・フォーカスのハンドラを足し、フック `useClassFocus` を追加)、`drag-announcements-ja`(`DndContext` の props に1行・import 1行) | **テキスト上の競合はありうる(小さい)**。`ReactFlow` の props の行が隣り合う・import 行が隣り合う程度で、どちらが先でも手で直せる。`minZoom` の直後など、相手が足しそうな `on…` ハンドラの並び(`onPaneContextMenu` の後ろ)から離した位置に置けばさらに減る。本体の増分は1行なので lint の「1関数60行」への影響も小さい(`class-dependency-focus` はそのためにフックを切り出す予定) |
| `src/presentation/preview/CodebasePreviewCanvas.tsx` | `ReactFlow` の props に1行、import 1行 | `quiz-change-site-marks`(props の型に `changeSites?` を足し、Provider の value に載せる。13〜24行目) | 差分の位置が離れている(本件は25〜36行目の `ReactFlow` の props)。import 行の隣り合いだけありうる(小さい) |
| `e2e/refactor.spec.ts` | 230・240・1102・1167・1262・1375行目のボタン名の書き換え(+74行目のコメント) | 多数(ほぼすべての件が末尾に追記) | 追記とは位置が違うのでテキスト上の競合は小さい。**ただし意味上の衝突に注意**: 本件のマージ前に実装された他件が、新しいE2Eで `'Zoom In'` などの英語のボタン名を使うと、本件のマージ後にそのE2Eが落ちる。仕様設計で、E2Eのズーム操作を小さなヘルパー(例: `zoomIn(page)`)に寄せるか、マージ順を後ろにするかを決めてほしい |
| 新規 `e2e/<名前>.spec.ts` | 本件のE2E | なし | なし |

- **読むだけで変更しないファイル**: `index.html`・`semanticZoom.ts`・`layoutCodebase.ts`・`useGameStore.ts`
- **触らないファイル**: `src/domain/`・`src/application/`・`src/infrastructure/`(ステージ定義・`sampleAnswer.ts`・`stageCatalog.test.ts` を含む)・`score.ts`・`StagePanel.tsx`・
  `ClassNode.tsx`・`FileNode.tsx`・`MethodChip.tsx`・`FieldChip.tsx`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`ComparisonQuizView.tsx`・`App.tsx`・`index.css`・`workers/critique/`
- **意味上の依存**(テキストの競合ではなく、中身が影響し合うもの):
  - `drag-announcements-ja`: 同じキャンバスの読み上げ。キーの呼び方(「スペースキーかEnterキー」など)をそろえるとよい(どちらが先でも、後の件で合わせる)
  - `operation-guide`: ガイドの表にズームのボタン名や矢印キーでファイルの箱を動かす操作を書く場合、本件のボタン名とそろえる
  - `class-dependency-focus`: ノードへのフォーカスで矢印を強調する。本件は説明文を変えるだけでフォーカスの可否(`nodesFocusable`)は変えないので、向こうの動作は変わらない
  - `implements-arrow-style`: 辺ごとの `ariaLabel` を足す場合、本件の `edge.a11yDescription`(既定の説明文)と役割が重ならないよう、辺の名前(何から何への矢印か)と操作の説明(何ができるか)で分ける
  - 新ステージ(`inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage`)は同じキャンバスを通るので自動で効く。
    本件のE2Eはどの件も題材を変えないチュートリアル2で確かめれば、マージ順に左右されない
