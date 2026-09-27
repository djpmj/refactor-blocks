# 02 仕様草案: クラス名・メソッド名・ファイルのパスを「識別子として書ける名前」に限る

- slug: `identifier-name-validation`
- 入力: `docs/pipeline/identifier-name-validation/01-discovered.md`
- 本文の規則・値は**未決事項の推奨案を仮に置いたもの**。`03-confirmed-answers.md` の確定内容で最終仕様に置き換える
  (本文中の「(未決N)」の箇所)。

## 1. 背景・目的

プレイヤーが名前を入力する経路は5つある(Extract Method の新しいメソッド名、Merge Methods の統合後の名前、
ファイル・クラス・メソッドの名前の変更、右クリックメニューのクラス追加、同じくファイル追加)。どの経路も
**空欄と重複しか弾かない**ため、`calc tax`・`Order-Service`・`save()`・`1stStep`・`src//Tax`・`../x.ts`・
1000文字の名前がそのまま通り、キャンバス・採点・AI講評に出る。

題材・模範解答・名前候補(`suggestMethodName`)・E2E はすでに「クラスは大文字始まり・メソッドは小文字始まりの英数字、
パスは `src/.../Xxx.ts`」に沿っており、プレイヤーの入力だけが規則の外に出られる。入力の時点(信頼境界)で弾き、
何がいけないか・どう直すかをやさしい文言で返す。

**ponytail**: 新しい画面・ダイアログ・入力補助は作らない。既存の `naming.ts` の検証関数を広げ、エラー型が
増えたぶんの文言を `RefactorUseCases.ts` の既存の `Record` に足すだけ。`useGameStore.ts` の `apply(result, describeXError)`
と `useInlineEdit` の「失敗したら入力欄に留まる」挙動はそのまま使えるので presentation は変えない。
「入力しながら候補を出す」「採点で名前の付け方を減点する」は要るか分からないのでスコープ外(本当に要るか: 入力で弾けば足りる)。

## 2. 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/codebase/naming.ts` | domain | 変更 | `validateClassName`・`validateFilePath` に書き方・長さの規則を足す。`validateMethodName` を新設(未決7)。上限値の定数を export |
| `src/domain/codebase/naming.test.ts` | domain | 新規 | 規則そのものの表形式テスト(3関数) |
| `src/domain/codebase/extractMethod.ts` | domain | 変更 | 36〜37行目の直書きを `validateMethodName` 呼び出しに置き換え。`ExtractMethodError` に `MethodNameError` を合流 |
| `src/domain/codebase/mergeMethods.ts` | domain | 変更 | 55〜57行目だけを同様に置き換え。形の比較(`sameShape`・`shape-mismatch`)には触らない |
| `src/domain/codebase/renameMethod.ts` | domain | 変更 | 13〜14行目を同様に置き換え。「今と同じ名前なら成功」の早期returnは残す |
| `src/domain/codebase/addClass.ts`・`renameClass.ts`・`addFile.ts`・`renameFile.ts` | domain | 変更なしの見込み | `ClassNameError`/`FilePathError` を合流しているだけなので、型が広がるだけ |
| `src/domain/codebase/moveToNewHome.ts` | domain | 変更(未決5でAの場合のみ) | 自動で作るパスを検証に通さない |
| `src/domain/codebase/{extractMethod,mergeMethods,renameMethod,addClass,renameClass,addFile,renameFile}.test.ts` | domain | 変更 | 既存の `it.each` 表に「規則違反」の行を1〜2行ずつ足す(配線の確認) |
| `src/application/RefactorUseCases.ts` | application | 変更 | 新しいエラーの文言を `RENAME_CLASS`・`RENAME_FILE`・`RENAME_METHOD`・`EXTRACT`・`MERGE`・`ADD_CLASS`・`ADD_FILE` の各 `Record` に足す |
| `src/application/RefactorUseCases.test.ts` | application | 変更 | 「エラーメッセージ」の describe に新しいエラーの文言の確認を足す |
| `e2e/refactor.spec.ts` | — | 変更 | 「規則に合わない名前は弾かれ、理由が出て名前は変わらない」を1本足す |

触らないもの: `useGameStore.ts`・`useInlineEdit.ts`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`MethodChip.tsx`・
`InlineEditableLabel.tsx`(未決10でBの場合のみ `<input>` に `maxLength` を足す)・`score.ts`・`sampleAnswer.ts`・
`src/infrastructure/stages/*`・`workers/critique/`・`docs/specs/inline-edit-and-hover-submenu.md`。

## 3. データ/型の変更

ドメインモデル(`Codebase`)・永続化スキーマの変更は無い。エラー型だけが広がる。

```ts
// src/domain/codebase/naming.ts(推奨案で置いた場合)
export const MAX_NAME_LENGTH = 100; // クラス名・メソッド名(未決6)
export const MAX_PATH_LENGTH = 200; // ファイルのパス(未決6)

export type ClassNameError =
  | 'empty-class-name'
  | 'class-name-too-long'
  | 'invalid-class-name'          // 使えない文字・数字始まり(未決1・未決8)
  | 'class-name-not-pascal-case'  // 英大文字で始まっていない(未決2・未決8)
  | 'duplicate-class-name';

export type MethodNameError =
  | 'empty-method-name'
  | 'method-name-too-long'
  | 'invalid-method-name'
  | 'method-name-not-camel-case'  // 英小文字で始まっていない
  | 'duplicate-method-name';

export type FilePathError = 'empty-path' | 'path-too-long' | 'invalid-path' | 'duplicate-path';

export function validateClassName(codebase: Codebase, rawName: string): Result<string, ClassNameError>;
/** replacedMethodId: 重複判定から外すメソッド(名前の変更では自分、統合ではメソッドA)。抽出では渡さない。 */
export function validateMethodName(owner: CodeClass, rawName: string, replacedMethodId?: string): Result<string, MethodNameError>;
export function validateFilePath(codebase: Codebase, rawPath: string): Result<string, FilePathError>;
```

- 呼び出し側のエラー型: `ExtractMethodError`・`MergeMethodsError`・`RenameMethodError` の
  `'empty-method-name' | 'duplicate-method-name'` を `MethodNameError` に置き換える
  (`addClass.ts` などが `ClassNameError` を合流している既存の形に揃える)。`MoveMethodError` の `'duplicate-method-name'` は無関係なので触らない。
- 判定の順序(どの関数も同じ): 前後の空白を除く → 空 → 長すぎ → 使えない文字/形 → 大小の書き方 → 重複。
  長さを先に見るのは、長い文字列に正規表現を当てないためと、「長すぎ」を先に知らせるため。長さは `String.prototype.length` で数える。

### 規則の中身(推奨案)

| 対象 | 使えない文字/形(`invalid-*`) | 大小の書き方(`*-not-*-case`) |
| --- | --- | --- |
| クラス名 | `/^[A-Za-z][A-Za-z0-9]*$/` に合わない(英字で始まり英数字だけ) | 先頭が `A-Z` でない |
| メソッド名 | 同上 | 先頭が `a-z` でない |
| パス | `/` で区切った各区間が `/^[A-Za-z0-9_-]+$/`、最後の区間は `<それ>.ts`。空の区間(`src//Tax.ts`・先頭/末尾の `/`)・`.`・`..`・空白・`\` はこれで自然に弾かれる | なし |

- パスは1本の正規表現にせず、`endsWith('.ts')` と `split('/')` の各区間の判定で書く
  (`sonarjs` の正規表現系ルールに引っかかりにくく、読みやすい)。
- クラス名とメソッド名の判定は内部の小さな関数で共有してよい(先頭文字の正規表現だけ違う)。
- 予約語は弾かない(未決3)。

### 既存データとの突き合わせ(実装者が確認済みでよい事項)

- 題材のパスはすべて `src/<英小文字のディレクトリ>/<英数字>.ts`(`src/app/services.ts` のように小文字のファイル名もある
  ので、**ファイル名の大小は問わない**)。クラス名・メソッド名・模範解答(`sampleAnswer.ts` の `extract`/`merge`/`addClass`/
  `addFile`/`renameClass`/`renameFile`)・E2E の `fill(...)` の値もすべて推奨案の規則に収まる。`stageCatalog.test.ts` が
  模範解答を実際に適用しているので、食い違えばテストで分かる。
- `suggestMethodName` の候補の最長は、チュートリアルの `placeOrder`(6処理)から5つ選んだ
  `validateItemsAndValidateStockAndCalculateSubtotalAndCalculateTaxAndSendConfirmationMail`(87文字)。上限100で弾かない。
- `moveClassToNewFile` は `src/<クラス名><連番>.ts` を `addFile` 経由で作る。クラス名は100文字以内に収まるので、パス上限200に収まる。
- 例外: 白紙設計の部品置き場(`src/domain/blank/tray.ts`)はクラス名・パスとも `部品置き場`。
  - 名前の変更は「今と同じ名前なら成功」の早期returnがあるので、確定しても壊れない。
  - ただし部品置き場クラスを余白へドラッグすると `moveClassToNewFile` が `src/部品置き場.ts` を作ろうとし、推奨案(英数字だけ)だと
    `addFile` が `invalid-path` を返して、今は通る操作が「クラスが見つかりません」で失敗するようになる → 未決5。

## 4. TDD対象の純粋関数

すべて `// Arrange` `// Act` `// Assert` のAAAで、テストを先に書く。

### 4-1. `naming.test.ts`(新規)— 規則そのもの

`validateClassName`(`sampleCodebase()` を使う)

| ケース | 入力 | 期待 |
| --- | --- | --- |
| 正常 | `OrderValidator` | `ok('OrderValidator')` |
| 正常(前後の空白は除く) | `  OrderValidator  ` | `ok('OrderValidator')` |
| 正常(上限ちょうど) | `'A' + 'a'.repeat(99)`(100文字) | ok |
| 空 | `'  '` | `empty-class-name` |
| 長すぎ | 101文字 | `class-name-too-long` |
| 空白入り | `Order Validator` | `invalid-class-name` |
| 記号入り | `Order-Service`・`Order()` | `invalid-class-name` |
| 数字始まり | `1stStep` | `invalid-class-name` |
| 日本語 | `注文` | `invalid-class-name`(未決1でCなら ok) |
| 小文字始まり | `orderValidator` | `class-name-not-pascal-case` |
| 重複 | `TaxCalculator` | `duplicate-class-name` |

`validateMethodName`(`sampleCodebase()` の OrderService クラスを owner にする)

| ケース | 入力 | 期待 |
| --- | --- | --- |
| 正常 | `calculateTax` | ok |
| 正常(候補の最長) | 上記87文字の名前 | ok |
| 空 | `'  '` | `empty-method-name` |
| 長すぎ | 101文字 | `method-name-too-long` |
| 空白・記号・数字始まり | `calc tax`・`save()`・`2ndStep` | `invalid-method-name` |
| 大文字始まり | `CalculateTax` | `method-name-not-camel-case` |
| 同じクラスに同名 | `placeOrder` | `duplicate-method-name` |
| 重複から外す | `placeOrder` + `replacedMethodId` にそのメソッドのID | ok |

`validateFilePath`

| ケース | 入力 | 期待 |
| --- | --- | --- |
| 正常 | `src/tax/TaxPolicy.ts`・`src/app/services.ts`・`src/order-v2/Order_Item.ts` | ok |
| 正常(前後の空白は除く) | `  src/tax/TaxPolicy.ts ` | ok |
| 空 | `'  '` | `empty-path` |
| 長すぎ | 201文字 | `path-too-long` |
| 空の区間 | `src//Tax.ts`・`/src/Tax.ts`・`src/Tax.ts/` | `invalid-path` |
| 親・自分のディレクトリ | `../x.ts`・`src/./Tax.ts` | `invalid-path` |
| 拡張子なし/違い | `src/Tax`・`src/Tax.js` | `invalid-path` |
| 空白・`\` 入り | `src/my tax/Tax.ts`・`src\\Tax.ts` | `invalid-path` |
| 重複 | `src/TaxCalculator.ts` | `duplicate-path` |

### 4-2. 呼び出し側 — 既存の `it.each` 表に行を足す(配線の確認だけ。規則の網羅は 4-1 に任せる)

- `extractMethod.test.ts`(93〜94行目の表): `calc tax` → `invalid-method-name`、`CalculateTax` → `method-name-not-camel-case`
- `mergeMethods.test.ts`(182〜183行目の表): `log notification` → `invalid-method-name`
- `renameMethod.test.ts`(77行目の表): `Place Order` → `invalid-method-name`、101文字 → `method-name-too-long`
- `addClass.test.ts`・`renameClass.test.ts`: `orderValidator` → `class-name-not-pascal-case`、`Tax Policy` → `invalid-class-name`
- `addFile.test.ts`・`renameFile.test.ts`: `../x.ts` → `invalid-path`
- (未決5でAの場合)`moveToNewHome.test.ts`: パスの規則に合わない名前のクラス(`部品置き場`)も余白へ出せ、`src/部品置き場.ts` ができる

### 4-3. `RefactorUseCases.test.ts`

「エラーメッセージ」の describe(419行目〜)に、新しいエラーごとの文言を足す(`describeAddClassError('class-name-not-pascal-case')`、
`describeRenameFileError('invalid-path')`、`describeExtractError('method-name-too-long')` など)。`Record` の型で追加漏れは
型チェックでも分かるので、テストは代表だけでよい。

### 文言(推奨案の場合の例。未決1・2・6・8の確定で調整する)

新しい書き方・長さの文言は、同じエラーに同じ文言を使う(空・重複の文言は経路ごとに違うので既存のまま)。
`RefactorUseCases.ts` に `Record<Exclude<ClassNameError, 'empty-class-name' | 'duplicate-class-name'>, string>` のような
共通の表を1つずつ置き、各経路の `Record` にスプレッドで入れてよい。上限値は `naming.ts` の定数から埋め込む。

| エラー | 文言 |
| --- | --- |
| `invalid-class-name` | クラス名に使えるのは英字と数字だけです。空白や記号は使えず、数字で始めることもできません(例: OrderValidator) |
| `class-name-not-pascal-case` | クラス名は英大文字で始めてください(例: OrderValidator) |
| `class-name-too-long` | クラス名は100文字以内にしてください |
| `invalid-method-name` | メソッド名に使えるのは英字と数字だけです。空白や記号は使えず、数字で始めることもできません(例: calculateTax) |
| `method-name-not-camel-case` | メソッド名は英小文字で始めてください(例: calculateTax) |
| `method-name-too-long` | メソッド名は100文字以内にしてください |
| `invalid-path` | ファイルのパスは src/order/OrderService.ts のように、英数字・_・- の名前を / でつなぎ、.ts で終えてください |
| `path-too-long` | ファイルのパスは200文字以内にしてください |

## 5. 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る。`domain`/`application` のカバレッジ閾値を下回らない
- `naming.test.ts` が 4-1 の全ケースを持ち、`validateClassName`・`validateMethodName`・`validateFilePath` の3つだけで
  5経路(抽出・統合・名前の変更3種・クラス追加・ファイル追加)の名前の規則が決まっている(`extractMethod.ts`・`mergeMethods.ts`・
  `renameMethod.ts` に空・重複の直書きが残っていない。未決7でAの場合)
- 4-2 の各行が通る(5経路すべてで同じ規則が効いている)
- `stageCatalog.test.ts`(模範解答の適用)・`sampleAnswer.test.ts`・`suggestMethodName.test.ts`・`moveToNewHome.test.ts` が変更なしで通る
- `e2e/refactor.spec.ts` に1本追加して通る: 注文ステージでクラス名をダブルクリック → `Tax Policy` を入力して Enter →
  `getByRole('alert')` に `invalid-class-name` の文言が出て、`class-TaxCalculator` が表示されたまま(名前が変わらない)。
  既存の「重複した名前」のテスト(499行目〜)と同じ形でよい
- 既存の E2E(`refactor.spec.ts`・`blank.spec.ts`・`quiz.spec.ts` ほか)が通る
- `mergeMethods.ts` の差分が名前の検証部分(55〜57行目付近)と import だけに収まっている(`template-method-stage` との競合を小さくするため)

## 6. スコープ外

- 名前の付け方の採点(「動詞で始まらないメソッド名」の減点など)。`score.ts`・`RULE_LABEL` は触らない
- 直した候補(`calc tax` → `calcTax`)を文言に出すこと(未決9でBの場合のみ対象)
- 入力欄の `maxLength` 属性・入力中のリアルタイム検証(未決10でBの場合のみ `maxLength` は対象)
- フィールド名・継承元/インターフェース名(既存クラス名から選ぶだけなので入力ではない)の検証
- パスのファイル名とクラス名の一致チェック(`src/tax/TaxPolicy.ts` に `TaxPolicy` クラス、など)
- ステージ定義(`src/infrastructure/stages/*`)・部品置き場の名前を規則に合わせて書き換えること
- `workers/critique/` 側の長さの詰め直し(`critique-worker-hardening` の担当)
- `docs/specs/inline-edit-and-hover-submenu.md` の書き換え(検証方針の更新は本件の最終仕様に書く)

## 7. 未決事項

### 未決事項1: 名前(クラス名・メソッド名)に使える文字をどこまで認めるか

- 選択肢A(推奨): 英字と数字だけ(`_`・`$` も不可)。題材・模範解答はすべて収まり、文言も「英字と数字だけ」と一言で言える。部品置き場の件(未決5)の対処が要る
- 選択肢B: 英字・数字・`_`・`$`(ASCIIのTypeScript識別子)。`_private` のような書き方も通る。未決5の対処が要るのはAと同じ
- 選択肢C: TypeScriptの識別子すべて(日本語などUnicodeも可。`\p{ID_Start}`/`\p{ID_Continue}` の正規表現)。部品置き場の件が起きないが、`注文サービス` のような名前も通る

### 未決事項2: クラスは大文字始まり・メソッドは小文字始まりを求めるか

- 選択肢A(推奨): 求める。クラスの先頭は英大文字、メソッドの先頭は英小文字。「識別子として書けない」とは別のエラー・文言(「英大文字で始めてください」)にする。対象プレイヤーに命名の基本をそろえる狙いに合う(未決1でCの場合は、先頭が英字のときだけ大小を見る)
- 選択肢B: 求めない。識別子として書ければ `orderValidator` クラスや `CalculateTax` メソッドも通す

### 未決事項3: 予約語(`class`・`new`・`delete` など)を弾くか

- 選択肢A(推奨): 弾かない。メソッド名は予約語でもTypeScriptで書ける(`delete() {}` は正しい)。クラス名は未決2でAなら大文字始まりになり予約語と重ならない
- 選択肢B: 弾く。`naming.ts` に予約語の一覧を持ち、別エラー(`reserved-*`)にする

### 未決事項4: ファイルのパスの形をどこまで決めるか

- 選択肢A(推奨): `/` 区切りで、各区間は1文字以上の「英数字・`_`・`-`」、最後の区間は `.ts` で終わる。空の区間・先頭/末尾の `/`・`.`・`..`・空白・`\` は弾く。`src/` 始まりとファイル名の大小は求めない(題材に `src/app/services.ts` がある)
- 選択肢B: Aに加えて `src/` で始まることを必須にする(題材・模範解答はすべて `src/` 始まり)
- 選択肢C: 最低限だけ。空白・`\`・空の区間・`.`/`..` の区間を弾き、拡張子と文字の種類は問わない

### 未決事項5: (未決1でA/Bの場合)部品置き場のクラスを余白へドラッグしたときの自動パス `src/部品置き場.ts` をどうするか

- 選択肢A(推奨): 余白へのドラッグで自動で作るパス(`moveToNewHome.ts` の `moveClassToNewFile`)はプレイヤーの入力ではないので、`addFile` の検証を通さずにファイルを足す(重複は採番で避けているので安全)。今通る操作が通り続ける。`moveToNewHome.ts` に数行の差分が出る
- 選択肢B: 弾かれることを許容する(白紙設計で部品置き場のクラスごと余白へ出す操作はまず無い)。ただし今は通る操作が「クラスが見つかりません」で失敗するようになる
- (未決1でCを選んだ場合、この質問は不要)

### 未決事項6: 長さの上限をいくつにするか

- 選択肢A(推奨): クラス名・メソッド名100文字、パス200文字。名前候補の最長(87文字)を弾かず、余白へのドラッグで作る `src/<クラス名><連番>.ts` もパスの上限に収まる
- 選択肢B: クラス名・メソッド名128文字、パス256文字(余裕を大きく取る。AI講評に入る文字列はAより長くなりうる)
- (64文字など、87文字を下回る値は名前候補を弾いてしまうので候補に入れていない)

### 未決事項7: メソッド名の検証を `naming.ts` に共通化するか

- 選択肢A(推奨): `naming.ts` に `validateMethodName(owner, rawName, replacedMethodId?)` を足し、`extractMethod.ts`・`mergeMethods.ts`・`renameMethod.ts` の「空・重複」の直書き3か所をこれに置き換える。規則が1か所に集まる。`mergeMethods.ts` の差分は55〜57行目と import だけ
- 選択肢B: 書き方・長さの判定だけを共通関数にし、「空・重複」の直書きは3か所に残す。`mergeMethods.ts` の差分は1〜2行の追加で最小になるが、同じ判定の重複は残る

### 未決事項8: 規則違反のエラーを原因ごとに分けるか

- 選択肢A(推奨): 分ける。名前は「使えない文字」「大小の書き方」「長すぎ」の3種、パスは「形が正しくない」「長すぎ」の2種。文言で直し方を具体的に言える
- 選択肢B: 1つにまとめる(クラス名・メソッド名・パスごとに `invalid-*` の1種)。文言に規則を全部書く(例:「クラス名は英大文字で始め、英数字だけで100文字以内にしてください」)

### 未決事項9: 規則に合わないとき、直した候補を文言で示すか

- 選択肢A(推奨): 示さない。規則と例を書いた固定の文言だけにする(`describeXError(error)` の形のまま、presentation は変更なし)
- 選択肢B: 示す(`calc tax` → 「calcTax ではどうですか」)。候補を作る関数と、入力値を受け取る文言関数が要り、`useGameStore.ts` の呼び出しも変わる

### 未決事項10: 入力欄に `maxLength` 属性を付けるか

- 選択肢A(推奨): 付けない。domain の検証で弾き、文言で上限を伝えれば足りる。`CanvasContextMenu.tsx`・`MethodEditor.tsx`(`template-method-stage` などと競合しうる)に差分を出さない
- 選択肢B: 付ける。`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`MethodChip.tsx`・`InlineEditableLabel.tsx` の `<input>` に上限値の `maxLength` を足す(上限を超えて入力できなくなる。domain の検証は残す)
