# law-of-demeter-stage: 中級13「注文から住所までたどる宛名印刷」(Law of Demeter / Hide Delegate)
> **実装順の注意**: 同じ区分の新ステージ仕様(上級: adapter/chain/composite/null-object、中級: mediator/law-of-demeter/temporal-coupling/flag-argument)と、題名の番号(上級10・中級13)と登録ファイル(`*Stages.ts`・`sampleAnswer.ts`・`solutionPhaseTable.ts`・`storyChapters.ts`・`stageCatalog.test.ts`・`docs/stages/report.md`)が衝突する。**同時に実装しない**。先にマージされたものがあれば、番号は次の空き番号に付け直し、`storyChapters.ts` の「最後の章」も最新のものに合わせる。

> **既存との重複確認**: 同名の仕様書・実装は無い。ただし `docs/specs/delete-class-code-guard.md` 45行目と
> `docs/specs/extends-interface-loophole.md` 201行目が、未作成の旧案 `law-of-demeter-stage`(`Address.ts` を空にして消す02案)に触れている。
> 本仕様書は**その旧案を置き換える**。本案は Address を消さないので、`delete-class-code-guard` の「近道で消す空のクラス」の行は本案に当てはまらない
> (あちらの仕様書は書き換えない。衝突なし)。題材は `docs/feature-ideas/IDEAS.md` 2026-10-03 の4番。

## 背景・目的

`order.getCustomer().getAddress().formatForLabel()` のように、相手の**内部をたどる**呼び出し(メッセージチェーン)は、
呼び出し元が「Order の中に Customer、その中に Address」という構造を知ってしまい、途中の構造や末端の変更が呼び出し元まで波及する。
中級6(Feature Envy)・中級7(貧血ドメインモデル)は「データを持つ相手に頼む(Tell, Don't Ask)」を**フィールド**で練習したが、
「**直接の友だちにだけ話す**」(Law of Demeter)を**呼び出しの連鎖**で練習するステージがない。

宛名ラベルと納品書の2つの印刷クラスが同じチェーンをたどっている題材で、チェーンの後ろ側から委譲メソッドへ切り出し(Hide Delegate)、
Customer → Order の順に持ち主へ移す。最後に、外から使われなくなった getter を private にして「隠した」ことを確かめる。

### チェーンの長さの減点ルールは追加しない(ponytail 1〜2段目で止まる)

- このモデルでは、チェーンの1段ごとに `Fragment.uses` が別クラスのメソッドを指すので、**チェーンの段数 = 呼び出し元の依存先の数**になる。
  既存の結合度(`coupling`、`dependencyLimit`)が「直接の友だち以外を知っている」をそのまま数える。`dependencyLimit: 1` にすれば Law of Demeter と同じ判定になる。
- 専用ルール(例: 1つのメソッドが別クラスを2つ以上たどったら減点)を足すと、同じ状態を `coupling` と二重に数える。
  また「引数でもらったオブジェクト・自分で作ったオブジェクトは友だち」という Law of Demeter の区別は、`uses` だけのモデルでは表せない。
- 「知りすぎが変更を広げる」体感は、変更依頼の**波及**(`scoreChange` の `ripple`: 変更したクラスに依存する、変更対象でないクラスの数)が既に出せる。
  末端の Address を変える依頼で、波及が 2クラス(印刷クラス2つ)→ 1クラス(Customer だけ)に減る。
- 新しい減点ルールが要るのは、「依存先は1つだが、その1つから返ったオブジェクトをさらにたどる」をモデルで表したくなったとき(`uses` に経路を持たせる必要がある)。今回はやらない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | `lawOfDemeterStage` を定義し、`intermediateStages` の**末尾**(`middleManStage` の後)に追加。**他の新規中級ステージ仕様と衝突しやすい** |
| 新規 | `src/infrastructure/stages/runtime/intermediate-law-of-demeter.ts` | infrastructure | C# 実行用の `StageRuntime`(全ステージ必須。`stageCode.test.ts` 625行目) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain | `sampleAnswerSteps` に `'intermediate-law-of-demeter'` の10手を追加。**衝突しやすい** |
| 変更 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | 8手以上なので方針の表を追加(`stageCatalog.test.ts` 1450行目)。**衝突しやすい** |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 中級12の章の直後に章を1つ追加(`storyChapters.test.ts` が全ステージ・同じ順を要求)。**衝突しやすい** |
| 新規 | `src/infrastructure/stages/lawOfDemeterStage.test.ts` | infrastructure(テスト) | 本ステージ固有の点数・依存・近道の確認(下記 TDD対象) |
| 変更 | `e2e/reference-menu.spec.ts` | e2e | `runtimeStages`(151〜170行目)に1行追加。**衝突しやすい** |
| 変更 | `docs/stages/report.md` | docs | `npm run stage-report` で再生成(`stageReport.test.ts` 368行目のスナップショット)。**衝突しやすい**(他ステージ追加と同時なら後からマージする側が再生成) |

- `src/domain/scoring/` と `src/application/`・`src/presentation/` は変更しない。新しい依存も足さない。
- `stageCatalog.test.ts` は変更しない(近道の確認は新規テストファイルに置く。例外表 `notRelievedExceptions`・`knownChangeRequestExceptions` にも載せない)。

## データ・型の変更

型の変更はなし。追加するステージ定義は次のとおり。C# のコードは例で、**`lines` と実際のコード行数を一致させる**(`stageCode.test.ts` 462行目)。

### ステージのメタ情報

| 項目 | 値 |
| --- | --- |
| `id` | `'intermediate-law-of-demeter'` |
| `level` | `'intermediate'` |
| `title` | `'中級13: 注文から住所までたどる宛名印刷'` |
| `problem` | `'印刷のたびに、注文から顧客、顧客から住所へと中をたどっている'`(コード識別子を含めない) |
| `outcome` | `'他クラスの内部をたどる呼び出しを、委譲メソッドで隠せる'` |
| `learns` | `['Law of Demeter', 'Hide Delegate', "Tell, Don't Ask"]` |
| `principles` | `['encapsulation']` |
| `limits` | `{ method: 7, class: 30, file: 40 }` |
| `dependencyLimit` | `1` |
| `responsibilityLimit` | `1` |
| `visibilityEnforced` | 省略(false。移動後は `publicizeCrossClassCalls` が public にする) |
| `runtime` | `intermediateLawOfDemeterRuntime` |

- `description`: 「配送の宛名ラベルを印刷する ShippingLabelPrinter と、納品書を印刷する DeliveryNotePrinter。どちらも `order.getCustomer()` で顧客を、`customer.getAddress()` で住所を取り出し、`address.formatForLabel()` で宛先の文字列を作っている。印刷クラスが、注文・顧客・住所の3つのクラスの中身を知っている。」
- `goal`: 「印刷クラスが知っていてよいのは Order だけ(直接の友だちにだけ話す)。チェーンの後ろ側から Extract Method して Customer へ、残りを Order へ移し、印刷クラスからは Order に頼むだけにしよう。同じ形の抽出は Merge Methods で1つにまとめられる。外から使われなくなった getter は private に。メソッドは7行以内、依存先は1クラスまで」
- `why`: 「住所の持ち方や宛先の書き方が変わるたびに、住所をたどっている印刷クラスすべてに影響が出ます。たどり方を Order と Customer の中に隠せば、印刷クラスは Order に頼むだけになり、住所の変更は Customer と Address の間で閉じます。」
- `responsibilityNames`: `{ accessor: '値の取り出し', 'address-format': '宛先の書式', 'label-print': 'ラベル印字', 'note-print': '納品書の印字' }`
- `classNames`(自動命名。初期クラス名と重ねない): `{ accessor: 'AccessorHandler', 'address-format': 'AddressFormatter', 'label-print': 'LabelRenderer', 'note-print': 'NoteRenderer' }`
- `methodNames`: `{ accessor: 'getValue', 'address-format': 'formatAddress', 'label-print': 'renderLabel', 'note-print': 'renderNote' }`
- プレイヤーにクラスを作らせない(新しいクラスは不要)。クラス名を考えさせる場面はない。

### コードベース

| ファイル(id / path) | クラス(id / name) | フィールド | メソッド |
| --- | --- | --- | --- |
| `file-shipping-label-printer` / `src/shipping/ShippingLabelPrinter.ts` | `class-shipping-label-printer` / `ShippingLabelPrinter` | なし | `method-print-label` `printLabel(string trackingNumber)` public |
| `file-delivery-note-printer` / `src/shipping/DeliveryNotePrinter.ts` | `class-delivery-note-printer` / `DeliveryNotePrinter` | なし | `method-print-note` `printNote(int orderId)` public |
| `file-order` / `src/order/Order.ts` | `class-order` / `Order` | `field-order-customer` `customer`(private, `Customer`) | `method-get-customer` `getCustomer()` public、returns `customer: Customer` |
| `file-customer` / `src/customer/Customer.ts` | `class-customer` / `Customer` | `field-customer-address` `address`(private, `Address`) | `method-get-address` `getAddress()` public、returns `address: Address` |
| `file-address` / `src/customer/Address.ts` | `class-address` / `Address` | `field-address-postal-code` `postalCode`・`field-address-prefecture` `prefecture`・`field-address-city` `city`・`field-address-street` `street`(すべて private, `string`) | `method-format-for-label` `formatForLabel()` public、returns `addressLine: string` |

Fragment(`printNote` は `label` → `note` に読み替えた同じ形。id は `frag-note-…`):

| id | label | responsibility | lines | uses / reads | variables |
| --- | --- | --- | --- | --- | --- |
| `frag-label-get-customer` | `order.getCustomer() で顧客を取り出す` | `call` | 1 | uses `method-get-customer` | declares `customer: Customer` |
| `frag-label-get-address` | `customer.getAddress() で住所を取り出す` | `call` | 1 | uses `method-get-address` | declares `address: Address` |
| `frag-label-format-address` | `address.formatForLabel() で宛先の文字列を作る` | `call` | 1 | uses `method-format-for-label` | declares `addressLine: string` |
| `frag-label-print` | `宛名ラベルを組み立てて印刷する` | `label-print` | 5 | なし | uses `trackingNumber`, `addressLine` |
| `frag-note-print` | `納品書を組み立てて印刷する` | `note-print` | 5 | なし | uses `orderId`, `addressLine` |
| `frag-get-customer` | `顧客を返す` | `accessor`(`accessor: true`) | 1 | reads `field-order-customer` | declares `customer: Customer` |
| `frag-get-address` | `住所を返す` | `accessor`(`accessor: true`) | 1 | reads `field-customer-address` | declares `address: Address` |
| `frag-format-for-label` | `郵便番号と住所を宛先の1行にまとめる` | `address-format` | 3 | reads 4フィールドすべて | declares `addressLine: string` |

- call Fragment には `code` を書かない(`stageCode.test.ts` 430行目。呼び出し文は生成される)。
- 印刷の2つの処理(5行)と getter・`formatForLabel` のC#の例:
  - `frag-label-print`: `if (string.IsNullOrWhiteSpace(trackingNumber)) throw new ArgumentException("追跡番号がありません");` / `var header = "=== 配送ラベル ===";` / `var body = $"お届け先: {addressLine}";` / `var footer = $"追跡番号: {trackingNumber}";` / `Console.WriteLine($"{header} {body} {footer}");`
  - `frag-note-print`: `if (orderId <= 0) throw new ArgumentOutOfRangeException(nameof(orderId));` / `var title = $"納品書 No.{orderId}";` / `var deliverTo = $"納品先: {addressLine}";` / `var issuedOn = $"発行日: {SampleData.Today:yyyy-MM-dd}";` / `Console.WriteLine($"{title} / {deliverTo} / {issuedOn}");`
  - `frag-get-customer`: `var customer = this.customer;`、`frag-get-address`: `var address = this.address;`
  - `frag-format-for-label`: `var cityLine = $"{prefecture}{city}{street}";` / `var addressLine = $"〒{postalCode} {cityLine}";` / `Log.Debug($"宛先を組み立てました: {addressLine}");`
- getter は `accessor: true` にする(1行メソッドが `trivial-method` で減点されないため。`overExtraction.ts` 14行目)。

### 変更依頼(`changeRequests`)

| id | title | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- |
| `req-label-barcode` | `配送ラベルに追跡番号のバーコードも印字して` | `label-print` | 1 | `addTrackingBarcode` | なし(痛みカードで全文表示) |
| `req-address-building` | `宛先に建物名と部屋番号も載せて` | `address-format` | 2 | `appendBuildingName` | `{ from: '先輩の田中さん', text: '住所の書き方を変えたいという話が、そのうち出てくるらしいです。' }` |

- ボスは付けない(`stageCatalog.test.ts` 983行目の11ステージ固定を崩さない)。
- 2件目が本題: 末端の Address を変えると、初期は Address に依存する印刷クラス2つへ波及(ripple 2 → -10)、解答後は Customer だけ(ripple 1 → -5)。

### 理解度チェック(`checks`、3問。正解の位置をばらす。解説は「正解です」で始めない)

1. 「ShippingLabelPrinter が order.getCustomer().getAddress().formatForLabel() とたどる形の、いちばんの問題は?」
   - 「呼び出しが長くて1行に収まらないから」/ 長さではなく、知っている相手の数が問題です。
   - **「Order の中に Customer、その中に Address という構造を知ってしまい、その構造が変わると印刷クラスまで直すことになるから」**(answer: 1)/ 呼び出し元が知る相手が増えるほど、変更の波及先も増えます。
   - 「getter を呼ぶと処理が遅くなるから」/ 速度の話ではなく、変更の広がり方の話です。
2. 「Order に shippingAddressLine() を足して、印刷クラスがそれを呼ぶようにすると、何が変わる?」
   - **「印刷クラスは Order に頼むだけになり、住所のたどり方は Order と Customer の中に閉じ込められる」**(answer: 0)/ 聞いて自分で組み立てる代わりに、頼む(Tell, Don't Ask)形になります。
   - 「Customer と Address が要らなくなり、削除できる」/ データと振る舞いは残り、たどり方が隠れるだけです。
   - 「Order がすべてを知る神クラスになるので、かえって悪くなる」/ Order が知るのは直接持っている Customer だけです。
3. 「委譲メソッドを増やし続けて、クラスが横流しするだけになったら?」
   - 「委譲メソッドは多いほど良いので、そのままにする」/ 横流しだけの層は、それ自体が変更の手間になります。
   - 「チェーンに戻すしかない」/ 戻す以外にも、仕事そのものを持ち主へ移す選び方があります。
   - **「中級12のように、呼び出し元へ戻して消すことも考える(Middle Man とのバランス)」**(answer: 2)/ 隠しすぎと知りすぎは表裏です。どちらに傾いたかで直し方を選びます。

### 模範解答(`sampleAnswerSteps['intermediate-law-of-demeter']`、10手)

```ts
'intermediate-law-of-demeter': [
  { extract: { from: 'printLabel', fragmentIds: ['frag-label-get-address', 'frag-label-format-address'], name: 'addressLine' } },
  { extract: { from: 'printNote', fragmentIds: ['frag-note-get-address', 'frag-note-format-address'], name: 'addressLine' } },
  { merge: { methodA: 'addressLine', methodAClass: 'ShippingLabelPrinter', methodB: 'addressLine', methodBClass: 'DeliveryNotePrinter', name: 'addressLine' } },
  { move: { method: 'addressLine', toClass: 'Customer' } },
  { extract: { from: 'printLabel', fragmentIds: ['frag-label-get-customer', '<1手目で printLabel に入った呼び出し行のID>'], name: 'shippingAddressLine' } },
  { extract: { from: 'printNote', fragmentIds: ['frag-note-get-customer', '<2手目で printNote に入った呼び出し行のID>'], name: 'shippingAddressLine' } },
  { merge: { methodA: 'shippingAddressLine', methodAClass: 'ShippingLabelPrinter', methodB: 'shippingAddressLine', methodBClass: 'DeliveryNotePrinter', name: 'shippingAddressLine' } },
  { move: { method: 'shippingAddressLine', toClass: 'Order' } },
  { changeVisibility: { method: 'getCustomer', class: 'Order', visibility: 'private' } },
  { changeVisibility: { method: 'getAddress', class: 'Customer', visibility: 'private' } },
],
```

- 5・6手目の呼び出し行のIDは `extractMethod` が採番する(`solution-<手の番号>` 由来)。実装者は1手目・2手目を適用したスナップショットから実IDを確かめて書く。
- Merge は call Fragment だけのメソッドを「呼ぶメソッド名の並び」で一致判定する(`mergeMethods.ts` 39〜54行目)ので `duplicateGroup` は要らない。統合結果は methodA 側(ShippingLabelPrinter)に残り、DeliveryNotePrinter の呼び出し行は付け替わる。
- 3手目のあと、DeliveryNotePrinter が ShippingLabelPrinter の private メソッドを呼ぶ一時的なコンパイルエラーが出る(許容済み。`stageCatalog.test.ts` 1316行目)。4手目の移動で public になって解消する。

### 方針の表(`solutionPhaseTable`)

```ts
'intermediate-law-of-demeter': [
  { from: 0, title: 'チェーンの後ろ側(住所をたどって宛先を作る)を、Customer へ移す', why: '住所を持っているのは Customer なので、住所のたどり方は Customer の中に隠すのが自然なため' },
  { from: 4, title: '残りの「顧客を取り出して頼む」を、Order へ移す', why: '印刷クラスの直接の友だちは Order だけにして、Order から先の構造を知らずに済むようにするため' },
  { from: 8, title: '外から使われなくなった getter を private にする', why: '開いたままの getter は、またチェーンでたどられる入口になるため' },
],
```

### ストーリーの章(`storyChapters.ts`、`intermediate-middle-man` の章の直後)

```ts
{
  stageId: 'intermediate-law-of-demeter',
  title: '住所までたどる印刷クラス',
  speaker: TAKAHASHI,
  intro: '印刷まわりのテストを書いていて気づきました。宛名ラベルも納品書も、注文の中の顧客、その中の住所まで知っています。住所の持ち方が変わったら、印刷のテストが全部壊れそうなんです。',
  outro: '2月の下旬。配送センターから、ラベルの印字について相談が届きました。',
},
```

### runtime(`runtime/intermediate-law-of-demeter.ts`)

- `entryMethodId: 'method-print-label'`、`entryArguments: ['"1Z999AA10123456784"']`
- `support`: `logFile` と、`SampleData.Today`(`DateTime`)を持つ補助ファイル。Address のフィールドの初期値は、中級6(`intermediate-feature-envy.ts` 51〜60行目)と同じく **補助コードの partial クラスの引数なしコンストラクタ**で与える
  (例: `postalCode = "100-0001"; prefecture = "東京都"; city = "千代田区"; street = "千代田1-1";`)。
- Order・Customer は解答後にコンストラクタ注入(`csharpWiring.ts`)されるので、補助コードにコンストラクタを書かない。
  生成される呼び出しは注入された受け手(`_customer.addressLine()` など)を使い、`customer`・`address` フィールドの値を参照しないので、未設定でも落ちない。
- `npm run csharp-export` と `bash scripts/verify-csharp.sh` で、初期・各手・最終形がビルド・実行でき、出力が一致することを確かめる。ビルドに失敗する手があれば `expectedBuildFailures` に入れる(3手目が該当する見込み)。

## 動きの仕様

- ステージ一覧・ストーリーで、中級12の次に「中級13: 注文から住所までたどる宛名印刷」が出る。
- 初期状態は **60点**: 行数 -20(`printLabel`・`printNote` が8行 > 7)、結合度 -20(印刷クラス2つがそれぞれ Order・Customer・Address の3クラスに依存 > 1)。
- 模範解答の8手目(移動)で100点。最終形の依存は ShippingLabelPrinter → Order、DeliveryNotePrinter → Order、Order → Customer、Customer → Address の各1本。
- 「チェーンを丸ごと Order へ移すだけ」(後ろ側を Customer へ移さない)では Order が Customer・Address の2つに依存して **90点**にとどまる。
  知りすぎを別のクラスへ移しただけでは直らないことを、点数で見せる。
- 最終形で Order・Customer は getter を持つので、`middle-man`(全メソッドが1行の横流し)には当たらない。
- 変更依頼:
  - `req-label-barcode`: 初期は `printLabel`(8行)が上限超えのまま +1行で -10 → 90点、解答後は 6+1=7行で 100点。痛みカードは「読む行数」8 → 6(0.75倍以下)で「はっきり楽になる」。
  - `req-address-building`: 初期は波及2クラスで 90点、解答後は波及1クラス(Customer)で 95点。

## TDD対象

新しい純粋関数は無い(ステージ定義のデータと模範解答だけ)。`lawOfDemeterStage.test.ts` を**ステージ定義より先に**書き、Red を確かめてから定義を足す。
`featureEnvyStage.test.ts` と同じく `stages`・`sampleAnswerSteps`・`applySolutionSteps` を使い、AAA で書く。

### `intermediate-law-of-demeter` のステージ定義(infrastructure)

- 初期状態 → 60点。`line-limit` count 2、`coupling` count 2、ほかは0
- 初期状態 → `classDependencies` で ShippingLabelPrinter の依存先が Order・Customer・Address の3つ
- 模範解答の最後まで適用 → 100点、依存は4本で、各クラスの依存先は1つ以下。循環なし
- 模範解答の最後まで適用 → `getCustomer`・`getAddress` が private、`findMiddleManClasses` が `[]`
- 模範解答の4手目まで(Customer へ移しただけ) → 100点未満(印刷クラスがまだ Order・Customer の2つに依存)
- 近道「`printLabel`・`printNote` の3つの call Fragment をそれぞれ抽出 → Merge → Order へ移す」 → 90点で、減点は `coupling`(Order)の1件だけ
- 変更依頼 `req-address-building` → `measureChange` の `rippleClasses` が初期2件・解答後1件(`class-customer`)
- 変更依頼 `req-label-barcode` → `measurePain` の `isClearlyRelieved` が true

## 受け入れ基準

1. ステージ一覧から中級13を選べ、初期点が60点と表示される
2. 模範解答の手順どおりに画面で操作すると100点になり、理解度チェックが3問出る(Extract Method・Merge Methods・Move Method・可視性の変更だけで解ける)
3. 中級13のメニューから C# プロジェクトの zip をダウンロードできる(`e2e/reference-menu.spec.ts` の追加行)
4. `docs/stages/report.md` に中級13の行があり、「初期点が高い」「手数が多い」の注意が付かない(60点・10手)
5. `stageCatalog.test.ts`・`stageCode.test.ts`・`storyChapters.test.ts`・`stageReport.test.ts` の既存の全ステージ共通テストが、例外表を増やさずに通る
6. `npm run check` と `npm run test:e2e` が通る。CI の `csharp` ジョブが通る

## スコープ外

- チェーンの長さ専用の減点ルール(上記のとおり `coupling` と二重になる。経路を `uses` に持たせたくなったときに再検討)
- 「引数・自分で作ったオブジェクトは友だち」という Law of Demeter の例外の判定
- C# コードをチェーンの1行(`_order.getCustomer().getAddress().formatForLabel()`)で生成すること。生成は今の注入方式(1段ごとに注入された受け手を呼ぶ)のままにし、チェーンはラベルと依存の数で見せる
- 新しい操作(「委譲メソッドを作る」専用の操作など)。既存の抽出・統合・移動で足りる
- ボスの変更依頼、`stageCatalog.test.ts` の `shortcuts` への追記(近道は新規テストファイルで確かめる)
- `docs/specs/delete-class-code-guard.md`・`extends-interface-loophole.md` の旧案への言及の書き換え
