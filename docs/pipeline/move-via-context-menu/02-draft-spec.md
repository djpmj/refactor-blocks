# 仕様草案: 右クリックメニューから移動先のクラスを選んでメソッド・フィールドを移す

- slug: `move-via-context-menu`
- 元になった探索: `docs/pipeline/move-via-context-menu/01-discovered.md`

## 1. 背景・目的

- Move Method / Move Field はほぼ全ステージで使う主要操作なのに、操作手段が dnd-kit のドラッグ&ドロップ
  (キーボードでは `KeyboardSensor` の矢印キー移動)しかない。移動先クラスの位置が画面の座標しだいなので、
  ズーム・パンの状態によってはキーボードで目的のクラスまで運ぶのが現実的でなく、スクリーンリーダーからは候補も分からない。
- CLAUDE.md の ponytail で「手を抜かないもの」にアクセシビリティ(キーボード操作を含む)がある。主要操作に
  座標に頼らず届く手段を用意する。マウスで遊ぶ人にとっても、クラスが多い・ズームアウトしているときに速く確実になる。
- `docs/specs/fields-and-feature-envy.md` の「キーボード操作」節・未決事項で先送りされていたもの。

**本当に新しい仕組みが要るか**: 要らない。移動そのものは既存のストア操作 `moveMethod` / `moveField`
(`apply` 経由なので Undo・エラー表示もそのまま効く)を呼ぶだけ。メニューの部品も既存の `SubmenuTrigger`
(「継承元を設定」と同じホバー/フォーカスで開くサブメニュー)を使う。新しく要るのは
「右クリックの対象にメソッド/フィールドを加える」ことと「候補の絞り込み」だけ。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/moveMethod.ts` | domain | 移動先候補 `moveMethodTargets` を追加(未決事項3の結果しだい) |
| 変更 | `src/domain/codebase/moveField.ts` | domain | 移動先候補 `moveFieldTargets` を追加(同上) |
| 変更 | `src/domain/codebase/moveMethod.test.ts` / `moveField.test.ts` | domain | 上記のテスト(先に書く) |
| 変更 | `src/presentation/canvas/useCanvasContextMenu.ts` | presentation | `ContextMenuTarget` に「どのメソッド/フィールドを右クリックしたか」を加える |
| 変更 | `src/presentation/canvas/MethodChip.tsx` / `FieldChip.tsx` | presentation | チップに `data-method-id` / `data-field-id` を付ける(右クリック対象の判定用) |
| 変更 | `src/presentation/canvas/CanvasContextMenu.tsx` | presentation | 「別のクラスへ移動」サブメニュー(`MoveMenuItem`)を追加 |
| 変更 | `e2e/refactor.spec.ts` | (E2E) | メニュー経由の移動を守るテストを追加 |

`application` 層・`infrastructure` 層・ストア(`useGameStore.ts`)・`CodebaseCanvas.tsx` の `useDropHandler` は変更しない見込み。

## 3. データ/型の変更

ドメインモデル・永続化スキーマの変更は無し。presentation 層の型だけ変える。

```ts
// src/presentation/canvas/useCanvasContextMenu.ts
export type ContextMenuTarget = {
  readonly x: number;
  readonly y: number;
  readonly fileId: string | null;
  readonly classId: string | null;
  /** 右クリックしたメソッド/フィールド。クラスのヘッダー・ファイル・余白ならnull。 */
  readonly member: { readonly kind: 'method' | 'field'; readonly id: string } | null;
};
```

### 右クリックした要素の判定

メソッド/フィールドを右クリックしたときも、イベントは今どおりクラスノードの `onNodeContextMenu` に届く。
そこで `event.target` から一番近い `[data-method-id]` / `[data-field-id]` を `closest` で探し、見つかれば
`member` に入れる(`event.target instanceof Element` で絞ってから使う。`as` は使わない)。
チップ側に新しいイベントハンドラーやReactコンテキストを足さずに済む。

### メニュー項目

`menuItemsFor` に `{ kind: 'move-submenu'; label: '別のクラスへ移動' }` を足す。`target.member !== null` のときだけ出し、
**先頭**に置く(メソッド/フィールドを右クリックしたときの主目的なので)。
先頭項目は `autoFocus` され、`SubmenuTrigger` はフォーカスで開くので、メニューを開いた時点でサブメニューも開く。
キーボードでは Tab で候補へ進める(既存の「継承元を設定」と同じ操作感)。

`MoveMenuItem` は `ExtendsMenuItem` と同じ形で書く:
- 候補(未決事項3)をクラス名のボタン(`role="menuitem"`)で並べる
- 押したら `member.kind` に応じて `moveMethod(member.id, classId)` / `moveField(member.id, classId)` を呼び、メニューを閉じる
- 候補が0件なら項目自体を出さない(`null` を返す)

## 4. TDD対象の純粋関数

未決事項3が選択肢A(推奨)の場合。候補の絞り込みを domain に置き、presentation はそれを並べるだけにする。

### `moveMethodTargets(codebase, methodId): CodeClass[]`(`src/domain/codebase/moveMethod.ts`)

`moveMethod(codebase, methodId, そのクラスID)` が成功するクラスの一覧。`allClasses` の順(ファイル順→ファイル内の宣言順)。

- 正常系: 移動元クラス以外のクラスをすべて、ファイル順・宣言順で返す
- 正常系: 同じ名前のメソッドを既に持つクラスは除く
- 正常系: 移動元以外にクラスが無ければ `[]`
- 異常系: 存在しないメソッドIDなら `[]`
- 元の `codebase` を変更しない

### `moveFieldTargets(codebase, fieldId): CodeClass[]`(`src/domain/codebase/moveField.ts`)

`moveField` が成功するクラスの一覧。ケースは上と同じ(「同じ名前のフィールドを既に持つクラスは除く」)。

実装は `moveMethod` / `moveField` と判定を二重に持たないこと(判定を小さな関数に切り出して両方から呼ぶ、など)。

## 5. 受け入れ基準

- [ ] 上記の純粋関数のテストを先に書き(Red)、実装して通る(Green)
- [ ] メソッドのチップを右クリックすると、メニューの先頭に「別のクラスへ移動」があり、候補のクラス名を選ぶとそのクラスへ移る
- [ ] フィールドのチップでも同じことができる
- [ ] 移動後にメニューが閉じ、Ctrl+Z で元に戻せる(ストアの `apply` 経由であること)
- [ ] クラスのヘッダー・ファイル・余白を右クリックしたときは「別のクラスへ移動」が出ない(既存のメニューは変わらない)
- [ ] 移動元のクラス自身は候補に出ない
- [ ] 未決事項1の結果に応じたキーボード操作でメニューを開き、キーボードだけで移動を完了できる
- [ ] E2E(`e2e/refactor.spec.ts`)に次を追加し通る
  - メソッドを右クリック → 「別のクラスへ移動」→ 候補クリックで、移動先クラスのノードにメソッドが出て、移動元から消える
  - フィールドで同じ
  - (未決事項1でキーボードを選んだ場合)チップにフォーカス → キーで開く → Tab/Enter で移動できる
- [ ] 既存のドラッグ&ドロップのE2Eがすべて通る
- [ ] `npm run check`(lint + typecheck + test)が通る

## 6. スコープ外

- クラスを別ファイルへ移す(`moveClass`)のメニュー化(01-discovered.md の分割案どおり後回し)
- フィールドを新しいクラスへ移す(`moveFieldToNewClass`)。ドメイン操作自体が無い
- メニュー内の矢印キーでの項目移動(roving tabindex)。既存メニューもTab移動なので揃える。必要になったらメニュー全体で入れる
- 移動先候補の検索・絞り込み入力欄。候補が数十件になるステージが出てきたら考える
- ドラッグ&ドロップ側の挙動変更

## 未決事項

### 未決事項1: メニューをキーボードからも開けるようにするか

- 選択肢A(推奨): ブラウザ標準に任せる。フォーカスしたチップで Shift+F10 / ContextMenu キーを押すと、Chrome・Firefox(Windows/Linux)はネイティブに `contextmenu` イベントを出すので追加コードは無し。E2Eで `press('Shift+F10')` が効くことを確かめ、効かなければ実装者は独自実装に進まず報告する。macOS には対応キーが無い
- 選択肢B: チップの `onKeyDown` で Shift+F10 / ContextMenu キーを明示的に拾い、チップの位置にメニューを開く。OSに依らず動くが、dnd-kit の `listeners.onKeyDown`(KeyboardSensor)と合成する必要があり、開く関数をチップへ渡す仕組み(Reactコンテキスト等)も要る
- 選択肢C: 今回はマウスの右クリックだけ。キーボードは次のタスクに回す

### 未決事項2: 「新しいクラスへ移動」(`moveMethodToNewClass`)も候補に入れるか

- 選択肢A(推奨): 入れない。余白へのドロップで既にでき、キーボードで使いたい要望も今は無い(YAGNI)。フィールドには同等の操作が無いので、メソッドとフィールドの見た目も揃う
- 選択肢B: メソッドのときだけ、候補の末尾に「(新しいクラス)」を足す

### 未決事項3: 移動先の候補をどう並べるか

- 選択肢A(推奨): 移動元以外の全クラスをファイル順・宣言順にクラス名だけで並べ、同名のメソッド/フィールドを既に持つクラスは除く(「継承元を設定」が選べない相手を除くのと同じ方針)。インターフェース役のクラスも除かない(ドラッグと同じ)
- 選択肢B: Aに加え、ファイルごとに見出し(ファイルパス)で区切る
- 選択肢C: 除外はせず全クラスを出し、同名がある移動先を選んだときは既存のエラー表示に任せる(domain の関数は作らず presentation で移動元だけ除く)

### 未決事項4: メニューを閉じたときにフォーカスをどこへ戻すか

- 選択肢A(推奨): Escape・外側クリックで閉じたときは、開く前にフォーカスしていた要素(チップ)へ戻す。移動を実行した場合はチップが別クラスへ移って作り直されるので戻さない(フォーカスはbodyになる)
- 選択肢B: Aに加え、移動後は移動先クラスの同じメソッド/フィールドのチップへフォーカスを移す(連続して操作しやすいが、DOMの作り直しを待つ処理が要る)
- 選択肢C: 今回は何もしない(既存メニューと同じ挙動のまま)
