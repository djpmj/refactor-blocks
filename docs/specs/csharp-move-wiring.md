# C#エクスポート: 別クラスを呼ぶときのインスタンスをコンストラクタで注入する

C#実行可能エクスポートの6本のうち3本目。前提は `csharp-project-export`・`csharp-extract-dataflow`。

## 背景・目的

メソッドを別クラスへ移したり(Move Method)、クラスを分けたりすると、呼び出し元は別クラスのメソッドを呼ぶことになる。
いまのコード生成は、呼び出しを `M();` としか書かない。どのインスタンスの `M` なのかが無いため、ビルドが通らない。
また、移したメソッドが元のクラスのフィールド(`_repository` など)を使い続けていると、移した先のクラスからは見えない。

実務でよく見る**コンストラクタ注入**で、クラス間の呼び出しを配線する。
`Program.cs` でインスタンスを1つずつ組み立てるので、プレイヤーが分けたクラス同士の関係が、そのままコードの形で見えるようになる。

## 変更対象ファイル一覧

### 新規

- `src/domain/codebase/csharpWiring.ts`(domain)
  - `collaboratorsOf(codebase: Codebase, classId: string): readonly Collaborator[]`: そのクラスの処理が呼ぶ・読む・書く、**別クラス**のメンバーの持ち主を返す。
    - `Collaborator = { classId: string; typeName: string; fieldName: string }`
    - `fieldName` は `_` + 型名の先頭を小文字にしたもの(例: `TaxCalculator` → `_taxCalculator`)
    - 並びは、最初に使われた順にする
  - `compositionOrder(codebase: Codebase, bindings?: Readonly<Record<string, string>>): CompositionPlan`:
    `Program.cs` で `new` する順番と、コンストラクタに渡すものを決める。
    - 依存を後ろから順に組み立てる(トポロジカル順)
    - 循環依存の辺は、コンストラクタではなく、組み立てたあとのプロパティ代入で渡す(`CompositionPlan.lateAssignments`)
    - インスタンスを作れるのは具象クラスだけ。インターフェース・抽象クラス型の依存には実装クラスを渡す
      (実装が1つならそれ、複数なら `runtime.bindings` で決める。決まらなければ `BuildIssue` の `reason: 'ambiguous-binding'` にする)
- `qualifyForeignMembers(code: string, replacements: ReadonlyMap<string, string>): string`(同じファイル):
  処理のコードに出てくる別クラスのフィールド名を、識別子の境界(`\b`)で受け手付き(`_orderService._repository`)に置き換える

### 変更

- `src/domain/codebase/generateClassSource.ts`(domain)
  - 別クラスを使うクラスに、`private readonly <Type> <fieldName>;` と、それらを受け取るコンストラクタを出す。
    循環の辺は `public <Type> <PropertyName> { private get; set; }` で受ける
  - 呼び出し処理(call Fragment)が別クラスのメソッドを呼ぶときは、`<fieldName>.<Method>(…)` と書く
  - 処理のコードが別クラスのフィールドを使うときは、`qualifyForeignMembers` で受け手を付ける
  - 画面のプレビューにも、同じ形で出る
- `src/domain/codebase/csharpProject.ts`(domain): `Program.cs` を `compositionOrder` の結果から生成する。
  全具象クラスを1つずつ `new` し、循環の辺を代入してから、入口のメソッドを持つインスタンスで入口を呼ぶ。
  インスタンスは、クラスごとに1つだけ作る(状態を共有するため)
- `src/domain/codebase/buildIssues.ts`(domain): `reason` に `'ambiguous-binding'` を足す。
  別クラスの `private` フィールドを `qualifyForeignMembers` で受け手付きにした箇所は、既存の `'private-member'` として数える
- `src/presentation/stage/SourceDownloadDialog.tsx`: `'ambiguous-binding'` の理由の文言を足す
  (「`IDiscountPolicy` の実装が複数あり、どれを使うか決められない」)

## データ・型の変更

- `Collaborator`・`CompositionPlan` 型を追加する
- `BuildIssue.reason` に `'ambiguous-binding'` を追加する
- `Codebase` の形は変えない(配線は生成時に計算する。データとして持たない)

## TDD対象の純粋関数

`collaboratorsOf`

1. 同じクラスのメソッドだけを呼ぶクラスは空
2. 別クラスのメソッドを呼ぶ処理があると、そのクラスが1件入る。同じクラスを何度呼んでも1件
3. 別クラスのフィールドを読む・書く処理でも、そのクラスが入る
4. インターフェースのメソッドを呼ぶときは、型名がインターフェース名になる

`compositionOrder`

1. A → B → C の依存なら、C・B・A の順に組み立て、A のコンストラクタに B が渡る
2. A ⇄ B の循環があると、片方の辺が `lateAssignments` に入り、全クラスが組み立てられる
3. 実装が1つのインターフェースには、その実装が渡る
4. 実装が複数で `bindings` があれば、それに従う。無ければ `'ambiguous-binding'` の問題として返る

`qualifyForeignMembers`

1. `_repository.SaveAsync(order)` が `_orderService._repository.SaveAsync(order)` になる
2. `_repositoryCache` のような、名前の一部だけが一致する識別子は置き換えない
3. 文字列リテラルの中は置き換えない(`"_repository"` はそのまま)

`generateClassSourceLines`(既存テストに追加)

1. 別クラスを呼ぶクラスに、`private readonly` フィールドとコンストラクタが出る
2. 呼び出しが `_taxCalculator.CalculateTax(subtotal)` の形になる

## 受け入れ基準

1. `runtime` を持つステージで、メソッドを別クラスへ移してからダウンロードすると、コンストラクタ注入で配線されたコードになり、ビルド・実行できる(移すときに必要なフィールドも一緒に移した場合)
2. 必要なフィールドを残したまま移し、そのフィールドが `private` だと、ダイアログに「ビルドが通らない箇所」として出る
3. 中級1(循環依存)の初期状態のように循環があっても、`Program.cs` が組み立てられ、ビルドできる(中級1の `runtime` は5本目で入れる。この3本目では、テスト用の codebase で確かめる)
4. 画面のコードプレビューに、注入用のフィールド・コンストラクタ・受け手付きの呼び出しが出る
5. 行数の計算と採点の結果は変わらない(生成するフィールド・コンストラクタの行は数えない)
6. `npm run check` と `npm run test:e2e` が通る。CI の `csharp` ジョブが通る

## スコープ外

- DIコンテナ(`Microsoft.Extensions.DependencyInjection` など)の利用
- 1クラスに複数のインスタンスを作ること(クラスごとに1つだけ)
- `static` メソッド・拡張メソッドへの変換
- Pull Up / インターフェースの抽出の、コード上の細かな見た目(`abstract` メソッドの宣言などは、ステージの対応で必要になったら4〜6本目で直す)
