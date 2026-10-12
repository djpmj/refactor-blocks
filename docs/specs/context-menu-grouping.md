# context-menu-grouping: 右クリックメニューを対象ごとに分け、メソッドを新しいクラスへ移す項目を足す

## 背景・目的

キャンバスでメソッドやフィールドを右クリックすると、`menuItemsFor`(`CanvasContextMenu.tsx`)が、次の項目を**見出しも区切りもなく**1つのメニューに並べる。

- 右クリックしたメソッドの操作: 別のクラスへ移動
- そのメソッドが入っているクラスの操作: クラスの名前を変更・継承元を設定・実装するインターフェースを設定・クラスを削除
- そのクラスが入っているファイルの操作: このファイルにクラスを追加・ファイルを削除
- キャンバス全体の操作: ファイルを追加

これにより、次の問題が起きている。

- メソッドを右クリックしたのに「クラスを削除」「ファイルを削除」があり、どれを消すのか一目で分からない(確認ダイアログは無く、押すとすぐ消える)
- 「クラスの名前を変更」が、メソッドの名前の変更と取り違えやすい
- メソッドを**新しいクラスへ移す**項目が無い。キャンバスの余白へのドラッグでしかできないので、キーボードだけでは操作できない

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/canvas/CanvasContextMenu.tsx` | presentation | 項目を対象ごとの組に分け、見出しを付ける。削除の項目に対象の名前を入れる。移動のサブメニューに「新しいクラスへ」を足す |
| 新規 | `src/presentation/canvas/contextMenuGroups.ts` | presentation | 右クリックの対象から、出す組と項目を決める純粋関数(今の `menuItemsFor` の組み立てをここへ移す) |
| 新規 | `src/presentation/canvas/contextMenuGroups.test.ts` | presentation | 上のテスト |
| 変更 | `src/index.css` | presentation | 組の見出し・区切り線のスタイル |
| 変更 | 右クリックメニューを使う既存の E2E(`move-via-context-menu`・`move-class-via-context-menu` ほか) | E2E | 新しい文言・並びに合わせる |
| 新規 | `e2e/context-menu-grouping.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`domain` / `application` は変更しない(新しいクラスへ移す処理は、余白へのドロップと同じ既存のユースケース `moveMethodToNewClassUseCase` を使う)。

## データ・型の変更

```ts
// src/presentation/canvas/contextMenuGroups.ts
export type MenuGroupKind = 'member' | 'class' | 'file' | 'canvas';

export type MenuGroup = {
  readonly kind: MenuGroupKind;
  /** 見出し。例: 'メソッド calculatePrice()'、'クラス PriceCalculator'、'このファイル'、'キャンバス' */
  readonly heading: string;
  readonly items: readonly MenuItem[]; // 今の MenuItem 型をそのまま使う
};

/** 右クリックの対象から、出す組を「member → class → file → canvas」の順で返す。項目の無い組は返さない。 */
export function contextMenuGroups(target: ContextMenuTarget, names: Readonly<{ member?: string; className?: string }>): readonly MenuGroup[];
```

## 見た目・動きの仕様

### 組と項目

| 組 | 見出し | 項目(この順) | 出すとき |
| --- | --- | --- | --- |
| member | `メソッド <名前>()` / `フィールド <名前>` | 別のクラスへ移動(サブメニュー) | メソッド・フィールドを右クリックしたとき |
| class | `クラス <クラス名>` | 別のファイルへ移動(クラスを右クリックしたときだけ)・名前を変更・継承元を設定・実装するインターフェースを設定・`<クラス名> を削除` | クラスかその中を右クリックしたとき |
| file | `このファイル` | クラスを追加・このファイルを削除 | ファイルかその中を右クリックしたとき |
| canvas | `キャンバス` | ファイルを追加 | いつも |

- 組の見出しは、目に見える小さな文字(`role="presentation"`)。組は `role="group"` と `aria-label`(見出しと同じ文)で囲む
- 組と組の間に区切り線を引く
- 項目の文言は、組の見出しで対象が分かるので短くする(`クラスの名前を変更` → `名前を変更`)。ただし削除だけは、対象の名前を入れる(`PriceCalculator を削除`、`このファイルを削除`)
- 削除の項目は `var(--danger)` の文字色にする。確認ダイアログは今どおり出さない(Ctrl+Z で戻せる)
- キーボード(↑↓)は項目だけを移動し、見出しは飛ばす。開いたときは最初の項目にフォーカスする(今と同じ)

### メソッドを新しいクラスへ移す

- メソッドの「別のクラスへ移動」のサブメニューの先頭に `新しいクラスへ` を足し、区切り線で既存のクラスの候補と分ける
- 選ぶと、キャンバスの余白へドロップしたときと同じ処理で、新しいファイルと新しいクラスを作ってメソッドを移す(クラス名は自動で付く)
- フィールドのサブメニューには足さない(フィールドを新しいクラスへ移す操作は今も無いため)

## TDD対象の純粋関数

### `contextMenuGroups`(`presentation/canvas/contextMenuGroups.ts`)

- メソッドを右クリック → `member`・`class`・`file`・`canvas` の4組。`member` の見出しが `メソッド calculatePrice()`
- フィールドを右クリック → `member` の見出しが `フィールド status`
- クラスを右クリック → `class`・`file`・`canvas` の3組。`class` に `別のファイルへ移動` がある
- ファイルを右クリック → `file`・`canvas` の2組
- 余白を右クリック → `canvas` の1組
- `class` の組の削除の項目が `<クラス名> を削除`

## 受け入れ基準

1. 中級10で `quotePrice()` を右クリックすると、「メソッド quotePrice()」「クラス PriceCalculator」「このファイル」「キャンバス」の見出しで項目が分かれ、区切り線がある
2. クラスの削除の項目が「PriceCalculator を削除」になっている
3. メソッドの「別のクラスへ移動」の先頭に「新しいクラスへ」があり、選ぶと新しいクラスができてメソッドが移る。Ctrl+Z で戻せる
4. 右クリックメニューを開いてから、キーボード(↑↓・Enter・→)だけで「新しいクラスへ」を選べる
5. 既存の右クリックメニューの E2E が、新しい文言に合わせて通る
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 削除の確認ダイアログ
- メソッドの名前の変更・削除を右クリックメニューに足すこと
- フィールドを新しいクラスへ移す操作
- メソッドエディタ側の操作の変更
