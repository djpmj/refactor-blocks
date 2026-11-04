# clear-screen-block-shortcuts: クリア画面などのモーダル表示中に Ctrl+Z が背面の盤面を戻してしまう

## 症状

チュートリアル1で処理を抽出してクリアし、クリア画面(`ClearScreen`、`showModal()` で開くモーダルな `<dialog>`)が出たまま
Ctrl+Z を押すと、背面のコードが元に戻る(抽出したメソッドが消える)。クリア画面は「100点・減点なし」を出し続け、
Esc で閉じると背面は未クリアの状態になっている。ダイアログの中で Tab は外に出ないが、グローバルのキーボードショートカット
(元に戻す・やり直し・`?` の操作ガイド)はモーダルの表示中も効いてしまう。

同じことが、ほかのモーダル(ステージ一覧 `StageRoadmapDialog`、図のプレビュー `CodebasePreviewDialog`、
変更の影響 `ChangeImpactDialog`、コードの変更 `CodeChangeDialog`、お手本の再生 `SampleAnswerReplayDialog`、
お手本を見る確認 `ReferenceMenu` の `answer-confirm`、ソースのダウンロード `SourceDownloadDialog`)でも起きる。
見えない背面の盤面が変わる、あるいはダイアログの内容が古くなる。`?` も同様に、モーダルの上に操作ガイドが重なって開く。

## 原因

グローバルショートカットは次の2か所の `document` の `keydown` で受けている(`src/presentation/` を grep して確認済み。
ほかの `keydown` は Escape で自分を閉じる処理か、自分のダイアログ内だけのキー操作で、対象外)。

- `src/presentation/useUndoRedoShortcut.ts` の `useUndoRedoShortcut`(Ctrl/Cmd+Z、Ctrl+Y、Ctrl+Shift+Z)。
  呼び出し元は `App.tsx`(リファクタリング画面)と `blank/BlankDesignView.tsx`(白紙設計)
- `src/presentation/guide/useGuideShortcut.ts` の `useGuideShortcut`(`?`)。呼び出し元は `stage/StagePanel.tsx`

どちらも除外条件は `isEditingText(event.target)`(入力欄・選択欄にフォーカスがあるか)だけで、
モーダルな `<dialog>` が開いているかを見ていない。

ただし、**操作ガイド(`OperationGuideDialog`)だけは表示中も Undo/Redo を効かせる**ことが既存仕様
(`docs/specs/operation-guide.md`「既存の Ctrl+Z / Ctrl+Y が従来どおり動く」、E2E `e2e/operation-guide.spec.ts`
「ガイドの表示中もUndo・Redoの既存ショートカットが使える」)で決まっている。ガイドは盤面の状態を写していない参照用の
ダイアログなので食い違いが起きない。また `?` でガイドを閉じられる(開閉する)のも既存仕様。

## 修正

`src/presentation/useUndoRedoShortcut.ts`(presentation 層。DOM を見る判定なので domain には置かない)に、
両方のフックが使う判定を1つ追加し、2つのフックの `isEditingText(event.target)` をこれに置き換える。

```ts
/** グローバルショートカットを無視するか。入力欄の編集中か、操作ガイド以外のモーダルが開いている間は無視する。 */
export function isShortcutBlocked(target: EventTarget | null, root: ParentNode): boolean
```

- `isEditingText(target)` が true なら true
- `root.querySelector('dialog[open]:not([data-allows-shortcuts])') !== null` なら true
- それ以外は false

呼び出し側は `isShortcutBlocked(event.target, document)` と書く。`root` を引数にするのはテストで
`document` 以外の要素(jsdom で組み立てた `div`)を渡せるようにするため。

`OperationGuideDialog.tsx` の `<dialog>` に `data-allows-shortcuts=""`(属性があるだけでよい)を付け、例外にする。
これで操作ガイドの表示中は Undo/Redo と `?`(ガイドを閉じる)が今までどおり効き、
クリア画面などほかのモーダルの表示中は Undo/Redo も `?` も効かなくなる。

決めたこと(未決事項は残さない):

- 判定は「開いている `<dialog>` があるか」で行う。このリポジトリのモーダルはすべて `showModal()` で開く `<dialog>`
  (`show()` による非モーダル表示は無い。grep で確認済み)なので `dialog[open]` で足りる。`:modal` 擬似クラスは
  jsdom で効くか不確かなので使わない
- 例外はホワイトリストの属性1つ(`data-allows-shortcuts`)。ダイアログごとに「止めるか」を足す仕組みにはしない。
  新しいモーダルは何もしなければ止まる側(安全側)に倒れる
- `role="dialog"` の非モーダルなポップオーバー(ヒント・操作の記録・うわさ・矢印の説明・ツアーの吹き出し)は
  背面を覆わず、今も Ctrl+Z で盤面を戻せて食い違いが無いので、対象にしない
- `isEditingText` はそのまま残す(`isShortcutBlocked` の中から使う)。`useGuideShortcut.ts` の import は
  `isShortcutBlocked` に置き換える

## テスト

先に書く(Red):

- Vitest `src/presentation/useUndoRedoShortcut.test.ts`(新規、AAA で書く。jsdom 環境なので `document.createElement` で組み立てる)
  - 正常系: `root` に `<dialog>` が無く、`target` が `button` → false
  - 正常系: `root` に閉じた `<dialog>`(`open` 属性なし)だけがある → false
  - 異常系: `root` に `open` 属性付きの `<dialog>` がある → true
  - 正常系(例外): `open` かつ `data-allows-shortcuts` 付きの `<dialog>` だけがある → false
  - 異常系: 例外のダイアログと、例外でない開いたダイアログが両方ある → true
  - 異常系: `target` が `input` / `textarea` / `select` / `contentEditable` の要素 → true(既存の `isEditingText` の挙動を保つ)
  - 境界: `target` が `null`、ダイアログなし → false
- E2E `e2e/clear-screen.spec.ts` に追加(既存の `clearTutorial1` を使う)
  - 「クリア画面の表示中は Ctrl+Z / Ctrl+Y で背面の盤面が変わらない」: クリア画面が出た状態で `Control+z` → クリア画面が見えたまま、
    Esc で閉じると `method-aggregateSales` が残っていて点数の表示(`score-announcement`)が `100点`。
    続けて `roadmap-open` でステージ一覧を開き `Control+z` → Esc で閉じても `method-aggregateSales` が残っている
- 既存の E2E `e2e/operation-guide.spec.ts`「ガイドの表示中もUndo・Redoの既存ショートカットが使える」と
  `?` の開閉のテストが、変更せずにそのまま通ること(例外の回帰防止)

## 受け入れ基準

1. チュートリアル1をクリアしてクリア画面が出たまま Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z を押しても背面の盤面が変わらず、
   Esc で閉じたあとも100点のまま。`?` を押しても操作ガイドが重なって開かない
2. ステージ一覧などほかのモーダルの表示中も同じく Ctrl+Z が効かない
3. 操作ガイドの表示中は今までどおり Ctrl+Z / Ctrl+Y が効き、`?` でガイドを閉じられる
4. モーダルを閉じたあとは、Ctrl+Z / Ctrl+Y / `?` が今までどおり効く(リファクタリング画面・白紙設計の両方)
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 画面の「元に戻す」「やり直し」ボタンの無効化(モーダルの表示中は背面が操作できないので不要)
- Esc で閉じる処理(`App.tsx`・`StagePanel.tsx` のドロワーの Escape など)がモーダルの表示中にも動く件。今回の症状とは別で、
  実害の報告もない
- ストア側(`undo`/`redo`)でクリア画面の表示中を弾くこと。キー入力の入口1か所で止めれば足りる。ボタンは背面にあり押せない
- 非モーダルなポップオーバー表示中のショートカットの扱い
- クリア画面の表示中に盤面が変わったら点数を出し直す、といった同期の仕組み
