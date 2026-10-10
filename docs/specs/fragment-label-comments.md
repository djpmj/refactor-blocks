# コードタブに、編集タブの処理名をコメントとして表示する

## 背景・目的

メソッドエディタの「編集」タブには、メソッドの中の処理(Fragment)が「今月の売上を集計する」「前月比を計算する」のような
名前(`Fragment.label`)で並ぶ。一方「コード」タブ(`src/presentation/editor/ClassCodePreview.tsx`)のソースは、
各Fragmentの `code.csharp` をつなげただけなので、**どこからどこまでがどの処理なのか**が分からない。
編集タブで処理を選んで抽出するとき、その処理が実際にどのコードなのかを結び付けられない。

コードタブで、各処理のコードの直前にその処理名を `// 今月の売上を集計する` のようなコメントで出し、処理と処理の間に空行を入れる。

足したコメント行・空行は、**本物のコードの行として行番号を振り、行数(採点)にも数える**(ユーザー決定)。
`code-lines-match.md` で決めた「ブロックの行数 = コードタブの最終行番号」は、コメント・空行を含めたうえで引き続き成り立たせる。

## 表示の規則

メソッドの本体(`{` と `}` の間)を、Fragmentの順に次のように組み立てる。

```
    public void printMonthlyReport()
    {
        // 今月の売上を集計する
        var monthlySales = sales
            .Where(s => s.Month == currentMonth)
            .Sum(s => s.Amount);

        // 前月比を計算する
        var transactionCount = sales
            ...

        // 画面に出力する
        // レポートを出力する
        Console.WriteLine(header);
        ...
    }
```

- **コードを持つFragment**(`code.csharp` がある、または抽出したメソッドの呼び出し行を推定できるもの): `// <label>` の1行を出し、続けてコードを出す
  - コードがすでに `//` のコメントで始まっていても、処理名のコメントは省かずに両方出す
  - 抽出したメソッドを呼ぶだけのFragment(`aggregateSales();` など)にも同じく付ける
- **コードを持たないFragment**: 今どおり `// 未入力: <label>` の1行だけ(処理名が入っているので、処理名のコメントは重ねない)
- **2つ目以降のFragmentの前に空行を1行**入れる(メソッドの `{` の直後と `}` の直前には入れない)
- メソッド宣言・クラス宣言・フィールド・メソッド間の空行の出し方は変えない

## 変更対象ファイル一覧

### 変更

- `src/domain/codebase/generateClassSource.ts`(domain): 上の「表示の規則」でメソッド本体を組み立てる
- `src/domain/codebase/lineCount.ts`(domain): 表示と行数が一致するよう計算を変える
  - `fragmentLines(fragment)`: コードを持つFragmentは「コードの行数 + 1(処理名のコメント)」。コードを持たないFragmentは今どおり `lines`
  - `methodLines(method)`: `METHOD_OVERHEAD_LINES` + 各 `fragmentLines` の合計 + **Fragment間の空行(`max(0, Fragment数 - 1)`)**
  - 「コードを持つ」の判定は `generateClassSource` と同じにする(`code.csharp` がある、または call Fragment で呼び出し先を推定できる)。
    推定には `Codebase` が要るため、必要なら判定を1つの関数にまとめて両方から使う(同じ規則を2か所に書かない)。
    call Fragment のコードを推定できるのにコードなし扱いで数えると、表示とずれるので注意する
  - `classLines` / `fileLines` は今の式のまま(`methodLines` の変更が伝わる)
- `src/infrastructure/stages/*.ts`(infrastructure)の各ステージの `limits`
  - 行数が増える分、**全ステージで上限を合わせ直す**。合わせ直しの基準は「初期状態でどの行数違反が出るか」と
    「模範解答(と、テストで確かめている各解答)がどの行数違反も出さないか」が、変更前と同じになること
  - ステージの説明文・ヒント・変更依頼の文言に行数の数字が書かれていれば、新しい数え方に合わせて直す
- `docs/stages/report.md`: `npm run stage-report` で再生成する
- 行数の数字を決め打ちしているテスト(Vitest・E2E)の期待値を、新しい数え方に合わせて更新する
  (例: `e2e/class-code-preview.spec.ts` の最終行番号 `33` / `38` / `43`、チュートリアル1のメソッド・クラスの行数表示、
  「もし、この変更が来たら?」カードの `printMonthlyReport(86行)` など)。数字を変えるだけで、テストの意図は変えない

## データ・型の変更

なし(`Fragment` の型・ステージ定義の形式は変えない。`limits` の数値だけを変える)。

## TDD対象の純粋関数

先にテストを書いてから実装する(`generateClassSource.test.ts`・`lineCount.test.ts` に追加・更新)。

- `generateClassSource`
  - コードを持つFragmentが2つ: それぞれのコードの前に `// <label>` が付き、間に空行が1行入る
  - コードが `//` で始まるFragment: 処理名のコメントと元のコメントが両方出る
  - call Fragment(抽出したメソッドの呼び出し): `// <label>` の次に `aggregateSales();` が出る
  - コードを持たないFragment: `// 未入力: <label>` の1行だけで、処理名のコメントは付かない
  - Fragmentが1つ: 空行は入らない。Fragmentが0個(契約メソッド): 今どおり `public void run();`
- `fragmentLines` / `methodLines`
  - コード3行のFragment → 4行。コードなし `lines: 5` のFragment → 5行
  - Fragment 3つ(コード2行・3行・コードなし `lines: 4`)のメソッド → 3 + 3 + 4 + 4 + 2(空行) = 16行
  - call Fragment で呼び出し先がある → コード1行 + コメント1行 = 2行
- **表示と行数の一致**(性質のテスト): 全ステージの初期状態の全クラスについて、`generateClassSource` の行数が `classLines` と一致する
  (フィールドを持たないクラスに限る。フィールド宣言は今も行数に数えないため)

## 受け入れ基準

- `npm run check` と `npm run test:e2e` がすべて通る
- チュートリアル1のコードタブで、各処理のコードの前に、編集タブの一覧と同じ名前の `// 今月の売上を集計する` などのコメントが出て、処理と処理の間に空行が入る
- 処理名のコメント・空行にも行番号が振られ、クラスの行数表示がコードタブの最終行番号と一致する。メソッドの行数も、
  タブで宣言から `}` まで数えた行数と一致する(Extract Method・Move Method・Inline Method などの操作の後も一致する)
- すべてのステージで、初期状態に出る行数違反の種類・対象と、模範解答で行数違反が出ないことが、変更前と同じ
- 読む行数メーター・「もし、この変更が来たら?」カード・AI講評に渡す行数・ステージ一覧の表(`docs/stages/report.md`)が、新しい行数で一貫して出る

## スコープ外

- コメントの表示のオン/オフの切り替え
- 編集タブで処理を選んだとき・マウスを乗せたときに、コードタブの該当箇所をハイライトする連動
- ステージのコードにもともと書かれているコメント(`// レポートを出力する` など)の削除・書き換え
- フィールド宣言の行数を `classLines` に含めること
- C#以外の言語のコメント記法への対応
