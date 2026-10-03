# コードタブをVSCode風に色分けし、人間が書いたような整形にする

## 背景・目的

メソッドエディタの「コード」タブ(`src/presentation/editor/ClassCodePreview.tsx`)は、生成したC#疑似ソースを
単色の `<pre><code>` で表示している。そのため

- キーワード・文字列・コメントの区別が付かず読みにくい
- チュートリアル1のFragmentコードは `foreach (var row in rows) Console.WriteLine(row);` のように1行に詰め込まれ、
  メソッドの宣言も `public void run() {` と書かれていて、メソッド同士が空行なしでくっつく。画面幅を超えて横スクロールも出る

プレイヤーが「これは本物のプログラムだ」と感じて読めるよう、VSCodeのエディタのように色分けし、人間が書いたような
改行・空行・行番号付きで表示する。

## 変更対象ファイル一覧

### 変更

- `package.json` / `package-lock.json`: `highlight.js` を `dependencies` に追加する(CLAUDE.mdの「新しい依存は極力足さない」方針に対し、
  色分けの正確さと将来のTypeScript対応を優先する、とユーザーが判断済み)
- `src/domain/codebase/generateClassSource.ts`(domain)
  - メソッド宣言を波括弧を別行に置くスタイル(Allman、クラス宣言と同じ)にする:
    ```
        public void run()
        {
            ...
        }
    ```
    本体なし(契約メソッド)は従来どおり `public void run();`
  - フィールド宣言の並びとメソッドの間、およびメソッドとメソッドの間に空行を1行入れる(クラスの `{` の直後と `}` の直前には入れない)
- `src/domain/codebase/generateClassSource.test.ts`(domain・TDD対象): 上記の整形に合わせて既存の期待値(`'public void run() {'` など)を
  更新し、空行のケースを追加する
- `src/presentation/editor/ClassCodePreview.tsx`(presentation)
  - `highlight.js/lib/core` と `highlight.js/lib/languages/csharp` だけを import して登録する(全言語バンドルは入れない)
  - 生成ソースを `hljs.highlight(source, { language: 'csharp' }).value` で色分けしたHTMLにして `<code>` に出す
    (highlight.js は入力をエスケープして出力するため、`dangerouslySetInnerHTML` を使ってよい。ESLintに止められたら理由コメント付きで
    その行だけ無効化する)
  - 左に行番号の列を付ける。ソースの行数ぶんの `1..n` を並べた別カラム(`aria-hidden`、選択・コピーの対象外 `user-select: none`)にし、
    本文と同じ `line-height`・フォントにして行を揃える。折り返しは行番号とずれるので行わず、横スクロールのまま(整形で長い行を減らす)
  - 言語プルダウン・`role="tabpanel"`・`aria-label="コード"`・`pre code` の構造は維持する(既存E2Eの `pre code` セレクタが通ること)
- `src/index.css`: 色分け用のスタイルを追加する。highlight.js のテーマCSSは読み込まず、`.hljs-keyword` `.hljs-string` `.hljs-comment`
  `.hljs-number` `.hljs-title` `.hljs-type` `.hljs-built_in` など自前のクラスにVSCodeの配色を割り当てる。
  色はCSSカスタムプロパティにし、`index.css` が既に対応しているライト/ダーク(`prefers-color-scheme`)の両方に
  VSCode Light+ / Dark+ 相当の配色を用意する。コードの背景・文字色もエディタ風にする
- `src/infrastructure/stages/tutorialStages.ts`(infrastructure/データ): チュートリアル1の5つのFragmentの `code.csharp` を、
  人間が書いたように複数行へ整形し直す(下記「整形の方針」)

### 新規

- `e2e/class-code-preview.spec.ts` の既存ケースに追記(新規ファイルは作らない)

## データ・型の変更

なし(`Fragment.code` の型はそのまま。中身の文字列を整形し直すだけ)。

## 整形の方針(tutorialStages.ts のコード文字列)

- 1つの文に複数の処理を詰めない。`foreach (...) 文;` は `{ }` ブロックにして本体を次の行へ字下げする
- LINQのメソッドチェーンは、2つ以上つなぐときは1呼び出しごとに改行して字下げする(`.Where(...)` `.Select(...)` など)
- 三項演算子など長い式(おおむね80桁超)は演算子の位置で改行する
- ひと続きの処理の途中に意味のまとまりの区切りがあれば、Fragment内に空行を1行入れてよい
- インデントは4スペース。`Fragment.lines`(ゲーム上の行数)は変更しない(`code` の実際の行数とは別物、のまま)

## TDD対象の純粋関数

`generateClassSource(codebase, classId, language): string`(既存・整形ルールの変更)。追加・更新するテスト(AAA):

1. 本体ありメソッド → `public void run()` の次の行が `    {`、最後に `    }` となり、波括弧が宣言行に同居しない
2. 契約メソッド(`fragments: []`)→ 従来どおり `;` で終わり、波括弧なし
3. 2つ以上のメソッド → メソッド間にちょうど1行の空行が入る
4. フィールドとメソッドがある → フィールド群とメソッド群の間に空行が1行入る。フィールドが無いクラスは先頭メソッドの前に余分な空行が出ない
5. メソッドが1つだけ・フィールドなし → クラスの `{` の直後・`}` の直前に空行が入らない
6. 既存のテスト(フィールド順・継承表記・存在しないclassId・プレースホルダー)は、新しい整形に合わせて期待値だけを更新して通る

`ClassCodePreview` の色分けと行番号は表示コンポーネントなのでユニットテスト対象外とし、E2Eで守る。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- チュートリアル1で `printMonthlyReport` を選び「コード」タブを開くと:
  - `public` `private` `class` `void` `var` `foreach` `in` などのキーワード、`"商品名 | 数量 | 売上"` などの文字列、`// …` のコメント、
    数値が、それぞれ別の色で表示される(highlight.js のクラス `hljs-keyword` `hljs-string` `hljs-comment` 付きの要素が存在する)
  - 左に行番号(1から)が出て、行番号の数とコードの行数が一致する。行番号はコードのコピーに含まれない
  - メソッドとメソッドの間に空行がある。メソッドの `{` は宣言の次の行にある
  - `foreach` の本体が `{ }` ブロックになっていて、`Console.WriteLine(row);` が別行に字下げして表示される
  - LINQのチェーンが呼び出しごとに改行されている
- ライト・ダークどちらの配色でもコードが読める(背景と文字色のコントラストが確保されている)
- 既存の表示(`public class ReportService`・`var monthlySales`・`Console.WriteLine` の文字列がテキストとして含まれる、言語プルダウンが `csharp`)
  は変わらず、既存E2Eが通る
- バンドルに highlight.js の全言語が入らない(`core` + `csharp` のみのimport)

## スコープ外

- `call-fragment-code`(Issue #31)の呼び出し行の描画(`{name}();`)。同じ `generateClassSource.ts` の `renderMethod` を触るので、
  実装は#31のマージ後にその上へ乗せる(どちらが先でも、後からのブランチが rebase して衝突を解消する)
- チュートリアル1以外のステージのC#コード書き足し・整形
- TypeScriptなど他言語のレンダラー・ハイライト(`CodeLanguage` は `'csharp'` のみのまま)
- コードの編集・コピー用ボタン・行ハイライト・折りたたみ
- 長い行の自動折り返し(行番号とずれるため。整形で回避する)
- ミニマップ・検索など、VSCodeのその他の機能
