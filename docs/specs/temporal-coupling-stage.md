# temporal-coupling-stage: init() → load() → run() の順に呼ばないと壊れるクラスを、引数と戻り値で順序が分かる1つの入口へ直す中級ステージ
> **実装順の注意**: 同じ区分の新ステージ仕様(上級: adapter/chain/composite/null-object、中級: mediator/law-of-demeter/temporal-coupling/flag-argument)と、題名の番号(上級10・中級13)と登録ファイル(`*Stages.ts`・`sampleAnswer.ts`・`solutionPhaseTable.ts`・`storyChapters.ts`・`stageCatalog.test.ts`・`docs/stages/report.md`)が衝突する。**同時に実装しない**。先にマージされたものがあれば、番号は次の空き番号に付け直し、`storyChapters.ts` の「最後の章」も最新のものに合わせる。

> **重複の確認**: 既存の実装・仕様書との重複はない。題材は `docs/feature-ideas/IDEAS.md` の「6. 時間的結合(呼び出し順序依存)ステージ」から取った。
> 近いステージとの違いは次のとおり。
> - 中級9 `intermediate-copy-paste-tax`(Extract → Merge → Move)と手順の形は似ているが、まとめる対象が「計算」ではなく「呼び出しの順序という約束」。
> - 中級7 `intermediate-anemic-domain-model` も setter を閉じるが、あちらはルールの置き場所の話で、こちらは呼び出し順の話。
>
> **他の新規ステージ仕様との衝突**: 中級の番号は先着順。実装するときにマージ済みの `intermediateStages.ts` を見て番号を決める(この仕様では仮に「中級13」と書く)。
> 下の「変更対象ファイル一覧」で【登録】と付けたファイルは、他のステージ追加と同時に編集されやすい。

## 背景・目的

`job.init(path); job.load(); var result = job.run();` のように、決まった順に呼ばないと壊れるクラスは実務でよく見る(時間的結合)。
順番という約束はコードの型に表れないので、守るのは使う側の記憶だけになる。使う場所が増えるほど、順番を変えたり手順を足したりするときに全部の呼び出し元を直すことになり、1か所でも呼び忘れると実行時の例外で初めて気づく。

このステージでは、呼び出し元2か所に散らばった「init → load → run の順に呼ぶ」処理を、次の形へ組み替える。

- Extract Method で切り出すと、「必要なもの(`path`)」が引数に、「得られるもの(`result`)」が戻り値になる(既存の `inferExtractedSignature` がそう推論する)。順序の約束が、メソッドの型として見えるようになる
- 2か所の同じ手順を Merge Methods で1つにまとめ、`StockImportJob` へ Move Method する
- `init` / `load` / `run` を private にし、外から呼べる入口を1つにする

**新しい操作・採点ルールは足さない**。初期状態の減点は、既存のルールから次の2つが自然に出る。

- `encapsulation`: 使う側が setter(`init` は `filePath = path;` だけの accessor)越しに `StockImportJob` のフィールドを書き換えている(呼び出し元2クラスで2件)。「先に外から状態を入れておいてから呼ぶ」という時間的結合が、そのまま減点になる
- `responsibility`: 呼び出し元が、自分の仕事に加えて「取り込みの手順」まで抱えている(上限1種類に対して2種類。2件)

本当に「時間的結合」専用の採点ルールが要るか: 要らない。呼び出し順の知識が使う側に漏れている状態は、既存の「カプセル化の破れ」「責務の混在」と変更依頼の痛み(直す場所5か所・3クラス → 4か所・1クラス)で十分に表せる。
`init` / `load` / `run` が public のまま残っていても減点しない(下の「スコープ外」)。ただし `init` は、閉じないと既存の「開いたままの setter」(`findOpenSetters`)で減点されるので、入口を閉じる動機はゲーム上にも残る。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更【登録】 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | `temporalCouplingStage` を定義し、`intermediateStages` 配列の末尾(`middleManStage` の後)に足す。runtime を import する |
| 新規 | `src/infrastructure/stages/runtime/intermediate-temporal-coupling.ts` | infrastructure | `intermediateTemporalCouplingRuntime`(C# の補助コード。下記) |
| 変更【登録】 | `src/domain/stage/sampleAnswer.ts` | domain | `sampleAnswerSteps['intermediate-temporal-coupling']` に模範解答の8手を足す |
| 変更【登録】 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | 8手あるので方針の表を足す(下記) |
| 変更【登録】 | `src/infrastructure/story/storyChapters.ts` | infrastructure | `intermediate-middle-man` の章の直後に章を足す(ドリル以外の全ステージに章が必要。並び順は `stages` と同じ) |
| 新規 | `src/infrastructure/stages/temporalCouplingStage.test.ts` | infrastructure | このステージ固有のテスト(下記「TDD対象」)。**ステージ定義より先に書く** |
| 変更【登録】 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 「初期違反の種類」の表に `['intermediate-temporal-coupling', ['responsibility', 'encapsulation']]` を足す |
| 変更【登録】 | `e2e/reference-menu.spec.ts` | E2E | `runtimeStages` の表に `['中級13: …(タイトル)', 'intermediate-temporal-coupling']` を足す |
| 新規 | `e2e/temporal-coupling-stage.spec.ts` | E2E | 切り出しで引数・戻り値が付くこと、模範解答で100点になること(下記) |
| 変更【登録】 | `docs/stages/report.md` | docs | `npm run stage-report` で作り直す(`stageReport.test.ts` がファイルのスナップショットで比べる) |

- `src/domain`(`sampleAnswer.ts` の表を除く)・`src/application`・`src/presentation` は変更しない。新しい依存は足さない
- `stageCode.test.ts` の「第5弾の中級12ステージ」の一覧には足さない(その一覧は過去の一括対応の記録。全ステージに runtime があることは「全ステージが C# で書き出せる」のテストで確かめられる)

## データ・型の変更

型の変更はない。既存の `Stage` に次の値を入れる。

### ステージの基本情報

| 項目 | 値 |
| --- | --- |
| `id` | `'intermediate-temporal-coupling'` |
| `level` | `'intermediate'` |
| `title` | `'中級13: 順番に呼ばないと壊れる在庫取り込み'`(番号は先着順で決める) |
| `problem` | `'在庫の取り込みを、使う側が決まった順に呼ばないと壊れる'` |
| `outcome` | `'呼び出し順の約束を、引数と戻り値で表す1つの入口にまとめられる'` |
| `learns` | `['時間的結合', 'Extract Method', 'Merge Methods']` |
| `principles` | `['encapsulation']` |
| `limits` | `{ method: 10, class: 30, file: 32 }` |
| `dependencyLimit` | `1` |
| `responsibilityLimit` | `1` |
| `visibilityEnforced` | `true`(可視性の選択欄を出すため。`showsVisibilityControl` は `visibilityEnforced` か protected メソッドがあるときだけ出す) |
| `responsibilityNames` | `{ 'stock-import': '在庫の取り込み', batch: '夜間バッチの記録', http: '再取り込みの受付' }` |
| `classNames` | `{ 'stock-import': 'StockImporter', batch: 'BatchRecorder', http: 'ReimportHandler' }`(初期のクラス名と重ならない) |
| `methodNames` | `{ 'stock-import': 'importStock', batch: 'recordBatch', http: 'handleReimport' }` |
| `runtime` | `intermediateTemporalCouplingRuntime` |

`description`:
`'在庫CSVを取り込む StockImportJob は、init() で取り込むファイルを覚え、load() でCSVを読み、run() で在庫を更新する。順番を間違えると load() や run() が例外を投げる。夜間の NightlyBatch と、管理画面の AdminController の2か所が、この順番を覚えて呼んでいる。先月は、新しく足した呼び出し元が init() を呼び忘れて、夜間バッチが止まった。'`

`goal`:
`'init() → load() → run() の呼び出し順を、使う側が覚えなくて済むようにしよう。取り込みの手順は StockImportJob に1か所だけ置き、外から呼べるのは「パスを受け取り、結果を返す」1つの入口だけにしよう。メソッドは10行・クラスは30行・ファイルは32行以内、1クラスの責務は1種類まで、依存先は1クラスまで'`

(`goal` / `description` に出すコード識別子は、初期コードのクラス名・メソッド名だけにする。`importStock` は書かない)

`why`:
`'呼び出し順の約束が使う側に散らばっていると、手順を変えるたびに全部の呼び出し元を探して直すことになり、1か所の呼び忘れが実行時まで分かりません。手順を1つの入口に閉じ込め、必要なものを引数、得られるものを戻り値にすれば、順番を間違える余地がなくなります。'`

`checks`(2問):

1. 問 `'init() → load() → run() の順に呼ぶ約束が、使う側に散らばっていると何が困る?'`
   - `'メソッドの呼び出し回数が増えて、処理が遅くなるから'` / 解説 `'呼び出し回数は問題ではありません。困るのは、順番の知識が呼び出し元の数だけ散らばることです。'`
   - `'手順を変えるたびに呼び出し元をすべて直す必要があり、1か所でも呼び忘れると実行時まで気づけないから'` / 解説 `'順番は型に表れないので、守れているかはコンパイラが確かめてくれません。使う場所が増えるほど誤用の機会も増えます。'`
   - `'init という名前が分かりにくいから'` / 解説 `'名前を変えても、順番に呼ばなければ壊れることは変わりません。'`
   - `answer: 1`
2. 問 `'取り込みの入口を「パスを受け取り、結果を返す」1つのメソッドにすると、何がよくなる?'`
   - `'必要なものが引数、得られるものが戻り値として型に表れ、使う側は順番を知らなくても正しく呼べるから'` / 解説 `'渡し忘れはコンパイル時に分かり、順番はクラスの中の1か所だけが知っていれば済みます。'`
   - `'フィールドを使ってはいけない決まりがあるから'` / 解説 `'フィールドは禁止ではありません。問題は、外から順番に状態を入れさせることです。'`
   - `'public メソッドが多いほど、使い方の自由度が上がるから'` / 解説 `'呼べる入口が多いほど、間違った順番で呼ばれる機会も増えます。'`
   - `answer: 0`

`changeRequests`(ボスなし):

| id | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- |
| `req-backup-before-update` | `'在庫を更新する前にバックアップを取って'` | `'取り込みで在庫を上書きする前に、今の在庫を退避しておく手順を挟みたい。'` | `stock-import` | 4 | `backupStockBeforeImport` | なし |
| `req-reimport-response` | `'再取り込みの応答に件数と時刻を返して'` | `'管理画面で、取り込んだ件数と終わった時刻を表示したい。'` | `http` | 3 | `addImportedAtToResponse` | `{ from: 'QAの高橋さん', text: '管理画面に返す内容を、いずれ増やしたいという話が出ているらしいです。' }` |

1件目は初期状態で 5か所・3クラス(`init` / `load` / `run` / `NightlyBatch.execute` / `AdminController.reimport`)、模範解答で 4か所・1クラスになる(`isClearlyRelieved` が成り立つ)。
どちらの依頼も、模範解答の設計では責務1種類のクラスに置けるので `sampleImplementation` が100点になる(`knownChangeRequestExceptions` に足さない)。

### 初期コード(3ファイル・3クラス)

フィールドとメソッドの ID・行数・コードは次のとおり。各 Fragment の `lines` は C# コードの行数と一致させる。1行1文。

**`src/stock/StockImportJob.ts`**(`file-stock-import-job`)/ クラス `StockImportJob`(`class-stock-import-job`)

フィールド:
- `field-file-path` `filePath`(private、`string`、説明 `'取り込むCSVのパス。init() で入る'`)
- `field-rows` `rows`(private、`List<StockRow>`、説明 `'読み込んだ在庫の行。load() で入る'`)

| メソッド | 可視性・引数・戻り値 | Fragment(id / label / 責務 / 行数) | C# コード・その他 |
| --- | --- | --- | --- |
| `init`(`method-init`) | public、`(string path)` | `frag-init-path` / 取り込むファイルを覚えておく / `stock-import` / 1 | `filePath = path;`。`writes: ['field-file-path']`、`accessor: true`、`variables: { uses: ['path'] }` |
| `load`(`method-load`) | public、引数なし | `frag-load-rows` / CSVを読み、在庫の行に分ける / `stock-import` / 4 | `if (filePath is null) throw new InvalidOperationException("init() を先に呼んでください");`<br>`var lines = FakeCsvStore.ReadLines(filePath);`<br>`rows = lines.Skip(1).Select(StockRow.Parse).ToList();`<br>`Log.Debug($"在庫CSVを {rows.Count} 行読みました");`<br>`reads: ['field-file-path']`、`writes: ['field-rows']`、`declares: lines (List<string>)` |
| `run`(`method-run`) | public、引数なし、`returns: result (ImportResult)` | `frag-run-update` / 在庫数を更新し、結果をまとめる / `stock-import` / 4 | `if (rows is null) throw new InvalidOperationException("load() を先に呼んでください");`<br>`foreach (var row in rows) FakeStockStore.SetQuantity(row.ProductId, row.Quantity);`<br>`var result = new ImportResult(rows.Count);`<br>`Log.Info($"在庫を {result.Count} 件更新しました");`<br>`reads: ['field-rows']`、`declares: result (ImportResult)` |

**`src/batch/NightlyBatch.ts`**(`file-nightly-batch`)/ クラス `NightlyBatch`(`class-nightly-batch`)

| メソッド | 可視性・引数 | Fragment(id / label / 責務 / 行数) | C# コード・その他 |
| --- | --- | --- | --- |
| `execute`(`method-batch-execute`、runtime の入口) | public、引数なし | `frag-batch-path` / 今夜取り込むファイルを決める / `batch` / 2 | `var path = $"/import/stock-{SampleData.Today:yyyyMMdd}.csv";`<br>`Log.Info($"夜間の在庫取り込みを始めます: {path}");`<br>`declares: path (string)` |
| | | `frag-batch-sequence` / init → load → run の順に呼ぶ / `stock-import` / 3 | `init(path);`<br>`load();`<br>`var result = run();`<br>`uses: ['method-init', 'method-load', 'method-run']`、`duplicateGroup: 'stock-import-sequence'`、`suggestedName: 'importStock'`、`variables: { declares: result (ImportResult), uses: ['path'] }` |
| | | `frag-batch-record` / 取り込み件数をバッチの記録に残す / `batch` / 2 | `FakeBatchLog.Record("stock-import", result.Count);`<br>`Log.Info($"夜間の在庫取り込みが終わりました: {result.Count} 件");`<br>`uses: ['result']` |

**`src/admin/AdminController.ts`**(`file-admin-controller`)/ クラス `AdminController`(`class-admin-controller`)

| メソッド | 可視性・引数 | Fragment(id / label / 責務 / 行数) | C# コード・その他 |
| --- | --- | --- | --- |
| `reimport`(`method-admin-reimport`) | public、`(ReimportRequest request)` | `frag-admin-validate` / 再取り込みの依頼を検証する / `http` / 3 | `if (request is null) throw new ArgumentNullException(nameof(request));`<br>`if (string.IsNullOrWhiteSpace(request.FileName)) throw new ValidationException("ファイル名がありません");`<br>`var path = $"/import/{request.FileName}";`<br>`declares: path (string)`、`uses: ['request']` |
| | | `frag-admin-sequence` / init → load → run の順に呼ぶ / `stock-import` / 3 | `frag-batch-sequence` と**完全に同じコード**・同じ `uses`・同じ `duplicateGroup`・同じ `variables` |
| | | `frag-admin-respond` / 画面への応答を作る / `http` / 2 | `var message = $"{result.Count} 件の在庫を取り込みました";`<br>`Console.WriteLine($"[HTTP 200] {message}");`<br>`declares: message (string)`、`uses: ['result']` |

行数: `StockImportJob` 9行、`NightlyBatch` 7行、`AdminController` 8行。どれも上限内なので、初期の `line-limit` は0件。

初期の採点(60点):
- `responsibility` 2件: `NightlyBatch`(batch + stock-import)、`AdminController`(http + stock-import)
- `encapsulation` 2件: 2つの呼び出し元が、accessor の `init` 越しに `StockImportJob.filePath` を書き換えている
- それ以外は0件(依存は各1本、循環なし、Feature Envy は触るフィールドが1つなので閾値2未満、`StockImportJob` の凝集度は `filePath` と `rows` が load でつながり1塊)

### runtime(`intermediate-temporal-coupling.ts`)

- `entryMethodId: 'method-batch-execute'`、`entryArguments: []`
- `support`: `logFile` と、次を定義する補助ファイル(`supportFile` を使う。既存の runtime ファイルに倣う)
  - `StockRow`(`ProductId`・`Quantity`、`static StockRow Parse(string line)`)
  - `ImportResult`(コンストラクタ `ImportResult(int count)`、`Count`)
  - `ReimportRequest`(`FileName`)
  - `ValidationException`
  - `FakeCsvStore.ReadLines(string path)`(ヘッダー行+2〜3行の固定データを返す)
  - `FakeStockStore.SetQuantity(int productId, int quantity)`(`[在庫] 商品 {id} を {n} 個にしました` を出す)
  - `FakeBatchLog.Record(string name, int count)`
  - `SampleData.Today`(固定の日付)
- `expectedBuildFailures: ['03']`: 模範解答の3手目(Merge)の直後は、統合した `importStock` が `NightlyBatch` の private のまま `AdminController` から呼ばれるため、C# ではビルドできない(4手目で public にして解消)

### 模範解答(`sampleAnswerSteps['intermediate-temporal-coupling']`、8手)

```ts
'intermediate-temporal-coupling': [
  // 呼び出し元2か所の「順に呼ぶ」処理を切り出す。引数 path・戻り値 result が自動で付く。
  { extract: { from: 'execute', fragmentIds: ['frag-batch-sequence'], name: 'importStock' } },
  { extract: { from: 'reimport', fragmentIds: ['frag-admin-sequence'], name: 'importStock' } },
  { merge: { methodA: 'importStock', methodAClass: 'NightlyBatch', methodB: 'importStock', methodBClass: 'AdminController', name: 'importStock' } },
  { changeVisibility: { method: 'importStock', class: 'NightlyBatch', visibility: 'public' } },
  { move: { method: 'importStock', fromClass: 'NightlyBatch', toClass: 'StockImportJob' } },
  { changeVisibility: { method: 'init', class: 'StockImportJob', visibility: 'private' } },
  { changeVisibility: { method: 'load', class: 'StockImportJob', visibility: 'private' } },
  { changeVisibility: { method: 'run', class: 'StockImportJob', visibility: 'private' } },
],
```

完成形: `StockImportJob` は `public ImportResult importStock(string path)` だけを外に見せ、中で `init` → `load` → `run` を呼ぶ。`NightlyBatch` と `AdminController` は `importStock(path)` を1行呼ぶだけ。
責務は `StockImportJob`=stock-import、`NightlyBatch`=batch、`AdminController`=http の各1種類。`encapsulation`・`findOpenSetters`・`visibility`・`unused` はすべて0件で100点。

### 方針の表(`solutionPhaseTable['intermediate-temporal-coupling']`)

```ts
[
  { from: 0, title: '呼び出し元2か所の「順に呼ぶ」処理を切り出す', why: '切り出すと、手順に必要なもの(path)が引数に、得られるもの(result)が戻り値に表れ、隠れていた約束が型として見えるため' },
  { from: 2, title: '同じ手順を1つにまとめ、StockImportJob へ移す', why: '順番を知っている場所を1か所にすれば、手順を変えるときに呼び出し元を探して回らずに済むため' },
  { from: 5, title: 'init / load / run を閉じて、入口を1つにする', why: '外から順番に呼べる窓口が残っていると、また誰かが呼び忘れたり順番を間違えたりできてしまうため' },
]
```

### ストーリーの章(`storyChapters.ts`)

`intermediate-middle-man` の章の直後に置く。話し手は既存の定数(例: `TAKAHASHI`)を使う。

- `title`: `'順番に呼ばないと止まる在庫取り込み'`
- `intro`: `'先月、夜間バッチが止まりました。新しく足した呼び出し元が、在庫取り込みの init() を呼び忘れていたんです。順番を覚えていないと使えない作りを、なんとかしたいです。'`
- `outro`: 前後の章の時期とつながる1文(例: `'2月の終わり。倉庫の担当から、取り込みの手順について相談が来ました。'`)。直後の章の `intro` と矛盾しないよう、実装時にマージ済みの章を見て決める

## 動きの仕様

- 新しい画面・操作はない。既存の Extract Method・Merge Methods・Move Method・可視性の変更だけで解ける
- `visibilityEnforced: true` なので、メソッドエディタに可視性の選択欄が出る。Move 後の自動 public 化(`publicizeCrossClassCalls`)は働かないので、プレイヤーが `importStock` を public にする
- 抽出したメソッドには、既存の推論どおり `path` の引数と `result` の戻り値が付く(このステージで見せたい「順序が型に表れる」ところ)
- クラス名・メソッド名はプレイヤーに考えさせない。抽出の名前は `methodNames` の自動命名(`importStock`)を使う

## TDD対象

新しい `domain` / `application` のロジックはない。ステージの定義はデータなので、**`temporalCouplingStage.test.ts` を先に書いて赤にしてから** ステージを足す。AAA で書く。

### `temporalCouplingStage.test.ts`(infrastructure)

- 初期状態: 合計60点で、減点は `responsibility` 2件・`encapsulation` 2件だけ
- 初期状態で `init` / `load` / `run` が public、`NightlyBatch.execute` と `AdminController.reimport` が両方とも `init` → `load` → `run` を呼んでいる
- `execute` から `frag-batch-sequence` を抽出すると、新しいメソッドの引数が `path`(string)、戻り値が `result`(ImportResult)になる
- 模範解答の最終形: 100点。`StockImportJob` の public メソッドは `importStock` だけで、`init` / `load` / `run` は private
- 模範解答の最終形: 呼び出し元2クラスは `StockImportJob` の `init` / `load` / `run` を直接呼ばない(`uses` に含まない)
- 抜け道が100点にならない:
  - 模範解答の5手目まで(`init` を public のまま残す)は、`findOpenSetters` で減点がある
  - 初期状態で `init` だけを private にしても、`encapsulation` の減点は残る(さらに `visibility` の減点が出る)
- 変更依頼 `req-backup-before-update`: 初期は5か所・3クラス、模範解答では4か所・1クラス

### 既存の横断テスト(新ステージで自動的に検査される。通ることを確かめる)

- `stageCatalog.test.ts`: 初期の減点あり / 模範解答で100点 / 各手の後の振る舞いテスト / 1件目の modify がはっきり楽になる / 依頼の解答例が100点 / 問題文の識別子 / 自動命名の表 / outcome の書式 / 責務の散らばりなし / 方針の表(8手以上)
- `stageCode.test.ts`: 行数とコード行数の一致 / 1行1文 / duplicateGroup のコード一致 / reads・writes・uses の参照 / 変数のつながり / フィールドの C# 型 / 全ステージ runtime あり / `expectedBuildFailures` の `03` に実際にビルド問題がある
- `storyChapters.test.ts`: 章がある / 並び順

## 受け入れ基準

1. ステージ一覧の中級の最後に「中級13: 順番に呼ばないと壊れる在庫取り込み」(番号は先着順)が出て、開くと60点から始まる
2. `NightlyBatch.execute` の「init → load → run の順に呼ぶ」を抽出すると、メソッドの見出しに `path` の引数と `ImportResult` の戻り値が出る
3. 模範解答の8手どおりに操作すると100点になり、`StockImportJob` で外から呼べるのは `importStock` だけになる
4. 1件目の変更依頼の痛みカードで、直す場所が 5か所・3クラス → 4か所・1クラス に減ったことが分かる
5. 「ソースをダウンロード(C#)」で zip が取れ、`bash scripts/verify-csharp.sh` で初期・各手(`03` を除く)・最終形がビルド・実行できる
6. `e2e/temporal-coupling-stage.spec.ts`: ステージを開き、`execute` の「順に呼ぶ」処理を抽出すると引数 `path` と戻り値が付くこと、模範解答と同じ操作で100点になることを確かめる(既存の `e2e/refactor.spec.ts` の操作ヘルパーを使う)
7. `docs/stages/report.md` を `npm run stage-report` で作り直してある
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 時間的結合を直接見つける新しい採点ルール(例: 「public メソッドの呼び出し順に依存している」の検出)。既存の encapsulation・responsibility・open setter で足りる。呼び出し順だけの違反を採点したい題材が増えたら検討する
- フィールドを引数・戻り値へ変える新しい操作(「Replace Field with Parameter」など)。`load` と `run` の間の `rows` はクラスの中の private な状態として残してよい
- `load` / `run` を public のまま残したときの減点(公開されたまま使われていないメソッドは、既存の採点では減点しない。模範解答では閉じる)
- コンストラクタ引数で順序を表す形(`new LoadedStock(rows).run()` のような段階ごとのクラス分け)。ゲームにコンストラクタの概念がないため。必要になったら別ステージで扱う
- 呼び出し元が `init()` を呼び忘れた「壊れたコード」を初期コードに入れること(振る舞いテストが全手で緑である必要があるため、誤用はストーリーと説明文で伝える)
- ボスの変更依頼、アンチパターン図鑑(`gallery/antipatterns.ts`)・用語集(`glossary/glossaryTerms.ts`)への追加
- `docs/feature-ideas/IDEAS.md` の項目の削除・書き換え
