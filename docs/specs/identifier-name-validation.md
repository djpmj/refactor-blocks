# identifier-name-validation: `1bad name` のような識別子として不正な名前で、メソッドやクラスを作れてしまう

## 症状

`extract-name-inline-error.md` で、抽出するメソッド名が重複していれば押す前に止めるようにした。そのときスコープ外にした「名前の書式の検証(必要だと実機で分かったら別の仕様にする)」の続きにあたる。今回、実機で問題が出た。

再現手順(中級6: 他人のデータばかり触るメソッド):

1. メソッドを選び、メソッドエディタで処理を1つ選ぶ
2. 「新しいメソッド名」に `1bad name`(数字で始まり、空白を含む)を入れる
3. 「選んだ処理をメソッドとして抽出」ボタンは押せるままで、説明も出ない。プレビューに「新しい 1bad name 7行」と出る
4. 押すと、キャンバスに `1bad name()` というメソッドができ、呼び出し側にも「1bad name() を呼び出す」と出る

メソッド名の変更(ダブルクリック)、クラス名の変更(ダブルクリック・右クリックメニュー)、クラスの追加、統合後のメソッド名でも、同じ名前が通る。コードタブの表示や C# の実行(`csharpWiring.ts` の `identifierPattern` は `[A-Za-z_]\w*` しか識別子とみなさない)で壊れる恐れがある。

## 原因

名前の検証は「空」と「重複」しか見ておらず、書式はどこでも見ていない。検証している場所は次の通り(grep で確認済み。ほかの入口はない):

| 入口 | 検証している場所 |
| --- | --- |
| メソッドの抽出 | `src/domain/codebase/extractMethod.ts` の `validate`(44〜46行目)と、押す前の表示の `src/presentation/editor/extractDisabledReason.ts` の `blockOf` |
| メソッド名の変更 | `src/domain/codebase/renameMethod.ts`(11〜14行目) |
| メソッドの統合 | `src/domain/codebase/mergeMethods.ts` の `validate`(90〜92行目) |
| クラス名の変更・クラスの追加 | `src/domain/codebase/naming.ts` の `validateClassName`(`renameClass.ts` と `addClass.ts` の両方から呼ばれる) |

自動で付く名前(`suggestMethodName` の `extractedMethod`、`moveToNewHome` の `NewClass`、`autoNameClasses`)と、ステージ定義にある名前はすべて ASCII の英字で始まる識別子になっている(`src/infrastructure/stages` の `name:` に ASCII 以外の文字はない)。新しい検証を入れても、既存のステージや模範解答の手順は壊れない。

## 修正

### 許す書式(確定)

`/^[A-Za-z_][A-Za-z0-9_]*$/`。ASCII の英字か `_` で始まり、そのあとは英字・数字・`_` だけが続く名前を許す。

- 日本語などの ASCII 以外の文字は**許さない**。C# と TS の言語仕様は Unicode の識別子を許す。しかし `csharpWiring.ts` の `identifierPattern`(`[A-Za-z_]\w*`。`u` フラグがないので ASCII だけ)が置き換えられなくなり、C# 実行が壊れる。ステージ定義も ASCII だけなので、許しても使い道がない
- `$` は許さない(C# の識別子では使えない)
- 予約語(`class`・`int` など)はスコープ外にする(下記)

### 変更するファイル

| 種別 | パス | 層 | 変更 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/naming.ts` | domain | `isValidIdentifier` を足す。`ClassNameError` に `'invalid-class-name'` を足し、`validateClassName` で空のチェックと重複のチェックの間に書式を見る |
| 変更 | `src/domain/codebase/extractMethod.ts` | domain | `ExtractMethodError` に `'invalid-method-name'` を足す。`validate` で空のチェックと重複のチェックの間に `isValidIdentifier` を見る |
| 変更 | `src/domain/codebase/renameMethod.ts` | domain | `RenameMethodError` に `'invalid-method-name'` を足す。空のチェックと重複のチェックの間で見る |
| 変更 | `src/domain/codebase/mergeMethods.ts` | domain | `MergeMethodsError` に `'invalid-method-name'` を足す。空のチェックと重複のチェックの間で見る |
| 変更 | `src/application/RefactorUseCases.ts` | application | エラー文の表(`Record` なので足さないと型エラーになる)に下の文言を足す |
| 変更 | `src/presentation/editor/extractDisabledReason.ts` | presentation | `blockOf` で、名前が空のチェックと重複のチェックの間に書式を見る(`nameInvalid: true`) |
| 新規 | `e2e/identifier-name-validation.spec.ts` | E2E | 受け入れ基準を確かめる |

```ts
// src/domain/codebase/naming.ts
/** クラス名・メソッド名として使える名前か(ASCII の英字か _ で始まり、英字・数字・_ だけ)。前後の空白は呼び出し側で trim してから渡す。 */
export function isValidIdentifier(name: string): boolean;

export type ClassNameError = 'empty-class-name' | 'invalid-class-name' | 'duplicate-class-name';
```

- 検証の順は、どの入口でも**空 → 書式 → 重複**にする。既存の名前はすべて書式を満たすので、書式が不正なら重複にはならない
- `renameMethod` / `renameClass` では「今と同じ名前なら成功」のチェックを先に置いたままにする
- `isValidIdentifier` は `trim` しない(`' a'` は `false`)。呼び出し側はどこもすでに `trim()` してから比べている
- `mergeMethods.validate` は、1行足すと循環的複雑度がちょうど12になる見込み。lint で超えたら、名前の検証の3行を同じファイル内の小さな関数に切り出す

### 文言

| 場所 | キー | 文 |
| --- | --- | --- |
| 抽出ボタンの下(押す前) | — | `「<trim した名前>」はメソッド名に使えません。英字・数字・_ だけを使い、数字から始めないでください` |
| `EXTRACT_ERROR_MESSAGES` / `RENAME_METHOD_ERROR_MESSAGES` | `invalid-method-name` | `メソッド名には英字・数字・_ だけを使い、数字から始めないでください` |
| `MERGE_ERROR_MESSAGES` | `invalid-method-name` | `統合後のメソッド名には英字・数字・_ だけを使い、数字から始めないでください` |
| `RENAME_CLASS_ERROR_MESSAGES` / `ADD_CLASS_ERROR_MESSAGES` | `invalid-class-name` | `クラス名には英字・数字・_ だけを使い、数字から始めないでください` |

### 画面での動き

- **抽出**: 重複のときと同じ扱いにする。ボタンを押せなくし、ボタンの下(`#method-editor-extract-disabled-reason`)に上の文を出す。入力欄は `aria-invalid="true"` にし、`aria-describedby` で説明につなぐ。プレビューは `previewExtractMethod` が `extractMethodUseCase` の失敗で `undefined` を返すので、ドメインを直せば自然に消える(コードの追加は要らない)。優先順は「選択なし > 非連続 > 空 > 書式 > 重複」
- **メソッド名・クラス名の変更、クラスの追加、統合**: 今の重複名と同じ失敗の流れ(`apply` のトースト `role="alert"` に理由を出し、入力欄に留まり、名前は変わらない)に乗せる。画面側のコードの変更は要らない
  - 押す前の表示を足すかどうかについて: 名前変更の入力欄には、重複名でも押す前の表示の仕組みがない。今回足すと、重複名も含めて作り直すことになる。実機で困ったら別の仕様にする(スコープ外)

## テスト

先に書いて、失敗することを確かめてから直す。いずれも AAA パターンで書く。

### `isValidIdentifier`(`src/domain/codebase/naming.test.ts`、`it.each` のケース表)

| 入力 | 期待 | 意図 |
| --- | --- | --- |
| `calculateTotal` | true | camelCase |
| `TaxCalculator` | true | PascalCase |
| `_cache` | true | `_` で始まる |
| `x` | true | 1文字 |
| `method2` | true | 2文字目以降の数字 |
| `snake_case` | true | 途中の `_` |
| `1bad` | false | 数字で始まる |
| `bad name` | false | 空白を含む |
| `1bad name` | false | 実機で再現した入力 |
| `bad-name` | false | 記号 `-` |
| `bad.name` | false | 記号 `.` |
| `$x` | false | `$` は C# で使えない |
| `メソッド` | false | ASCII 以外 |
| `naïve` | false | ASCII 以外の英字 |
| `''` | false | 空 |
| `' padded'` | false | trim しない |

### ドメインの操作(既存のテストファイルに足す)

- `validateClassName`: `Tax Calculator` → `err('invalid-class-name')`。`'  '` → 今のまま `err('empty-class-name')`(空が先)。`' TaxPolicy '` → `ok('TaxPolicy')`
- `addClass` / `renameClass`: `1Tax` → `err('invalid-class-name')`。コードベースは変わらない
- `extractMethod`: `newMethodName: '1bad name'` → `err('invalid-method-name')`。`'  '` → `err('empty-method-name')` のまま
- `renameMethod`: `'1bad name'` → `err('invalid-method-name')`。今と同じ名前なら今のまま `ok`
- `mergeMethods`: `newMethodName: 'bad name'` → `err('invalid-method-name')`

### `extractDisabledReason` / `extractNameInvalid`(`src/presentation/editor/extractDisabledReason.test.ts`)

- 連続 × `1bad name` → `「1bad name」はメソッド名に使えません。英字・数字・_ だけを使い、数字から始めないでください`
- 連続 × `'  1bad name '` → 文の中の名前は trim した `1bad name`
- 選択なし × 不正 → 選択なしの文。非連続 × 不正 → 非連続の文
- `extractNameInvalid` のケース表(76行目〜)に「選択なし / 連続 / 非連続 × 不正」の3行を足す。期待は「連続 × 不正」だけ `true`
- 96行目で表示中の理由と一致するかを見ている箇所は、`startsWith('同じクラスに')` だけだと書式の場合に合わない。「重複の文か書式の文のとき `true`」と比べる形に直す

### E2E(`e2e/identifier-name-validation.spec.ts`)

- 抽出(チュートリアル1。`extract-name-inline-error.spec.ts` と同じ手順で処理を1つ選ぶ): 名前に `1bad name` を入れると、ボタンが disabled になり、説明が上の文になり、プレビューが消え、入力欄が `aria-invalid="true"` になる。自動で付いた名前に戻すと、ボタンが押せてプレビューが戻る
- メソッド名の変更(チュートリアル2。`refactor.spec.ts` の `openOrderStage` と同じ手順): `method-placeOrder` をダブルクリックして `1bad name` を入れ、Enter を押す。`.app__canvas` の `alert` にメソッド名の書式の文が出て、`method-placeOrder` が残り、`method-1bad name` はない
- クラス名の変更(チュートリアル2): `class-header-TaxCalculator` の名前をダブルクリックし、`Tax Calculator` を入れて Enter を押す。`alert` にクラス名の書式の文が出て、`class-TaxCalculator` が残る

## 受け入れ基準

1. 中級6で症状の再現手順をもう一度やると、`1bad name` を入れた時点でボタンが押せなくなり、ボタンの下に書式の説明が出て、プレビューは消える。キャンバスに `1bad name()` はできない
2. メソッド名の変更・クラス名の変更・クラスの追加・統合で、識別子として不正な名前を入れると理由が出て、名前は変わらない
3. 重複名の既存の挙動(`extract-name-inline-error.spec.ts`、`refactor.spec.ts` の重複名のテスト)が今のまま通る
4. 全ステージのカタログ・模範解答のテスト(`src/infrastructure/stages/*.test.ts`)が今のまま通る
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- C#・TS の予約語(`class`・`int`・`void` など)を名前に使えなくすること。プレイヤーがわざわざ入れるとは考えにくく、今は推測にすぎない。実機で出たら `isValidIdentifier` に予約語の一覧を足す
- 名前変更・クラス追加の入力欄に、押す前(入力中)の表示を足すこと。今の重複名と同じく、確定時のトーストで理由を伝える
- 命名規則(メソッドは camelCase、クラスは PascalCase)の強制・採点。プレイヤーに命名を考えさせる仕様にはしない
- ファイルのパス(`validateFilePath`)の書式。パスはプレイヤーに表示しない内部の識別子(`hide-file-names.md`)
- 日本語の識別子を許すこと(上の「許す書式」の理由による)
