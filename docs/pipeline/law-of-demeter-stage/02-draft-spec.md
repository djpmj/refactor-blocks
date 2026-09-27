# 仕様草案: 中級「getter の鎖で奥まで手を伸ばす」(デメテルの法則 / Hide Delegate)

- slug: `law-of-demeter-stage`
- 元: `docs/pipeline/law-of-demeter-stage/01-discovered.md`
- 前例: 中級6(`featureEnvyStage.test.ts`)・中級7(`anemicDomainModelStage.test.ts`)。ステージ1件と、そのステージ専用のテスト

## 1. 背景・目的

- `order.getCustomer().getAddress().getPrefecture()` のようなメッセージチェーン(列車事故)は、新卒〜4年目が実務でよく書き、レビューでもよく指摘される。
  呼び出し側が Order・Customer・Address のつながり方を全部知っているので、住所の持ち方が変わると、住所と関係なさそうな処理まで直すことになる。
- 中級6・7は Tell, Don't Ask を**1段**で教える(データの持ち主へ1回移す)。本件は**推移的な結合**を扱う。
  直し方は「各クラスが直接の知り合いにだけ頼む委譲の鎖を、奥から順に作る」(Hide Delegate)になる。
- **新しい操作・採点ルール・ドメインのロジックは足さない。** 表現には既存の `uses`・getter(`accessor: true`)を使う。
  減点は既存の結合度(`coupling`)・Feature Envy・責務の混在で出る。模範解答は既存の `extract`・`move` だけで書ける。

### 調査で分かったこと(01-discovered.md の4つのリスクの検証)

| リスク | 結論 |
|---|---|
| 1. `inline-method-stage` の「分けすぎ」(private・`<id>:call` あり・呼び出し元がそこだけ・`methodLines` 5行以下) | 取り次ぐメソッドは「1つ手前の getter を呼ぶ処理(4行)+ 呼び出し行(1行)」で、ブロックは**7行**になる。5行以下にならないので、private のままでも当たらない。public にする手は要らない。ステージのテストで「模範解答の途中で、Extract Method で作ったメソッドが6行未満にならない」ことを守る(4.2の3) |
| 2. `measureChange` の「触るクラス数」が1のまま変わらない | **呼び出し側を2クラスにする**(送料の計算とカタログの郵送)。両方が `customer.getAddress()` をたどるので、「配送先を複数持てるように」の依頼は、列車事故のままだと2クラス(散らばり -10)を触る。委譲の鎖にすると Customer の1クラスで済む(5.3)。呼び出し側1クラスの案は未決事項1 |
| 3. 「データの持ち主へ1回移すだけ」の近道で満点になる | `dependencyLimit: 1` にする。Address の判定だけを Address へ移すと、呼び出し側の依存先は3クラスのまま(60点)。処理を丸ごと Address へ移すと、Address が Order と Customer に依存する(80点)。Address を Customer に吸収して鎖を2段にする近道は、`responsibilityLimit: 3` で止める(90点)。どれも手計算済み(5.5) |
| 4. ステージ番号 | 中級の配列(`intermediateStages.ts`)には入れない。`stageCatalog.ts` で `intermediateStages` の**後ろ**に並べるので、`inline-method-stage` の中級9(`intermediateStages` の末尾)より必ず後ろに出る。番号は未決事項4 |

**01-discovered.md の見立てと違った点: 行き詰まりヒントの文**

- 模範解答では、前の手で残った呼び出し行(`solution-0:call` など)を選んで抽出する。
- ところが `HintPanel.tsx` は、`describeSolutionStep(stage.codebase, step)` に**初期のコードベース**を渡す。
  `fragmentLabel` は初期のコードベースに無い呼び出し行を見つけられないので、IDをそのまま返す。
  その結果、ヒントに「…・solution-0:call」をExtract Methodで…」と出てしまう。
- 既存の模範解答には、呼び出し行を抽出する手が1つも無い。そのため、今まで表に出なかった。
- 直し方は未決事項3(推奨: `HintPanel.tsx` で、その手の直前までの模範解答を当てたコードベースを渡す)。
  `HintPanel.tsx` を触る進行中の件は無い(01-discovered.md の調査のとおり)。`describeSolutionStep.ts` は触らない。

### 本当に新しい仕組みが要るか(ponytail)

- 要らない。`SolutionStep` の型・採点ルール・操作は増やさない。
- `accessorFieldAccess` は getter を1段だけたどる(ponytail コメント)が、本件は「呼び出し側が getter を複数回呼ぶ」形なので、この上限に当たらない。
- 取り次ぐメソッドが増えても、凝集度は下がらない。`cohesion.ts` の `unionByCalls` は「自クラスの getter を呼ぶ」ことでつながりを数えるので、塊は1つのままになる(5.4)。
- 「Middle Man(取り次ぐだけのクラス)」の減点は作らない(`lone-superclass-scoring.md` が見送ったのと同じ理由)。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
|---|---|---|---|
| 新規 | `src/infrastructure/stages/lawOfDemeterStage.ts` | infrastructure | ステージデータ `lawOfDemeterStage: Stage`(5章)。ファイル冒頭のコメントに、狙い(推移的な結合)、`dependencyLimit: 1`・`responsibilityLimit: 3` の理由、取り次ぐ処理を4行にしている理由(分けすぎ対策)を書く |
| 新規 | `src/infrastructure/stages/lawOfDemeterStage.test.ts` | infrastructure(test) | ステージ専用のテスト(4.2)。`featureEnvyStage.test.ts` と同じ形。近道もここに書く(`stageCatalog.test.ts` の `shortcuts` には足さない) |
| 変更 | `src/infrastructure/stages/stageCatalog.ts` | infrastructure | import 1行と、配列の `...intermediateStages,` の直後に `lawOfDemeterStage,` を1要素足す |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain | `sampleAnswerSteps` の `'intermediate-volatile-format'` のエントリの**直後**に `'intermediate-law-of-demeter'` を足す(5.4)。型・`applyStep` は触らない |
| 変更 | `src/presentation/stage/HintPanel.tsx` | presentation | 未決事項3がAのとき: 各ヒントの文に、その手の直前までの模範解答を当てたコードベースを渡す(3.2) |
| 変更 | `e2e/refactor.spec.ts` | E2E | 未決事項5がAのとき: ヒントに呼び出し行の名前が出ることを1件確かめる(6章の10) |

**触らないファイル**: `intermediateStages.ts`、`advancedStages.ts`、`stageCatalog.test.ts`、`score.ts` などの採点、`describeScore.ts`、`describeSolutionStep.ts`、`StagePanel.tsx`、`useGameStore.ts`、`Codebase.ts`、`extractMethod.ts`、`moveMethod.ts`。

## 3. データ/型の変更

### 3.1 型・永続化

型と永続化スキーマの変更は無い。ステージデータは既存の `Stage` 型のまま書く。

### 3.2 `HintPanel.tsx`(未決事項3がAのとき)

- 今は `steps.slice(0, revealedCount).map((step) => describeSolutionStep(stage.codebase, step))` になっている。
- これを、i 番目のヒントには `applySolutionSteps(stage.codebase, steps.slice(0, i))` のコードベースを渡す形にする。
  累積で1回ずつ当てていけば O(n) で済む。素直に毎回先頭から当てる O(n²) でもよい。その場合は、`// ponytail: <上限>、<いつ・どう直すか>` のコメントを残す。
- 既存のステージは、ヒントの文が1文字も変わらない。
  - 模範解答の手が指す処理のIDは、その手の時点で必ずある(無ければ `applyStep` が例外を投げ、`stageCatalog.test.ts` が落ちる)
  - `extract`・`move`・`merge` は処理のラベルを書き換えない
- `applySolutionSteps` は失敗すると例外を投げる。ただ、模範解答が100点で最後まで当たることは `stageCatalog.test.ts` が全ステージで守っている。
  そのため、`HintPanel` に例外処理は足さない。

## 4. TDD対象の純粋関数

### 4.1 新しい純粋関数

**無い。** `domain`/`application` 層にロジックを足さない(ステージデータと模範解答だけ)。
TDDの代わりに、ステージ専用のテスト(4.2)を**データより先に書く**(Red → データを書いて Green)。

### 4.2 `lawOfDemeterStage.test.ts`(AAA、`featureEnvyStage.test.ts` と同じ形)

1. **初期状態は20点**
   - 内訳: 行数1(`calculateShippingFee` 86行 > 60)、結合度2(ShippingFeeCalculator の依存先3・CatalogMailer の依存先2)、
     責務の混在2(5種類・4種類 > 3)、Feature Envy 2(どちらのメソッドも Address のフィールドを2つ以上読む)、凝集度1(Address の getter 3つがばらばら)
   - `visibility`・`encapsulation`・`cycle` は0件
2. **模範解答のあとは100点で、依存は直接の知り合いだけ**
   - `classDependencies` の (from, to) は次の4本だけ: `class-shipping-fee-calculator → class-order`、`class-order → class-customer`、
     `class-customer → class-address`、`class-catalog-mailer → class-customer`
   - 呼び出し側から Address への依存が無い
   - `findLowCohesionClasses` は `[]`
3. **分けすぎ対策**: 模範解答を1手ずつ当てた、どの途中の状態でも、ID が `solution-` で始まるメソッドの `methodLines` は6以上
   (`inline-method-stage` の「分けすぎ」の定義に、どちらのマージ順でも当たらないことの保証。`findOverSplitMethods` はまだ無いので行数で確かめる)
4. **変更依頼**(5.3の表)
   - 点数は、初期が `[35, 70]`、模範解答のあとが `[90, 95]`
   - `req-multiple-addresses` の `classesTouched` は、初期2 → 模範解答のあと1
   - `req-remote-island-list` の `classesTouched` は、1 → 1
5. **近道はどれも100点にならない**(5.5の4件、`it.each`)。点数は表の値を `toBe` で確かめる。
   実装者の実測が表と違ったら、実測に合わせてテスト名と表を直し、PRの説明に書く(中級8の前例と同じ扱い)

`stageCatalog.test.ts` の全ステージ共通のテストは、`stages` に入るだけで自動でかかる。
対象は、ID重複・`reads` の参照先・80行以上・上限の順・初期減点・模範解答100点・依頼2件以上・partName・変更容易性の向上・触るクラス数が増えないこと。

## 5. ステージ

### 5.1 概要

- id: `intermediate-law-of-demeter`
- title: `中級10: getter の鎖で奥まで手を伸ばす`(番号は未決事項4)
- level: `intermediate`
- description(案):
  「ネット通販の送料を計算する ShippingFeeCalculator と、会員にカタログを郵送する CatalogMailer。
  どちらも order.getCustomer().getAddress().getPrefecture() や customer.getAddress().getPostalCode() のように getter をたどり、
  住所(Address)の中身まで自分で読んで判断している。呼び出し側が Order・Customer・Address のつながり方を全部知っているので、
  顧客が配送先を複数持てるようにするだけで、住所とは関係なさそうな送料の計算とカタログの郵送の両方を直すことになる。」
- goal(案):
  「直接の知り合いにだけ頼もう(デメテルの法則)。奥の Address から順に、そのクラスのデータを使う処理を Extract Method して持ち主へ移す。
  次は、1つ手前の getter を呼ぶ処理と、いま残った呼び出し行をまとめて Extract Method し、1つ手前のクラスへ移す(Hide Delegate)。
  メソッドは60行以内、1クラスの責務は3種類まで、依存先は1クラスまで」
- `limits: { method: 60, class: 150, file: 300 }`、`dependencyLimit: 1`、`responsibilityLimit: 3`
- `visibilityEnforced` は省略(未決事項2)

### 5.2 初期コード(5ファイル・5クラス)

フィールドはすべて private。getter の処理は `responsibility: 'accessor'`・`accessor: true`・3行とし、そのクラスのフィールドを `reads` に1つ持つ。

| ファイル(id) / クラス(id) | フィールド(id: name) | メソッド(可視性, id) と処理(id / label / lines / responsibility / uses) |
|---|---|---|
| `src/shipping/ShippingFeeCalculator.ts`(`file-shipping-fee-calculator`)/ `ShippingFeeCalculator`(`class-shipping-fee-calculator`) | なし | `calculateShippingFee`(public, `method-calculate-shipping-fee`):<br>`frag-measure-package` / 荷物の重さと3辺の合計からサイズ区分を決める / 26 / `package` / suggestedName `measurePackage`<br>`frag-fee-pick-customer` / getCustomer() で注文した顧客を取り出す(退会済みなら例外にする) / 4 / `order-customer` / uses `method-get-customer`<br>`frag-fee-pick-address` / getAddress() で顧客の既定の配送先住所を取り出す / 4 / `customer-address` / uses `method-get-address`<br>`frag-judge-region` / getPrefecture()・getPostalCode() で都道府県と郵便番号を取り出し、配送地域(本州・北海道・沖縄・離島)を判定する / 22 / `region` / uses `method-get-prefecture`, `method-get-postal-code` / suggestedName `shippingRegion`<br>`frag-look-up-fee` / 配送地域とサイズ区分から料金表で送料を決める / 28 / `fee` / suggestedName `lookUpFee` |
| `src/marketing/CatalogMailer.ts`(`file-catalog-mailer`)/ `CatalogMailer`(`class-catalog-mailer`) | なし | `sendCatalog`(public, `method-send-catalog`):<br>`frag-choose-catalog` / 購入履歴からおすすめのカタログを選ぶ / 20 / `recommendation`<br>`frag-catalog-pick-address` / getAddress() で顧客の既定の配送先住所を取り出す / 4 / `customer-address` / uses `method-get-address`<br>`frag-format-mailing-label` / getPostalCode()・getPrefecture()・getAddressLine() で郵便番号・都道府県・番地を取り出し、宛名ラベルの形に並べる / 18 / `mailing-label` / uses `method-get-postal-code`, `method-get-prefecture`, `method-get-address-line` / suggestedName `mailingLabel`<br>`frag-request-printing` / 印刷会社へカタログの発送を依頼する / 16 / `printing` |
| `src/order/Order.ts`(`file-order`)/ `Order`(`class-order`) | `field-order-customer`: customer | `getCustomer`(public, `method-get-customer`): `frag-get-customer` / 注文した顧客を返す / reads `field-order-customer` |
| `src/customer/Customer.ts`(`file-customer`)/ `Customer`(`class-customer`) | `field-customer-address`: address | `getAddress`(public, `method-get-address`): `frag-get-address` / 既定の配送先住所を返す / reads `field-customer-address` |
| `src/customer/Address.ts`(`file-address`)/ `Address`(`class-address`) | `field-postal-code`: postalCode、`field-prefecture`: prefecture、`field-address-line`: addressLine | `getPostalCode`(`method-get-postal-code`)/ `getPrefecture`(`method-get-prefecture`)/ `getAddressLine`(`method-get-address-line`)。どれも public。処理は `frag-get-postal-code` 等で、郵便番号・都道府県・番地を返し、それぞれ対応するフィールドを reads に持つ |

- 行数: `calculateShippingFee` は 84 + 2 = **86行**で、「80行以上のメソッドがある」を満たす。`sendCatalog` は 58 + 2 = 60行。
  getter は各5行。クラスは、ShippingFeeCalculator 88 / CatalogMailer 62 / Order 7 / Customer 7 / Address 17。
- 取り次ぐ処理(`frag-fee-pick-customer`・`frag-fee-pick-address`・`frag-catalog-pick-address`)は **4行を下回らせない**。
  3行以下にすると、模範解答で作る取り次ぐメソッドが6行を切り、「分けすぎ」の定義(5行以下)に近づく(4.2の3)。
- 初期の減点(4.2の1)は、合計 -80 で **20点**。
  - 行数 -10
  - 結合度 -20
  - 責務 -20: ShippingFeeCalculator の責務は `package`・`order-customer`・`customer-address`・`region`・`fee`、CatalogMailer は `recommendation`・`customer-address`・`mailing-label`・`printing`
  - Feature Envy -20: `calculateShippingFee` が読む他クラスのフィールドは Order 1・Customer 1・Address 2。`sendCatalog` は Customer 1・Address 3
  - 凝集度 -10: Address の getter 3つは、互いにつながらない塊が3つある。中級7の Account と同じ理由で、初期から減点される

### 5.3 変更依頼(どちらも modify)

| id | title / description | responsibility | linesPerSite | partName |
|---|---|---|---|---|
| `req-multiple-addresses` | 配送先を複数登録できるようにして / 顧客が自宅・勤務先など複数の配送先を登録し、既定の配送先を選べるようにしたい。 | `customer-address` | 6 | `pickDefaultAddress` |
| `req-remote-island-list` | 離島の判定を郵便番号の一覧で行って / 都道府県だけでは離島を見分けられないので、郵便番号の離島一覧と照らし合わせて判定したい。 | `region` | 8 | `matchRemoteIslandPostalCodes` |

手計算(`measureChange` → `scoreChange`):

| 依頼 | 初期 | 模範解答後 |
|---|---|---|
| 配送先を複数 | 変更箇所は2メソッド・2クラス(散らばり -10)。巻き込みは `calculateShippingFee` 4 + `sendCatalog` 3 = 7(-35)。上限超えは2(92行・66行 > 60、-20)→ **35点** | 変更箇所は Customer の `shippingRegion`・`mailingLabel`(1クラス)。波及は Order・CatalogMailer(-10)→ **90点** |
| 離島の判定 | 変更箇所は `calculateShippingFee`(1クラス)。巻き込み4(-20)。上限超え1(94行、-10)→ **70点** | 変更箇所は Address の `shippingRegion`。波及は Customer(-5)→ **95点** |

- 変更容易性は、初期 53(`Math.round(52.5)`)→ 模範解答後 93(`Math.round(92.5)`)に上がる
- 変更が必要なクラス数は `[2, 1]` → `[1, 1]` で、増えない
- 「住所の持ち方の変更で、送料の計算とカタログの郵送の両方を触る」ことが、散らばり(2クラス → 1クラス)で見える

### 5.4 模範解答(`sampleAnswerSteps['intermediate-law-of-demeter']`、10手)

同じ名前の取り次ぎメソッド(`shippingRegion`・`mailingLabel`)を各段に作るのが Hide Delegate の定石である。
そのため、`move` には `fromClass` を必ず書く。

```ts
'intermediate-law-of-demeter': [
  // 送料: 奥(Address)から順に委譲の鎖を作る
  { extract: { from: 'calculateShippingFee', fragmentIds: ['frag-judge-region'], name: 'shippingRegion' } },                    // solution-0
  { move: { method: 'shippingRegion', fromClass: 'ShippingFeeCalculator', toClass: 'Address' } },
  { extract: { from: 'calculateShippingFee', fragmentIds: ['frag-fee-pick-address', 'solution-0:call'], name: 'shippingRegion' } }, // solution-2
  { move: { method: 'shippingRegion', fromClass: 'ShippingFeeCalculator', toClass: 'Customer' } },
  { extract: { from: 'calculateShippingFee', fragmentIds: ['frag-fee-pick-customer', 'solution-2:call'], name: 'shippingRegion' } }, // solution-4
  { move: { method: 'shippingRegion', fromClass: 'ShippingFeeCalculator', toClass: 'Order' } },
  // カタログ: Customer → Address の2段
  { extract: { from: 'sendCatalog', fragmentIds: ['frag-format-mailing-label'], name: 'mailingLabel' } },                        // solution-6
  { move: { method: 'mailingLabel', fromClass: 'CatalogMailer', toClass: 'Address' } },
  { extract: { from: 'sendCatalog', fragmentIds: ['frag-catalog-pick-address', 'solution-6:call'], name: 'mailingLabel' } },     // solution-8
  { move: { method: 'mailingLabel', fromClass: 'CatalogMailer', toClass: 'Customer' } },
],
```

最終形(手計算):

| クラス | メソッド(行数) | 依存先 | 責務 |
|---|---|---|---|
| ShippingFeeCalculator | `calculateShippingFee` 57(26 + 呼び出し1 + 28) | Order | package・fee |
| CatalogMailer | `sendCatalog` 39 | Customer | recommendation・printing |
| Order | `getCustomer` 5、`shippingRegion` 7(4 + 呼び出し1) | Customer | accessor・order-customer |
| Customer | `getAddress` 5、`shippingRegion` 7、`mailingLabel` 7 | Address | accessor・customer-address |
| Address | getter 3つ(各5)、`shippingRegion` 24、`mailingLabel` 20 | なし | accessor・region・mailing-label |

最終形のそれぞれの採点ルールは次のとおり。

- 行数・結合度・循環・責務は、すべて上限内
- Feature Envy は無い。取り次ぐメソッドは自クラスの getter だけを読む
- カプセル化の破れは無い(getter 越しの読み取りは破れに数えない)
- 使われていない private メソッドは無い。`solution-*` はどれも、1つ外側の呼び出し行から呼ばれている
- 凝集度は下がらない。Address は `shippingRegion`(2つの getter)と `mailingLabel`(3つの getter)で、塊が1つにつながる。Order・Customer は、取り次ぐメソッドが自クラスの getter を呼ぶので、塊は1つ
- → **100点**

取り次ぐメソッドは private のまま、他クラスから呼ばれる。`visibilityEnforced` を付けないので減点されない(中級6の `isInTrial` と同じ扱い)。
付けるかは未決事項2。

### 5.5 近道(`lawOfDemeterStage.test.ts` に書く。どれも100点にならない)

| # | 近道 | 手順(要点) | 手計算の結果 |
|---|---|---|---|
| 1 | 列車事故の処理を丸ごと Address へ移す(持ち主へ1回移すだけ) | `calculateShippingFee` から `frag-fee-pick-customer`・`frag-fee-pick-address`・`frag-judge-region` をまとめて `shippingRegion` に抽出し、Address へ移す。`sendCatalog` から `frag-catalog-pick-address`・`frag-format-mailing-label` を `mailingLabel` に抽出し、Address へ移す | Address の依存先は Order・Customer の2つ(結合度 -10)。Address の責務は5種類(-10)→ **80点** |
| 2 | 中級6と同じく、住所を読む判断だけを Address へ移す | `frag-judge-region` → `shippingRegion` → Address、`frag-format-mailing-label` → `mailingLabel` → Address | 呼び出し側の依存先は3つと2つのまま(結合度 -20)。`calculateShippingFee` は65行(-10)。ShippingFeeCalculator の責務は4種類(-10)→ **60点** |
| 3 | Customer までで止め、Order を経由しない | 模範解答の1〜4手目(送料)と、カタログの4手を当てる。ただし手の番号がずれるので、カタログの2回目の抽出は `'solution-4:call'` を選ぶ | ShippingFeeCalculator の依存先は Order・Customer の2つ(-10)。`calculateShippingFee` は61行(-10)→ **80点** |
| 4 | Address を Customer に吸収し(Inline Class)、鎖を2段にする | `moveField` で postalCode・prefecture・addressLine を Address から Customer へ移す。getter 3つを `move` で Customer へ移し、`deleteFile: 'src/customer/Address.ts'` で消す。あとは模範解答と同じ形で、送料は [住所・地域判定] を Customer へ、[顧客・`solution-7:call`] を Order へ移す。カタログは [住所・宛名ラベル] を Customer へ移す | 結合度・Feature Envy・凝集度は0件。Customer の責務は `accessor`・`customer-address`・`region`・`mailing-label` の4種類(-10)→ **90点**。**`responsibilityLimit` を4以上にすると100点になる**ので、3より大きくしない(中級8で切り出した「住所」の値のまとまりを、元に戻す向きの近道のため) |

近道の手順は、ステップの番号で `solution-<n>` のIDが決まる。
呼び出し行を選ぶ手は、実装者が `applySolutionSteps` の番号を数えて書く。

## 6. 受け入れ基準

1. ステージ選択で、中級の最後(`inline-method-stage` がマージ済みなら中級9の後ろ)、上級1の前に `中級10: getter の鎖で奥まで手を伸ばす` が出る
2. 初期状態は20点で、内訳は 4.2の1 のとおり
3. 模範解答どおりに操作すると100点になり、依存は 4.2の2 の4本だけになる
4. `stageCatalog.test.ts` の全ステージ共通のテストが、`stageCatalog.test.ts` を変更せずに通る
5. `lawOfDemeterStage.test.ts` の 4.2 の1〜5がすべて通る。特に次の2つ:
   - 近道4件がどれも100点未満
   - 変更依頼の点数が `[35, 70]` → `[90, 95]`
6. 模範解答の途中で、Extract Method で作ったメソッドが6行を下回らない(4.2の3)。
   `inline-method-stage` が先にマージされても後にマージされても、このステージは100点のまま
7. `sampleAnswer.ts` の差分は、`'intermediate-volatile-format'` の直後に1エントリを足すだけ。`SolutionStep`・`applyStep` に差分が無い
8. `score.ts`・`describeSolutionStep.ts`・`intermediateStages.ts`・`advancedStages.ts`・`stageCatalog.test.ts` に差分が無い
9. (未決事項3がAのとき)行き詰まりヒントの3手目が、次の文になる。「solution-0:call」のようなIDは出ない。

   「calculateShippingFee から「getAddress() で顧客の既定の配送先住所を取り出す・shippingRegion() を呼び出す」をExtract Methodで取り出し、shippingRegion という名前にしよう」

   既存ステージのヒントの文は変わらない
10. (未決事項5がAのとき)`e2e/refactor.spec.ts` にケースを1つ足し、通る。内容は、このステージを選んで「ヒントを見る」を3回押すと、3つ目のヒントに `shippingRegion() を呼び出す` が含まれ、`solution-` が含まれないこと
11. `npm run check` と `npm run test:e2e` が通る。`domain`/`application` のカバレッジの閾値を割らない

## 7. スコープ外

- 新しい採点ルール(Message Chain の直接検出、Middle Man の減点、使われなくなった public getter の減点)。
  `coupling` と Feature Envy で足りる。取り次ぐだけのクラスを減点すると、このステージの正解と矛盾する
- getter を private に狭める手を、模範解答や採点に入れること(開いた getter は減点しない。setter の `findOpenSetters` だけが今のルール)
- `accessorFieldAccess` を再帰にすること(getter が getter を呼ぶ題材は作らない)
- 別の呼び出し元の処理を、作った取り次ぎメソッドへ付け替える操作(「uses の付け替え」)。今回は呼び出し側ごとに鎖を作る
- `describeSolutionStep.ts` の文言の変更、設計くらべクイズ(「列車事故 vs 委譲の鎖」)の追加、AI講評の言い回しの調整
- `intermediateStages.ts` への移設と、中級の番号の振り直し(番号は未決事項4)
- 既存ステージの数値・模範解答の見直し

## 未決事項

### 未決事項1: 列車事故の呼び出し側を何クラスにするか

- 選択肢A(推奨): 2クラス(送料の計算とカタログの郵送)。「住所の持ち方の変更」で触るクラスが2 → 1 に減り、散らばりの減点(-10 → 0)で Hide Delegate の効果が見える。模範解答は10手
- 選択肢B: 1クラス(送料の計算だけ)。模範解答は6手で短い。ただ、どの依頼でも触るクラス数は1 → 1 のままになる。点数は上がるが、上がるのは巻き込みと上限超えが減るからで、これは Extract Method の効果である。デメテルの法則に固有の効果は、変更依頼の側には出ない

### 未決事項2: `visibilityEnforced` を付けるか

- 選択肢A(推奨): 付けない(中級6と同じ)。取り次ぐメソッドは private のまま他クラスから呼ばれるが、減点しない。可視性は中級3・7で練習済みなので、このステージは鎖の組み方に集中させる。模範解答は10手
- 選択肢B: 付ける(中級7と同じ)。取り次ぐメソッド5つを public にする手が要り、模範解答は15手になる。「Order の public な窓口で取り次ぐ」という Hide Delegate の形に最も忠実になる

### 未決事項3: ヒントに出る呼び出し行の名前をどう直すか

- 選択肢A(推奨): `HintPanel.tsx` で、各ヒントに「その手の直前までの模範解答を当てたコードベース」を渡す(3.2)。数行の変更で済み、既存ステージの文は変わらない。進行中の件と衝突しない
- 選択肢B: 直さない。ヒントに「…・solution-0:call」をExtract Methodで…」と出る
- 選択肢C: `describeSolutionStep.ts` の `fragmentLabel` で、`<id>:call` のときに抽出した名前を探して補う。ただ、`inline-method-stage` が同じファイルを触るので衝突しやすい

### 未決事項4: ステージの番号

- 選択肢A(推奨): 「中級10」で固定する。`stageCatalog.ts` で `intermediateStages` の後ろに並べるので、`inline-method-stage` の中級9より必ず後ろに出る。本件が先にマージされると、中級9が一時的に欠番になる
- 選択肢B: マージする時点で、中級9か中級10のどちらかに決める。欠番は出ない。ただ、本件を中級9にしたあとで `inline-method-stage` がマージされると、中級10(`intermediateStages` の末尾)が中級9より前に並ぶ。そのため、どちらかのタイトルを直す必要が出る

### 未決事項5: E2E を足すか

- 選択肢A(推奨): 1件だけ足す。ヒントを3回開くと、呼び出し行の名前(`shippingRegion() を呼び出す`)が出て、`solution-` が出ないことを確かめる(未決事項3がAのとき。`HintPanel.tsx` の変更を守る)
- 選択肢B: 足さない。プレイヤーの操作(抽出・移動)は既存のままで、ステージのデータはユニットテストで守られている
