# repository-pattern-stage: 上級14「注文の保存を Repository の裏へ移し、依存の向きを逆転させる」を足す

> **実装順の注意**: 新しい上級ステージを足す他の仕様と、題名の番号(上級14)・登録箇所(`advancedStages.ts` の配列の末尾、`sampleAnswer.ts`、
> `storyChapters.ts` の「最後の章」、`stageCatalog.test.ts` の表と `shortcuts`、`layeredOrderApiStage.test.ts`、`nullObjectStage.test.ts`、`docs/stages/report.md`)が衝突する。
> **同時に実装しない**。先に別の上級ステージがマージされていたら、番号は次の空き番号に付け直し、「最後の章」と「上級の末尾」もそれに合わせる。

重複の確認: 既存の実装・仕様に Repository パターンのステージは無い(`docs/feature-ideas/IDEAS.md` の「7. Repositoryパターンで永続化を分離するステージ」だけ)。
この仕様はその案を仕様化したもの。近いステージとの違いは次の通りで、重複ではない。

- 中級11(`intermediate-layered-order-api`): Controller / Service / Repository の**層に分ける**練習。Repository はインターフェースではなく具体クラスで、依存の向きは上から下のまま。
- 上級2(`advanced-payment-gateway-interface`): 呼び出し元が最初からインターフェース越しに呼ぶ形。題材は外部決済で、業務のクラスに保存の処理が混ざっている状態ではない。
- 上級10(`advanced-mail-adapter`): 外部SDKを Adapter で包む。業務のクラスの依存先は**具体クラスの Adapter のまま**で終わる(既知の制約)。
  このステージは、業務のクラス(`Order`・`OrderService`)が最後に**具体的な保存の仕組みをどれも名指ししない**形まで持っていく点が違う。

## 背景・目的

実務の業務コードでは、注文などのドメインのクラスが SQL を組み立てて DB を呼び、ファイルへの書き出しまで自分で行っていることが多い。
すると、保存先のテーブルやファイルの形式が変わるたびに業務のクラスを開くことになり、業務のルールだけを確かめたいテストでも DB とファイルが要る。

Repository パターンでは、保存の約束(インターフェース `OrderRepository`)を**業務の側**が決め、DB・ファイルを扱う実装クラス(`SqlOrderRepository`)がそれに合わせる。
業務のクラスは約束だけを知り、実装クラスの側が業務の約束に向かって矢印を出す(依存性逆転、DIP)。

上級の末尾にこのステージを1つ足し、次の2つを既存の仕組みだけで体験させる。

- **依存の向き**: 初期は業務のクラス `Order` から DB・ファイルのクラスへ層を飛ばす赤い矢印が出る(既存の `layer` 採点)。
  解いたあとは `Order` の依存が0本、`OrderService` の依存先は `Order` と `OrderRepository`(インターフェース)だけになり、
  DB・ファイルを知っているのは `SqlOrderRepository` だけになる。`SqlOrderRepository` から `OrderRepository` へ実装の矢印が出る。
- **差し替えやすさ**: 変更依頼「テストではメモリに保存できるようにして」(extend)が、`OrderRepository` を実装する新しいクラスを足すだけで済む。
  保存の変更(modify)は `SqlOrderRepository` だけ、確定ルールの変更(modify)は `Order` だけで済む。

### このゲームの制約の中でどう表すか(設計の要)

このゲームには呼び出し先(`Fragment.uses`)を書き換える操作が無い。Extract Method で処理を抜き出すと、抜き出し元に**具体的なメソッドへの呼び出し行**が残るので、
「業務のクラスの中の SQL を抜き出して実装クラスへ移す」形にすると、業務のクラスの矢印は必ず具体クラスを指したままになる(上級10と同じ)。

そこで、上級9・11・12・13と同じ「**移行の途中**」の形にする。

- `OrderService.confirmOrder` は前任者が `OrderRepository`(インターフェース)の `findById`・`save` を呼ぶ形に書き換え済み。ただし実装クラスはまだ無い。
- 保存の処理は、`Order` の public メソッド `save`・`findById` に**メソッド丸ごと**残っている(どこからも呼ばれていない、書き換え前の名残)。
- プレイヤーは `save`・`findById` を Move Method で新しいクラスへ移し、そのクラスに `OrderRepository` を実装させる。
  Move Method はメソッドIDを保ったまま持ち主を変えるだけなので、`Order` にも `OrderService` にも具体クラスへの呼び出しが生まれない。

本当に「呼び出し先の付け替え」操作(Extract Interface 相当)が要るか: **要らない**。呼び出し元を最初からインターフェース越しにしておけば、既存の Move Method とインターフェースの実装の設定だけで
「業務 → 約束 ← 実装」の形にたどり着ける。新しい操作は足さない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 新ステージ `repositoryPatternStage`(id `advanced-repository-pattern`)を定義し、`advancedStages` 配列の**末尾**(`nullObjectStage` の次)に足す。runtime の import を1行足す。ファイル冒頭の他ステージと同じく、定義の直前に題材の要約コメントを書く |
| 新規 | `src/infrastructure/stages/runtime/advanced-repository-pattern.ts` | infrastructure | C# 書き出し用の `advancedRepositoryPatternRuntime`(全ステージ runtime 必須: `stageCode.test.ts` の `withoutRuntime` が空であること) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps['advanced-repository-pattern']`(5手)を足す |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 新しい章を末尾に足し、上級13の章から「最後の章」の文言を外す(「全ステージに章がある」「並びが stages と同じ」テストのため) |
| 新規 | `src/infrastructure/stages/repositoryPatternStage.test.ts` | infrastructure(テスト) | 新ステージ固有のテスト(`nullObjectStage.test.ts`・`mailAdapterStage.test.ts` と同じ形) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 「初期違反の種類」の表に1行、近道(`shortcuts`)に2件を足す |
| 変更 | `src/infrastructure/stages/layeredOrderApiStage.test.ts` | infrastructure(テスト) | 「層を持つのは中級11と上級10だけ」を、上級14を加えた3つを期待する形に直す(ステージが増えることで落ちる既存テスト) |
| 変更 | `src/infrastructure/stages/nullObjectStage.test.ts` | infrastructure(テスト) | 「上級13が上級の最後」の期待(`stages.filter(...).at(-1)?.id`)を消す(同じ期待は新しいテストに移す。ステージが増えることで落ちる既存テスト) |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する(`stageReport.test.ts` のファイルスナップショット)。手で編集しない |

- **domain の採点・操作(`scoring/`・`codebase/`・`change/`)、application、presentation は変更しない。** 既存の操作(ファイル追加・クラス追加・Move Method・実装するインターフェースの設定)と
  既存の採点(`responsibility`・`layer`・`contract`・行数・結合度)だけで、初期の減点と100点が決まる。新しい依存は足さない。
- `src/infrastructure/stages/stageReport.ts`・`stageCatalog.ts` のコードは変更しない(`stageCatalog.ts` は `advancedStages` を展開しているだけなので、配列に足せば一覧に出る)。
- `src/infrastructure/stages/solutionPhaseTable.ts` には足さない(方針の表は8手以上のステージだけに必須。このステージは5手)。
- `stageCode.test.ts` の「第6弾の上級…が runtime を持つ」の id 一覧には足さない(上級10・11も足していない。`withoutRuntime` が空であることの検査で新ステージも守られる)。

### 層ごとのまとめ(DDD 4層)

| 層 | 変更 |
| --- | --- |
| domain | ロジックの変更なし。`sampleAnswer.ts` に模範解答のデータ(5手)を足すだけ |
| application | 変更なし |
| infrastructure | ステージ定義・runtime・ストーリーの章・テスト(本体の変更はすべてここ) |
| presentation | 変更なし(層のタグ・矢印・実装の矢印・ステージ一覧は既存の表示がそのまま効く) |

## データ・型の変更

型(`Stage`・`Codebase`・`ChangeRequest`・`StageRuntime`)の変更はなし。ステージデータを1件足す。

### ステージの基本項目

| 項目 | 値 |
| --- | --- |
| id | `advanced-repository-pattern` |
| level | `'advanced'` |
| title | `上級14: 注文の保存を Repository の裏へ移し、依存の向きを逆転させる` |
| problem | `業務のクラスが、DBへのSQLとファイルへの書き出しを直接呼んでいる` |
| outcome | `保存の仕組みを、インターフェースの裏の実装クラスへ分けられる` |
| learns | `['Repository', '依存性逆転']` |
| principles | `['dip']` |
| limits | `{ method: 12, class: 34, file: 36 }` |
| dependencyLimit | `2` |
| responsibilityLimit | `1` |
| layers | `[{ name: 'ドメイン', responsibilities: ['order-flow', 'order-rule'] }, { name: 'リポジトリの実装', responsibilities: ['order-persistence'] }, { name: 'DB・ファイル', responsibilities: ['sql-driver', 'file-io'] }]` |
| visibilityEnforced | 省略(すべて public) |
| conditionNotes | 省略(`dependencyLimit` は0でなく、上限を特別にしていない) |
| runtime | `advancedRepositoryPatternRuntime` |

- description: `ネットショップの注文。OrderService の confirmOrder は、前任者が OrderRepository(インターフェース)経由で注文を読み込み・保存する形に先に書き換えたが、OrderRepository を実装したクラスはまだ無い。DBへの SQL の組み立てと実行、注文の控えのファイルへの書き出しは、今も業務のクラス Order の save・findById に残っていて、Order が SqlConnection と FileStorage を直接呼んでいる。保存の仕組みが変わるたびに業務のクラスを開くことになり、確定のルールだけを確かめたいテストでも DB とファイルが要る。SqlConnection と FileStorage は外部のライブラリなので中身は変えない。`
- goal: `Order の save・findById を、保存の仕組みを受け持つ新しいクラス(自動で SqlOrderRepository と名前が付く)へ Move Method で移し、SqlOrderRepository が OrderRepository を実装(implements)するよう設定しよう。OrderService は最初から OrderRepository だけを呼んでいるので、Order と OrderService は DB もファイルも知らない形になり、実装クラスの側が業務の決めた約束に合わせる(依存の向きが逆になる)。メソッドは12行・クラスは34行・ファイルは36行以内、1クラスの責務は1種類まで、依存先は2クラスまで`
- why: `保存先のテーブルやファイルの形式が変わるたびに、確定のルールを持つ Order を開いて直し、ルールを確かめるテストにも DB とファイルを用意していました。保存の仕組みを OrderRepository の実装クラスへ分けたので、保存の変更は SqlOrderRepository だけで済み、テストではメモリに保存する実装に差し替えられます。`
- responsibilityNames: `'order-flow': '注文の手続き'`、`'order-rule': '注文のルール'`、`'order-persistence': '注文の保存'`、`'sql-driver': 'SQLの実行'`、`'file-io': 'ファイル書き込み'`、`'in-memory-persistence': 'メモリへの保存'`
- classNames(自動命名。初期のクラス名と重ねない): `'order-flow': 'OrderWorkflow'`、`'order-rule': 'OrderRules'`、`'order-persistence': 'SqlOrderRepository'`、`'sql-driver': 'SqlExecutor'`、`'file-io': 'TextFileWriter'`
- methodNames: `'order-flow': 'runOrderFlow'`、`'order-rule': 'applyOrderRule'`、`'order-persistence': 'persistOrder'`、`'sql-driver': 'runSql'`、`'file-io': 'writeTextFile'`

### 初期コードベース

ID は他ステージのテストが名指しする ID と重ねないよう、すべて `repo-` を含める(実装時に `grep "repo-"` で既存と重ならないことを確かめる)。
`lines` はコードの行数と一致させ、1行に文は1つ(`stageCode.test.ts`)。役割の隠しタグ(`roleResponsibilities`)は使わない(`stageCatalog.test.ts` が役割タグ付きクラスを9件と数えているため)。

| ファイル(id) | クラス(id) | メソッド(id・可視性・引数・戻り値) | Fragment(id / label / lines / responsibility / その他) |
| --- | --- | --- | --- |
| `src/order/OrderService.ts`(`file-repo-order-service`) | OrderService(`class-repo-order-service`) | `confirmOrder`(`method-repo-confirm-order`・public・`int orderId`) | `frag-repo-service-load` / OrderRepository(インターフェース)経由で注文を読み込む / 1 / `order-flow` / uses `method-repo-contract-find`<br>`frag-repo-service-confirm` / 注文を確定する / 1 / `order-flow` / uses `method-repo-order-confirm`<br>`frag-repo-service-store` / OrderRepository(インターフェース)経由で注文を保存する / 1 / `order-flow` / uses `method-repo-contract-save` |
| `src/order/Order.ts`(`file-repo-order`) | Order(`class-repo-order`) | `confirm`(`method-repo-order-confirm`・public・`OrderData order`) | `frag-repo-confirm-stock` / 商品があり、在庫が足りているか確かめる / 2 / `order-rule`<br>`frag-repo-confirm-total` / 合計金額を計算して、注文を確定済みにする / 3 / `order-rule` |
| | | `save`(`method-repo-order-save`・public・`OrderData order`) | `frag-repo-save-sql` / INSERT 文で、注文を DB に保存する / 2 / `order-persistence` / uses `method-repo-sql-execute`<br>`frag-repo-save-file` / 注文の控えを JSON ファイルに書き出す / 2 / `order-persistence` / uses `method-repo-file-write` |
| | | `findById`(`method-repo-order-find`・public・`int orderId`・returns `order: OrderData`) | `frag-repo-find-sql` / SELECT 文で、注文を DB から読み込む / 2 / `order-persistence` / uses `method-repo-sql-query` |
| `src/order/OrderRepository.ts`(`file-repo-order-repository`) | OrderRepository(`class-repo-order-repository`) | `save`(`method-repo-contract-save`・public・`OrderData order`)・`findById`(`method-repo-contract-find`・public・`int orderId`・returns `order: OrderData`)、どちらも `fragments: []` | なし(インターフェース役。業務の側に置く) |
| `src/vendor/SqlConnection.ts`(`file-repo-sql-connection`) | SqlConnection(`class-repo-sql-connection`) | `execute`(`method-repo-sql-execute`・public・`string sql, OrderData order`) | `frag-repo-sql-execute` / SQL を DB に送って実行する(ライブラリの中身) / 2 / `sql-driver` |
| | | `query`(`method-repo-sql-query`・public・`string sql, int id`・returns `row: OrderData`) | `frag-repo-sql-query` / SQL を DB に送って1行読み込む(ライブラリの中身) / 2 / `sql-driver` |
| `src/vendor/FileStorage.ts`(`file-repo-file-storage`) | FileStorage(`class-repo-file-storage`) | `writeText`(`method-repo-file-write`・public・`string path, string text`) | `frag-repo-file-write` / ファイルに文字列を書き込む(ライブラリの中身) / 2 / `file-io` |

- `Order` のメソッドの引数は `OrderData order` にする(上級9の `Order.pay(OrderData order)` と同じ形)。`save`・`findById` の引数と戻り値を `OrderRepository` の契約と同じにしておくので、
  移したメソッドがそのまま契約を満たす(契約の判定は名前だけだが、C# の書き出しでも型が合う)。
- `Order` の `save`・`findById` は契約と同じ名前の public メソッドなので、初期状態で `contract`(実装の宣言漏れ)が1件出る。これは「Order が保存の約束を自分で抱えている」という題材そのものの減点として正しい。
- SQL はプレースホルダ(`@id` など)で書き、値を文字列に埋め込まない。学習用の題材でも SQL インジェクションの書き方を見せないため。

各 Fragment の C# コード(`code.csharp`。行数 = 上の lines)と `variables`:

```csharp
// frag-repo-service-load   variables: { declares: order(OrderData), uses: ['orderId'] }
var order = findById(orderId);
// frag-repo-service-confirm   variables: { uses: ['order'] }
confirm(order);
// frag-repo-service-store   variables: { uses: ['order'] }
save(order);
// frag-repo-confirm-stock   variables: { uses: ['order'] }
if (order.Items.Count == 0) throw new ValidationException("注文に商品がありません");
if (order.Items.Any(item => item.Quantity > item.Stock)) throw new ValidationException("在庫が足りません");
// frag-repo-confirm-total   variables: { uses: ['order'] }
order.Total = order.Items.Sum(item => item.UnitPrice * item.Quantity);
order.Status = "Confirmed";
Log.Info($"注文 {order.Id} を確定しました");
// frag-repo-save-sql   variables: { declares: insertSql(string), uses: ['order'] }
var insertSql = "INSERT INTO orders (id, total, status) VALUES (@id, @total, @status)";
execute(insertSql, order);
// frag-repo-save-file   variables: { declares: backupJson(string), uses: ['order'] }
var backupJson = $"{{\"id\": {order.Id}, \"total\": {order.Total}, \"status\": \"{order.Status}\"}}";
writeText($"backup/order-{order.Id}.json", backupJson);
// frag-repo-find-sql   variables: { declares: selectSql(string)・order(OrderData), uses: ['orderId'] }
var selectSql = "SELECT id, total, status FROM orders WHERE id = @id";
var order = query(selectSql, orderId);
// frag-repo-sql-execute   variables: { uses: ['sql', 'order'] }
FakeDatabase.Execute(sql, order);
Log.Debug("SQL を実行しました");
// frag-repo-sql-query   variables: { declares: row(OrderData), uses: ['sql', 'id'] }
var row = FakeDatabase.Fetch(sql, id);
Log.Debug("SQL で1行読み込みました");
// frag-repo-file-write   variables: { uses: ['path', 'text'] }
FakeDisk.Write(path, text);
Log.Debug($"{path} に書き込みました");
```

### runtime(`src/infrastructure/stages/runtime/advanced-repository-pattern.ts`)

`advanced-mail-adapter.ts` と同じ形で書く。

- `entryMethodId: 'method-repo-order-save'`、`entryArguments: ['SampleData.Order']`。
  上級2と同じ理由で、入口は `OrderService.confirmOrder` にしない(初期は `OrderRepository` の実装が無く、インターフェース越しには実行できない)。
  `save` は ID で今の持ち主を探すので、`SqlOrderRepository` へ移したあとも同じ出力になる。
- `bindings`・`bindingDemos` は持たない(完成形でも `OrderRepository` の実装は `SqlOrderRepository` の1つだけ)。
- `expectedBuildFailures` は持たない見込み(private のまま別クラスから呼ぶ手が無い)。実装時に `stageCode.test.ts`「ビルド失敗予定のスナップショットには実際にビルド問題がある」と
  `npm run csharp-export` で確かめ、失敗する手があれば実際の値を書く。
- support: `logFile` と `supportFile('Orders.cs', ...)`。いずれも何をしたかを `Console.WriteLine` で1行出す偽物。
  - `OrderItem`(`UnitPrice`・`Quantity`・`Stock`)、`OrderData`(`Id`・`Items`・`Total`・`Status`)、`ValidationException`
  - `FakeDatabase.Execute(string sql, OrderData order)`・`FakeDatabase.Fetch(string sql, int id)`(`SampleData.Order` と同じ中身の `OrderData` を返す)、`FakeDisk.Write(string path, string text)`
  - `SampleData.Order`(明細2点、在庫は足りている)
  - `logFile` など既存の補助ファイルに既にあるものは重ねて定義しない

### 変更依頼(changeRequests。この順に並べる。ボスなし)

| # | id | kind | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-in-memory-repository` | `extend` | テストではメモリに保存できるようにして | 注文の確定ルールのテストを、DB とファイルを用意せずに動かしたい。テストのときだけ、注文をメモリ上に保存して読み出せるようにしたい。本番はこれまでどおり DB に保存する。 | `in-memory-persistence` | 6 | `storeInMemory` | なし(最初に全文を見せる extend) |
| 2 | `req-order-updated-at` | (modify) | 注文に更新日時を残して | 注文のテーブルに更新日時の列が増えた。保存と読み込みの SQL で、更新日時も書き込み・読み出したい。 | `order-persistence` | 2 | `mapUpdatedAt` | なし(最初に全文を見せる modify) |
| 3 | `req-minimum-order-amount` | (modify) | 1,000円未満の注文は確定できないようにして | 送料の負担が大きいので、合計が1,000円未満の注文は確定の時点で止めたい。 | `order-rule` | 2 | `rejectSmallOrder` | `{ from: '先輩の田中さん', text: '注文を確定できる条件を見直す話が、いつか出てくるかもしれないらしいです。' }` |

- 1は「保存の仕組みを差し替えられる」ことを見せる。解いたあとは `OrderRepository` を実装する新しいクラスに置けば既存クラスを書き換えずに済む(`OrderRepository` は `OrderService` から呼ばれているので `'abstract'` の置き先になり100点)。
  初期状態では `OrderRepository` を誰も実装していないので、`withoutUnimplementedInterfaces` によって拡張の入口として扱われない(解く前後の差が出る)。
- 2は「保存の変更が `SqlOrderRepository` だけで済む」、3は「ルールの変更で保存の処理を読まずに済む」を見せる。どちらも初期は `Order`(ルールと保存が混ざったクラス)を直す。
- 1件目の modify(2)は `measurePain` の対象。場所 2→2・クラス 1→1 だが、クラスの行数が 32→20(0.75 以下)なので `isClearlyRelieved` を満たす見込み。
- ボス(`boss: true`)は付けない(ボスのあるステージを固定で列挙しているテストを変えないため)。

### 理解度チェック(checks。正解の位置を2問で変える。正解の選択肢を最長にしない。解説に正誤を書かない)

- `check-1`(answer: 1)「Order の保存の処理を SqlOrderRepository へ移し、OrderService が OrderRepository(インターフェース)だけを呼ぶ形にすると、何が良くなる?」
  - 0: `注文の確定ルールも保存の処理も1つのクラスにまとまるので、読む場所が1か所で済むようになる` / 解説: `まとめるのではなく分けています。ルールと保存の事情を分けると、片方の変更がもう片方に響かなくなります。`
  - 1: `保存先が変わっても、Order と OrderService は直さずに済む` / 解説: `DB やファイルの事情を知っているのは SqlOrderRepository だけなので、保存の変更はそこで止まります。`
  - 2: `SQL を書かなくてよくなる` / 解説: `SQL は SqlOrderRepository の中に残ります。変わるのは、書く場所と、それを知っているクラスの数です。`
- `check-2`(answer: 2)「依存性逆転(DIP)になっている形はどれ?」
  - 0: `Order が SqlOrderRepository を直接呼び、SqlOrderRepository が DB を呼ぶ` / 解説: `業務のクラスが具体的な保存の仕組みを名指ししているので、保存の変更が業務のクラスまで届きます。`
  - 1: `OrderRepository を DB のクラスのそばに置き、メソッドも DB の都合に合わせた名前と引数にする` / 解説: `約束は使う側(業務)の言葉で決めます。DB の都合に合わせると、DB の変更が約束ごと業務へ届きます。`
  - 2: `OrderService は OrderRepository だけを知り、SqlOrderRepository がそれを実装する` / 解説: `業務の側が決めた約束に、保存の仕組みの側が合わせます。矢印が「仕組み → 業務の約束」の向きになります。`

### 模範解答(`sampleAnswerSteps['advanced-repository-pattern']`、5手)

```ts
'advanced-repository-pattern': [
  { addFile: 'src/infrastructure/SqlOrderRepository.ts' },
  { addClass: { name: 'SqlOrderRepository', file: 'src/infrastructure/SqlOrderRepository.ts' } },
  { move: { method: 'save', fromClass: 'Order', toClass: 'SqlOrderRepository' } },
  { move: { method: 'findById', fromClass: 'Order', toClass: 'SqlOrderRepository' } },
  { addInterface: { class: 'SqlOrderRepository', interface: 'OrderRepository' } },
],
```

- `move` の `fromClass: 'Order'` は必須(`OrderRepository` にも同名の `save`・`findById` があるため)。
- `addFile`+`addClass` は、プレイヤーが `save` を空いた場所へドラッグして新しいクラスを作る操作(`classNames['order-persistence']` から自動で `SqlOrderRepository` と命名)を表す。
  インターフェース(`src/order/`)と実装(`src/infrastructure/`)を別の場所に置くのは、約束が業務の側にあることを示すため(ファイル名は画面に出さないので、データ上の表現)。
- 8手未満なので方針の表(`solutionPhaseTable`)は足さない。

### 机上の検算(`stageCatalog.test.ts` の保証に通ること。実装時に実測して違えばデータを直す)

行数は `lineCount.ts` のとおり Fragment =「コード行数+1」、メソッド = +3 と Fragment 間の空行、クラス = +3 とメソッド間の空行。

| 対象 | 初期 | 模範解答後 | 上限 |
| --- | --- | --- | --- |
| `OrderService.confirmOrder` / クラス | 11 / 14 | 11 / 14 | メソッド12 / クラス34 |
| `Order.confirm` / `save` / `findById` | 11 / 10 / 6 | 11 / — / — | メソッド12 |
| `Order` クラス・ファイル | 32 / 32 | 14 / 14 | クラス34 / ファイル36 |
| `SqlOrderRepository` クラス | — | 20 | クラス34 |
| `SqlConnection` / `FileStorage` クラス | 16 / 9 | 16 / 9 | クラス34 |
| 責務の種類 | Order が2種(1件違反)、ほかは1種 | どのクラスも1種 | 1 |
| 依存 | OrderService → Order・OrderRepository(2)、Order → SqlConnection・FileStorage(2) | OrderService → Order・OrderRepository(2)、Order → なし、SqlOrderRepository → SqlConnection・FileStorage(2) | 2 |
| 層 | Order(ドメイン)→ SqlConnection・FileStorage(DB・ファイル)が層を飛ばす(2件違反) | SqlOrderRepository(リポジトリの実装)→ DB・ファイル(違反なし)。OrderRepository は処理を持たないので層なし | — |
| 約束違反 | Order が `save`・`findById` を持つのに OrderRepository を実装していない(宣言漏れ1件) | SqlOrderRepository が両方を持ち実装を宣言(0件) | — |

- 初期: responsibility 1件+layer 2件+contract 1件 = **60点**。減点の種類は `['responsibility', 'layer', 'contract']`(行数・結合度・循環・空のクラスなし)。
- 模範解答後: **100点**。
- 層の採点が見るのは「業務のクラスが DB・ファイルを直接呼ばない」ことだけ。依存性逆転そのもの(実装クラス → 約束の implements)は層の採点の対象外で、
  実装の矢印と「`OrderService` の依存先に具体的な保存クラスが無い」ことでステージのテストが確かめる。新しい採点ルール(DIP 違反の検出など)は足さない
  (本当に要るか: 既存の `layer`・`contract`・`responsibility` の組み合わせで、初期は減点・解答後は0にできるので要らない)。
- 変更依頼の変更コスト(`scoreChange`): 2・3とも初期は `Order`(責務が混ざったクラス)を直すので `entangled-class` が付き、2は `Order` が上限34を超える(32+2×2)ので `limit-break` も付く見込み。
  模範解答後はどちらも付かないので「変更コストが下がる」「変更が必要なクラスの数が増えない」を満たす。
- 解答例の置き方(`sampleImplementation`)はすべて100点の見込み(1: `OrderRepository` を実装する新しいクラス、2: `SqlOrderRepository`、3: `Order`)。
  100点にならなければ題材の数値を直す(`knownChangeRequestExceptions` には足さない)。
- 振る舞いのテスト: 移動と実装の設定は実行される処理の集合を変えない。どの手の後も緑(上級2と同じく、実装の無いインターフェースへの呼び出しを含んだまま始まる)。
- 自動命名: 空いた場所へ `save` をドラッグして作るクラスは `SqlOrderRepository` と自動で付く(プレイヤーに命名させない)。

### ストーリー(`storyChapters.ts`)

- 上級13の章: title を `クーポンのない注文` に、outro を `3月31日の午後遅く。注文のテストについて、QAの高橋さんから相談が届きました。` にする。
- 新しい章を末尾に足す: `{ stageId: 'advanced-repository-pattern', title: '最後の章、注文の保存', speaker: TAKAHASHI, intro: 'QAの高橋です。注文の確定ルールを確かめたいだけなのに、毎回テスト用の DB とファイルの置き場を用意しないと動かせません。Order が保存の SQL やファイルの書き出しまで自分で呼んでいるからなんです。保存の仕組みを、差し替えられる形にしてもらえませんか。', outro: '3月31日の夕方。最後の依頼が届きました。このコードが整っていたからこそ、慌てずに済みそうです。' }`

## 動きの仕様

- ステージ一覧の上級の末尾(上級13の次)に「上級14: 注文の保存を Repository の裏へ移し、依存の向きを逆転させる」が出る。学べることに「Repository」「依存性逆転」が出る。
- 初期画面: 層の帯が「ドメイン」「DB・ファイル」(と「未分類」に OrderRepository)で出る。Order から SqlConnection・FileStorage への2本の矢印が層を飛ばす違反として赤い。
  OrderService から OrderRepository と Order へ矢印が出る。Order は責務の混在と約束違反で減点されている(60点)。
- プレイヤーの操作は既存のものだけ: Order の `save` を空いた場所へドラッグして新しいクラス(自動で `SqlOrderRepository`)を作る → `findById` も同じクラスへドラッグ →
  クラスの右クリックから「実装するインターフェースを設定」で OrderRepository を選ぶ。
- 2つを移した直後は SqlOrderRepository の「実装の宣言漏れ」で減点が残り、OrderRepository を実装すると100点になる。赤い矢印が消え、SqlOrderRepository から OrderRepository へ実装の矢印が出る。
- 100点のあと、変更依頼は「テストではメモリに保存できるようにして」(新しいクラスで100点)→「注文に更新日時を残して」(SqlOrderRepository だけ直す)→「1,000円未満の注文は…」(うわさ付き、Order だけ直す)の順に出る。

### 設計判断(確定)

1. **呼び出し元(`OrderService`)は最初から `OrderRepository` 越しに呼ぶ「移行の途中」の形にし、保存の処理は `Order` の public メソッドに丸ごと置く。**
   抽出で呼び出し行が残らないので、既存の Move Method だけで「業務 → 約束 ← 実装」にたどり着ける(上記「設計の要」)。上級9・11・12・13と同じ作り。
2. **外部の DB・ファイルをステージ内のクラス `SqlConnection`・`FileStorage` として置き、`layers` で層の向きを採点する。** 依存は `uses` からしか出ないので、クラスにしないと
   「業務 → DB・ファイル」の矢印が描けない(上級10の設計判断1と同じ)。中身を変えないことは説明文で伝え、ロックは作らない(YAGNI)。
3. **層は3段(ドメイン/リポジトリの実装/DB・ファイル)にする。** `OrderService` と `Order` は同じ「ドメイン」の段に置く(上級10が業務のサービスを「ドメイン」に置いたのと同じ)。
   アプリケーション層を分けた4段にしても採点の結果は変わらないので、段の少ないほうを選ぶ。
4. **SQL とファイルの書き出しは同じ責務 `order-persistence` にする。** どちらも「注文をどこにどう残すか」で、Repository の実装が受け持つ範囲。責務を分けると、
   実装クラスの中でさらにクラスを分ける手が要り、このステージの主題(依存の向き)から外れる。
5. **キャンセルなど2つ目の業務メソッドは置かない。** 確定ルール1つで、ルールの変更依頼(3)と保存の変更依頼(2)の違いを見せられる。
6. **extend の依頼(メモリへの保存)を出す。** `OrderRepository` は `OrderService` から呼ばれているので、新しい実装クラスが100点の置き先になる(上級10で extend を出せなかった事情が無い)。
   IDEAS.md の「保存方法の差し替えが容易になる効果」をそのまま体験させる。
7. **E2E は足さない。** 新しい操作・UI は無く、使う操作(新しいクラスへのドラッグ・Move Method・実装するインターフェースの設定)は既存の E2E が守っている
   (上級3・上級9・上級10・上級13の仕様と同じ判断)。既存の E2E が通ることだけを確かめる。E2E にはステージ数や上級の最後のステージを固定で見ている箇所は無い(`e2e/` を grep して確認済み)。

## TDD対象

新しい純粋関数は無い(domain・application のロジックを足さない)。ステージデータが仕様どおりに採点されることを、**先にテストを書いて Red を確かめてから**データを足す(Red → Green)。
すべて Vitest・AAA(`// Arrange` `// Act` `// Assert`)で書く。

### `repositoryPatternStage.test.ts`(infrastructure・新規)

- 正常系: 模範解答は5手で、初期60点・模範解答後100点。上級の最後のステージである(`stages.filter((s) => s.level === 'advanced').at(-1)?.id`)
- 正常系: 初期の減点の種類と件数は `responsibility` 1件・`layer` 2件・`contract` 1件だけ
- 正常系: 初期の layer 違反は、Order(`class-repo-order`)から SqlConnection・FileStorage への `skip` の2件
- 正常系: 模範解答後、SqlOrderRepository が `interfaceIds` に `class-repo-order-repository` を持ち、メソッドは `save`・`findById` の2つ、責務は `order-persistence` だけ
- 正常系: 模範解答後、Order のメソッドは `confirm` だけで責務は `order-rule` だけ、Order から出る依存は0本
- 正常系: 模範解答後、OrderService の依存先は Order と OrderRepository だけ(SqlOrderRepository・SqlConnection・FileStorage を含まない)。
  SqlConnection・FileStorage に依存するクラスは SqlOrderRepository だけ。layer の減点は0
- 正常系: 模範解答後も SqlConnection・FileStorage の中身(メソッド・処理)は初期と同じ
- 異常系: 模範解答から `addInterface` の手を抜くと100点未満で、`contract` が1件
- extend `req-in-memory-repository`: 模範解答後の置き先が `{ kind: 'new-class', implementing: 'OrderRepository' }` で、書き換える既存クラスが0
- modify `req-order-updated-at`(`measurePain`): 初期・模範解答後とも変更するクラスは1つで、クラスの行数が初期より減っている(`isClearlyRelieved` が true)
- 依頼の種類が `['extend', 'modify', 'modify']` で、3件目だけがうわさを持つ
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(infrastructure・変更)

- 「初期違反の種類」の表に `['advanced-repository-pattern', ['responsibility', 'layer', 'contract']]` を足す
- 近道(`shortcuts`、どちらも100点未満):
  - `SqlOrderRepository へ移すが OrderRepository を実装しない`: 模範解答から `addInterface` の手を除いたもの(contract が残る)
  - `Order 自身に OrderRepository を実装させる`: `[{ addInterface: { class: 'Order', interface: 'OrderRepository' } }]` の1手(約束違反は消えるが、責務の混在と層の飛ばしが残る。Active Record のまま約束だけ付ける誤答)
- その他の全ステージ共通の検査(模範解答で100点・どの手の後も振る舞いが緑・解答例の依頼が100点・変更コストが下がる・うわさ・自動命名・責務名・ID重複・outcome・problem の識別子・原則・runtime の変数のつながり など)は、
  コードの変更なしに新ステージにも効く。ここが実質的な受け入れテストなので、データの数値はこれらが通るように実測で合わせる

### ステージ数が増えることで直す既存テスト

| ファイル | 落ちる理由 | 直し方 |
| --- | --- | --- |
| `src/infrastructure/stages/layeredOrderApiStage.test.ts` | 「層を持つのは中級11と上級10だけ」が `layers` を持つステージ一覧を固定で比べている | 期待を `[stage.id, 'advanced-mail-adapter', 'advanced-repository-pattern']` にし、テスト名を「層を持つのは中級11・上級10・上級14だけ」にする |
| `src/infrastructure/stages/nullObjectStage.test.ts` | 「上級の最後が上級13」を `at(-1)` で見ている | その1行を消す(「上級の最後」の確認は新しいテストが持つ) |
| `src/infrastructure/stages/stageReport.test.ts` の `docs/stages/report.md` スナップショット | 表に1行増え、上級の集計行が変わる | `npm run stage-report` で `docs/stages/report.md` を再生成する(テストのコードは変えない) |
| `src/infrastructure/story/storyChapters.test.ts` | 「今の全ステージに章がある」「並びが stages と同じ」 | 上の「ストーリー」のとおり章を足す(テストのコードは変えない) |

`stageReport.ts` の集計ロジックはステージ数に依存しないので変更しない。

### `docs/stages/report.md` への影響(再生成で変わる箇所の見込み)

- 上級13の行の次に上級14の行が1行増える。見込み: 初期点 60、主な減点「層の依存の向き -20、責務の混在 -10、インターフェースの約束違反 -10」、手数 5、
  使う操作「ファイル追加、クラス追加、移動、実装」、規模「5ファイル / 5クラス / 9メソッド」、依頼「ルール変更 2 / 機能追加 1」、注意なし
- 「レベルごとの集計」の上級の行: ステージ数 13 → 14、手数の中央値 13 → 12.5、初期点の平均 50.8 → 51.4(見込み)
- 他のステージの行は変わらない。中級・上級の「レベルの中央値の手数が前のレベルより少ない」の注意も増えない(上級 12.5 は中級 7 より多い)
- 数値は手で書かず、必ず `npm run stage-report` の生成結果をそのままコミットする

## E2E の対象

**追加しない**(設計判断7)。`npm run test:e2e` の既存テストがすべて通ることを確かめるだけ。

## 受け入れ基準

1. ステージ一覧を開くと、上級の末尾(上級13の次)に「上級14: 注文の保存を Repository の裏へ移し、依存の向きを逆転させる」があり、学べることに「Repository」「依存性逆転」が出る
2. 上級14を開くと初期点が60点で、Order から SqlConnection・FileStorage への矢印が層を飛ばす違反として赤く、Order が責務の混在と約束違反で減点されている
3. Order の `save` を空いた場所へドラッグすると `SqlOrderRepository` という名前のクラスが自動ででき、`findById` も移して OrderRepository を実装すると100点になり、赤い矢印が消えて実装の矢印が出る。解答例の再生でも最後に100点になる
4. 100点のあと、変更依頼「テストではメモリに保存できるようにして」は OrderRepository を実装する新しいクラスに置くと置き方が100点、「注文に更新日時を残して」は SqlOrderRepository に置くと100点になる。3件目の依頼にはうわさ(先輩の田中さん)が先に出る
5. ストーリーをオンにすると、上級13のあとに「最後の章、注文の保存」が出て、上級13の章はもう「最後の章」と名乗らない
6. `npm run csharp-export` で上級14の C# プロジェクトが書き出され、初期と完成形で同じ出力になる(`scripts/verify-csharp.sh` は .NET 8 SDK がある環境で実施)
7. `docs/stages/report.md` が再生成され、上級14の行と、上級の集計行(14ステージ)がある
8. `src/domain`・`src/application`・`src/presentation` に差分が無い(`sampleAnswer.ts` のデータ追加を除く)
9. `npm run check`(lint + typecheck + test)と `npm run test:e2e` が通る

## スコープ外

- 呼び出し先(`uses`)を書き換える操作(Extract Interface 相当)。呼び出し元を最初からインターフェース越しにすることで不要にした
- 依存性逆転を検出する新しい採点ルール、層の採点で implements の向きを見ること。既存の `layer`・`contract`・`responsibility` で足りる
- `layers` の段にアプリケーション層を分けること、OrderRepository を「未分類」ではなく「ドメイン」の段に出す見た目の調整(上級10と同じ既知の見た目)
- 外部ライブラリのクラス(SqlConnection・FileStorage)を読み取り専用にする仕組み
- 読み込み・保存以外の Repository のメソッド(削除・一覧・検索条件)、Unit of Work、トランザクション
- メモリ保存の実装クラス(`InMemoryOrderRepository`)を初期コードや模範解答に入れること(変更依頼1で足す側の話)
- 方針の表(`solutionPhaseTable`)への追加(5手のため不要)、`stageCode.test.ts` の runtime の id 一覧・bindings の実行テストへの追加
- パターン比較表(`patternComparison.ts`)・比較クイズ(`comparisonQuizzes.ts`)への追加、ボスの変更依頼
- 既存ステージ(中級11・上級2・上級10・上級13)のデータの変更。ストーリーの上級13の章の文言だけは、最後の章でなくなるので直す
- `docs/feature-ideas/IDEAS.md` の更新(仕様化した案の片付けは、仕様の確定後に呼び出し元が行う)
