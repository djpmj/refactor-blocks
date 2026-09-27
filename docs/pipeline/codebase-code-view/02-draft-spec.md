# 02 仕様草案: 今のコードベースを「TypeScript風のコードの骨組み」で読むダイアログ

- slug: `codebase-code-view`
- 入力: `docs/pipeline/codebase-code-view/01-discovered.md`
- ボタン名(案): 「今のコードを見る」/ ダイアログの見出し(案): 「今のコード」

## 1. 背景・目的

プレイヤー(新卒〜4年目)は、ゲームの中ではブロックでコードを扱うが、最後に向き合うのはテキストのコードである。
「Extract Method をすると元のメソッドに `this.calculateTax();` の1行が残る」「Move Method をするとファイル先頭の `import` が増える・減る」
といった、リファクタリングがテキストのコードの見た目をどう変えるかを、今は確かめられない。

今のコードベース(リファクタリング画面の `codebase`)を、ファイルごとに TypeScript 風の骨組みとして**読み取り専用**で見せ、
ブロック操作と実務のコード(特に `import` の並び = 結合度)を結び付ける。

ponytail の階段:
- 作る必要があるか → ある(ブロックとコードを結び付ける手段が今は無い)。ただし**読むだけ**。編集・コピー・ハイライトは作らない
- 既存コードで足りるか → 依存は `classDependencies`、継承は `findSuperclass`/`findInterfaces`/`extendsChainIds`、インターフェース判定は `isInterfaceLike`、
  呼び出し行の判定は `callFragmentId` がすでにある。ダイアログは `CodebasePreviewDialog.tsx` と同じネイティブ `<dialog>` の流儀で作れる
- 標準機能で足りるか → 文字列の組み立ては標準の配列・文字列操作だけ。表示は `<pre><code>`。**新しい依存(シンタックスハイライトなど)は足さない**
- domain / application / infrastructure / ストア / 採点 / ステージデータは**変更しない**。今のコードベースはストアの `codebase` を読むだけ

## 2. 変更対象ファイル一覧

| 区分 | パス | 層 | 役割 |
|---|---|---|---|
| 新規 | `src/presentation/code/codebaseToCode.ts` | presentation | `Codebase` からファイルごとのコード文字列を組み立てる純粋関数(下記4) |
| 新規 | `src/presentation/code/codebaseToCode.test.ts` | presentation | 上のVitest(**先に書く**) |
| 新規 | `src/presentation/code/CodeViewDialog.tsx` | presentation | 読み取り専用のダイアログ(ネイティブ `<dialog>`) |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `PreviewButtons` の中だけに、ボタン1つ・ストアの `codebase` の読み出し・ダイアログの描画を足す。import 1行 |
| 変更 | `src/index.css` | presentation | `.codebase-preview__canvas`(202行目)の**直後**に `.code-view__*` を数行 |
| 新規 | `e2e/code-view.spec.ts` | E2E | ダイアログのE2E(`refactor.spec.ts`・`preview.spec.ts` には追記しない) |

**読むだけで変更しない**: `src/domain/codebase/Codebase.ts`・`dependencies.ts`・`extractMethod.ts`・`CodebasePreviewDialog.tsx`・`useGameStore.ts`・`visibilityMark.ts`

置き場所を presentation にする理由: ドメインの情報を**表示用の文字列**にするだけで、ゲームのルールではない(`describeScore.ts`・`layoutCodebase.ts` と同じ位置づけ)。
presentation はカバレッジ閾値の対象外だが、組み立て関数はTDDで書く。

## 3. データ/型の変更

ドメインモデル・永続化スキーマ・ストアの変更は**なし**。presentation に次の型を1つ足すだけ。

```ts
// src/presentation/code/codebaseToCode.ts
export type CodeFileText = {
  readonly fileId: string; // React の key 用(CodeFile.id)
  readonly path: string;   // CodeFile.path をそのまま
  readonly code: string;   // そのファイルのコード。行は '\n' 区切り、末尾に改行を付けない
};

export function codebaseToCode(codebase: Codebase): CodeFileText[];
export function importPath(fromPath: string, toPath: string): string; // テストのため export
```

### 出力の書式(未決事項の推奨案で確定した場合)

未決事項1〜6の**推奨案(A)をすべて選んだ場合**の書式を下に書く。別の選択肢になったら該当箇所だけを差し替える。

**ファイル**(`codebase.files` の順。1ファイル = 1つの `CodeFileText`):

```
<import 行(0行以上)>
<import が1行以上あれば空行1つ>
<クラス1>
<空行1つ>
<クラス2>
```

- クラスが0個のファイルは `code: ''`
- インデントは半角スペース2つ

**import 行**:
- 対象クラス = そのファイルの各クラスについて
  (a) `classDependencies(codebase)` の `from` がそのクラスである依存の `to`、
  (b) `superclassId`・`interfaceIds`(`parentIds`)
  の和集合から、**同じファイルのクラスを除いたもの**
- 対象クラスを持つファイルごとに1行にまとめる: `import { A, B } from '<importPath>';`
- 並び: 行は `codebase.files` の順、`{ }` の中は各ファイル内のクラスの宣言順。存在しないクラスIDは自然に出ない(ファイルを走査して拾うため)
- `importPath(fromPath, toPath)`: 拡張子 `.ts`/`.tsx` を外した**相対パス**。同じディレクトリは `./X`、上がるときは `../` を必要な数だけ
  - `('src/order/OrderService.ts', 'src/tax/TaxCalculator.ts')` → `'../tax/TaxCalculator'`
  - `('src/payment/PaymentService.ts', 'src/payment/PaymentGateway.ts')` → `'./PaymentGateway'`
  - `('Foo.ts', 'src/Bar.ts')` → `'./src/Bar'`
  - `'./'` や `'/'` 始まり、`..` を含むパスの正規化はしない(`// ponytail: パスは '/' で区切るだけで正規化しない。ファイル名の検証(identifier-name-validation)が入ったら見直す`)

**クラス宣言**:
- インターフェース役(`isInterfaceLike(c) && fieldsOf(c).length === 0`):
  `export interface <name> {`(親があれば ` extends <親の名前をカンマ区切り>` を付ける。親は `findSuperclass` → `findInterfaces` の順、見つからないIDは飛ばす)
  - メソッドは `<name>();`(可視性のキーワードは書かない)
- それ以外: `export class <name>[ extends <親>][ implements <I1>, <I2>] {`
  - 親は `findSuperclass`、実装先は `findInterfaces`(見つからないIDは飛ばす)
- 中身(フィールド・メソッド)が1つも無いクラスは1行で `export class <name> {}`(インターフェースは `isInterfaceLike` がメソッド1つ以上を要求するので該当しない)

**クラスの中身**(クラス):
- フィールド: 宣言順に `  <visibility> <name>;`(例: `  private balance;`)。型は書かない
- フィールドが1つ以上あり、メソッドも1つ以上あるときは間に空行1つ
- メソッド: 宣言順。メソッドとメソッドの間に空行1つ
  - 処理が0件(`fragments: []`): `  <visibility> <name>() {}`
  - 処理が1件以上:
    ```
      <visibility> <name>() {
        <処理ごとの行>
      }
    ```
  - 可視性は `public`/`private`/`protected` を**省略せず**書く(TypeScript では `public` は省略できるが、学習用に明示する)
  - 引数・戻り値の型は書かない(データに無いため。`: void` などを捏造しない)

**処理ごとの行**(インデント4つ):
- **呼び出し行**(`(fragment.uses ?? []).some((id) => fragment.id === callFragmentId(id))`、つまり Extract Method が残した `<id>:call`):
  呼び出しの文**だけ**を出す(ラベル `xxx() を呼び出す` は出さない。名前変更・Move Method のあとも今の名前・持ち主で文を作るため)
- それ以外の処理: `// <label>(<lines>行)` の1行。続けて、`uses` の各IDについて呼び出しの文を1行ずつ(`uses` の順)
- 呼び出しの文:
  - 呼び先のメソッド(`findMethod`)か持ち主(`findClassOfMethod`)が見つからないIDは飛ばす
  - 呼ぶ側のクラスを `caller`、呼び先の持ち主を `owner` として、
    `extendsChainIds(codebase, caller.id).has(owner.id)`(自クラス・先祖のメソッド)または
    `extendsChainIds(codebase, owner.id).has(caller.id)`(子孫のメソッド。Template Method の「親から子のフックを呼ぶ」= 実際は `this.parse()`)
    なら `this.<method>();`
  - それ以外: `<受け手>.<method>();`。受け手はクラス名の先頭1文字を小文字にしたもの(`TaxCalculator` → `taxCalculator`)
- 採点用の隠しタグ(`responsibility`・`duplicateGroup`・`stub`・`accessor`)・`suggestedName`・`reads`/`writes` は**出さない**
- 名前(クラス名・メソッド名・フィールド名・パス)は**直さず・弾かずにそのまま**出す(`identifier-name-validation` のマージ前後どちらでも同じ動き)

**例**(チュートリアル2で `calculateTax` を抽出し、`TaxCalculator` へ Move Method したあと)

`src/order/OrderService.ts`:
```ts
import { TaxCalculator } from '../tax/TaxCalculator';

export class OrderService {
  public placeOrder() {
    // 商品が空でないか検証する(12行)
    // 在庫があるか検証する(18行)
    // 小計を計算する(14行)
    taxCalculator.calculateTax();
    // 注文をDBに保存する(20行)
    // 確認メールを送る(16行)
  }
}
```

`src/tax/TaxCalculator.ts`(`moveMethod` は可視性を変えないので `private` のまま。他クラスから private を呼ぶ形がコードでもそのまま見える):
```ts
export class TaxCalculator {
  private calculateTax() {
    // 消費税を計算する(軽減税率あり)(24行)
  }
}
```

中級1の初期状態の `src/order/Order.ts` の先頭:
```ts
import { Customer } from '../customer/Customer';
import { Inventory } from '../inventory/Inventory';

export class Order {
  public checkout() {
    // 在庫を引き当てる(30行)
    inventory.reserve();
    // 合計金額を求める(6行)
    customer.calculateOrderTotal();
    ...
```

上級2の `src/payment/PaymentGateway.ts`:
```ts
export interface PaymentGateway {
  charge();
}
```

### 画面(`CodeViewDialog.tsx`)

- props: `{ codebase: Codebase | null; onClose: () => void }`。`null` なら描画しない(`CodebasePreviewDialog` と同じ)
- `useMemo(() => (codebase === null ? [] : codebaseToCode(codebase)), [codebase])`(フックは早期 return より前)
- `useEffect` で `showModal()`(`CodebasePreviewDialog` と同じ)。Esc・背景・フォーカストラップはネイティブ `<dialog>` に任せる
- 構造:
  ```tsx
  <dialog ref={ref} className="codebase-preview" aria-labelledby="code-view-title" onClose={onClose} data-testid="code-view">
    <div className="codebase-preview__header">
      <h2 className="codebase-preview__title" id="code-view-title">今のコード</h2>
      <button type="button" onClick={onClose} aria-label="閉じる">✕</button>
    </div>
    <div className="code-view__body" tabIndex={0} role="region" aria-label="コード">
      <p className="code-view__note">型・引数・戻り値は省略しています。処理の中身は「// 説明(行数)」のコメントで表しています。</p>
      {files.map((file) => (
        <section key={file.fileId}>
          <h3 className="code-view__path">{file.path}</h3>
          <pre className="code-view__code"><code>{file.code}</code></pre>
        </section>
      ))}
    </div>
  </dialog>
  ```
  - 枠・見出し・閉じるボタンは既存の `.codebase-preview*` を使い回す(CSSを最小にする)
  - スクロールは `.code-view__body` 1か所に集める(縦横とも)。`tabIndex={0}` でキーボードの矢印キー・PageDown でスクロールできる
  - ファイルごとに `<h3>` のパス見出しで区切る(スクリーンリーダーの見出しジャンプでファイルを移れる)

### `StagePanel.tsx` の `PreviewButtons`(53〜72行目の中だけ)

- `type PreviewKind = 'before' | 'sample' | 'code'`
- `const current = useGameStore((state) => state.codebase);` を足す(既存の `useMemo` は `'code'` のとき `null` を返すので変更不要)
- 「解答例の図を見る」ボタンの**後ろ**に `<button type="button" onClick={() => setPreview('code')} disabled={disabled}>今のコードを見る</button>`
  - `disabled` は他の2つと同じ(変更依頼の実装中は部品置き場入りのコードなので押せない)
- `<CodeViewDialog codebase={preview === 'code' ? current : null} onClose={() => setPreview(null)} />` を既存の `CodebasePreviewDialog` の後ろに
- `PreviewButtons` は `key={stage.id}` 付きなので、ステージを切り替えると閉じる(既存の挙動のまま)

### `index.css`(202行目 `.codebase-preview__canvas` の直後)

```css
.code-view__body { flex: 1; min-height: 0; overflow: auto; padding: 12px 16px; }
.code-view__note { margin: 0 0 8px; color: var(--muted); font-size: 13px; }
.code-view__path { margin: 16px 0 4px; font-size: 13px; font-family: ui-monospace, monospace; }
.code-view__code { margin: 0; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.5; }
```

## 4. TDD対象の純粋関数

`src/presentation/code/codebaseToCode.test.ts` に Vitest・AAA(`// Arrange` `// Act` `// Assert`)で**先に**書く。
フィクスチャはテスト内で小さな `Codebase` を組み立てる(必要なら `src/domain/codebase/testFixtures.ts` の `sampleCodebase()`・`fragment()` を読むだけで使う)。
期待値はファイル単位の `code` 文字列全体を `toBe` で比べる(書式の取り違えを見逃さないため)。

### `importPath(fromPath, toPath)`

正常系:
- 別ディレクトリ: `('src/order/OrderService.ts', 'src/tax/TaxCalculator.ts')` → `'../tax/TaxCalculator'`
- 同じディレクトリ: `('src/payment/PaymentService.ts', 'src/payment/PaymentGateway.ts')` → `'./PaymentGateway'`
- 深さが違う: `('src/a/b/C.ts', 'src/D.ts')` → `'../../D'`、`('src/D.ts', 'src/a/b/C.ts')` → `'./a/b/C'`
- ディレクトリ無し: `('Foo.ts', 'Bar.ts')` → `'./Bar'`
- `.tsx` も外す: `('src/A.ts', 'src/B.tsx')` → `'./B'`

境界:
- 拡張子が無いパス: `('src/A.ts', 'src/B')` → `'./B'`(そのまま)

### `codebaseToCode(codebase)`

正常系:
- ファイル1つ・クラス1つ・public メソッド1つ(処理2件)→ `export class` 宣言、`public name() {`、`// label(n行)` が2行、閉じ括弧
- `codebase.files` の順・`path`・`fileId` がそのまま出る
- 中身の無いクラス → `export class TaxCalculator {}` の1行
- クラスが0個のファイル → `code: ''`
- 1ファイルに2クラス → 間に空行1つ
- 可視性: `private`/`protected` のメソッド・フィールドがキーワードで出る
- フィールド → `  private balance;`、フィールドとメソッドの間に空行1つ。フィールドだけのクラスは空行なし
- メソッドが2つ → 間に空行1つ
- 処理0件のメソッド(インターフェース役でないクラスの中)→ `  protected parse() {}`
- インターフェース役(全メソッドが public かつ空、フィールド無し)→ `export interface PaymentGateway {` と `  charge();`
- `superclassId` → ` extends Base`、`interfaceIds` → ` implements A, B`(宣言順)、両方 → ` extends Base implements A`
- **Extract Method のあと**: `extractMethod` で切り出した Codebase を渡すと、元のメソッドの該当位置に `this.<新しい名前>();` だけが出て
  (`xxx() を呼び出す` のコメントは出ない)、切り出したメソッドが `private <新しい名前>() {` で次に並ぶ
- **Move Method のあと**: 上の呼び出し先を `moveMethod` で別ファイルのクラスへ移した Codebase を渡すと、呼び出しの文が `taxCalculator.calculateTax();` になり、
  元のファイルの先頭に `import { TaxCalculator } from '../tax/TaxCalculator';` と空行1つが付く
- `uses` を持つ普通の処理(呼び出し行でない)→ コメント1行のあとに呼び出しの文が `uses` の順に並ぶ
- 同じクラスのメソッドを `uses` で呼ぶ → `this.x();`
- 親クラス(extends の先祖)のメソッドを呼ぶ → `this.x();`
- 子クラス(自分を extends の先祖に持つクラス)のメソッドを呼ぶ → `this.x();`
- import:
  - 別ファイルの2クラスに依存 → `codebase.files` の順に2行
  - 同じ別ファイルの2クラスに依存 → `import { A, B } from ...` の1行(クラスの宣言順)
  - 同じファイルのクラスへの依存 → import に出ない
  - フィールドの読み書き(`reads`/`writes`)だけの依存 → import に出る(`classDependencies` に従う)
  - `superclassId`・`interfaceIds` が別ファイル → import に出る(`uses` が無くても)
  - 依存が無い → import 行も空行も無い

異常系・境界:
- `uses` に存在しないメソッドID → その文は出ない(コメント行は出る)
- `superclassId`/`interfaceIds` が存在しないID → `extends`/`implements` から飛ばし、import にも出ない
- クラス名・メソッド名に空白や記号が入っていても、そのまま出す(例: クラス名 `Order Service` → `export class Order Service {`)
- 元の Codebase を変更しない(呼ぶ前後で `toEqual` が同じ)

`CodeViewDialog.tsx`・`StagePanel.tsx` の変更は表示のみなのでユニットテスト対象外(E2Eで守る)。

## 5. 受け入れ基準

- [ ] `codebaseToCode.test.ts` を先に書き(Red)、実装して通る(Green)
- [ ] 画面上部の操作ボタン列に「今のコードを見る」が「解答例の図を見る」の後ろに出る。変更依頼の実装中は `disabled`
- [ ] 押すと `data-testid="code-view"` のダイアログが開き、見出し「今のコード」、ファイルごとのパス見出しとコードが出る
- [ ] ダイアログ内のコードはキーボード(Tab でコード領域へ移り、矢印キー・PageDown)でスクロールできる。閉じるボタン・Esc で閉じる
- [ ] 採点用の隠しタグ(`responsibility` の値など)がどこにも出ない
- [ ] 点数・ステージの内容・模範解答が変わらない(domain / application / infrastructure / ストアの差分が無い)
- [ ] 新規 `e2e/code-view.spec.ts` に次を書き通る(題材を変えないチュートリアル2で確かめる。ステージを開く2行のヘルパーはこのファイル内に書く。ドラッグは使わない)
  1. 「今のコードを見る」を押すと、今のクラスがコードの形で出て、Esc で閉じる
     - `openOrderStage` → ボタンを押す → ダイアログに `export class OrderService {`・`// 消費税を計算する(軽減税率あり)(24行)`・`src/tax/TaxCalculator.ts` が見える
       → `page.keyboard.press('Escape')` → ダイアログが隠れる
  2. Extract Method のあとで開き直すと、元のメソッドに呼び出しの文が出る
     - `openOrderStage` → `method-placeOrder` をクリック → 「消費税を計算する(軽減税率あり)」を選び `calculateTax` で抽出 → ボタンを押す
       → ダイアログに `this.calculateTax();` と `private calculateTax() {` が見え、`calculateTax() を呼び出す` の文字列は無い
- [ ] 既存のE2E(特に `preview.spec.ts`)がすべて通る
- [ ] `npm run check`(lint + typecheck + test)と `npm run test:e2e` が通る。`as`・`!`・`enum` を使わず、関数60行・循環的複雑度12・引数4つ以内(組み立て関数は import・クラス宣言・クラスの中身・処理の行・呼び出しの文の小さな関数に分ける)

## 6. スコープ外

- **「変更前の図」「解答例の図」ダイアログへの「図 / コード」の切り替え**(`CodebasePreviewDialog.tsx` は `quiz-change-site-marks` が触る可能性がある)。要望が出たら `codebaseToCode` をそのまま使って足せる
- **白紙設計・変更依頼の実装中の画面から開くこと**、設計くらべクイズの設計A・Bをコードで見せること(`ComparisonQuizView.tsx`)
- **コピーのボタン、シンタックスハイライト**(新しい依存になるので足さない)、行番号
- **コードの編集**(読み取り専用。ブロック操作だけがコードを変える)
- **引数・戻り値・フィールドの型の推定**(データに無い。捏造しない)
- **`abstract` キーワード**(未決事項4でCを選んだ場合を除く)。`template-method-stage` の `isAbstractLike` が入っても、本件は `fragments: []` を一律に `{}` で書く
- **フィールドの読み書きを文として出すこと**(未決事項6でBを選んだ場合を除く)
- **コンストラクタ・DI(`constructor(private taxCalculator: TaxCalculator)`)の生成**。他クラスの受け手 `taxCalculator` はどこで宣言されたかを示さない
- **`method-call-references` の「呼ぶ:」表記(`Class.method()`)との統一**: あちらはUIの一覧、こちらはコード。書式はそれぞれに合うものを使う(未決事項1でCを選べば統一される)
- **パスの正規化**(`./`・`..`・`\` の解釈)。`identifier-name-validation` が入れば入力側で絞られる

## 未決事項

### 未決事項1: 別クラスのメソッドを呼ぶ文をどう書くか(受け手の変数名はデータに無い)

- 選択肢A(推奨): クラス名の先頭を小文字にした受け手で `taxCalculator.calculateTax();` と書く。実務のコードに一番近い見た目で、Move Method で呼び先のクラスが変わると受け手の名前も変わるので変化が目で見える
- 選択肢B: DIされたフィールド風に `this.taxCalculator.calculateTax();` と書く(実務で多い形だが、フィールド宣言が無いのに `this.` が付き、ゲームのフィールド(`Field`)と紛らわしい)
- 選択肢C: `method-call-references` の表記にそろえて `TaxCalculator.calculateTax();` と書く(画面の間で表記がそろうが、static メソッドの呼び出しに見える)

### 未決事項2: 処理のまとまりをどう見せるか

- 選択肢A(推奨): `// 小計を計算する(14行)` のコメント1行。10ファイル前後の上級ステージでも全体が読める長さに収まる。長さは数字で分かる
- 選択肢B: コメント1行のあと `// …` を行数ぶん(上限なし)並べ、本当の長さを見せる。長いメソッドの「長さ」を体で感じられるが、上級ステージでは数千行になりスクロールが大変
- 選択肢C: Aに加え、メソッドの開き括弧の行末に合計行数を `// 計104行` と添える(`lineCount.ts` の関数を使う。1行ぶん情報が増える)

### 未決事項3: `import` のパスをどう書くか

- 選択肢A(推奨): 拡張子を外した相対パス `'../tax/TaxCalculator'`。実務で一番よく見る形で、「ファイルを移すと import の行き先が変わる」が伝わる。`importPath` の小さな関数とテストが1つ増える
- 選択肢B: 拡張子を外したプロジェクトからのパス `'src/tax/TaxCalculator'`(パス計算が要らず短く書けるが、相対パスの感覚は伝わらない)

### 未決事項4: 中身の無いメソッド・インターフェース役のクラスをどう書くか

- 選択肢A(推奨): `isInterfaceLike`(かつフィールド無し)のクラスは `export interface X { charge(); }`、それ以外のクラスの中身の無いメソッドは `protected parse() {}`。既存の判定関数だけで書け、`template-method-stage` の題材も `{}` で壊れず表示できる
- 選択肢B: インターフェース役も含めてすべて `class` と書き、中身の無いメソッドは一律 `public charge() {}`(分岐が1つ減るが、`implements` の相手が class になり実際の TypeScript と食い違う)
- 選択肢C: Aに加え、インターフェース役でないクラスの `protected` の中身の無いメソッドは `protected abstract parse();`、そのクラスを `export abstract class` と書く(Template Method の見え方が本物に近いが、`template-method-stage` の `isAbstractLike` と同じ判定を presentation に重ねて持つことになる)

### 未決事項5: ボタンの名前と置き場所

- 選択肢A(推奨): 画面上部の操作ボタン列、「解答例の図を見る」の後ろに「今のコードを見る」。変更依頼の実装中は他の2つと同じく `disabled`。差分が `PreviewButtons` の中に収まり、並走中の件と衝突しにくい
- 選択肢B: 同じ置き場所で名前を「コードで見る」にする(短いが、「変更前」「解答例」と並べたとき、どの時点のコードか分かりにくい)

### 未決事項6: フィールドの読み書き(`reads`/`writes`)をコードに出すか

中級6・中級7では、フィールドの読み書きだけで別クラスに依存していることがあり、推奨案Aだと `import` 行は出るのに本文に理由が見えない。

- 選択肢A(推奨): 出さない。`import` は `classDependencies` に従って出る。今回は呼び出しの文だけに絞り、要望が出たら足す(YAGNI)
- 選択肢B: 処理のコメントの次に `// 読む: account.balance` `// 書く: account.balance` の行を足す(自クラスは `this.balance`)。import の理由が本文で分かるが、テストケースと分岐が増える
