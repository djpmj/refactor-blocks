# null-object-pattern-stage: 上級10「クーポンが無いときの null チェックを Null Object にまとめる」を足す
> **実装順の注意**: 同じ区分の新ステージ仕様(上級: adapter/chain/composite/null-object、中級: mediator/law-of-demeter/temporal-coupling/flag-argument)と、題名の番号(上級10・中級13)と登録ファイル(`*Stages.ts`・`sampleAnswer.ts`・`solutionPhaseTable.ts`・`storyChapters.ts`・`stageCatalog.test.ts`・`docs/stages/report.md`)が衝突する。**同時に実装しない**。先にマージされたものがあれば、番号は次の空き番号に付け直し、`storyChapters.ts` の「最後の章」も最新のものに合わせる。

重複の確認: 既存の実装・仕様に Null Object のステージは無い(`Null Object` を含むのは `docs/feature-ideas/IDEAS.md` の「10. Null Objectパターンのステージ」だけ)。
この仕様はその案を仕様化したもの。

## 背景・目的

上級では Strategy(上級3)・State(上級9)で「種類・状態ごとの if 分岐を、インターフェースを実装するクラスへ分ける」練習ができる。
けれど、いちばんよく見る分岐である「**値が無い(null)ときの if 分岐**」は練習できない。

- 実務では `if (coupon == null) { 割引0円 } else { coupon.applyDiscount() }` のような null チェックが、呼び出し側の何か所にも書かれる。
  1か所書き忘れると NullReferenceException になる(nullチェック漏れというバグの根)。
- Null Object は「無いとき」の振る舞いを、何もしない既定の実装(`NoCoupon`)としてインターフェースの実装の1つにする。
  呼び出し側は null を気にせず `Coupon` を呼ぶだけになり、分岐が多態に置き換わる。
- 上級6(ISP)で消した「空実装(書かされただけの未対応メソッド)」と、Null Object の「無いときの正しい既定の振る舞い」は見た目が似ている。
  その違いを理解度チェックで確かめる。

上級の末尾に Null Object のステージを1つ足し、「null のときの扱いが3つの呼び出し側に散らばる → 1つのクラスに集まる」ことを、
変更依頼(クーポンなしの扱いの変更が1クラスで済む)で実感させる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 新ステージ `nullObjectStage`(id `advanced-null-object`)を定義し、`advancedStages` 配列の**末尾**(`orderStateStage` の次)に足す。runtime の import を1行足す |
| 新規 | `src/infrastructure/stages/runtime/advanced-null-object.ts` | infrastructure | C# 書き出し用の `advancedNullObjectRuntime`(全ステージ runtime 必須: `stageCode.test.ts` の `withoutRuntime` が空であること) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps['advanced-null-object']`(11手)を足す |
| 変更 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | 8手以上なので方針の表 `'advanced-null-object'` を足す |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 新ステージの章を末尾に足し、上級9の章から「最後の章」の文言を外す(「全ステージに章がある」「並びが stages と同じ」テストのため) |
| 新規 | `src/infrastructure/stages/nullObjectStage.test.ts` | infrastructure(テスト) | 新ステージ固有のテスト(`orderStateStage.test.ts` と同じ形) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 初期違反の種類の表に1行、近道(`shortcuts`)に2件を足す |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する(`stageReport.test.ts` のスナップショット) |

**他の新規ステージ仕様と衝突しやすい登録箇所**(並行して別ステージを足すときは、後から入る側が並びと文言を合わせ直す):

- `advancedStages.ts` の `advancedStages` 配列の末尾と import 群
- `sampleAnswer.ts` の `sampleAnswerSteps`、`solutionPhaseTable.ts` の表
- `storyChapters.ts` の末尾(「最後の章」を名乗る章と、3月31日の結び)
- `stageCatalog.test.ts` の「初期違反の種類」の表と `shortcuts`
- `docs/stages/report.md`(再生成で行が増える)
- 題名の番号「上級10」(先に入ったステージが上級10を取ったら、こちらを繰り下げる)

domain の採点・操作(`scoring/`・`codebase/`・`change/`)、application、presentation は変更しない。既存の操作
(Extract Method・Merge Methods・Add File・Add Class・Move Method・実装するインターフェースの設定)だけで100点になる。新しい依存は足さない。

## データ・型の変更

型(`Stage`・`Codebase`・`ChangeRequest`・`StageRuntime`)の変更はなし。ステージデータを1件足す。

### ステージの基本項目

| 項目 | 値 |
| --- | --- |
| id | `advanced-null-object` |
| level | `'advanced'` |
| title | `上級10: クーポンが無いときの null チェックを Null Object にまとめる` |
| problem | `クーポンが無いとき(null)の扱いが、呼び出し側のあちこちに書かれている` |
| outcome | `null のときの扱いを、何もしない既定のクラスにまとめられる` |
| learns | `['Null Object', '多態']` |
| principles | `['dry']` |
| limits | `{ method: 24, class: 28, file: 30 }` |
| dependencyLimit | `2`(コメントで理由を書く。下の設計判断5) |
| responsibilityLimit | `1` |
| conditionNotes | `{ coupling: 'このゲームでは呼び出し先を書き換えられないため、呼び出し側が Coupon と NoCoupon の2つを呼ぶ形を答えとして認めるため' }` |
| visibilityEnforced | 省略(移動したメソッドは自動で public になる) |
| runtime | `advancedNullObjectRuntime` |

- description: `ネットショップのクーポン。注文にクーポンが付いていないとき、クーポンコードは null になる。会計の CheckoutService.checkout、カートの見積もり CartService.showCart、レシートの ReceiptService.printReceipt が、それぞれ「クーポンが無ければ(null なら)割引を0円にする」「クーポンが無ければ「クーポンなし」と表示する」の if を自分で書いている。新しい画面を足すたびに同じ null チェックを書くことになり、1か所でも書き忘れると例外で落ちる。クーポンの割引と表示は Coupon(インターフェース)経由で PercentCoupon(割引率のクーポン)に任せる形に、前任者が先に書き換えている。`
- goal: `「クーポンが無いとき」の処理を、何もしない既定の実装の新しいクラス(NoCoupon)に集めよう。Extract Methodで null のときの処理を applyDiscount / describe として取り出し、同じ処理は Merge Methods で1つにまとめてから、Move Methodで NoCoupon へ移す。最後に NoCoupon が Coupon を実装(implements)すれば、呼び出し側から null のときの分岐が消え、無いときも Coupon として同じように呼べる。メソッドは24行・クラスは28行・ファイルは30行以内、1クラスの責務は1種類まで、依存先は2クラスまで`
- why: `クーポンが無いときの扱いが3つの呼び出し側に散らばっていて、新しい画面を足すたびに null チェックを書き、変えるたびに3か所を直していました。「無いとき」を NoCoupon という Coupon の実装の1つにしたので、呼び出し側は null を気にせず呼べて、無いときの扱いは1か所を直せば済みます。`
- responsibilityNames: `checkout: '会計'`、`'cart-display': 'カートの表示'`、`receipt: 'レシート'`、`'no-coupon': 'クーポンなし'`、`'percent-coupon': '割引率クーポン'`、`'free-shipping-coupon': '送料無料クーポン'`
- classNames(自動命名。初期のクラス名と重ねない): `checkout: 'CheckoutFlow'`、`'cart-display': 'CartView'`、`receipt: 'ReceiptPrinter'`、`'no-coupon': 'NoCoupon'`、`'percent-coupon': 'RateCoupon'`
- methodNames: `checkout: 'checkoutOrder'`、`'cart-display': 'showEstimate'`、`receipt: 'buildReceipt'`、`'no-coupon': 'handleNoCoupon'`、`'percent-coupon': 'applyPercentCoupon'`

### 初期コードベース

ID は他ステージのテストが名指しする ID と重ねないよう、すべて `coupon-` を含める(`frag-coupon-*` 等は現状どこにも無いことを確認済み)。
`lines` はコードの行数と一致させる(`stageCode.test.ts`)。1行に文は1つ。後ろに処理が続く Fragment では行頭が `return` の行を書かない。
全メソッドの引数は `OrderData order`(`parameters: [{ type: 'OrderData', name: 'order' }]`)、各 Fragment の `variables` は `{ uses: ['order'] }` だけ
(何も declares しない。抽出したメソッドの引数が `OrderData order` になり、Coupon の契約と同じ形になる)。

| ファイル(id) | クラス(id) | メソッド(id・可視性) | Fragment(id / label / lines / responsibility / その他) |
| --- | --- | --- | --- |
| `src/coupon/CheckoutService.ts`(`file-coupon-checkout-service`) | CheckoutService(`class-coupon-checkout-service`) | `checkout`(`method-coupon-checkout`・public) | `frag-coupon-checkout-subtotal` / カートの商品から小計を計算する / 2 / `checkout`<br>`frag-coupon-checkout-no-coupon` / クーポンが無ければ(null なら)、割引を0円にして記録する / 2 / `no-coupon` / duplicateGroup `no-coupon-discount`・suggestedName `applyDiscount`<br>`frag-coupon-checkout-discount` / Coupon(インターフェース)経由で、クーポンの割引を計算する / 1 / `checkout` / uses `method-coupon-apply-discount`<br>`frag-coupon-checkout-pay` / 割引後の金額で決済する / 2 / `checkout` |
| `src/coupon/CartService.ts`(`file-coupon-cart-service`) | CartService(`class-coupon-cart-service`) | `showCart`(`method-coupon-show-cart`・public) | `frag-coupon-cart-subtotal` / 小計を計算して見積もりを作る / 2 / `cart-display`<br>`frag-coupon-cart-no-coupon-discount` / クーポンが無ければ(null なら)、割引を0円にして記録する / 2 / `no-coupon` / duplicateGroup `no-coupon-discount`・suggestedName `applyDiscount`<br>`frag-coupon-cart-discount` / Coupon(インターフェース)経由で、クーポンの割引を計算する / 1 / `cart-display` / uses `method-coupon-apply-discount`<br>`frag-coupon-cart-no-coupon-label` / クーポンが無ければ(null なら)、「クーポンなし」と表示する / 2 / `no-coupon` / duplicateGroup `no-coupon-label`・suggestedName `describe`<br>`frag-coupon-cart-label` / Coupon(インターフェース)経由で、クーポンの表示文言を作る / 1 / `cart-display` / uses `method-coupon-describe`<br>`frag-coupon-cart-render` / 見積もりを画面に表示する / 2 / `cart-display` |
| `src/coupon/ReceiptService.ts`(`file-coupon-receipt-service`) | ReceiptService(`class-coupon-receipt-service`) | `printReceipt`(`method-coupon-print-receipt`・public) | `frag-coupon-receipt-header` / レシートの見出しと明細を組み立てる / 2 / `receipt`<br>`frag-coupon-receipt-no-coupon` / クーポンが無ければ(null なら)、「クーポンなし」と表示する / 2 / `no-coupon` / duplicateGroup `no-coupon-label`・suggestedName `describe`<br>`frag-coupon-receipt-label` / Coupon(インターフェース)経由で、クーポンの表示文言を作る / 1 / `receipt` / uses `method-coupon-describe`<br>`frag-coupon-receipt-print` / レシートを印刷する / 2 / `receipt` |
| `src/coupon/Coupon.ts`(`file-coupon-contract`) | Coupon(`class-coupon-contract`) | `applyDiscount`(`method-coupon-apply-discount`)・`describe`(`method-coupon-describe`)、どちらも public・`fragments: []` | なし(インターフェース役) |
| `src/coupon/PercentCoupon.ts`(`file-coupon-percent`) | PercentCoupon(`class-coupon-percent`、`interfaceIds: ['class-coupon-contract']`) | `applyDiscount`(`method-coupon-percent-apply`・public)・`describe`(`method-coupon-percent-describe`・public) | applyDiscount: `frag-coupon-percent-discount` / クーポンコードの割引率で割引額を計算する / 2 / `percent-coupon`<br>describe: `frag-coupon-percent-label` / クーポンコードと割引額を表示用の文言にする / 2 / `percent-coupon` |

各 Fragment の C# コード(`code.csharp`。行数 = 上の lines。同じ duplicateGroup はコードを完全一致させる):

```csharp
// frag-coupon-checkout-subtotal
if (order.Items.Count == 0) throw new ValidationException("カートが空です");
order.Subtotal = order.Items.Sum(item => item.UnitPrice * item.Quantity);
// frag-coupon-checkout-no-coupon / frag-coupon-cart-no-coupon-discount(duplicateGroup no-coupon-discount)
if (order.CouponCode is null) order.Discount = 0m;
if (order.CouponCode is null) Log.Info($"注文 {order.Id} はクーポンなしで計算しました");
// frag-coupon-checkout-discount / frag-coupon-cart-discount
applyDiscount(order);
// frag-coupon-checkout-pay
order.Total = order.Subtotal - order.Discount;
FakePayment.Charge(order.Id, order.Total);
// frag-coupon-cart-subtotal
order.Subtotal = order.Items.Sum(item => item.UnitPrice * item.Quantity);
Log.Info($"注文 {order.Id} の見積もりを作りました: 小計 {order.Subtotal} 円");
// frag-coupon-cart-no-coupon-label / frag-coupon-receipt-no-coupon(duplicateGroup no-coupon-label)
if (order.CouponCode is null) order.CouponLabel = "クーポンなし";
if (order.CouponCode is null) Log.Info($"注文 {order.Id} のクーポン表示: {order.CouponLabel}");
// frag-coupon-cart-label / frag-coupon-receipt-label
describe(order);
// frag-coupon-cart-render
order.Total = order.Subtotal - order.Discount;
Console.WriteLine($"[画面] 合計 {order.Total} 円({order.CouponLabel})");
// frag-coupon-receipt-header
Console.WriteLine($"[レシート] 注文 {order.Id}");
Console.WriteLine($"[レシート] 明細 {order.Items.Count} 点 小計 {order.Subtotal} 円");
// frag-coupon-receipt-print
Console.WriteLine($"[レシート] クーポン: {order.CouponLabel}");
Console.WriteLine($"[レシート] 合計 {order.Subtotal - order.Discount} 円");
// frag-coupon-percent-discount
if (order.CouponCode is not null) order.Discount = decimal.Round(order.Subtotal * CouponCatalog.RateOf(order.CouponCode), 0);
if (order.CouponCode is not null) Log.Info($"注文 {order.Id} にクーポン {order.CouponCode} を使いました");
// frag-coupon-percent-label
if (order.CouponCode is not null) order.CouponLabel = $"クーポン {order.CouponCode}(-{order.Discount}円)";
if (order.CouponCode is not null) Log.Info($"注文 {order.Id} のクーポン表示: {order.CouponLabel}");
```

### runtime(`runtime/advanced-null-object.ts`)

`advanced-order-state.ts` と同じ形で書く。

- `entryMethodId: 'method-coupon-show-cart'`(null の分岐を2つとも通る)、`entryArguments: ['SampleData.Order']`
- `bindings: { Coupon: 'PercentCoupon' }`(完成形では Coupon の実装が PercentCoupon・NoCoupon の2つになり、決めないと `ambiguous-binding` になる。
  初期と同じ出力にするため PercentCoupon を選ぶ。初期は実装が1つなので bindings に関係なく PercentCoupon が入る)
- `bindingDemos` は付けない(省略可。`stageCode.test.ts` の bindings の `it.each` にも足さない)
- `support`: `logFile` と `supportFile('OrderData.cs', ...)`。中身は `OrderItem`(`UnitPrice`・`Quantity`)・`OrderData`(`Id`・`Items`・`Subtotal`・`Discount`・`Total`・`string? CouponCode`・`CouponLabel = ""`)・
  `ValidationException`・`FakePayment.Charge`(1行出す偽物)・`CouponCatalog.RateOf(string code)`(常に `0.1m`)・`SampleData.Order`(`CouponCode = null`、明細2点)

### 変更依頼(changeRequests。この順に並べる)

| # | id | kind | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-add-free-shipping-coupon` | `extend` | 送料無料のクーポンを足して | 割引率ではなく、送料を0円にするクーポンを新しく出したい。割引率のクーポンは、これまでどおり使う。 | `free-shipping-coupon` | 8 | `applyFreeShippingCoupon` | なし(最初に全文を見せる extend) |
| 2 | `req-no-coupon-guidance` | (modify) | クーポンなしの注文に、次回のクーポンを案内して | クーポンを使っていない注文では、割引0円の記録と表示のときに「次回使える10%オフクーポン」の案内も出したい。 | `no-coupon` | 2 | `suggestNextCoupon` | なし(最初に全文を見せる modify) |
| 3 | `req-no-coupon-points` | (modify) | クーポンなしの注文は、ポイントを2倍にして | クーポンを使わなかったお客様には、代わりにポイントを2倍つけたい。 | `no-coupon` | 2 | `grantDoublePoints` | `{ from: '営業の佐藤さん', text: 'クーポンを使わないお客様向けの特典を考えている、という話があるらしいです。' }` |

- 1は「NoCoupon も PercentCoupon も、送料無料のクーポンも、同じ Coupon の実装の1つ」を見せる(Coupon は呼び出し側から呼ばれているので、新しいクラスが `'abstract'` につながり100点)。
- 2・3は「無いときの扱いの変更が、初期は3クラス・4か所 → 解答後は NoCoupon の1クラス」を見せる。
- ボス(`boss: true`)は付けない(ボスのあるステージを固定で列挙しているテストを変えないため)。

### 理解度チェック(checks。正解は最長の選択肢にしない・正解の位置を2問で変える)

- `check-1`(answer: 1)「クーポンが無いときの扱いを NoCoupon にまとめる(Null Object)と、何が良くなる?」
  - 0: `呼び出し側が null を気にしなくてよくなる代わりに、割引率のクーポンの割引は計算できなくなってしまう` / 解説: `割引率のクーポンは PercentCoupon が今までどおり受け持ちます。NoCoupon は「無いとき」の振る舞いだけを持ちます。`
  - 1: `新しい呼び出し側を足しても、null チェックを書き忘れる心配が減る` / 解説: `「無いとき」の振る舞いが Coupon の実装の1つになるので、呼び出し側は Coupon を呼ぶだけで済みます。`
  - 2: `null チェックを書く場所が1か所に集まるだけで、if 文の数も呼び出し側の書き方も今までと何も変わらない` / 解説: `狙いは if を1か所に寄せることではなく、多態で呼び出し側から分岐をなくすことです。`
- `check-2`(answer: 0)「NoCoupon の『割引0円』と、上級6で消した空実装(未対応のメソッド)の違いとして、合っているのはどれ?」
  - 0: `NoCoupon は無いときの正しい振る舞いで、空実装は使わない契約を書かされた跡` / 解説: `既定の振る舞いを持つのが Null Object、契約を押し付けられた結果が空実装です。だから NoCoupon は消しません。`
  - 1: `どちらも中身がほとんど無いので同じものであり、見つけたらどちらも消してしまってかまわない` / 解説: `NoCoupon を消すと、呼び出し側に null チェックが戻ってきます。`
  - 2: `NoCoupon はインターフェースを実装するが、空実装はインターフェースとは関係なく、どのクラスに書いてもよいもの` / 解説: `空実装も、インターフェースの契約を満たすために書かされたものです。違いは振る舞いに意味があるかどうかです。`

### 模範解答(`sampleAnswerSteps['advanced-null-object']`、11手)

同じ処理(duplicateGroup が同じ)を Value Object(上級7)と同じ「抽出 → 統合 → 移動」で集める。抽出名は Coupon の契約名と同じにする
(移動後に NoCoupon が Coupon を実装できるように)。移動元は同名メソッドが Coupon・PercentCoupon にもあるので `fromClass` を必ず書く。

```ts
'advanced-null-object': [
  { extract: { from: 'checkout', fragmentIds: ['frag-coupon-checkout-no-coupon'], name: 'applyDiscount' } },
  { extract: { from: 'showCart', fragmentIds: ['frag-coupon-cart-no-coupon-discount'], name: 'applyDiscount' } },
  { merge: { methodA: 'applyDiscount', methodAClass: 'CheckoutService', methodB: 'applyDiscount', methodBClass: 'CartService', name: 'applyDiscount' } },
  { extract: { from: 'showCart', fragmentIds: ['frag-coupon-cart-no-coupon-label'], name: 'describe' } },
  { extract: { from: 'printReceipt', fragmentIds: ['frag-coupon-receipt-no-coupon'], name: 'describe' } },
  { merge: { methodA: 'describe', methodAClass: 'CartService', methodB: 'describe', methodBClass: 'ReceiptService', name: 'describe' } },
  { addFile: 'src/coupon/NoCoupon.ts' },
  { addClass: { name: 'NoCoupon', file: 'src/coupon/NoCoupon.ts' } },
  { move: { method: 'applyDiscount', fromClass: 'CheckoutService', toClass: 'NoCoupon' } },
  { move: { method: 'describe', fromClass: 'CartService', toClass: 'NoCoupon' } },
  { addInterface: { class: 'NoCoupon', interface: 'Coupon' } },
],
```

方針の表(`solutionPhaseTable['advanced-null-object']`):

- `{ from: 0, title: '「割引0円にする」null の扱いを1つにまとめる', why: '会計とカートに同じ null チェックがあるので、まず取り出して1つにすれば、無いときの割引を1か所で読めるため' }`
- `{ from: 3, title: '「クーポンなし」と表示する null の扱いも1つにまとめる', why: 'カートとレシートの表示も同じ形で集めれば、無いときの振る舞いがそろうため' }`
- `{ from: 6, title: 'NoCoupon を作り、Coupon の実装の1つにする', why: '無いときの振る舞いを Coupon の実装にすれば、呼び出し側は null を気にせず Coupon を呼ぶだけで済むため' }`

### 机上の検算(`stageCatalog.test.ts` の保証に通ること)

行数は「コード行数+1(ラベル行)」、メソッドは +3 と Fragment 間の空行、クラスは +3 とメソッド間の空行。呼び出し行は1行+1 = 2行。

| 対象 | 初期 | 模範解答後 | 上限 |
| --- | --- | --- | --- |
| `checkout` / `showCart` / `printReceipt` | 17 / 24 / 17 | 16 / 22 / 16 | メソッド24 |
| CheckoutService / CartService / ReceiptService | 20 / 27 / 20 | 19 / 25 / 19 | クラス28・ファイル30 |
| Coupon / PercentCoupon | 10 / 16 | 10 / 16 | クラス28 |
| NoCoupon(`applyDiscount`・`describe` 各6行) | — | 16 | クラス28 |
| 責務の種類 | 呼び出し側3クラスが各2種(3件違反)・PercentCoupon 1種 | 全クラス1種(呼び出し行は数えない) | 1 |
| 依存 | 呼び出し側 → Coupon(各1) | 呼び出し側 → Coupon・NoCoupon(各2) | 2 |

- 初期: responsibility 3件 = **70点**。減点の種類は `['responsibility']` だけ(行数・結合度・循環・約束違反なし)。
- 模範解答後: **100点**。確認した規則: 循環なし/空の入れ物なし/未使用 private なし(移動で public になる)/
  約束違反なし(NoCoupon・PercentCoupon とも `applyDiscount`・`describe` を持ち Coupon を実装。呼び出し側の public メソッド名は契約名と重ならず、抽出中の同名メソッドは private なので「実装の宣言漏れ」に数えない)/
  極小メソッドなし(NoCoupon のメソッドはコード2行+1 = 3行)/空実装なし(`stub` を付けない)/横流しなし/混在した抽出メソッドなし/
  フィールドを持たないので Feature Envy・カプセル化・凝集度は対象外/責務の散らばりなし(`no-coupon` は NoCoupon だけ)。
- 途中の手: 統合直後(3手目・6手目)は、別クラスが統合先の private メソッドを呼ぶ一時的なコンパイルエラーになる(上級7と同じ。`redFailuresAcross` はコンパイルエラーを除く)。最終形は緑。
- 名前の重なり: 抽出した private `applyDiscount` と、同じクラスの「Coupon 経由で…」の行(uses は Coupon の契約)は別のメソッドIDを指すので、
  C# では `_coupon.applyDiscount(order)` と自分の `applyDiscount(order)` に分かれる(`qualifyFragmentCode` は uses ごとに受け手を付ける)。
- 変更依頼(modify の変更コスト `scoreChange`):
  - `req-no-coupon-guidance`: 初期は4か所・3クラス(散らばり-20、CartService が追加後26行でメソッド上限超え-10 ほか)→ 模範解答後は NoCoupon の2メソッド・1クラス。
    「はっきり楽になる」はクラス数 3 → 1 で成り立つ。点は実装時に実測してテストに固定してよい(初期より高いことが保証の条件)。
  - `req-no-coupon-points`: 同様。
- 解答例の置き方(`sampleImplementation`)はすべて100点の見込み:
  - extend `req-add-free-shipping-coupon`: Coupon を実装する新しいクラスに置く。Coupon は呼び出し側から呼ばれているので `'abstract'`。
  - modify 2件: NoCoupon に置く(他の責務なし・散らばりなし)。
  - よって `knownChangeRequestExceptions` に足すものはない。100点にならなければ題材の数値を直す(例外の表には足さない)。
- うわさ: 3件目だけが持つ。話し手 `営業の佐藤さん` は既存の章の話し手、1文、title・partName・自動命名のクラス名/メソッド名を含まず、「らしい」を含む。
- 振る舞いのテスト: 入口は public の `checkout`・`showCart`・`printReceipt`(と PercentCoupon のメソッド)。抽出・統合・移動・実装の設定は実行される処理の集合を変えない。
- 自動命名: 抽出は単独の Fragment なので `suggestedName`(`applyDiscount`・`describe`)が候補になり、空いた場所へドラッグして作るクラスは
  `classNames['no-coupon']` から `NoCoupon` と自動で付く(プレイヤーに命名させない)。

### ストーリー(`storyChapters.ts`)

- 上級9の章: title を `注文の状態` に、outro を `3月の終わり。返品の受け付けについて、QAの高橋さんから相談がありました。` にする(結びは上級9の1件目の依頼 `req-add-returned-state` へつなぐ)。
- 新しい章を末尾に足す: `{ stageId: 'advanced-null-object', title: '最後の章、クーポンのない注文', speaker: SATO, intro: '営業の佐藤です。クーポンを使わないお客様の画面で、エラーが出たという報告がまた来ました。新しい画面を作るたびに、クーポンが無いときの確認が漏れるみたいなんです。無いときの扱いを、書き忘れようのない形にしてもらえませんか。', outro: '3月31日の夕方。最後の依頼が届きました。このコードが整っていたからこそ、慌てずに済みそうです。' }`

## 動きの仕様

- ステージ一覧の上級の末尾(上級9の次)に「上級10: クーポンが無いときの null チェックを Null Object にまとめる」が出る。
- 初期画面: CheckoutService・CartService・ReceiptService から Coupon への依存矢印、PercentCoupon から Coupon への実装の矢印。3つの呼び出し側が責務の混在で減点されている。
- プレイヤーの操作は既存のものだけ: メソッドエディタで null の分岐を選んで抽出(名前の候補は `applyDiscount`・`describe`)→ 同じ処理を統合 →
  空いた場所へドラッグして新しいクラス(自動で `NoCoupon`)を作る、または NoCoupon へドラッグ → クラスの右クリックから Coupon を実装。
- NoCoupon が Coupon を実装すると、Coupon から2本目の実装の矢印が出て100点になる。
- 100点のあと、変更依頼は送料無料のクーポン(新しいクラスで100点)→ クーポンなしの案内(NoCoupon だけ直す)→ ポイント2倍(うわさ付き)の順に出る。

### 設計判断(確定)

1. **題材はクーポン(割引と表示の2操作)、呼び出し側は3クラスにする。** null チェックが「あちこちにある」ことを見せる最小の数。
   操作を2つにしたのは、Null Object が複数の振る舞いを持つ1つのクラスであることを見せるため(1操作だと上級3と区別が付かない)。
2. **呼び出し側は前任者が Coupon 経由で呼ぶ形に書き換え済みで、null のときの分岐だけが残っている、という「移行の途中」の形にする。**
   上級9・中級10と同じ作り。このゲームには呼び出し先を付け替える操作が無く、抽出で残る呼び出し行は具体的な NoCoupon を指す。
   最初から Coupon が呼ばれていれば、変更依頼1の新しいクーポンが「呼ばれている抽象」につながり100点になる。
3. **null のときの処理の C# には `if (order.CouponCode is null)` を残す。** Fragment のコードは移動しても変わらないため(上級9の状態クラスに状態判定が残るのと同じ)。
   ラベルとステージの説明で「呼び出し側から null の分岐が消える」ことを伝える。PercentCoupon 側の `is not null` も同じ理由で、移行の途中の名残として置く。
4. **重複は Merge Methods で1つにする(抽出 → 統合 → 移動)。** 「同じ null チェックが散らばる」を duplicateGroup で表せ、上級7の操作をそのまま使える。
   統合しないと NoCoupon に同名メソッドを2つ移せず、模範解答が組めない。
5. **結合度は上限2で認め、conditionNotes で理由を出す。** 呼び出し側が Coupon と NoCoupon の両方を呼ぶ形は、判断2の制約から避けられない。
6. **責務の上限は1にする。** 初期の減点を「呼び出し側に、無いときの扱いが混ざっている」の1種類に絞り、行数の数字合わせをしない(Null Object で行数はほとんど減らないため)。
7. **NoCoupon のメソッドは空実装(`stub`)にしない。** 「割引0円・クーポンなしと表示」は無いときの正しい振る舞いで、上級6の空実装とは別物。理解度チェック2で対比する。
8. **うわさのために3件目の modify を足す。** うわさは「最初に全文を見せる extend・modify 以外」にしか付けられないため。
9. **E2E は足さない。** 新しい操作・UIは無く、使う操作(抽出・統合・移動・新しいクラス・実装の設定)は既存の E2E が守っている(上級3・上級9と同じ判断)。

## TDD対象

新しい純粋関数は無い。ステージデータが仕様どおりに採点されることを、先にテストを書いて確かめる(Red → Green)。AAA で書く。

### `nullObjectStage.test.ts`(infrastructure・新規)

- 模範解答は11手で、初期70点・模範解答後100点
- 初期の減点の種類は responsibility だけで、件数は3(CheckoutService・CartService・ReceiptService)
- 模範解答後、NoCoupon が Coupon を `interfaceIds` に持ち、メソッドは `applyDiscount`・`describe` の2つで、責務は `no-coupon` の1種類だけ
- 模範解答後、呼び出し側3クラスに `no-coupon` の処理が残っていない(呼び出し行 `call` だけになっている)
- 異常系: 模範解答から `addInterface` の手を抜くと100点未満(約束違反)
- extend `req-add-free-shipping-coupon`: 模範解答後の置き先が `{ kind: 'new-class', implementing: 'Coupon' }` で、書き換えるクラスが0
- modify `req-no-coupon-guidance`: 初期の変更箇所は3クラス、模範解答後は NoCoupon の1クラス
- 依頼の種類が `['extend', 'modify', 'modify']` で、3件目だけがうわさを持つ
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(infrastructure・変更)

- 「初期違反の種類」の表に `['advanced-null-object', ['responsibility']]` を足す
- 近道(`shortcuts`、どちらも100点未満):
  - `NoCoupon へ移すが Coupon を実装しない`: 模範解答から `addInterface` の手を除いたもの
  - `null の扱いを抽出して統合するが、呼び出し側に残す`: 模範解答の最初の6手だけ(`no-coupon` が CheckoutService・CartService に残り、責務の混在が消えない)
- その他の全ステージ共通の検査(模範解答で100点・どの手の後も振る舞いが緑・解答例の依頼が100点・うわさ・自動命名・責務名・ID重複・runtime の変数のつながり など)は、コードの変更なしに新ステージにも効く

## 受け入れ基準

1. ステージ一覧を開くと、上級の末尾(上級9の次)に「上級10: クーポンが無いときの null チェックを Null Object にまとめる」があり、学べることに「Null Object」「多態」が出る
2. 上級10を開くと初期点が70点で、CheckoutService・CartService・ReceiptService が責務の混在で減点されている
3. checkout の「クーポンが無ければ…」を抽出すると名前の候補が `applyDiscount` になり、統合した処理を空いた場所へドラッグすると `NoCoupon` という名前のクラスが自動でできる
4. 模範解答の手順どおり(null の扱いを抽出・統合して NoCoupon へ移し、Coupon を実装)に操作すると100点になる。解答例の再生でも最後に100点になる
5. 100点のあと、変更依頼「送料無料のクーポンを足して」で Coupon を実装する新しいクラスに部品を置くと置き方が100点、「クーポンなしの注文に、次回のクーポンを案内して」は NoCoupon に置くと100点になる。3件目の依頼にはうわさ(営業の佐藤さん)が先に出る
6. ストーリーをオンにすると、上級9のあとに「最後の章、クーポンのない注文」が出て、上級9の章はもう「最後の章」と名乗らない
7. `npm run csharp-export` で上級10のプロジェクトが書き出され、初期と完成形で同じ出力になる(要 .NET の確認は `scripts/verify-csharp.sh`。できる環境で実施)
8. `docs/stages/report.md` が再生成され、上級10の行がある
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 呼び出し側の「Coupon 経由で…」の行と NoCoupon への呼び出し行を1行にまとめる操作(呼び出し先の付け替え)。上級3・上級9と同じ既知の制約で、新しい操作は足さない
- null を返す側(リポジトリ)を「NoCoupon を返す」形に直す題材。生成の置き場所の話は上級4(Factory)の領分で、今回は呼び出し側の分岐を消すことに絞る
- 新しい採点ルール(「null チェックの重複」の検出など)・新しい操作・型の変更
- ステージ一覧の「パターン比較」表(`patternComparison.ts`)への追加。テストが5件と並びを固定しており、比較表の見直しは別仕様にする
- デザインパターン比較クイズ(`comparisonQuizzes.ts`)への追加
- `stageCode.test.ts` の bindings の実行テスト(`it.each`)への追加と `bindingDemos`。bindings は書き出しのビルドを通すためだけに使う
- ボスの変更依頼(ボスのあるステージを固定で列挙しているテストの変更が要るため)
- 既存ステージ(上級3・上級6・上級7・上級9)のデータの変更。ストーリーの上級9の章の文言だけは、最後の章でなくなるので直す
- `docs/feature-ideas/IDEAS.md` の更新(仕様化した案の片付けは、仕様の確定後に呼び出し元が行う)
