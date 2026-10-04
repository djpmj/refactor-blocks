# コードタブの実際の行数と、ブロックに出す行数をそろえる

## 背景・目的

チュートリアル1で `ReportService` を開くと、キャンバス上では `printMonthlyReport()` が「73行」、クラスが「91行」と出るが、
右の「コード」タブに出ているソースは全体で約30行しかない。行数が、画面に見えているコードと一致しない。

原因は、`Fragment.lines`(`src/domain/codebase/Codebase.ts`)がコードとは無関係の手書きの数字(22・16・14・24・8)であること、
および `METHOD_OVERHEAD_LINES` / `CLASS_OVERHEAD_LINES` が2のままで、実際に生成されるコード
(波括弧を別行に置く形)の3行と合っていないこと。プレイヤーは「このコードが何行か」を目で数えて確かめられるので、
ズレは「本物のプログラムだ」という感覚を損なう。

方針(ユーザー決定済み): **コード(`code.csharp`)を持つFragmentは、行数をそのコードの実際の行数から計算する**。
コードを持たないFragment(チュートリアル1以外のステージ)は従来どおり `lines` を使う。

## 変更対象ファイル一覧

### 変更

- `src/domain/codebase/lineCount.ts`(domain)
  - `fragmentLines(fragment: Fragment): number` を追加・export する。`fragment.code?.csharp` があればその文字列の行数
    (`split('\n').length`、空行も1行と数える)、無ければ `fragment.lines`
  - `methodLines` は `fragment.lines` ではなく `fragmentLines(fragment)` の合計を使う
  - `METHOD_OVERHEAD_LINES` を `3`(宣言行・`{`・`}`)、`CLASS_OVERHEAD_LINES` を `3`(宣言行・`{`・`}`)にする。
    コメントも実態に合わせて直す
  - `classLines` は、メソッドが2つ以上あるときメソッド間の空行(`メソッド数 - 1` 行)も加算する
    (`generateClassSource` がメソッド間に空行を1行入れているため)
- `src/domain/codebase/lineCount.test.ts`(domain・TDD対象): 期待値を新しい計算に合わせて更新し、下記のケースを追加する
- `src/presentation/change/ChangeRequestPanel.tsx`: 119行目の `{fragment.lines}行` を `fragmentLines(fragment)` に変える
  (`.lines` を直接読んでいる箇所は他にもあれば `grep` ですべて `fragmentLines` に置き換える)
- `src/infrastructure/stages/tutorialStages.ts`(infrastructure/データ)
  - チュートリアル1の5つのFragmentの `lines` を、実際のコード行数(6・7・1・3・9)に書き換える
    (計算では使われなくなるが、`Fragment` 型が必須にしているため、嘘の数字を残さない)
  - 行数が変わるので、チュートリアル1の `limits`・`goal`・`description` などの数字を、下記「ステージの再調整」に従って見直す
- 行数の期待値をハードコードしているテスト(`src/**/*.test.ts`、`e2e/*.spec.ts`)を新しい行数に合わせて更新する。
  `86` `73` `50行` などをチュートリアル1について検索し、すべて見直す

## データ・型の変更

型の変更なし。`Fragment.lines` は残す(コードを持たないFragmentが使うため)。

## ステージの再調整(チュートリアル1)

行数が実コード基準になると `printMonthlyReport` は 26 + 3 = **29行** になり、現在の `limits.method: 50` では最初からクリア済みになってしまう。
学習の導線(長いメソッドを分ける)を保つため、次のように決める。

- `limits.method` を `20`(`class` `file` は元の値のまま)
- `goal` の文言を「メソッドは20行以内に。…」にそろえる
- この値で、`aggregateSales`(6行→呼び出し1行)と `compareWithLastMonth`(7行→1行)を抽出すると 29→18行 になり、
  20行以内になることを確認する。何も抽出しない初期状態は違反として検出される
- 変更依頼(`changeRequests`)の `linesPerSite`・`description` の文言は変えない(数字が変わっても学習意図は同じ)

## TDD対象の純粋関数

`fragmentLines` / `methodLines` / `classLines` / `fileLines`(`lineCount.ts`)。追加・更新するテスト(AAA):

1. `code.csharp` が3行のFragment → `fragmentLines` は `lines` の値にかかわらず 3
2. `code` を持たないFragment → `fragmentLines` は `lines` と同じ
3. 末尾の空行・途中の空行を含むコード → 空行も1行として数える
4. 本体1行のコードを持つメソッド → `methodLines` は `1 + 3`
5. メソッドが2つのクラス → `classLines` は「`3` + メソッドの行数合計 + メソッド間の空行 `1`」
6. メソッドが1つのクラスは空行が加算されない。メソッドが0個のクラスは `3`
7. `generateClassSource` との一致(チュートリアル1のコードベースで)
   `classLines(class)` が `generateClassSource(...)` の出力行数と等しい(フィールドを持たないクラス)

## 受け入れ基準

- `npm run check` と `npm run test:e2e` が通る
- チュートリアル1で `ReportService` のクラスの行数表示が、「コード」タブの行番号の最終行と一致する(初期状態で 32行)。
  `printMonthlyReport()` の行数 = タブの `public void printMonthlyReport()` から `}` までの行数(29行)
- 「メソッドとして抽出」したあとも、元のメソッド・新しいメソッド・クラスの行数が、「コード」タブで数えた行数と一致する
- チュートリアル1を何も触らない初期状態は「メソッドが20行を超えている」違反になり、集計と前月比を抽出すると100点側に進める
- チュートリアル1以外のステージ(コードを持たないFragment)で、行数の計算は、`METHOD_OVERHEAD_LINES` / `CLASS_OVERHEAD_LINES` の
  変更とメソッド間の空行を除いて変わらない。各ステージの模範解答(`stageCatalog.test.ts` などで検証されているもの)が引き続き成立する
- 読む行数メーター(`read-lines-meter`)・「もし、この変更が来たら?」カードの行数表示が、新しい行数で一貫して出る

## スコープ外

- チュートリアル1以外のステージへのコード書き足し(コードを持つようになった時点で自動的に実コード基準になる)
- フィールド宣言の行数(`fieldsOf`)を `classLines` に含めること。フィールドを持つクラスでは、クラスの行数がタブより少なくなる
- 複数クラスを含むファイルの `}` 間の空行など、ファイル全体の整形(`fileLines` はクラス行数の単純な合計のまま)
- `Fragment.lines` 自体の廃止・型の変更
- 他言語(TypeScript など)のコード行数
