# composite-pattern-stage: 上級10「単品とセットの型分岐を Composite パターンへ組み替える」を足す
> **実装順の注意**: 同じ区分の新ステージ仕様(上級: adapter/chain/composite/null-object、中級: mediator/law-of-demeter/temporal-coupling/flag-argument)と、題名の番号(上級10・中級13)と登録ファイル(`*Stages.ts`・`sampleAnswer.ts`・`solutionPhaseTable.ts`・`storyChapters.ts`・`stageCatalog.test.ts`・`docs/stages/report.md`)が衝突する。**同時に実装しない**。先にマージされたものがあれば、番号は次の空き番号に付け直し、`storyChapters.ts` の「最後の章」も最新のものに合わせる。

既存の実装・仕様との重複: なし(`docs/feature-ideas/IDEAS.md` の「4. Compositeパターンのステージ」が未仕様化のまま残っているだけ)。
最も近いのは上級9 `advanced-order-state`(`docs/specs/state-pattern-stage.md`)と中級10 `intermediate-member-rank-branching` で、本仕様はその作りをそのまま踏襲する。

## 背景・目的

上級では Strategy・State・Template Method などを練習できるが、「**単体**と**集合**(集合の中にさらに集合が入る)を型で見分けて
場合分けしているコードを、共通インターフェースでそろえる」Composite パターンのステージが無い。

- 中級10・上級9は「種類ごとの分岐を種類ごとのクラスへ」だが、種類どうしは入れ子にならない。Composite の特徴である
  **集合のクラスが、自分と同じインターフェースの中身を呼ぶ(再帰)**形はどのステージにも出てこない。
- 題材はネットショップの「単品」と「セット商品(ギフトセット。中にさらに小さなセットが入る)」にする。
  フォルダ/ファイルはゲームの「ファイルの箱」と言葉がぶつかって紛らわしいので使わない。
- 変更依頼「ギフトカードをセットに入れられるようにして」で、型分岐のままだと価格と明細の両方の分岐を直すこと(instanceof の苦しさ)と、
  組み替えたあとは新しいクラスを足すだけで済むこと(多態の利点)を比べさせる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 新ステージ `compositeItemStage`(id `advanced-composite-item`)を定義し、`advancedStages` 配列の**末尾**(`orderStateStage` の次)に足す。runtime の import を足す |
| 新規 | `src/infrastructure/stages/runtime/advanced-composite-item.ts` | infrastructure | C# 実行用の `StageRuntime`(下記) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps['advanced-composite-item']`(14手)を足す |
| 変更 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | 8手以上なので方針の表 `'advanced-composite-item'` を足す |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 新しい章を末尾に足し、上級9の章から「最後の章」の文言を外す |
| 新規 | `src/infrastructure/stages/compositeItemStage.test.ts` | infrastructure(テスト) | 新ステージ固有のテスト(`orderStateStage.test.ts` と同じ形) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 初期違反の種類の表に1行、近道(`shortcuts`)に2件 |
| 変更 | `src/infrastructure/stages/stageCode.test.ts` | infrastructure(テスト) | 「第6弾の上級…が runtime を持つ」の ID 一覧に `advanced-composite-item` を足す |
| 変更 | `src/infrastructure/stages/templateMethodStage.test.ts` | infrastructure(テスト) | 上級8の位置の検査 `.at(-2)` を `.at(-3)` にする(末尾にステージが1つ増えるため) |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する(`stageReport.test.ts` のスナップショット) |

**他の新規ステージ仕様と衝突しやすい登録ファイル**(並行で別ステージを足す場合はマージ時に要調整):
`advancedStages.ts`(配列の末尾)・`sampleAnswer.ts`・`solutionPhaseTable.ts`・`storyChapters.ts`(末尾の章と「最後の章」の文言)・
`stageCatalog.test.ts`(初期違反の表・shortcuts)・`stageCode.test.ts`(runtime の ID 一覧)・`templateMethodStage.test.ts`(`.at(-N)`)・`docs/stages/report.md`。
ステージ番号(「上級10」)も、先に入った方に合わせて付け直す。

- domain の採点・操作(`scoring/`・`codebase/`・`change/`)、application、presentation は変更しない。既存の操作
  (Add File・Add Class・Extract Method・Move Method・実装するインターフェースの設定)だけで100点になる。
- 新しい依存は足さない。

## データ・型の変更

型(`Stage`・`Codebase`・`ChangeRequest`・`StageRuntime`)の変更はなし。ステージデータを1件足す。

### ステージの基本項目

| 項目 | 値 |
| --- | --- |
| id | `advanced-composite-item` |
| level | `'advanced'` |
| title | `上級10: 単品とセットの型分岐を Composite パターンへ組み替える` |
| problem | `単品かセットかを型で見分ける分岐が、価格と明細の両方に散らばっている` |
| outcome | `単品とセットを、共通のインターフェースでそろえた入れ子の構造にできる` |
| learns | `['Composite', '再帰構造']` |
| principles | `['ocp']` |
| limits | `{ method: 12, class: 28, file: 29 }` |
| dependencyLimit | `2` |
| conditionNotes | `{ coupling: 'このゲームでは呼び出し先を書き換えられないため、CartService が単品とセットの2クラスを呼ぶ形を答えとして認めるため' }` |
| responsibilityLimit | `1` |
| visibilityEnforced | 省略(移動したメソッドは自動で public になる) |

- description: `ネットショップのカート。CartService の priceItem(価格を求める)と listItem(明細の行を書き出す)が、商品が単品かセットかを型で見分けて(C# の as。Java の instanceof にあたる)分岐している。セットの中には単品も、さらに小さなセットも入る。前任者が、セットの中身は CatalogItem(インターフェース)として扱い、中身の価格と明細は CatalogItem の getPrice・writeLines で求めるよう先に書き換えたが、単品とセットのクラスはまだ無い。`
- goal: `単品とセットの分岐を、それぞれの新しいクラス(SingleItem/BundleItem)に集めよう。Extract Methodで分岐を getPrice / writeLines として取り出し、Move Methodで単品・セットのクラスへ移す。最後に2クラスとも CatalogItem を実装(implements)しよう。BundleItem は中身を CatalogItem として呼ぶので、中身が単品でもセットでも同じように扱える(Composite)。メソッドは12行・クラスは28行・ファイルは29行以内、1クラスの責務は1種類まで、依存先は2クラスまで`
- why: `新しい種類の商品が増えるたびに、価格と明細の両方の型分岐を探して書き足していました。単品もセットも同じインターフェースにそろえると、セットは中身の種類を気にせずに済み、新しい種類はクラスを足すだけで入れられます。`
- responsibilityNames: `{ 'single-item': '単品の処理', 'bundle-item': 'セットの処理', 'gift-card': 'ギフトカードの処理' }`
- classNames(自動命名。初期のクラス名と重ねない): `{ 'single-item': 'SingleItem', 'bundle-item': 'BundleItem' }`
- methodNames: `{ 'single-item': 'handleSingleItem', 'bundle-item': 'handleBundleItem' }`
  (`stageCatalog.test.ts` の自動命名・責務名の検査が要求する分。`gift-card` は依頼の責務なので classNames/methodNames には不要。上級9の `state-returned` と同じ扱い)

### 初期コードベース

`lines` はコードの行数と一致させる(`stageCode.test.ts`)。1行に文は1つ。パターン変数(`is X x`)は C# で外側のスコープに漏れて
Fragment 間で衝突するので使わず、`as` と Fragment ごとに別名の変数で書く。

| ファイル(id) | クラス(id) | メソッド(id・可視性・引数) | Fragment(id / label / lines / responsibility / その他) |
| --- | --- | --- | --- |
| `src/catalog/CartService.ts`(`file-cart-service`) | CartService(`class-cart-service`) | `priceItem`(`method-cart-price-item`・public・`ItemData item, PriceQuote quote`) | `frag-price-single` / 単品なら、単価×数量を価格に足す / 3 / `single-item` / suggestedName `getPrice`<br>`frag-price-bundle` / セットなら、中身それぞれの価格を CatalogItem(インターフェース)の getPrice で求め、セット割引を引いて足す / 4 / `bundle-item` / uses `method-catalog-item-get-price` / suggestedName `getPrice` |
| 〃 | 〃 | `listItem`(`method-cart-list-item`・public・`ItemData item, List<string> lines`) | `frag-list-single` / 単品なら、商品名と数量を1行書き出す / 3 / `single-item` / suggestedName `writeLines`<br>`frag-list-bundle` / セットなら、セット名を書き出し、中身それぞれの行を CatalogItem の writeLines で求めて字下げして書き出す / 4 / `bundle-item` / uses `method-catalog-item-write-lines` / suggestedName `writeLines` |
| `src/catalog/CatalogItem.ts`(`file-catalog-item`) | CatalogItem(`class-catalog-item`) | `getPrice`(`method-catalog-item-get-price`・`ItemData item, PriceQuote quote`)・`writeLines`(`method-catalog-item-write-lines`・`ItemData item, List<string> lines`)、すべて public・`fragments: []` | なし(インターフェース役) |

各 Fragment の C# コード(`code.csharp`)と `variables`:

```csharp
// frag-price-single  declares: pricedSingle(SingleData) / uses: item, quote
var pricedSingle = item as SingleData;
if (pricedSingle is not null) quote.Amount += pricedSingle.UnitPrice * pricedSingle.Quantity;
if (pricedSingle is not null) Log.Debug($"単品 {pricedSingle.Name} の価格を足しました");
// frag-price-bundle  declares: pricedBundle(BundleData), bundleQuote(PriceQuote) / uses: item, quote
var pricedBundle = item as BundleData;
var bundleQuote = new PriceQuote();
pricedBundle?.Children.ForEach(child => getPrice(child, bundleQuote));
if (pricedBundle is not null) quote.Amount += decimal.Round(bundleQuote.Amount * (1 - pricedBundle.DiscountRate), 0);
// frag-list-single  declares: listedSingle(SingleData) / uses: item, lines
var listedSingle = item as SingleData;
if (listedSingle is not null) lines.Add($"{listedSingle.Name} ×{listedSingle.Quantity}");
if (listedSingle is not null) Log.Debug($"単品 {listedSingle.Name} の行を書き出しました");
// frag-list-bundle  declares: listedBundle(BundleData), childLines(List<string>) / uses: item, lines
var listedBundle = item as BundleData;
var childLines = new List<string> { $"{listedBundle?.Name}(セット)" };
listedBundle?.Children.ForEach(child => writeLines(child, childLines));
if (listedBundle is not null) lines.AddRange(childLines.Select((line, index) => index == 0 ? line : "  " + line));
```

### runtime(`runtime/advanced-composite-item.ts`)

- `entryMethodId: 'method-cart-price-item'`、`entryArguments: ['SampleData.Pen', 'new PriceQuote()']`(単品を入口にする)
- `bindings`・`bindingDemos` は持たない(どの手順でも、インターフェース型の依存先の実装が2つ以上になる瞬間が無いため。下の検算参照)
- `support`: `logFile` と、`ItemData`(abstract、`Name`)・`SingleData : ItemData`(`UnitPrice`・`Quantity`)・`BundleData : ItemData`(`Children: List<ItemData>`・`DiscountRate`)・
  `PriceQuote`(`Amount`)・`SampleData`(`Pen` 単品と、入れ子のセット `GiftSet`)を持つ `CatalogData.cs`
- ファイル先頭のコメントに次の ponytail を残す:
  `// ponytail: 子要素ごとに実装を選ぶ(インスタンスの多態)はコード生成の注入(1型1実装)で表せないので、入口は単品にしてセットの再帰は実行しない。インスタンス単位の注入を表せるようになったら GiftSet を入口にする`
  (初期状態では CatalogItem に実装が無く `null` が注入されるため、セットを入口にすると例外になる。単品を入口にすれば全スナップショットで出力が一致する)

### 変更依頼(changeRequests。この順に並べる)

| # | id | kind | title | description | responsibility | linesPerSite | partName |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-add-gift-card` | `extend` | ギフトカードをセットに入れられるようにして | 金額を選べるギフトカードを、セットの中身として入れられるようにしたい。価格は選んだ金額で、明細には「ギフトカード 3000円」のように書き出す。 | `gift-card` | 6 | `priceGiftCard` |
| 2 | `req-empty-bundle` | (modify) | 中身が空のセットを分かるようにして | 中身が空のセットは、価格を0円にして、明細にも「(中身なし)」と書き出したい。 | `bundle-item` | 2 | `markEmptyBundle` |

- うわさ(rumor)は付けない(`rumoredRequests` は1件目の extend・modify を除くので、2件なら対象が無い)。ボスも付けない。
- 1件目は「型分岐のままだと既存クラスを書き換える/Composite ならセットが CatalogItem 越しに呼ぶので新しいクラスを足すだけ」を見せる。

### 理解度チェック(checks。正解は最長の選択肢にしない・正解の位置を2問で変える)

- `check-1`(answer: 2)「単品とセットを CatalogItem(共通のインターフェース)にそろえると、何が良くなる?」
  - 0: `型ごとの分岐は減るが、セットの中にセットを入れることはできなくなる` / 解説: `入れ子はそのまま扱えます。セットは中身を CatalogItem として呼ぶだけなので、中身がセットでも同じです。`
  - 1: `単品とセットのどちらも CatalogItem を実装しなくても、そのままセットの中身として入れられるようになる` / 解説: `中身として扱えるのは、CatalogItem を実装したクラスだけです。実装の宣言が約束になります。`
  - 2: `セットは中身が単品かセットかを気にせず、同じ getPrice を呼ぶだけで済む` / 解説: `単体と集合が同じ顔をしているので、再帰的な構造を分岐なしでたどれます。`
- `check-2`(answer: 0)「型を見て分岐する書き方(as / instanceof)のまま、新しい種類の商品を足すと、何が起きる?」
  - 0: `価格と明細の両方の分岐を探して、同じ種類の分岐を書き足すことになる` / 解説: `型分岐は操作の数だけ散らばるので、種類を足すたびに全部を探して直します。`
  - 1: `新しい種類も既存のどれかの分岐に自動で当てはまるので、どのメソッドも書き換えずにそのまま動き続ける` / 解説: `どの分岐にも当てはまらず、価格にも明細にも出てきません。`
  - 2: `型を見る分岐はコンパイルが通らないので、そもそも書けない` / 解説: `書けますし動きます。問題は、種類が増えるたびに直す場所が増えることです。`

### 模範解答(`sampleAnswerSteps['advanced-composite-item']`、14手)

同じ名前(`getPrice` など)で抽出するので、上級9と同じく「抽出→移動」を1組ずつ行う。

```ts
'advanced-composite-item': (['Single', 'Bundle'] as const).flatMap((kind): SolutionStep[] => {
  const suffix = kind.toLowerCase();
  const file = `src/catalog/${kind}Item.ts`;
  const toClass = `${kind}Item`;
  return [
    { addFile: file },
    { addClass: { name: toClass, file } },
    { extract: { from: 'priceItem', fragmentIds: [`frag-price-${suffix}`], name: 'getPrice' } },
    { move: { method: 'getPrice', fromClass: 'CartService', toClass } },
    { extract: { from: 'listItem', fragmentIds: [`frag-list-${suffix}`], name: 'writeLines' } },
    { move: { method: 'writeLines', fromClass: 'CartService', toClass } },
    { addInterface: { class: toClass, interface: 'CatalogItem' } },
  ];
}),
```

方針の表(`solutionPhaseTable['advanced-composite-item']`):

- `{ from: 0, title: '単品の分岐を、SingleItem にまとめる', why: '単品の価格と明細を1つのクラスに寄せ、CatalogItem として扱える「葉」にするため' }`
- `{ from: 7, title: 'セットの分岐を、BundleItem にまとめる', why: 'セットも CatalogItem にそろえれば、中身が単品でもセットでも同じ呼び方でたどれるため' }`

### 机上の検算

行数は「コード行数+1」、メソッドは +3 と Fragment 間の空行、クラスは +3 とメソッド間の空行。抽出で残る呼び出し行は2行。

| 対象 | 初期 | 模範解答後 | 上限 |
| --- | --- | --- | --- |
| `CartService.priceItem` / `listItem` | 13 / 13(2件違反) | 呼び出し2行だけ: 8 / 8 | メソッド12 |
| `CartService` クラス・`CartService.ts` | 30 / 30(各1件違反) | 20 / 20 | クラス28 / ファイル29 |
| `SingleItem` / `BundleItem` | — | 18(メソッド 7・7) / 20(メソッド 8・8) | クラス28 |
| `CatalogItem` | 10 | 10 | クラス28 |
| 責務の種類 | CartService 2種(1件違反) | CartService 0種・各クラス1種 | 1 |
| 依存 | CartService → CatalogItem | CartService → SingleItem・BundleItem、BundleItem → CatalogItem | 2 |

- 初期: line-limit 4件+responsibility 1件 = **50点**。減点の種類は `['line-limit', 'responsibility']`。
- 模範解答後: **100点**。循環なし(BundleItem → CatalogItem は一方向。implements は依存に数えない)/空の入れ物なし/未使用 private なし/
  約束違反なし(2クラスとも `getPrice`・`writeLines` を持ち CatalogItem を実装。CartService の public 名 `priceItem`・`listItem` は契約名と重ならない)/
  極小メソッドなし(最小でもコード3行+1)/横流しなし(CartService の各メソッドは呼び出し行が2つ)/混在抽出なし/責務の散らばりなし。
- 変更依頼:
  - modify `req-empty-bundle`: 初期は CartService の2メソッド(巻き込み2で -10、メソッド16行×2・クラス36行・ファイル36行の上限超え4で -40)= 50点 →
    模範解答後は BundleItem の2メソッド(追加後 11行・クラス26行・ファイル26行で上限内)、波及1(CartService が呼ぶ。-5)= 95点。
    「はっきり楽になる」: 読む行数 26 → 16(0.75倍以下)。
  - extend `req-add-gift-card`: 初期は CatalogItem を誰も実装していないので入口にならず、既存クラス(CartService)を書き換える。
    模範解答後は書き換え0・置き先 `{ kind: 'new-class', implementing: 'CatalogItem' }`。CatalogItem は BundleItem から呼ばれているので `'abstract'` で100点。
  - よって `knownChangeRequestExceptions` に足すものはない。
- 振る舞いのテスト: 入口は `priceItem`・`listItem`。抽出・移動・実装の設定は実行される処理の集合を変えないので、どの手の後も緑。
- C# の注入: 初期は CartService → CatalogItem(実装0で `null`)。単品側の手順の間は実装1つ、BundleItem が実装を宣言した時点で
  CatalogItem を使う処理は BundleItem(自分の先祖なので注入されない)にしか残らない。どの手順でも `ambiguous-binding` にならない。
- 自動命名: 抽出は単独の Fragment なので `suggestedName` が候補になり、空いた場所へドラッグして作るクラスは `SingleItem`/`BundleItem` と自動で付く(プレイヤーに命名させない)。

### ストーリー(`storyChapters.ts`)

- 上級9の章: title を `注文の状態` に、outro を `3月31日の朝。返品の受付について、相談が届きました。` にする。
- 新しい章を末尾に足す: `{ stageId: 'advanced-composite-item', title: '最後の章、セット商品', speaker: SUZUKI, intro: 'PMの鈴木です。春のギフトセットを売り出します。セットの中に小さなセットが入るので、価格と明細の分岐がどんどん複雑になっているんです。単品でもセットでも、同じように扱える形にしてください。', outro: '3月31日の夕方。最後の依頼が届きました。このコードが整っていたからこそ、慌てずに済みそうです。' }`

## 動きの仕様

- ステージ一覧の上級の末尾(上級9の次)に「上級10: 単品とセットの型分岐を Composite パターンへ組み替える」が出る。
- 初期画面: CartService → CatalogItem の依存矢印が1本。CartService の2メソッドが行数超過で赤い。
- 操作は既存のものだけ: 分岐を1つ選んで抽出(候補名 `getPrice`/`writeLines`)→ 空いた場所へドラッグして新しいクラス(自動で `SingleItem`/`BundleItem`)→
  クラスの右クリックから CatalogItem を実装。
- 100点の形では、BundleItem から CatalogItem へ「実装」と「依存」の2本の矢印が出る(集合が自分と同じ型の中身を呼ぶ = Composite の形)。

### 設計判断(確定)

1. **題材は単品/セット商品にする**(フォルダ/ファイルはゲームのファイルの箱と紛らわしい)。
2. **セットの中身を呼ぶ処理は最初から CatalogItem 経由にする(上級9・中級10と同じ「移行の途中」)。** 呼び出し先を付け替える操作が無いので、
   CartService 自身を再帰で呼ぶ形にすると、BundleItem へ移したあと BundleItem ⇄ CartService の循環になり100点にならない。
3. **責務は型単位(単品/セット)で上限1。** 操作ごとに分ける誤答(近道2)が責務の混在で減点される。
4. **CartService の操作名(priceItem/listItem)と契約名(getPrice/writeLines)を分ける**(同名だと実装の宣言漏れが残る)。
5. **依頼は2件(extend・modify)にする。** うわさの対象が無くなるので3件目は足さない(YAGNI)。
6. **パターン比較表(`presentation/stage/patternComparison.ts`)には今回足さない。** E2E(`e2e/roadmap.spec.ts`)の列見出しの検査を変える必要があり、ステージ追加とは独立に足せるため。
7. **E2E は足さない。** 新しい操作・UIが無く、使う操作は既存の E2E が守っている(上級3・上級9と同じ判断)。

## TDD対象

新しい純粋関数は無い。ステージデータが仕様どおりに採点されることを、先にテストを書いて確かめる(Red → Green、AAA)。

### `compositeItemStage.test.ts`(infrastructure・新規)

- 上級の末尾にあり、模範解答は14手
- 初期は50点で、減点の種類は line-limit と responsibility だけ。`method-cart-price-item`・`method-cart-list-item` がメソッドの行数上限を超える
- 模範解答を適用すると100点
- 模範解答後、SingleItem・BundleItem が CatalogItem を `interfaceIds` に持ち、それぞれ `getPrice`・`writeLines` を持ち、責務は1種類だけ
- 模範解答後、CartService に残る処理は呼び出し行(`call`)だけ
- 模範解答後、BundleItem → CatalogItem の依存があり、循環は無い
- 異常系: 模範解答から `addInterface` の2手を抜くと100点未満(約束違反)
- extend `req-add-gift-card`: 初期は書き換えるクラスが1以上、模範解答後は0で、置き先が `{ kind: 'new-class', implementing: 'CatalogItem' }`
- modify `req-empty-bundle`: 読む行数が 26 → 16、変更コストが 50 → 95
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(変更)

- 初期違反の種類の表に `['advanced-composite-item', ['line-limit', 'responsibility']]`
- 近道(どちらも100点未満):
  - `単品・セットのクラスへ移すが CatalogItem を実装しない`: 模範解答から `addInterface` を除いたもの
  - `型でなく操作ごとのクラス(PriceCalculator/LineWriter)へ分ける`: 2つのファイルとクラスを作り、priceItem の2分岐を `priceSingle`・`priceBundle` として抽出して PriceCalculator へ移す(listItem も `writeSingle`・`writeBundle` で LineWriter へ)。各クラスが責務2種類で混在の減点
- その他の全ステージ共通の検査(自動命名・責務名・ID重複・解答例の依頼100点・runtime の変数のつながりなど)は、コードの変更なしに新ステージにも効く

## 受け入れ基準

1. ステージ一覧の上級の末尾(上級9の次)に「上級10: 単品とセットの型分岐を Composite パターンへ組み替える」があり、学べることに「Composite」「再帰構造」が出る
2. 開くと初期点が50点で、CartService の priceItem・listItem が行数超過、CartService が責務の混在で減点されている
3. priceItem の「単品なら…」を抽出すると候補名が `getPrice` になり、空いた場所へドラッグすると `SingleItem` という名前のクラスが自動でできる
4. 模範解答どおりに操作すると100点になる。解答例の再生でも最後に100点になる
5. 100点のあと、「ギフトカードをセットに入れられるようにして」で CatalogItem を実装する新しいクラスに部品を置くと置き方が100点、「中身が空のセットを分かるようにして」は BundleItem に置くと100点
6. ストーリーをオンにすると、上級9のあとに「最後の章、セット商品」が出て、上級9の章はもう「最後の章」と名乗らない
7. `docs/stages/report.md` が再生成され、上級10の行がある。`npm run csharp-export` で書き出した全スナップショットがビルドでき、出力が一致する
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- パターン比較表への Composite の追加(E2E の列見出しの変更を伴うため、別の小さな変更で行う)
- セットの再帰を C# 実行で見せること(インスタンス単位の注入が必要。runtime の ponytail コメント参照)
- 呼び出し先の付け替え操作(CartService の2本の呼び出しを CatalogItem 1本にまとめる)。上級3・上級9と同じ既知の制約
- 新しい採点ルール・新しい操作・型の変更、うわさ・ボスの変更依頼
- 既存ステージのデータの変更(ストーリーの上級9の章の文言だけは直す)
- `docs/feature-ideas/IDEAS.md` の更新(仕様の確定後に呼び出し元が行う)
