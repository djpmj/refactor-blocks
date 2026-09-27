# 仕様草案: メソッド名の変更をキーボードだけで始められるようにする(F2)

- slug: `method-rename-keyboard`
- 元になった探索: `docs/pipeline/method-rename-keyboard/01-discovered.md`
- 先送りの経緯: `docs/specs/inline-edit-and-hover-submenu.md` の「スコープ外」

## 1. 背景・目的

- ファイルのパス・クラス名は「ダブルクリック」と「Shift+F10 → 名前の変更フォーム」の2つの入口があるが、メソッド名は
  ダブルクリック(`MethodChip.tsx` の `onDoubleClick` → `startEditing()`)しかない。メソッドチップは Tab でフォーカスでき、
  移動(Shift+F10)・ドラッグ(dnd-kit の `KeyboardSensor`)はキーボードで操作できるのに、**名前の変更だけがキーボードで届かない**。
- CLAUDE.md の ponytail は、アクセシビリティ(キーボード操作を含む)を「手を抜かないもの」にしている。
- メソッドの名前を付け直すのは Extract / Merge / Move Method のあとの自然な仕上げ(`suggestMethodName` の候補名を直すなど)で、
  「分けたら名前で意図を示す」はメソッド分けの学びの一部。F2 は VSCode など主要IDEの「名前の変更」キーで、実務の習慣と一致する。

**新しい仕組みが要るか**: 要らない。その場編集の状態管理(`useInlineEdit`)・失敗したら入力欄に留まる挙動・ストアの
`renameMethod`(`apply` 経由なので Undo・エラー表示もそのまま効く)はすべてある。足すのは次の2つだけ。

1. フォーカス中のメソッドチップで F2 を押すと `startEditing()` を呼ぶ入口
2. Enter / Escape で編集を終えたとき、フォーカスをそのチップへ戻す仕組み(今は input が消えて `body` に落ちる)

右クリックメニュー(`CanvasContextMenu.tsx`)は触らない(`move-class-via-context-menu` が `menuItemsFor` を書き換え中のため)。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/canvas/MethodChip.tsx` | presentation | `<button>` に F2 の入口(`onKeyDownCapture`)と `aria-keyshortcuts="F2"` を足す。ボタンの ref を dnd-kit の `setNodeRef` と合成し、`useInlineEdit` へフォーカスの戻り先として渡す |
| 変更 | `src/presentation/canvas/useInlineEdit.ts` | presentation | 任意の第3引数 `returnFocusRef` を足す。Enter / Escape で編集が終わったとき(確定に成功・取り消し)だけ、そこへフォーカスを戻す |
| 新規 | `e2e/method-rename-keyboard.spec.ts` | (E2E) | キーボードだけでの名前の変更を守るテスト(置き場所は未決事項3) |

変更しないもの: domain / application / infrastructure の全ファイル、`useGameStore.ts`、`CanvasContextMenu.tsx`、
`InlineEditableLabel.tsx`・`ClassNode.tsx`・`FileNode.tsx`(第3引数は任意なので呼び出し側の変更は不要)、`CodebaseCanvas.tsx`(センサー設定)、`index.css`。

## 3. データ/型の変更

ドメインモデル・永続化スキーマの変更は無し。presentation 層のフックのシグネチャだけ、後方互換で広げる。

```ts
// src/presentation/canvas/useInlineEdit.ts
export function useInlineEdit(
  value: string,
  onSubmit: (next: string) => boolean,
  /** Enter/Escapeで編集を終えたときにフォーカスを戻す先。省略時は戻さない(今までどおり)。 */
  returnFocusRef?: RefObject<HTMLElement | null>,
): InlineEdit;
```

`InlineEdit` / `InlineEditInputProps` の型は変えない。

### 3.1 F2 の入口(`MethodChip.tsx`)

- `<button>` に **`onKeyDownCapture`** を付ける。`{...listeners}` が展開する `onKeyDown`(dnd-kit の `KeyboardSensor` の起動)とは
  別のプロパティなので上書きし合わない。dnd-kit のハンドラーを自前で呼び直す合成は**しない**
  (`listeners` の型は `Record<string, Function>` で、呼ぶと型チェック付きlintの `no-unsafe-call` に当たるため)。
- 処理: `event.key === 'F2' && !isDragging` のときだけ `event.preventDefault()`・`event.stopPropagation()`・`startEditing()`。
  それ以外のキーは何もしない(そのまま dnd-kit の `onKeyDown` へ届く)。
- `isDragging` の間(Space/Enter でキーボードドラッグ中)は無視する。掴んでいる最中にボタンを入力欄へ差し替えると、
  dnd-kit のアクティブなノードが消えるため。
- 開始キーは **F2 のみ**。Enter / Space は `KeyboardSensor` の「掴む・置く」、Escape は「取り消し」に使われており、
  F2 はどれとも重ならない。React Flow のノードのキー操作(矢印キー・Delete など)とも重ならない。
- `aria-keyshortcuts="F2"` を付ける(未決事項2)。
- ダブルクリックの入口(`onDoubleClick`)は今のまま残す。

### 3.2 フォーカスの戻り先(`MethodChip.tsx`)

- `const buttonRef = useRef<HTMLButtonElement>(null)` を持ち、`<button ref>` は dnd-kit の `setNodeRef` と合成する
  (`useCallback` で `(node) => { setNodeRef(node); buttonRef.current = node; }`。毎レンダーで ref が付け外しされないように)。
- `useInlineEdit(method.name, (name) => renameMethod(method.id, name), buttonRef)` と渡す。
- 編集中は `<div>` + `<input>` に差し替わり `<button>` はアンマウントされるが、編集を終えた次のレンダーで新しい `<button>` が
  付いてから `useEffect` が走るので、`buttonRef.current` はその新しいボタンを指す。名前が変わっても `key={method.id}` なので同じインスタンス。

### 3.3 フォーカスを戻す条件(`useInlineEdit.ts`)

内部に `finishedByKeyRef = useRef(false)` を持ち、次のように扱う(未決事項1で選択肢Aの場合)。

| 操作 | `finishedByKeyRef` | 結果 |
| --- | --- | --- |
| 入力欄で Enter | `true` にしてから `blur()` | 確定成功 → `editing: false` → 戻す |
| 確定に失敗(空欄・重複・書き方の違反) | `false` に戻す | 入力欄に留まる(今どおり `inputRef.current?.focus()`)。戻さない |
| 入力欄で Escape | `true` | 取り消し → `editing: false` → 戻す |
| クリック・Tab で入力欄から離れる(blur で確定) | `false` のまま | 確定成功しても戻さない(プレイヤーが選んだ先のフォーカスを奪わない) |

- `useEffect(() => { if (editing || !finishedByKeyRef.current) return; finishedByKeyRef.current = false; returnFocusRef?.current?.focus(); }, [editing, returnFocusRef])`
  の形で、`editing` が `false` になったあとに戻す。
- F2 で始めたかダブルクリックで始めたかは区別しない(ダブルクリック後に Enter で確定したマウス利用者にも害は無く、状態が1つ減る)。
- `startEditing()` では `canceledRef` と `finishedByKeyRef` を `false` に戻す。Escape で入力欄が消えるとき、ブラウザによっては
  `blur` が発火せず `canceledRef` が `true` のまま残り、**次の編集の最初の確定が無視される**おそれがあるため。
  F2 → Escape → F2 → Enter をキーボードで続けるとこの経路を必ず通るので、E2E(受け入れ基準の4)で確認する。
- 失敗理由は今どおり `state.message`(`role="alert"`)に出る。alert はライブリージョンなので、入力欄にフォーカスがあっても
  スクリーンリーダーで読み上げられる。文言・表示場所は変えない。

## 4. TDD対象の純粋関数

**無し。** domain / application 層に新しいロジックは足さない(`renameMethod` のドメイン関数・ユースケースは既存でテスト済み)。
変更は presentation 層のキー入力とフォーカスの扱いだけで、CLAUDE.md の方針どおりユニットテストの対象外とし、
プレイヤーの操作なので **Playwright の E2E で守る**。カバレッジ閾値(`domain`/`application`)にも影響しない。

## 5. 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る。`as`・非nullアサーション・`listeners` の直接呼び出しを使っていない
- 既存の E2E(`refactor.spec.ts` のダブルクリックでの名前の変更・移動メニューのフォーカス復帰、`blank.spec.ts` ほか)がすべて通る
- 新しい E2E(チュートリアル2 `openOrderStage` 相当で、`method-placeOrder` を使う)で次を確認する。すべて `// Arrange` `// Act` `// Assert` を明示する
  1. チップに `focus()` → F2 → `getByLabel('メソッド名', { exact: true })` がフォーカスされ、元の名前が全選択されている
     (続けて入力すると置き換わることで確認してよい) → 新しい名前を入力して Enter → `method-<新しい名前>` が表示され、**そのチップがフォーカスされている**
  2. F2 → 名前を入力 → Escape → 名前は `placeOrder` のまま、`method-placeOrder` がフォーカスされている
  3. F2 → 入力欄を空にして Enter → `getByRole('alert')` が「メソッド名を入力してください」、入力欄にフォーカスが残る。
     そのあと Escape で `method-placeOrder` に戻り、フォーカスもチップにある
  4. F2 → Escape → もう一度 F2 → 新しい名前 → Enter で名前が変わる(取り消しのあとの2回目の編集が1回の Enter で確定する)
  5. チップに `focus()` → Space でキーボードドラッグを始める → F2 を押しても入力欄が出ない(`getByLabel('メソッド名')` が0件)→
     Escape でドラッグを取り消すと、メソッドは元のクラスに残っている(F2 の入口が dnd-kit のキー操作を壊していないこと)
  6. 変更後に Ctrl+Z で元の名前に戻る(既存の `apply` 経由であることの確認。1行で足りる)
- チップに `aria-keyshortcuts="F2"` が付いている(未決事項2でA/Bの場合。E2E の1で `toHaveAttribute` を1行足す)
- 手動確認: ダブルクリックでの名前の変更・クリックでの選択・マウスでのドラッグ移動・Shift+F10 のメニューが今までどおり動く。
  ダブルクリックで始めて、別のメソッドをクリックして確定したとき、フォーカスが元のチップへ奪い返されない

## 6. スコープ外

- **クラスのヘッダー・ファイルのパスでの F2**: どちらも Shift+F10 →「名前を変更」フォームでキーボードから届くので穴ではない。
  `ClassNode.tsx` は `class-dependency-focus`・`template-method-stage` が触る可能性もある。揃えたい要望が出てから(未決事項4)
- **右クリックメニューに「メソッドの名前を変更」を足す**: F2 で足りる。足すなら `move-class-via-context-menu` のマージ後
- **F2 以外の開始キー(Enter など)**: Enter は `KeyboardSensor` の「掴む」と衝突する
- **dnd-kit のスクリーンリーダー向け説明文(`aria-describedby` の指示文)に F2 を書き足す**: `aria-keyshortcuts` で足りる。
  `DndContext` の `accessibility` 設定を触ることになり、全ドラッグ要素に影響するため
- **失敗理由の文言・表示場所の変更、入力欄の `maxLength`**: `identifier-name-validation` の担当
- **操作ガイドの作成**: `operation-guide` の担当。ただし記述の追従は下記「他パイプラインへの申し送り」のとおり
- **`useInlineEdit` の単体テスト(jsdom 等の導入)**: 新しい依存を足さない。E2E で守る

## 7. 他パイプラインへの申し送り・衝突

- `MethodChip.tsx`: `color-contrast-a11y` は `MethodChipView`(ファイル前半)、`identifier-name-validation` は編集中の `<input>` に
  `maxLength`(未決10でBの場合のみ)。本件は `MethodChip` 冒頭のフック呼び出しと `<button>` の属性だけで、行が離れている
- `useInlineEdit.ts`: 他のパイプラインに変更予定なし。`identifier-name-validation` は「触らない」と明記
- `operation-guide`: `docs/pipeline/operation-guide/02-draft-spec.md` の操作表(「名前を変える」の行)に「メソッド名はマウスのみ」とある。
  - 本件が先にマージされた場合: `operation-guide` の最終仕様・実装で「メソッド名: チップにフォーカスして F2」に直してもらう
  - `operation-guide` が先にマージされた場合: 本件の実装で、ガイドの該当行を「F2」に1行直す(ファイルの衝突ではなく記述の追従)

## 未決事項

### 未決事項1: 編集を終えたとき、どの場合にフォーカスをメソッドチップへ戻すか

- 選択肢A(推奨): Enter で確定に成功したとき・Escape で取り消したときだけ戻す。F2 とダブルクリックのどちらで始めたかは問わない。
  クリックや Tab で入力欄を離れて確定したときは戻さない(プレイヤーが移した先のフォーカスを奪わない)
- 選択肢B: F2 で始めた編集のときだけ、Enter / Escape で戻す。ダブルクリックで始めた編集は今までどおり戻さない(状態が1つ増える)
- 選択肢C: 編集が終わったら常に戻す(クリックで他の要素へ移った場合もチップへ奪い返すため、非推奨)

### 未決事項2: F2 で名前を変えられることを画面上でどう知らせるか

- 選択肢A(推奨): チップに `aria-keyshortcuts="F2"` だけ付ける(支援技術に伝わる。見た目は変えない)。見える案内は `operation-guide` に任せる
- 選択肢B: A に加えて、チップに `title="ダブルクリックまたは F2 で名前を変更"` を付ける(マウスで重ねるとツールチップが出る)
- 選択肢C: 何も付けず、`operation-guide` の一覧だけで知らせる

### 未決事項3: 新しい E2E をどこに置くか

- 選択肢A(推奨): 新しいファイル `e2e/method-rename-keyboard.spec.ts` に置く。多くのパイプラインが追記する `refactor.spec.ts` との
  追記位置の競合を避けられる(ステージを開く3行のヘルパーはファイル内に複製する)
- 選択肢B: `e2e/refactor.spec.ts` の既存のダブルクリックでの名前の変更テスト(456〜512行目付近)の直後に足す。関連テストが1か所にまとまる

### 未決事項4: クラス名・ファイルのパスでも F2 でその場編集を始められるようにするか

- 選択肢A(推奨): 今回はメソッドだけ。クラス・ファイルは Shift+F10 のフォームでキーボードから届いており、`ClassNode.tsx` の他パイプラインとの競合も避ける
- 選択肢B: 今回まとめて揃える。クラスのヘッダー(`class-node__header`、dnd-kit の draggable)・ファイルノードに同じ F2 の入口を足し、
  `InlineEditableLabel` にもフォーカスの戻り先を渡す(`ClassNode.tsx`・`FileNode.tsx`・`InlineEditableLabel.tsx` に差分が出る)
