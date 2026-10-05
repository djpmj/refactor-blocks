# ドラッグ中に置ける場所を光らせる

## 背景・目的

メソッド・フィールド・クラスはドラッグで別の場所へ移せるが、今は**マウスが上に乗ったとき**にそのクラス・ファイルが光る(`class-node--drop-target`・`file-node--drop-target`)だけ。掴んだ瞬間には何も変わらないので、プレイヤーは「どこに置けるのか」をキャンバスの上を探り回って確かめるしかない。置けない場所(同じクラス・同名メソッドがあるクラス)に落としてエラーのトーストを見ることもある。

そこで、**ドラッグを始めた瞬間に、置けるクラス・ファイルをすべて薄く光らせ、置けない場所を薄暗くする**。

「移動先として正しいクラスだけを光らせる」案もあったが、それは答えを教えることになる。正解への誘導は「少しだけヒント」(#110 `ghost-hint`)に任せ、ここでは**ルール上置ける場所**だけを示す。

## ponytailチェック

1. YAGNI: 置ける場所の判定ロジックは新しく作らない。
2. 既存の再利用: 置けるかどうかは既存の `moveMethodTargets`・`moveFieldTargets`・`moveClassTargets`(右クリックメニューの移動先の一覧と同じ判定)をそのまま使う。ドラッグ中のIDは `CodebaseCanvas.tsx` の `activeId` と `parseMethodDragId`/`parseFieldDragId`/`parseClassDragId` で分かる。
3. 見た目はCSSのクラスの付け外しだけで作る。新しい依存は足さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/canvas/dropTargets.ts` | presentation | 新規 | `dropTargetIds`(ドラッグ中のIDから、置けるクラス・ファイルのID集合を返す純粋関数) |
| `src/presentation/canvas/dropTargets.test.ts` | presentation(test) | 新規 | 上記のテスト |
| `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 変更 | ドラッグ中の対象をストア(または React のコンテキスト)に置き、`ClassNode`/`FileNode` から読めるようにする |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | (ストアに置く場合)`dragging: { kind: 'method' \| 'field' \| 'class'; id: string } \| null` と設定・解除のアクション |
| `src/presentation/canvas/ClassNode.tsx` / `FileNode.tsx` | presentation | 変更 | ドラッグ中なら、置ける場所に `--can-drop`、置けない場所に `--cannot-drop` のクラスを付ける |
| `src/index.css` | presentation | 変更 | `--can-drop`(`--accent` の薄い縁取りと背景)・`--cannot-drop`(不透明度を下げる)の見た目 |
| `e2e/drag-drop-targets.spec.ts` | e2e | 新規 | 下記受け入れ基準のE2E |

`domain`/`application` 層は変更しない。

## データ/型の変更

```ts
// src/presentation/canvas/dropTargets.ts
export type Dragging =
  | { readonly kind: 'method'; readonly id: string }
  | { readonly kind: 'field'; readonly id: string }
  | { readonly kind: 'class'; readonly id: string };

/** ドラッグ中のものを置けるクラスID・ファイルIDの集合。 */
export function dropTargetIds(codebase: Codebase, dragging: Dragging): { readonly classIds: ReadonlySet<string>; readonly fileIds: ReadonlySet<string> };
```

## 仕様

### `dropTargetIds`

- メソッド: `moveMethodTargets(codebase, id)` のクラス。ファイルは空。
- フィールド: `moveFieldTargets(codebase, id)` のクラス。ファイルは空。
- クラス: `moveClassTargets(codebase, id)` のファイル。クラスは空。(クラスの上に落とすとそのクラスのファイルへ移る今の挙動に合わせ、置けるファイルの中のクラスも置ける側として扱ってよい。ただし光らせるのはファイルの枠)

### 見た目

- ドラッグを始めた瞬間(`onDragStart`)から、終わる・取り消すまで(`onDragEnd`/`onDragCancel`)のあいだだけ付ける。
- 置ける場所(`--can-drop`): `--accent` の薄い縁取りと背景。マウスが上に乗った場所は、今の `--drop-target` のほうが強く見えるようにする(`--drop-target` が優先)。
- 置けない場所(`--cannot-drop`): 不透明度を下げて薄暗くする(0.45前後)。ドラッグ元のクラス(同じクラスへは置けない)も薄暗くなる。
- 余白(何もない所)へのドロップは今までどおり新しいファイル・クラスができる(`drop-new-file-at-position`)。余白は光らせない。
- キーボードでのドラッグ(`KeyboardSensor`)でも同じように光る。
- 違反の強調(`--flagged`)とは重ねて表示してよい。
- 光らせるのは見た目だけで、ドロップの判定・エラー処理は変えない。

## TDD対象の純粋関数

### `dropTargetIds`(`src/presentation/canvas/dropTargets.ts`)

表示に関わる純粋関数だが、置ける場所の誤表示を防ぐためテストを書く。

- メソッド: 別クラスが置ける側に入り、ドラッグ元のクラスは入らない
- メソッド: 同名メソッドを持つクラスは入らない
- フィールド: 別クラスが入り、ドラッグ元のクラスは入らない(`moveFieldTargets` の条件どおり)
- クラス: 別ファイルが入り、今のファイルは入らない
- 存在しないIDならどちらも空

## 受け入れ基準

1. `npm run check` が通る。`dropTargetIds` にテストがある。
2. メソッドを掴むと、置けるクラスが薄く光り、ドラッグ元のクラスと同名メソッドのあるクラスが薄暗くなる。上に乗せたクラスは今までどおり強く光る。
3. フィールド・クラスを掴んだときも同じように、置けるクラス・ファイルが光る。
4. 手を離す・`Esc` で取り消すと、光と薄暗さが消える。
5. キーボードでのドラッグでも2〜4が成り立つ。
6. E2E(`e2e/drag-drop-targets.spec.ts`): 2〜4を確認する。既存のドラッグ&ドロップのE2Eが無変更で通る。
7. `npm run test:e2e` が通る。

## スコープ外

- 移動先として正しいクラスだけを光らせる誘導(#110 の「少しだけヒント」の役目)。
- 置けない理由を、ドラッグ中にその場で表示すること(落としたときのエラーのトーストのまま)。
- 余白(新しいファイルができる場所)の強調。

## 未決事項

なし。
