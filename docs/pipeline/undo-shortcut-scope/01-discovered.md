# 01 機能探索: Ctrl+Z / Ctrl+Y が「効くべきときに効かず、効くべきでないときに効く」のを直す(ショートカットの効く範囲を正す)

- slug: `undo-shortcut-scope`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

CLAUDE.md の「手を抜かないもの: … アクセシビリティ(**キーボード操作を含む**)」に当たる穴として見つけた。
既存の仕様書が**事実として書き留めたまま直していない**制約でもある(`docs/specs/cohesion-value-object-anemic.md` 42行目
「13. **Ctrl+Z は選択欄(`select`)にフォーカスがあると効かない**」、`docs/pipeline/operation-guide/02-draft-spec.md` 154〜156行目
「ガイドを開いている間の Ctrl+Z の無効化 … 開いたまま押すと背後で1手戻る … 困る声が出たら `isEditingText` と同じ場所で足す」)。

### 既存テーマとの重複確認

- `docs/specs/` 24件と `docs/pipeline/*/01-discovered.md`・`02-draft-spec.md` を `useUndoRedoShortcut|isEditingText|Ctrl\+Z|Control\+z|ショートカット` でgrepした。
  `useUndoRedoShortcut.ts` を**変更する**予定の件は0件(`operation-guide` の02は「変更しない」ファイルの一覧に入れ、上の1件をスコープ外に回している。
  `render-error-fallback` の02は「代わりの表示の間は Ctrl+Z が効かない」と注記しているだけ)
- 近いものとの違い:
  - `operation-guide`: ショートカットの**一覧を見せる**。ショートカットの挙動は変えない(本件が直す「ダイアログの裏で1手戻る」をスコープ外として明記)
  - `method-rename-keyboard`(F2)・`method-select-keyboard`(メソッドを選ぶ選択欄)・`drag-announcements-ja`(キーボードでのドラッグの読み上げ):
    **新しいキー操作の入口**を足す件。既存の Ctrl+Z / Ctrl+Y の判定は触らない
  - `stage-rules-summary`・`method-select-keyboard` の01で見送られた「Undo の1手ごとに何を戻すか(ボタンに操作の説明を出す)」: 履歴に操作の説明を積む話で
    `history.ts`・`useGameStore.ts` に差分が出る。本件は**どの操作を戻すか**には触れず、**キーを押したときに戻すかどうかの判定**だけを直す
- 呼び出し元が列挙した30件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **新ステージ(Adapter で外部ライブラリを包む・レイヤー間の依存の向き・Facade・継承より委譲など)**: 題材の余地はあるが、過去の探索と同じく
  ステージ定義ファイル・`sampleAnswer.ts`・`stageCatalog.ts`/`.test.ts` が5件以上から触られる。レイヤー間の依存の向きは新しい採点ルールが要り、
  `score.ts`・`RULE_LABEL` にも `duplicate-code-scoring`・`inline-method-stage` が追記予定。Adapter は上級2(決済ゲートウェイのインターフェース)と操作の形が同じ
- **操作のたびにファイルの箱が別の層へ飛ぶ(`layoutCodebase.ts` が毎回トポロジカルソートで配置し直す)**: 依存が変わると箱の段が入れ替わるが、
  プレイヤーが動かした箱の位置は `useFlowOverrides` で保たれ、意図した「矢印が読みやすい並び」でもある。困る声がまだ無い(YAGNI)。
  `layoutCodebase.ts` は `class-dependency-focus`・`implements-arrow-style` が触る
- **失敗メッセージ(`message`)が操作した場所(キャンバス)から遠いサイドパネルの下端に出る**: 気づきにくいが、`useGameStore.ts`・`MethodEditor.tsx` の両方に差分が出て、
  `method-call-references`・`stage-draft-persistence`・`critique-request-robustness` と衝突する
- **フィールドの可視性の変更・Rename Field・フィールドを余白へ落として新しいクラス**: 過去の探索と同じ理由(仕様書が意図して作らないと決めている/`drag-announcements-ja` と意味上の衝突)
- **VSCode風ファイルツリー・ミニマップ・自己ベストの表示・ステージURL**: 過去の探索と同じ理由(1回のPRには大きい/困りごとが弱い/`StagePanel.tsx` の競合)

## 背景・目的

`src/presentation/useUndoRedoShortcut.ts` は document の `keydown` を見て、Ctrl(Mac は Cmd)+Z で `undo`、Ctrl+Y / Ctrl+Shift+Z で `redo` を呼ぶ。
ただし `isEditingText`(5〜7行目)が **`INPUT`・`TEXTAREA`・`SELECT` のすべて**を「文字の取り消しをブラウザに任せる場所」として扱っているため、次のずれがある。

1. **効くべきときに効かない**
   - メソッドエディタの**可視性の選択欄**(`MethodEditor.tsx` 148行目の `<select>`)で public / private を変えると、フォーカスは選択欄に残る。
     この操作はコードベースを変える1手(`changeVisibility` → `commit`)なのに、直後に Ctrl+Z を押しても**何も起きない**。
     `<select>` にはブラウザ標準の「文字の取り消し」が無いので、判定から外しても失うものが無い
   - 処理の**チェックボックス**(`MethodEditor.tsx` 74行目、`type="checkbox"` の `INPUT`)も同じ。抽出のあと、次の処理を選び始めてから
     「さっきの抽出を戻したい」と Ctrl+Z を押しても、黙って無視される。チェックボックスにも文字の取り消しは無い
   - 進行中の件で `<select>` がさらに増える(`method-select-keyboard` のメソッドを選ぶ選択欄、`blank-design-second-problem` の問題の選択欄)。
     キーボードだけで遊ぶプレイヤーほどフォーカスが選択欄に残りやすく、**Ctrl+Z が効いたり効かなかったりする**ように見える
2. **効くべきでないときに効く**
   - 「変更前の図」「解答例の図」(`CodebasePreviewDialog.tsx` の `<dialog>` を `showModal()`)を開いている間に Ctrl+Z を押すと、
     **モーダルの裏で自分の作業が1手戻る**。モーダルは読み取り専用の図を出しているので、何が戻ったのかは閉じるまで見えない。
     `operation-guide` が足すガイドのダイアログでも同じことが起きる(同件の02が困る声が出たら直すとして残した穴)

対象プレイヤー(新卒〜4年目)は、普段のエディタ・IDEで Ctrl+Z を「直前の1手を戻す」道具として体に覚えている。
リファクタリングの試行錯誤(移してみて、点数を見て、戻す)を気軽に回せることがこのゲームの学びの前提なので、
**「押したのに戻らない」「見えないところで戻った」をなくす**ことには、見た目より大きな価値がある。

ponytail の階段では「このリポジトリにもうあるか?」「ブラウザの標準機能でできるか?」で止まる見込み:

- 直すのは `isEditingText` 相当の判定1か所。**文字を打てる入力欄**(`type` が text 系の `INPUT`・`TEXTAREA`・`contentEditable`)だけをブラウザに任せ、
  チェックボックスなど文字を打たない `INPUT` と `SELECT` では Ctrl+Z / Ctrl+Y を効かせる。開いているモーダル(`target.closest('dialog[open]')` など、
  `operation-guide` の02が書いた案)の中では何もしない
- ストア(`undo`/`redo`)・履歴(`history.ts`)・domain / application は変更しない見込み。新しい依存も要らない

## 関連する既存コード

- `src/presentation/useUndoRedoShortcut.ts` — **変更の中心**。`isEditingText`(5〜7行目)と `keydown` の処理(14〜22行目)。
  `enabled` が false の間(設計くらべ中など)は何もしない、という既存の約束は保つ
- `src/presentation/App.tsx` 17行目・`src/presentation/blank/BlankDesignView.tsx` 21行目 — フックの呼び出し元(2か所)。**読むだけ**(呼び方は変えない見込み)
- `src/presentation/editor/MethodEditor.tsx` 74行目(処理のチェックボックス)・148行目(可視性の選択欄) — 1の実例。**読むだけ**
- `src/presentation/stage/StagePanel.tsx` 26行目(ステージの選択欄)・`src/presentation/quiz/ComparisonQuizView.tsx` 128行目(問題の選択欄) — ほかの `<select>`。**読むだけ**
  (ステージを切り替えると履歴は空になり、設計くらべ中はフック自体が無効なので、判定を変えても害は無い見込み。仕様設計で確かめる)
- `src/presentation/preview/CodebasePreviewDialog.tsx` 19・23行目 — `showModal()` の `<dialog>`。2の実例。**読むだけ**
- `src/presentation/canvas/CanvasContextMenu.tsx` — 右クリックメニューの中の名前の入力欄(文字を打つ `INPUT`)。今までどおりブラウザに任せる側。**読むだけ**
- `src/presentation/canvas/useInlineEdit.ts`・`InlineEditableLabel.tsx` — その場での名前の変更(文字を打つ `INPUT`)。同上。**読むだけ**
- `docs/specs/cohesion-value-object-anemic.md` 42行目 — 「選択欄では効かない」を制約として記録した箇所
- `docs/specs/design-comparison-quiz.md` 32行目・`docs/specs/blank-design-mode.md` 39・252行目 — フックの過去の変更(クイズ中は無効、白紙設計のストアへの付け替え)
- `docs/pipeline/operation-guide/02-draft-spec.md` 154〜156行目 — ダイアログの裏で1手戻る件を後回しにした記述(本件で拾う)
- `docs/auto-dev/IMPLEMENTATION_LOG.md` 117行目 — 「入力欄・選択欄にフォーカスがあるときはブラウザ標準に任せる」という元の実装方針
- `e2e/refactor.spec.ts` 697・724〜727・950〜959・1282・1318・1475行目、`e2e/blank.spec.ts` 134・141行目、`e2e/quiz.spec.ts` 96・109行目 —
  既存の Ctrl+Z / Ctrl+Y のE2E。**変えずにそのまま通る**ことを確かめる

## スコープの見立て

小さい。1回のPRに十分収まる。presentation 層のフック1ファイルの判定の修正、(判定を純粋関数に切り出すなら)そのユニットテスト、新しいE2Eの spec ファイル1本。

1. **今回やる**:
   - 文字を打てる入力欄にフォーカスがあるときだけブラウザ標準の取り消しに任せ、チェックボックス・選択欄では Ctrl+Z / Ctrl+Y で1手戻す・進める
   - 開いているモーダルダイアログの中では Ctrl+Z / Ctrl+Y で作業を戻さない
   - E2E(新しい spec ファイル。例 `e2e/undo-shortcut.spec.ts`): 可視性を選択欄で変えた直後に Ctrl+Z で元の可視性に戻る/処理のチェックボックスにフォーカスがあっても直前の抽出を Ctrl+Z で戻せる/
     「変更前の図」を開いたまま Ctrl+Z を押しても作業が戻らない、程度。既存のE2Eがそのまま通ること
2. **後回し**:
   - キーボードでのドラッグ中(dnd-kit の `KeyboardSensor` で掴んでいる間)に Ctrl+Z を押したときの扱い。掴んでいるメソッドが消えうるが、落としても
     既存の操作が「見つからない」で失敗するだけでデータは壊れない。`drag-announcements-ja` がドラッグ中の読み上げを決めたあとに見る
   - ボタンの `title="Ctrl+Z"` を Mac で「⌘Z」と出し分ける・`aria-keyshortcuts` を付ける(`operation-guide` の一覧と文言を揃えたいので、あちらのマージ後)
   - 右クリックメニューを開いている間の Ctrl+Z(メニューの中身はストアから作り直されるので、今のところ実害が見えない)

仕様設計者に決めてほしい論点(ここでは決めない):

- **「文字を打てる入力欄」の線引き**: `INPUT` の `type` で見るか(text・search・url・email・number など/checkbox・radio・button などを除く)、
  `HTMLInputElement` の `selectionStart` が使えるかで見るか。今の画面にある `INPUT` は text 系とチェックボックスだけなので、どこまで一般化するか
- **`SELECT` の扱い**: 全部の選択欄で効かせてよいか。ステージの選択欄(切り替えると履歴が空)・設計くらべの問題の選択欄(フック無効)で副作用が無いことの確認
- **モーダルの判定**: `target.closest('dialog[open]')` で見るか、`document.querySelector('dialog[open]')`(フォーカスがダイアログの外に出ている場合も含む)で見るか。
  `operation-guide` のダイアログが `<dialog>` になるかどうか(ならない場合の判定)
- **テストの形**: 判定を `KeyboardEvent`/`EventTarget` から真偽を返す純粋関数に切り出し、Vitest(`environment: 'jsdom'`)で要素を作って確かめるか。
  presentation 層なのでカバレッジの閾値の対象外だが、判定の場合分けが増えるのでユニットテストがあると安心(TDD で先に書くか)
- **`docs/specs/cohesion-value-object-anemic.md` 42行目の記述**: 直ったあとに注記を足すか(仕様書は過去の記録として残すか)

### 既存パイプラインとの衝突可能性

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 衝突の見立て |
|---|---|---|---|
| `src/presentation/useUndoRedoShortcut.ts` | 判定の修正(数行〜十数行) | **なし**(`operation-guide` の02は「変更しない」と明記、`render-error-fallback` の02は注記のみ) | なし |
| 新規(判定の純粋関数を切り出す場合のファイルと `.test.ts`) | 判定とユニットテスト | なし | なし |
| 新規 `e2e/<名前>.spec.ts` | E2E | なし | なし(`refactor.spec.ts` には追記しない) |
| `docs/specs/cohesion-value-object-anemic.md` ※ 注記を足す場合のみ | 1〜2行 | なし | なし |

- **読むだけで変更しないファイル**: `App.tsx`・`BlankDesignView.tsx`・`MethodEditor.tsx`・`StagePanel.tsx`・`ComparisonQuizView.tsx`・`CodebasePreviewDialog.tsx`・
  `CanvasContextMenu.tsx`・`useInlineEdit.ts`・`InlineEditableLabel.tsx`・`useGameStore.ts`・`history.ts`
- **触らないファイル**: `src/domain/`・`src/application/`・`src/infrastructure/`(ステージ定義・`sampleAnswer.ts`・`stageCatalog.ts`/`.test.ts` を含む)・`score.ts`・`describeScore.ts`・
  `CodebaseCanvas.tsx`・`ClassNode.tsx`・`MethodChip.tsx`・`FileNode.tsx`・`layoutCodebase.ts`・`index.css`・`e2e/refactor.spec.ts`・`e2e/blank.spec.ts`・`e2e/quiz.spec.ts`・`workers/critique/`
- **意味上の依存**(テキストの競合ではなく、中身が影響し合うもの):
  - `operation-guide`: ガイドのダイアログを開いている間の Ctrl+Z を、本件のモーダルの判定がそのまま止める(ガイドが `<dialog>` なら追加の変更なし)。
    ガイドの一覧に「選択欄・チェックボックスにフォーカスがあっても効く」と書くかは、あちらの文言の問題(どちらが先でも動く)
  - `method-select-keyboard`・`blank-design-second-problem`: 新しい `<select>` を足す。本件のマージ後は、そこにフォーカスが残っていても Ctrl+Z が効く
  - `method-rename-keyboard`・`identifier-name-validation`: 名前の入力欄(文字を打つ `INPUT`)は今までどおりブラウザの取り消しに任せる側なので影響なし
  - `drag-announcements-ja`: キーボードでのドラッグ中の Ctrl+Z は本件の後回し。あちらの読み上げ(「名前が引けないID」の扱い)と合わせて決める
  - `render-error-fallback`: 代わりの表示の間はフックごとアンマウントされるので、本件の判定とは関係しない
  - `stage-draft-persistence`: 取り消しの挙動(`undo`/`redo`)そのものは変えないので、保存・復元とは関係しない
