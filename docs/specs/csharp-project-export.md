# C#プロジェクトとしてソースをダウンロードする(基盤)

C#実行可能エクスポートの6本のうち1本目。実装順は
`csharp-project-export` → `csharp-extract-dataflow` → `csharp-move-wiring` →
`csharp-runnable-stages-basic` → `csharp-runnable-stages-intermediate` → `csharp-runnable-stages-advanced`。

## 背景・目的

プレイヤーはブロックを組み替えてリファクタリングを練習しているが、組み替えたコードが「本当に動くのか」を自分の手で確かめる手段がない。
いまの画面のコード(`generateClassSource.ts`)は「C#風の疑似ソース」で、メソッドは全部 `void`、変数や型も定義されていないため、ビルドできない。

この6本で、いまのコードを **Visual Studio で開いて、ビルドし、ブレークポイントを置いてデバッグ実行できる C# のコンソールアプリ**として
zip でダウンロードできるようにする。対象は全ステージで、リファクタリング前と後で同じ出力になることを自分で確かめられる。

この1本目では、その土台を作る。

- プロジェクトの生成(純粋関数)
- zip のダウンロード
- ビルドが通らない箇所を事前に伝える仕組み
- 全ステージを `dotnet build` / `dotnet run` で確かめる検証スクリプトと CI

ステージの中身を動く形に直すのは、4〜6本目で行う。

## 変更対象ファイル一覧

### 新規

- `src/domain/stage/StageRuntime.ts`(domain): ステージを実行するための情報の型。
  ```ts
  export type StageRuntime = {
    /** 実行の入口にするメソッドのID。リファクタリングでクラスを移っても、IDで今の持ち主を探す。 */
    readonly entryMethodId: string;
    /** 入口のメソッドに渡す引数の C# の式(例: ['SampleData.Sales()'])。 */
    readonly entryArguments: readonly string[];
    /** ゲームのブロックにならない補助コード(データ型・リポジトリの偽物・サンプルデータ)。`Support/` の下に出す。 */
    readonly support: readonly { readonly path: string; readonly code: string }[];
    /** インターフェースの実装が複数あるときに、どれを注入するか(インターフェース名 → クラス名)。3本目で使う。 */
    readonly bindings?: Readonly<Record<string, string>>;
  };
  ```
- `src/domain/codebase/csharpProject.ts`(domain): `generateCSharpProject(codebase: Codebase, runtime: StageRuntime, projectName: string): readonly ProjectFile[]`
  (`ProjectFile = { path: string; content: string }`)。次のファイルを返す。
  - `<projectName>/<projectName>.csproj`: `Microsoft.NET.Sdk`、`OutputType=Exe`、`TargetFramework=net8.0`、`ImplicitUsings=enable`、`Nullable=disable`、`RootNamespace=<projectName>`
  - `<projectName>/<CodeFile.path>`: ゲームのファイルごとに1つの `.cs`。先頭に `namespace <projectName>;`、続けて各クラスを生成する
  - `<projectName>/Program.cs`: `await` を使える `static async Task Main()` から、入口のメソッドを呼ぶ
  - `<projectName>/Support/*.cs`: `runtime.support` をそのまま出す
- `src/domain/codebase/buildIssues.ts`(domain): `findBuildIssues(codebase: Codebase): readonly BuildIssue[]`。
  ゲームでは許されているが C# ではビルドが通らない箇所を返す。この1本目で扱うのは、別クラスの `private` メンバー(メソッド・フィールド)を使っている箇所。
  - 判定の材料は `Fragment.uses` / `reads` / `writes` と、`dependencies.ts` の `methodOwnerMap` / `fieldOwnerMap`
  - `BuildIssue = { classId: string; methodId: string; memberName: string; reason: 'private-member' }`
- `src/infrastructure/export/zip.ts`(infrastructure): 依存を足さず、無圧縮(STORE)の zip を作る `createZip(files: readonly ProjectFile[]): Uint8Array`(CRC-32 込み)と、Blob にしてダウンロードさせる `downloadZip(name, files)`。ファイル名は UTF-8 にする
- `src/presentation/stage/SourceDownloadDialog.tsx`(presentation): ダウンロードの前に開く確認ダイアログ
  - `findBuildIssues` が1件以上なら「この状態ではビルドが通らない箇所: N件」と、`クラス名.メソッド名 が 別クラス.メンバー名(private)を使っている` の一覧を出し、そのままダウンロードできる
  - 0件なら「Visual Studio で `.csproj` を開くと、ビルドしてデバッグ実行できます」とだけ出す
- `src/domain/codebase/csharpExport.export.test.ts`(Vitestで動くエクスポーター。通常の `npm test` では何もしない):
  環境変数 `CSHARP_EXPORT_DIR` があるときだけ、`runtime` を持つ全ステージについて
  初期状態・模範解答の各手順(`solutionSnapshots`)・模範解答の完成形のプロジェクトを、
  `<dir>/<stageId>/<00-initial|01|02|…|final>/` に書き出す
- `scripts/verify-csharp.sh`: 書き出した各プロジェクトで `dotnet build -warnaserror-` と `dotnet run` を行う。
  同じステージの全スナップショットの標準出力が初期状態と一致することを確かめ、1つでも失敗したら終了コード1で止まる
- `.github/workflows/ci.yml` に `csharp` ジョブを追加する: `actions/setup-dotnet`(8.0.x)→ `npm ci` →
  `CSHARP_EXPORT_DIR=out/csharp npx vitest run src/domain/codebase/csharpExport.export.test.ts` → `bash scripts/verify-csharp.sh out/csharp`

### 変更

- `src/domain/stage/Stage.ts`: `readonly runtime?: StageRuntime` を足す(省略可。4〜6本目で全ステージに入れる)
- `src/domain/codebase/generateClassSource.ts`: クラス宣言を `public class` に固定している部分などを、プロジェクト生成からも使える形に整える。
  画面のプレビューとダウンロードで、同じ生成関数を使う(2つの生成器を持たない)。
  この1本目では、メソッドのシグネチャ(`void`)は変えない
- `src/presentation/stage/ReferenceMenu.tsx`: 「参考・答え」メニューに「ソースをダウンロード(C#)」を足し、`SourceDownloadDialog` を開く。
  `stage.runtime` が無いステージでは出さない
- `package.json`: `"csharp-export": "vitest run src/domain/codebase/csharpExport.export.test.ts"` を足す
- `CLAUDE.md` のコマンド一覧に `npm run csharp-export` と `scripts/verify-csharp.sh` を1行ずつ足す
- `e2e/`: 既存ファイル(`reference-menu` 系)に、`runtime` を持つステージでメニューから zip がダウンロードされること(`page.waitForEvent('download')`)を足す。
  この1本目では、検証用に**チュートリアル1にだけ** `runtime` を仮に入れる。
  その最小限の補助コードとして `Sale` 型・サンプルデータ・`_logger` の偽物を置き、チュートリアル1の初期状態がビルド・実行できるようにする。
  チュートリアル1の残りの整備は4本目で行う

## データ・型の変更

- `Stage.runtime?: StageRuntime` を追加(上記)
- `ProjectFile` / `BuildIssue` 型を追加
- 保存データ(`localStorage`)の形は変えない

## TDD対象の純粋関数

`generateCSharpProject`

1. `.csproj` が1つあり、`net8.0`・`Exe`・`ImplicitUsings` が入っている
2. ゲームのファイルごとに `.cs` が1つでき、パスは `CodeFile.path` のまま、先頭に `namespace <projectName>;` がある
3. `Program.cs` が `entryMethodId` の今の持ち主クラスとメソッド名を使って入口を呼ぶ(メソッドを別クラスへ移したあとは、移した先のクラスを呼ぶ)
4. `runtime.support` が `Support/` の下にそのまま出る
5. 同じ入力からは、同じ出力(並び順まで)になる

`findBuildIssues`

1. 同じクラスの `private` メソッドを呼ぶ処理は問題にしない
2. 別クラスの `private` メソッドを `uses` で呼ぶ処理を1件として返す
3. 別クラスの `private` フィールドを `reads` / `writes` で使う処理を1件として返す
4. `public` / `protected`(継承元のもの)は問題にしない

`createZip`(infrastructure だが純粋なのでテストする)

1. 先頭が `PK\x03\x04` で、末尾に中央ディレクトリの終端(`PK\x05\x06`)があり、ファイル数が合う
2. 既知の文字列の CRC-32 が正しい(例: `"123456789"` → `0xCBF43926`)
3. 日本語のファイル名に UTF-8 フラグ(汎用ビット11)が立つ

## 受け入れ基準

1. チュートリアル1を開き、「参考・答え」→「ソースをダウンロード(C#)」で `<stageId>.zip` がダウンロードされる
2. zip を展開して `.csproj` を Visual Studio 2022(または `dotnet run`)で開くと、チュートリアル1の初期状態がビルドでき、実行するとコンソールに結果が出る。`Main` や入口のメソッドにブレークポイントを置いて止められる
3. 別クラスの `private` メソッドを呼んでいる状態でダウンロードしようとすると、ダイアログに「ビルドが通らない箇所」とその理由が出て、それでもダウンロードできる
4. `runtime` の無いステージでは、メニューに「ソースをダウンロード(C#)」が出ない
5. 画面のコードプレビューの表示は、この1本目では変わらない
6. CI の `csharp` ジョブが、`runtime` を持つステージ(この時点ではチュートリアル1の初期状態)で成功する
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 抽出したメソッドの引数・戻り値・`async`(2本目 `csharp-extract-dataflow`)
- 別クラスを呼ぶときのインスタンスの配線(3本目 `csharp-move-wiring`)
- チュートリアル1以外のステージへの `runtime` の追加と、コードを動く形に直す作業(4〜6本目)
- 変更依頼(「もし、この変更が来たら?」で入れるコード)を入れたあとの状態。全部片付いてから別のIssueにする
- `.sln` ファイル(Visual Studio 2022 は `.csproj` を直接開ける)、テストプロジェクト(xUnit)
- 白紙設計・設計くらべの画面
- Java など C# 以外の言語
