# C#エクスポート: 抽出したメソッドに引数・戻り値・async を付ける

C#実行可能エクスポートの6本のうち2本目。前提は `csharp-project-export`。

## 背景・目的

処理のまとまり(Fragment)はローカル変数を通じてつながっている。
たとえば「今月の売上を集計する」が `monthlySales` を作り、「前月比を計算する」がそれを読む。
ところが今の Extract Method は、引数なし・`void` のメソッドを作るだけで、変数の受け渡しを表さない。
そのため抽出したとたんに、変数が見えなくなってビルドが通らなくなる。
また、`await` を含むコードが `void` メソッドの中に出るため、そもそもビルドできない。

処理ごとに「作る変数」「使う変数」をデータとして持たせ、抽出するときに引数と戻り値を自動で決める。
`await` を含むメソッドとその呼び出し元は、`async Task` にする。
画面のコードプレビューにも同じシグネチャを出し、抽出で引数・戻り値が生まれる様子を見せる。

## 変更対象ファイル一覧

### 変更

- `src/domain/codebase/Codebase.ts`(domain)
  - `Fragment` に `readonly variables?: { readonly declares?: readonly LocalVariable[]; readonly uses?: readonly string[] }` を足す。
    `LocalVariable = { readonly name: string; readonly type: Partial<Record<CodeLanguage, string>> }`。省略は「変数を作らず使わない」と同じ
  - `Method` に `readonly returns?: readonly LocalVariable[]` を足す(省略は `void`)。引数は既存の `parameters` を使う
- `src/domain/codebase/extractMethod.ts`(domain): 抽出するときに、次の純粋関数でシグネチャを決め、抽出したメソッドの `parameters` / `returns` と、呼び出し処理(call Fragment)を作る
  - 呼び出し処理の `callArguments` には引数の変数名を入れる
  - 呼び出し処理の `variables.declares` には戻り値の変数を、`variables.uses` には引数の変数を入れる
- `src/domain/codebase/inlineMethod.ts` / `mergeMethods.ts`(domain): Inline・Merge のあとも、`variables` がつながったままになるようにする
  (Inline は抽出の逆で、呼び出し処理を元の処理に戻すので、引数名と変数名が同じなら何もしなくてよい。テストで確かめる)
- `src/domain/codebase/fragmentCode.ts`(domain): 呼び出し処理のコードを、戻り値の数に応じて生成する
  - 0個なら `M(a, b);`、1個なら `var x = M(a, b);`、2個以上なら `var (x, y) = M(a, b);`
  - 呼ぶ先が async なら `await` を付ける
- `src/domain/codebase/generateClassSource.ts`(domain): メソッド宣言を次の形で出す
  - 戻り値の数に応じて `void` / `T` / `(T1 x, T2 y)` にする
  - async なら `async Task` / `async Task<T>` にする
  - 戻り値があるメソッドは、末尾に `return x;` / `return (x, y);` を足す。この行の `fragmentId` は undefined
  - 画面のプレビューにも、ダウンロードと同じ形で出る

### 新規

- `src/domain/codebase/methodSignature.ts`(domain): 次の2つの純粋関数を置く
  - `inferExtractedSignature(source: Method, fragmentIds: readonly string[]): { parameters: LocalVariable[]; returns: LocalVariable[] }`
  - `isAsyncMethod(codebase: Codebase, methodId: string): boolean`

## データ・型の変更

- `Fragment.variables`・`Method.returns`・`LocalVariable` を追加する(すべて省略可)
- 保存済みの下書き(`localStorage` の codebase)には、これらが無い。無いものは「変数なし・void」として読み込む。
  読み込み時の検証(`isCodebase.ts`)に、この形(省略可・配列・文字列)の検証を足す
- ステージ定義への `variables` の記入は、4〜6本目で行う

## TDD対象の純粋関数

`inferExtractedSignature`

1. 抽出する処理が使う変数のうち、抽出しない手前の処理(またはメソッドの引数)が作ったものが引数になる(宣言順)
2. 抽出する処理の中で作って中で使い切る変数は、引数にも戻り値にもならない
3. 抽出する処理が作り、抽出しない後ろの処理が使う変数が戻り値になる(0個・1個・2個以上)
4. 型は、変数を作った処理の `LocalVariable.type` を使う
5. `variables` が無い処理だけを抽出すると、引数なし・戻り値なしになる(今までと同じ)

`isAsyncMethod`

1. いずれかの処理のコードに `await` を含むメソッドは async
2. async なメソッドを呼ぶメソッドも async(推移的)
3. 呼び出しが循環していても止まる

`extractMethod`(既存テストに追加)

1. 抽出したメソッドに `parameters` / `returns` が付き、呼び出し処理の `callArguments`・`variables` が対応している
2. 抽出したあとに Inline すると、元の処理の並び・`variables` に戻る

`generateClassSourceLines`(既存テストに追加)

1. 戻り値1個のメソッドが `private decimal CalculateTax(decimal subtotal)` の形になり、末尾に `return taxAmount;` が出る
2. 戻り値2個が名前付きタプルになり、呼び出し側が `var (a, b) = M(...);` になる
3. async なメソッドが `private async Task<T> M(...)` になり、呼び出し側に `await` が付く

## 受け入れ基準

1. `variables` を書いた処理を抽出すると、画面のコードプレビューで、抽出したメソッドに引数・戻り値が付いて見える
2. `csharp-project-export` の検証スクリプトで、`runtime` を持つステージ(この時点ではチュートリアル1)は、抽出を含む模範解答の各手順でもビルドでき、出力が初期状態と一致する
3. 抽出 → Inline で元に戻せる。Undo / Redo も今までどおり動く
4. `variables` の無い既存の保存データを読み込んでも、エラーにならず遊べる
5. 行数の計算(`lineCount.ts`)と採点の結果は変わらない(`return` の行は数えない)
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 別クラスへの移動に伴う配線(3本目)
- ステージ定義への `variables` の記入(4〜6本目)
- `ref` / `out` 引数、変数の再代入を追う解析(1つの変数は1つの処理だけが作る、という前提にする。ステージはこの前提で書く)
- 抽出したメソッドの引数名・戻り値の型を、プレイヤーが編集すること
