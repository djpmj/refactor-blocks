# 呼び出し行(call Fragment)のコードを `// 未入力` ではなく呼び出し文で表示する

## 背景・目的

メソッドエディタの「コード」タブ(`class-code-preview-tab`)は、各Fragmentの `code.csharp` を並べてC#疑似ソースを作り、
`code` が無いFragmentは `// 未入力: <label>` と表示する。

ところが Extract Method(`src/domain/codebase/extractMethod.ts`)が元のメソッドに残す「呼び出し行」
(`label: '<name>() を呼び出す'`, `responsibility: 'call'`, `uses: [新メソッドID]`)は `code` を持たない。
そのため、チュートリアル1でメソッドを分割すると、分割元メソッド(`printMonthlyReport`)の本体が

```
// 未入力: aggregateSales() を呼び出す
// 未入力: compareWithLastMonth() を呼び出す
```

となり、「分割したのに呼び出しが未入力」という不自然な表示になる(抽出された側のメソッドには元のコードが残るので正しく出る)。
`intermediateStages.ts` の手書きの呼び出し行(`checkoutCart` の2件)も同じ。

呼び出し行のコードは、呼び出し先メソッド(`fragment.uses`)から決まる。`code` として固定文字列を持たせるとリネームで古くなり
(`renameMethod` はFragmentを書き換えない)、データも重複するので、**コード生成時に導出する**。

## 変更対象ファイル一覧

### 変更

- `src/domain/codebase/generateClassSource.ts`(domain)
  - Fragmentの本文を決める処理を「`code[language]` があればそれ → 無く、かつ `responsibility === 'call'` で
    `uses` に解決できるメソッドがあれば呼び出し文 → それ以外は `// 未入力: <label>`」の順にする
  - 呼び出し文はC#で `{メソッド名}();`(`uses` の各メソッドについて1行ずつ、`uses` の順)
  - メソッドIDの解決には `Codebase.ts` の既存ヘルパー(`findMethod`)を使う。`renderMethod` が `codebase` を受け取るようにする
  - `responsibility === 'call'` の判定は `src/domain/scoring/responsibilities.ts` の `CALL_RESPONSIBILITY` を再利用する
    (新しい定数・重複定義は作らない。domain内の層をまたぐimportになる場合は既存の `extractMethod.ts`/`mergeMethods.ts` と同じ扱いにする)
- `src/domain/codebase/generateClassSource.test.ts`(domain・TDD対象): ケース追加

### 新規

- `e2e/class-code-preview.spec.ts` に1ケース追加(新規ファイルは作らない): チュートリアル1でメソッドを抽出したあと、
  元メソッドの「コード」タブに `aggregateSales();` が出て、呼び出し行について `未入力` が出ない

## データ・型の変更

なし。`Fragment`・`Method`・`extractMethod` は変更しない。

## TDD対象の純粋関数

`generateClassSource(codebase, classId, language): string`(既存)。追加するテストケース(AAA):

1. `responsibility: 'call'`・`uses: [存在するメソッドID]`・`code` 無しのFragmentを持つメソッド
   → 本体に `{呼び出し先メソッド名}();` が出て、`未入力` を含まない
2. `uses` に2つのメソッドIDがある call Fragment → `a();` `b();` が `uses` の順に1行ずつ出る
3. call Fragmentでも `code.csharp` が書かれていればそちらを優先する
4. call Fragmentだが `uses` が空、または `uses` のIDがCodebaseに存在しない → 従来どおり `// 未入力: <label>`
5. 呼び出し先メソッドをリネームした後に生成 → 新しい名前の `{新名}();` が出る(`extractMethod` 後に `renameMethod` を呼んで確認)
6. `responsibility` が `'call'` 以外で `code` 無し → 従来どおり `// 未入力: <label>`(`uses` があっても呼び出し文にはしない)

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- チュートリアル1で `printMonthlyReport` から複数の処理を「メソッドとして抽出」したあと、
  `printMonthlyReport` を選んで「コード」タブを開くと、呼び出し行が `{新メソッド名}();` と表示され、`// 未入力` にならない
- 抽出された側のメソッド(`aggregateSales` など)は、これまで通り元のFragmentのコードが表示される
- `intermediateStages.ts` の `checkoutCart` の呼び出し行も `calculateShippingFee();` / `addPoints();` と表示される
- 上記を確認するE2E(`e2e/class-code-preview.spec.ts`)が通る
- Inline Method(`inlineMethod`)で呼び出し行が元の処理に戻ったあとは、元のコードがそのまま表示される(既存動作に影響が無い)

## スコープ外

- `code` を持たない通常Fragment(チュートリアル1以外の既存ステージ)のC#コード書き足し(`class-code-preview-tab` のスコープ外のまま)
- Merge Methods(`mergeMethods.ts` の `mergeFragment`)が統合後Fragmentに `code` を引き継がない問題(別タスク)
- 呼び出し行の `label`(`〇〇() を呼び出す`)がリネームで古くなる件(今回はコード表示のみ直す)
- 引数・戻り値・`this.` 修飾など、実際のC#に近づける呼び出し文の表現(`Field`/`Method` に型情報が無いため、`{name}();` 固定)
- TypeScript向けレンダラー(`CodeLanguage` は `'csharp'` のみのまま)
