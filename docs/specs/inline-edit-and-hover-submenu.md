# キャンバスのその場編集と、継承元/インターフェースのホバーサブメニュー

## 背景・目的

キャンバス上のファイル・クラス・メソッドの名前を変えるには、右クリックメニューを開いて専用のフォームに
切り替える必要があった。継承元・実装するインターフェースの設定も、メニュー項目→セレクトボックス→
「設定」ボタン、と3段階かかっていた。

要求: 図のファイル名・クラス名・メソッド名をダブルクリックしてその場で直せるようにする。
継承元・実装するインターフェースの設定は、メニュー項目にカーソルを合わせると候補のクラス名が右側に
出て、クリックひとつで決まるようにする(別画面や設定ボタンを挟まない)。

**ponytail**: 新しい編集用の画面・ダイアログは作らない。既存の `renameClass` / `renameFile` /
`setSuperclass` をそのまま呼ぶ。メソッド名だけ `renameMethod` が存在しなかったので、既存の
`renameClass` / `moveMethod` と同じ形(重複チェックはクラス内だけ)で domain 層に1つ足す。
右クリックメニューの「クラスの名前を変更」「ファイルの名前を変更」フォームは、キーボードだけで
名前を確定したい場合の経路として残す(ダブルクリックは代替であって置き換えではない)。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/codebase/renameMethod.ts` | domain | 新規 | メソッド名を付け替える純粋関数(重複チェックは所属クラス内のみ) |
| `src/domain/codebase/renameMethod.test.ts` | domain | 新規 | 上記のテスト |
| `src/application/RefactorUseCases.ts` | application | 変更 | `renameMethodUseCase` / `describeRenameMethodError` を追加 |
| `src/application/RefactorUseCases.test.ts` | application | 変更 | 上記のテスト |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `renameMethod` アクションを追加 |
| `src/presentation/canvas/useInlineEdit.ts` | presentation | 新規 | ダブルクリックでその場編集にする共通の状態管理(Enter/Escape/blurの確定・取り消し) |
| `src/presentation/canvas/InlineEditableLabel.tsx` | presentation | 新規 | ファイルパス・クラス名の表示用。ダブルクリックで span→input に切り替わる |
| `src/presentation/canvas/FileNode.tsx` | presentation | 変更 | ファイルパスの表示を `InlineEditableLabel` に置き換え |
| `src/presentation/canvas/ClassNode.tsx` | presentation | 変更 | クラス名の表示を `InlineEditableLabel` に置き換え(継承ラベルは別要素のまま) |
| `src/presentation/canvas/MethodChip.tsx` | presentation | 変更 | メソッド名をダブルクリックで編集できるようにする(button→divへ丸ごと差し替え。inputをbuttonの中に入れると無効なHTMLになるため) |
| `src/presentation/canvas/CanvasContextMenu.tsx` | presentation | 変更 | 「継承元を設定」「実装するインターフェースを設定」をフォーム(セレクト+設定ボタン)からホバーサブメニューへ置き換え |
| `src/index.css` | presentation | 変更 | その場編集のinput・サブメニューの見た目 |
| `e2e/refactor.spec.ts` | — | 変更 | 継承元/インターフェース設定のテストをサブメニュー操作に更新。ダブルクリック編集のテストを追加 |

## renameMethod

```ts
// src/domain/codebase/renameMethod.ts
export type RenameMethodError = 'method-not-found' | 'empty-method-name' | 'duplicate-method-name';
export function renameMethod(codebase: Codebase, methodId: string, newName: string): Result<Codebase, RenameMethodError>;
```

`renameClass` と同じ形。今と同じ名前なら何もせず成功。重複チェックは `moveMethod` / `extractMethod` と
同じく、**所属クラスの中だけ**を見る(別クラスに同名メソッドがあっても許容する)。

## その場編集(`useInlineEdit`)

```ts
// src/presentation/canvas/useInlineEdit.ts
export function useInlineEdit(value: string, onSubmit: (next: string) => boolean): {
  editing: boolean;
  startEditing: () => void;
  inputProps: { ref, value, autoFocus, onFocus, onChange, onKeyDown, onBlur };
};
```

- ダブルクリックで `startEditing()` → `editing: true`
- Enterはinputを`blur()`するだけにして、確定処理はonBlur1箇所にまとめる
- Escapeは確定させずに`editing: false`に戻す(直後のblurで誤って確定しないよう、内部のrefで1回だけ無視する)
- 確定(`onSubmit`)が失敗(空欄・重複名など)したら`editing`のまま入力欄にフォーカスを戻す。
  失敗理由は既存の`state.message`(MethodEditorのalert)にそのまま出る
- ファイル・クラス・メソッドの3箇所で共通に使う(コードの重複を避ける)

`FileNode`/`ClassNode`はプレーンな`<span>`をinputに差し替えるだけで済むので`InlineEditableLabel`で包む。
`MethodChip`は掴む要素(dnd-kitのdraggable)が`<button>`で、`<input>`をbuttonの中に入れると無効な
HTMLになるため、編集中はbuttonごと`<div>`+`<input>`に差し替える(ドラッグは編集中はできなくなるが、
そのぶんシンプルで済む)。

## ホバーサブメニュー

`CanvasContextMenu`の「継承元を設定」「実装するインターフェースを設定」は`kind: 'submenu'`という
`MenuItem`にし、専用の`SuperclassMenuItem`コンポーネントでレンダリングする。

- ホバー(`onMouseEnter`)または フォーカス(`onFocus`、Tabキーでの操作用)でサブメニューを開く
- サブメニューの位置は、トリガーのボタンの右上を起点に`clampMenuPosition`(既存の右クリックメニューと
  同じ関数)でビューポート内に収める
- 候補は`availableSuperclasses`(既存。自分自身・循環になる相手は除外済み)。先頭に「(解除)」を置く
- 候補をクリックすると`setSuperclass`を呼び、成功したら`onClose()`でメニュー全体を閉じる
  (別画面や「設定」ボタンを挟まない)
- 現在設定されている継承元/インターフェースには`aria-current="true"`を付けて強調する
- Escapeは(既存の`useCloseOnOutside`がdocument全体で拾うので)サブメニューだけでなくメニュー全体を
  閉じる。既存の右クリックメニューの挙動と揃える

## 受け入れ基準

- `npm run check` が通る
- `renameMethod.test.ts` / `RefactorUseCases.test.ts` に、成功・同名維持・空文字・クラス内重複
  (エラー)・別クラスの同名は許容、のケースがある
- `e2e/refactor.spec.ts`:
  - ファイル名・クラス名・メソッド名をダブルクリックすると入力欄になり、Enterで確定してキャンバスの
    表示が変わる
  - ダブルクリック編集中にEscapeを押すと元の名前に戻る
  - ダブルクリック編集で重複した名前を入れると、理由が表示され名前は変わらない
  - 「継承元を設定」にカーソルを合わせるだけで(クリックせずに)候補のクラス名が表示される
  - 候補をクリックすると継承/実装の設定・解除が1クリックで終わる(既存の「設定」ボタンの経路を撤去)
  - 継承の輪ができる相手が候補から外れることは、サブメニューの一覧で確認する
- 既存のE2E(`blank.spec.ts` / `quiz.spec.ts` / `preview.spec.ts` / `critique.spec.ts`)が通る
  (`ClassNode`/`FileNode`/`MethodChip`/`CanvasContextMenu`は白紙設計モードとも共有しているが、
  クイズ/プレビューは別コンポーネント`PreviewClassNode`/`PreviewFileNode`を使っており影響しない)

## スコープ外

- サブメニューの矢印キーによる項目間移動(既存の右クリックメニュー自体がTab移動のみのため、水準を揃える)
- メソッド名のその場編集をキーボードだけで開始する手段(ダブルクリックのみ。右クリックメニューに
  「メソッドの名前を変更」は元々ないため、キーボード操作での代替経路は今回作らない)
