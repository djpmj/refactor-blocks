# メソッドエディタにコードプレビュータブを追加する

## 背景・目的

メソッドを選択したときに右側に出る「メソッドエディタ」(`src/presentation/editor/MethodEditor.tsx`)は、
現状「処理(Fragment)の一覧から選んで抽出する」操作画面のみを表示している。ブロック(Fragment)は
ラベル・行数・責務タグなど抽象化されたデータしか持たず、プレイヤーは「これが実際のプログラムだと
どう書かれているか」を確認できない。

抽象的なブロック操作と実際のソースコードを行き来できるようにし、プレイヤーがリファクタリング操作の
結果を実コードのイメージで理解できるようにする。プログラム言語は将来複数(まずC#、将来的にTypeScript)
に対応できる形にしておく。

## 変更対象ファイル一覧

### 変更

- `src/domain/codebase/Codebase.ts`(domain)
  - `CodeLanguage` 型(`'csharp'` のみ。TypeScript追加時にここへ `'typescript'` を足す)を追加
  - `Fragment` に `code?: Partial<Record<CodeLanguage, string>>` を追加(言語ごとの実コード本文。省略可)
- `src/presentation/editor/MethodEditor.tsx`(presentation)
  - `MethodEditorBody` にタブ切り替え(`role="tablist"`)を追加。「編集」タブ(既存のFragment一覧+抽出UI)と
    「コード」タブ(新規)の2つ。タブの選択状態はコンポーネント内の`useState`で保持する(メソッドを
    切り替えると`key={method.id}`で状態ごとリセットされる、既存の挙動のまま)
- `src/infrastructure/stages/tutorialStages.ts`(infrastructure/データ)
  - `tutorial-extract-method`(チュートリアル1)の`ReportService.printMonthlyReport`配下、5つの
    Fragment(`frag-aggregate-sales`/`frag-compare-last-month`/`frag-table-header`/`frag-table-rows`/
    `frag-print`)に`code: { csharp: '...' }`を追加する

### 新規

- `src/domain/codebase/generateClassSource.ts`(domain)
  - `Codebase`・クラスID・`CodeLanguage` を受け取り、そのクラスの疑似ソースコード文字列を組み立てる
    純粋関数
- `src/domain/codebase/generateClassSource.test.ts`(domain・TDD対象)
- `src/presentation/editor/ClassCodePreview.tsx`(presentation)
  - 「コード」タブの中身。言語選択のプルダウンと、`generateClassSource`の結果を`<pre><code>`で表示する
- `e2e/class-code-preview.spec.ts`(E2E)
  - 新しいタブ操作(プレイヤーの新しい操作導線)のPlaywrightテスト

## データ・型の変更

`src/domain/codebase/Codebase.ts` に追記する型:

```ts
/** コードプレビューに対応する言語。今はC#のみ。TypeScript対応時はここに 'typescript' を追加する。 */
export type CodeLanguage = 'csharp';
```

`Fragment` 型に1フィールド追加:

```ts
/**
 * この処理の実際のソースコード(表示用)。言語ごとに省略可能。
 * 未入力の言語のときはgenerateClassSourceがプレースホルダーのコメントを出す。
 * lines(ゲーム上の行数)と実際の行数が一致している必要はない(別物として扱う)。
 */
readonly code?: Partial<Record<CodeLanguage, string>>;
```

### `Field`・`Method` に型情報が無いことについて

`Field`・`Method` はどちらも値の型(戻り値の型・フィールドの型)を持たない。コード生成では
フィールド宣言・メソッドの戻り値型に固定のプレースホルダー型を使う(C#では フィールド=`object`、
メソッド戻り値=`void`)。型情報をデータとして持たせる変更は今回のスコープ外(下記「スコープ外」)。

## TDD対象の純粋関数

`src/domain/codebase/generateClassSource.ts` の `generateClassSource(codebase: Codebase, classId: string, language: CodeLanguage): string`。

実装方針(C#レンダラー):
- クラス宣言: `public class {Name}`。`parentIds(codeClass)`(既存ヘルパー、継承元→実装先の順)を
  使い、1件以上あれば ` : {親1}, {親2}, ...` を続ける(見つからない親IDは`findClass`が`undefined`を
  返すのでスキップする、既存の`findInterfaces`と同じ考え方)
- フィールド宣言: `fieldsOf(codeClass)`(既存ヘルパー)の順に `{visibility} object {name};`
- メソッド: `method.fragments.length === 0` なら本体なしの契約メソッドとして `{visibility} void {name}();`
  で終える。それ以外は `{visibility} void {name}() { ... }` とし、本体に各Fragmentを上から順に差し込む
  - `fragment.code?.csharp` があればその文字列をそのまま(複数行ならそのまま改行を保って)差し込む
  - 無ければ `// 未入力: {fragment.label}` という1行のプレースホルダーを差し込む
- インデントは4スペース単位(クラスメンバ4、メソッド本体8)

テストケース(AAA、`sampleCodebase()`など既存の`testFixtures.ts`を再利用できるものは再利用し、
継承・フィールドなど既存フィクスチャに無いものだけ本テストファイル内で組み立てる):

1. フィールド無し・1メソッド・Fragment全部に`code.csharp`ありのクラス → クラス宣言・メソッド宣言・
   各Fragmentのコードがその順で含まれる
2. Fragmentに`code.csharp`が無いものが混ざる → そのFragmentの箇所だけ `// 未入力: <label>` になる
3. `fields`があるクラス → `{visibility} object {name};` がフィールド宣言順に含まれる
4. `superclassId`・`interfaceIds`があるクラス → `: 親, 実装1, 実装2` の順で続く。存在しない親IDは無視される
5. `method.fragments === []`(契約メソッド)→ 本体の`{ }`が無く、`;`で終わる
6. 存在しないclassIdを渡す → 空文字列を返す

## 受け入れ基準

- `src/domain/codebase/generateClassSource.test.ts` の全ケースが通る
- チュートリアル1(`tutorial-extract-method`)で以下の操作ができる:
  1. `ReportService.printMonthlyReport` をクリックしてメソッドエディタを開く
  2. 「コード」タブをクリックすると、`ReportService`クラス全体のC#疑似コードが表示される
  3. `printMonthlyReport`の本体に、5つのFragmentに対応するコード(今回書き足すC#)が順番に表示される
  4. 言語プルダウンには現時点で「C#」のみが選択肢としてある
  5. 「編集」タブに戻すと、今まで通りFragment一覧・抽出操作ができる(既存動作に影響がない)
- タブ(「編集」/「コード」)はキーボードだけで操作できる(`<button>` + `role="tablist"`/`tab`/
  `tabpanel`。Tabキーでフォーカス、Enter/Spaceで切り替え)
- `npm run check`(lint + typecheck + test)がすべて通る
- `e2e/class-code-preview.spec.ts` が、上記「コード」タブへの切り替えとコード表示を確認し、通る

## スコープ外

- チュートリアル1以外の既存ステージ(約20ファイル分のFragment)へのC#コードの書き足しは、別タスクで
  段階的に行う。今回は`code`が無いFragmentは生成コード中で `// 未入力: <label>` と表示するだけでよい
- TypeScript向けレンダラーの実装(型・`CodeLanguage`への`'typescript'`追加・プルダウンの選択肢追加は
  将来の別タスク)
- `Field`・`Method`への型情報(戻り値の型・フィールドの型)の追加。今回は固定のプレースホルダー型
  (`object`/`void`)で表示する
- 生成したコードをプレイヤーが編集できるようにすること(表示専用。読み取り専用の`<pre>`でよい)
- Fragment.lines(ゲーム上の行数)と`code`の実際の行数を一致させる検証
