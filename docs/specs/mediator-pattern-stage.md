# mediator-pattern-stage: 中級13「呼び合う画面部品を仲介役(Mediator)でつなぐ」を足す
> **実装順の注意**: 同じ区分の新ステージ仕様(上級: adapter/chain/composite/null-object、中級: mediator/law-of-demeter/temporal-coupling/flag-argument)と、題名の番号(上級10・中級13)と登録ファイル(`*Stages.ts`・`sampleAnswer.ts`・`solutionPhaseTable.ts`・`storyChapters.ts`・`stageCatalog.test.ts`・`docs/stages/report.md`)が衝突する。**同時に実装しない**。先にマージされたものがあれば、番号は次の空き番号に付け直し、`storyChapters.ts` の「最後の章」も最新のものに合わせる。

既存の実装・仕様との重複: なし(`Mediator`・`仲介` を含むのは `docs/feature-ideas/IDEAS.md` 2026-10-03「3. Mediatorパターンのステージ」だけ。
循環依存は中級1 `intermediate-cyclic-dependency` が「メソッドを本来の持ち主へ戻す」解き方で扱っているが、仲介役を足す解き方はどのステージにもない)。

## 背景・目的

- 循環依存を解くステージは中級1(Move Method で持ち主へ戻す)だけで、「どのクラスも本来の持ち主として正しい場所にいるのに、
  互いに呼び合っていて網目になる」形を解く練習がない。
- 画面部品(カート一覧・クーポン欄・配送方法欄)が、自分が変わったときに他の部品へ直接知らせる作りはよくあり、部品が3つでも
  6本の呼び合い(すべて循環)になる。連携の約束を1つの仲介役に集めれば、矢印は仲介役から3本の一方向になる。
- 学ばせたいこと: 多対多の依存を多対一に減らす発想(Mediator)と、循環依存を「持ち主へ戻す」以外の方法で解くこと。
  あわせて「知らせる処理だけを仲介役へ出し、部品から仲介役を呼び返すと循環が残る」ことを誤答で体験させる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 新ステージ `orderFormMediatorStage`(id `intermediate-order-form-mediator`)を定義し、`intermediateStages` 配列の**末尾**(`middleManStage` の次)に足す。**他の新規ステージ仕様と衝突しやすい** |
| 新規 | `src/infrastructure/stages/runtime/intermediate-order-form-mediator.ts` | infrastructure | C# 書き出し用の `StageRuntime`(全ステージ必須。`stageCode.test.ts` の「runtime を持たないステージが無い」) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps['intermediate-order-form-mediator']`(8手)を足す。**衝突しやすい** |
| 変更 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | 8手以上なので方針の表を足す。**衝突しやすい** |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 中級12の章の次に新しい章を足す(「全ステージに章がある」「並びが stages と同じ」テスト)。**衝突しやすい** |
| 新規 | `src/infrastructure/stages/orderFormMediatorStage.test.ts` | infrastructure(テスト) | 新ステージ固有のテスト(`orderStateStage.test.ts` と同じ形) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 初期違反の種類の表に1行、近道(`shortcuts`)に2件。**衝突しやすい** |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成(`stageReport.test.ts`)。**衝突しやすい** |

- 衝突の注意: 中級の末尾にステージを足す別の仕様が先にマージされたら、title の番号(中級13)と章の位置をその後ろへずらす。
- domain の採点・操作(`scoring/`・`codebase/`・`change/`)、application、presentation は変更しない。既存の操作(Extract Method・
  Move Method・空いた場所へのドラッグで作る新しいクラス)だけで100点になる。新しい依存は足さない。

## データ・型の変更

型(`Stage`・`Codebase`・`ChangeRequest`)の変更はなし。ステージデータを1件足す。

### ステージの基本項目

| 項目 | 値 |
| --- | --- |
| id | `intermediate-order-form-mediator` |
| level | `'intermediate'` |
| title | `中級13: 呼び合う画面部品を仲介役(Mediator)でつなぐ` |
| problem | `注文画面の部品どうしが、互いのメソッドを直接呼び合っている` |
| outcome | `呼び合う部品どうしを、仲介役1つを通す形に組み替えられる` |
| learns | `['Mediator', '循環依存', '多対一の依存']` |
| principles | `['adp', 'srp']` |
| limits | `{ method: 12, class: 40, file: 42 }` |
| dependencyLimit | `3`(仲介役は3部品すべてを呼ぶ) |
| responsibilityLimit | `1`(部品を仲介役代わりにする誤答を責務の混在で落とすため) |
| conditionNotes | `{ coupling: '仲介役はすべての部品を呼ぶので、部品の数(3)まで依存を認めるため', responsibility: '部品に連携を混ぜず、仲介役にも部品の仕事を混ぜないため' }` |
| visibilityEnforced | 省略(移動後の越境呼び出しは自動で public になる) |
| runtime | `intermediateOrderFormMediatorRuntime` |

- description: `ネットショップの注文確認画面。カート一覧(CartList)・クーポン欄(CouponInput)・配送方法欄(ShippingSelector)の3つの部品が、それぞれ自分の操作(数量の変更・クーポンの適用・配送方法の選択)を受けたあと、ほかの2つの部品のメソッドを直接呼んで表示を合わせている。部品どうしが6本の矢印で呼び合っていて、どれも循環している。どの部品も自分の仕事は正しい場所に持っているので、メソッドを持ち主へ戻すだけでは呼び合いは消えない。`
- goal: `赤い矢印(循環依存)をなくそう。各部品の操作メソッドから「自分の仕事」を Extract Method で切り出して部品に残し、残った「ほかの部品に知らせる」入口のメソッドを、空いた場所へドラッグして作る仲介役のクラスへ Move Method で集める。知らせる処理だけを仲介役へ出して部品から呼ぶと、部品と仲介役の間で循環が残るので注意。メソッドは12行・クラスは40行・ファイルは42行以内、1クラスの責務は1種類まで、依存先は3クラスまで`
- why: `部品どうしの連携ルールを変えるたびに、3つの部品クラスを開いて呼び合いを追っていました。連携を仲介役1つに集めると、連携の変更は仲介役だけ、部品の変更はその部品だけで済みます。`
- responsibilityNames: `cart: 'カートの明細'`、`coupon: 'クーポン'`、`shipping: '配送方法'`、`coordination: '部品の連携'`
- classNames(自動命名。初期のクラス名と重ねない): `cart: 'CartItemsPanel'`、`coupon: 'CouponPanel'`、`shipping: 'ShippingPanel'`、`coordination: 'OrderFormMediator'`
- methodNames: `cart: 'updateCartLines'`、`coupon: 'applyCouponDiscount'`、`shipping: 'applyShippingFee'`、`coordination: 'notifyOtherParts'`

### 初期コードベース

`lines` はコードの行数と一致させる。1行に文は1つ。すべて `visibility: 'public'`。ID は他ステージと重ならないよう `form-` を付ける。

| ファイル(id) | クラス(id) | メソッド(id・引数) | Fragment(id / label / lines / responsibility / その他) |
| --- | --- | --- | --- |
| `src/orderForm/CartList.ts`(`file-form-cart-list`) | CartList(`class-form-cart-list`) | `changeQuantity`(`method-form-change-quantity`・`OrderDraft draft, int productId, int quantity`) | `frag-form-cart-change` / 数量を検証して、下書きの明細を更新する / 3 / `cart` / suggestedName `updateCartLines` / variables.uses `quantity, productId, draft`<br>`frag-form-cart-notify` / クーポン欄と配送方法欄に、カートが変わったことを知らせる / 2 / `coordination` / uses `method-form-refresh-coupon`・`method-form-refresh-shipping-options` / variables.uses `draft` |
| 〃 | 〃 | `refreshCartItems`(`method-form-refresh-cart-items`・`OrderDraft draft`) | `frag-form-cart-refresh` / 割引とお届け予定を明細の表示に反映する / 3 / `cart` / declares `discountedLines: int`・`deliveryDate: DateTime` / uses `draft` |
| `src/orderForm/CouponInput.ts`(`file-form-coupon-input`) | CouponInput(`class-form-coupon-input`) | `applyCoupon`(`method-form-apply-coupon`・`OrderDraft draft, string couponCode`) | `frag-form-coupon-apply` / クーポンコードを検証して、下書きに割引を入れる / 3 / `coupon` / suggestedName `applyCouponDiscount` / uses `couponCode, draft`<br>`frag-form-coupon-notify` / カート一覧と配送方法欄に、割引が変わったことを知らせる / 2 / `coordination` / uses `method-form-refresh-cart-items`・`method-form-refresh-shipping-options` / uses `draft` |
| 〃 | 〃 | `refreshCoupon`(`method-form-refresh-coupon`・`OrderDraft draft`) | `frag-form-coupon-refresh` / 条件を満たさなくなったクーポンを外す / 3 / `coupon` / declares `stillValid: bool` / uses `draft` |
| `src/orderForm/ShippingSelector.ts`(`file-form-shipping-selector`) | ShippingSelector(`class-form-shipping-selector`) | `selectShipping`(`method-form-select-shipping`・`OrderDraft draft, string shippingMethod`) | `frag-form-shipping-select` / 配送方法を検証して、下書きに送料を入れる / 3 / `shipping` / suggestedName `applyShippingFee` / uses `shippingMethod, draft`<br>`frag-form-shipping-notify` / カート一覧とクーポン欄に、配送方法が変わったことを知らせる / 2 / `coordination` / uses `method-form-refresh-cart-items`・`method-form-refresh-coupon` / uses `draft` |
| 〃 | 〃 | `refreshShippingOptions`(`method-form-refresh-shipping-options`・`OrderDraft draft`) | `frag-form-shipping-refresh` / 選べる配送方法を絞り込み、送料を計算し直す / 3 / `shipping` / declares `options: List<string>` / uses `draft` |

各 Fragment の C# コード(`code.csharp`。行数 = 上の lines。呼び出しは既存ステージと同じく受け手なしで書く):

```csharp
// frag-form-cart-change
if (quantity < 0) throw new ArgumentOutOfRangeException(nameof(quantity));
draft.SetQuantity(productId, quantity);
Log.Info($"商品 {productId} の数量を {quantity} にしました");
// frag-form-cart-notify
refreshCoupon(draft);
refreshShippingOptions(draft);
// frag-form-cart-refresh
var discountedLines = draft.Lines.Count(line => line.Discounted);
var deliveryDate = FakeShippingRates.DeliveryDateFor(draft.ShippingMethod);
Log.Info($"明細を表示し直しました(割引 {discountedLines} 件・お届け {deliveryDate:MM/dd})");
// frag-form-coupon-apply
if (string.IsNullOrWhiteSpace(couponCode)) throw new ValidationException("クーポンコードを入力してください");
draft.Discount = FakeCoupons.DiscountFor(couponCode, draft.Subtotal);
Log.Info($"クーポン {couponCode} で {draft.Discount} 円引きにしました");
// frag-form-coupon-notify
refreshCartItems(draft);
refreshShippingOptions(draft);
// frag-form-coupon-refresh
var stillValid = FakeCoupons.IsValid(draft.CouponCode, draft.Subtotal);
if (!stillValid) draft.Discount = 0m;
Log.Info(stillValid ? "クーポンはそのまま使えます" : "条件を満たさないのでクーポンを外しました");
// frag-form-shipping-select
if (!FakeShippingRates.Supports(shippingMethod)) throw new ValidationException("選べない配送方法です");
draft.ShippingFee = FakeShippingRates.FeeFor(shippingMethod, draft.TotalWeight);
Log.Info($"配送方法を {shippingMethod} にしました(送料 {draft.ShippingFee} 円)");
// frag-form-shipping-notify
refreshCartItems(draft);
refreshCoupon(draft);
// frag-form-shipping-refresh
var options = FakeShippingRates.OptionsFor(draft.TotalWeight);
draft.ShippingFee = FakeShippingRates.FeeFor(draft.ShippingMethod, draft.TotalWeight);
Log.Info($"選べる配送方法は {options.Count} 種類です");
```

### runtime(`intermediate-order-form-mediator.ts`)

- `entryMethodId: 'method-form-change-quantity'`、`entryArguments: ['SampleData.Draft', '7', '3']`
- `support`: `logFile` と、`supportFile` で次を書く(.NET 標準だけで動かす。既存 runtime と同じ書き方)
  - `OrderLine`(`ProductId`・`Quantity`・`UnitPrice`・`Weight`・`Discounted`)
  - `OrderDraft`(`Lines: List<OrderLine>`・`CouponCode`・`ShippingMethod`・`Discount`・`ShippingFee`・計算プロパティ `Subtotal`・`TotalWeight`・`SetQuantity(int productId, int quantity)`)
  - `ValidationException`
  - `FakeCoupons`(`DiscountFor(string, decimal) → decimal`・`IsValid(string, decimal) → bool`)
  - `FakeShippingRates`(`Supports(string) → bool`・`FeeFor(string, decimal) → decimal`・`DeliveryDateFor(string) → DateTime`・`OptionsFor(decimal) → List<string>`)
  - `SampleData.Draft`(明細2件・クーポン `"WELCOME500"`・配送方法 `"standard"`)
- 初期の循環は既存の仕組み(プロパティでの後入れ)で組み立てられるので、`expectedBuildFailures` は書かない。

### 変更依頼(changeRequests。この順)

| # | id | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-order-button` | 注文ボタンの押せる・押せないも切り替えて | カート・クーポン・配送方法のどれが変わっても、未入力の欄が残っていれば注文ボタンを押せないようにしたい。 | `coordination` | 2 | `toggleOrderButton` | なし(最初に全文を見せる modify) |
| 2 | `req-first-order-coupon` | クーポンの使用条件を変えて | 初回購入向けのクーポンは、2回目以降の注文では使えないようにしたい。 | `coupon` | 4 | `restrictFirstOrderCoupon` | `{ from: '営業の佐藤さん', text: '「クーポンの使い方」を変えたいという話が、いつか出てくるかもしれないらしいです。' }` |

- どちらも modify(kind 省略)。extend とボスは付けない(部品を足す依頼は仲介役の書き換えが必ず要り、extend の置き方採点と合わないため。
  ボスはボスのあるステージを固定で列挙するテストを変えないため)。

### 理解度チェック(checks。正解は最長の選択肢にしない)

- `check-1`(answer: 2)「部品どうしが直接呼び合う形を、仲介役1つを通す形に変えると、何が良くなる?」
  - 0: `どの部品も仲介役とだけつながるので、部品をいくつ足しても仲介役を含めてどのクラスも書き換えずに済むようになる` / 解説: `部品を足すと、その部品とのやり取りを仲介役に書き足します。連携の変更が仲介役1か所に集まる、というのが効き目です。`
  - 1: `メソッドの呼び出しが減るので、画面の動きが速くなる` / 解説: `速さの話ではありません。変更のときに追う範囲の話です。`
  - 2: `連携のルールが仲介役1か所に集まり、部品どうしは互いを知らずに済む` / 解説: `6本の呼び合いが、仲介役から3本の一方向になります。連携ルールは仲介役だけを読めば分かります。`
- `check-2`(answer: 0)「知らせる処理だけを仲介役へ移し、部品から仲介役を呼ぶ形にすると、赤い矢印が残るのはなぜ?」
  - 0: `部品が仲介役を呼び、仲介役も部品を呼ぶので、その間で輪ができるから` / 解説: `このステージでは操作の入口ごと仲介役へ移し、部品には自分の仕事だけを残すと一方向になります。実務では、インターフェースを挟んで輪を切る形もあります。`
  - 1: `仲介役のクラスの行数が上限を超えるから` / 解説: `行数ではなく、呼び合う向きの問題です。`
  - 2: `移したメソッドが private のままなので、部品から仲介役を呼ぶたびにアクセス制御の違反として数えられるから` / 解説: `可視性は矢印の向きとは関係ありません。移したメソッドは自動で public になります。`

### 模範解答(`sampleAnswerSteps['intermediate-order-form-mediator']`、8手)

```ts
'intermediate-order-form-mediator': [
  { addFile: 'src/orderForm/OrderFormMediator.ts' },
  { addClass: { name: 'OrderFormMediator', file: 'src/orderForm/OrderFormMediator.ts' } },
  { extract: { from: 'changeQuantity', fragmentIds: ['frag-form-cart-change'], name: 'updateCartLines' } },
  { move: { method: 'changeQuantity', toClass: 'OrderFormMediator' } },
  { extract: { from: 'applyCoupon', fragmentIds: ['frag-form-coupon-apply'], name: 'applyCouponDiscount' } },
  { move: { method: 'applyCoupon', toClass: 'OrderFormMediator' } },
  { extract: { from: 'selectShipping', fragmentIds: ['frag-form-shipping-select'], name: 'applyShippingFee' } },
  { move: { method: 'selectShipping', toClass: 'OrderFormMediator' } },
],
```

方針の表(`solutionPhaseTable['intermediate-order-form-mediator']`):

- `{ from: 0, title: '部品の連携を引き受ける仲介役のクラスを用意する', why: '連携の約束を置く場所が1つ決まれば、部品どうしが互いを知らなくて済むため' }`
- `{ from: 2, title: 'カート一覧の操作から自分の仕事を残し、入口を仲介役へ移す', why: '部品には自分の仕事だけを残し、ほかの部品に知らせる役は仲介役に任せるため' }`
- `{ from: 4, title: 'クーポン欄と配送方法欄も同じ形で仲介役へ移す', why: '全部の入口が仲介役に集まると、矢印が仲介役からの一方向にそろうため' }`

### 机上の検算

行数は `lineCount.ts` のとおり(Fragment = コード行+1、メソッド = 3+Fragment合計+間の空行、クラス = 3+メソッド合計+間の空行)。抽出で残る呼び出し行は2行。

| 対象 | 初期 | 模範解答後 | 上限 |
| --- | --- | --- | --- |
| 操作メソッド(changeQuantity など) | 11 | 9(呼び出し2+連携3。仲介役へ移る) | 12 |
| 反応メソッド・抽出した自分の仕事 | 7 | 7 | 12 |
| 部品クラス / ファイル | 22 / 22 | 18 / 18 | 40 / 42 |
| OrderFormMediator / ファイル | — | 32 / 32 | 40 / 42 |
| 責務 | 各部品2種(3件違反) | 各部品1種・仲介役1種(call は数えない) | 1 |
| 依存 | 部品どうし6本、すべて循環 | 仲介役 → 3部品の3本、循環なし | 3 |

- 初期: cycle 6件+responsibility 3件 = **10点**。減点の種類は `['cycle', 'responsibility']`(行数は上限内)。
- 模範解答後: **100点**。空の入れ物なし/未使用 private なし(抽出メソッドは移動後に自動で public)/極小メソッドなし(最小でも実処理4行)/
  横流しなし(仲介役のメソッドは Fragment 2つ)/混在した抽出メソッドなし/フィールドなし/「さらに良くできるところ」なし(責務1種類なので crowded にならない)。
- 変更依頼のコスト(`scoreChange`):
  - `req-order-button`(coordination・+2行): 初期は3部品の操作メソッドが変更箇所で、散らばり2(-20)・巻き込み3(-15)・巻き込み(クラス)3(-15)・上限超え3(メソッド13行。-30)= **20点** → 模範解答後は仲介役の3メソッド(11行・クラス38行)で **100点**。
    はっきり楽になる: クラス数 3 → 1。
  - `req-first-order-coupon`(coupon・+4行): 初期は波及2(-10)・巻き込み1(-5)・上限超え1(applyCoupon 15行。-10)= **75点** → 模範解答後は CouponInput の2メソッド(11行・クラス26行)、波及1(仲介役。-5)= **95点**。
  - 変更が必要なクラス数は 3→1・1→1 で増えない。解答例の置き方(`sampleImplementation`)は 1件目が OrderFormMediator、2件目が CouponInput でどちらも100点。`knownChangeRequestExceptions` に足すものはない。
- うわさ: 1件目は最初の modify なので無し、2件目だけ持つ(話し手は既存の章の話し手。タイトル・partName・自動命名の名前を含まない)。
- 振る舞いのテスト: 入口は3つの操作メソッド。抽出・移動は実行される処理を変えないので、どの手の後も緑。

### ストーリー(`storyChapters.ts`)

中級12の章の次(上級1の章の前)に足す:
`{ stageId: 'intermediate-order-form-mediator', title: '呼び合う注文画面の部品', speaker: SATO, intro: '営業の佐藤です。注文画面で数量を変えてもクーポンが外れなかったり、配送方法を変えても明細が古いままだったり、という問い合わせが続いています。画面の部品どうしが呼び合っていて、どこを直せばいいか分からないそうです。', outro: 'その週の金曜日。PMの鈴木さんから、注文ボタンについて相談がありました。' }`
(結びは1件目の依頼 `req-order-button` へつなぐ。日付は前後の章と矛盾しないよう月を書かない)

## 動きの仕様

- ステージ一覧の中級の末尾(中級12の次)に「中級13: 呼び合う画面部品を仲介役(Mediator)でつなぐ」が出る。
- 初期画面: 3つの部品クラスの間に赤い矢印(循環)が6本。各部品が責務の混在で減点されている。
- 操作は既存のものだけ: 操作メソッドの「自分の仕事」を抽出(名前の候補は `updateCartLines` など)→ 操作メソッドを空いた場所へドラッグすると
  `OrderFormMediator` という名前のクラスが自動でできる(プレイヤーに命名させない)→ 残り2つの操作メソッドも同じクラスへドラッグ。
- 3つとも移すと、矢印は OrderFormMediator から3部品への3本だけになり100点。

### 設計判断(確定)

1. **操作の入口ごと仲介役へ移す形を正解にする(部品が仲介役へ知らせる GoF の形にはしない)。** このゲームには呼び出し先を
   書き換える操作がなく、部品から仲介役を呼ぶと部品 ⇄ 仲介役の循環が必ず残る。インターフェースを挟む形は上級の内容で、
   操作も足りない。画面のイベントを仲介役が受け、部品は受け身にする形も実務でよく使う Mediator の形なので、これを答えにする。
   部品から呼び返す形は近道として 100点未満になることをテストで守り、理解度チェック2で理由を説明する。
2. **部品は3つ・各部品は「操作1つ+反応1つ」にする。** 完全な網目(6本)と仲介役後(3本)の差が最小の手数(8手)で見える。部品を増やすと手数だけ増える。
3. **状態は引数の `OrderDraft draft` で渡す。** 部品どうしがデータを取りに呼び合う辺を作らず、矢印を「知らせる」呼び出しだけにする。
4. **responsibilityLimit を1にする。** 2だと、仲介役を作らずに既存の部品(例: CartList)へ入口を集める形が100点になる。
5. **中級の末尾に置く。** 使う操作が抽出と移動だけで、上級(継承・インターフェース)を要さない。中級1の循環依存と対で学べる。
6. **E2E は足さない。** 新しい操作・UI は無く、使う操作(抽出・移動・新しいクラス)は既存の E2E が守っている(上級9の仕様と同じ判断)。

## TDD対象

新しい純粋関数は無い。ステージデータが仕様どおりに採点されることを、先にテストを書いて確かめる(Red → Green)。AAA で書く。

### `orderFormMediatorStage.test.ts`(infrastructure・新規)

- 模範解答は8手である
- 初期は10点で、減点は cycle 6件・responsibility 3件だけ
- 模範解答を適用すると100点
- 模範解答後、`classDependencies` は OrderFormMediator → CartList・CouponInput・ShippingSelector の3本だけで、どれも `cyclic: false`
- 模範解答後、OrderFormMediator は `changeQuantity`・`applyCoupon`・`selectShipping` を持ち、責務は `coordination` の1種類だけ。各部品の責務は1種類だけ
- 異常系: 模範解答から最後の move を抜くと100点未満(ShippingSelector と CouponInput の間の循環が残る)
- `req-order-button`: 初期の変更箇所は3クラス、模範解答後は1クラス(OrderFormMediator)
- 2件目だけがうわさを持つ
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(infrastructure・変更)

- 「初期違反の種類」の表に `['intermediate-order-form-mediator', ['cycle', 'responsibility']]` を足す
- 近道(`shortcuts`、どちらも100点未満):
  - `知らせる処理だけを抽出して仲介役へ移し、部品から呼ぶ`: addFile・addClass(OrderFormMediator)のあと、3部品の連携 Fragment を
    `notifyCartChanged`・`notifyCouponChanged`・`notifyShippingChanged` として抽出し、OrderFormMediator へ移す(部品 ⇄ 仲介役の循環が残る)
  - `仲介役を作らず、入口を CartList に集める`: applyCoupon・selectShipping から自分の仕事を抽出し、applyCoupon・selectShipping を CartList へ移す(CartList が責務2種類)
- その他の全ステージ共通の検査(ID重複・自動命名・責務名・うわさ・C# の行数一致・変数のつながり・runtime など)は、コードの変更なしに新ステージにも効く

## 受け入れ基準

1. ステージ一覧の中級の末尾(中級12の次)に「中級13: 呼び合う画面部品を仲介役(Mediator)でつなぐ」があり、学べることに「Mediator」「循環依存」「多対一の依存」が出る
2. 中級13を開くと初期点が10点で、部品どうしに循環の矢印が6本あり、3部品が責務の混在で減点されている
3. changeQuantity の「数量を検証して…」を抽出すると名前の候補が `updateCartLines` になり、changeQuantity を空いた場所へドラッグすると `OrderFormMediator` という名前のクラスが自動でできる
4. 模範解答どおりに操作すると100点になり、矢印は OrderFormMediator から3部品への3本だけになる。解答例の再生でも最後に100点になる
5. 100点のあと、変更依頼「注文ボタンの押せる・押せないも切り替えて」は OrderFormMediator に置くと置き方が100点、「クーポンの使用条件を変えて」は CouponInput に置くと100点になり、2件目にはうわさ(営業の佐藤さん)が先に出る
6. ストーリーをオンにすると、中級12のあとに「呼び合う注文画面の部品」の章が出る
7. 「ソースをダウンロード(C#)」で初期・模範解答後とも書き出せる(`bash scripts/verify-csharp.sh` で build / run が通る)
8. `docs/stages/report.md` が再生成され、中級13の行がある
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 部品が仲介役のインターフェースへ知らせる GoF どおりの Mediator(呼び出し先の付け替え操作とインターフェースが要る。必要になったら上級ステージとして別に仕様化する)
- 仲介役を操作ごとに3つのクラスへ分けても100点になる抜け道を採点で塞ぐこと(同じ責務の散らばりを減点する新ルールが要る。連携の変更依頼で3クラスを直す痛みとして見える。問題になったら散らばりの採点として別に仕様化する)
- 新しい部品を足す extend の依頼・ボスの依頼
- 新しい採点ルール・新しい操作・型の変更・E2E の追加
- 比較表(`patternComparison.ts`)・比較クイズ(`comparisonQuizzes.ts`)への Mediator の追加
- 既存ステージのデータ変更、`docs/feature-ideas/IDEAS.md` の片付け(仕様確定後に呼び出し元が行う)
