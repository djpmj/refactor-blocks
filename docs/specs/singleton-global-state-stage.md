# singleton-global-state-stage: 上級14「あちこちから読む Singleton の設定を、コンストラクタで受け取る形にする」を足す

> **実装順の注意**: 新しいステージを足す別の仕様(`command-pattern-stage` など)と、題名の番号(上級14)と登録ファイル(`advancedStages.ts`・`sampleAnswer.ts`・`solutionPhaseTable.ts`・`storyChapters.ts`・`stageCatalog.test.ts`・`docs/stages/report.md`)が衝突する。**同時に実装しない**。先にマージされたものがあれば、番号は次の空き番号に付け直し、`storyChapters.ts` の「最後の章」も最新のものに合わせる。
> この仕様は**採点ルールを1つ足す**(`ScoreRule` の追加)。同じく `ScoreRule` を足す仕様とも `score.ts`・`describeScore.ts`・`ruleWhy.ts`・`violationTargets.ts` で衝突するので、同時に実装しない。

## 背景・目的

`docs/feature-ideas/IDEAS.md` の「5. Singleton・グローバル状態の解消ステージ」が未仕様化のまま残っている。
あちこちのクラスが `AppConfig.Instance` で設定を直接読んでいる構成を、**使う側がコンストラクタで受け取る形(コンストラクタ注入)**に組み替える上級ステージを足す。
学ばせたいことは次の2つ。

- **隠れた依存**: `AppConfig.Instance` はどこからでも取り出せるので、コンストラクタを見ても、どのクラスがどの設定を使うのか分からない。
  テストで税率だけ変えたくても、みんなで使う設定そのものを書き換えるしかない(テストのしにくさ)。
- **結合度**: 1つの設定箱に全員がつながっているので、税率の変更がポイントや送料のクラスにまで波及する(変更依頼の「波及」で見せる)。

### 既存の仕組みで足りるか(調査の結論)

| 仕組み | 調べたもの | 結論 |
| --- | --- | --- |
| 操作 | Move Method・新しいクラスへの移動(`moveToNewHome.ts`)・ファイル削除(`deleteFile.ts`。空のクラスだけ消せる `delete-class-code-guard`) | **足りる**。新しい操作は足さない |
| 依存の矢印 | `classDependencies`(`dependencies.ts`。`uses`・`reads`/`writes` から算出) | **足りる**。`AppConfig` を呼ぶ4クラスから矢印が出る |
| C#書き出し・コードプレビュー | `csharp-move-wiring`(`csharpWiring.ts` の `wiringOf`・`compositionOrder`) | **足りない**。別クラスへの依存は**すべて**コンストラクタ注入として出るので、初期状態のコードタブがすでに `public OrderPricing(AppConfig appConfig)` になり、「`AppConfig.Instance` を直接読んでいる」がコード上に現れない。ステージの主題と画面が食い違う |
| 採点 | `dependency-scoring` の `coupling`・`cycle`、`responsibility`・`cohesion`・`empty` ほか全19ルール | **足りない**。「Singleton かどうか」をモデルが持たないので、`AppConfig` に税率の設定だけを残して送料・ポイントを移すと、`AppConfig` は責務1種類・依存の上限内になり **100点**になる(下の検算「近道1」)。`OrderPricing` は `AppConfig.Instance` を読み続けたまま。新しいクラスへ移した `TaxSettings` と、税率だけ残った `AppConfig` は、データ上まったく同じ形で、既存のどのルールでも区別できない |

このため、**足すのは次の2つだけ**にする(ponytail の階段: 既存の操作・依存・行数・責務の採点はそのまま使い、モデルに欠けている1点だけを足す)。

1. `CodeClass.singleton?: true`(隠しタグ)。ステージ作者が「`<名前>.Instance` でどこからでも取り出すクラス」に付ける。C#書き出し・コードプレビューは、このクラスへの依存を**コンストラクタで受け取らず `AppConfig.Instance.xxx()` と直接書く**。
2. 採点ルール `'singleton'`(表示名「Singleton の直接参照(隠れた依存)」)。タグ付きクラスへの依存1本につき -10。タグを持つクラスが無いステージでは常に0件なので、既存ステージの点数は変わらない(中級11で足した `layer` ルールを上級10でも使っているのと同じ、「ステージのデータで有効になるルール」)。

検討して採らなかったもの:

- **新しい操作「Singleton をやめる」(タグを外すトグル)**: 1回のクリックで主題が終わってしまい、「使う側が要るものだけを受け取る」形に組み替える練習にならない。UI と E2E も丸ごと増える。採らない。
- **既存の `coupling` に数を足す**(`contract`・`encapsulation` が2つの検出を足し合わせている形): 減点の表示が「結合度」になるのに、クリア条件は「依存先は1クラスまで / 今: 最大1クラス」のままで、プレイヤーには理由が読めない。採らない。
- **`Stage` 側に Singleton のクラスIDを持つ**: C#の生成(`generateClassSourceLines`・`compositionOrder`)は `Codebase` しか受け取らないので、`Stage` を全呼び出し元へ通す変更が要る。クラスのタグなら、名前を変えても(`renameClass` はスプレッドで残す)消しても(`deleteClass`)自然についていく。採らない。
- **`roleResponsibilities` で `AppConfig` に残った設定を減点する**: `stageCatalog.test.ts`「役割タグを付けた全クラスは初期状態で減点されない」に反する(初期の `AppConfig` に設定の処理があるため)。採らない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/Codebase.ts` | domain | `CodeClass` に `singleton?: true` を足す |
| 変更 | `src/domain/codebase/isCodebase.ts` | domain | 信頼境界(下書きの読み込み)で `singleton` を検査する。`true` だけを通す(`autoNamed` と同じ検査) |
| 新規 | `src/domain/scoring/singletonReferences.ts` | domain | `findSingletonReferences(codebase)`: タグ付きクラスへの依存を返す |
| 新規 | `src/domain/scoring/singletonReferences.test.ts` | domain(テスト) | 上の関数のテスト |
| 変更 | `src/domain/scoring/score.ts` | domain | `ScoreRule` に `'singleton'` を足し、`deductions` の**最後**(`'mixed-method'` の後)に数える |
| 変更 | `src/domain/scoring/violationTargets.ts` | domain | `singleton`: 依存元(`from`)のクラスを強調対象にする |
| 変更 | `src/domain/scoring/violationDependencies.ts` | domain | `singleton: DependencyPair[]` を足す(減点の内訳に「OrderPricing → AppConfig」と出すため) |
| 変更 | `src/domain/scoring/fileScores.ts` | domain | `['singleton', 依存元のクラスID]` を足す(依存元のクラスのファイルに数える。`cycle` と同じ) |
| 変更 | `src/domain/codebase/csharpWiring.ts` | domain | Singleton への依存はコンストラクタで受け取らず、受け手を `<名前>.Instance` にする。Singleton は `Program.cs` で `new` しない。Singleton 自身が使う別クラスは後からの代入で渡す |
| 変更 | `src/domain/codebase/generateClassSource.ts` | domain | Singleton のクラスの先頭に `public static <名前> Instance { get; } = new();` を出す |
| 変更 | `src/domain/codebase/csharpProject.ts` | domain | 入口のメソッドが Singleton のクラスにあるときは `<名前>.Instance.<メソッド>(…)` で呼ぶ |
| 変更 | `src/presentation/stage/describeScore.ts` | presentation | `RULE_LABEL.singleton = 'Singleton の直接参照(隠れた依存)'` |
| 変更 | `src/presentation/stage/ruleWhy.ts` | presentation | `RULE_WHY.singleton`(下記) |
| 変更 | `src/presentation/stage/ScoreBreakdown.tsx` | presentation | 41行目の依存の一覧を出すルールに `'singleton'` を足す |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 新ステージ `singletonConfigStage`(id `advanced-singleton-config`)を定義し、`advancedStages` の**末尾**(`nullObjectStage` の次)に足す |
| 新規 | `src/infrastructure/stages/runtime/advanced-singleton-config.ts` | infrastructure | C#書き出し用の `advancedSingletonConfigRuntime`(全ステージに runtime が必須: `stageCode.test.ts`「全ステージが C# で書き出せる」) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps['advanced-singleton-config']`(10手) |
| 変更 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | 8手以上なので方針の表を足す |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 新しい章を末尾に足し、上級13の章から「最後の章」を外す |
| 新規 | `src/infrastructure/stages/singletonConfigStage.test.ts` | infrastructure(テスト) | 新ステージ固有のテスト(`nullObjectStage.test.ts` と同じ形) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 「初期違反の種類」に1行、近道(`shortcuts`)に5件 |
| 新規 | `e2e/singleton-config.spec.ts` | E2E | 新ルールの表示と、ドラッグでコンストラクタ注入に変わることを守る |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する(`stageReport.test.ts` のファイルスナップショット) |

- `src/application/` は変更しない(ユースケースは `Codebase` を受け渡すだけで、タグはそのまま通る)。
- `src/infrastructure/stages/stageCatalog.ts` は変更しない(`advancedStages` を連結しているだけで、配列の末尾に足せば上級の最後に並ぶ)。
- キャンバス(`src/presentation/canvas/`)は変更しない。Singleton のクラスに目印は付けない(コードタブの `static … Instance` と、減点の内訳の矢印一覧で分かる)。
- 新しい依存は足さない。

## データ・型の変更

### `CodeClass`(`src/domain/codebase/Codebase.ts`)

```ts
/**
 * ステージ作者が用意した、`<名前>.Instance` でどこからでも取り出せるクラス(Singleton)であることを示す隠しタグ。
 * C#の書き出し・コードプレビューでは、このクラスへの依存をコンストラクタで受け取らず `<名前>.Instance` で直接参照する形に出し、
 * 採点では、このクラスへの依存1本ごとに「Singleton の直接参照」で減点する。プレイヤーの操作では付け外しできない。省略時は普通のクラス。
 */
readonly singleton?: true;
```

- 操作で作る新しいクラス(`addClass`・`moveToNewHome`)には付かない。`renameClass` では残る(名前を変えても隠れた依存は消えない)。

### 採点(`src/domain/scoring/singletonReferences.ts`)

```ts
/** Singleton のクラス(`CodeClass.singleton`)への依存。classDependencies の順。 */
export function findSingletonReferences(codebase: Codebase): ClassDependency[];
```

- `classDependencies(codebase)` のうち、`to` のクラスが `singleton === true` のもの。メソッドの呼び出し(`uses`)でもフィールドの読み書き(`reads`/`writes`)でも数える(どちらも `classDependencies` に含まれる)。
- `score.ts`: `singleton: findSingletonReferences(codebase).length`。`ScoreRule` の並びの最後に `'singleton'`。

### 表示の文言

- `RULE_LABEL.singleton`: `'Singleton の直接参照(隠れた依存)'`
- `RULE_WHY.singleton`:
  - trouble: `'どこからでも Instance で取り出せる設定は、コンストラクタを見ても使っていることが分かりません。テストで値を変えるには、みんなで使う設定そのものを書き換えるしかなく、1つの設定を変えると、使う全クラスが巻き込まれます。'`
  - because: `'使う側がコンストラクタで受け取るようにすると、何に依存しているかが見え、テストでは決まった値の設定を渡すだけで済みます。'`
- クリア条件の行は既存の汎用の形(`describeCondition.ts`)で `Singleton の直接参照(隠れた依存): 0件にする` / `今: 4件` と出る。`describeCondition.ts` は変更しない。

### C#の生成(`csharpWiring.ts`・`generateClassSource.ts`・`csharpProject.ts`)

| 場面 | 今 | 変更後 |
| --- | --- | --- |
| 普通のクラス A が Singleton S を使う | A に `private readonly S _s;` とコンストラクタ引数 | 出さない。呼び出し・フィールドの受け手を `S.Instance` にする(`AppConfig.Instance.taxRate()`) |
| A が Singleton S と普通のクラス B を使う | S・B をコンストラクタで受け取る | B だけをコンストラクタで受け取る |
| Singleton S 自身が普通のクラス B を使う | S のコンストラクタで受け取る | 循環の辺と同じく `public B B { private get; set; }` で受け、`Program.cs` で `S.Instance.B = b;`(`LateAssignment` の `variable` を `S.Instance` にする)。`Instance = new()` が引数なしで作れるようにするため |
| `Program.cs` の組み立て | 具象クラスを全部 `new` する | Singleton のクラスは `new` しない(`steps` に入れない) |
| Singleton のクラスの宣言 | 普通のクラス | フィールドの前に `    public static S Instance { get; } = new();` を1行出す |
| 入口のメソッドが Singleton にある | 「入口のメソッドが見つかりません」 | `S.Instance.<メソッド>(…);` で呼ぶ |

- `lateEdges` は、Singleton への辺を除き(注入しないので順番に関係しない)、Singleton からの辺はすべて後からの代入にする。
- `collaboratorsOf` は変えない(Singleton も「使う相手」として返す)。
- 行数の計算・採点には `Instance` の行は数えない(生成時に足す行で、`lineCount.ts` は Fragment だけを数える)。
- `// ponytail: Singleton がインターフェースを実装する・Singleton が2つ以上ある題材は作っていない。作るときに bindings と Instance の型を決める` を `csharpWiring.ts` に残す。

## ステージの定義

### 基本項目

| 項目 | 値 |
| --- | --- |
| id | `advanced-singleton-config` |
| level | `'advanced'` |
| title | `上級14: あちこちから読む Singleton の設定を、コンストラクタで受け取る形にする`(番号は冒頭の注意を参照) |
| problem | `AppConfig.Instance の設定を、注文・請求書・送料・ポイントのクラスが直接読んでいる` |
| outcome | `Singleton の直接参照を、コンストラクタで受け取る形に直せる` |
| learns | `['Singleton の弊害', 'コンストラクタ注入', 'Composition Root']` |
| principles | `['isp', 'srp']`(使う側は要る設定だけを受け取る/設定を変わる理由ごとに分ける) |
| limits | `{ method: 12, class: 25, file: 27 }` |
| dependencyLimit | `1` |
| responsibilityLimit | `1` |
| visibilityEnforced・layers・conditionNotes | 省略 |
| runtime | `advancedSingletonConfigRuntime` |

- description: `ネットショップの注文まわり。税率・送料無料になる金額・ポイント還元率は AppConfig にまとめてあり、AppConfig.Instance でどこからでも取り出せる(Singleton)。合計を出す OrderPricing.price・請求書を書く InvoicePrinter.print・送料を足す ShippingFeeCalculator.applyShippingFee・ポイントを付ける PointService.awardPoints は、どれもメソッドの途中で AppConfig.Instance の設定を直接読んでいる。コンストラクタを見てもどのクラスがどの設定を使うのか分からず、テストで税率だけを変えたくても、みんなで使う AppConfig を書き換えるしかない。`
- goal: `設定を、使う側ごとの小さな設定クラスへ分けよう。AppConfig の taxRate・freeShippingThreshold・pointRate を、それぞれ空いた場所へドラッグして新しいクラス(自動で TaxSettings・ShippingSettings・PointSettings と名前が付く)へ移す。Singleton ではない普通のクラスになるので、使う側はコンストラクタで受け取る形になる(クラスのコードタブで確かめられる)。最後に、空になった AppConfig のファイルを消す。メソッドは12行・クラスは25行・ファイルは27行以内、1クラスの責務は1種類まで、依存先は1クラスまで`
- why: `税率を変えるテストのたびに、みんなで使う AppConfig を書き換えていて、どのクラスがどの設定を使うのかもコードを全部読まないと分かりませんでした。使う側がコンストラクタで設定を受け取る形にしたので、依存はコンストラクタを見れば分かり、テストでは決まった値の設定を渡すだけで済みます。組み立ては Program.cs の1か所にまとまりました。`
- responsibilityNames: `'order-pricing': '注文の合計'`、`invoice: '請求書の出力'`、`'shipping-fee': '送料の計算'`、`'point-award': 'ポイント付与'`、`'tax-setting': '税率の設定'`、`'shipping-setting': '送料無料の設定'`、`'point-setting': '還元率の設定'`
- classNames(初期のクラス名と重ねない): `'order-pricing': 'OrderTotalCalculator'`、`invoice: 'InvoiceWriter'`、`'shipping-fee': 'ShippingFeeRule'`、`'point-award': 'PointGranter'`、`'tax-setting': 'TaxSettings'`、`'shipping-setting': 'ShippingSettings'`、`'point-setting': 'PointSettings'`
- methodNames: `'order-pricing': 'calculateTotal'`、`invoice: 'writeInvoice'`、`'shipping-fee': 'addShippingFee'`、`'point-award': 'grantPoints'`、`'tax-setting': 'taxRate'`、`'shipping-setting': 'freeShippingThreshold'`、`'point-setting': 'pointRate'`

### 初期コードベース

ID は他ステージと重ならないよう `sg-` を含める。`lines` はコードの行数と一致させ、1行に文は1つ(`stageCode.test.ts`)。フィールドは持たない(設定はメソッドが設定ファイルから読む。C#でフィールドの初期値を出す仕組みが無いため)。

| ファイル(id) | クラス(id) | メソッド(id・可視性・引数・戻り値) | Fragment(id / label / lines / responsibility / その他) |
| --- | --- | --- | --- |
| `src/config/AppConfig.ts`(`file-sg-app-config`) | AppConfig(`class-sg-app-config`)**`singleton: true`** | `taxRate`(`method-sg-config-tax-rate`・public・引数なし・returns `rate: decimal`) | `frag-sg-config-tax` / 設定ファイルから税率を読み、0〜1の範囲か確かめる / 2 / `tax-setting` / suggestedName `taxRate` |
| | | `freeShippingThreshold`(`method-sg-config-free-shipping`・public・引数なし・returns `threshold: decimal`) | `frag-sg-config-shipping` / 設定ファイルから送料無料になる金額を読み、マイナスでないか確かめる / 2 / `shipping-setting` / suggestedName `freeShippingThreshold` |
| | | `pointRate`(`method-sg-config-point-rate`・public・引数なし・returns `rate: decimal`) | `frag-sg-config-point` / 設定ファイルからポイント還元率を読み、0〜1の範囲か確かめる / 2 / `point-setting` / suggestedName `pointRate` |
| `src/order/OrderPricing.ts`(`file-sg-order-pricing`) | OrderPricing(`class-sg-order-pricing`) | `price`(`method-sg-order-price`・public・`Order order`) | `frag-sg-pricing-subtotal` / 商品の単価と数量から小計を計算する / 2 / `order-pricing` / suggestedName `calculateSubtotal`<br>`frag-sg-pricing-tax` / 設定の税率で消費税を足し、合計を決める / 2 / `order-pricing` / uses `method-sg-config-tax-rate`・suggestedName `addTax` |
| `src/order/InvoicePrinter.ts`(`file-sg-invoice-printer`) | InvoicePrinter(`class-sg-invoice-printer`) | `print`(`method-sg-invoice-print`・public・`Order order`) | `frag-sg-invoice-header` / 請求書の見出しと明細を出力する / 2 / `invoice` / suggestedName `writeInvoiceHeader`<br>`frag-sg-invoice-tax` / 設定の税率を、請求書に「うち消費税」として書く / 2 / `invoice` / uses `method-sg-config-tax-rate`・suggestedName `writeTaxLine` |
| `src/shipping/ShippingFeeCalculator.ts`(`file-sg-shipping-fee`) | ShippingFeeCalculator(`class-sg-shipping-fee`) | `applyShippingFee`(`method-sg-apply-shipping-fee`・public・`Order order`) | `frag-sg-shipping-fee` / 設定の金額以上なら送料無料、それ未満なら送料を足す / 2 / `shipping-fee` / uses `method-sg-config-free-shipping`・suggestedName `addShippingFee`<br>`frag-sg-shipping-log` / 送料を記録する / 1 / `shipping-fee` / suggestedName `logShippingFee` |
| `src/point/PointService.ts`(`file-sg-point-service`) | PointService(`class-sg-point-service`) | `awardPoints`(`method-sg-award-points`・public・`Order order`) | `frag-sg-point-calc` / 設定の還元率でポイントを計算する / 2 / `point-award` / uses `method-sg-config-point-rate`・suggestedName `calculatePoints`<br>`frag-sg-point-grant` / 会員にポイントを付けて記録する / 2 / `point-award` / suggestedName `grantPoints` |

各 Fragment の C# コード(`code.csharp`)と `variables`:

```csharp
// frag-sg-config-tax   variables: { declares: rate(decimal) }
var rate = ConfigFile.ReadDecimal("Tax:Rate", 0.10m);
if (rate is < 0m or > 1m) throw new InvalidOperationException("税率の設定が正しくありません");
// frag-sg-config-shipping   variables: { declares: threshold(decimal) }
var threshold = ConfigFile.ReadDecimal("Shipping:FreeThreshold", 5000m);
if (threshold < 0m) throw new InvalidOperationException("送料無料の金額の設定が正しくありません");
// frag-sg-config-point   variables: { declares: rate(decimal) }
var rate = ConfigFile.ReadDecimal("Point:Rate", 0.01m);
if (rate is < 0m or > 1m) throw new InvalidOperationException("ポイント還元率の設定が正しくありません");
// frag-sg-pricing-subtotal   variables: { declares: subtotal(decimal), uses: ['order'] }
if (order.Items.Count == 0) throw new ValidationException("注文に商品がありません");
var subtotal = order.Items.Sum(item => item.UnitPrice * item.Quantity);
// frag-sg-pricing-tax   variables: { uses: ['subtotal', 'order'] }
order.Tax = decimal.Round(subtotal * taxRate(), 0);
order.Total = subtotal + order.Tax;
// frag-sg-invoice-header   variables: { uses: ['order'] }
Console.WriteLine($"[請求書] 注文 {order.Id}");
Console.WriteLine($"[請求書] 明細 {order.Items.Count} 点 合計 {order.Total} 円");
// frag-sg-invoice-tax   variables: { declares: taxPercent(decimal), uses: ['order'] }
var taxPercent = taxRate() * 100m;
Console.WriteLine($"[請求書] うち消費税 {order.Tax} 円({taxPercent}%)");
// frag-sg-shipping-fee   variables: { uses: ['order'] }
order.ShippingFee = order.Total >= freeShippingThreshold() ? 0m : 550m;
order.Total += order.ShippingFee;
// frag-sg-shipping-log   variables: { uses: ['order'] }
Log.Info($"注文 {order.Id} の送料: {order.ShippingFee} 円");
// frag-sg-point-calc   variables: { declares: points(int), uses: ['order'] }
var points = (int)decimal.Floor(order.Total * pointRate());
if (points < 0) throw new InvalidOperationException("ポイントがマイナスです");
// frag-sg-point-grant   variables: { uses: ['points', 'order'] }
order.PointsEarned = points;
Log.Info($"注文 {order.Id} に {points} ポイントを付けました");
```

- 設定のメソッドを呼ぶ箇所はメソッド名だけで書く(`taxRate()`)。受け手は生成時に付く: 初期は `AppConfig.Instance.taxRate()`、移したあとは `_taxSettings.taxRate()`。
- ラベルに `AppConfig` を書かない(移したあとも意味が通るように「設定の税率で」とする)。

初期のコードタブ(`OrderPricing`)は次の形になる(コンストラクタが無いことが「隠れた依存」):

```csharp
public class OrderPricing
{
    public void price(Order order)
    {
        // 商品の単価と数量から小計を計算する
        ...
        // 設定の税率で消費税を足し、合計を決める
        order.Tax = decimal.Round(subtotal * AppConfig.Instance.taxRate(), 0);
        order.Total = subtotal + order.Tax;
    }
}
```

### 変更依頼(changeRequests。この順。どちらも modify・ボスなし)

| # | id | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-tax-rate-schedule` | 税率を、適用開始日つきで設定できるようにして | 10月から税率が変わる。設定ファイルに新しい税率と適用開始日を書いておき、その日から自動で切り替えたい。 | `tax-setting` | 4 | `switchTaxRateByDate` | なし(最初に全文を見せる modify) |
| 2 | `req-point-campaign` | キャンペーン中はポイント還元率を2倍にして | 設定ファイルにキャンペーン期間を書いておき、その間だけポイント還元率を2倍にしたい。 | `point-setting` | 3 | `doublePointRateInCampaign` | `{ from: '営業の佐藤さん', text: 'ポイントのキャンペーンをやりたいという話が、いつか出てくるかもしれないらしいです。' }` |

- extend の依頼は出さない(設定クラスを足しても、それを呼ぶ側を作る操作が無く、解答例が「どこからも呼ばれないクラス」になる。上級10の設計判断4と同じ)。

### 理解度チェック(checks。正解の位置を2問で変える。正解の選択肢を最長にしない)

- `check-1`(answer: 1)「OrderPricing が AppConfig.Instance の税率を直接読んでいると、テストで何が困る?」
  - 0: `AppConfig は static な Instance でしか取り出せないので、テストのコードからは呼ぶこと自体がどうやってもできなくなってしまう` / 解説: `呼ぶことはできます。困るのは、税率を変えたいときに、みんなで使っている設定そのものを書き換えるしかないことです。`
  - 1: `税率を変えたテストをするには共有の設定を書き換えるしかなく、ほかのテストにも響く` / 解説: `コンストラクタで受け取る形なら、テストでは決まった税率の設定を渡すだけで済みます。`
  - 2: `テストが少し遅くなるだけで、結果はいつも同じになるので、困ることは特にない` / 解説: `書き換えた設定が残ると、次に動くテストの結果まで変わります。順番しだいで落ちるテストになりがちです。`
- `check-2`(answer: 2)「TaxSettings を OrderPricing と InvoicePrinter のコンストラクタで受け取る形にすると、何が良くなる?」
  - 0: `TaxSettings を1つのクラスにしたので、税率を変える依頼が来ても、もうどのクラスもまったく直さなくてよくなる` / 解説: `税率の決め方が変われば TaxSettings は直します。変わるのは、巻き込まれるクラスが減ることです。`
  - 1: `Singleton と同じく、どこからでも TaxSettings を取り出せるので、渡す手間が省ける` / 解説: `どこからでも取り出せる形をやめて、要るクラスにだけ Program.cs から渡しています。`
  - 2: `税率を使うクラスがコンストラクタで分かり、送料やポイントのクラスは税率の変更に巻き込まれない` / 解説: `コンストラクタを見れば依存が分かり、税率を使わないクラスは TaxSettings を知りません。`

### 模範解答(`sampleAnswerSteps['advanced-singleton-config']`、10手)

```ts
'advanced-singleton-config': [
  { addFile: 'src/config/TaxSettings.ts' },
  { addClass: { name: 'TaxSettings', file: 'src/config/TaxSettings.ts' } },
  { move: { method: 'taxRate', toClass: 'TaxSettings' } },
  { addFile: 'src/config/ShippingSettings.ts' },
  { addClass: { name: 'ShippingSettings', file: 'src/config/ShippingSettings.ts' } },
  { move: { method: 'freeShippingThreshold', toClass: 'ShippingSettings' } },
  { addFile: 'src/config/PointSettings.ts' },
  { addClass: { name: 'PointSettings', file: 'src/config/PointSettings.ts' } },
  { move: { method: 'pointRate', toClass: 'PointSettings' } },
  { deleteFile: 'src/config/AppConfig.ts' },
],
```

- `addFile`+`addClass`+`move` は、プレイヤーがメソッドを空いた場所へドラッグして新しいクラスを作る操作(自動で `TaxSettings` などと命名)を表す。
- `deleteFile` は、メソッドを移し終えて空になった `AppConfig` を消す(`delete-class-code-guard` で、空のクラスだけのファイルは消せる)。

方針の表(`solutionPhaseTable['advanced-singleton-config']`):

- `{ from: 0, title: '税率の読み込みを AppConfig から TaxSettings へ移す', why: '税率を使う OrderPricing と InvoicePrinter が、AppConfig.Instance を読むのをやめ、TaxSettings をコンストラクタで受け取る形になるため' }`
- `{ from: 3, title: '送料無料の金額とポイント還元率も、それぞれの設定クラスへ移す', why: '使う側ごとに、要る設定だけを受け取るようにするため' }`
- `{ from: 9, title: '空になった AppConfig のファイルを消す', why: 'どこからでも取り出せる入口を残さないため' }`

### runtime(`src/infrastructure/stages/runtime/advanced-singleton-config.ts`)

- `entryMethodId: 'method-sg-order-price'`、`entryArguments: ['SampleData.Order']`。bindings・bindingDemos・expectedBuildFailures は持たない(移すメソッドは最初から public で、どの手のあともビルドできる)。
- support: `logFile` と、`supportFile('Shop.cs', ...)` に次を置く。
  - `OrderItem`(`UnitPrice`・`Quantity`)、`Order`(`Id`・`Items`・`Tax`・`Total`・`ShippingFee`・`PointsEarned`)
  - `ValidationException`
  - `ConfigFile.ReadDecimal(string key, decimal defaultValue)`: `[設定] <key> を読みました` を1行出して既定値を返す偽物
  - `SampleData.Order`(Id 1001、1200円×2・800円×1)
- `Program.cs` は、初期は `AppConfig` を `new` せず4クラスを引数なしで `new` する。完成形は `var taxSettings = new TaxSettings();` のあと `new OrderPricing(taxSettings)`・`new InvoicePrinter(taxSettings)` のように**同じ TaxSettings を2クラスへ渡す**(Composition Root)。どの手でも出力は同じ。

### 机上の検算(`stageCatalog.test.ts` の保証に通ること)

行数は Fragment =「コード行数+1」、メソッド = +3 と Fragment 間の空行、クラス = +3 とメソッド間の空行。

| 対象 | 初期 | 模範解答後 | 上限 |
| --- | --- | --- | --- |
| AppConfig の各メソッド / クラス・ファイル | 6 / 23・23 | (消える) | 12 / 25・27 |
| `price`・`print`・`awardPoints` / 各クラス | 10 / 13 | 10 / 13 | 12 / 25 |
| `applyShippingFee` / クラス | 9 / 12 | 9 / 12 | 12 / 25 |
| TaxSettings など各設定クラス | — | 6 / 9 | 12 / 25 |
| 責務の種類 | AppConfig が3種(1件違反)、ほかは1種 | どれも1種 | 1 |
| 依存 | 4クラス → AppConfig(各1本) | OrderPricing・InvoicePrinter → TaxSettings、ShippingFeeCalculator → ShippingSettings、PointService → PointSettings | 1 |
| Singleton の直接参照 | 4本 | 0本 | — |

- 初期: responsibility 1件 + singleton 4件 = **50点**。減点の種類は `['responsibility', 'singleton']`。
- 模範解答後: **100点**。確認した規則: 循環なし/空の入れ物なし(最後に消す)/極小メソッド・薄いクラスなし(設定のメソッドは処理3行)/フィールドなし/横流しなし/混在した抽出メソッドなし/越境呼び出しなし(全部 public)。
- 変更依頼1(`tax-setting`): 初期は AppConfig の1クラス、波及4クラス(-20)・同じクラスのほかの責務2種(-10)・追加後に AppConfig のクラス28行・ファイル28行が上限超え(-20)で **50点**。模範解答後は TaxSettings の1クラス、波及2クラス(-10)で **90点**。`isClearlyRelieved` はクラスの行数 23→9(0.75倍以下)で満たす。
- 変更依頼2(`point-setting`): 初期 **60点**(波及 -20・巻き込み -10・クラスの上限超え -10)、模範解答後 **95点**。
- 変更が必要なクラスの数はどちらも 1→1(増えない)。解答例の置き方(`sampleImplementation`)は TaxSettings / PointSettings に置いて100点になる想定。`knownChangeRequestExceptions` に足すものは無い。
- 振る舞いのテスト: 入口は使われていない4メソッド(`price`・`print`・`applyShippingFee`・`awardPoints`)。Move Method は `uses` を変えないので、どの手の後も緑。

### ストーリー(`storyChapters.ts`)

- 上級13の章: title を `クーポンのない注文` に、outro を `3月31日の夜。テストを書いていたQAの高橋さんから、設定のことで相談が届きました。` にする。
- 新しい章を末尾に足す: `{ stageId: 'advanced-singleton-config', title: '最後の章、どこからでも読める設定', speaker: TAKAHASHI, intro: 'QAの高橋です。注文の金額のテストを書こうとしたら、税率を変えるには AppConfig.Instance の中身を書き換えるしかなくて、ほかのテストの結果まで変わってしまいました。どのクラスがどの設定を使っているのかも、コードを全部読まないと分かりません。使う設定を、外から渡せる形にしてください。', outro: '3月31日の深夜。10月から税率が変わる知らせが届きました。このコードが整っていたからこそ、慌てずに済みそうです。' }`

## 動きの仕様

- ステージ一覧の上級の末尾(上級13の次)に「上級14: あちこちから読む Singleton の設定を、コンストラクタで受け取る形にする」が出る。
- 開くと50点。減点の内訳に「Singleton の直接参照(隠れた依存) ×4」と「責務の混在 ×1」が出る。Singleton の内訳を開くと `OrderPricing → AppConfig` など4本の矢印が並ぶ。クリア条件に「Singleton の直接参照(隠れた依存): 0件にする / 今: 4件」の行が出る。
- OrderPricing のコードタブには、コンストラクタが無く `AppConfig.Instance.taxRate()` と書かれている。AppConfig のコードタブの先頭には `public static AppConfig Instance { get; } = new();` がある。
- `taxRate` を空いた場所へドラッグすると `TaxSettings` という新しいクラスができ、Singleton の直接参照は2件(送料・ポイントの分)に減る。OrderPricing と InvoicePrinter のコードタブには `private readonly TaxSettings _taxSettings;` とコンストラクタ `public OrderPricing(TaxSettings taxSettings)` が出て、呼び出しは `_taxSettings.taxRate()` になる。
- 3つとも移すと AppConfig が空のクラスになり「空のクラス・ファイル」で減点され、ファイルを消すと100点になる。
- 100点のあと、変更依頼は「税率を、適用開始日つきで…」→「キャンペーン中はポイント還元率を2倍に」(うわさ付き)の順に出る。

## TDD対象

AAA(`// Arrange` `// Act` `// Assert`)で、テストを先に書いてから実装する。

### `findSingletonReferences`(domain・`singletonReferences.test.ts` 新規)

- `singleton: true` のクラスのメソッドを呼ぶクラスがあると、その依存が1件返る(`from` = 呼ぶ側、`to` = Singleton)
- 同じ Singleton を2クラスが呼ぶと2件、`classDependencies` の順
- Singleton のフィールドを読む(`reads`)だけでも数える
- 1クラスが Singleton の2つのメソッドを呼んでも1件(依存は1本)
- タグの無いクラスへの依存は数えない/Singleton の無い codebase は `[]`

### `scoreCodebase`(domain・`score.test.ts` 変更)

- Singleton を2クラスが呼ぶ codebase で `{ rule: 'singleton', count: 2, points: 20 }`
- `deductions` を全部並べている既存テストの最後に `{ rule: 'singleton', count: 0, points: 0 }` を足す

### `violationTargets` / `violationDependencies` / `fileDeductionReasons`(domain・既存テストに追加)

- `violationTargets(...).singleton.classIds` は依存元のクラス(ルールを全部並べている既存テストに `'singleton'` を足す)
- `violationDependencies(...).singleton` は `{ from, to }` の組。タグが無ければ `[]`(結果の形を丸ごと比べている既存テストに `singleton: []` を足す)
- `fileDeductionReasons` は依存元のクラスのファイルに `singleton` を10点数える

### `wiringOf` / `compositionOrder`(domain・`csharpWiring.test.ts` に追加)

- Singleton だけを使うクラスの `declarations` は空で、`receivers` は `class-config → 'AppConfig.Instance'`
- Singleton と普通のクラス B を使うクラスは、B だけをコンストラクタで受け取る
- Singleton 自身が B を使うと、`public B B { private get; set; }` で受け、`compositionOrder` の `lateAssignments` に `{ variable: 'AppConfig.Instance', property: 'B', value: 'b' }` が入る
- `compositionOrder` の `steps` に Singleton のクラスが無く、使う側の `args` にも出ない
- タグの無い codebase の結果は変わらない(既存テストがそのまま通る)

### `generateClassSourceLines`(domain・`generateClassSource.test.ts` に追加)

- Singleton のクラスの先頭のメンバーが `    public static AppConfig Instance { get; } = new();`
- Singleton を呼ぶクラスの呼び出しが `AppConfig.Instance.taxRate()` になり、コンストラクタが出ない
- タグの無いクラスに `Instance` の行は出ない

### `generateCSharpProject`(domain・`csharpProject.test.ts` に追加)

- `Program.cs` に `new AppConfig(` が出ない
- 入口のメソッドが Singleton のクラスにあると `AppConfig.Instance.<メソッド>(…);` で呼ぶ

### `isCodebase`(domain・`isCodebase.test.ts` に追加)

- `singleton: true` のクラスを受け付ける。`singleton: false`・`'yes'` は拒む

### `singletonConfigStage.test.ts`(infrastructure・新規)

- 模範解答は10手である
- 初期は50点で、減点の種類は responsibility(1件)と singleton(4件)だけ
- 初期の Singleton の直接参照は、OrderPricing・InvoicePrinter・ShippingFeeCalculator・PointService から AppConfig への4本
- 模範解答を適用すると100点で、AppConfig が無く、OrderPricing と InvoicePrinter の依存先は TaxSettings だけ
- 模範解答後、TaxSettings・ShippingSettings・PointSettings はどれも `singleton` を持たず、メソッドを1つずつ持つ
- 初期の C# の OrderPricing に `AppConfig.Instance.taxRate()` があってコンストラクタが無く、完成形には `public OrderPricing(TaxSettings taxSettings)` がある。完成形の `Program.cs` で、同じ変数 `taxSettings` が OrderPricing と InvoicePrinter の両方に渡る
- 異常系: AppConfig の名前を変えるだけ(`renameClass`)では Singleton の直接参照が4件のまま
- modify `req-tax-rate-schedule`: 初期の波及は4クラス、模範解答後は2クラス
- 2件目だけがうわさを持つ
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(infrastructure・変更)

- 「初期違反の種類」に `['advanced-singleton-config', ['responsibility', 'singleton']]` を足す
- 近道(`shortcuts`。いずれも100点未満):
  - `AppConfig に税率だけ残す`: 模範解答の 3〜8手(送料・ポイントだけ移す)。Singleton の直接参照が2件残る(80点)
  - `3つの設定を1つの新しいクラス Settings へまとめる`: `src/config/Settings.ts` に Settings を作り、3つとも移して AppConfig を消す。責務の混在(90点)
  - `設定を使う側のクラスへ移す`: `taxRate → OrderPricing`・`freeShippingThreshold → ShippingFeeCalculator`・`pointRate → PointService` と移して AppConfig を消す。3クラスの責務の混在(70点)
  - `AppConfig の名前を変えるだけ`: `renameClass AppConfig → Settings`。Singleton の直接参照が4件のまま(50点)
  - `移し終えた AppConfig を消さない`: 模範解答の 0〜8手。空のクラス・ファイル(90点)
- 「役割タグを付けた全クラス」は9件のまま(このステージは `roleResponsibilities` を使わない)。その他の全ステージ共通の検査は、コードの変更なしに新ステージにも効く

## E2E(`e2e/singleton-config.spec.ts` 新規)

新しい操作は無いが、新しい採点ルールの表示と、ドラッグでコードの形(Instance → コンストラクタ注入)が変わることを守る。1テストにまとめる。

1. 上級14を開くと、減点の内訳に「Singleton の直接参照」の項目がある
2. OrderPricing のコードタブ(開き方は `e2e/class-code-preview.spec.ts` と同じ)に `AppConfig.Instance.taxRate()` の行がある
3. `taxRate` のメソッドを空いた場所へドラッグすると、`TaxSettings` のクラスができ、OrderPricing のコードタブに `public OrderPricing(TaxSettings taxSettings)` の行が出る

既存の E2E は変えない(上級ステージは `e2e/reference-menu.spec.ts` の `runtimeStages` の表に入っていないので、行を足さない)。

## 受け入れ基準

1. ステージ一覧の上級の末尾に「上級14: あちこちから読む Singleton の設定を、コンストラクタで受け取る形にする」があり、学べることに「Singleton の弊害」「コンストラクタ注入」「Composition Root」が出る
2. 上級14を開くと50点で、減点の内訳に「Singleton の直接参照(隠れた依存) -40」「責務の混在 -10」が出る
3. 初期の OrderPricing のコードタブにはコンストラクタが無く `AppConfig.Instance.taxRate()` と書かれ、`taxRate` を新しいクラスへ移すと `TaxSettings` をコンストラクタで受け取る形に変わる
4. 模範解答どおりに操作すると100点になる。解答例の再生でも最後に100点になる
5. 既存の全ステージ・白紙設計の点数は変わらない(`stageCatalog.test.ts` の「初期違反の種類」が既存の行のまま通り、`docs/stages/report.md` の既存の行が変わらない)
6. `npm run csharp-export` で上級14の C# プロジェクトが書き出せ、`bash scripts/verify-csharp.sh` で全手順がビルド・実行でき、手順どうしの出力が同じ
7. `docs/stages/report.md` が再生成され、上級14の行がある(初期点50・手数10)
8. ストーリーをオンにすると、上級13のあとに「最後の章、どこからでも読める設定」が出て、上級13の章はもう「最後の章」と名乗らない
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 新しい操作(Singleton をやめるトグル・呼び出し先の付け替え)。「既存の仕組みで足りるか」の表のとおり、移動とファイル削除で足りる
- キャンバスで Singleton のクラスや隠れた依存の矢印に目印を付けること。コードタブと減点の内訳で見える。プレイテストで分かりにくければ足す
- 設定の値そのもの(`decimal taxRate` など)をコンストラクタで受け取る形。このゲームには値を渡す仕組みが無いので、設定クラスを渡す形(.NET の Options パターンに近い)にする
- 書き換えられるグローバル状態(`AppConfig.Instance.MaintenanceMode = true` のような書き込み)。既存のカプセル化の採点で扱えるが、題材が2つに割れるので今回は読むだけにする
- テスト用の差し替え口(`AppConfig.ResetForTest()` など)を題材に入れること。中身のあるメソッドは消せない(`delete-class-code-guard`)ため、残すと別の減点の設計が要る
- Singleton がインターフェースを実装する・Singleton が2つ以上ある題材の C# 生成(ponytail コメントだけ残す)
- 用語集(`glossaryTerms.ts`)・コードの臭い図鑑(`antipatterns.ts`)・パターン比較表・比較クイズへの追加
- ボスの変更依頼、extend の依頼、既存ステージのデータ変更(ストーリーの上級13の章の文言だけは直す)
- `docs/feature-ideas/IDEAS.md` の更新(仕様化した案の片付けは呼び出し元が行う)
