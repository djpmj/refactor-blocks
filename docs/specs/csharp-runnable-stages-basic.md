# C#エクスポート: チュートリアル・ドリル・初級のステージを実行できるようにする

C#実行可能エクスポートの6本のうち4本目。前提は `csharp-project-export`・`csharp-extract-dataflow`・`csharp-move-wiring`。
この仕様の「共通の進め方」は、5本目(`csharp-runnable-stages-intermediate`)と6本目(`csharp-runnable-stages-advanced`)でもそのまま使う。

## 背景・目的

1〜3本目で、ダウンロード・引数と戻り値・配線の仕組みができた。
しかし各ステージの処理のコード(`Fragment.code.csharp`)は、表示用に書かれた断片のままである。
変数・型・補助クラスが足りないため、ビルドできない。
このIssueでは、次の7ステージを、Visual Studio でビルド・デバッグ実行できる形に整える。

- チュートリアル1・2: `tutorial-extract-method`・`tutorial-order-service`
- ドリル1〜3: `drill-extract-tail`・`drill-extract-middle`・`drill-move-method`
- 初級1・2: `beginner-user-controller`・`beginner-invoice-service`

## 共通の進め方(4〜6本目で共通)

各ステージで、次のことをする。

1. **`runtime` を書く**: `src/infrastructure/stages/runtime/<stageId>.ts` に `StageRuntime` を置き、ステージ定義の `runtime` に入れる
   - `entryMethodId` は、そのステージの元の大きなメソッドにする(例: `printMonthlyReport`)
   - `support` には、ゲームのブロックにならないコードを置く。データ型(`Sale`・`Order` など)、サンプルデータ(`SampleData`)、外部とのやりとりの偽物(`FakeOrderRepository`・`ConsoleMailer` など)。
     偽物は、何をしたかをコンソールに1行出す(例: `[DB] 注文 1001 を保存しました`)。実行したときに、処理の流れが目で追えるようにする
   - 外部の NuGet パッケージは使わない(.NET 8 の標準ライブラリだけ)
   - 実行結果が毎回同じになるようにする。日時・乱数は固定値にする(`SampleData.Today` など)
2. **処理のコードを直す**: 各 `Fragment.code.csharp` を、それだけでビルドが通るように直す。
   ただし、**処理ごとの行数を変えない**(行数は採点に使うため)。行数を合わせられないときは、空行・コメントで調整する
3. **変数をデータにする**: 処理どうしが受け渡すローカル変数を `variables.declares` / `variables.uses` に書く。
   - 1つの変数を作るのは、1つの処理だけにする(再代入しない)
   - 元のメソッドが受け取る値は `Method.parameters` に書く
4. **フィールドに型を書く**: クラスのフィールド(`_logger`・`_repository` など)に `Field.type.csharp` を書く。
   コンストラクタで受け取る外部の偽物は、`runtime.support` の型にする
5. **確かめる**: `npm run csharp-export` と `bash scripts/verify-csharp.sh` で確かめる。
   初期状態・模範解答の各手順・完成形のすべてがビルドでき、出力が初期状態と一致すること。
   `npm run stage-report` を実行しても `docs/stages/report.md` に差分が出ないこと(行数・採点が変わっていない)

## 変更対象ファイル一覧

### 新規

- `src/infrastructure/stages/runtime/tutorial-extract-method.ts` ほか、上の7ステージ分(infrastructure)。
  1本目で仮に入れたチュートリアル1の `runtime` は、このファイルへ移す

### 変更

- `src/infrastructure/stages/tutorialStages.ts`・`drillStages.ts`・`beginnerStages.ts`(infrastructure):
  `runtime` の追加、`Fragment.code.csharp` の修正(行数は変えない)、`variables`・`parameters`・`Field.type` の記入
- `src/infrastructure/stages/stageCode.test.ts`(既存): `runtime` を持つステージについて、次を確かめるテストを足す
  - 全処理の `variables.uses` が、手前の処理かメソッドの引数で作られている(使う前に作られている)
  - 同じ変数名を2つの処理が作っていない

## データ・型の変更

なし(1〜3本目で足した型にデータを入れるだけ)。

## TDD対象の純粋関数

新しい純粋関数はない。上の `stageCode.test.ts` の検査を先に書き、`runtime` を入れたステージから Red → Green にする。
ビルドと実行は、CI の `csharp` ジョブ(`scripts/verify-csharp.sh`)で守る。

## 受け入れ基準

1. 7ステージすべてで「参考・答え」に「ソースをダウンロード(C#)」が出る
2. 7ステージすべてで、初期状態のままダウンロードした zip を Visual Studio 2022 で開くと、ビルドでき、デバッグ実行するとコンソールに処理の流れ(偽物のログを含む)が出る
3. 模範解答どおりに組み替えてからダウンロードしても、ビルドでき、出力が初期状態と同じになる
4. CI の `csharp` ジョブが、7ステージの全スナップショットで成功する
5. `npm run stage-report` で `docs/stages/report.md` に差分が出ない
6. 画面のコードプレビューは、直したコード(引数・戻り値・注入を含む)で表示される。ステージの遊び方・採点は変わらない
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 中級・上級のステージ(5本目・6本目)
- 変更依頼(「もし、この変更が来たら?」で足す処理)のコード
- 模範解答と違う順番・違う組み替え方をしたときに必ずビルドが通ること(通らない箇所は、1本目のダイアログで伝える)
