# フィールドをクリックで説明表示、コードにはコメントと実際の型を出す

## 背景・目的

クラスの中に並ぶフィールド(`baseSalary`・`overtimeRate` など。ユーザーの言う「定数」)について、次の3点が分かりにくい。

1. **クリックしても何も起きない**。メソッドは、クリックすると右側のメソッドエディタに中身が出るのに、フィールドはドラッグ(別クラスへ移動)しかできず、
   「これは何のデータか」「どのメソッドが使っているか」を確認する手段が無い。フィールドの移動(Move Field)や Feature Envy の判断には、
   このデータが何者でどこから触られているかが分かる必要がある。
2. **コードプレビューにフィールドの説明が無い**。「コード」タブのC#疑似ソースで、フィールドが `private object baseSalary;` と宣言だけ並び、何のデータか読み取れない。
3. **型がすべて `object`**。`Field` が型情報を持たないため、フィールドは全部 `object` と表示され、実際のC#らしくない
   (`class-code-preview-tab` では型情報の追加をスコープ外にした。今回それを足す)。

フィールドにも**クリックで右側に説明を出し**、**コードに説明のコメントと本物の型を出す**。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/codebase/Codebase.ts` | domain | 変更 | `Field` に任意の `description?: string`(日本語の説明)と `type?: Partial<Record<CodeLanguage, string>>`(言語ごとの型。`Fragment.code` と同じ形)を追加 |
| `src/domain/codebase/fieldUsage.ts` + `.test.ts` | domain | 新規 | `fieldUsage(codebase, fieldId)`: そのフィールドを読む・書くメソッドの一覧を返す純粋関数(TDD、下記) |
| `src/domain/codebase/generateClassSource.ts` + `.test.ts` | domain | 変更 | フィールドの宣言を、説明コメント+型付きの宣言にする(下記)。テストの期待値(`object`)を更新 |
| `src/infrastructure/stages/intermediateStages.ts` / `advancedStages.ts` | infrastructure | 変更 | `fields` を持つ6ステージの全フィールド(計23個)に `description` と `type: { csharp: '…' }` を足す |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `selectedFieldId: string \| null` と `selectField(fieldId)` を追加。メソッドの選択(`selectMethod`)と排他にする(片方を選ぶと片方は `null`)。コードベースの変更でそのフィールドが消えたら `null` に戻す(メソッドの `stillThere` と同じ扱い) |
| `src/presentation/canvas/FieldChip.tsx` | presentation | 変更 | クリック(ドラッグ判定の 5px 未満)で `selectField` を呼ぶ。キーボード(Enter/Space)でも選択できる。ドラッグ操作・`nodrag nopan` は変えない |
| `src/presentation/editor/FieldInfo.tsx` | presentation | 新規 | 選択したフィールドの説明パネル(下記) |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | `MethodEditor` が `selectedFieldId` のときは `FieldInfo` を表示する。何も選んでいないときのヒント文を「メソッドかフィールドをクリックすると、ここに詳しい内容が表示されます」に変える |
| `src/presentation/canvas/ClassNode.tsx` | presentation | 変更 | フィールドが選択中のとき、チップを選択中の見た目にする(メソッドの選択中と同じクラス)。必要なら |
| `e2e/refactor.spec.ts` ほか | E2E | 追加 | フィールドをクリックすると右側に説明が出る、コードタブにコメントと型が出る |

## 見た目・内容の仕様

### 右側の説明パネル(`FieldInfo`)

フィールドをクリックすると、右側のメソッドエディタの場所に表示する(メソッドを選んだときと同じ領域)。

- 見出し: `クラス名.フィールド名`(等幅、メソッドエディタの見出しと同じ形)と、可視性の記号(`+`/`-`/`#`)
- 型: `型: decimal`(`type.csharp` があれば。無ければこの行は出さない)
- 説明: `description` の文章(無ければ「説明はまだありません」)
- 「このフィールドを使うメソッド」: `fieldUsage` の結果を、メソッド名の一覧で出す。各行に「読む」/「書く」/「読み書き」を添える。使うメソッドが無ければ「どのメソッドからも使われていません」
- 「編集」「コード」のタブは付けない(メソッドと違い、抽出する処理の一覧が無いため)
- フィールドのドラッグ移動・右クリックメニューは変えない

### コードプレビュー(`generateClassSource`)

フィールドの宣言を次の形にする(インデントはクラスメンバと同じ4スペース)。

```
    // 基本給(月額)
    private decimal baseSalary;
```

- `description` があればその1行を `// …` で直前に出す。無ければコメント行は出さない
- 型は `type[language]` を使う。**無いときは `object` にせず**、宣言の代わりに `    // 未入力: フィールド <name>` の1行を出す(Fragmentの `// 未入力:` と同じ作法)
- メソッド側(`void` 固定)は今回は変えない

## データ・型の変更

`src/domain/codebase/Codebase.ts` の `Field`:

```ts
export type Field = {
  readonly id: string;
  readonly name: string;
  readonly visibility: Visibility;
  /** 画面とコードのコメントに出す日本語の説明。省略可。 */
  readonly description?: string;
  /** 言語ごとの型(表示用)。省略可。無い言語ではコードに宣言を出さず「未入力」にする。 */
  readonly type?: Partial<Record<CodeLanguage, string>>;
};
```

`moveField` など、`Field` を新しく作り直す箇所がないか `grep` で確認する(移動はオブジェクトをそのまま運ぶだけなら変更不要)。
23個のフィールドの `description`・`type` は、各ステージの文脈に合った自然な日本語と C# の型(`decimal`・`string`・`int`・`DateTime`・
インターフェース名など)にする。フィールド名から素直に分かる範囲で書き、ステージの課題や採点に影響する情報は足さない。

## TDD対象の純粋関数

### `fieldUsage(codebase, fieldId)`

そのフィールドを `reads` / `writes` に持つ Fragment を含むメソッドを返す。`Codebase.ts` の既存の `accessorFieldAccess` /
フィールドを触るFragmentを数える既存ヘルパーがあれば再利用する(重複を作らない)。

1. `reads` にそのフィールドIDを持つ Fragment があるメソッド → `access: 'read'`
2. `writes` に持つ → `'write'`。両方に持つメソッド → `'read-write'`
3. アクセサ(getter/setter)経由でそのフィールドを触るメソッドは、アクセサを呼ぶ側のメソッドも含める(`accessorFieldAccess` と同じ考え方)
4. どのメソッドも使っていない → 空配列
5. 同じメソッドが複数のFragmentで触っても1件にまとめる。結果の並びは、クラス内のメソッドの順

### `generateClassSource`

1. `description` と `type.csharp` があるフィールド → コメント行 + `{visibility} {type} {name};` の2行
2. `description` が無い → コメント行なし、宣言のみ
3. `type.csharp` が無い → `// 未入力: フィールド <name>` の1行(`object` は出ない)
4. 複数フィールド → 宣言順に並ぶ(既存のテストの意図を維持)

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `npm run test:e2e` が通る(フィールドのドラッグ移動の既存E2E=`field-<name>` を掴む操作が、クリック選択の追加後も壊れていない)
- 中級7(フィールドがあるステージ)で、フィールド(例: `baseSalary`)をクリックすると、右側に `Employee.baseSalary`・型・説明・使うメソッドが表示される
- フィールドをクリックしたあとにメソッドをクリックすると、右側がメソッドエディタに切り替わり、その逆も同様(排他)
- フィールドをドラッグして別クラスへ移す操作は、クリック(5px未満)と区別され、従来どおり動く
- フィールドをキーボード(Tabで移動、Enter/Space)で選択できる
- コードタブで、フィールドの宣言に説明のコメントと型(`private decimal baseSalary;` など)が出て、`object` が出ない。6ステージ・23フィールドすべてに説明と型が入っている
- 型や説明の無いフィールド(今後追加されるもの)は、宣言の代わりに `// 未入力: フィールド <name>` が出る
- フィールドを移動・削除した後も、選択中のフィールドが消えたときにパネルが空の案内に戻る(エラーにならない)
- メソッドエディタの「編集」「コード」タブ・抽出・可視性セレクトの動作は変わらない

## スコープ外

- メソッドの戻り値の型(`void` 固定)の追加。必要になったら別タスクで `Method` にも型を足す
- フィールドの説明・型をプレイヤーが編集できるようにすること
- フィールドの名前の変更・削除操作の追加
- フィールドを使うメソッド一覧から、そのメソッドを選択状態にする(クリックでジャンプ)こと
- フィールドの行数の採点(`Field` の `ponytail` コメントどおり、数えない)
- コードの色分け・整形(`code-preview-highlight` Issue #33。同じ `generateClassSource.ts` を触るので、どちらかが先にマージされたら、もう一方が rebase する)
